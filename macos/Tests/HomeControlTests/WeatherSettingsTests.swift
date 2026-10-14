import XCTest
@testable import HomeControl

final class WeatherSettingsTests: XCTestCase {
    func testDisabledWeatherNeedsNoLocationButEnabledWeatherDoes() {
        var settings = WeatherSettings()
        XCTAssertNil(settings.validationMessage)
        settings.enabled = true
        XCTAssertNotNil(settings.validationMessage)
        settings.label = "London"
        XCTAssertNil(settings.validationMessage)
        settings.latitude = 91
        XCTAssertNotNil(settings.validationMessage)
        settings.latitude = 51.5
        settings.timezone = "Not/A_Timezone"
        XCTAssertNotNil(settings.validationMessage)
    }
    @MainActor func testSaveRoundTripsUnitsAndCoordinatesAndRejectsCorruptFile() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }
        let model = WeatherSettingsModel()
        model.load(folder: folder)
        model.draft = WeatherSettings(enabled: true, label: "London", latitude: 51.5, longitude: -0.12, timezone: "Europe/London", temperatureUnit: .fahrenheit)
        model.save(folder: folder)
        let next = WeatherSettingsModel()
        next.load(folder: folder)
        XCTAssertEqual(next.draft, model.draft)
        let file = folder.appendingPathComponent("weather-settings.json")
        try Data("broken".utf8).write(to: file)
        next.load(folder: folder)
        XCTAssertTrue(next.loadFailed)
        next.save(folder: folder)
        XCTAssertEqual(try String(contentsOf: file), "broken")
    }
}
