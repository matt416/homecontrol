import SwiftUI

struct PermissionControls: View {
    @ObservedObject var frame: CompanionModel
    var body: some View {
        HomeSettingRow(title: "Calendar") { HomeLabel(frame.calendarAccess ? "Allowed" : "Access needed", icon: frame.calendarAccess ? "circle-check" : "circle-alert").foregroundStyle(frame.calendarAccess ? Color.green : .orange) }
        HomeSettingRow(title: "Photos") { HomeLabel(frame.photoAccess ? "Allowed" : "Access needed", icon: frame.photoAccess ? "circle-check" : "circle-alert").foregroundStyle(frame.photoAccess ? Color.green : .orange) }
        if frame.isDemo {
            Text("Demo mode uses sample content. Quit and open HomeControl normally to connect your own libraries.").font(.caption).foregroundStyle(.secondary)
        } else {
            HStack {
                if !frame.calendarAccess { PermissionButton(model: frame, permission: .calendar) }
                if !frame.photoAccess { PermissionButton(model: frame, permission: .photos) }
                Button("Privacy Settings…") { frame.openPrivacySettings() }
            }
        }
    }
}

struct PermissionSheet: View {
    @ObservedObject var frame: CompanionModel
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HomeLabel("Access for your frame", icon: "shield").font(.title2.bold())
            Text("Allow HomeControl to read your selected calendars and shared photo album.").foregroundStyle(.secondary)
            HomeSection { PermissionControls(frame: frame) }
            HStack { Spacer(); Button(frame.calendarAccess && frame.photoAccess ? "Done" : "Later") { dismiss() }.keyboardShortcut(.cancelAction) }
        }.padding(24).frame(width: 480)
        .onChange(of: frame.photoAccess) { _, allowed in if allowed && frame.calendarAccess { dismiss() } }
        .onChange(of: frame.calendarAccess) { _, allowed in if allowed && frame.photoAccess { dismiss() } }
    }
}

struct PermissionButton: View {
    @ObservedObject var model: CompanionModel
    let permission: CompanionModel.LibraryPermission
    var body: some View {
        Button(model.permissionNeedsSettings(permission) ? "Open \(permission.rawValue) Privacy Settings…" : "Allow \(permission.rawValue) Access…") {
            Task { await model.requestPermission(permission) }
        }.disabled(model.requestingPermission)
    }
}

struct LibraryPermissionState: View {
    @ObservedObject var model: CompanionModel
    let permission: CompanionModel.LibraryPermission
    var body: some View {
        HomeEmptyState(title: "Allow \(permission.rawValue) access", systemImage: permission == .photos ? "images" : "calendar",
                       description: permission == .photos ? "HomeControl needs access to Photos so you can choose a shared album for your frame. Your original photos stay unchanged." : "HomeControl needs Calendar access so you can choose which calendars appear on your frame. Your events stay unchanged.") {
            VStack(spacing: 12) {
                PermissionButton(model: model, permission: permission).buttonStyle(.borderedProminent)
                if model.requestingPermission { ProgressView().controlSize(.small) }
                if let message = model.permissionMessage { Text(message).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 430) }
                Text("Only the sources you select will be shared.").font(.caption).foregroundStyle(.secondary)
            }
        }.background(HomeDesign.canvas).onAppear { model.reloadSources() }
    }
}
