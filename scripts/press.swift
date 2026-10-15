// macOS 버튼 누름 크기 재기 (hovertest=press). 유리 버튼·툴바 버튼을 실제 마우스로 누른 채 창을 연속 캡처한다
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let app = NSApplication.shared
app.setActivationPolicy(.regular)
var log = [String]()

class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [NSToolbarItem.Identifier("a"), NSToolbarItem.Identifier("b"), .flexibleSpace, NSToolbarItem.Identifier("d")]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    let it = NSToolbarItem(itemIdentifier: id)
    it.image = NSImage(systemSymbolName: ["a": "square.and.arrow.up", "b": "trash", "d": "magnifyingglass"][id.rawValue] ?? "star", accessibilityDescription: nil)
    it.label = id.rawValue; it.isBordered = true; it.target = self; it.action = #selector(noop)
    return it
  }
  @objc func noop() {}
}
let tb = TB()
let w = NSWindow(contentRect: NSRect(x: 300, y: 300, width: 600, height: 300), styleMask: [.titled, .closable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
let toolbar = NSToolbar(identifier: "t"); toolbar.delegate = tb; toolbar.displayMode = .iconOnly
w.toolbar = toolbar; w.toolbarStyle = .unified; w.title = "Press"
let content = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 300))
let big = NSButton(title: "Large", target: tb, action: #selector(TB.noop)); big.bezelStyle = .glass; big.controlSize = .large
big.frame = NSRect(x: 60, y: 120, width: 120, height: 28)
let xl = NSButton(title: "XLarge", target: tb, action: #selector(TB.noop)); xl.bezelStyle = .glass; xl.controlSize = .extraLarge
xl.frame = NSRect(x: 240, y: 116, width: 130, height: 36)
let reg = NSButton(title: "Regular", target: tb, action: #selector(TB.noop)); reg.bezelStyle = .push; reg.controlSize = .regular
reg.frame = NSRect(x: 420, y: 122, width: 100, height: 24)
[big, xl, reg].forEach { content.addSubview($0) }
w.contentView = content
w.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)

func cap(_ name: String) {
  let t = Process(); t.launchPath = "/usr/sbin/screencapture"; t.arguments = ["-x", "-o", "-l", "\(w.windowNumber)", out + "/" + name + ".png"]
  try? t.run(); t.waitUntilExit()
}
func post(_ type: CGEventType, _ p: CGPoint) { CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap) }
func screenPoint(_ v: NSView) -> CGPoint {
  let r = v.window!.convertToScreen(v.convert(v.bounds, to: nil))
  let H = NSScreen.screens[0].frame.height
  return CGPoint(x: r.midX, y: H - r.midY)
}
func toolbarPoint(_ idx: Int) -> CGPoint? {
  // 툴바 항목 뷰를 찾는다
  var views = [NSView]()
  func walk(_ v: NSView) { if String(describing: type(of: v)).contains("NSToolbarItemViewer") { views.append(v) }; v.subviews.forEach(walk) }
  if let f = w.contentView?.superview { walk(f) }
  views.sort { $0.convert($0.bounds, to: nil).minX < $1.convert($1.bounds, to: nil).minX }
  log.append("toolbar viewers: \(views.map { $0.convert($0.bounds, to: nil) })")
  return idx < views.count ? screenPoint(views[idx]) : nil
}

DispatchQueue.global().async {
  Thread.sleep(forTimeInterval: 2.5)
  var targets: [(String, CGPoint)] = []
  DispatchQueue.main.sync {
    targets = [("large", screenPoint(big)), ("xlarge", screenPoint(xl)), ("regular", screenPoint(reg))]
    if let p = toolbarPoint(1) { targets.append(("toolbar", p)) }
    log.append("window \(w.frame) screenH \(NSScreen.screens[0].frame.height)")
  }
  for (name, p) in targets {
    log.append("\(name) at \(p)")
    post(.mouseMoved, p); Thread.sleep(forTimeInterval: 0.6)
    cap("\(name)-0hover")
    post(.leftMouseDown, p)
    let t0 = Date()
    for i in 1...6 { cap("\(name)-\(i)down"); log.append("\(name) down \(i) at \(Int(Date().timeIntervalSince(t0) * 1000))ms") }
    Thread.sleep(forTimeInterval: 0.5); cap("\(name)-7held")
    post(.leftMouseUp, p)
    let t1 = Date()
    for i in 1...4 { cap("\(name)-\(7 + i)up"); log.append("\(name) up \(i) at \(Int(Date().timeIntervalSince(t1) * 1000))ms") }
    post(.mouseMoved, CGPoint(x: 50, y: 50)); Thread.sleep(forTimeInterval: 0.6)
  }
  try? log.joined(separator: "\n").write(toFile: out + "/press.txt", atomically: true, encoding: .utf8)
  DispatchQueue.main.async { app.terminate(nil) }
}
app.run()
