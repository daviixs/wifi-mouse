import Foundation

/// Private stdout messages from our bundled helper, not the mobile protocol.
struct AgentEvent: Decodable, Sendable {
    let event: String
    let port: UInt16?
    let addresses: [String]?
    let name: String?
    let mdns: Bool?
    let accessibility: Bool?
    let connected: Bool?

    static func parse(_ line: String) -> AgentEvent? {
        let prefix = "REMOTE_MOUSE_EVENT "
        guard line.hasPrefix(prefix),
              let data = String(line.dropFirst(prefix.count)).data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }
}

/// Pipe chunks can split UTF-8 sequences or contain several lines.
struct LineBuffer {
    private var data = Data()
    mutating func append(_ chunk: Data) -> [String] {
        data.append(chunk)
        var lines: [String] = []
        while let end = data.firstIndex(of: 10) {
            lines.append(String(decoding: data[..<end], as: UTF8.self))
            data.removeSubrange(...end)
        }
        if data.count > 65_536 { data.removeAll(keepingCapacity: false) }
        return lines
    }
}

/// Owns mutable framing state on one queue, never in a captured mutable closure.
final class AgentOutputReader: @unchecked Sendable {
    private let queue = DispatchQueue(label: "remote-mouse.helper-output")
    private var buffer = LineBuffer()

    func append(_ data: Data, receive: @escaping @Sendable (AgentEvent) -> Void) {
        queue.async {
            for line in self.buffer.append(data) {
                if let event = AgentEvent.parse(line) { receive(event) }
            }
        }
    }
}
