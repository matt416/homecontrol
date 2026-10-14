import Foundation
import Combine

@MainActor final class ReminderSettingsModel: ObservableObject {
    @Published var draft = ReminderSettings() { didSet { message = nil } }
    @Published var message: String?
    @Published var loadFailed = false
    @Published var saved = false

    func load(folder: URL?) {
        saved = false
        loadFailed = false
        guard let folder else { message = "Choose your frame folder in Settings → Advanced first."; return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let file = folder.appendingPathComponent("reminder-settings.json")
        do {
            if !FileManager.default.fileExists(atPath: file.path) {
                var initial = ReminderSettings()
                let calendar = Calendar(identifier: .gregorian)
                let days = (3 - (calendar.component(.weekday, from: Date()) - 1) + 7) % 7
                initial.bins.anchorDate = ReminderSettings.dateString(calendar.date(byAdding: .day, value: days, to: Date())!)
                draft = initial
                return
            }
            let data = try Data(contentsOf: file)
            guard data.count <= 16_384 else { throw CocoaError(.fileReadCorruptFile) }
            let settings = try JSONDecoder().decode(ReminderSettings.self, from: data)
            guard settings.validationMessage == nil else { throw CocoaError(.fileReadCorruptFile) }
            draft = settings
        } catch {
            loadFailed = true
            message = "Could not read your reminder schedule. Check the frame folder, then reopen this window."
        }
    }
    func save(folder: URL?) {
        saved = false
        guard !loadFailed else { return }
        if let error = draft.validationMessage { message = error; return }
        guard let folder else { message = "Choose your frame folder in Settings → Advanced first."; return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(draft).write(to: folder.appendingPathComponent("reminder-settings.json"), options: .atomic)
            saved = true
            message = "Saved. Your frame will update within 15 seconds."
        } catch { message = "Could not save. Check that HomeControl has access to the frame folder." }
    }
    func setCollectionDay(_ day: Int) {
        let calendar = Calendar(identifier: .gregorian)
        let current = ReminderSettings.date(draft.bins.anchorDate) ?? Date()
        let offset = (day - (calendar.component(.weekday, from: current) - 1) + 7) % 7
        draft.bins.collectionDay = day
        draft.bins.anchorDate = ReminderSettings.dateString(calendar.date(byAdding: .day, value: offset, to: current)!)
    }
    func setAnchorDate(_ date: Date) {
        draft.bins.anchorDate = ReminderSettings.dateString(date)
        draft.bins.collectionDay = Calendar(identifier: .gregorian).component(.weekday, from: date) - 1
    }
    func setWeekCount(_ count: Int) {
        if count > draft.bins.weeks.count { draft.bins.weeks += Array(repeating: [], count: count - draft.bins.weeks.count) }
        else { draft.bins.weeks = Array(draft.bins.weeks.prefix(count)) }
    }
}
