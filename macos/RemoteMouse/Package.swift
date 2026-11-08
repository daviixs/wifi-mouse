// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RemoteMouse",
    defaultLocalization: "en",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "RemoteMouse", targets: ["RemoteMouse"])],
    targets: [
        .executableTarget(name: "RemoteMouse", resources: [.process("Resources")]),
        .testTarget(name: "RemoteMouseTests", dependencies: ["RemoteMouse"])
    ]
)
