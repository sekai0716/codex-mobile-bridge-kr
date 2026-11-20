"""Bounded phone projections. Original desktop state stays authoritative.

Cursors belong to one in-memory timeline epoch. Replacement/reordered desktop
history invalidates them explicitly; appending or editing text does not.
"""
import hashlib
import json
import uuid
from collections import OrderedDict

PAGE_BYTES = 192 * 1024
TEXT_PREVIEW = 8000
DETAIL_CHARS = 16000


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


class Timeline:
    def __init__(self):
        self.epoch = uuid.uuid4().hex
        self.sequence = -1
        self.rows = []
        self.order_origin = 0
        self.details = {}
        self.file_patches = {}
        self.file_revision = 0
        self.positions = {}
        self.versions = OrderedDict()
        self.meta = {}
        self.limit = None
        self.window_anchor = None
        self.source_anchor = None
        self.window_more = False

    def update(self, view, limit=None):
        if self.sequence == view['sequence'] and self.limit == limit:
            return
        activation_ids = set(view.get('goalActivationIds') or ())
        entries = []
        created_agents = {}
        for turn in view['turns']:
            occurrences = {}
            first_user = next((m for m in turn['messages'] if m['role'] == 'user'), None)
            for message in turn['messages']:
                if message.get('requestId') and message['requestId'] in activation_ids:
                    continue
                identity = (turn['id'], message.get('id'), message.get('kind'))
                ordinal = message.get('_timelineOrdinal', occurrences.get(identity, 0))
                occurrences[identity] = ordinal + 1
                if message.get('spawnedAgents'):
                    # 같은 생성을 여러 프로토콜 항목으로 받아도 자식 ID 하나에 한 행을 유지한다.
                    for agent in message['spawnedAgents']:
                        child = agent['id']
                        if child in created_agents:
                            prior = created_agents[child]
                            for field in ('nickname', 'taskName'):
                                if not prior.get(field) and agent.get(field):
                                    prior[field] = agent[field]
                            continue
                        created_agents[child] = dict(agent)
                        creation = {'role': 'activity', 'kind': 'subAgentCreated', 'agent': created_agents[child],
                                    '_sourceIdentity': identity + (ordinal,)}
                        entries.append(((None, child, 'subAgentCreated', 0), turn, creation, False))
                    continue
                entries.append((identity + (ordinal,), turn, message, message.get('_firstUser', message is first_user)))
                if message.get('memorySources'):
                    citation = {'role': 'activity', 'kind': 'memoryCitation', 'title': 'Memory sources',
                                'text': message['memorySources'], '_sourceIdentity': identity + (ordinal,)}
                    entries.append(((turn['id'], message.get('id'), 'memoryCitation', ordinal), turn, citation, False))

            if turn.get('status') == 'completed' and turn.get('fileChanges'):
                changes = turn['fileChanges']
                added = sum(change['added'] for change in changes)
                removed = sum(change['removed'] for change in changes)
                summary = {'id': 'native-file-changes', 'kind': 'fileChanges', 'role': 'fileChanges',
                           'fileSummary': {'count': len(changes), 'added': added, 'removed': removed, 'basis': turn.get('fileChangesBasis', 'recorded'),
                                           'files': [{**{k: c[k] for k in ('path', 'added', 'removed')},
                                                      'hasDiff': bool(c.get('diff'))} for c in changes]},
                           'text': ''}
                entries.append(((turn['id'], summary['id'], summary['kind'], 0), turn, summary, False))
            if turn.get('error'):
                entries.append(((turn['id'], 'error'), turn, None, False))
        start = max(0, len(entries) - limit) if limit is not None else 0
        # Keep the loaded prefix while new replies arrive. Expanding history
        # must not hash/copy bodies outside the requested presentation window.
        if self.window_anchor is not None and limit is not None:
            anchor = next((i for i, entry in enumerate(entries) if entry[0] == self.window_anchor), None)
            if anchor is not None:
                start = min(start, anchor)
        self.limit = limit
        self.window_more = start > 0 or view.get('historyWindowMore', False)
        self.window_anchor = entries[start][0] if start < len(entries) else None
        # A tool call carried only to interpret a recent result must not expand
        # the next source read to every intervening historical item.
        self.source_anchor = next((entry[2].get('_sourceIdentity', entry[0]) for entry in entries[start:]
                                   if entry[2] is not None and entry[2].get('kind') != 'fileChanges' and not entry[2].get('_historyCarry')), None)
        rows, details, file_patches = [], {}, {}
        for identity, turn, message, first_user in entries[start:]:
            if message is not None:
                base = hashlib.sha256(encoded(identity[:3])).hexdigest()[:24]
                ordinal = identity[3]
                key = base + '-' + str(ordinal)
                text = message.get('text') or ''
                label_lines = []
                if message.get('commandInfo'):
                    line = text.count('\n') + 2
                    parts = []
                    for label, value in message['commandInfo']:
                        if len(label_lines) < 128:
                            label_lines.append(line)
                        parts.append(label + '\n' + value)
                        line += 3 + value.count('\n')
                    text += '\n\n' + '\n\n'.join(parts)
                if message.get('output'):
                    text += '\n\n' + message['output']
                preview = text
                # 원본 검토 내역도 기존 상세 본문의 분할 조회로 읽는다.
                # 검토 이유가 길어도 첫 화면의 메타데이터에 함께 싣지 않는다.
                if message.get('approvalReviews'):
                    text += '\n\n' + json.dumps({'automaticApprovalReviews': message['approvalReviews']}, ensure_ascii=False, indent=2)
                activity = message['role'] in ('activity', 'fileChanges')
                attachments = [{k: str(a[k])[:4096 if k == 'path' else 300] for k in ('type', 'name', 'path', 'desktopId') if k in a}
                               for a in (message.get('attachments') or [])[:20]]
                revision = None
                if message.get('fileSummary'):
                    # 원본 문자열 참조만 보관한다. 같은 줄 수라도 내용이 바뀌면 이전 diff 페이지를 무효화한다.
                    patches = tuple(c.get('diff') or '' for c in turn['fileChanges'])
                    previous = self.file_patches.get(key)
                    if previous and patches == previous[1]:
                        revision = previous[0]
                    else:
                        self.file_revision += 1
                        revision = self.file_revision
                    file_patches[key] = (revision, patches)
                version = hashlib.sha256(encoded([text, turn.get('model'), turn.get('effort'), attachments, message.get('fileSummary'),
                                                 revision, message.get('title'), message.get('activityCard'), message.get('appView'), message.get('agent'), message.get('collab'), message.get('computerUse'),
                                                 message.get('approvalReview'), message.get('reviewLinked'),
                                                 message.get('status'), message.get('exitCode'), message.get('success'),
                                                 message.get('source'), message.get('completed')])).hexdigest()[:24]
                row = {k: message[k] for k in ('role', 'kind', 'status', 'title', 'phase', 'requestId', 'exitCode', 'success',
                                             'approvalReview', 'reviewLinked', 'source', 'completed', 'agent', 'collab', 'computerUse', 'activityCard', 'appView') if k in message}
                if label_lines:
                    row['commandLabelLines'] = label_lines
                if isinstance(message.get('reviewActionLabel'), str):
                    row['reviewActionLabel'] = message['reviewActionLabel'][:180].split('\n', 1)[0]
                row.update(key=key, turnId=turn['id'], itemId=message.get('id'), order=len(rows), version=version,
                           text=preview[:180 if activity else TEXT_PREVIEW],
                           truncated=(activity and bool(text)) or len(text) > TEXT_PREVIEW, turnStatus=turn.get('status'),
                           editable=turn.get('actionable', True) and first_user and message.get('kind') == 'userMessage',
                           forkable=turn.get('actionable', True) and message['role'] == 'assistant' and message.get('phase') != 'commentary' and turn.get('status') == 'completed')
                timestamp = message.get('timestamp')
                if timestamp is None and first_user:
                    timestamp = turn.get('startedAt')
                if timestamp is not None and message['role'] in ('user', 'assistant'):
                    row['timestamp'] = timestamp
                if message.get('fileSummary'):
                    row['fileSummary'] = message['fileSummary']
                    row['text'] = ''
                    row['truncated'] = False
                if message['role'] == 'assistant':
                    row.update({k:turn[k] for k in ('model','effort') if turn.get(k)})
                if attachments:
                    row['attachments'] = attachments
                rows.append(row)
                details[key] = text
            else:
                key = hashlib.sha256(encoded([turn['id'], 'error'])).hexdigest()[:24] + '-error'
                text = turn['error'] if isinstance(turn['error'], str) else json.dumps(turn['error'], ensure_ascii=False)
                error = turn['error']
                if isinstance(error, dict) and isinstance(error.get('message'), str):
                    text = '\n'.join(value for value in (error['message'], error.get('additionalDetails')) if isinstance(value, str) and value)
                rows.append(dict(key=key, turnId=turn['id'], order=len(rows), role='error', text=text[:TEXT_PREVIEW],
                                 truncated=len(text) > TEXT_PREVIEW, version=hashlib.sha256(text.encode()).hexdigest()[:24]))
                details[key] = text
        old_keys = [row['key'] for row in self.rows]
        new_keys = [row['key'] for row in rows]
        # Prepending saved turns preserves existing row keys and cursors.
        first = new_keys.index(old_keys[0]) if old_keys and old_keys[0] in new_keys else 0
        if old_keys != new_keys[first:first + len(old_keys)]:
            self.epoch = uuid.uuid4().hex
            self.versions.clear()
            self.order_origin = 0
        elif old_keys:
            self.order_origin -= first
        for index, row in enumerate(rows):
            row['order'] = self.order_origin + index
        self.sequence = view['sequence']
        self.rows, self.details, self.file_patches = rows, details, file_patches
        self.positions = {row['key']: i for i, row in enumerate(rows)}
        self.meta = {k: v for k, v in view.items() if k != 'turns'}
        self.meta['latestUserTurnId'] = next((t['id'] for t in reversed(view['turns'])
                                              if any(m['role'] == 'user'
                                                     and (not m.get('requestId') or m['requestId'] not in activation_ids)
                                                     for m in t['messages'])), None)
        self.versions[self.sequence] = {row['key']: hashlib.sha256(encoded(row)).digest() for row in rows}
        while len(self.versions) > 16:
            self.versions.popitem(last=False)

    def cursor(self, key):
        return self.epoch + '.' + key

    def position(self, cursor):
        epoch, _, key = cursor.partition('.')
        if epoch != self.epoch or key not in self.positions:
            return None
        return self.positions[key]

    def page(self, limit=20, before=None):
        end = self.position(before) if before else len(self.rows)
        if end is None:
            return {**self.page(), 'reset': True}
        limit = max(1, min(100, limit))
        selected, size = [], 0
        for row in reversed(self.rows[max(0, end - limit):end]):
            cost = len(encoded(row))
            if selected and size + cost > PAGE_BYTES:
                break
            selected.append(row)
            size += cost
        selected.reverse()
        start = end - len(selected)
        return {'epoch': self.epoch, 'sequence': self.sequence, 'rows': selected,
                'before': self.cursor(selected[0]['key']) if selected else None,
                'hasMore': start > 0 or self.window_more or self.meta.get('savedHistoryMore', False), 'meta': self.meta}

    def changes(self, after, epoch, start):
        first = self.position(start) if start else None
        if epoch != self.epoch or after not in self.versions or (start and first is None):
            return {**self.page(), 'reset': True}
        previous, current = self.versions[after], self.versions[self.sequence]
        rows = [row for row in self.rows[first or 0:]
                if previous.get(row['key']) != current[row['key']]]
        if len(rows) > 100 or sum(len(encoded(row)) for row in rows) > PAGE_BYTES:
            return {**self.page(), 'reset': True}
        return {'epoch': self.epoch, 'sequence': self.sequence, 'rows': rows, 'meta': self.meta}

    def detail(self, cursor, offset=0, version=None, file_index=None):
        position = self.position(cursor)
        if position is None:
            raise ValueError('내용이 업데이트되었습니다. 채팅을 다시 열어주세요.')
        row = self.rows[position]
        if file_index is None:
            text = self.details[row['key']]
        else:
            # 경로를 입력받아 파일을 여는 대신 표시된 턴·버전 안의 파일 번호로만 조회한다.
            patches = self.file_patches.get(row['key'])
            if not patches or type(file_index) is not int or not 0 <= file_index < len(patches[1]) or version != row['version']:
                raise ValueError('메시지가 변경되었습니다. 다시 열어보세요.')
            text = patches[1][file_index]
        offset = max(0, min(offset, len(text))) if version == row['version'] else 0
        end = min(len(text), offset + DETAIL_CHARS)
        if file_index is not None and end < len(text):
            newline = text.rfind('\n', offset, end)
            if newline >= offset:
                end = newline + 1
        return {'key': row['key'], 'version': row['version'], 'text': text[offset:end],
                **({'fileIndex': file_index} if file_index is not None else {}),
                'offset': offset, 'next': end if end < len(text) else None}
