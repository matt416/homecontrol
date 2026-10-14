import Foundation
import Combine

struct WeatherSettings: Codable, Equatable {
    enum Unit: String, Codable, CaseIterable { case celsius, fahrenheit }
    var enabled = false
    var label = ""
    var latitude = 0.0
    var longitude = 0.0
    var timezone = TimeZone.current.identifier
    var temperatureUnit: Unit = .celsius

    var validationMessage: String? {
        guard latitude.isFinite, longitude.isFinite, (-90...90).contains(latitude), (-180...180).contains(longitude) else {
            return "Latitude must be −90 to 90, and longitude −180 to 180."
        }
        guard TimeZone(identifier: timezone) != nil else { return "Choose a valid timezone, such as Europe/London." }
        guard label.count <= 80, !enabled || !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return "Enter a location name of up to 80 characters."
        }
        return nil
    }
}

struct WeatherLocation: Decodable, Identifiable {
    let id: Int
    let name: String
    let latitude: Double
    let longitude: Double
    let timezone: String?
    let admin1: String?
    let country: String?
    var title: String { [name, admin1, country].compactMap { $0 }.joined(separator: ", ") }
}

@MainActor final class WeatherSettingsModel: ObservableObject {
    @Published var draft = WeatherSettings() { didSet { message = nil } }
    @Published var query = ""
    @Published var locations: [WeatherLocation] = []
    @Published var searching = false
    @Published var loadFailed = false
    @Published var message: String?
    @Published var searchMessage: String?

    func load(folder: URL?) {
        guard let folder else { loadFailed = true; message = "Choose a frame folder in Settings."; return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let file = folder.appendingPathComponent("weather-settings.json")
            var value = WeatherSettings()
            if FileManager.default.fileExists(atPath: file.path) {
                let data = try Data(contentsOf: file)
                guard data.count <= 4096 else { throw CocoaError(.fileReadCorruptFile) }
                value = try JSONDecoder().decode(WeatherSettings.self, from: data)
                guard value.validationMessage == nil else { throw CocoaError(.fileReadCorruptFile) }
            }
            draft = value
            loadFailed = false
        } catch { loadFailed = true; message = "Could not read weather settings. Check the frame folder and reopen Weather." }
    }
    func search() async {
        guard !searching else { return }
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard term.count >= 2 else { searchMessage = "Enter at least two characters."; return }
        searching = true; searchMessage = nil; locations = []
        defer { searching = false }
        do {
            var url = URLComponents(string: "https://geocoding-api.open-meteo.com/v1/search")!
            url.queryItems = [URLQueryItem(name: "name", value: term), URLQueryItem(name: "count", value: "5"), URLQueryItem(name: "language", value: "en")]
            var request = URLRequest(url: url.url!); request.timeoutInterval = 10
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 100_000 else { throw URLError(.badServerResponse) }
            struct Results: Decodable { let results: [WeatherLocation]? }
            locations = try JSONDecoder().decode(Results.self, from: data).results ?? []
            if locations.isEmpty { searchMessage = "No matching places. Try a nearby city or enter coordinates below." }
        } catch { searchMessage = "Search is unavailable. Try again, or enter coordinates below." }
    }
    func select(_ location: WeatherLocation) {
        draft.label = String(location.title.prefix(80))
        draft.latitude = location.latitude
        draft.longitude = location.longitude
        draft.timezone = location.timezone ?? TimeZone.current.identifier
        draft.enabled = true
        locations = []
        searchMessage = nil
    }
    func save(folder: URL?) {
        guard !loadFailed, let folder else { return }
        if let error = draft.validationMessage { message = error; return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let file = folder.appendingPathComponent("weather-settings.json")
            try encoder.encode(draft).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            message = "Saved. Your frame updates within one minute."
        } catch { message = "Could not save weather settings. Check access to the frame folder." }
    }
}
