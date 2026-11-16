// Native, visible Claude Console bootstrap. No CDP, clipboard or trust changes.
import AppKit
import ApplicationServices
import Foundation

struct SetupError: Error { let state: String; let reason: String }
func fail(_ state: String, _ reason: String) throws -> Never { throw SetupError(state: state, reason: reason) }
func desktopIssue(hasSession: Bool, onConsole: Bool?, loginDone: Bool?, locked: Bool?, foreground: String?, screenSaverWindow: Bool) -> SetupError? {
    if locked == true {
        return SetupError(state: "needs-unlock", reason: "Mac 화면 잠김，Claude 연결을 설정하려면 대화형 데스크탑이 필요합니다. 잠금 해제 후 연결이 자동으로 계속됩니다")
    }
    if hasSession && onConsole == true && loginDone == true && (foreground == "com.apple.ScreenSaver.Engine" || screenSaverWindow) {
        return SetupError(state: "needs-screen-saver", reason: "Mac 화면 보호기 표시 중，Claude 연결을 설정하려면 대화형 데스크탑이 필요합니다. 화면 보호기를 종료하면 연결이 자동으로 계속됩니다.")
    }
    if !hasSession || onConsole != true || loginDone != true || foreground == nil || foreground == "com.apple.loginwindow" {
        return SetupError(state: "needs-desktop", reason: "현재 Mac 세션이 대화형이 아닙니다.，Claude 액세스가 일시 중지되었습니다. 현재 사용자의 데스크탑으로 돌아온 후 연결이 자동으로 재개됩니다.")
    }
    return nil
}
func isScreenSaverWindow(bundle: String?, layer: Int, onScreen: Bool, saverLevel: Int) -> Bool {
    // A background wallpaper service or a normal Screen Saver preview is not
    // evidence that a screen saver covers the desktop.
    bundle == "com.apple.ScreenSaver.Engine" && onScreen && layer >= saverLevel
}
func currentDesktopIssue(scanWindows: Bool = true) -> SetupError? {
    let session = CGSessionCopyCurrentDictionary() as? [String: Any]
    let foreground = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
    func issue(_ screenSaverWindow: Bool) -> SetupError? {
        desktopIssue(hasSession: session != nil, onConsole: session?[kCGSessionOnConsoleKey as String] as? Bool,
                     loginDone: session?[kCGSessionLoginDoneKey as String] as? Bool,
                     // This extra key is not part of Apple's documented session
                     // contract. Only an explicit true establishes locked; an
                     // absent key never turns screen saver into "locked".
                     locked: session?["CGSSessionScreenIsLocked"] as? Bool,
                     foreground: foreground, screenSaverWindow: screenSaverWindow)
    }
    if let blocked = issue(false) { return blocked }
    // Window dictionaries are relatively expensive. Check them at entry and
    // before activation/HID submission, not for each Unicode input chunk.
    if scanWindows, let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] {
        let saverLevel = Int(CGWindowLevelForKey(.screenSaverWindow))
        for window in windows {
            guard let layer = window[kCGWindowLayer as String] as? Int, layer >= saverLevel,
                  let pid = window[kCGWindowOwnerPID as String] as? Int32 else { continue }
            if isScreenSaverWindow(bundle: NSRunningApplication(processIdentifier: pid)?.bundleIdentifier,
                                   layer: layer, onScreen: window[kCGWindowIsOnscreen as String] as? Bool == true, saverLevel: saverLevel) {
                return issue(true)
            }
        }
    }
    return nil
}
func requireDesktop(scanWindows: Bool = true) throws {
    if let issue = currentDesktopIssue(scanWindows: scanWindows) { throw issue }
}
func output(_ state: String, _ reason: String) {
    let value: [String: Any] = ["setupState": state, "reason": reason, "helperPath": CommandLine.arguments[0]]
    let data = try! JSONSerialization.data(withJSONObject: value)
    print(String(data: data, encoding: .utf8)!)
}
// Claude/DevTools의 실제 접근성 이름과 구형 오류 문구는 외부 계약이므로 번역하지 않습니다.
func bridgeOwnerIssue(_ value: String, marker: String) -> String? {
    guard value.contains("[\(marker)]") else { return nil }
    if value.contains("BRIDGE_OWNER_BUSY") { return "busy" }
    if value.contains("BRIDGE_OWNER_UNCONFIRMED") { return "unconfirmed" }
    if value.contains("BRIDGE_OWNER_LEGACY") || value.contains("Claude \u{6865}\u{63a5}\u{8fde}\u{63a5}\u{88ab}\u{5176}\u{4ed6}\u{7f51}\u{5173}\u{5360}\u{7528}") { return "legacy" }
    return nil
}
func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}
func text(_ element: AXUIElement, _ name: String) -> String { attribute(element, name) as? String ?? "" }
func child(_ element: AXUIElement, _ name: String) -> AXUIElement? {
    guard let value = attribute(element, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}
func children(_ element: AXUIElement) -> [AXUIElement] { attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] }
func find(_ root: AXUIElement, matching: (AXUIElement) -> Bool) -> AXUIElement? {
    var queue = [root], index = 0
    while index < queue.count && index < 3500 {
        let item = queue[index]; index += 1
        if matching(item) { return item }
        if queue.count < 3500 { queue.append(contentsOf: children(item)) }
    }
    return nil
}
func promptName(_ name: String) -> Bool {
    ["console-prompt", "Console prompt", "\u{63a7}\u{5236}\u{53f0}\u{63d0}\u{793a}", "\u{63a7}\u{5236}\u{53f0}\u{63d0}\u{793a}\u{7b26}"].contains(name)
}
func isPrompt(_ element: AXUIElement) -> Bool {
    promptName(text(element, kAXIdentifierAttribute)) || promptName(text(element, kAXDescriptionAttribute)) || promptName(text(element, kAXTitleAttribute))
}
func consoleTab(role: String, identifier: String, description: String, title: String) -> Bool {
    ["AXRadioButton", "AXButton", "AXTab"].contains(role) &&
        [identifier, description, title].contains(where: { ["Console", "\u{63a7}\u{5236}\u{53f0}"].contains($0) })
}
func isConsoleTab(_ element: AXUIElement) -> Bool {
    consoleTab(role: text(element, kAXRoleAttribute), identifier: text(element, kAXIdentifierAttribute),
               description: text(element, kAXDescriptionAttribute), title: text(element, kAXTitleAttribute))
}
func submissionAccepted(_ value: String?) -> Bool {
    value?.trimmingCharacters(in: .newlines).isEmpty == true
}
func activationMayWait(initial: pid_t?, current: pid_t?, target: pid_t) -> Bool {
    current != nil && current == initial && current != target
}
func devToolsWindow(role: String, title: String, owner: pid_t, expectedOwner: pid_t) -> Bool {
    role == "AXWindow" && owner == expectedOwner &&
        ["Developer Tools", "DevTools", "\u{5f00}\u{53d1}\u{8005}\u{5de5}\u{5177}"].contains(where: { title == $0 || title.hasPrefix($0 + " - ") })
}
func contents(_ element: AXUIElement) -> String { text(element, kAXValueAttribute).trimmingCharacters(in: .newlines) }
func focusedWithin<Element>(_ expected: Element, focused: Element?, parent: (Element) -> Element?, equal: (Element, Element) -> Bool) -> Bool {
    var cursor = focused
    for _ in 0..<5 {
        guard let current = cursor else { return false }
        if equal(current, expected) { return true }
        cursor = parent(current)
    }
    return false
}

final class Connector {
    let app: NSRunningApplication
    let root: AXUIElement
    let cancel: URL?
    init(pid: pid_t, executable: String, cancelPath: String?) throws {
        guard let found = NSRunningApplication(processIdentifier: pid),
              found.bundleIdentifier == "com.anthropic.claudefordesktop",
              found.executableURL?.resolvingSymlinksInPath().path == URL(fileURLWithPath: executable).resolvingSymlinksInPath().path else {
            try fail("needs-attention", "대상이 발견되지 않았습니다 Claude Desktop")
        }
        app = found; root = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(root, 1)
        cancel = cancelPath.map { URL(fileURLWithPath: $0) }
    }
    func check(_ prompt: AXUIElement? = nil, foreground: Bool = true) throws {
        // AppKit's dynamic application properties update on the main run loop.
        // Drain a ready event without sleeping before checking live foreground.
        _ = RunLoop.current.run(mode: .default, before: Date())
        if let cancel = cancel, FileManager.default.fileExists(atPath: cancel.path) { try fail("cancelled", "취소 Claude 연결") }
        try requireDesktop(scanWindows: false)
        if CGEventSource.keyState(.combinedSessionState, key: 53) { try fail("cancelled", "취소 Claude 연결") }
        guard !app.isTerminated, !foreground || NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
            try fail("needs-attention", "초점이 나갔어 Claude，자동 연결이 중지되었습니다. 다시 시도해 주세요.")
        }
        if let prompt = prompt {
            guard let window = child(prompt, kAXWindowAttribute) else { try fail("needs-attention", "확인할 수 없습니다 Claude Console 입력 포커스") }
            try checkWindow(window)
            guard focusedWithin(prompt, focused: child(root, kAXFocusedUIElementAttribute),
                                parent: { child($0, kAXParentAttribute) }, equal: { CFEqual($0, $1) }) else {
                try fail("needs-attention", "Claude Console 입력 포커스가 변경되어 자동 연결이 중지되었습니다.")
            }
        }
    }
    func checkWindow(_ window: AXUIElement) throws {
        try check()
        guard let focused = child(root, kAXFocusedWindowAttribute), CFEqual(window, focused) else {
            try fail("needs-attention", "Claude 창이 바뀌어 자동연결이 멈췄습니다. 다시 시도해 주세요.")
        }
    }
    func activate() throws {
        try requireDesktop()
        try check(foreground: false)
        let initial = NSWorkspace.shared.frontmostApplication?.processIdentifier
        app.activate(options: [.activateAllWindows])
        let deadline = Date().addingTimeInterval(2)
        repeat {
            // Activation is asynchronous; Thread.sleep alone leaves AppKit's
            // cached foreground stale. Request once and service notifications.
            RunLoop.current.run(until: Date().addingTimeInterval(0.025))
            try requireDesktop()
            try check(foreground: false)
            let current = NSWorkspace.shared.frontmostApplication?.processIdentifier
            if current == app.processIdentifier { try check(); return }
            guard activationMayWait(initial: initial, current: current, target: app.processIdentifier) else {
                try fail("needs-attention", "초점이 나갔어 Claude，자동 연결이 중지되었습니다. 다시 시도해 주세요.")
            }
        } while Date() < deadline
        try fail("needs-attention", "초점이 나갔어 Claude，자동 연결이 중지되었습니다. 다시 시도해 주세요.")
    }
    func key(_ code: CGKeyCode, flags: CGEventFlags = [], prompt: AXUIElement? = nil) throws {
        if let prompt = prompt {
            guard let down = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: true),
                  let up = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: false) else {
                try fail("needs-attention", "키보드 이벤트를 생성할 수 없습니다.")
            }
            down.flags = flags; up.flags = flags
            try check(prompt)
            down.post(tap: .cghidEventTap)
            up.post(tap: .cghidEventTap)
            try check(prompt)
            return
        }
        for down in [true, false] {
            try check(prompt)
            guard let event = CGEvent(keyboardEventSource: nil, virtualKey: code, keyDown: down) else { try fail("needs-attention", "키보드 이벤트를 생성할 수 없습니다.") }
            event.flags = flags; event.postToPid(app.processIdentifier)
        }
    }
    func developerMode() throws {
        try activate()
        guard let menu = child(root, kAXMenuBarAttribute), let help = find(menu, matching: { ["Help", "\u{5e2e}\u{52a9}"].contains(text($0, kAXTitleAttribute)) }) else {
            try fail("needs-developer-mode", "제발 Claude 도움말 메뉴에서 개발자 모드를 활성화하고 다시 연결해 보세요.")
        }
        try check(); AXUIElementPerformAction(help, kAXPressAction as CFString)
        Thread.sleep(forTimeInterval: 0.2)
        let names = ["Enable Developer Mode…", "Enable Developer Mode...", "\u{542f}\u{7528}\u{5f00}\u{53d1}\u{8005}\u{6a21}\u{5f0f}\u{2026}", "\u{542f}\u{7528}\u{5f00}\u{53d1}\u{8005}\u{6a21}\u{5f0f}..."]
        guard let item = find(menu, matching: { names.contains(text($0, kAXTitleAttribute)) }) else {
            try fail("needs-developer-mode", "제발 Claude 도움말 메뉴에서 개발자 모드를 활성화하고 다시 연결해 보세요.")
        }
        try check(); AXUIElementPerformAction(item, kAXPressAction as CFString)
        // The native confirmation is left to the user. Never click Enable.
        output("needs-developer-mode", "확인해주세요 Claude 개발자 모드에서는 완료 후에도 연결이 계속된다는 메시지가 표시됩니다.")
    }
    func console() throws -> AXUIElement {
        try activate()
        // Electron may leave Chromium's AX tree dormant until an assistive client asks for it.
        _ = AXUIElementSetAttributeValue(root, "AXManualAccessibility" as CFString, kCFBooleanTrue)
        guard let initial = child(root, kAXFocusedWindowAttribute) else { try fail("needs-attention", "확인할 수 없습니다 Claude Console 입력 포커스") }
        if let prompt = find(initial, matching: isPrompt) { return prompt }
        // macOS Chromium exposes the tab name as AXDescription, with no title.
        // When DevTools is already open on Elements, select its Console directly.
        if let tab = find(initial, matching: isConsoleTab) {
            try checkWindow(initial); AXUIElementPerformAction(tab, kAXPressAction as CFString)
        } else {
            try checkWindow(initial)
            try key(34, flags: [.maskCommand, .maskAlternate])
        }
        let deadline = Date().addingTimeInterval(12)
        while Date() < deadline {
            Thread.sleep(forTimeInterval: 0.25); try check()
            guard let window = child(root, kAXFocusedWindowAttribute) else { try fail("needs-attention", "확인할 수 없습니다 Claude Console 입력 포커스") }
            if !CFEqual(window, initial) {
                var owner: pid_t = 0
                guard AXUIElementGetPid(window, &owner) == .success,
                      devToolsWindow(role: text(window, kAXRoleAttribute), title: text(window, kAXTitleAttribute), owner: owner, expectedOwner: app.processIdentifier) else {
                    try fail("needs-attention", "Claude 창이 바뀌어 자동연결이 멈췄습니다. 다시 시도해 주세요.")
                }
            }
            if let prompt = find(window, matching: isPrompt) { return prompt }
            if let tab = find(window, matching: isConsoleTab) {
                try checkWindow(window); AXUIElementPerformAction(tab, kAXPressAction as CFString)
            }
        }
        try fail("failed", "찾을 수 없음 Claude Console，개발자 도구 창을 사용할 수 있는지 확인하고 다시 시도해 주세요.")
    }
    func verify(_ prompt: AXUIElement, _ expected: String) throws {
        var previous: String?
        for _ in 0..<40 {
            Thread.sleep(forTimeInterval: 0.025)
            try check(prompt)
            let observed = (attribute(prompt, kAXValueAttribute) as? String)?.trimmingCharacters(in: .newlines)
            if observed == expected { return }
            // Chromium may expose only a viewport slice of a long Console line.
            // This establishes input readiness, not full-source verification;
            // the signed connector receipt establishes successful execution.
            if !expected.isEmpty, let observed = observed, observed.utf16.count >= 32,
               expected.contains(observed), observed == previous { return }
            previous = observed
        }
        try fail("needs-attention", "Console 입력 내용을 확인할 수 없어 연결 스크립트가 실행되지 않았습니다. 다시 시도해 주세요.")
    }
    func submit(_ prompt: AXUIElement) throws {
        try check(prompt)
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: false) else {
            try fail("failed", "생성할 수 없습니다. Console 이벤트 제출, 연결 스크립트가 유지되었습니다.")
        }
        // Chromium accepted the source but did not submit Return posted only
        // to its PID. Enter the HID stream once, guarded by the actual prompt.
        down.flags = []; up.flags = []
        down.setIntegerValueField(.keyboardEventAutorepeat, value: 0)
        try requireDesktop()
        try check(prompt)
        down.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.03)
        up.post(tap: .cghidEventTap)
        // The owner waits for the signed connector receipt; AX focus/value can
        // change as soon as this Enter is accepted and cannot gate dispatch.
    }
    func inject(_ path: String) throws {
        let source = try String(contentsOfFile: path, encoding: .utf8)
        guard source.hasPrefix("/* codex bridge connector */"), source.utf8.count < 300000,
              !source.contains("\n"), !source.contains("\r") else { try fail("needs-attention", "잘못된 연결 스크립트 형식") }
        let prompt = try console()
        guard let window = child(prompt, kAXWindowAttribute) else { try fail("needs-attention", "확인할 수 없습니다 Claude Console 입력 포커스") }
        try checkWindow(window)
        let old = contents(prompt)
        guard old.isEmpty || old.hasPrefix("/* codex bridge connector */") else {
            try fail("needs-attention", "Console 예약된 파일에 제출되지 않은 콘텐츠가 있습니다. 처리한 후 다시 연결해 보세요.")
        }
        try checkWindow(window)
        AXUIElementSetAttributeValue(prompt, kAXFocusedAttribute as CFString, kCFBooleanTrue)
        Thread.sleep(forTimeInterval: 0.1); try check(prompt)
        if !old.isEmpty {
            try key(0, flags: .maskCommand, prompt: prompt); try key(51, prompt: prompt); try verify(prompt, "")
        }
        var settable = DarwinBoolean(false)
        if AXUIElementIsAttributeSettable(prompt, kAXValueAttribute as CFString, &settable) == .success && settable.boolValue {
            try check(prompt)
            if AXUIElementSetAttributeValue(prompt, kAXValueAttribute as CFString, source as CFString) != .success { try fail("needs-attention", "Console 입력 연결 스크립트 거부") }
            try verify(prompt, source)
        } else {
            let units = Array(source.utf16)
            for start in stride(from: 0, to: units.count, by: 32) {
                try check(prompt)
                let end = min(start + 32, units.count), chunk = Array(units[start..<end])
                for down in [true, false] {
                    try check(prompt)
                    guard let event = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: down) else { try fail("needs-attention", "키보드 이벤트를 생성할 수 없습니다.") }
                    event.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
                    event.postToPid(app.processIdentifier)
                }
                Thread.sleep(forTimeInterval: 0.01)
            }
            try verify(prompt, source)
        }
        try submit(prompt)
        output("submitted", "연결 스크립트가 입력되었으며 대기 중입니다. Claude 확인")
    }
    func closeConsole() throws {
        // Only called after the Python owner verifies the signed heartbeat.
        // The Claude shortcut opens/brings forward tools; it does not close.
        // Docked or unrecognized tools are left open rather than closing Claude.
        let windows = attribute(root, kAXWindowsAttribute) as? [AXUIElement] ?? []
        for window in windows {
            var owner: pid_t = 0
            guard AXUIElementGetPid(window, &owner) == .success,
                  devToolsWindow(role: text(window, kAXRoleAttribute), title: text(window, kAXTitleAttribute),
                                 owner: owner, expectedOwner: app.processIdentifier),
                  find(window, matching: { isPrompt($0) || isConsoleTab($0) }) != nil else { continue }
            // AX closes this verified window directly, including in the background.
            // Never activate Claude or send a keyboard shortcut for cleanup.
            try requireDesktop()
            try check(foreground: false)
            guard let close = child(window, kAXCloseButtonAttribute),
                  AXUIElementGetPid(close, &owner) == .success, owner == app.processIdentifier,
                  AXUIElementPerformAction(close, kAXPressAction as CFString) == .success else {
                try fail("needs-attention", "Claude 연결되었지만 개발자 도구 창을 닫지 못했습니다.")
            }
            let deadline = Date().addingTimeInterval(3)
            var closed = false
            while Date() < deadline {
                if let remaining = attribute(root, kAXWindowsAttribute) as? [AXUIElement],
                   !remaining.contains(where: { CFEqual($0, window) }) { closed = true; break }
                Thread.sleep(forTimeInterval: 0.1)
            }
            if !closed { try fail("needs-attention", "Claude 연결되었지만 개발자 도구 창을 닫지 못했습니다.") }
        }
        if find(root, matching: isPrompt) != nil { try fail("needs-attention", "Claude 연결됨; 개발자 도구가 자동으로 닫히지 않았습니다. 수동으로 닫아주세요.") }
        output("connected", "Claude 연결됨")
    }
    func inspectError(marker: String?) {
        let conflict = marker.flatMap { expected in find(root, matching: {
            guard text($0, kAXRoleAttribute) == "AXStaticText" else { return false }
            let value = text($0, kAXValueAttribute).isEmpty ? text($0, kAXTitleAttribute) : text($0, kAXValueAttribute)
            return bridgeOwnerIssue(value, marker: expected) != nil
        }) }
        if let conflict = conflict, let marker = marker {
            let value = text(conflict, kAXValueAttribute).isEmpty ? text(conflict, kAXTitleAttribute) : text(conflict, kAXValueAttribute)
            let issue = bridgeOwnerIssue(value, marker: marker)
            let reason = issue == "busy" ? "Claude 아직 브릿지 요청이 진행 중입니다. 나중에 다시 연결해 보세요." :
                issue == "unconfirmed" ? "이전 게이트웨이에는 아직 확인되지 않은 요청이나 완료되지 않은 인계가 있습니다. 이전 게이트웨이에서 결과를 확인하신 후 다시 시도해주세요." :
                "이전 버전 Claude 브리지는 전송 중인 요청을 확인할 수 없습니다. 현재 작업이 완료되었는지 확인한 다음 다시 로드하거나 종료하고 다시 시작하세요. Claude Desktop，새 게이트웨이를 다시 초기화합니다（한 번만 마이그레이션하면 됩니다）.）"
            output("owner-conflict", reason)
            return
        }
        let error = find(root, matching: {
            guard text($0, kAXRoleAttribute) == "AXStaticText" else { return false }
            let value = text($0, kAXValueAttribute).isEmpty ? text($0, kAXTitleAttribute) : text($0, kAXValueAttribute)
            return (value.hasPrefix("Error:") || value.hasPrefix("Uncaught")) &&
                (value.contains("아직 신뢰할 수 없는 디렉터리") || value.contains("WorkspaceTrustError") || value.contains("trust_required"))
        })
        output(error == nil ? "failed" : "needs-trust", error == nil
               ? "받지 못함 Claude 연결이 확인되었습니다. 로그인 및 디렉터리 신뢰도를 확인한 후 다시 시도해 주세요."
               : "제발 Claude Code 연결 디렉터리 신뢰를 확인한 후 다시 연결하세요.")
    }
}

let args = Array(CommandLine.arguments.dropFirst())
do {
    if args.first == "--self-check" {
        let parents = ["editor-child": "expected-console", "other-editor": "other-console"]
        guard focusedWithin("expected-console", focused: "editor-child", parent: { parents[$0] }, equal: ==),
              !focusedWithin("expected-console", focused: "other-editor", parent: { parents[$0] }, equal: ==),
              !focusedWithin("expected-console", focused: "other-console", parent: { parents[$0] }, equal: ==) else {
            throw SetupError(state: "error", reason: "Exact Console focus self-check failed")
        }
        guard promptName("Console prompt"), !promptName("Message Claude") else { throw SetupError(state: "error", reason: "self-check failed") }
        // Observed Claude 2.26454.0: Elements selected, Console has only a
        // description; after selecting it the editor is "Console prompt".
        guard consoleTab(role: "AXRadioButton", identifier: "", description: "Console", title: ""),
              consoleTab(role: "AXTab", identifier: "", description: "\u{63a7}\u{5236}\u{53f0}", title: ""),
              consoleTab(role: "AXButton", identifier: "", description: "", title: "Console"),
              consoleTab(role: "AXTab", identifier: "Console", description: "", title: ""),
              !consoleTab(role: "AXTextArea", identifier: "", description: "Console", title: ""),
              !consoleTab(role: "AXStaticText", identifier: "", description: "Console", title: ""),
              !consoleTab(role: "AXRadioButton", identifier: "", description: "Elements", title: ""),
              !consoleTab(role: "AXButton", identifier: "", description: "Message Claude", title: "") else {
            throw SetupError(state: "error", reason: "Console tab selector self-check failed")
        }
        guard submissionAccepted(""), submissionAccepted("\n"),
              !submissionAccepted(nil), !submissionAccepted(" "), !submissionAccepted("/* codex bridge connector */script"),
              devToolsWindow(role: "AXWindow", title: "Developer Tools - app://localhost/epitaxy?coldLaunch=1", owner: 42, expectedOwner: 42),
              devToolsWindow(role: "AXWindow", title: "Developer Tools", owner: 42, expectedOwner: 42),
              !devToolsWindow(role: "AXWindow", title: "Claude", owner: 42, expectedOwner: 42),
              !devToolsWindow(role: "AXWindow", title: "Developer Tools project", owner: 42, expectedOwner: 42),
              !devToolsWindow(role: "AXGroup", title: "Developer Tools", owner: 42, expectedOwner: 42),
              !devToolsWindow(role: "AXWindow", title: "Developer Tools", owner: 77, expectedOwner: 42) else {
            throw SetupError(state: "error", reason: "Console submission and window guard self-check failed")
        }
        guard activationMayWait(initial: 7, current: 7, target: 42),
              !activationMayWait(initial: 7, current: 42, target: 42),
              !activationMayWait(initial: 7, current: 9, target: 42),
              !activationMayWait(initial: 7, current: nil, target: 42),
              !activationMayWait(initial: nil, current: nil, target: 42),
              !activationMayWait(initial: 42, current: 7, target: 42) else {
            throw SetupError(state: "error", reason: "Activation transition guards self-check failed")
        }
        output("ready", "Native Console selectors, submission and window guards ready")
    } else if args.first == "--wait-desktop" {
        // Read-only wait: no activation, permission prompts, AX actions or
        // keyboard events. The Python owner cancels only this helper process.
        while currentDesktopIssue() != nil {
            RunLoop.current.run(until: Date().addingTimeInterval(2))
        }
        output("ready", "데스크톱 세션은 대화형입니다.")
    } else {
        try requireDesktop()
        let prompt = args.first == "--request-permission"
        let trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary)
        guard trusted else { try fail("needs-permission", "시스템 설정의 접근성 기능에서 게이트웨이를 승인해주세요 App（아니요 Claude），완료 후에도 연결은 계속됩니다") }
        if args.first == "--check" || prompt { output("ready", "접근성 승인됨") }
        else {
            guard args.count >= 3, let pid = Int32(args[1]) else { try fail("needs-attention", "잘못된 연결 구성요소 매개변수") }
            let connector = try Connector(pid: pid, executable: args[2], cancelPath: args.count > 4 ? args[4] : nil)
            if args[0] == "--enable-devtools" { try connector.developerMode() }
            else if args[0] == "--connect" && args.count == 5 { try connector.inject(args[3]) }
            else if args[0] == "--close-devtools" { try connector.closeConsole() }
            else if args[0] == "--inspect-error" { connector.inspectError(marker: args.count > 3 ? args[3] : nil) }
            else { try fail("needs-attention", "잘못된 연결 구성요소 매개변수") }
        }
    }
} catch let error as SetupError { output(error.state, error.reason) }
catch { output("needs-attention", "Claude 연결 구성요소가 작업을 완료하지 못했습니다. 다시 시도해 주세요.") }
