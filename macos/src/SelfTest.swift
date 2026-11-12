import AppKit

enum SelfTest {
    static func run() {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.prohibited)

        let engine = WebEngine()
        var finished = false

        // 等页面脚本初始化完成（app.js 会建 M 与 cfg）
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            engine.webView.evaluateJavaScript(Self.probeScript) { result, error in
                var report: [String: Any] = [:]
                report["timerPhase"] = "after5s"
                if let s = result as? String, let d = s.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: d) {
                    report["page"] = obj
                }
                if let error = error { report["pageError"] = error.localizedDescription }

                engine.requestSnapshot { snap in
                    if let snap = snap {
                        report["snapshot"] = [
                            "today": snap.today,
                            "todayFull": snap.todayFull,
                            "progress": snap.progress,
                            "state": snap.state,
                            "stateText": snap.stateText,
                            "monthMinted": snap.monthMinted,
                            "countdown": snap.countdown,
                            "at": ISO8601DateFormatter().string(from: snap.at)
                        ]
                    } else {
                        report["snapshot"] = "nil"
                    }
                    if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]),
                       let text = String(data: data, encoding: .utf8) {
                        print(text)
                    }
                    finished = true
                }
            }
        }

        let deadline = Date().addingTimeInterval(20)
        while !finished && Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        }
    }

    private static let probeScript = """
    (function(){
      var out = { title: document.title, href: location.href };
      try {
        out.keys = [];
        for (var i = 0; i < localStorage.length; i++) out.keys.push(localStorage.key(i));
        out.previousProbe = localStorage.getItem('__selftest_probe');
        localStorage.setItem('__selftest_probe', String(Date.now()));
        out.storage = 'ok';
      } catch (e) {
        out.storage = 'error';
        out.storageError = String(e && e.message || e);
      }
      try {
        out.typeofM = typeof M;
        out.typeofCfg = typeof cfg;
        out.typeofPR = typeof PR === 'undefined' ? 'undefined' : Object.keys(PR).slice(0,6);
        out.bridgeFn = typeof window.__mintSnapshot;
        out.errors = window.__mintErrors || [];
        out.snapRaw = window.__mintSnapshot ? JSON.stringify(window.__mintSnapshot()) : 'no-fn';
        out.snapshotReady = !!(window.__mintSnapshot && window.__mintSnapshot().today !== undefined);
        out.bridge = !!window.webkit && !!window.webkit.messageHandlers.mint;
      } catch (e2) { out.snapshotReady = 'error:' + e2; }
      out.readyState = document.readyState;
      return JSON.stringify(out);
    })()
    """
}
