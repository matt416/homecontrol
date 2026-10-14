import Foundation

struct BinSchedule: Codable {
    var enabled = false
    var collectionDay = 3
    var anchorDate = "2026-10-14"
    var weeks: [[String]] = [[], []]
}
struct ReminderSettings: Codable {
    var bins = BinSchedule()

    static func dateString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    static func date(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard let date = formatter.date(from: string), dateString(date) == string else { return nil }
        return date
    }
    var validationMessage: String? {
        guard let date = Self.date(bins.anchorDate), (0...6).contains(bins.collectionDay),
              Calendar(identifier: .gregorian).component(.weekday, from: date) - 1 == bins.collectionDay else {
            return "Choose a first collection date that matches the collection day."
        }
        let allowed = Set(["recycling", "trash", "green", "brown"])
        guard (1...8).contains(bins.weeks.count), bins.weeks.allSatisfy({ Set($0).isSubset(of: allowed) && Set($0).count == $0.count }) else {
            return "The saved schedule contains unsupported values."
        }
        if bins.enabled && bins.weeks.allSatisfy({ $0.isEmpty }) { return "Choose at least one bin for the rotation." }
        return nil
    }
}
