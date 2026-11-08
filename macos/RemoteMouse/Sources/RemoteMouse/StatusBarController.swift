import AppKit
import SwiftUI

/// Public AppKit APIs only. Context menu is independent of permission/server state.
enum StatusItemRoute: Equatable {
    case panel, quitMenu, ignore
    static func action(for event: NSEvent.EventType) -> StatusItemRoute {
        switch event {
        case .leftMouseUp: return .panel
        case .rightMouseUp: return .quitMenu
        default: return .ignore
        }
    }
}

@MainActor
final class StatusBarController: NSObject {
    private let item: NSStatusItem
    private let popover = NSPopover()

    init(model: AgentController) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()
        popover.behavior = .transient
        popover.animates = false
        popover.contentSize = NSSize(width: 380, height: 720)
        popover.contentViewController = NSHostingController(rootView: ServerPanel(model: model))
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "computermouse.fill", accessibilityDescription: "Remote Mouse")
            button.toolTip = "Remote Mouse"
            button.target = self
            button.action = #selector(clicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
    }

    @objc private func clicked(_ sender: NSStatusBarButton) {
        guard let event = NSApplication.shared.currentEvent else { return }
        switch StatusItemRoute.action(for: event.type) {
        case .panel:
            if popover.isShown { popover.performClose(nil) }
            else {
                NSApplication.shared.activate(ignoringOtherApps: true)
                popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            }
        case .quitMenu:
            popover.performClose(nil)
            let menu = NSMenu()
            let quit = NSMenuItem(title: L10n.text("button.quit"), action: #selector(quitApplication), keyEquivalent: "q")
            quit.target = self
            menu.addItem(quit)
            menu.popUp(positioning: nil, at: NSPoint(x: sender.bounds.minX, y: sender.bounds.minY), in: sender)
        case .ignore: break
        }
    }

    @objc private func quitApplication() {
        // Goes through applicationShouldTerminate and waits for our owned children.
        NSApplication.shared.terminate(nil)
    }
}
