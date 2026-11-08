// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RemoteMouse",
    platforms: [.macOS(.v13)],
    products: [.executable(name: "RemoteMouse", targets: ["RemoteMouse"])],
    targets: [
        .executableTarget(name: "RemoteMouse"),
        .testTarget(name: "RemoteMouseTests", dependencies: ["RemoteMouse"])
    ]
)
