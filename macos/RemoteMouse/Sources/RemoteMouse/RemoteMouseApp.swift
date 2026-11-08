import AppKit
import Darwin
import SwiftUI

@main
@MainActor
struct RemoteMouseApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        Settings { EmptyView() } // NSStatusItem owns left/right click routing.
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AgentController()
    private var statusBar: StatusBarController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // A helper can exit between isRunning and a pipe write. Handle EPIPE,
        // rather than letting SIGPIPE terminate the menu bar app.
        signal(SIGPIPE, SIG_IGN)
        statusBar = StatusBarController(model: model)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        model.quit {
            DispatchQueue.main.async { sender.reply(toApplicationShouldTerminate: true) }
        }
        return .terminateLater
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}
