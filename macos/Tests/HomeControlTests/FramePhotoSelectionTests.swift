import XCTest
@testable import HomeControl

final class FramePhotoSelectionTests: XCTestCase {
    private let photos = [FramePhoto(id: "a", caption: "A", album: "Family"), FramePhoto(id: "b", caption: "B", album: "Family"), FramePhoto(id: "c", caption: "C", album: "Family")]
    func testHiddenPhotosCanBeRestoredWithoutLosingOrder() throws {
        var selection = FramePhotoSelection(hidden: ["b"], order: ["c", "b", "a"])
        XCTAssertEqual(selection.visible(photos).map(\.id), ["c", "a"])
        XCTAssertEqual(selection.ordered(photos).map(\.id), ["c", "b", "a"])
        selection.hidden.remove("b")
        let restored = try JSONDecoder().decode(FramePhotoSelection.self, from: JSONEncoder().encode(selection))
        XCTAssertEqual(restored.visible(photos).map(\.id), ["c", "b", "a"])
    }
    func testNewAndRemovedPhotosDoNotDropExistingVisibleImages() {
        let selection = FramePhotoSelection(hidden: ["deleted"], order: ["deleted", "b", "b"])
        XCTAssertEqual(selection.visible(photos).map(\.id), ["b", "a", "c"])
    }
    func testDraggingInEitherDirectionAndToEndPersistsAcrossNewPhotos() throws {
        var selection = FramePhotoSelection(hidden: ["b"])
        selection.move("c", before: "a", in: photos)
        XCTAssertEqual(selection.order, ["c", "a", "b"])
        selection.move("c", before: nil, in: photos)
        XCTAssertEqual(selection.visible(photos).map(\.id), ["a", "c"])
        selection.move("a", before: "c", in: photos)
        XCTAssertEqual(selection.order, ["b", "a", "c"])
        let restored = try JSONDecoder().decode(FramePhotoSelection.self, from: JSONEncoder().encode(selection))
        let extended = photos + [FramePhoto(id: "d", caption: "D", album: "Family")]
        XCTAssertEqual(restored.visible(extended).map(\.id), ["a", "c", "d"])
        selection.move("unknown", before: "a", in: photos)
        selection.move("a", before: "unknown", in: photos)
        XCTAssertEqual(selection.order, restored.order)
    }
}
