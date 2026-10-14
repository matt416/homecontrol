import AppKit

@MainActor enum AppIcons {
    static let menuBar = template(named: "HomeControlTemplate")
    static let menuBarAttention = template(named: "HomeControlAttentionTemplate")

    private static func template(named name: String) -> NSImage {
        let size = NSSize(width: 22, height: 22)
        let image = NSImage(size: size)
        for suffix in ["", "@2x", "@3x"] {
            guard let url = Bundle.main.url(forResource: name + suffix, withExtension: "png", subdirectory: "HomeControl_HomeControl.bundle/Icons")
                    ?? Bundle.module.url(forResource: name + suffix, withExtension: "png", subdirectory: "Icons"),
                  let data = try? Data(contentsOf: url),
                  let representation = NSBitmapImageRep(data: data) else { continue }
            representation.size = size
            image.addRepresentation(representation)
        }
        image.isTemplate = true
        image.accessibilityDescription = "HomeControl"
        return image
    }
}
