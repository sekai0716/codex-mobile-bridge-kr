import unittest

from bridge.features.sessions.model import normalize_state


class ReasoningStatusTests(unittest.TestCase):
    def state(self, items, status='inProgress', turn_id='current'):
        return {'turns': [{'id': turn_id, 'status': status, 'items': items}]}

    def test_last_nonempty_line_of_last_nonempty_summary(self):
        state = self.state([
            {'type': 'reasoning', 'summary': [{'type': 'summary_text', 'text': 'older'}]},
            {'type': 'reasoning', 'summary': [
                {'type': 'summary_text', 'text': 'first\nsecond\n'},
                {'type': 'summaryText', 'text': 'new first\r\n마지막 한 줄\n \n'}, '  ']},
            {'type': 'reasoning', 'summary': []},
        ])
        value = normalize_state(state)
        self.assertEqual(value['reasoningSummary'], '마지막 한 줄')
        self.assertEqual(value['reasoningTurnId'], 'current')

    def test_empty_summary_never_exposes_reasoning_content(self):
        state = self.state([{'type': 'reasoning', 'summary': [], 'content': [
            {'type': 'text', 'text': 'private reasoning content'}]}])
        self.assertIsNone(normalize_state(state)['reasoningSummary'])
        state['turns'][0]['items'][0]['summary'] = [{'type': 'text', 'text': 'not a summary'}]
        self.assertIsNone(normalize_state(state)['reasoningSummary'])

    def test_completed_and_previous_turn_summaries_are_not_reused(self):
        old = {'type': 'reasoning', 'summary': ['old summary']}
        for status in ('completed', 'interrupted', 'failed'):
            with self.subTest(status=status):
                self.assertIsNone(normalize_state(self.state([old], status))['reasoningSummary'])
        state = self.state([], turn_id='new')
        state['turns'].insert(0, {'id': 'old', 'status': 'completed', 'items': [old]})
        value = normalize_state(state)
        self.assertIsNone(value['reasoningSummary'])
        self.assertEqual(value['reasoningTurnId'], 'new')

    def test_string_summary_parts_and_unicode_lines(self):
        value = normalize_state(self.state([{'type': 'reasoning', 'summary': ['one\u2028two\u2029 \n']}]))
        self.assertEqual(value['reasoningSummary'], 'two')
