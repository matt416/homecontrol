import Photos

final class PhotoChangeObserver: NSObject, PHPhotoLibraryChangeObserver {
    private let onChange: () -> Void

    init(onChange: @escaping () -> Void) {
        self.onChange = onChange
    }

    func photoLibraryDidChange(_ changeInstance: PHChange) {
        // PhotoKit delivers this callback on an arbitrary queue. The owner
        // dispatches to its main actor before reading or publishing any state.
        onChange()
    }
}
