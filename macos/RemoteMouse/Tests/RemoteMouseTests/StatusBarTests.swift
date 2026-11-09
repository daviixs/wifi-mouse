import AppKit
import XCTest
@testable import RemoteMouse

final class StatusBarTests: XCTestCase {
    func testClickRoutingDoesNotDependOnPermissionOrServerState() {
        XCTAssertEqual(StatusItemRoute.action(for: .leftMouseUp), .panel)
        XCTAssertEqual(StatusItemRoute.action(for: .rightMouseUp), .quitMenu)
        XCTAssertEqual(StatusItemRoute.action(for: .leftMouseDown), .ignore)
        XCTAssertEqual(StatusItemRoute.action(for: .mouseMoved), .ignore)
        XCTAssertEqual(StatusItemRoute.action(for: .otherMouseUp), .ignore)
    }

    func testQuitWaitsForBothOwnedChildrenRatherThanJustTheServer() {
        for quitting in [false, true] {
            for server in [false, true] {
                for probe in [false, true] {
                    XCTAssertEqual(AgentController.canFinishQuit(quitting: quitting, hasServer: server, hasProbe: probe),
                                   quitting && !server && !probe)
                }
            }
        }
    }

    @MainActor
    func testStartupAndReopenDoNotRequestStandaloneWindows() {
        let model = AgentController(monitorPermission: false)
        let delegate = AppDelegate(model: model)
        let application = NSApplication.shared
        XCTAssertFalse(delegate.applicationShouldOpenUntitledFile(application))
        XCTAssertFalse(delegate.applicationOpenUntitledFile(application))
        XCTAssertFalse(delegate.applicationShouldHandleReopen(application, hasVisibleWindows: false))
        XCTAssertFalse(delegate.applicationShouldHandleReopen(application, hasVisibleWindows: true))
        XCTAssertFalse(delegate.applicationShouldTerminateAfterLastWindowClosed(application))
        XCTAssertTrue(model.permissionBlocked) // startup policy does not grant permission
    }

    @MainActor
    func testOldWindowRestorationCompletesWithoutCreatingAWindow() {
        var completions = 0
        let handled = RemoteMouseApplication.skipWindowRestoration { window, error in
            completions += 1
            XCTAssertNil(window)
            XCTAssertNil(error)
        }
        XCTAssertTrue(handled)
        XCTAssertEqual(completions, 1)
    }

    @MainActor
    func testQuitCompletesWithoutAnAgentAndStartCannotBypassUnknownPermission() {
        let model = AgentController(monitorPermission: false)
        XCTAssertTrue(model.permissionBlocked)
        model.start()
        XCTAssertEqual(model.phase, .stopped)
        var completions = 0
        model.quit { completions += 1 }
        XCTAssertEqual(completions, 1)
        model.refreshPermission() // quitting cannot launch another probe
        model.start()
        XCTAssertEqual(model.phase, .stopped)
    }
}
