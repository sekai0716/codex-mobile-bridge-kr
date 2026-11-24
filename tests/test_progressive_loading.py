"""Recent history reuse must stay independent of passive owner attachment."""
import unittest
from unittest.mock import patch

import test_bridge
from test_bridge import THREAD
from bridge.app.service import items_array


class ProgressiveLoadingTests(unittest.TestCase):
    setUp = test_bridge.IntegrationTests.setUp
    tearDown = test_bridge.IntegrationTests.tearDown

    def test_unchanged_pages_reuse_projection_and_patch_invalidates_it(self):
        self.fixture.state['turns'] = [{'turnId': 'turn', 'status': 'completed', 'items': [
            {'id': str(i), 'type': 'agentMessage', 'text': 'row ' + str(i), 'timestamp': 1700000000 + i} for i in range(10000)]}]
        session = self.bridge.session(THREAD)
        first = self.bridge.timeline_read(THREAD)
        self.assertEqual(len(first['rows']), 20)
        self.assertEqual(len(session.timeline.rows), 40)
        with patch.object(session, 'view', wraps=session.view) as normalize:
            # 첫 읽기에서 Timeline.update가 정한 위치를 반영한 뒤에는
            # 같은 기록을 폴링하면서 원본 1만 항목을 다시 훑지 않는다.
            again = self.bridge.timeline_read(THREAD)
            normalize.assert_not_called()
            with patch('bridge.app.service.items_array', wraps=items_array) as scan:
                for _ in range(3):
                    unchanged = self.bridge.timeline_read(THREAD, 'changes', after=first['sequence'], epoch=first['epoch'], start=first['before'])
                    self.assertEqual(unchanged['rows'], [])
                scan.assert_not_called()
            older = self.bridge.timeline_read(THREAD, before=first['before'], limit=100)
            self.assertEqual(again['rows'], first['rows'])
            self.assertEqual(len(older['rows']), 100)
            # A newly requested window is normalized lazily; old bodies were
            # deliberately not converted during the initial read.
            normalize.assert_called_once_with(item_limit=140, process_bodies=True, include_file_diffs=True)
        self.fixture.publish({'type': 'patches', 'baseRevision': 1, 'revision': 2,
                              'patches': [
                                  {'op': 'replace', 'path': ['turns', 0, 'items', 9999, 'text'], 'value': 'updated'},
                                  {'op': 'add', 'path': ['turns', 0, 'items', 10000],
                                   'value': {'id': '10000', 'type': 'agentMessage', 'text': 'appended'}}]})
        with session.condition:
            self.assertTrue(session.condition.wait_for(lambda: session.revision == 2, timeout=3))
        changed = self.bridge.timeline_read(THREAD, 'changes', after=first['sequence'],
                                           epoch=first['epoch'], start=older['before'])
        self.assertEqual([row['text'] for row in changed['rows']], ['updated', 'appended'])
        self.assertEqual(len(session.state['turns'][0]['items']), 10001)
        self.assertEqual(session.timeline_limit, 141)
        self.assertEqual([r['method'] for r in self.fixture.requests], ['initialize'])


if __name__ == '__main__':
    unittest.main()
