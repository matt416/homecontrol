import Foundation
import Combine

struct PhotoPlaybackSettings: Codable, Equatable {
    enum Order: String, Codable { case random, custom }
    var durationSeconds: Double = 15
    var transitionSeconds: Double = 0.22
    var order: Order = .random

    var validationMessage: String? {
        guard durationSeconds.isFinite, (1...3600).contains(durationSeconds) else { return "Time per photo must be between 1 and 3,600 seconds." }
        guard transitionSeconds.isFinite, (0...5).contains(transitionSeconds), transitionSeconds < durationSeconds else {
            return "Transition time must be 0–5 seconds and shorter than the time per photo."
        }
        return nil
    }
}

@MainActor final class PhotoPlaybackSettingsModel: ObservableObject {
    @Published var durationText = "15" { didSet { message = nil } }
    @Published var transitionText = "0.22" { didSet { message = nil } }
    @Published var order: PhotoPlaybackSettings.Order = .random { didSet { message = nil } }
    @Published var message: String?
    @Published var loadFailed = false
    @Published private(set) var saved = PhotoPlaybackSettings()

    var draft: PhotoPlaybackSettings? {
        guard let duration = Double(durationText.trimmingCharacters(in: .whitespaces)),
              let transition = Double(transitionText.trimmingCharacters(in: .whitespaces)) else { return nil }
        return PhotoPlaybackSettings(durationSeconds: duration, transitionSeconds: transition, order: order)
    }
    var validationMessage: String? { draft?.validationMessage ?? (draft == nil ? "Enter a number of seconds for each time." : nil) }
    var hasChanges: Bool { draft != saved }

    func load(folder: URL?) {
        guard let folder else { loadFailed = true; message = "Choose your frame folder in Settings first."; return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let file = folder.appendingPathComponent("photo-settings.json")
            var settings = PhotoPlaybackSettings()
            if FileManager.default.fileExists(atPath: file.path) {
                let data = try Data(contentsOf: file)
                guard data.count <= 4096 else { throw CocoaError(.fileReadCorruptFile) }
                settings = try JSONDecoder().decode(PhotoPlaybackSettings.self, from: data)
                guard settings.validationMessage == nil else { throw CocoaError(.fileReadCorruptFile) }
            }
            saved = settings
            durationText = Self.seconds(settings.durationSeconds)
            transitionText = Self.seconds(settings.transitionSeconds)
            order = settings.order
            loadFailed = false
            message = nil
        } catch {
            loadFailed = true
            message = "Could not read the slideshow settings. Reopen Photos to try again."
        }
    }

    func save(folder: URL?) {
        guard !loadFailed, let folder, let settings = draft, settings.validationMessage == nil else { return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let file = folder.appendingPathComponent("photo-settings.json")
            try encoder.encode(settings).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            saved = settings
            message = "Saved. Connected viewers update within 15 seconds."
        } catch { message = "Could not save the slideshow settings. Check access to the frame folder." }
    }

    private static func seconds(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}
