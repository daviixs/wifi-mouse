import AppKit
import Darwin
import SwiftUI

@main
@MainActor
struct RemoteMouseApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        MenuBarExtra {
            ServerPanel(model: delegate.model)
        } label: {
            Label("Remote Mouse", systemImage: "computermouse.fill")
        }
        .menuBarExtraStyle(.window)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model = AgentController()

    func applicationDidFinishLaunching(_ notification: Notification) {
        // A helper can exit between isRunning and a pipe write. Handle EPIPE,
        // rather than letting SIGPIPE terminate the menu bar app.
        signal(SIGPIPE, SIG_IGN)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        model.quit {
            DispatchQueue.main.async { sender.reply(toApplicationShouldTerminate: true) }
        }
        return .terminateLater
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}
