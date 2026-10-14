import AppKit
import Combine
import Security
import SystemConfiguration

@MainActor final class LocalServer: ObservableObject {
    static let shared = LocalServer()
    struct Configuration: Codable {
        var token: String
        var controlToken: String
        var port = 8797
        var allowNetwork = true
        var publicOrigin = "http://127.0.0.1:8797"
    }
    @Published private(set) var status = "Starting…"
    @Published private(set) var message: String?
    private var configuration: Configuration?
    private var process: Process?
    private var output: URL?
    @Published private var busy = false
    var isWorking: Bool { busy }
    private var log: FileHandle?
    private let runtime: URL
    private var configURL: URL { runtime.appendingPathComponent("server.json") }
    var localURL: URL { URL(string: "http://127.0.0.1:\(configuration?.port ?? 8797)")! }
    var enabled: Bool {
        let environment = ProcessInfo.processInfo.environment
        return environment["HOMECONTROL_DEMO"] != "1" && environment["HOMECONTROL_TEST"] != "1" && environment["HOMECONTROL_EXTERNAL_SERVER"] != "1"
    }
    init(runtime: URL? = nil) {
        self.runtime = runtime ?? ProcessInfo.processInfo.environment["HOMECONTROL_SERVER_DIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/HomeControl Open Source/Server", isDirectory: true)
    }
    private static func secret() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw CocoaError(.fileWriteUnknown) }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
    private func loadConfiguration() throws {
        if configuration != nil { return }
        try FileManager.default.createDirectory(at: runtime, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        if FileManager.default.fileExists(atPath: configURL.path) {
            configuration = try JSONDecoder().decode(Configuration.self, from: Data(contentsOf: configURL))
        } else {
            configuration = try Configuration(token: Self.secret(), controlToken: Self.secret())
            try saveConfiguration()
        }
        guard let config = configuration, config.token.count >= 32, config.controlToken.count >= 32,
              (1024...65535).contains(config.port) else { throw CocoaError(.fileReadCorruptFile) }
        // A companion serves a physical frame by default, including after upgrading an older local-only setup.
        let hostname = SCDynamicStoreCopyLocalHostName(nil) as String? ?? ProcessInfo.processInfo.hostName.components(separatedBy: ".").first ?? "localhost"
        configuration?.allowNetwork = true
        configuration?.publicOrigin = "http://\(hostname).local:\(config.port)"
        try saveConfiguration()
    }
    private func saveConfiguration() throws {
        guard let configuration else { return }
        try JSONEncoder().encode(configuration).write(to: configURL, options: [.atomic])
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: configURL.path)
    }
    private func request(_ path: String, method: String = "GET") async -> Data? {
        guard let config = configuration else { return nil }
        var request = URLRequest(url: localURL.appendingPathComponent(path))
        request.timeoutInterval = 2
        request.httpMethod = method
        request.setValue("Bearer \(config.token)", forHTTPHeaderField: "Authorization")
        request.setValue(config.controlToken, forHTTPHeaderField: "X-HomeControl-Control")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, response) = try? await URLSession.shared.data(for: request), (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return data
    }
    func refresh() async {
        guard enabled, !busy else { return }
        status = await request("api/server/status") == nil ? "Offline" : "Running"
    }
    func start(exportFolder: URL) async {
        guard enabled, !busy else { return }
        busy = true; defer { busy = false }
        output = exportFolder; status = "Starting…"; message = nil
        do {
            try loadConfiguration()
            if let data = await request("api/server/status"),
               let existing = try? JSONDecoder().decode([String: StringOrBool].self, from: data),
               case .string(let folder) = existing["exportDir"], folder == exportFolder.path,
               case .string(let origin) = existing["publicOrigin"], origin == configuration?.publicOrigin {
                status = "Running"; return
            }
            // Only the matching app-owned server can receive this control request.
            if await request("api/server/status") != nil {
                guard await stop() else { return }
            }
            guard let resources = Bundle.main.resourceURL else { throw CocoaError(.fileNoSuchFile) }
            let node = resources.appendingPathComponent("Runtime/node")
            let entry = resources.appendingPathComponent("Server/server/scripts/managed.mjs")
            guard FileManager.default.isExecutableFile(atPath: node.path), FileManager.default.fileExists(atPath: entry.path) else {
                status = "Unavailable"; message = "Build and open the packaged HomeControl app to start its server."; return
            }
            let logURL = runtime.appendingPathComponent("server.log")
            if (try? logURL.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0 > 2_000_000 { try Data().write(to: logURL) }
            if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil, attributes: [.posixPermissions: 0o600]) }
            log = try FileHandle(forWritingTo: logURL); try log?.seekToEnd()
            let child = Process(); child.executableURL = node; child.arguments = [entry.path, configURL.path, exportFolder.path]
            child.currentDirectoryURL = runtime
            // Finder launches need no shell, npm, PATH setup or inherited Node options.
            child.environment = ["HOME": FileManager.default.homeDirectoryForCurrentUser.path, "PATH": "/usr/bin:/bin", "LANG": "en_US.UTF-8"]
            child.standardInput = FileHandle.nullDevice; child.standardOutput = log; child.standardError = log
            try child.run(); process = child
            for _ in 0..<20 {
                if await request("api/server/status") != nil { status = "Running"; return }
                if !child.isRunning { break }
                try await Task.sleep(for: .milliseconds(150))
            }
            status = "Offline"; message = "The server could not start. Another server may be using port \(configuration?.port ?? 8797). Check the server log in Settings."
        } catch { status = "Unavailable"; message = "Could not start the local server: \(error.localizedDescription)" }
    }
    func stopForQuit() async -> Bool {
        for _ in 0..<60 {
            if !busy { return await stop() }
            try? await Task.sleep(for: .milliseconds(150))
        }
        message = "The server is still starting. Please try quitting again shortly."
        return false
    }
    func stop() async -> Bool {
        guard enabled else { return true }
        if configuration == nil { try? loadConfiguration() }
        guard await request("api/server/status") != nil else { status = "Offline"; return true }
        guard await request("api/server/stop", method: "POST") != nil else { message = "Could not stop the local server. Try again."; return false }
        for _ in 0..<20 {
            try? await Task.sleep(for: .milliseconds(150))
            if await request("api/server/status") == nil { status = "Offline"; process = nil; try? log?.close(); log = nil; return true }
        }
        message = "The server is still stopping. Try quitting again shortly."; return false
    }
    func showLog() { NSWorkspace.shared.open(runtime.appendingPathComponent("server.log")) }
    private enum StringOrBool: Decodable {
        case string(String), bool(Bool)
        init(from decoder: Decoder) throws {
            let container = try decoder.singleValueContainer()
            if let string = try? container.decode(String.self) { self = .string(string) }
            else { self = .bool(try container.decode(Bool.self)) }
        }
    }
}
