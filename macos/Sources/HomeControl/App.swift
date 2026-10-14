import SwiftUI
import AppKit

@MainActor final class AppLifecycle: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(NSApp.windows.contains { $0.isVisible && $0.canBecomeMain } ? .regular : .accessory)
        // Use the existing composed artwork in the Dock without adding Finder
        // resource forks, which invalidate strict signature verification.
        let url = Bundle.main.url(forResource: "HomeControlApp", withExtension: "png", subdirectory: "HomeControl_HomeControl.bundle/Icons")
            ?? Bundle.module.url(forResource: "HomeControlApp", withExtension: "png", subdirectory: "Icons")
        if let url, let image = NSImage(contentsOf: url) {
            NSApplication.shared.applicationIconImage = image
        }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard LocalServer.shared.enabled else { return .terminateNow }
        let alert = NSAlert()
        alert.messageText = "Quit HomeControl?"
        alert.informativeText = "You can leave the frame server running so connected displays stay available. Photos and calendar updates pause until you reopen HomeControl; their last export is available for up to ten minutes."
        alert.addButton(withTitle: "Quit")
        alert.addButton(withTitle: "Cancel")
        alert.showsSuppressionButton = true
        alert.suppressionButton?.title = "Keep the frame server running"
        alert.suppressionButton?.state = .off
        guard alert.runModal() == .alertFirstButtonReturn else { return .terminateCancel }
        if alert.suppressionButton?.state == .on { return .terminateNow }
        Task {
            let stopped = await LocalServer.shared.stopForQuit()
            if !stopped {
                let failure = NSAlert(); failure.messageText = "The server could not stop."
                failure.informativeText = LocalServer.shared.message ?? "Try again, or choose to keep the server running."
                failure.runModal()
            }
            sender.reply(toApplicationShouldTerminate: stopped)
        }
        return .terminateLater
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

enum Page: String, CaseIterable, Identifiable {
    case photos = "Photos", calendar = "Calendar", reminders = "Collection day", weather = "Weather"
    case preview = "Frame Preview", settings = "Settings"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .photos: "images"
        case .calendar: "calendar"
        case .reminders: "trash"
        case .weather: "cloud-sun"
        case .preview: "panels"
        case .settings: "settings"
        }
    }
    var summary: String {
        switch self {
        case .photos: "Choose the photos you want to share."
        case .calendar: "Choose the calendars your household can see."
        case .reminders: "The right bins, on the right day."
        case .weather: "Set the location and units for your frame."
        case .preview: "Photos, plans, collection day, and the forecast."
        case .settings: "Pair a display and manage sharing."
        }
    }
}

@main struct HomeControlApp: App {
    @NSApplicationDelegateAdaptor(AppLifecycle.self) private var lifecycle
    @StateObject private var frame = CompanionModel(loadSources: ProcessInfo.processInfo.environment["HOMECONTROL_TEST"] != "1")
    @State private var selection: Page = .photos
    @Environment(\.openSettings) private var openSettings
    var body: some Scene {
        Settings {
            HStack(spacing: 0) {
                List(selection: $selection) {
                    Section("Your home") {
                        ForEach([Page.photos, .calendar, .reminders, .weather]) { page in
                            Button { selection = page } label: { HomeLabel(page.rawValue, icon: page.icon).frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle()) }.buttonStyle(.plain).tag(page)
                        }
                    }
                    Section("Frame") {
                        ForEach([Page.preview, .settings]) { page in
                            Button { selection = page } label: { HomeLabel(page.rawValue, icon: page.icon).frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle()) }.buttonStyle(.plain).tag(page)
                        }
                    }
                }
                .listStyle(.sidebar)
                .safeAreaInset(edge: .bottom) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("HOMECONTROL").font(.caption2.weight(.semibold)).tracking(1.5)
                        HStack(spacing: 6) {
                            Circle().fill(frame.serverStatus == "Running" ? Color.green : Color.orange).frame(width: 6, height: 6)
                            Text(frame.serverStatus == "Running" ? "Ready for your frame" : frame.serverStatus).font(.caption).foregroundStyle(.secondary)
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).padding(18)
                }
                .frame(width: 205)
                .background(.bar)
                Divider()
                HomePage(title: selection.rawValue, subtitle: selection.summary) {
                    switch selection {
                    case .photos: PhotoLibraryView(model: frame)
                    case .calendar: CalendarLibraryView(model: frame)
                    case .reminders: ReminderSettingsView(companion: frame)
                    case .weather: WeatherSettingsView(companion: frame)
                    case .preview: FramePreview(model: frame)
                    case .settings: CompanionView(model: frame)
                    }
                } actions: {
                    if selection == .photos {
                        Button { frame.openPhotos() } label: { HomeLabel("Open Photos", icon: "external-link") }
                            .help("Add photos to your shared album in Photos")
                    } else if selection == .calendar {
                        Button { NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Calendar.app")) } label: { HomeLabel("Open Calendar", icon: "external-link") }
                    }
                }
            }
            .frame(minWidth: 960, minHeight: 700)
            .background(SettingsWindowPresence())
            .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in frame.reloadSources() }
        }.defaultSize(width: 1180, height: 800)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Open HomeControl") { open(.photos) }.keyboardShortcut("0", modifiers: .command)
                Button("Preview Frame") { open(.preview) }.keyboardShortcut("1", modifiers: .command)
            }
        }
        MenuBarExtra {
            Text("Frame server: \(frame.serverStatus)")
            Button("Open HomeControl") { open(.photos) }
            Button("Preview Frame") { open(.preview) }
            Button("Settings") { open(.settings) }
            Divider()
            Button("Quit HomeControl") { NSApp.terminate(nil) }.keyboardShortcut("q")
        } label: { Image(nsImage: frame.needsAttention ? AppIcons.menuBarAttention : AppIcons.menuBar) }
    }
    private func open(_ page: Page) {
        selection = page
        NSApp.setActivationPolicy(.regular)
        openSettings()
        NSApp.activate(ignoringOtherApps: true)
    }
}
