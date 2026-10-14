// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "HomeControl",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "HomeControl", targets: ["HomeControl"])],
    targets: [
        .executableTarget(name: "HomeControl", resources: [.copy("Resources/Icons")]),
        .testTarget(name: "HomeControlTests", dependencies: ["HomeControl"])
    ]
)
