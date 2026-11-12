import AppKit
import WebKit

enum Renderer {
    /// 把面板渲染成 PNG，便于在无 GUI 交互的情况下检查排版
    static func renderPanel(_ snap: Snapshot, to path: String) {
        let vc = PanelController()
        _ = vc.view
        vc.render(snap)
        let fit = vc.view.fittingSize
        let size = NSSize(width: 328, height: max(300, fit.height))
        vc.view.frame = NSRect(origin: .zero, size: size)
        vc.view.layoutSubtreeIfNeeded()

        guard let rep = vc.view.bitmapImageRepForCachingDisplay(in: vc.view.bounds) else { return }
        vc.view.cacheDisplay(in: vc.view.bounds, to: rep)
        if let data = rep.representation(using: .png, properties: [:]) {
            try? data.write(to: URL(fileURLWithPath: path))
            print("panel png: \(path) size=\(Int(size.width))x\(Int(size.height))")
        }
    }

    /// 让完整账本在离屏窗口里跑一遍，用 WebKit 自己的快照接口出图
    static func renderLedger(to path: String, completion: @escaping () -> Void) {
        let controller = LedgerWindowController()
        guard let window = controller.window else { completion(); return }
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        window.setFrame(NSRect(x: 60, y: 120, width: 1180, height: 820), display: true)
        window.makeKeyAndOrderFront(nil)

        DispatchQueue.main.asyncAfter(deadline: .now() + 9) {
            guard let webView = window.contentView?.subviews.compactMap({ $0 as? WKWebView }).first else {
                completion(); return
            }
            webView.frame = window.contentView?.bounds ?? webView.frame
            webView.layoutSubtreeIfNeeded()
            let cfg = WKSnapshotConfiguration()
            cfg.rect = CGRect(origin: .zero, size: webView.bounds.size)
            webView.takeSnapshot(with: cfg) { image, error in
                if let image = image,
                   let tiff = image.tiffRepresentation,
                   let rep = NSBitmapImageRep(data: tiff),
                   let png = rep.representation(using: .png, properties: [:]) {
                    try? png.write(to: URL(fileURLWithPath: path))
                    print("ledger png: \(path) size=\(Int(image.size.width))x\(Int(image.size.height))")
                } else {
                    print("ledger snapshot failed: \(error?.localizedDescription ?? "unknown")")
                }
                window.orderOut(nil)
                completion()
            }
        }
    }

    /// 以悬浮窗形式出现在当前空间（不切换全屏应用），供外部截图核验
    static func show() {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.accessory)
        let controller = LedgerWindowController()
        guard let window = controller.window else { return }
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.level = .floating
        window.setFrame(NSRect(x: 60, y: 90, width: 1180, height: 820), display: true)
        window.orderFrontRegardless()

        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
            if let web = window.contentView?.subviews.compactMap({ $0 as? WKWebView }).first {
                print("webFrame=\(web.frame) bounds=\(web.bounds) url=\(web.url?.absoluteString ?? "nil") loading=\(web.isLoading)")
                web.evaluateJavaScript("JSON.stringify({title:document.title, nodes:document.body.childElementCount, text:document.body.innerText.slice(0,40), ready:document.readyState})") { r, e in
                    print("dom=\(r ?? "nil") err=\(e?.localizedDescription ?? "-")")
                    fflush(stdout)
                }
            }
        }
        print("windowNumber=\(window.windowNumber)")
        fflush(stdout)
        RunLoop.main.run(until: Date().addingTimeInterval(40))
    }

    static func run() {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.prohibited)
        let engine = WebEngine()
        var done = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            engine.requestSnapshot { snap in
                let fallback = Snapshot()
                renderPanel(snap ?? fallback, to: "/tmp/salarymint-panel.png")
                if CommandLine.arguments.contains("--panel-only") {
                    done = true
                } else {
                    renderLedger(to: "/tmp/salarymint-ledger.png") { done = true }
                }
            }
        }

        let deadline = Date().addingTimeInterval(45)
        while !done && Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        }
    }
}
