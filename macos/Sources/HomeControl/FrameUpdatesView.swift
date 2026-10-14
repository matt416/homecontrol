import SwiftUI

struct FrameUpdateStatus: Decodable {
    struct Release: Decodable { let versionCode: Int; let versionName: String }
    struct Device: Decodable, Identifiable {
        let deviceId: String
        let versionCode: Int
        let versionName: String
        let status: String
        let lastSeen: Date
        var id: String { deviceId }
        var online: Bool { Date().timeIntervalSince(lastSeen) < 90 }
        var detail: String {
            guard online else { return "Last seen \(lastSeen.formatted(date: .abbreviated, time: .shortened))" }
            switch status {
            case "downloading": return "Downloading update…"
            case "ready": return "Update ready on frame"
            case "installing": return "Confirm Install on the frame"
            case "error": return "Update did not finish. Try sending it again."
            default: return "Connected over Wi-Fi"
            }
        }
    }
    let release: Release?
    let devices: [Device]
}

@MainActor final class FrameUpdatesModel: ObservableObject {
    @Published var state: FrameUpdateStatus?
    @Published var busy = false
    @Published var error: String?
    @Published var message: String?

    private func request(_ companion: CompanionModel, path: String, body: Data? = nil) async throws -> Data {
        guard let token = companion.readPairingToken() else { throw URLError(.userAuthenticationRequired) }
        var request = URLRequest(url: companion.localFrameURL.appendingPathComponent(path))
        request.timeoutInterval = 8
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
    }
    func refresh(_ companion: CompanionModel) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let data = try await request(companion, path: "api/frame-update")
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom { decoder in
                let text = try decoder.singleValueContainer().decode(String.self)
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                guard let date = formatter.date(from: text) else { throw CocoaError(.fileReadCorruptFile) }
                return date
            }
            state = try decoder.decode(FrameUpdateStatus.self, from: data)
            error = nil
        } catch { self.error = "Could not reach frame updates. Check that the local frame server is running." }
    }
    func send(_ companion: CompanionModel, device: FrameUpdateStatus.Device, release: FrameUpdateStatus.Release) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let body = try JSONSerialization.data(withJSONObject: ["deviceId": device.deviceId, "versionCode": release.versionCode])
            _ = try await request(companion, path: "api/frame-update/request", body: body)
            message = "Update sent. Within 30 seconds the frame will download it. Confirm Install on the frame."
            error = nil
        } catch { self.error = "Could not send the update. Refresh the status and try again." }
    }
}

struct FrameUpdatesView: View {
    @ObservedObject var companion: CompanionModel
    @StateObject private var updates = FrameUpdatesModel()
    private var installationURL: URL? { URL(string: companion.pairingAddress ?? "")?.appendingPathComponent("install") }

    var body: some View {
        HomeSection("Frame updates") {
            HStack {
                Text(updates.state?.release.map { "Available version \($0.versionName)" } ?? "No update published yet")
                    .foregroundStyle(.secondary)
                Spacer()
                Button { Task { await updates.refresh(companion) } } label: { Label { Text("Refresh") } icon: { HomeIcon("refresh") } }
                    .disabled(updates.busy)
            }
            if let state = updates.state, !state.devices.isEmpty {
                ForEach(state.devices) { device in
                    HStack(spacing: 12) {
                        HomeIcon("image").foregroundStyle(.secondary).frame(width: 32)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Frame · \(device.versionName)").fontWeight(.medium)
                            Text(device.detail).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let release = state.release, release.versionCode > device.versionCode {
                            Button("Send Update") { Task { await updates.send(companion, device: device, release: release) } }
                                .disabled(updates.busy || !device.online || device.status == "downloading")
                        } else { Text("Up to date").font(.caption).foregroundStyle(.secondary) }
                    }.padding(.vertical, 4)
                }
            } else {
                Text("Pair the Android frame to see it here. Future updates travel over Wi-Fi; confirm Install on the frame when prompted.")
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let url = installationURL {
                DisclosureGroup("Install on a frame for the first time") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Keep the frame on wall power. Open this address in its browser, download the app, then tap Install and Open. Pair it with the code above.").font(.callout).fixedSize(horizontal: false, vertical: true)
                        Text(url.absoluteString).font(.callout.monospaced()).textSelection(.enabled)
                        HStack {
                            Button("Copy Install Address") { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(url.absoluteString, forType: .string) }
                            Link("Open Instructions", destination: url)
                        }
                    }.padding(.vertical, 8)
                }
            }
            if let message = updates.message { Text(message).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) }
            if let error = updates.error { Text(error).font(.caption).foregroundStyle(.orange).fixedSize(horizontal: false, vertical: true) }
        }
        .task { await updates.refresh(companion) }
        .onReceive(Timer.publish(every: 10, on: .main, in: .common).autoconnect()) { _ in Task { await updates.refresh(companion) } }
    }
}
