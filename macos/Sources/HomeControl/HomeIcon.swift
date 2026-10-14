import SwiftUI
import AppKit

// Lucide icons are bundled under ISC. No SF Symbols assets are distributed.
struct HomeIcon: View {
    let name: String
    init(_ name: String) { self.name = name }
    var body: some View {
        if let url = (Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "HomeControl_HomeControl.bundle/Icons") ?? Bundle.module.url(forResource: name, withExtension: "png", subdirectory: "Icons")),
           let image = NSImage(contentsOf: url) {
            Image(nsImage: image).resizable().renderingMode(.template).scaledToFit()
                .frame(width: 18, height: 18).accessibilityHidden(true)
        }
    }
}
struct HomeLabel: View {
    let title: String
    let icon: String
    init(_ title: String, icon: String) { self.title = title; self.icon = icon }
    var body: some View { Label { Text(title) } icon: { HomeIcon(icon) } }
}
