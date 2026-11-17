"""원본 압축 메타데이터의 False 보존과 타임라인 상태 갱신을 확인한다."""
import json
import unittest

from bridge.features.sessions.model import normalize_item, normalize_state
from bridge.features.sessions.timeline import Timeline


class CompactionStatusTests(unittest.TestCase):
    def test_native_source_and_completed_reach_the_timeline_without_a_status(self):
        for kind in ('contextCompaction', 'autoContextCompaction'):
            for source in ('automatic', 'manual'):
                for completed in (False, True):
                    with self.subTest(kind=kind, source=source, completed=completed):
                        item = {'id': 'compact', 'type': kind, 'source': source, 'completed': completed}
                        view = normalize_state({'turns': [{'turnId': 'turn', 'status': 'inProgress', 'items': [item]}]})
                        timeline = Timeline(); timeline.update({**view, 'sequence': 1})
                        row = timeline.page()['rows'][0]
                        self.assertEqual(row['source'], source)
                        self.assertIs(row['completed'], completed)
                        self.assertIsNone(row['status'])
                        self.assertEqual(json.loads(timeline.detail(timeline.cursor(row['key']))['text']), item)

    def test_missing_and_invalid_metadata_are_not_coerced_to_completion(self):
        for fields in ({}, {'source': 'unknown', 'completed': 'true'},
                       {'source': {'automatic': True}, 'completed': 1}, {'source': None, 'completed': None}):
            row = normalize_item({'type': 'contextCompaction', **fields})
            self.assertNotIn('source', row)
            self.assertNotIn('completed', row)
        unrelated = normalize_item({'type': 'commandExecution', 'source': 'automatic', 'completed': True})
        self.assertNotIn('source', unrelated)
        self.assertNotIn('completed', unrelated)

    def test_metadata_only_changes_update_the_existing_row_in_live_changes(self):
        message = {'id': 'compact', 'kind': 'contextCompaction', 'role': 'activity', 'text': '',
                   'source': 'automatic', 'completed': False}
        view = {'turns': [{'id': 'turn', 'status': 'inProgress', 'messages': [message]}], 'sequence': 1}
        timeline = Timeline(); timeline.update(view)
        before = timeline.rows[0]; epoch = timeline.epoch
        for sequence, fields in ((2, {'completed': True}), (3, {'source': 'manual'})):
            message.update(fields); view['sequence'] = sequence; timeline.update(view)
            changes = timeline.changes(sequence - 1, epoch, '')['rows']
            self.assertEqual(len(changes), 1)
            self.assertEqual(changes[0]['key'], before['key'])
            self.assertNotEqual(changes[0]['version'], before['version'])
            self.assertEqual(changes[0]['source'], message['source'])
            self.assertIs(changes[0]['completed'], message['completed'])
            before = changes[0]


if __name__ == '__main__':
    unittest.main()
