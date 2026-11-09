import AppKit
import Darwin

/// This is an AppKit status-only application, not a SwiftUI App/Scene.
/// SwiftUI is hosted solely inside StatusBarController's popover.
@main
@MainActor
enum RemoteMouseApp {
    static func main() {
        let application = RemoteMouseApplication.shared
        application.setActivationPolicy(.accessory)
        let delegate = AppDelegate()
        application.delegate = delegate // NSApplication's delegate is weak
        withExtendedLifetime(delegate) { application.run() }
    }
}

/// Public AppKit restoration funnel: old versions registered an empty settings
/// scene. This app has no standalone windows to restore, including old archives.
@objc(RemoteMouseApplication)
@MainActor
final class RemoteMouseApplication: NSApplication {
    override func restoreWindow(withIdentifier identifier: NSUserInterfaceItemIdentifier,
                                state: NSCoder,
                                completionHandler: @escaping (NSWindow?, Error?) -> Void) -> Bool {
        Self.skipWindowRestoration(completionHandler: completionHandler)
    }

    static func skipWindowRestoration(completionHandler: (NSWindow?, Error?) -> Void) -> Bool {
        // A handled request MUST complete, even when no window is restored.
        completionHandler(nil, nil)
        return true
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let model: AgentController

    init(model: AgentController) {
        self.model = model
        super.init()
    }

    override convenience init() { self.init(model: AgentController()) }
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

    // Reopen/default launch must not manufacture an untitled or settings window.
    // These callbacks do not enumerate, close or alter any existing window.
    func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool { false }
    func applicationOpenUntitledFile(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { false }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}
