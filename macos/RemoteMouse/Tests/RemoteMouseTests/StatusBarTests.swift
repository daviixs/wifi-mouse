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
