// macOS 기본 컨트롤 크기 재기 (hovertest=native). 크기 단계별 fittingSize, 툴바 창의 뷰 계층 프레임, 창 캡처
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let app = NSApplication.shared
app.setActivationPolicy(.regular)
var lines = [String]()
let sizes: [(String, NSControl.ControlSize)] = [("mini", .mini), ("small", .small), ("regular", .regular), ("large", .large), ("extraLarge", .extraLarge)]
func sz(_ v: NSView) -> String { let s = v.fittingSize; return "\(Int(s.width))x\(String(format: "%.1f", s.height))" }
for (n, s) in sizes {
  let b = NSButton(title: "Button", target: nil, action: nil); b.bezelStyle = .push; b.controlSize = s
  let g = NSButton(title: "Button", target: nil, action: nil); g.bezelStyle = .glass; g.controlSize = s
  let ic = NSButton(image: NSImage(systemSymbolName: "plus", accessibilityDescription: nil)!, target: nil, action: nil); ic.bezelStyle = .glass; ic.controlSize = s
  let p = NSPopUpButton(); p.addItem(withTitle: "Item"); p.controlSize = s
  let t = NSTextField(string: "text"); t.controlSize = s
  let sf = NSSearchField(); sf.controlSize = s
  let seg = NSSegmentedControl(labels: ["A", "B"], trackingMode: .selectOne, target: nil, action: nil); seg.controlSize = s
  lines.append("\(n): push \(sz(b)) glass \(sz(g)) glassIcon \(sz(ic)) popup \(sz(p)) text \(sz(t)) search \(sz(sf)) segmented \(sz(seg))")
}

class TB: NSObject, NSToolbarDelegate {
  let ids: [NSToolbarItem.Identifier] = [NSToolbarItem.Identifier("a"), NSToolbarItem.Identifier("b"), NSToolbarItem.Identifier("c"), .flexibleSpace, NSToolbarItem.Identifier("d")]
  func toolbarDefaultItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbarAllowedItemIdentifiers(_ t: NSToolbar) -> [NSToolbarItem.Identifier] { ids }
  func toolbar(_ t: NSToolbar, itemForItemIdentifier id: NSToolbarItem.Identifier, willBeInsertedIntoToolbar f: Bool) -> NSToolbarItem? {
    let it = NSToolbarItem(itemIdentifier: id)
    it.image = NSImage(systemSymbolName: ["a": "square.and.arrow.up", "b": "trash", "c": "folder", "d": "magnifyingglass"][id.rawValue] ?? "star", accessibilityDescription: nil)
    it.label = id.rawValue; it.isBordered = true
    return it
  }
}
let tb = TB()
let w = NSWindow(contentRect: NSRect(x: 200, y: 200, width: 800, height: 420), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
let toolbar = NSToolbar(identifier: "t"); toolbar.delegate = tb; toolbar.displayMode = .iconOnly
w.toolbar = toolbar; w.toolbarStyle = .unified; w.title = "Measure"
let content = NSStackView(); content.orientation = .vertical; content.alignment = .leading; content.edgeInsets = NSEdgeInsets(top: 70, left: 20, bottom: 20, right: 20)
for (n, s) in sizes {
  let row = NSStackView(); row.orientation = .horizontal
  let b = NSButton(title: n, target: nil, action: nil); b.bezelStyle = .push; b.controlSize = s
  let g = NSButton(title: "glass", target: nil, action: nil); g.bezelStyle = .glass; g.controlSize = s
  let p = NSPopUpButton(); p.addItem(withTitle: "Popup"); p.controlSize = s
  let sf = NSSearchField(); sf.controlSize = s; sf.widthAnchor.constraint(equalToConstant: 140).isActive = true
  [b, g, p, sf].forEach { row.addArrangedSubview($0) }
  content.addArrangedSubview(row)
}
w.contentView = content
w.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)

func dump(_ v: NSView, _ d: Int) {
  let f = v.convert(v.bounds, to: nil)
  if d < 14 { lines.append(String(repeating: "  ", count: d) + "\(type(of: v)) \(String(format: "x%.1f y%.1f w%.1f h%.1f", f.minX, f.minY, f.width, f.height))") }
  v.subviews.forEach { dump($0, d + 1) }
}
DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
  if let frame = w.contentView?.superview { lines.append("== window \(w.frame) scale \(w.backingScaleFactor)"); dump(frame, 0) }
  try? lines.joined(separator: "\n").write(toFile: out + "/native.txt", atomically: true, encoding: .utf8)
  let task = Process(); task.launchPath = "/usr/sbin/screencapture"; task.arguments = ["-x", "-o", "-l", "\(w.windowNumber)", out + "/native-window.png"]
  try? task.run(); task.waitUntilExit()
  app.terminate(nil)
}
app.run()
