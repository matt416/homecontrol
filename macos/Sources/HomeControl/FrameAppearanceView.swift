import SwiftUI
import AppKit

struct FrameAppearanceSettings: Codable, Equatable {
    var accentColor = "#E4FF73"
    var isValid: Bool { CalendarAppearance.color(from: accentColor) != nil }
}

struct FrameAppearanceView: View {
    @ObservedObject var companion: CompanionModel
    @State private var settings = FrameAppearanceSettings()
    @State private var message: String?
    private let swatches = [
        ("Lime", "#A3E635"), ("Emerald", "#34D399"), ("Sky", "#38BDF8"),
        ("Violet", "#A78BFA"), ("Rose", "#FB7185"), ("Amber", "#FBBF24"),
        ("Orange", "#FB923C")
    ]
    var body: some View {
        HomeSection("Frame appearance") {
            Text("Choose an accent for every connected display. Calendar colours stay specific to each calendar.")
                .font(.callout).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                ForEach(swatches, id: \.0) { name, hex in
                    Button { save(hex) } label: {
                        Circle().fill(Color(nsColor: CalendarAppearance.color(from: hex)!))
                            .frame(width: 28, height: 28).padding(4)
                            .overlay(Circle().stroke(settings.accentColor.uppercased() == hex ? Color.primary : Color.clear, lineWidth: 2))
                    }.buttonStyle(.plain).help(name).accessibilityLabel("\(name) accent")
                }
                Spacer()
            }
            HStack {
                ColorPicker("Custom colour", selection: Binding(get: {
                    Color(nsColor: CalendarAppearance.color(from: settings.accentColor) ?? .systemYellow)
                }, set: { save(CalendarAppearance.hex(from: NSColor($0))) }), supportsOpacity: false)
                Spacer()
                Button("Reset") { save(FrameAppearanceSettings().accentColor) }
            }
            Text(message ?? "Tailwind colour swatches · Changes reach your frames in a few seconds.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .onAppear(perform: load)
        .onChange(of: companion.output) { _, _ in load() }
    }
    private func load() {
        guard let folder = companion.output else { return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        let file = folder.appendingPathComponent("frame-appearance.json")
        guard FileManager.default.fileExists(atPath: file.path) else { settings = FrameAppearanceSettings(); return }
        do {
            let data = try Data(contentsOf: file)
            guard data.count <= 1024 else { throw CocoaError(.fileReadCorruptFile) }
            let value = try JSONDecoder().decode(FrameAppearanceSettings.self, from: data)
            guard value.isValid else { throw CocoaError(.fileReadCorruptFile) }
            settings = value; message = nil
        } catch { message = "Could not read the saved colour. Choose a colour to replace it." }
    }
    private func save(_ hex: String) {
        guard let folder = companion.output else { message = "Choose a frame folder first."; return }
        let value = FrameAppearanceSettings(accentColor: hex)
        guard value.isValid else { return }
        let scoped = folder.startAccessingSecurityScopedResource()
        defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
        do {
            let file = folder.appendingPathComponent("frame-appearance.json")
            try JSONEncoder().encode(value).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            settings = value; message = nil
        } catch { message = "Could not save the colour. Check access to the frame folder." }
    }
}
