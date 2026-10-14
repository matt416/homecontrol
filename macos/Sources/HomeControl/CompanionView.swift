import SwiftUI

struct CompanionView: View {
    @ObservedObject var model: CompanionModel
    @ObservedObject private var server = LocalServer.shared
    var body: some View {
        HomeContent {
            HomeSection("Connect your frame") {
                Text("Choose this Mac on your frame, then enter the code below. Both devices need to be on the same Wi-Fi.")
                    .font(.callout).foregroundStyle(.secondary)
                if let address = model.pairingAddress {
                    HStack {
                        Text(address).font(.callout.monospaced()).textSelection(.enabled)
                        Spacer()
                        Button("Copy Address") {
                            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(address, forType: .string)
                        }
                    }.padding(12).background(HomeDesign.canvas, in: RoundedRectangle(cornerRadius: 8))
                }
                VStack(spacing: 10) {
                    Text(model.formattedPairingCode ?? "••••-••••")
                        .font(.system(size: 36, weight: .medium, design: .monospaced)).tracking(4).textSelection(.enabled)
                    if let expiry = model.pairingExpiresAt, model.pairingCode != nil {
                        Text("One use · Expires at \(expiry.formatted(date: .omitted, time: .shortened))")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    HStack {
                        Button("Copy Code") { model.copyPairingCode() }.buttonStyle(.borderedProminent).disabled(model.pairingCode == nil)
                        Button("New Code") { Task { await model.newPairingCode() } }.disabled(model.serverStatus != "Running")
                    }
                }.frame(maxWidth: .infinity).padding(.vertical, 12)
                if let message = model.pairingMessage { Text(message).font(.caption).foregroundStyle(.secondary) }

            }
            HomeSection("Library sharing") {
                HomeSettingRow(title: "Sources") { Text(model.selectionSummary).foregroundStyle(.secondary) }
                if let updated = model.lastUpdated {
                    HomeSettingRow(title: "Last updated") { Text(updated.formatted(date: .abbreviated, time: .shortened)).foregroundStyle(.secondary) }
                }
                HStack {
                    Text(model.automatic ? "Your selection updates automatically." : "Choose an album or calendars, then start sharing.").font(.callout).foregroundStyle(.secondary)
                    Spacer()
                    SharingButton(model: model)
                }
                Text("Keep this Mac awake and HomeControl open, with Photos and Calendar permissions granted, to keep those libraries available on your frame.")
                    .font(.caption).foregroundStyle(.secondary)
                if let issue = model.issue { HomeNotice(text: issue, kind: .warning) }
            }
            FrameAppearanceView(companion: model)
            FrameUpdatesView(companion: model)
            HomeSection {
                HStack {
                    Circle().fill(model.serverStatus == "Running" ? Color.green : Color.orange).frame(width: 7, height: 7)
                    Text(model.serverStatus == "Running" ? "Frame server running" : "Frame server: \(model.serverStatus.lowercased())").font(.callout)
                    Spacer()
                }
                if let message = server.message { HomeNotice(text: message, kind: .warning) }
                DisclosureGroup("Advanced") {
                    VStack(alignment: .leading, spacing: 14) {
                        if server.enabled {
                            HStack {
                                Button("Restart Server") { Task { if await server.stop(), let folder = model.output { await server.start(exportFolder: folder) } } }.disabled(server.isWorking)
                                Button("Open Server Log") { server.showLog() }
                            }
                            Text("The server starts with HomeControl. Quit offers the option to leave it running.").font(.caption).foregroundStyle(.secondary)
                        }
                        Divider()
                        PermissionControls(frame: model)
                        Divider()
                        Text("Shared content folder").fontWeight(.medium)
                        Text(model.output?.path ?? "Not selected").font(.caption).foregroundStyle(.secondary).textSelection(.enabled)
                        Button("Change Folder…") { model.chooseFolder() }.disabled(model.busy)
                    }.padding(.top, 12)
                }
            }
        }
        .onAppear { _ = model.readPairingToken() }
        .onReceive(Timer.publish(every: 5, on: .main, in: .common).autoconnect()) { _ in _ = model.readPairingToken() }
    }
}

struct SharingButton: View {
    @ObservedObject var model: CompanionModel
    var body: some View {
        HStack {
            if model.automatic {
                Button("Pause Sharing") { model.automatic = false; model.message = "Sharing paused." }.disabled(model.busy)
            }
            Button(model.busy ? "Updating…" : model.automatic ? "Update Now" : "Start Sharing") {
                Task { await model.startSharing() }
            }.buttonStyle(.borderedProminent).disabled(!model.canStartSharing)
        }
    }
}
