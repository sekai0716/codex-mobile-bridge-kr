import SwiftUI
import WidgetKit
import ActivityKit

@main
struct BridgeActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TaskActivity.self) { context in
            HStack(spacing: 14) {
                Image(systemName: context.state.symbol).font(.title2).foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 5) {
                    Text(context.attributes.demo ? context.state.text("스마트 아일랜드 시연", "Live Activity preview") : context.state.text("Bridge · 컴퓨터 작업", "Bridge · Computer task")).font(.headline)
                    Text(context.isStale ? context.state.text("마지막 상태 · ", "Last status · ") + context.state.label : context.state.label).font(.subheadline)
                    if context.isStale { Text(context.state.updatedAt, style: .time).font(.caption).foregroundStyle(.secondary) }
                }
                Spacer()
                Image(systemName: "arrow.up.right").foregroundStyle(.secondary)
            }
            .padding(18)
            .activityBackgroundTint(Color(.secondarySystemBackground))
            .widgetURL(context.attributes.demo ? URL(string: "codexbridge://preview") : context.attributes.link)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "desktopcomputer").foregroundStyle(.cyan) }
                DynamicIslandExpandedRegion(.trailing) { Image(systemName: context.isStale ? "arrow.clockwise" : context.state.symbol) }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.attributes.demo ? context.state.text("스마트 아일랜드 시연", "Live Activity preview") : context.state.text("Bridge · 컴퓨터 작업", "Bridge · Computer task")).font(.headline)
                        Text(context.isStale ? context.state.text("마지막 상태 · ", "Last status · ") + context.state.label : context.state.label).font(.subheadline)
                    if context.isStale { Text(context.state.updatedAt, style: .time).font(.caption).foregroundStyle(.secondary) }
                        Text(context.state.text("채팅을 계속하려면 클릭하세요.", "Tap to continue chatting")).font(.caption).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "desktopcomputer").foregroundStyle(.cyan)
            } compactTrailing: {
                Image(systemName: context.isStale ? "arrow.clockwise" : context.state.symbol)
            } minimal: {
                Image(systemName: context.isStale ? "arrow.clockwise" : context.state.symbol).foregroundStyle(.cyan)
            }
            .widgetURL(context.attributes.demo ? URL(string: "codexbridge://preview") : context.attributes.link)
        }
    }
}
