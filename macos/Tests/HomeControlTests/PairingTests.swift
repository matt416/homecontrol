import XCTest
@testable import HomeControl

final class PairingTests: XCTestCase {
    @MainActor func testFormatsEightDigitsAndClearsUnavailableCodes() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let file = folder.appendingPathComponent(".homeframe-pairing.json")
        let contents = ["code": "00123456", "token": String(repeating: "t", count: 64),
                        "address": "http://127.0.0.1:8797", "expiresAt": formatter.string(from: Date().addingTimeInterval(600))]
        try JSONSerialization.data(withJSONObject: contents).write(to: file)
        let model = CompanionModel(loadSources: false)
        model.output = folder
        XCTAssertNotNil(model.readPairingToken())
        XCTAssertEqual(model.formattedPairingCode, "0012-3456")
        try FileManager.default.removeItem(at: file)
        XCTAssertNil(model.readPairingToken())
        XCTAssertNil(model.formattedPairingCode)
    }
}
