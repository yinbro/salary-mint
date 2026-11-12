import AppKit
import WebKit

final class LedgerWindowController: NSWindowController, NSWindowDelegate,
                                     WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private var webView: WKWebView!
    var onClose: (() -> Void)?

    convenience init() {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 820),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        window.title = "薪水铸币厂 · 月度账本"
        window.titlebarAppearsTransparent = false
        window.minSize = NSSize(width: 880, height: 620)
        window.center()
        self.init(window: window)
        window.delegate = self

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.setURLSchemeHandler(AssetSchemeHandler(), forURLScheme: AssetSchemeHandler.scheme)
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: window.contentLayoutRect, configuration: cfg)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(webView)

        load()
    }

    func load() {
        webView.load(URLRequest(url: WebEngine.startURL))
    }

    func present() {
        guard let window = window else { return }
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }

    func windowWillClose(_ notification: Notification) {
        onClose?()
    }

    // MARK: - 下载（导出 JSON 备份、分享卡 PNG）

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if navigationResponse.canShowMIMEType {
            decisionHandler(.allow)
        } else {
            decisionHandler(.download)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.canCreateDirectories = true
        panel.begin { result in
            guard result == .OK, let url = panel.url else {
                completionHandler(nil)
                return
            }
            completionHandler(url)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        NSSound(named: "Glass")?.play()
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        NSSound(named: "Basso")?.play()
    }
}
