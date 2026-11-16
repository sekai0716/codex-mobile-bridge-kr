import Foundation
import ActivityKit

@available(iOS 16.2, *)
struct TaskActivity: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String
        var updatedAt: Date
        var language: String? = nil
        func text(_ ko: String, _ en: String) -> String { (language ?? "ko").hasPrefix("en") ? en : ko }
        var label: String {
            switch phase {
            case "running": return text("실행 중", "Running")
            case "waiting": return text("응답을 기다리는 중", "Waiting for you")
            case "ended": return text("응답 완료", "Turn completed")
            case "paused": return text("앱을 열어 동기화하세요", "Open app to sync")
            case "offline": return text("연결 끊김", "Disconnected")
            default: return text("연결됨", "Connected")
            }
        }
        var symbol: String {
            switch phase {
            case "running": return "ellipsis"
            case "waiting": return "hand.raised.fill"
            case "ended": return "checkmark"
            case "paused", "offline": return "arrow.clockwise"
            default: return "desktopcomputer"
            }
        }
    }
    var origin: String
    var thread: String
    var host: String
    var demo: Bool
    var link: URL? {
        var c = URLComponents(); c.scheme = "codexbridge"; c.host = "open"
        c.queryItems = [URLQueryItem(name: "origin", value: origin), URLQueryItem(name: "thread", value: thread), URLQueryItem(name: "host", value: host)]
        return c.url
    }
}
