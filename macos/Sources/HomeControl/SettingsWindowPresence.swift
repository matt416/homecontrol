import AppKit
import SwiftUI

/// The Dock is useful while editing settings; the menu bar owns background life.
struct SettingsWindowPresence: NSViewRepresentable {
    func makeNSView(context: Context) -> WindowObserver { WindowObserver() }
    func updateNSView(_ view: WindowObserver, context: Context) {}

    final class WindowObserver: NSView {
        private var closing: NSObjectProtocol?
        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            if let closing { NotificationCenter.default.removeObserver(closing) }
            guard let window else { return }
            window.title = "HomeControl"
            NSApp.setActivationPolicy(.regular)
            closing = NotificationCenter.default.addObserver(forName: NSWindow.willCloseNotification, object: window, queue: .main) { _ in
                MainActor.assumeIsolated { _ = NSApp.setActivationPolicy(.accessory) }
            }
        }
        deinit { if let closing { NotificationCenter.default.removeObserver(closing) } }
    }
}
