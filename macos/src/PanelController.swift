import AppKit

final class BarView: NSView {
    var progress: Double = 0 { didSet { needsDisplay = true } }

    override var isFlipped: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        let h: CGFloat = 6
        let track = NSBezierPath(roundedRect: NSRect(x: 0, y: (bounds.height - h) / 2, width: bounds.width, height: h),
                                 xRadius: h / 2, yRadius: h / 2)
        Palette.paper3.setFill()
        track.fill()

        let w = max(0, min(1, progress)) * bounds.width
        if w > 0.5 {
            let fill = NSBezierPath(roundedRect: NSRect(x: 0, y: (bounds.height - h) / 2, width: max(w, h), height: h),
                                    xRadius: h / 2, yRadius: h / 2)
            Palette.gold.setFill()
            fill.fill()
        }
    }
}

final class DividerView: NSView {
    override var isFlipped: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        Palette.line.setFill()
        NSRect(x: 0, y: 0, width: bounds.width, height: 1).fill()
    }
    override var intrinsicContentSize: NSSize { NSSize(width: NSView.noIntrinsicMetric, height: 1) }
}

final class PanelController: NSViewController {
    var onOpenLedger: (() -> Void)?
    var onRefresh: (() -> Void)?
    var onQuit: (() -> Void)?

    private let stateLabel = NSTextField(labelWithString: "—")
    private let amountLabel = NSTextField(labelWithString: "—")
    private let targetLabel = NSTextField(labelWithString: "—")
    private let progressLabel = NSTextField(labelWithString: "—")
    private let bar = BarView()
    private let monthMinted = NSTextField(labelWithString: "—")
    private let monthExpected = NSTextField(labelWithString: "—")
    private let perSec = NSTextField(labelWithString: "—")
    private let countdown = NSTextField(labelWithString: "—")
    private let countdownCaption = NSTextField(labelWithString: "倒计时")
    private var countdownKey: NSTextField!
    private let updatedLabel = NSTextField(labelWithString: "")

    private static let panelWidth: CGFloat = 328

    override func loadView() {
        let root = NSView(frame: NSRect(x: 0, y: 0, width: Self.panelWidth, height: 320))
        root.wantsLayer = true
        root.layer?.backgroundColor = Palette.paper.cgColor
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
    }

    private func buildUI() {
        let pad: CGFloat = 18

        let title = NSTextField(labelWithString: "薪水铸币厂")
        title.font = serifFont(15, weight: .semibold)
        title.textColor = Palette.ink

        stateLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        stateLabel.textColor = Palette.ink3
        stateLabel.alignment = .right
        stateLabel.setContentHuggingPriority(.defaultHigh, for: .horizontal)

        let headRow = NSStackView(views: [title, NSView(), stateLabel])
        headRow.orientation = .horizontal
        headRow.alignment = .firstBaseline
        headRow.spacing = 8

        let caption = NSTextField(labelWithString: "今日已铸")
        caption.font = NSFont.systemFont(ofSize: 10.5, weight: .medium)
        caption.textColor = Palette.ink3

        amountLabel.attributedStringValue = amountText(0)
        amountLabel.isBezeled = false
        amountLabel.drawsBackground = false

        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.heightAnchor.constraint(equalToConstant: 12).isActive = true

        progressLabel.font = monoFont(11)
        progressLabel.textColor = Palette.ink3
        progressLabel.alignment = .right

        targetLabel.font = NSFont.systemFont(ofSize: 11)
        targetLabel.textColor = Palette.ink3

        let barRow = NSStackView(views: [bar, progressLabel])
        barRow.orientation = .horizontal
        barRow.alignment = .centerY
        barRow.spacing = 10
        progressLabel.widthAnchor.constraint(equalToConstant: 42).isActive = true

        let barCaptionRow = NSStackView(views: [targetLabel, NSView()])
        barCaptionRow.orientation = .horizontal

        let divider1 = DividerView()

        let pairs: [(String, NSTextField)] = [
            ("本月已铸", monthMinted),
            ("本月应铸", monthExpected),
            ("每秒进账", perSec),
            (countdownCaption.stringValue, countdown)
        ]
        for (_, value) in pairs {
            value.font = monoFont(12, weight: .medium)
            value.textColor = Palette.ink
            value.alignment = .right
        }

        var pairViews: [NSStackView] = []
        for (title, value) in pairs {
            let key = makeKeyLabel(title)
            if title == "倒计时" { countdownKey = key }
            let pair = NSStackView(views: [key, NSView(), value])
            pair.orientation = .horizontal
            pair.alignment = .firstBaseline
            pair.spacing = 6
            key.setContentHuggingPriority(.required, for: .horizontal)
            value.setContentHuggingPriority(.required, for: .horizontal)
            pairViews.append(pair)
        }
        let gridRow1 = NSStackView(views: [pairViews[0], pairViews[1]])
        let gridRow2 = NSStackView(views: [pairViews[2], pairViews[3]])
        for row in [gridRow1, gridRow2] {
            row.orientation = .horizontal
            row.distribution = .fillEqually
            row.spacing = 14
        }
        let gridColumn = NSStackView(views: [gridRow1, gridRow2])
        gridColumn.orientation = .vertical
        gridColumn.alignment = .leading
        gridColumn.spacing = 9

        let divider2 = DividerView()

        let openBtn = GoldButton(title: "打开完整账本", target: self, action: #selector(openLedgerTapped))
        openBtn.keyEquivalent = "\r"
        openBtn.translatesAutoresizingMaskIntoConstraints = false
        openBtn.heightAnchor.constraint(equalToConstant: 34).isActive = true
        openBtn.widthAnchor.constraint(greaterThanOrEqualToConstant: 132).isActive = true

        let refreshBtn = NSButton(title: "刷新", target: self, action: #selector(refreshTapped))
        refreshBtn.isBordered = false
        refreshBtn.font = NSFont.systemFont(ofSize: 12)
        refreshBtn.contentTintColor = Palette.ink3

        let quitBtn = NSButton(title: "退出", target: self, action: #selector(quitTapped))
        quitBtn.bezelStyle = .inline
        quitBtn.isBordered = false
        quitBtn.contentTintColor = Palette.ink3
        quitBtn.font = NSFont.systemFont(ofSize: 11)

        let btnRow = NSStackView(views: [openBtn, refreshBtn, NSView(), quitBtn])
        btnRow.orientation = .horizontal
        btnRow.alignment = .centerY
        btnRow.spacing = 8

        updatedLabel.font = NSFont.systemFont(ofSize: 9.5)
        updatedLabel.textColor = Palette.ink3.withAlphaComponent(0.75)

        let stack = NSStackView(views: [headRow, caption, amountLabel, barRow, barCaptionRow,
                                       divider1, gridColumn, divider2, btnRow, updatedLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.setCustomSpacing(2, after: headRow)
        stack.setCustomSpacing(4, after: caption)
        stack.setCustomSpacing(10, after: amountLabel)
        stack.setCustomSpacing(12, after: divider1)
        stack.setCustomSpacing(12, after: divider2)
        stack.setCustomSpacing(10, after: btnRow)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: pad),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -pad),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14)
        ])

        for v in [headRow, barRow, barCaptionRow, divider1, gridColumn, divider2, btnRow] {
            v.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }
        barRow.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        for row in [gridRow1, gridRow2] {
            row.widthAnchor.constraint(equalTo: gridColumn.widthAnchor).isActive = true
        }
        bar.isHidden = false

        view.layoutSubtreeIfNeeded()
    }

    private func makeKeyLabel(_ text: String) -> NSTextField {
        let l = NSTextField(labelWithString: text)
        l.font = NSFont.systemFont(ofSize: 10.5)
        l.textColor = Palette.ink3
        return l
    }

    private func amountText(_ v: Double) -> NSAttributedString {
        let s = NSMutableAttributedString()
        s.append(NSAttributedString(string: "￥", attributes: [
            .font: serifFont(20, weight: .regular),
            .foregroundColor: Palette.gold,
            .baselineOffset: 9
        ]))
        s.append(NSAttributedString(string: Fmt.money(v), attributes: [
            .font: monoFont(34, weight: .semibold),
            .foregroundColor: Palette.gold
        ]))
        return s
    }

    func render(_ snap: Snapshot) {
        amountLabel.attributedStringValue = amountText(snap.today)
        stateLabel.stringValue = snap.stateText.isEmpty ? "—" : snap.stateText
        stateLabel.textColor = snap.state == "work" ? Palette.live : Palette.ink3
        progressLabel.stringValue = Fmt.percent(snap.progress)
        bar.progress = snap.progress
        targetLabel.stringValue = "今日应铸 ￥" + Fmt.money(snap.todayFull)
        monthMinted.stringValue = snap.monthMinted.isEmpty ? "—" : snap.monthMinted
        monthExpected.stringValue = snap.monthExpected.isEmpty ? "—" : snap.monthExpected
        perSec.stringValue = snap.perSec.isEmpty ? "—" : snap.perSec
        countdown.stringValue = snap.countdown.isEmpty ? "—" : snap.countdown
        let cdTitle = snap.countdownTitle.isEmpty ? "倒计时" : snap.countdownTitle
        countdownCaption.stringValue = cdTitle
        countdownKey?.stringValue = cdTitle
        let tf = DateFormatter()
        tf.dateFormat = "HH:mm:ss"
        updatedLabel.stringValue = "更新于 " + tf.string(from: snap.at) + (snap.netMode ? " · 到手口径" : " · 税前口径")
    }

    @objc private func openLedgerTapped() { onOpenLedger?() }
    @objc private func refreshTapped() { onRefresh?() }
    @objc private func quitTapped() { onQuit?() }
}


final class GoldButton: NSButton {
    override var isHighlighted: Bool {
        didSet { needsDisplay = true }
    }

    override func draw(_ dirtyRect: NSRect) {
        let base = Palette.gold
        let fill = isHighlighted ? (base.blended(withFraction: 0.18, of: .black) ?? base) : base
        fill.setFill()
        NSBezierPath(roundedRect: bounds, xRadius: 8, yRadius: 8).fill()

        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13, weight: .medium),
            .foregroundColor: NSColor(calibratedWhite: 1, alpha: 0.96)
        ]
        let text = NSAttributedString(string: title, attributes: attrs)
        let size = text.size()
        text.draw(at: NSPoint(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2))
    }
}
