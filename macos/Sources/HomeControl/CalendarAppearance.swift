import AppKit
import Foundation

struct CalendarSource: Identifiable {
    let id: String
    let title: String
    let account: String
    let colorHex: String
}

struct CalendarAppearance: Codable, Equatable {
    var displayName = ""
    var colorHex: String?

    var frameName: String? {
        var name = displayName.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        while name.utf16.count > 80 { name.removeLast() }
        return name.isEmpty ? nil : name
    }
    func frameColor(fallback: String) -> String {
        guard let colorHex, Self.color(from: colorHex) != nil else { return fallback }
        return colorHex.uppercased()
    }
    static func color(from hex: String) -> NSColor? {
        guard hex.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil,
              let rgb = UInt32(hex.dropFirst(), radix: 16) else { return nil }
        return NSColor(srgbRed: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255, blue: CGFloat(rgb & 255) / 255, alpha: 1)
    }
    static func hex(from color: NSColor) -> String {
        guard let rgb = color.usingColorSpace(.sRGB) else { return "#95D9FF" }
        return String(format: "#%02X%02X%02X", Int((rgb.redComponent * 255).rounded()), Int((rgb.greenComponent * 255).rounded()), Int((rgb.blueComponent * 255).rounded()))
    }
    static func load(from defaults: UserDefaults = .standard) -> [String: Self] {
        guard let data = defaults.data(forKey: "calendarAppearances") else { return [:] }
        return (try? JSONDecoder().decode([String: Self].self, from: data)) ?? [:]
    }
    static func save(_ appearances: [String: Self], to defaults: UserDefaults = .standard) {
        defaults.set(try? JSONEncoder().encode(appearances), forKey: "calendarAppearances")
    }
}
