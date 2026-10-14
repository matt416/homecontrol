import Foundation

struct FramePhotoSelection: Codable {
    var hidden: Set<String> = []
    var order: [String] = []
    static func load() -> Self {
        guard let data = UserDefaults.standard.data(forKey: "framePhotoSelection"), let value = try? JSONDecoder().decode(Self.self, from: data) else { return Self() }
        return value
    }
    func ordered(_ photos: [FramePhoto]) -> [FramePhoto] {
        let positions = Dictionary(order.enumerated().map { ($1, $0) }, uniquingKeysWith: { first, _ in first })
        return photos.enumerated().sorted {
            let left = positions[$0.element.id] ?? (order.count + $0.offset)
            let right = positions[$1.element.id] ?? (order.count + $1.offset)
            return left < right
        }.map(\.element)
    }
    func visible(_ photos: [FramePhoto]) -> [FramePhoto] { ordered(photos).filter { !hidden.contains($0.id) } }

    mutating func move(_ id: String, before target: String?, in photos: [FramePhoto]) {
        var ids = ordered(photos).map(\.id)
        guard id != target, let source = ids.firstIndex(of: id), target == nil || ids.contains(target!) else { return }
        ids.remove(at: source)
        let destination = target.flatMap { ids.firstIndex(of: $0) } ?? ids.count
        ids.insert(id, at: destination)
        order = ids
    }
}

extension CompanionModel {
    func loadPhotoCatalog() {
        guard let output else { return }
        if let data = try? Data(contentsOf: output.appendingPathComponent("photo-catalog.json")),
           let photos = try? JSONDecoder().decode([FramePhoto].self, from: data) { libraryPhotos = photos; return }
        struct Feed: Decodable { var photos: [FramePhoto] }
        if let data = try? Data(contentsOf: output.appendingPathComponent("snapshot.json")),
           let feed = try? JSONDecoder().decode(Feed.self, from: data) { libraryPhotos = feed.photos }
    }
    func setPhotoVisible(_ id: String, visible: Bool) {
        if visible { photoSelection.hidden.remove(id) } else { photoSelection.hidden.insert(id) }
        savePhotoSelection()
    }
    func movePhoto(_ id: String, by amount: Int) {
        var photos = photoSelection.ordered(libraryPhotos)
        guard let index = photos.firstIndex(where: { $0.id == id }), photos.indices.contains(index + amount) else { return }
        photos.swapAt(index, index + amount)
        photoSelection.order = photos.map(\.id)
        savePhotoSelection()
    }
    func movePhoto(_ id: String, before target: String?) {
        photoSelection.move(id, before: target, in: libraryPhotos)
        savePhotoSelection()
    }
    private func savePhotoSelection() {
        if let data = try? JSONEncoder().encode(photoSelection) { UserDefaults.standard.set(data, forKey: "framePhotoSelection") }
        scheduleSync()
    }
}
