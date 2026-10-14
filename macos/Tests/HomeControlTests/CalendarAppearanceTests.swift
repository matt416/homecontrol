import XCTest
@testable import HomeControl

final class CalendarAppearanceTests: XCTestCase {
    func testOptionalNamesAndColors() {
        XCTAssertNil(CalendarAppearance(displayName: " \n ").frameName)
        XCTAssertEqual(CalendarAppearance(displayName: "  Laura \n Smith ").frameName, "Laura Smith")
        XCTAssertLessThanOrEqual(CalendarAppearance(displayName: String(repeating: "👩🏽‍💻", count: 80)).frameName!.utf16.count, 80)
        XCTAssertEqual(CalendarAppearance(colorHex: "#aabbcc").frameColor(fallback: "#112233"), "#AABBCC")
        XCTAssertEqual(CalendarAppearance(colorHex: "red").frameColor(fallback: "#112233"), "#112233")
    }
    func testPreferencesStayWithCalendarIdentity() {
        let suite = "CalendarAppearanceTests-\(UUID())"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let choices = ["calendar-one": CalendarAppearance(displayName: "Laura", colorHex: "#AABBCC"), "calendar-two": CalendarAppearance(displayName: "Alex")]
        CalendarAppearance.save(choices, to: defaults)
        XCTAssertEqual(CalendarAppearance.load(from: defaults), choices)
        XCTAssertNil(CalendarAppearance.load(from: defaults)["another-calendar"])
    }
}
