import Foundation

struct SourceStatus: Codable {
    let state: String
    let message: String
}
struct FrameEvent: Codable, Identifiable {
    let id: String
    let title: String
    let calendar: String
    let start: String
    let end: String
    let allDay: Bool
    let startDay: String
    let endDay: String
    var calendarColor: String? = nil
    var calendarDisplayName: String? = nil
}
struct FramePhoto: Codable, Identifiable {
    let id: String
    let caption: String
    let album: String
}
struct Snapshot: Encodable {
    let version = 1
    let generatedAt: String
    let calendarRevision: String
    let calendarStatus: SourceStatus
    let photoStatus: SourceStatus
    let events: [FrameEvent]
    let photos: [FramePhoto]
}

struct CalendarMonthPage: Encodable {
    let month: String
    let generatedAt: String
    let revision: String
    let status: SourceStatus
    let events: [FrameEvent]
}
