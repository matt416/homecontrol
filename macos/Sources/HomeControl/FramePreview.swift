import AppKit
import SwiftUI
import WebKit

struct FramePreview: View {
    @ObservedObject var model: CompanionModel
    @State private var address: URL?
    @State private var token = ""
    @State private var reloadID = UUID()

    private func connect() {
        guard let value = model.readPairingToken(),
              model.serverStatus == "Running" else {
            address = nil
            token = ""
            return
        }
        token = value
        address = model.localFrameURL
        reloadID = UUID()
    }

    var body: some View {
        ZStack {
            Color.black
            if let address {
                FrameWebPreview(address: address, token: token)
                    .id(reloadID)
                    .aspectRatio(1.6, contentMode: .fit)
            } else {
                VStack(spacing: 14) {
                    HomeIcon( "images").font(.largeTitle)
                    Text("Preview unavailable").font(.headline)
                    Text(model.pairingMessage ?? "The frame server is starting. You can check its status in Settings.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: 380)
                    Button("Try Again", action: connect)
                }.padding(30).foregroundColor(.white)
            }
        }
        .frame(minWidth: 640, minHeight: 400)
        .clipShape(RoundedRectangle(cornerRadius: HomeDesign.cornerRadius))
        .padding(HomeDesign.pageInset)
        .safeAreaInset(edge: .bottom) {
            HomeFooter { Spacer(); Button(action: connect) { HomeLabel("Reload Preview", icon: "refresh") } }
        }
        .onAppear(perform: connect)
        .onChange(of: model.serverStatus) { _, status in if status == "Running" && address == nil { connect() } }
        .onDisappear { address = nil; token = "" }
    }
}

private struct FrameWebPreview: NSViewRepresentable {
    let address: URL
    let token: String

    func makeCoordinator() -> Coordinator { Coordinator(address: address) }

    func makeNSView(context: Context) -> PreviewWebContainer {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        // Keep pairing in this ephemeral preview session, never in a URL or log.
        let values = try! JSONSerialization.data(withJSONObject: [address.absoluteString, token])
        let json = String(data: values, encoding: .utf8)!
        let source = """
        (() => {
          const [address, token] = \(json);
          if (location.origin === new URL(address).origin) {
            sessionStorage.setItem('homeframe-token', token);
          }
        })();
        """
        configuration.userContentController.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let container = PreviewWebContainer(configuration: configuration)
        container.web.navigationDelegate = context.coordinator
        container.web.load(URLRequest(url: address))
        return container
    }

    func updateNSView(_ view: PreviewWebContainer, context: Context) {}

    static func dismantleNSView(_ view: PreviewWebContainer, coordinator: Coordinator) {
        view.web.stopLoading()
        view.web.navigationDelegate = nil
        view.web.configuration.userContentController.removeAllUserScripts()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let address: URL
        init(address: URL) { self.address = address }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let target = navigationAction.request.url,
                  target.scheme == address.scheme, target.host == address.host,
                  target.port == address.port else { decisionHandler(.cancel); return }
            decisionHandler(.allow)
        }
    }
}

private final class PreviewWebContainer: NSView {
    let web: WKWebView
    init(configuration: WKWebViewConfiguration) {
        web = WKWebView(frame: .zero, configuration: configuration)
        super.init(frame: .zero)
        addSubview(web)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layout() {
        super.layout()
        web.frame = bounds
        // Browser zoom preserves the frame's 1280 × 800 CSS viewport as the
        // native preview window is resized, rather than changing its layout.
        web.pageZoom = max(0.1, bounds.width / 1280)
    }
}
