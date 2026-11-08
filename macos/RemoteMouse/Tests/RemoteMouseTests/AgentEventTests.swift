import Foundation
import XCTest
@testable import RemoteMouse

final class AgentEventTests: XCTestCase {
    func testReadyIncludesActualHelperPermissionAndAddresses() throws {
        let event = try XCTUnwrap(AgentEvent.parse(#"REMOTE_MOUSE_EVENT {"event":"ready","port":8765,"addresses":["192.168.1.10"],"name":"Meu Mac","mdns":true,"accessibility":false}"#))
        XCTAssertEqual(event.port, 8765)
        XCTAssertEqual(event.addresses, ["192.168.1.10"])
        XCTAssertEqual(event.accessibility, false)
    }

    func testLogsMalformedDataAndInvalidPortsAreIgnored() {
        XCTAssertNil(AgentEvent.parse("Conexão recebida de 192.168.1.2"))
        XCTAssertNil(AgentEvent.parse("REMOTE_MOUSE_EVENT {"))
        XCTAssertNil(AgentEvent.parse(#"REMOTE_MOUSE_EVENT {"event":"ready","port":99999}"#))
    }

    func testSplitUTF8AndMultipleLines() {
        var buffer = LineBuffer()
        let data = Data("Conexão\nsegunda\n".utf8)
        XCTAssertEqual(buffer.append(data.prefix(6)), [])
        XCTAssertEqual(buffer.append(data.dropFirst(6)), ["Conexão", "segunda"])
    }

    func testBufferCapsUnterminatedLinesAndRecovers() {
        var buffer = LineBuffer()
        XCTAssertEqual(buffer.append(Data(repeating: 65, count: 70_000)), [])
        XCTAssertEqual(buffer.append(Data("ok\n".utf8)), ["ok"])
    }

    func testClientAndPermissionEvents() {
        XCTAssertEqual(AgentEvent.parse(#"REMOTE_MOUSE_EVENT {"event":"client","connected":true}"#)?.connected, true)
        XCTAssertEqual(AgentEvent.parse(#"REMOTE_MOUSE_EVENT {"event":"permission","accessibility":true}"#)?.accessibility, true)
    }
}
