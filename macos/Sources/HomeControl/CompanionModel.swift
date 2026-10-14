import AppKit
import Combine
import EventKit
import Photos
import SwiftUI

@MainActor final class CompanionModel: ObservableObject {
    var isDemo: Bool { ProcessInfo.processInfo.environment["HOMECONTROL_DEMO"] == "1" }
    @Published var libraryPhotos: [FramePhoto] = []
    @Published var photoSelection = FramePhotoSelection.load()
    @Published var calendars: [CalendarSource] = []
    @Published var calendarAppearances: [String: CalendarAppearance] = [:] {
        didSet {
            if !isDemo { CalendarAppearance.save(calendarAppearances) }
            calendarRevision = UUID().uuidString
            scheduleSync()
        }
    }
    @Published var albums: [PHAssetCollection] = []
    @Published var selectedCalendars: Set<String> = [] {
        didSet {
            calendarRevision = UUID().uuidString
            if !isDemo { UserDefaults.standard.set(Array(selectedCalendars), forKey: "calendarIDs") }
            scheduleSync()
        }
    }
    @Published var selectedAlbum = "" {
        didSet {
            UserDefaults.standard.set(selectedAlbum, forKey: "albumID")
            scheduleSync()
        }
    }
    @Published var output: URL?
    @Published var busy = false
    @Published var message = "Select what you want to see, then start sharing."
    @Published var automatic = false {
        didSet { UserDefaults.standard.set(automatic, forKey: "automatic") }
    }
    @Published var calendarAccess = false
    @Published var photoAccess = false
    @Published var lastUpdated: Date?
    @Published var eventCount = 0
    @Published var photoCount = 0
    @Published var issue: String?
    @Published var pairingMessage: String?
    @Published var pairingAddress: String?
    @Published var pairingCode: String?
    var formattedPairingCode: String? {
        pairingCode.map { String($0.prefix(4)) + "-" + String($0.suffix(4)) }
    }
    @Published var pairingExpiresAt: Date?
    private struct PairingDetails: Decodable { let token: String; let address: String; let code: String?; let expiresAt: String? }

    func newPairingCode() async {
        guard let token = readPairingToken() else { return }
        do {
            var request = URLRequest(url: localFrameURL.appendingPathComponent("api/pairing-code"))
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 5
            let (_, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            _ = readPairingToken()
        } catch { pairingMessage = "Could not create a code. Check that the frame server is running." }
    }
    func copyPairingCode() {
        _ = readPairingToken()
        guard let code = formattedPairingCode else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        pairingMessage = "Code copied."
    }

    func readPairingToken() -> String? {
        guard let folder = output else {
            pairingMessage = "Choose your frame folder in Advanced first."
            return nil
        }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let file = folder.appendingPathComponent(".homeframe-pairing.json")
            let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size > 0, size <= 8192 else { throw CocoaError(.fileReadCorruptFile) }
            let details = try JSONDecoder().decode(PairingDetails.self, from: Data(contentsOf: file))
            guard details.token.count >= 32, details.token.count <= 1024,
                  let address = URL(string: details.address),
                  ["http", "https"].contains(address.scheme ?? ""), address.host != nil,
                  address.user == nil, address.password == nil else { throw CocoaError(.fileReadCorruptFile) }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            pairingExpiresAt = details.expiresAt.flatMap { formatter.date(from: $0) }
            pairingCode = details.code.flatMap { $0.range(of: "^[0-9]{8}$", options: .regularExpression) == nil ? nil : $0 }
            if (pairingExpiresAt ?? .distantPast) <= Date() { pairingCode = nil }
            pairingAddress = details.address
            pairingMessage = nil
            return details.token
        } catch {
            pairingCode = nil
            pairingExpiresAt = nil
            pairingAddress = nil
            pairingMessage = "Pairing details unavailable. The local server is starting. Check its status below if this continues."
            return nil
        }
    }

    @Published var serverStatus = "Checking…"
    private var monitoring = Set<AnyCancellable>()
    private var serverCheckRunning = false
    private let store = EKEventStore()
    private var calendarRevision = UUID().uuidString

    var sharingStatus: String {
        if busy { return "Updating…" }
        if (!selectedCalendars.isEmpty && !calendarAccess) || (!selectedAlbum.isEmpty && !photoAccess) { return "Access needed" }
        if !automatic { return "Paused" }
        if output == nil { return "Choose a folder" }
        if issue != nil { return "Needs attention" }
        return "Automatic"
    }
    var needsAttention: Bool {
        serverStatus != "Running" || issue != nil || output == nil || (!selectedCalendars.isEmpty && !calendarAccess) || (!selectedAlbum.isEmpty && !photoAccess)
    }
    var localFrameURL: URL {
        if LocalServer.shared.enabled { return LocalServer.shared.localURL }
        let details = output.flatMap { try? Data(contentsOf: $0.appendingPathComponent(".homeframe-pairing.json")) }
            .flatMap { try? JSONDecoder().decode(PairingDetails.self, from: $0) }
        let port = details.flatMap { URL(string: $0.address)?.port } ?? 8797
        return URL(string: "http://127.0.0.1:\(port)")!
    }
    func openFrame() {
        _ = readPairingToken()
        let address = pairingAddress ?? (Bundle.main.object(forInfoDictionaryKey: "HomeControlPublicURL") as? String ?? "http://127.0.0.1:8797/")
        if let url = URL(string: address) { NSWorkspace.shared.open(url) }
    }
    private func checkServer() async {
        if LocalServer.shared.enabled {
            await LocalServer.shared.refresh()
            serverStatus = LocalServer.shared.status
            return
        }
        guard !serverCheckRunning else { return }
        serverCheckRunning = true
        defer { serverCheckRunning = false }
        do {
            var request = URLRequest(url: localFrameURL.appendingPathComponent("healthz"))
            request.timeoutInterval = 4
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            let health = try JSONDecoder().decode([String: Bool].self, from: data)
            serverStatus = (response as? HTTPURLResponse)?.statusCode == 200 && health["ok"] == true ? "Running" : "Unavailable"
        } catch { serverStatus = "Offline" }
    }
    private func startMonitoring() {
        Timer.publish(every: 2, on: .main, in: .common).autoconnect()
            .sink { [weak self] _ in guard let self else { return }; self.processCalendarRequests() }.store(in: &monitoring)

        Timer.publish(every: 300, on: .main, in: .common).autoconnect()
            .sink { [weak self] _ in
                guard let self, self.automatic else { return }
                Task { await self.export() }
            }.store(in: &monitoring)
        Timer.publish(every: 15, on: .main, in: .common).autoconnect()
            .sink { [weak self] _ in Task { await self?.checkServer() } }.store(in: &monitoring)
        NotificationCenter.default.publisher(for: .EKEventStoreChanged)
            .receive(on: RunLoop.main).sink { [weak self] _ in self?.sourcesDidChange() }.store(in: &monitoring)
        Task { await checkServer(); await resumeIfNeeded() }
    }

    private var photoObserver: PhotoChangeObserver?
    private var syncTask: Task<Void, Never>?
    private var syncAgain = false

    init(loadSources: Bool = true) {
        guard loadSources else { return }
        if isDemo {
            output = suggestedFolder
            calendars = [CalendarSource(id: "sample-home", title: "Home", account: "Sample calendars", colorHex: "#95D9FF"), CalendarSource(id: "sample-personal", title: "Personal", account: "Sample calendars", colorHex: "#F8B0D2")]
            selectedCalendars = Set(calendars.map(\.id))
            calendarAppearances = ["sample-home": CalendarAppearance(displayName: "Laura", colorHex: "#95D9FF"), "sample-personal": CalendarAppearance(displayName: "Alex", colorHex: "#F8B0D2")]
            loadPhotoCatalog()
            message = "Sample content for the open-source spike."
            Task { await checkServer() }
            return
        }
        let defaults = UserDefaults.standard
        selectedCalendars = Set(defaults.stringArray(forKey: "calendarIDs") ?? [])
        calendarAppearances = CalendarAppearance.load(from: defaults)
        selectedAlbum = defaults.string(forKey: "albumID") ?? ""
        automatic = defaults.bool(forKey: "automatic")
        if let bookmark = defaults.data(forKey: "exportFolderBookmark") {
            do {
                var stale = false
                let restored = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope], relativeTo: nil, bookmarkDataIsStale: &stale)
                output = restored
                if stale { saveFolder(restored) }
            } catch { issue = "Your frame folder has moved. Choose it again in Advanced." }
        }
        if output == nil, let folder = suggestedFolder {
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                output = folder
            } catch { issue = "Could not create the frame folder. Choose a folder in Settings." }
        }
        loadPhotoCatalog()
        reloadSources()
        LocalServer.shared.$status.sink { [weak self] status in self?.serverStatus = status }.store(in: &monitoring)
        if let output { Task { await LocalServer.shared.start(exportFolder: output) } }
        startMonitoring()
    }

    var canStartSharing: Bool {
        let hasCalendar = calendarAccess && calendars.contains { selectedCalendars.contains($0.id) }
        let hasAlbum = photoAccess && albums.contains { $0.localIdentifier == selectedAlbum }
        return !busy && (hasCalendar || hasAlbum)
    }

    var selectedAlbumName: String? { albums.first { $0.localIdentifier == selectedAlbum }?.localizedTitle }

    var selectionSummary: String {
        let count = calendars.filter { selectedCalendars.contains($0.id) }.count
        let albumName = albums.first { $0.localIdentifier == selectedAlbum }?.localizedTitle
        return "\(count) \(count == 1 ? "calendar" : "calendars")" + (albumName.map { " · \($0)" } ?? " · no photo album yet")
    }

    var suggestedFolder: URL? {
        if let path = ProcessInfo.processInfo.environment["HOMECONTROL_DATA_DIR"] {
            return URL(fileURLWithPath: path, isDirectory: true)
        }
        return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/HomeControl Open Source/Frame", isDirectory: true)
    }

    func saveFolder(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: [.withSecurityScope], includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmark, forKey: "exportFolderBookmark")
            output = url
            Task { await LocalServer.shared.start(exportFolder: url) }
            issue = nil
        } catch { issue = "Could not remember this folder. Please choose it again." }
    }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = output ?? suggestedFolder
        panel.prompt = "Use this folder"
        panel.message = "Give HomeControl access to its frame folder. The suggested folder is already selected; click Use this folder."
        if panel.runModal() == .OK, let url = panel.url { saveFolder(url) }
    }

    enum LibraryPermission: String { case photos = "Photos", calendar = "Calendar" }
    @Published var requestingPermission = false
    @Published var permissionMessage: String?
    func permissionNeedsSettings(_ permission: LibraryPermission) -> Bool {
        switch permission {
        case .photos:
            let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            return status == .denied || status == .restricted
        case .calendar:
            let status = EKEventStore.authorizationStatus(for: .event)
            return status == .denied || status == .restricted
        }
    }
    func requestPermission(_ permission: LibraryPermission) async {
        guard !isDemo, !requestingPermission else { return }
        if permissionNeedsSettings(permission) { openPrivacySettings(permission); return }
        requestingPermission = true; permissionMessage = nil
        defer { requestingPermission = false }
        switch permission {
        case .calendar:
            do { _ = try await store.requestFullAccessToEvents() }
            catch { permissionMessage = "Calendar access could not be requested. Open Privacy Settings to allow access." }
        case .photos:
            _ = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        reloadSources()
        if permission == .photos ? !photoAccess : !calendarAccess {
            permissionMessage = "\(permission.rawValue) access is off. You can enable HomeControl in System Settings → Privacy & Security."
        } else {
            permissionMessage = nil; issue = nil
            message = permission == .photos ? "Choose the shared album to show on your frame." : "Choose the calendars to show on your frame."
        }
    }
    func openPrivacySettings(_ permission: LibraryPermission) {
        let pane = permission == .photos ? "Privacy_Photos" : "Privacy_Calendars"
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") { NSWorkspace.shared.open(url) }
    }

    private var canReadCalendar: Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(macOS 14.0, *) { return status == .fullAccess }
        return status == .authorized
    }
    private var canReadPhotos: Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .authorized || status == .limited
    }
    func reloadSources() {
        guard !isDemo else { return }
        let previousCalendarAccess = calendarAccess
        let previousPhotoAccess = photoAccess
        calendarAccess = canReadCalendar
        photoAccess = canReadPhotos
        if photoAccess && photoObserver == nil {
            let observer = PhotoChangeObserver { [weak self] in
                Task { @MainActor in self?.sourcesDidChange() }
            }
            photoObserver = observer
            PHPhotoLibrary.shared().register(observer)
        } else if !photoAccess, let observer = photoObserver {
            PHPhotoLibrary.shared().unregisterChangeObserver(observer)
            photoObserver = nil
        }
        calendars = canReadCalendar ? store.calendars(for: .event).map { source in
            CalendarSource(id: source.calendarIdentifier, title: source.title, account: source.source.title, colorHex: CalendarAppearance.hex(from: NSColor(cgColor: source.cgColor) ?? .systemBlue))
        } : []
        calendars.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        albums = []
        if canReadPhotos {
            let found = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .albumCloudShared, options: nil)
            found.enumerateObjects { album, _, _ in self.albums.append(album) }
        }
        // Returning from Privacy Settings must refresh the published feed too.
        // The library may not emit a change notification when access is restored.
        if previousCalendarAccess != calendarAccess || previousPhotoAccess != photoAccess {
            calendarRevision = UUID().uuidString
            scheduleSync()
        }
    }

    func sourcesDidChange() {
        calendarRevision = UUID().uuidString
        reloadSources()
        scheduleSync()
    }

    func scheduleSync() {
        guard automatic, output != nil else { return }
        if busy { syncAgain = true; return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 1_000_000_000) }
            catch { return }
            guard let self, self.automatic else { return }
            await self.export()
        }
    }

    func startSharing() async {
        guard canStartSharing else { return }
        if output == nil { chooseFolder() }
        guard output != nil else { message = "Sharing has not started. Choose the suggested frame folder to continue."; return }
        automatic = true
        await export()
    }

    func resumeIfNeeded() async {
        if automatic && output != nil { await export() }
    }

    func openPhotos() {
        NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Photos.app"))
    }

    func openPrivacySettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security") { NSWorkspace.shared.open(url) }
    }

    private func processCalendarRequests() {
        guard automatic, let output else { return }
        let scoped = output.startAccessingSecurityScopedResource()
        defer { if scoped { output.stopAccessingSecurityScopedResource() } }
        let requests = output.appendingPathComponent("calendar-requests", isDirectory: true)
        let pages = output.appendingPathComponent("calendar", isDirectory: true)
        guard let files = try? FileManager.default.contentsOfDirectory(at: requests, includingPropertiesForKeys: nil) else { return }
        do {
            try FileManager.default.createDirectory(at: pages, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            // Bound each main-loop pass so scrolling cannot monopolize the app.
            for file in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }).prefix(3) {
                let month = file.deletingPathExtension().lastPathComponent
                guard file.pathExtension == "json", month.range(of: "^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$", options: .regularExpression) != nil else { continue }
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = .current
                let parts = month.split(separator: "-").compactMap { Int($0) }
                guard parts.count == 2,
                      let start = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)),
                      let end = calendar.date(byAdding: .month, value: 1, to: start) else { continue }
                // Include boundary events when the frame uses a different timezone.
                let paddedStart = calendar.date(byAdding: .day, value: -2, to: start)!
                let paddedEnd = calendar.date(byAdding: .day, value: 2, to: end)!
                let (events, status) = calendarEvents(from: paddedStart, to: paddedEnd, limit: 10000)
                let page = CalendarMonthPage(month: month, generatedAt: ISO8601DateFormatter().string(from: Date()), revision: calendarRevision, status: status, events: events)
                let destination = pages.appendingPathComponent("\(month).json")
                try JSONEncoder().encode(page).write(to: destination, options: .atomic)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)
                try? FileManager.default.removeItem(at: file)
            }
            let cached = try FileManager.default.contentsOfDirectory(at: pages, includingPropertiesForKeys: [.contentModificationDateKey])
                .filter { $0.pathExtension == "json" }
                .sorted { ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) > ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast) }
            for old in cached.dropFirst(24) { try? FileManager.default.removeItem(at: old) }
        } catch { issue = "Could not load more calendar days. Check the frame folder." }
    }

    func calendarEvents(from requestedStart: Date? = nil, to requestedEnd: Date? = nil, limit: Int = 2000) -> ([FrameEvent], SourceStatus) {
        if isDemo, let output,
           let data = try? Data(contentsOf: output.appendingPathComponent("snapshot.json")) {
            struct Demo: Decodable { let events: [FrameEvent] }
            if let demo = try? JSONDecoder().decode(Demo.self, from: data) {
                return (demo.events.filter { event in
                    guard let source = calendars.first(where: { $0.title == event.calendar }), selectedCalendars.contains(source.id) else { return false }
                    guard let start = ISO8601DateFormatter().date(from: event.start) else { return false }
                    return start >= (requestedStart ?? .distantPast) && start < (requestedEnd ?? .distantFuture)
                }.map { event in
                    var event = event
                    if let source = calendars.first(where: { $0.title == event.calendar }) {
                        let appearance = calendarAppearances[source.id] ?? CalendarAppearance()
                        event.calendarColor = appearance.frameColor(fallback: source.colorHex)
                        event.calendarDisplayName = appearance.frameName
                    }
                    return event
                }, SourceStatus(state: "ready", message: "Sample calendar"))
            }
        }
        guard canReadCalendar else { return ([], SourceStatus(state: "denied", message: "Calendar access is not granted on the Mac.")) }
        let selected = store.calendars(for: .event).filter { selectedCalendars.contains($0.calendarIdentifier) }
        guard !selected.isEmpty else { return ([], SourceStatus(state: "error", message: "Choose at least one calendar in the Mac companion.")) }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let month = calendar.dateInterval(of: .month, for: today)!.start
        let start = requestedStart ?? calendar.date(byAdding: .month, value: -1, to: month)!
        let end = requestedEnd ?? calendar.date(byAdding: .month, value: 2, to: month)!
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: selected)
        let iso = ISO8601DateFormatter()
        let found = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }
        if found.count > limit {
            return ([], SourceStatus(state: "error", message: "Too many events in this calendar range. Narrow the selected calendars."))
        }
        let events = found.compactMap { event -> FrameEvent? in
            guard let start = event.startDate, let end = event.endDate, end > start else { return nil }
            let day = DateFormatter()
            day.calendar = Calendar(identifier: .gregorian)
            day.locale = Locale(identifier: "en_US_POSIX")
            day.dateFormat = "yyyy-MM-dd"
            day.timeZone = event.timeZone ?? .current
            var endDay = day.string(from: end)
            if event.isAllDay {
                var local = Calendar(identifier: .gregorian)
                local.timeZone = event.timeZone ?? .current
                let midnight = local.startOfDay(for: end)
                if end > midnight { endDay = day.string(from: local.date(byAdding: .day, value: 1, to: midnight)!) }
            }
            let appearance = calendarAppearances[event.calendar.calendarIdentifier] ?? CalendarAppearance()
            let color = CalendarAppearance.hex(from: NSColor(cgColor: event.calendar.cgColor) ?? .systemBlue)
            return FrameEvent(id: String(((event.eventIdentifier ?? "event") + "-" + iso.string(from: start)).prefix(500)), title: String((event.title ?? "Untitled event").prefix(500)), calendar: String(event.calendar.title.prefix(200)), start: iso.string(from: start), end: iso.string(from: end), allDay: event.isAllDay, startDay: day.string(from: start), endDay: endDay, calendarColor: appearance.frameColor(fallback: color), calendarDisplayName: appearance.frameName)
        }
        return (events, SourceStatus(state: "ready", message: "Selected calendars exported."))
    }

    func export() async {
        guard !isDemo else { message = "Demo content is refreshed by the sample server."; return }
        guard !busy, let output else { return }
        busy = true
        defer {
            busy = false
            if syncAgain {
                syncAgain = false
                scheduleSync()
            }
        }
        let scoped = output.startAccessingSecurityScopedResource()
        defer { if scoped { output.stopAccessingSecurityScopedResource() } }
        issue = nil
        message = "Updating your frame… Photos in iCloud may take a little longer the first time."
        do {
            let media = output.appendingPathComponent("media", isDirectory: true)
            try FileManager.default.createDirectory(at: media, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            let exportRevision = calendarRevision
            let (events, calendarStatus) = calendarEvents()
            var photos: [FramePhoto] = []
            var photoStatus = SourceStatus(state: "denied", message: "Photo access is not granted on the Mac.")
            if canReadPhotos {
                let match = PHAssetCollection.fetchAssetCollections(withLocalIdentifiers: [selectedAlbum], options: nil).firstObject
                if let album = match, album.assetCollectionSubtype == .albumCloudShared {
                    let result = try await exportPhotos(album: album, directory: media)
                    libraryPhotos = result.0
                    try JSONEncoder().encode(libraryPhotos).write(to: output.appendingPathComponent("photo-catalog.json"), options: .atomic)
                    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.appendingPathComponent("photo-catalog.json").path)
                    photos = photoSelection.visible(result.0)
                    photoStatus = SourceStatus(state: result.1 > 0 && photos.isEmpty ? "error" : "ready", message: "\(photos.count) photos shared from the full album; \(result.0.count - photos.count) hidden; \(result.1) unavailable images will be retried on the next update.")
                } else {
                    photoStatus = SourceStatus(state: "error", message: "Choose an available iCloud Shared Album in the Mac companion.")
                }
            }
            // Recheck permissions after potentially slow iCloud downloads. Never
            // publish cached content after access has been revoked during export.
            let snapshot = Snapshot(generatedAt: ISO8601DateFormatter().string(from: Date()), calendarRevision: exportRevision, calendarStatus: canReadCalendar ? calendarStatus : SourceStatus(state: "denied", message: "Calendar permission revoked."), photoStatus: canReadPhotos ? photoStatus : SourceStatus(state: "denied", message: "Photo permission revoked."), events: canReadCalendar ? events : [], photos: canReadPhotos ? photos : [])
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let file = output.appendingPathComponent("snapshot.json")
            try encoder.encode(snapshot).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            let retained = Set((canReadPhotos ? libraryPhotos : []).map { "\($0.id).jpg" })
            for old in try FileManager.default.contentsOfDirectory(at: media, includingPropertiesForKeys: nil) where old.pathExtension == "jpg" && !retained.contains(old.lastPathComponent) {
                try FileManager.default.removeItem(at: old)
            }
            lastUpdated = Date()
            eventCount = snapshot.events.count
            photoCount = snapshot.photos.count
            message = "Your frame is up to date. Changes sync automatically while this app is open."
            if snapshot.calendarStatus.state != "ready" || snapshot.photoStatus.state != "ready" {
                message = "Updated the sources that are ready. Choose any missing calendar or photo album above."
            }
        } catch {
            issue = "We couldn’t update your frame. Check the frame folder in Advanced and try again."
            message = error.localizedDescription
        }
    }
}
