import AppKit
import Photos
import CryptoKit

enum PhotoExportError: LocalizedError {
    case unavailable
    var errorDescription: String? { "Photo could not be downloaded or converted." }
}

// PHImageManager can issue a degraded callback before the final image. A lock
// also arbitrates the timeout and final callback so the continuation resumes once.
private final class ImageRequest: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Data, Error>?
    private var timeout: DispatchWorkItem?

    func run(asset: PHAsset) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let options = PHImageRequestOptions()
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .exact
            options.isNetworkAccessAllowed = true
            let manager = PHImageManager.default()
            let request = manager.requestImage(for: asset, targetSize: NSSize(width: 1920, height: 1920), contentMode: .aspectFit, options: options) { image, info in
                if (info?[PHImageResultIsDegradedKey] as? Bool) == true { return }
                guard let image, let tiff = image.tiffRepresentation,
                      let bitmap = NSBitmapImageRep(data: tiff),
                      let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.84]) else {
                    self.finish(.failure(PhotoExportError.unavailable))
                    return
                }
                self.finish(.success(jpeg))
            }
            let work = DispatchWorkItem {
                self.finish(.failure(PhotoExportError.unavailable))
                manager.cancelImageRequest(request)
            }
            lock.lock()
            if self.continuation != nil { self.timeout = work; DispatchQueue.global().asyncAfter(deadline: .now() + 45, execute: work) }
            lock.unlock()
        }
    }

    private func finish(_ result: Result<Data, Error>) {
        lock.lock()
        let pending = continuation
        continuation = nil
        timeout?.cancel()
        timeout = nil
        lock.unlock()
        pending?.resume(with: result)
    }
}

struct PortablePhotoIdentity: Codable {
    var key: String
    var id: String
    var localFingerprint: String
}

func exportPhotos(album: PHAssetCollection, directory: URL) async throws -> ([FramePhoto], Int) {
    let options = PHFetchOptions()
    options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    // Export the entire selected shared album; the frame loads images on demand.
    options.fetchLimit = 0
    let assets = PHAsset.fetchAssets(in: album, options: options)
    let identityFile = directory.deletingLastPathComponent().appendingPathComponent("photo-identities.json")
    let previous = (try? JSONDecoder().decode([PortablePhotoIdentity].self, from: Data(contentsOf: identityFile))) ?? []
    let previousByKey = Dictionary(grouping: previous, by: \.key)
    func portableKey(_ asset: PHAsset) -> String {
        let filename = PHAssetResource.assetResources(for: asset).first?.originalFilename ?? ""
        let fields = [filename, String(asset.creationDate?.timeIntervalSince1970 ?? 0), String(asset.pixelWidth), String(asset.pixelHeight)]
        return SHA256.hash(data: Data(fields.joined(separator: "|").utf8)).map { String(format: "%02x", $0) }.joined()
    }
    let keys = (0..<assets.count).map { portableKey(assets.object(at: $0)) }
    let keyCounts = Dictionary(grouping: keys, by: { $0 }).mapValues(\.count)
    var identities: [PortablePhotoIdentity] = []
    var photos: [FramePhoto] = []
    var skipped = 0
    for index in 0..<assets.count {
        let asset = assets.object(at: index)
        let fingerprint = asset.localIdentifier + String(asset.modificationDate?.timeIntervalSince1970 ?? 0)
        let defaultID = SHA256.hash(data: Data(fingerprint.utf8)).map { String(format: "%02x", $0) }.joined()
        let key = keys[index]
        let candidates = previousByKey[key] ?? []
        let prior = candidates.count == 1 && keyCounts[key] == 1 ? candidates.first : nil
        let id = prior?.id ?? defaultID
        let file = directory.appendingPathComponent("\(id).jpg")
        do {
            if !FileManager.default.fileExists(atPath: file.path) || (prior != nil && prior?.localFingerprint != fingerprint) {
                let bytes = try await ImageRequest().run(asset: asset)
                try bytes.write(to: file, options: .atomic)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            }
            let caption = asset.creationDate.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "A favourite moment"
            identities.append(PortablePhotoIdentity(key: key, id: id, localFingerprint: fingerprint))
            photos.append(FramePhoto(id: id, caption: caption, album: album.localizedTitle ?? "Shared album"))
        } catch { skipped += 1 }
    }
    try JSONEncoder().encode(identities).write(to: identityFile, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: identityFile.path)
    return (photos, skipped)
}
