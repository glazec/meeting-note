// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MeetingNoteLocalRecorder",
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "MeetingNoteLocalRecorder", targets: ["MeetingNoteLocalRecorder"]),
        .library(name: "LocalRecorderCore", targets: ["LocalRecorderCore"]),
    ],
    targets: [
        .target(name: "LocalRecorderCore"),
        .executableTarget(
            name: "MeetingNoteLocalRecorder",
            dependencies: ["LocalRecorderCore"]
        ),
        .testTarget(
            name: "LocalRecorderCoreTests",
            dependencies: ["LocalRecorderCore"]
        ),
    ]
)
