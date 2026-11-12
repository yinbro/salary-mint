import Foundation
import WebKit
import UniformTypeIdentifiers

/// 用自定义 scheme 承载本地页面，避免 file:// 下 localStorage 不可用
final class AssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "mint"
    static let host = "app"

    private var active = Set<ObjectIdentifier>()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: "SalaryMint", code: 400))
            return
        }
        var rel = url.path
        if rel.isEmpty || rel == "/" { rel = "/index.html" }
        rel = rel.removingPercentEncoding ?? rel

        guard let root = Bundle.main.resourceURL?.appendingPathComponent("web") else {
            urlSchemeTask.didFailWithError(NSError(domain: "SalaryMint", code: 404))
            return
        }
        let fileURL = root.appendingPathComponent(rel.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(NSError(domain: "SalaryMint", code: 404,
                                                   userInfo: [NSLocalizedDescriptionKey: "missing \(rel)"]))
            return
        }

        let mime = Self.mimeType(for: fileURL.pathExtension)
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                             headerFields: [
                                                "Content-Type": mime,
                                                "Content-Length": String(data.count),
                                                "Cache-Control": "no-cache"
                                             ]) else {
            urlSchemeTask.didFailWithError(NSError(domain: "SalaryMint", code: 500))
            return
        }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "txt": return "text/plain; charset=utf-8"
        default: return "application/octet-stream"
        }
    }
}

/// 常驻的隐藏引擎：只负责跑页面的计薪逻辑并回传快照
final class WebEngine: NSObject, WKScriptMessageHandler {
    static let startURL = URL(string: "\(AssetSchemeHandler.scheme)://\(AssetSchemeHandler.host)/index.html")!

    private(set) var webView: WKWebView!
    var onSnapshot: ((Snapshot) -> Void)?

    override init() {
        super.init()

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.setURLSchemeHandler(AssetSchemeHandler(), forURLScheme: AssetSchemeHandler.scheme)

        let ucc = WKUserContentController()
        ucc.add(self, name: "mint")
        // 隐藏引擎不需要 10Hz 刷新，把高频 setInterval 降到 1s，省 CPU
        let throttle = """
        (function(){
          var si = window.setInterval;
          window.setInterval = function(fn, ms){
            var args = Array.prototype.slice.call(arguments, 2);
            var d = (typeof ms === 'number' && ms <= 150) ? 1000 : ms;
            return si.apply(window, [fn, d].concat(args));
          };
        })();
        """
        ucc.addUserScript(WKUserScript(source: throttle, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        cfg.userContentController = ucc

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1024, height: 768), configuration: cfg)
        webView.load(URLRequest(url: Self.startURL))
    }

    func reload() {
        webView.load(URLRequest(url: Self.startURL))
    }

    func requestSnapshot(_ completion: @escaping (Snapshot?) -> Void) {
        webView.evaluateJavaScript("JSON.stringify(window.__mintSnapshot ? window.__mintSnapshot() : {error:'no-bridge'})") { obj, _ in
            guard let s = obj as? String,
                  let data = s.data(using: .utf8),
                  let dict = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let snap = Snapshot(dict: dict) else {
                completion(nil)
                return
            }
            completion(snap)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "mint",
              let dict = message.body as? [String: Any],
              let snap = Snapshot(dict: dict) else { return }
        onSnapshot?(snap)
    }
}
