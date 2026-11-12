import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var popover = NSPopover()
    private let panel = PanelController()
    private var engine: WebEngine!
    private var ledger: LedgerWindowController?
    private var latest: Snapshot?
    private var menu: NSMenu!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        panel.onOpenLedger = { [weak self] in self?.openLedger() }
        panel.onRefresh = { [weak self] in self?.refresh() }
        panel.onQuit = { NSApp.terminate(nil) }
        popover.contentViewController = panel
        popover.behavior = .transient
        popover.animates = true

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.font = NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium)
            button.title = "￥—"
            button.target = self
            button.action = #selector(statusBarClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        buildMenu()

        engine = WebEngine()
        engine.onSnapshot = { [weak self] snap in
            self?.apply(snap)
        }
        // 首次拉一次，避免菜单栏长时间显示占位符
        DispatchQueue.main.asyncAfter(deadline: .now() + 13) { [weak self] in
            self?.refresh()
        }

        // 验收模式：--demo panel / --demo window，免人工点击即可截图
        if let idx = CommandLine.arguments.firstIndex(of: "--demo") {
            let what = CommandLine.arguments.count > idx + 1 ? CommandLine.arguments[idx + 1] : "panel"
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
                guard let self = self else { return }
                if what == "window" { self.openLedger() } else { self.togglePopover() }
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { self.refresh() }
            }
        }
    }

    private func buildMenu() {
        menu = NSMenu()
        menu.addItem(withTitle: "打开完整账本", action: #selector(openLedger), keyEquivalent: "").target = self
        menu.addItem(withTitle: "立即刷新", action: #selector(refresh), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "重新载入页面", action: #selector(reloadPages), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "退出", action: #selector(quit), keyEquivalent: "q").target = self
    }

    // MARK: - 数据

    private func apply(_ snap: Snapshot) {
        latest = snap
        updateStatusTitle()
        if popover.isShown { panel.render(snap) }
    }

    private func updateStatusTitle() {
        guard let button = statusItem.button else { return }
        var text = "￥—"
        if let snap = latest { text = Fmt.compact(snap.today) }
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 11, weight: .medium),
            .baselineOffset: 0.5
        ]
        button.attributedTitle = NSAttributedString(string: text, attributes: attrs)
        if CommandLine.arguments.contains("--dump-status") {
            print("statusTitle=\(text) at \(Date())")
            fflush(stdout)
        }
    }

    @objc private func refresh() {
        engine.requestSnapshot { [weak self] snap in
            guard let self = self, let snap = snap else { return }
            self.apply(snap)
        }
    }

    // MARK: - 交互

    @objc private func statusBarClicked(_ sender: Any?) {
        let event = NSApp.currentEvent
        if event?.type == .rightMouseUp {
            showContextMenu()
        } else {
            togglePopover()
        }
    }

    private func showContextMenu() {
        guard let button = statusItem.button else { return }
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.height + 4), in: button)
    }

    private func togglePopover() {
        if popover.isShown {
            popover.performClose(nil)
            return
        }
        guard let button = statusItem.button else { return }
        refresh()
        if let snap = latest { panel.render(snap) }
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        popover.contentViewController?.view.window?.makeKey()
    }

    @objc private func openLedger() {
        popover.performClose(nil)
        if ledger == nil {
            let controller = LedgerWindowController()
            controller.onClose = { [weak self] in
                // 账本里改了设置后，隐藏引擎需要重新载入才能读到新的 localStorage
                self?.engine.reload()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self?.refresh() }
            }
            ledger = controller
        }
        ledger?.present()
    }

    @objc private func reloadPages() {
        engine.reload()
        ledger?.load()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in self?.refresh() }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
