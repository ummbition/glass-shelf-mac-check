// 앞 창의 접근성 트리를 돌며 역할·제목·위치·크기를 적는다 (사파리 탭 컨테이너 재기, hovertest=safaritabs)
import AppKit
import ApplicationServices
let name = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Safari"
print("AX trusted:", AXIsProcessTrusted())
guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == name }) else { print("앱 없음"); exit(0) }
let ax = AXUIElementCreateApplication(app.processIdentifier)
func attr(_ e: AXUIElement, _ a: String) -> AnyObject? { var v: AnyObject?; AXUIElementCopyAttributeValue(e, a as CFString, &v); return v }
func walk(_ e: AXUIElement, _ d: Int) {
  if d > 9 { return }
  let role = attr(e, kAXRoleAttribute) as? String ?? "?"
  let sub = attr(e, kAXSubroleAttribute) as? String ?? ""
  let title = (attr(e, kAXTitleAttribute) as? String) ?? (attr(e, kAXDescriptionAttribute) as? String) ?? ""
  var p = CGPoint.zero, s = CGSize.zero
  if let pv = attr(e, kAXPositionAttribute) { AXValueGetValue(pv as! AXValue, .cgPoint, &p) }
  if let sv = attr(e, kAXSizeAttribute) { AXValueGetValue(sv as! AXValue, .cgSize, &s) }
  if p.y < 200 || d < 2 { print(String(repeating: "  ", count: d) + "\(role) \(sub) '\(title.prefix(30))' x\(Int(p.x)) y\(Int(p.y)) w\(Int(s.width)) h\(Int(s.height))") }
  for c in (attr(e, kAXChildrenAttribute) as? [AXUIElement] ?? []) { walk(c, d + 1) }
}
for w in (attr(ax, kAXWindowsAttribute) as? [AXUIElement] ?? []) { walk(w, 0) }
