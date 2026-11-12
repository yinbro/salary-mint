import AppKit

if CommandLine.arguments.contains("--selftest") {
    SelfTest.run()
    exit(0)
}

if CommandLine.arguments.contains("--show") {
    Renderer.show()
    exit(0)
}

if CommandLine.arguments.contains("--render") {
    Renderer.run()
    exit(0)
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
