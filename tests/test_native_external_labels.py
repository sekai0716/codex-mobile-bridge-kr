"""외부 앱의 실제 이름과 도우미 오류 분류를 GUI 실행 없이 검증한다."""
import json
import re
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from bridge.platforms.windows import claude as windows_claude


ROOT = Path(__file__).resolve().parents[1]


def native_strings(source):
    # Swift/C# 일반 문자열의 escape만 해석한다. raw/verbatim 문자열은 그대로 둔다.
    values = []
    for match in re.finditer(r'([@#]*)"((?:\\.|[^"\\])*)"', source):
        prefix, value = match.groups()
        if prefix:
            values.append(value)
            continue
        value = re.sub(r'\\u\{([0-9a-fA-F]+)\}', lambda m: chr(int(m[1], 16)), value)
        try:
            values.append(json.loads('"' + value + '"'))
        except json.JSONDecodeError:
            # 보간식 등 이 검사의 대상이 아닌 네이티브 문자열은 건너뛴다.
            continue
    return values


class ExternalApplicationLabels(unittest.TestCase):
    def assert_contracts(self, filename, contracts):
        source = (ROOT / filename).read_text(encoding='utf-8')
        for start, end, expected in contracts:
            with self.subTest(file=filename, method=start):
                offset = source.index(start)
                block = source[offset:source.index(end, offset) if end else None]
                self.assertTrue(set(expected) <= set(native_strings(block)), expected)

    def test_macos_claude_retains_observed_console_and_menu_labels(self):
        self.assert_contracts('bridge/platforms/macos/claude-helper.swift', [
            ('func bridgeOwnerIssue(', 'func attribute(', ['Claude \u6865\u63a5\u8fde\u63a5\u88ab\u5176\u4ed6\u7f51\u5173\u5360\u7528']),
            ('func promptName(', 'func isPrompt(', ['console-prompt', 'Console prompt', '\u63a7\u5236\u53f0\u63d0\u793a', '\u63a7\u5236\u53f0\u63d0\u793a\u7b26']),
            ('func consoleTab(', 'func isConsoleTab(', ['Console', '\u63a7\u5236\u53f0']),
            ('func devToolsWindow(', 'func contents(', ['Developer Tools', 'DevTools', '\u5f00\u53d1\u8005\u5de5\u5177']),
            ('    func developerMode()', '    func console()', ['Help', '\u5e2e\u52a9', '\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f\u2026', '\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f...']),
            ('    if args.first == "--self-check"', None, ['\u63a7\u5236\u53f0']),
        ])

    def test_macos_zcode_retains_session_identity_menu_labels(self):
        self.assert_contracts('bridge/platforms/macos/zcode-helper.swift', [
            ('    func verifyId()', '    func perform()', ['\u66f4\u591a', '\u590d\u5236\u4f1a\u8bdd ID']),
        ])

    def test_windows_claude_retains_simplified_and_traditional_labels(self):
        prompts = ['\u63a7\u5236\u53f0\u63d0\u793a', '\u63a7\u5236\u53f0\u63d0\u793a\u7b26']
        self.assert_contracts('bridge/platforms/windows/claude-helper.cs', [
            ('    static string OwnerIssue(', '    static string DesktopName(', ['Claude \u6865\u63a5\u8fde\u63a5\u88ab\u5176\u4ed6\u7f51\u5173\u5360\u7528']),
            ('    static bool PromptName(', '    static bool IsPrompt(', prompts),
            ('    static AutomationElement ConsolePrompt(AutomationElement root)', '    static bool DevToolsTitle(', prompts),
            ('    static bool DevToolsTitle(', '    static void CloseDevTools(', ['\u5f00\u53d1\u8005\u5de5\u5177', '\u5f00\u53d1\u8005\u5de5\u5177 - ']),
            ('    static void CloseDevTools(', '    static void SelectConsoleTab(', ['\u5173\u95ed\u5f00\u53d1\u8005\u5de5\u5177']),
            ('    static void SelectConsoleTab(', '    const string DeveloperMenuUnavailable', ['\u63a7\u5236\u53f0']),
            ('    static void EnableDeveloperMode(', '    const string QuitMenuUnavailable', ['\u83dc\u5355', '\u5e2e\u52a9', '\u6545\u969c\u6392\u9664', '\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f\u2026', '\u542f\u7528\u5f00\u53d1\u8005\u6a21\u5f0f...']),
            ('    static bool QuitMenuName(', '    static T UniqueQuitControl', ['\u9000\u51fa', '\u7d50\u675f']),
            ('    static bool HasNativeDialog(', '    static string ObserveQuit(', ['\u4ecd\u8981\u9000\u51fa', '\u4ecd\u8981\u7d50\u675f', '\u7b49\u5f85 Claude']),
            ('    static Uri DevToolsSource(', '    static bool AppDevToolsTitle(', ['\u5f00\u53d1\u8005\u5de5\u5177 - ']),
            ('    static void OpenBackgroundDevTools(', '    static IntPtr BackgroundRenderer(', ['\u5f00\u53d1\u8005', '\u958b\u767c\u8005', '\u83dc\u5355', '\u9078\u55ae', '\u663e\u793a\u6240\u6709\u5f00\u53d1\u8005\u5de5\u5177', '\u986f\u793a\u6240\u6709\u958b\u767c\u8005\u5de5\u5177']),
            ('    static AutomationElement BackgroundPrompt(', '    static void ConnectResult(', ['\u63a7\u5236\u53f0', *prompts]),
            ('    static void SelectBackgroundConsole(', '    static void SubmitBackgroundVerifiedConsole(', ['\u63a7\u5236\u53f0', *prompts]),
            ('    static void CheckNativeQuit()', '    static void CheckQuitSubmissionCancellation()', ['\u9000\u51fa', '\u7d50\u675f']),
            ('    static void CheckBackgroundConnection()', '    static void CheckBackgroundCleanup()', ['\u5f00\u53d1\u8005\u5de5\u5177 - app://localhost/']),
            ('    [STAThread] static int Main(', None, ['Error: Claude \u6865\u63a5\u8fde\u63a5\u88ab\u5176\u4ed6\u7f51\u5173\u5360\u7528 [current]']),
        ])

    def test_windows_codex_and_zcode_retains_exact_quit_inputs(self):
        self.assert_contracts('bridge/platforms/windows/codex-quit-helper.cs', [
            ('    static bool MainShape(', '    static bool PendingDialog(', ['\u5f00\u53d1\u8005\u5de5\u5177']),
            ('    static readonly string[] QuitLabels=', '    static bool QuitLabel(', ['\u9000\u51fa Codex', '\u9000\u51fa ChatGPT', 'Quit Codex', 'Quit ChatGPT']),
            ('    static void QuitTray(', '    static void Quit(Process ', ['\u6253\u5f00 ZCode', '\u9000\u51fa', 'Open ZCode', 'Quit']),
            ('    static void SelfCheck()', '    static int Main(', ['\u9000\u51fa Codex Ctrl+Q', '\u9000\u51fa ChatGPT Ctrl+Q', '\u6ce8\u9500 Ctrl+Q']),
        ])


class WindowsHelperErrorClassification(unittest.TestCase):
    def classify(self, message):
        process = Mock(returncode=1)
        process.communicate.return_value = (message + '\n', '')
        with patch.object(windows_claude.windows_session, 'require_interactive'), \
             patch.object(windows_claude.subprocess, 'Popen', return_value=process) as spawn:
            result = windows_claude.native_action('connect', helper=Path(__file__), pid=42,
                                                  executable='C:/Claude.exe', script='C:/fixture.js')
        spawn.assert_called_once()
        process.terminate.assert_not_called()
        process.kill.assert_not_called()
        self.assertEqual(result['reason'], message)
        return result['setupState']

    def test_each_current_desktop_failure_is_classified_by_actual_caller(self):
        source = (ROOT / 'bridge/platforms/windows/claude-helper.cs').read_text(encoding='utf-8')
        block = source[source.index('    static string DesktopUnavailable()'):source.index('    static void CheckInteractiveDesktop()')]
        messages = [value for value in native_strings(block) if '데스크톱을 사용할 수 없습니다.' in value]
        self.assertEqual(len(messages), 4)
        for message in messages:
            with self.subTest(message=message):
                self.assertEqual(self.classify(message), 'needs-desktop')

    def test_legacy_helper_errors_and_other_states_remain_distinct(self):
        # 구형 도우미의 실제 입력은 표시 문구가 아니므로 원래 Unicode 값을 보존한다.
        for message, state in [
            ('Windows \u684c\u9762\u4e0d\u53ef\u7528', 'needs-desktop'),
            ('Windows \u8f93\u5165\u684c\u9762\u4e0d\u53ef\u7528', 'needs-desktop'),
            ('\u5df2\u53d6\u6d88 Claude \u8fde\u63a5', 'cancelled'),
            ('Windows \u5df2\u9501\u5b9a', 'needs-unlock'),
            ('Claude 연결이 취소되었습니다.', 'cancelled'),
            ('Windows 잠금 상태입니다.', 'needs-unlock'),
            ('알 수 없는 네이티브 오류', 'needs-retry'),
        ]:
            with self.subTest(message=message):
                self.assertEqual(self.classify(message), state)


if __name__ == '__main__':
    unittest.main()
