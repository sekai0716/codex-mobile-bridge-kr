import base64
import copy
import json
import hashlib
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from bridge.features.sessions.model import normalize_item, normalize_state
from bridge.features.sessions.timeline import Timeline, PAGE_BYTES, encoded
from bridge.app.service import Bridge, LiveSession
from bridge.features.sessions import tool_images
from bridge.features.sessions.tool_images import public_turns

PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR7kAAAAASUVORK5CYII='


def image(data=PNG, mime='image/png'):
    return {'type': 'image', 'data': data, 'mimeType': mime}


def result():
    return {'content': [{'type': 'text', 'text': json.dumps({'content': [
        {'type': 'text', 'text': 'Screenshot ready'}, image()]})}]}


class ToolImageTests(unittest.TestCase):
    def test_previewing_twenty_images_does_not_decode_the_whole_history_per_image(self):
        session = LiveSession('images', image_cache=tool_images.ToolImageCache())
        data = [base64.b64decode(PNG) + bytes([i]) for i in range(20)]
        session.state = {'turns': [{'turnId': 'turn', 'items': [
            {'type': 'mcpToolCall', 'id': 'shots', 'result': {'content': [
                image(base64.b64encode(raw).decode()) for raw in data]}}]}]}
        bridge = Bridge.__new__(Bridge)
        bridge.session = lambda *args, **kwargs: session
        with patch.object(base64, 'b64decode', wraps=base64.b64decode) as decode:
            session.view()
            with patch.object(session, 'view', wraps=session.view) as view:
                for raw in data:
                    preview, _ = bridge.desktop_image_preview('images', hashlib.sha256(raw).hexdigest())
                    self.assertEqual(preview['previewBytes'], raw)
                view.assert_not_called()
            for i in range(3):
                with session.condition:
                    session.state['turns'][0]['items'].append({'type': 'agentMessage', 'text': str(i)})
                    session.changed()
                session.view()
            self.assertEqual(decode.call_count, 20)

    def test_nested_computer_use_output_retains_text_and_extracts_image_without_mutation(self):
        item = {'type': 'mcpToolCall', 'id': 'shot', 'server': 'cua_repl', 'tool': 'js', 'result': result()}
        original = copy.deepcopy(item)
        row = normalize_item(item)
        self.assertEqual(item, original)
        self.assertNotIn(PNG, row['output'])
        self.assertIn('Screenshot ready', row['output'])
        self.assertEqual(row['attachments'][0]['type'], 'toolImage')
        self.assertEqual(row['attachments'][0]['data'], PNG)

    def test_saved_and_dynamic_results_have_same_images(self):
        live = normalize_item({'type': 'dynamicToolCall', 'contentItems': [image()]})
        state = normalize_state({'turns': [{'turnId': 'turn', 'items': [
            {'type': 'function_call', 'call_id': 'call', 'name': 'mcp__cua_repl__js'},
            {'type': 'function_call_output', 'call_id': 'call', 'output': json.dumps(result())}]}]})
        saved = state['turns'][0]['messages'][0]
        self.assertEqual(live['attachments'], saved['attachments'])
        self.assertNotIn(PNG, saved['output'])

    def test_saved_computer_images_follow_call_ids_across_page_boundaries(self):
        title = 'Check the saved preview'
        args = {'code': ' '.join(['await inspect();'] * 25), 'title': title}
        different = base64.b64encode(base64.b64decode(PNG) + b'second').decode()
        items = [
            {'type': 'function_call', 'namespace': 'mcp__cua_repl', 'name': 'js', 'call_id': 'a', 'arguments': json.dumps(args)},
            {'type': 'custom_tool_call', 'name': 'exec', 'call_id': 'b', 'input': 'image((await tools.mcp__computer_use_linux__screenshot({})).content[0]);'},
            {'type': 'custom_tool_call_output', 'call_id': 'b', 'output': [image(different)]},
            {'type': 'function_call_output', 'call_id': 'a', 'output': result()}]
        view = normalize_state({'turns': [{'turnId': 'turn', 'items': items}]}, item_limit=2)
        timeline = Timeline()
        timeline.update({**view, 'sequence': 1})
        a, b = timeline.page()['rows']
        self.assertEqual((a['title'], a['computerUse']), ('cua_repl · js', {'title': title}))
        self.assertEqual((b['title'], b['computerUse']), ('functions.exec', {'action': 'screenshot'}))
        self.assertNotIn(title, a['text'])  # The title follows the bounded code preview.
        self.assertIn(title, timeline.details[a['key']])
        for row, data in ((a, PNG), (b, different)):
            self.assertEqual([img['desktopId'] for img in row['attachments']], [hashlib.sha256(base64.b64decode(data)).hexdigest()])
            self.assertNotIn(data, json.dumps(row))

    def test_live_computer_image_uses_its_source_tool_and_never_a_window_title(self):
        wrapper = 'await tools.mcp__computer_use_linux__click({}); image((await tools.mcp__computer_use_linux__screenshot({})).content[0]);'
        cases = [
            ({'server': 'cua_repl', 'tool': 'js', 'arguments': {'title': 'Save preview'}}, {'title': 'Save preview'}),
            ({'tool': 'mcp__cua_repl__js'}, {'action': 'js'}),
            ({'server': 'computer-use-linux', 'tool': 'click', 'arguments': {'title': 'private window', 'screenshot_after': True}}, {'action': 'click'}),
            ({'toolName': 'mcp__computer_use_linux__get_app_state'}, {'action': 'get_app_state'}),
            ({'namespace': 'functions', 'tool': 'exec', 'arguments': {'code': wrapper}}, {'action': 'multiple'}),
            ({'tool': 'functions.exec', 'arguments': json.dumps({'code': wrapper})}, {'action': 'multiple'}),
            ({'server': 'node_repl', 'tool': 'js', 'arguments': {'title': 'Check the dialog'}}, {'title': 'Check the dialog'}),
            ({'server': 'another_server', 'tool': 'run', 'arguments': {'title': 'Other image'}}, {'title': 'Other image'}),
            ({'server': 'another_server', 'tool': 'js', 'arguments': {'sample': {'title': 'Not this call'}}}, None),
            ({'server': 'another_server', 'tool': 'exec', 'arguments': {'code': wrapper}}, None),
            ({'tool': 'functions.exec', 'arguments': {'code': '// '+wrapper+'\ntext(`'+wrapper+'`);'}}, None)]
        for call, expected in cases:
            with self.subTest(call=call):
                started = {'type': 'dynamicToolCall', 'id': 'live', **call}
                pending = normalize_item(started)
                self.assertEqual(pending.get('computerUse'), expected)
                self.assertNotIn('attachments', pending)
                completed = normalize_item({**started, 'contentItems': [image()]})
                self.assertEqual(completed.get('computerUse'), expected)
                self.assertEqual(len(completed['attachments']), 1)

    def test_saved_and_live_text_calls_keep_titles_results_and_their_own_reviews(self):
        calls = [
            ('inspect', {'code': 'checkWindow()', 'title': 'Studio 창을 복원해 장치 상태 확인'}, 'undefined', False),
            ('done', {'title': ' ', 'completion_summary': 'Confirmed print continued at layer 187'},
             'Completion summary received.', False),
            ('failed', {'code': 'restoreValue()', 'title': '기준판의 저장 플러시 수치 복원'},
             'point is over another window', True),
        ]
        saved, results, live, reviews = [], [], [], []
        for key, args, text, failed in calls:
            meta = {'codex/telemetry': {'error_code': 'unknown'}} if failed else None
            result = {'content': [{'type': 'text', 'text': text}], 'structuredContent': None, '_meta': meta}
            saved.append({'type': 'function_call', 'namespace': 'mcp__cua_repl', 'name': 'js',
                          'id': 'record-' + key, 'call_id': key, 'arguments': json.dumps(args)})
            results.append({'type': 'function_call_output', 'call_id': key, 'output': json.dumps(result)})
            live.append({'type': 'mcpToolCall', 'server': 'cua_repl', 'tool': 'js', 'arguments': args,
                         'id': key, 'status': 'failed' if failed else 'completed', 'result': result})
            reviews.append({'type': 'automaticApprovalReview', 'targetItemId': key, 'id': 'review-' + key,
                            'status': 'approved', 'rationale': 'Approved ' + key})
        session = LiveSession('thread', image_cache=tool_images.ToolImageCache())
        def state(items):
            return {'id': 'thread', 'turns': [{'turnId': 'turn', 'status': 'completed', 'items': items}]}
        with session.condition:
            session.set_history(state(saved + results[::-1] + reviews))
            for connected in (False, True):
                session.connected = connected
                session.state = state(live + reviews)
                view = session.view()
                timeline = Timeline()
                timeline.update({**view, 'sequence': 1})
                rows = timeline.page()['rows']
                for row, (key, args, text, failed) in zip(rows[:3], calls, strict=True):
                    self.assertEqual(row['computerUse'], {'title': args['title'].strip() or args['completion_summary']})
                    self.assertNotIn('attachments', row)
                    self.assertEqual(row.get('success') is False, failed)
                    self.assertEqual(row['approvalReview']['id'], 'review-' + key)
                    detail = timeline.detail(timeline.cursor(row['key']))['text']
                    for value in (args.get('code') or args['completion_summary'], text, 'Approved ' + key):
                        self.assertIn(value, detail)
                self.assertEqual(len(rows[3:]), 3)
                self.assertTrue(all(row['reviewLinked'] for row in rows[3:]))

    def test_failed_tool_keeps_native_error_body_and_uses_structured_failure_signals(self):
        call = {'type': 'mcpToolCall', 'server': 'cua_repl', 'tool': 'js', 'arguments': {'title': 'Check window'}}
        error = normalize_item({**call, 'result': None, 'error': {'message': 'window no longer exists'}})
        self.assertFalse(error['success'])
        self.assertIn('window no longer exists', error['output'])
        for output, failed in [(json.dumps({'isError': True}), True), ({'isError': False}, False),
                               ({'content': [{'type': 'text', 'text': 'unknown error_code'}]}, False)]:
            self.assertEqual(normalize_item({**call, 'result': output}).get('success') is False, failed)

    def test_titled_calls_with_mixed_text_and_images_follow_their_call_id_and_content_order(self):
        args = {'code': 'await scrollStudio(654,393,-380);', 'title': 'Looking above the main nozzle temperature', 'timeout_ms': 30000}
        text = {'type': 'text', 'text': '225 fields, focus: filament settings'}
        samples = [base64.b64decode(PNG) + suffix for suffix in (b'first', b'second')]
        blocks = [image(base64.b64encode(raw).decode()) for raw in samples]
        ids = [hashlib.sha256(raw).hexdigest() for raw in samples]
        result = {'content': [text, *blocks], 'structuredContent': None, '_meta': {'codex/nodeReplExecutionDurationMs': 2589}}
        for provider in ('node_repl', 'cua_repl', 'future_repl'):
            with self.subTest(provider=provider):
                session = LiveSession('chat', image_cache=tool_images.ToolImageCache())
                def state(items):
                    return {'id': 'chat', 'turns': [{'turnId': 'turn', 'items': items}]}
                call = {'type': 'mcpToolCall', 'server': provider, 'tool': 'js', 'id': 'call', 'arguments': args}
                saved = state([{'type': 'function_call', 'name': 'mcp__' + provider + '__js', 'call_id': 'call',
                                'arguments': json.dumps(args)},
                               {'type': 'function_call_output', 'call_id': 'call', 'output': json.dumps(result)}])
                with session.condition:
                    session.set_history(saved)
                    for content in (None, result, {'content': [text, *[
                            {'type': 'image', 'mimeType': 'image/png', 'preview': key} for key in ids]]}):
                        session.connected = content is not None
                        session.state = state([{**call, 'result': content}])
                        row = session.view()['turns'][0]['messages'][0]
                        self.assertEqual((row['title'], row['computerUse']), (provider + ' · js', {'title': args['title']}))
                        self.assertIn(text['text'], row['output'])
                        self.assertEqual([img['desktopId'] for img in row['attachments']], ids)
                        self.assertNotIn('data', row['attachments'][0])
                    # A valid preview from a different call grants no file access.
                    session.state['turns'][0]['items'][0]['id'] = 'different-call'
                    unavailable = session.view()['turns'][0]['messages'][0]
                    self.assertNotIn('attachments', unavailable)
                    self.assertTrue(unavailable['computerUse']['imageUnavailable'])

    def test_tool_content_images_follow_budgets_and_never_leak_publicly(self):
        item = {'type': 'mcpToolCall', 'id': 'content-shot', 'result': 'ready',
                'content': [image(), image('A' * (12 * 1024 * 1024))]}
        row = normalize_item(item)
        self.assertEqual(len(row['attachments']), 1)
        self.assertEqual(row['attachments'][0]['type'], 'toolImage')
        self.assertNotIn(PNG, row['output'])
        turns = [{'id': 'turn', 'messages': [row]}]
        public = public_turns(turns)
        self.assertNotIn(PNG, json.dumps(public))
        self.assertEqual(public[0]['messages'][0]['attachments'][0]['desktopId'], row['attachments'][0]['desktopId'])
        timeline = Timeline()
        timeline.update({'sequence': 1, 'turns': public})
        self.assertNotIn(PNG, encoded(timeline.page()).decode())
        self.assertEqual(timeline.page()['rows'][0]['attachments'][0]['type'], 'toolImage')
        # Content-only dynamic results take the same extraction path.
        dynamic = normalize_item({'type': 'dynamicToolCall', 'content': [image()]})
        self.assertEqual(dynamic['attachments'][0]['desktopId'], row['attachments'][0]['desktopId'])
        self.assertNotIn(PNG, json.dumps(public_turns([{'messages': [dynamic]}])))

    def test_clipped_desktop_screenshot_uses_only_the_matching_saved_call(self):
        full = base64.b64encode(base64.b64decode(PNG) + bytes(range(256))).decode()
        clipped = full[:40] + '…' + str(len(full)-80) + ' chars truncated…' + full[-40:]
        session = LiveSession('thread', image_cache=tool_images.ToolImageCache())
        saved = {'id': 'thread', 'turns': [{'turnId': 'turn', 'items': [
            {'type': 'function_call', 'call_id': 'shot', 'name': 'mcp__cua_repl__js', 'arguments': '{"title":"Preview"}'},
            {'type': 'function_call_output', 'call_id': 'shot', 'output': [image(full)]}]}]}
        live = {'type': 'mcpToolCall', 'id': 'shot', 'server': 'cua_repl', 'tool': 'js', 'arguments': {'title': 'Preview'}}
        def present(*, cid='shot', turn='turn', thread='thread', data=clipped):
            tool = {**live, 'id': cid, 'result': {'content': [{'type': 'text', 'text': json.dumps({'content': [image(data)]})}]}}
            session.state = {'id': thread, 'turns': [{'turnId': turn, 'items': [tool]}]}
            return session.view()['turns'][-1]['messages'][0]
        with session.condition:
            session.set_history(saved)
            session.connected = True
            row = present()
            self.assertEqual(row['computerUse'], {'title': 'Preview'})
            self.assertEqual(row['attachments'][0]['desktopId'], hashlib.sha256(base64.b64decode(full)).hexdigest())
            self.assertNotIn(full, json.dumps(row))
            for changes in ({'cid': 'other'}, {'turn': 'other'}, {'thread': 'other'},
                            {'data': clipped.replace('…', '-', 1)}, {'data': clipped[:-1]+'!'},
                            {'data': 'A'+clipped[1:]}, {'data': ''}):
                self.assertNotIn('attachments', present(**changes), changes)
            session.set_history({**saved, 'id': 'other'})
            self.assertNotIn('attachments', present())

    def test_browser_surface_screenshot_nested_and_direct_preserve_text_hide_data_and_reject_clipped_bytes(self):
        def result(url):
            return {'content': [{'type': 'text', 'text': 'ready'}], '_meta': {
                    'codex/toolSurface': {'screenshot': {'url': url, 'tabId': 'tab', 'pageUrl': 'https://example.test'}}}}
        def project(obj):
            return normalize_item({'type': 'mcpToolCall', 'id': 'browser', 'server': 'cua_repl', 'tool': 'js',
                                   'arguments': {'title': 'Inspect page'}, 'result': obj})
        for wrapped in (False, True):
            with self.subTest(wrapped=wrapped):
                obj = result('data:image/png;base64,' + PNG)
                if wrapped:
                    obj = {'content': [{'type': 'text', 'text': json.dumps(obj)}]}
                row = project(obj)
                self.assertEqual(row['attachments'][0]['desktopId'], hashlib.sha256(base64.b64decode(PNG)).hexdigest())
                self.assertIn('example.test', row['output'])
                self.assertIn('ready', row['output'])
                self.assertNotIn('base64,', row['output'])
                self.assertNotIn(PNG, json.dumps(public_turns([{'messages': [row]}])))
        damaged = PNG[:40] + '…' + str(len(PNG) - 80) + ' chars truncated…' + PNG[-40:]
        for url in ('data:image/png;base64,' + damaged, 'https://untrusted.example/screenshot',
                    'data:image/jpeg;base64,' + base64.b64encode(b'\xff\xd8\xff\xe0' + bytes(92)).decode()):
            with self.subTest(protocol=url[:10]):
                with patch.object(tool_images, 'decode_tool_image', side_effect=AssertionError('invalid screenshot reached raster decoder')):
                    row = project({'content': [{'type': 'text', 'text': json.dumps(result(url))}]})
                self.assertTrue(row['computerUse']['imageUnavailable'])
                self.assertFalse(row.get('attachments'))
                self.assertNotIn(url, row['output'])
                self.assertNotIn('base64,', row['output'])

    def test_surface_clipping_requires_matching_original_in_same_thread_turn_and_call(self):
        full = base64.b64encode(base64.b64decode(PNG) + bytes(range(256))).decode()
        clipped = full[:40] + '…' + str(len(full) - 80) + ' chars truncated…' + full[-40:]
        def state(turn, image_id, data):
            return {'id': 'thread', 'turns': [{'turnId': turn, 'items': [{'type': 'mcpToolCall', 'id': image_id, 'server': 'cua_repl', 'tool': 'js',
                    'result': {'_meta': {'codex/toolSurface': {'screenshot': {'url': 'data:image/png;base64,' + data}}}}}]}]}
        session = LiveSession('thread', image_cache=tool_images.ToolImageCache())
        with session.condition:
            session.set_history(state('turn', 'first', full))
            session.connected = True
            for turn, call, expected in [('turn', 'first', True), ('turn', 'next', False), ('other', 'first', False)]:
                session.state = state(turn, call, clipped)
                row = session.view()['turns'][-1]['messages'][-1]
                self.assertEqual(bool(row.get('attachments')), expected)
                self.assertNotIn('base64,', row['output'])

    def test_public_turns_strip_patch_metadata_without_changing_tool_bodies_or_native_state(self):
        tool={'role':'activity','kind':'fileChange','text':'original tool patch output'}
        turn={'id':'turn','diff':'PRIVATE_NET_PATCH'*10000,'fileChanges':[
            {'path':'a.py','added':2,'removed':1,'diff':'PRIVATE_FILE_PATCH'*10000}],
            'fileChangesBasis':'net','messages':[tool]}
        public=public_turns([turn])[0]
        self.assertNotIn('diff',public)
        self.assertEqual(public['fileChanges'],[{'path':'a.py','added':2,'removed':1}])
        self.assertEqual(public['fileChangesBasis'],'net')
        self.assertNotIn('PRIVATE_',json.dumps(public))
        self.assertIs(public['messages'][0],tool)
        self.assertIn('diff',turn)
        self.assertIn('diff',turn['fileChanges'][0])

    def test_user_attachment_descriptors_remain_available(self):
        attachment = {'type': 'localImage', 'path': '/tmp/attachment.png', 'name': 'attachment.png'}
        row = normalize_item({'type': 'userMessage', 'content': [{'type': 'text', 'text': 'look'}, attachment]})
        self.assertEqual(row['attachments'], [attachment])

    def test_codex_native_image_content_items_are_extracted(self):
        url = 'data:image/png;base64,' + PNG
        state = normalize_state({'turns': [{'turnId': 'turn', 'items': [
            {'type': 'function_call', 'call_id': 'call', 'name': 'view_image'},
            {'type': 'function_call_output', 'call_id': 'call', 'output': [
                {'type': 'input_text', 'text': 'Screenshot ready'},
                {'type': 'input_image', 'image_url': url, 'detail': 'auto'}]}]}]})
        saved = state['turns'][0]['messages'][0]
        live = normalize_item({'type': 'dynamicToolCall', 'tool': 'screenshot', 'contentItems': [
            {'type': 'inputText', 'text': 'Screenshot ready'}, {'type': 'inputImage', 'imageUrl': url}]})
        for row in (saved, live):
            with self.subTest(kind=row['kind']):
                self.assertEqual([a['type'] for a in row['attachments']], ['toolImage'])
                self.assertEqual(row['attachments'][0]['desktopId'], hashlib.sha256(base64.b64decode(PNG)).hexdigest())
                self.assertNotIn(PNG, row['output'])
                self.assertIn('Screenshot ready', row['output'])

    def test_timeline_accepts_null_attachments(self):
        timeline = Timeline()
        timeline.update({'sequence': 1, 'turns': [{'id': 'turn', 'messages': [
            {'id': 'reply', 'role': 'assistant', 'kind': 'agentMessage', 'text': 'done', 'attachments': None}]}]})
        self.assertNotIn('attachments', timeline.page()['rows'][0])

    def test_ordinary_tool_text_and_arguments_are_not_interpreted_as_images(self):
        row = normalize_item({'type': 'mcpToolCall', 'arguments': result(), 'result': 'ordinary output'})
        self.assertNotIn('attachments', row)
        self.assertIn(PNG, row['text'])
        self.assertEqual(json.loads(row['output']), 'ordinary output')

    def test_replaced_tool_output_does_not_keep_stale_images(self):
        state = normalize_state({'turns': [{'turnId': 'turn', 'items': [
            {'type': 'custom_tool_call', 'call_id': 'call', 'name': 'mcp__computer_use_linux__screenshot'},
            {'type': 'custom_tool_call_output', 'call_id': 'call', 'output': result()},
            {'type': 'custom_tool_call_output', 'call_id': 'call', 'output': 'replaced'}]}]})
        row = state['turns'][0]['messages'][0]
        self.assertEqual(row['output'], 'replaced')
        self.assertNotIn('attachments', row)
        self.assertEqual(row['computerUse'], {'action': 'screenshot'})

    def test_only_bounded_inline_raster_images_are_accepted(self):
        for value in [image('invalid!'), image(PNG, 'image/jpeg'), image(PNG, {}),
                      image(base64.b64encode(b'<svg/>').decode(), 'image/svg+xml'),
                      {'type': 'image', 'imageUrl': 'https://example.com/private.png'},
                      image('A' * (12 * 1024 * 1024))]:
            with self.subTest(value=str(value)[:100]):
                self.assertFalse(normalize_item({'type': 'mcpToolCall', 'result': {'content': [value]}}).get('attachments'))
        row = normalize_item({'type': 'dynamicToolCall', 'contentItems': [
            {'type': 'image', 'imageUrl': 'data:image/png;base64,' + PNG}]})
        self.assertEqual(row['attachments'][0]['data'], PNG)

    def test_duplicate_images_and_extraction_budgets(self):
        from bridge.features.sessions.tool_images import extract_tool_images
        _, images = extract_tool_images({'content': [image(), image()]})
        self.assertEqual(len(images), 1)
        second = image(base64.b64encode(base64.b64decode(PNG) + b'other').decode())
        with patch('bridge.features.sessions.tool_images.MAX_IMAGES', 1):
            clean, images = extract_tool_images({'content': [image(), second]})
            self.assertEqual(len(images), 1)
            self.assertNotIn(second['data'], json.dumps(clean))
        with patch('bridge.features.sessions.tool_images.MAX_TOTAL_BYTES', 1):
            self.assertEqual(extract_tool_images({'content': [image()]})[1], [])
        nested = {'content': [image()]}
        for _ in range(12):
            nested = {'content': [nested]}
        self.assertEqual(extract_tool_images(nested)[1], [])

    def test_overflow_images_are_rejected_before_decode(self):
        from bridge.features.sessions.tool_images import extract_tool_images
        original = tool_images.decode_tool_image
        with patch.object(tool_images, 'decode_tool_image', wraps=original) as decode:
            with patch.object(tool_images, 'MAX_IMAGES', 1):
                clean, images = extract_tool_images({'content': [image(), image(),
                                                               image(base64.b64encode(base64.b64decode(PNG) + b'new').decode())]})
            self.assertEqual(decode.call_count, 1)
            self.assertEqual(len(images), 1)
            self.assertEqual(clean['content'][1]['preview'], images[0]['desktopId'])
            self.assertEqual(clean['content'][2]['preview'], 'unavailable')
        with patch.object(tool_images, 'decode_tool_image', wraps=original) as decode:
            with patch.object(tool_images, 'MAX_TOTAL_BYTES', len(base64.b64decode(PNG))):
                clean, images = extract_tool_images({'content': [image(), image(),
                                                               image(base64.b64encode(base64.b64decode(PNG) + b'new').decode())]})
            self.assertEqual(decode.call_count, 1)
            self.assertEqual(len(images), 1)
            self.assertEqual(clean['content'][2]['preview'], 'unavailable')

    def test_unscanned_bulk_past_budgets_is_omitted_and_small_values_are_kept(self):
        from bridge.features.sessions.tool_images import extract_tool_images, MAX_UNSCANNED_CHARS
        bulk = 'A' * (MAX_UNSCANNED_CHARS + 1)
        def nested(value, levels=12):
            for _ in range(levels):
                value = {'content': [value]}
            return value
        omitted = {'type': 'omitted', 'reason': 'toolOutputBudget'}
        cases = {'depth': (nested(image(bulk)), {'MAX_DEPTH': tool_images.MAX_DEPTH}),
                 'nodes': ({'content': [{'type': 'text', 'text': 'x'}] * 5 + [image(bulk)]},
                           {'MAX_NODES': 4}),
                 'json': ({'content': [{'type': 'text', 'text': json.dumps({'content': [image(bulk)]})}]},
                          {'MAX_JSON_CHARS': 64})}
        for name, (output, limits) in cases.items():
            with self.subTest(name), patch.multiple(tool_images, **limits):
                original = copy.deepcopy(output)
                clean, images = extract_tool_images(output)
                self.assertEqual(output, original)
                self.assertEqual(images, [])
                encoded_clean = json.dumps(clean)
                self.assertNotIn(bulk, encoded_clean)
                self.assertIn(json.dumps(omitted)[1:-1], encoded_clean)
        small = nested({'type': 'text', 'text': 'deep but small'})
        self.assertEqual(extract_tool_images(small), (small, []))

    def test_unscanned_allowance_is_shared_by_all_small_values_in_one_output(self):
        from bridge.features.sessions.tool_images import extract_tool_images, MAX_NODES, MAX_UNSCANNED_CHARS
        # Production limits: one-node fillers exhaust the scan budget, then blocks
        # are each under the allowance but far above it together.
        block = base64.b64encode(b'\x89PNG' + bytes(7500)).decode()
        blocks = [image(block + str(i)) for i in range(512)]
        self.assertLess(len(json.dumps(blocks[0])), MAX_UNSCANNED_CHARS)
        output = {'content': [0] * MAX_NODES + blocks}
        clean, images = extract_tool_images(output)
        self.assertEqual(images, [])
        content = clean['content']
        kept = [part for part in content if isinstance(part, dict) and part.get('type') == 'image']
        self.assertTrue(kept)
        self.assertLessEqual(sum(len(json.dumps(part, ensure_ascii=False)) for part in kept), MAX_UNSCANNED_CHARS)
        self.assertEqual(content[-1]['type'], 'omitted')
        self.assertEqual(len(content) - 1 + content[-1]['items'], len(output['content']))
        self.assertLess(len(json.dumps(clean)), MAX_NODES * 3 + MAX_UNSCANNED_CHARS + 1024)
        # After the allowance is spent, remaining short items collapse to one marker.
        tiny = {'content': [0] * MAX_NODES + blocks[:3] + [{'type': 'text', 'text': 'y'}] * 10000}
        self.assertLess(len(json.dumps(extract_tool_images(tiny)[0])), len(json.dumps(tiny)) // 10)

    def test_public_view_omits_unscanned_bulk_but_keeps_session_record(self):
        bulk = 'A' * (tool_images.MAX_UNSCANNED_CHARS + 1)
        value = image(bulk)
        for _ in range(12):
            value = {'content': [value]}
        session = LiveSession('deep', image_cache=tool_images.ToolImageCache())
        session.state = {'turns': [{'turnId': 'turn', 'items': [
            {'type': 'mcpToolCall', 'id': 'deep', 'result': value}]}]}
        self.assertNotIn(bulk, json.dumps(session.view()))
        self.assertIn(bulk, json.dumps(session.state))

    def test_timeline_keeps_image_bytes_out_of_pages_and_changes_image_version(self):
        timeline = Timeline()
        def view(data, sequence):
            row = normalize_item({'type': 'mcpToolCall', 'id': 'shot', 'result': {'content': [image(data)]}})
            return {'sequence': sequence, 'turns': [{'id': 'turn', 'messages': [row]}]}
        timeline.update(view(PNG, 1))
        page = timeline.page()
        row = page['rows'][0]
        attachment = row['attachments'][0]
        self.assertEqual(attachment['type'], 'toolImage')
        self.assertEqual(len(attachment['desktopId']), 64)
        self.assertNotIn(PNG.encode(), encoded(page))
        self.assertLess(len(encoded(page)), PAGE_BYTES)
        data = base64.b64encode(base64.b64decode(PNG) + b'fixture').decode()
        timeline.update(view(data, 2))
        changed = timeline.changes(1, page['epoch'], page['before'])['rows']
        self.assertEqual(len(changed), 1)
        self.assertEqual(changed[0]['key'], row['key'])
        self.assertNotEqual(changed[0]['version'], row['version'])


class ToolImageCacheTests(unittest.TestCase):
    def setUp(self):
        self.cache = tool_images.ToolImageCache()
        self.session = LiveSession('images', image_cache=self.cache)
        self.item = {'type': 'mcpToolCall', 'id': 'shot', 'result': result()}
        self.session.state = {'turns': [{'turnId': 'turn', 'items': [self.item]}]}
        self.bridge = Bridge.__new__(Bridge)
        self.sessions = {'images': self.session, 'other': LiveSession('other', image_cache=self.cache)}
        self.bridge.session = lambda thread, **kwargs: self.sessions[thread]
        self.raw = base64.b64decode(PNG)
        self.identifier = hashlib.sha256(self.raw).hexdigest()

    def preview(self, thread='images'):
        return self.bridge.desktop_image_preview(thread, self.identifier)[0]['previewBytes']

    def test_output_changes_in_place_and_removed_images_invalidate_membership(self):
        self.assertEqual(self.preview(), self.raw)
        with self.session.condition:
            self.item['result']['content'][:] = [image(base64.b64encode(self.raw + b'new').decode())]
            self.session.changed()
        with self.assertRaises(KeyError):
            self.preview()
        new_id = hashlib.sha256(self.raw + b'new').hexdigest()
        self.assertEqual(self.bridge.desktop_image_preview('images', new_id)[0]['previewBytes'], self.raw + b'new')
        with self.session.condition:
            self.item['result'] = 'removed'
            self.session.changed()
        with self.assertRaises(KeyError):
            self.bridge.desktop_image_preview('images', new_id)

    def test_shared_cache_does_not_grant_other_threads_access_or_accept_forged_descriptors(self):
        self.assertEqual(self.preview(), self.raw)
        with self.assertRaises(KeyError):
            self.preview('other')
        other = self.sessions['other']
        with other.condition:
            other.state = {'turns': [{'turnId': 'turn', 'items': [
                {'type': 'userMessage', 'content': [{'type': 'toolImage', 'desktopId': self.identifier,
                  'mime': 'image/png', 'data': 'invalid', 'name': 'forged.png'}]}]}]}
            other.changed()
        with self.assertRaises(KeyError):
            self.preview('other')

    def test_saved_history_prefix_is_indexed_with_live_tail(self):
        with self.session.condition:
            self.session.set_history(self.session.state)
            self.session.connected = True
            self.session.state = {'turns': [{'turnId': 'tail', 'items': []}],
                                  'turnsPagination': {'hasLoadedOldest': False}}
            self.session.saved_view['turns'].append({'id': 'tail', 'messages': []})
            self.session.changed()
        self.assertEqual(self.preview(), self.raw)

    def test_public_views_carry_image_ids_not_base64(self):
        with self.session.condition:
            # The saved prefix is shared by reference with the presented view.
            self.session.set_history(self.session.state)
            self.session.connected = True
            self.session.state = {'turns': [{'turnId': 'tail', 'items': []}],
                                  'turnsPagination': {'hasLoadedOldest': False}}
            self.session.saved_view['turns'].append({'id': 'tail', 'messages': []})
            self.session.changed()
        view = self.session.view()
        self.assertNotIn(PNG, json.dumps(view))
        attachment = view['turns'][0]['messages'][0]['attachments'][0]
        self.assertEqual((attachment['type'], attachment['desktopId']), ('toolImage', self.identifier))
        self.assertEqual(self.session.saved_view['turns'][0]['messages'][0]['attachments'][0]['data'], PNG)
        self.assertEqual(self.preview(), self.raw)

    def test_subagent_log_does_not_carry_image_base64(self):
        thread, agent = str(uuid.uuid4()), str(uuid.uuid4())
        self.bridge.store = type('Store', (), {'subagent_history': lambda _, *args: {
            'id': agent, 'turns': [{'turnId': 'turn', 'items': [self.item]}]}})()
        view = self.bridge.subagents(thread, agent)
        self.assertNotIn(PNG, json.dumps(view))
        self.assertFalse(view['turns'][0]['messages'][0].get('attachments'))

    def evict_preview_bytes(self):
        self.session.view()
        # Evict just decoded bytes; extraction metadata and thread membership remain.
        self.cache.image_limit = len(self.raw) + len(PNG) + 20
        self.cache.extract({'content': [image(base64.b64encode(self.raw + b'evict').decode())]})
        self.assertNotIn(self.identifier, self.cache.images)

    def test_concurrent_cold_previews_share_decode_without_holding_session_lock(self):
        self.evict_preview_bytes()
        started, release = threading.Event(), threading.Event()
        decode = tool_images.decode_tool_image

        def blocked_decode(data, mime):
            started.set()
            self.assertTrue(release.wait(5))
            return decode(data, mime)

        with patch.object(tool_images, 'decode_tool_image', side_effect=blocked_decode) as spy:
            with ThreadPoolExecutor(max_workers=8) as pool:
                futures = [pool.submit(self.preview) for _ in range(8)]
                try:
                    self.assertTrue(started.wait(5))
                    acquired = self.session.condition.acquire(timeout=1)
                    self.assertTrue(acquired, 'preview decoding held the session lock')
                    if acquired:
                        self.session.condition.release()
                finally:
                    release.set()
                for future in futures:
                    self.assertEqual(future.result(timeout=5), self.raw)
            self.assertEqual(spy.call_count, 1)

    def test_image_removed_during_cold_decode_is_not_returned(self):
        self.evict_preview_bytes()
        started, release = threading.Event(), threading.Event()
        decode = tool_images.decode_tool_image

        def blocked_decode(data, mime):
            started.set()
            self.assertTrue(release.wait(5))
            return decode(data, mime)

        with patch.object(tool_images, 'decode_tool_image', side_effect=blocked_decode):
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(self.preview)
                try:
                    self.assertTrue(started.wait(5))
                    with self.session.condition:
                        self.item['result'] = 'removed'
                        self.session.changed()
                finally:
                    release.set()
                with self.assertRaises(KeyError):
                    future.result(timeout=5)

    def test_cache_is_bounded_and_returned_output_is_independent(self):
        cache = tool_images.ToolImageCache(output_bytes=4000, image_bytes=200, max_entries=2)
        first = cache.extract(result())
        first[1][0]['name'] = 'changed'
        self.assertEqual(cache.extract(result())[1][0]['name'], 'Image 1.png')
        for i in range(10):
            cache.extract({'content': [image(base64.b64encode(self.raw + bytes([i])).decode())]})
        self.assertLessEqual(cache.output_bytes, 4000)
        self.assertLessEqual(cache.image_bytes, 200)
        self.assertLessEqual(len(cache.outputs), 2)
        self.assertLessEqual(len(cache.images), 2)
        self.assertEqual(cache.extract(result())[1][0]['data'], PNG)
        oversized = tool_images.ToolImageCache(output_bytes=1, image_bytes=1)
        self.assertEqual(oversized.extract(result())[1][0]['data'], PNG)
        self.assertFalse(oversized.outputs)
        self.assertFalse(oversized.images)


if __name__ == '__main__':
    unittest.main()
