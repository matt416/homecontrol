import Foundation
import Vision
import ImageIO

struct Region: Encodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}
struct Analysis: Encodable {
    let subject: Region?
}

// Input is the already-exported JPEG. No Photos database or network access.
let data = FileHandle.standardInput.readDataToEndOfFile()
guard data.count <= 15 * 1024 * 1024,
      let source = CGImageSourceCreateWithData(data as CFData, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { exit(1) }
let faces = VNDetectFaceRectanglesRequest()
let people = VNDetectHumanRectanglesRequest()
people.upperBodyOnly = false
let objects = VNGenerateObjectnessBasedSaliencyImageRequest()
let attention = VNGenerateAttentionBasedSaliencyImageRequest()
let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
do {
    try handler.perform([faces, people, objects, attention])
    var boxes: [CGRect] = []
    for face in faces.results ?? [] where face.confidence >= 0.6 {
        // Preserve headroom around faces when body detection is uncertain.
        let rect = face.boundingBox
        boxes.append(rect.insetBy(dx: -rect.width * 0.5, dy: -rect.height * 0.65))
    }
    for person in people.results ?? [] where person.confidence >= 0.6 {
        boxes.append(person.boundingBox)
    }
    if boxes.isEmpty {
        let objectsFound = (objects.results?.first?.salientObjects ?? []).filter { $0.confidence >= 0.5 }.map { $0.boundingBox }
        let objectUnion = objectsFound.reduce(CGRect.null) { $0.union($1) }
        // An all-image objectness result gives no useful focal region. In that
        // case use attention saliency, still padded before any crop is allowed.
        if objectUnion.isNull || objectUnion.width * objectUnion.height > 0.85 {
            boxes = (attention.results?.first?.salientObjects ?? []).filter { $0.confidence >= 0.5 }.map { $0.boundingBox }
        } else { boxes = objectsFound }
    }
    let unit = CGRect(x: 0, y: 0, width: 1, height: 1)
    let union = boxes.reduce(CGRect.null) { $0.union($1) }
    var subject: Region?
    if !union.isNull {
        let padded = union.insetBy(dx: -0.035, dy: -0.035).intersection(unit)
        // Vision uses bottom-left coordinates; the browser uses top-left.
        subject = Region(x: padded.minX, y: 1 - padded.maxY, width: padded.width, height: padded.height)
    }
    let result = try JSONEncoder().encode(Analysis(subject: subject))
    FileHandle.standardOutput.write(result)
} catch { exit(1) }
