import Foundation
import AppKit

/// 页面通过 WKScriptMessageHandler 上报的实时快照
struct Snapshot {
    var today: Double = 0
    var todayFull: Double = 0
    var progress: Double = 0
    var state: String = ""
    var stateText: String = ""
    var monthMinted: String = "—"
    var monthExpected: String = "—"
    var countdown: String = "—"
    var countdownTitle: String = "倒计时"
    var perSec: String = "—"
    var netMode: Bool = false
    var theme: String = "day"
    var at: Date = Date()

    init() {}

    init?(dict: [String: Any]) {
        guard dict["error"] == nil else { return nil }
        today = (dict["today"] as? NSNumber)?.doubleValue ?? 0
        todayFull = (dict["todayFull"] as? NSNumber)?.doubleValue ?? 0
        progress = (dict["progress"] as? NSNumber)?.doubleValue ?? 0
        state = dict["state"] as? String ?? ""
        stateText = dict["stateText"] as? String ?? ""
        monthMinted = dict["monthMinted"] as? String ?? "—"
        monthExpected = dict["monthExpected"] as? String ?? "—"
        countdown = dict["countdown"] as? String ?? "—"
        countdownTitle = dict["countdownTitle"] as? String ?? "倒计时"
        perSec = dict["perSec"] as? String ?? "—"
        netMode = (dict["netMode"] as? NSNumber)?.boolValue ?? false
        theme = dict["theme"] as? String ?? "day"
        if let ts = (dict["at"] as? NSNumber)?.doubleValue {
            at = Date(timeIntervalSince1970: ts / 1000)
        }
    }
}

enum Fmt {
    /// 面板里用的金额：两位小数、千分位
    static func money(_ v: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        f.groupingSeparator = ","
        return f.string(from: NSNumber(value: v)) ?? String(format: "%.2f", v)
    }

    /// 菜单栏用的紧凑金额，避免太宽
    static func compact(_ v: Double) -> String {
        if v >= 10000 { return String(format: "￥%.1f万", v / 10000) }
        if v >= 1000 { return "￥" + (NumberFormatter.localizedString(from: NSNumber(value: Int(v.rounded())), number: .decimal)) }
        return "￥" + money(v)
    }

    static func percent(_ p: Double) -> String {
        String(format: "%.0f%%", max(0, min(1, p)) * 100)
    }
}

enum Palette {
    static let paper = NSColor(srgbRed: 0.945, green: 0.918, blue: 0.859, alpha: 1)   // #F1EADB
    static let paper3 = NSColor(srgbRed: 0.871, green: 0.824, blue: 0.722, alpha: 1)  // #DED2B8
    static let ink = NSColor(srgbRed: 0.086, green: 0.137, blue: 0.227, alpha: 1)     // #16233A
    static let ink3 = NSColor(srgbRed: 0.447, green: 0.494, blue: 0.573, alpha: 1)    // #727E92
    static let gold = NSColor(srgbRed: 0.659, green: 0.486, blue: 0.165, alpha: 1)    // #A87C2A
    static let live = NSColor(srgbRed: 0.173, green: 0.357, blue: 0.271, alpha: 1)    // #2C5B45
    static let line = NSColor(srgbRed: 0.086, green: 0.137, blue: 0.227, alpha: 0.15)
}

func serifFont(_ size: CGFloat, weight: NSFont.Weight = .regular) -> NSFont {
    for name in ["Songti SC", "STSong", "Noto Serif SC"] {
        if let f = NSFont(name: name, size: size) { return f }
    }
    return NSFont.systemFont(ofSize: size, weight: weight)
}

func monoFont(_ size: CGFloat, weight: NSFont.Weight = .regular) -> NSFont {
    for name in ["SF Mono", "Menlo"] {
        if let f = NSFont(name: name, size: size) { return f }
    }
    return NSFont.monospacedDigitSystemFont(ofSize: size, weight: weight)
}
