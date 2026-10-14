import XCTest
@testable import HomeControl

final class ReminderSettingsTests: XCTestCase {
    func testExistingSchedulesKeepTheirRotationWhenLegacyVisibilityFieldsAreRemoved() throws {
        let json = #"{"bins":{"enabled":true,"collectionDay":3,"anchorDate":"2026-10-14","weeks":[["recycling","green"],["trash","brown"]],"showDayBefore":true,"dayBeforeHour":18,"collectionEndHour":12},"plants":{"enabled":true,"days":[1],"startHour":6}}"#
        let settings = try JSONDecoder().decode(ReminderSettings.self, from: Data(json.utf8))
        XCTAssertNil(settings.validationMessage)
        XCTAssertEqual(settings.bins.weeks, [["recycling", "green"], ["trash", "brown"]])
        let encoded = try JSONEncoder().encode(settings)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        XCTAssertNil(object["plants"])
        let bins = try XCTUnwrap(object["bins"] as? [String: Any])
        XCTAssertNil(bins["showDayBefore"])
        XCTAssertNil(bins["dayBeforeHour"])
        XCTAssertNil(bins["collectionEndHour"])
        let restored = try JSONDecoder().decode(ReminderSettings.self, from: encoded)
        XCTAssertEqual(restored.bins.weeks, settings.bins.weeks)
    }
}
