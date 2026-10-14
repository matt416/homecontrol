import XCTest
@testable import HomeControl

final class PhotoPlaybackSettingsTests: XCTestCase {
    func testDurationIncludesTransitionAndRejectsInvalidTimes() {
        XCTAssertNil(PhotoPlaybackSettings().validationMessage)
        XCTAssertNil(PhotoPlaybackSettings(durationSeconds: 1, transitionSeconds: 0, order: .custom).validationMessage)
        XCTAssertNotNil(PhotoPlaybackSettings(durationSeconds: 1, transitionSeconds: 1).validationMessage)
        XCTAssertNotNil(PhotoPlaybackSettings(durationSeconds: .infinity).validationMessage)
        XCTAssertNotNil(PhotoPlaybackSettings(transitionSeconds: -0.1).validationMessage)
    }

    @MainActor func testSaveReloadAndInvalidInputPreserveSharedSettings() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let model = PhotoPlaybackSettingsModel()
        model.load(folder: folder)
        model.durationText = "20"
        model.transitionText = "0.4"
        model.order = .custom
        model.save(folder: folder)
        let file = folder.appendingPathComponent("photo-settings.json")
        let saved = try Data(contentsOf: file)
        let restored = PhotoPlaybackSettingsModel()
        restored.load(folder: folder)
        XCTAssertEqual(restored.draft, PhotoPlaybackSettings(durationSeconds: 20, transitionSeconds: 0.4, order: .custom))
        restored.durationText = "not a number"
        restored.save(folder: folder)
        XCTAssertNotNil(restored.validationMessage)
        XCTAssertEqual(try Data(contentsOf: file), saved)
        XCTAssertEqual((try FileManager.default.attributesOfItem(atPath: file.path)[.posixPermissions] as? NSNumber)?.intValue, 0o600)
    }

    @MainActor func testMalformedExistingSettingsAreNotOverwritten() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let file = folder.appendingPathComponent("photo-settings.json")
        let original = Data("broken".utf8)
        try original.write(to: file)
        let model = PhotoPlaybackSettingsModel()
        model.load(folder: folder)
        XCTAssertTrue(model.loadFailed)
        model.save(folder: folder)
        XCTAssertEqual(try Data(contentsOf: file), original)
    }
}
