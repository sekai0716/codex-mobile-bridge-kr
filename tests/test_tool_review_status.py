"""원본 검토 ID 연결과 실행 결과의 분리, 분할 상세 조회를 검증한다."""
import json
import unittest

from bridge.app.service import LiveSession
from bridge.features.sessions.model import normalize_state
from bridge.features.sessions.timeline import Timeline, DETAIL_CHARS


def tool(identifier='tool-a', **fields):
    return {'type': 'commandExecution', 'id': identifier, 'command': 'same command', **fields}


def review(identifier='review-a', target='tool-a', status='inProgress', **fields):
    return {'type': 'automaticApprovalReview', 'id': identifier, 'targetItemId': target,
            'status': status, 'action': {'type': 'command', 'command': 'same command'}, **fields}


def state(items, status='inProgress'):
    return {'id': 'thread', 'turns': [{'turnId': 'turn-a', 'status': status, 'items': items}]}


class ToolReviewStatusTests(unittest.TestCase):
    def messages(self, items, **kwargs):
        return normalize_state(state(items), **kwargs)['turns'][0]['messages']

    def test_strict_review_is_live_turn_metadata_even_outside_the_page(self):
        notices = [{'type': 'strictReviewNotice', 'id': f'strict-review-notice:{stamp}', 'startedAtMs': stamp}
                   for stamp in (1795134441698, 1795134460000)]
        raw = state([notices[0], tool(), review(status='denied'), notices[1]])
        view = normalize_state(raw, item_limit=2)
        self.assertTrue(view['strictReviewActive'])
        self.assertFalse(view['historyWindowMore'])
        messages = view['turns'][0]['messages']
        self.assertEqual([m['kind'] for m in messages], ['commandExecution', 'automaticApprovalReview'])
        self.assertEqual(messages[0]['approvalReview']['status'], 'denied')
        self.assertTrue(messages[1]['reviewLinked'])
        self.assertEqual(len(raw['turns'][0]['items']), 4)

        timeline = Timeline()
        timeline.update({**view, 'sequence': 1})
        epoch = timeline.epoch
        self.assertNotIn('strict-review-notice:', json.dumps(timeline.page()))
        raw['turns'][0]['items'] = [notices[0], tool(), review(status='denied')]
        self.assertTrue(normalize_state(raw, item_limit=1)['strictReviewActive'])
        raw['turns'][0]['items'] = [tool(), review(status='denied')]
        timeline.update({**normalize_state(raw), 'sequence': 2})
        changes = timeline.changes(1, epoch, '')
        self.assertFalse(changes['meta']['strictReviewActive'])
        self.assertEqual(changes['rows'], [])

    def test_strict_review_does_not_follow_an_old_or_disconnected_turn(self):
        notice = {'type': 'strictReviewNotice', 'id': 'strict-review-notice:1795134441698'}
        for status in ('completed', 'failed', 'interrupted'):
            with self.subTest(status=status):
                raw = state([notice], status)
                view = normalize_state(raw)
                self.assertFalse(view['strictReviewActive'])
                self.assertEqual(view['turns'][0]['messages'], [])
        raw = state([notice])
        self.assertFalse(normalize_state(raw, connected=False)['strictReviewActive'])
        raw['turns'].append({'turnId': 'turn-b', 'status': 'inProgress', 'items': [tool()]})
        self.assertFalse(normalize_state(raw)['strictReviewActive'])

    def test_repeated_strict_review_does_not_expand_or_reset_the_loaded_window(self):
        session = LiveSession('thread')
        session.connected = True
        session.timeline_limit = 2
        session.state = state([tool(str(i)) for i in range(5)])
        first = session.timeline_view()
        session.timeline.update(first, 2)
        epoch = session.timeline.epoch
        with session.condition:
            session.state['turns'][0]['items'].extend(
                {'type': 'strictReviewNotice', 'id': str(i)} for i in range(60))
            session.changed()
        session.timeline.update(session.timeline_view(), 2)
        changes = session.timeline.changes(first['sequence'], epoch, '')
        self.assertEqual(session.timeline_limit, 2)
        self.assertEqual(changes['rows'], [])
        self.assertTrue(changes['meta']['strictReviewActive'])

    def test_review_joins_only_its_unique_target_even_before_the_tool(self):
        messages = self.messages([review(), tool('tool-b'), tool()])
        self.assertTrue(messages[0]['reviewLinked'])
        self.assertNotIn('approvalReview', messages[1])
        self.assertEqual(messages[2]['approvalReview']['status'], 'inProgress')
        self.assertEqual(messages[2]['approvalReviews'][0]['id'], 'review-a')
        for items in [[tool(), tool(), review()], [tool(), review(turnId='another-turn')]]:
            messages = self.messages(items)
            self.assertFalse(messages[-1]['reviewLinked'])
            self.assertTrue(all('approvalReview' not in row for row in messages[:-1]))

    def test_latest_review_does_not_overwrite_execution_status_or_exit_code(self):
        messages = self.messages([tool(status='completed', exitCode=2),
                                  review(status='denied', rationale='first denied'),
                                  review('review-b', status='approved', rationale='retry allowed')])
        target = messages[0]
        self.assertEqual(target['approvalReview']['status'], 'approved')
        self.assertEqual([row['status'] for row in target['approvalReviews']], ['denied', 'approved'])
        self.assertEqual((target['status'], target['exitCode']), ('completed', 2))
        self.assertTrue(all(row['reviewLinked'] for row in messages[1:]))

    def test_interrupted_review_and_unknown_status_are_not_assumed_approved(self):
        view = normalize_state(state([tool(status='interrupted'), review()], 'interrupted'))
        self.assertEqual(view['turns'][0]['messages'][0]['approvalReview']['status'], 'aborted')
        self.assertEqual(view['turns'][0]['messages'][1]['approvalReview']['status'], 'aborted')
        self.assertEqual(self.messages([tool(), review(status='future-status')])[0]['approvalReview']['status'], 'unknown')

    def test_review_changes_update_the_same_timeline_row_and_details_stay_paged(self):
        reason = 'review explanation ' * (DETAIL_CHARS // 2)
        raw = state([tool(status='inProgress'), review(rationale=reason)])
        timeline = Timeline(); timeline.update({**normalize_state(raw), 'sequence': 1})
        target, record = timeline.rows
        self.assertNotIn(reason, json.dumps(timeline.page()))
        self.assertNotIn('rationale', target['approvalReview'])
        self.assertEqual(target['text'], 'same command')
        cursor = timeline.cursor(target['key']); text = ''; offset = 0; version = None
        while True:
            detail = timeline.detail(cursor, offset, version)
            self.assertLessEqual(len(detail['text']), DETAIL_CHARS)
            text += detail['text']; offset, version = detail['next'], detail['version']
            if offset is None:
                break
        self.assertIn(reason, text)
        before_version = target['version']; epoch = timeline.epoch
        raw['turns'][0]['items'][1]['status'] = 'approved'
        timeline.update({**normalize_state(raw), 'sequence': 2})
        changed = timeline.changes(1, epoch, '')['rows']
        current = next(row for row in changed if row['kind'] == 'commandExecution')
        self.assertEqual(current['key'], target['key'])
        self.assertNotEqual(current['version'], before_version)
        self.assertEqual(current['approvalReview']['status'], 'approved')
        self.assertTrue(next(row for row in changed if row['kind'] == 'automaticApprovalReview')['reviewLinked'])

    def test_partial_history_retains_unmatched_review_until_its_tool_arrives(self):
        raw = state([tool(), review(status='denied', rationale='Needs authorization')])
        partial = normalize_state(raw, item_limit=1)
        self.assertFalse(partial['turns'][0]['messages'][0]['reviewLinked'])
        timeline = Timeline(); timeline.update({**partial, 'sequence': 1})
        before = timeline.rows[0]['key']; epoch = timeline.epoch
        timeline.update({**normalize_state(raw, item_limit=2), 'sequence': 2})
        current = next(row for row in timeline.rows if row['key'] == before)
        self.assertTrue(current['reviewLinked'])
        self.assertTrue(any(row['key'] == before and row['reviewLinked'] for row in timeline.changes(1, epoch, '')['rows']))

    def test_large_review_action_is_only_a_bounded_fallback_caption(self):
        raw = review(target='not-loaded', action={'type': 'command', 'command': 'long-command ' * 10000})
        timeline = Timeline(); timeline.update({**normalize_state(state([raw])), 'sequence': 1})
        self.assertFalse(timeline.rows[0]['reviewLinked'])
        self.assertLessEqual(len(timeline.rows[0]['reviewActionLabel']), 180)


if __name__ == '__main__':
    unittest.main()
