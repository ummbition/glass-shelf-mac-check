// Sidebar Columns 호환 맥 확인: 위젯·렌즈 패널에서 좌우로 나눈 칸의 틀 자리·간격, 칸 접기 버튼 자리, 접힌 칸 펼치기 버튼(.lg-sc-open),
// 묶음 경계 끌기(놓은 곳에 멈추는지), 탭 하나 묶음 점 숨김
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const consoleMsgs = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 1500)); };
const save = () => { writeFileSync(`${OUT}/columns.json`, JSON.stringify(log, null, 1)); writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleMsgs, null, 1)); };
setTimeout(() => { save(); process.exit(2); }, 420000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (c) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch (e) { return "ERR " + String(e.message || e).slice(0, 200); } };
let target;
for (let i = 0; i < 90 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9222/json")).json(); target = l.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {} if (!target) await sleep(1000); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled" && /error|warn/.test(m.params.type)) consoleMsgs.push({ type: m.params.type, text: m.params.args.map((a) => a.value !== undefined ? String(a.value) : a.description || "").join(" ").slice(0, 600) });
  else if (m.method === "Runtime.exceptionThrown") consoleMsgs.push({ type: "exception", text: String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 800) });
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description }; return m.result && m.result.result ? m.result.result.value : m; };
const shot = (n) => { sh(`screencapture -x "${OUT}/${n}.png"`); };
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1, ...extra });
const step = async (name, fn) => { try { await fn(); } catch (e) { note(name + "-error", String((e && e.stack) || e)); } save(); };

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);
note("tools", { sw: sh("sw_vers -productVersion") });

await step("setup", async () => {
  note("setup", await ev(`if (app.plugins.setEnable) await app.plugins.setEnable(true);
    if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf");
    if (!app.plugins.plugins["sidebar-columns"]) await app.plugins.enablePluginAndSave("sidebar-columns");
    app.customCss.setTheme("Glass Shelf"); app.setting.close(); app.vault.setConfig("nativeMenus", false);
    let pl; for (let i = 0; i < 120; i++) { pl = app.plugins.plugins["glass-shelf"]; if (pl && pl.settings) break; await new Promise((r) => setTimeout(r, 250)); }
    if (!pl || !pl.settings) return { fail: "glass-shelf core not started" };
    pl.settings.reduceMotion = "off"; pl.settings.tabAnimLeft = "widget"; pl.settings.tabAnimRight = "widget"; await pl.saveSettings(); if (pl.applySettings) pl.applySettings();
    await app.workspace.openLinkText("시험", "", false); await new Promise((r) => setTimeout(r, 1200));
    let fe = app.workspace.getLeavesOfType("file-explorer")[0]; if (!fe) { fe = app.workspace.getLeftLeaf(false); await fe.setViewState({ type: "file-explorer" }); }
    // 오른쪽 패널: 위 묶음 [개요, 나가는 링크], 아래 묶음 [백링크] — 아래 묶음을 좌우로 나눈다
    let ol = app.workspace.getLeavesOfType("outline")[0]; if (!ol) { ol = app.workspace.getRightLeaf(false); await ol.setViewState({ type: "outline" }); }
    if (!app.workspace.getLeavesOfType("outgoing-link").length) { const l = app.workspace.createLeafInParent(ol.parent, ol.parent.children.length); await l.setViewState({ type: "outgoing-link", active: false }); }
    // 아래 묶음: 오른쪽 패널에 새 묶음을 만들어 백링크를 연다 (같은 묶음에 이미 있으면 닫고 다시)
    for (const l of app.workspace.getLeavesOfType("backlink")) l.detach();
    const bl = app.workspace.getRightLeaf(true); await bl.setViewState({ type: "backlink" });
    app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand(); app.workspace.revealLeaf(fe); app.workspace.revealLeaf(ol);
    window.__pl = pl;
    const sc = app.plugins.plugins["sidebar-columns"];
    return { ver: pl.manifest.version, sc: sc && sc.manifest.version, ack: sc && sc.settings, right: app.workspace.rightSplit.children.map((c) => c.type + ":" + (c.children || []).map((l) => l.view && l.view.getViewType()).join(",")) };`));
  await sleep(1200);
  // 아래 묶음(백링크)을 오른쪽으로 나누고, 새 칸에 태그 보기를 연다
  note("split", await ev(`const bl = app.workspace.getLeavesOfType("backlink")[0]; app.workspace.setActiveLeaf(bl, { focus: true }); await new Promise((r) => setTimeout(r, 400));
    let ok = app.commands.executeCommandById("sidebar-columns:split-right"); await new Promise((r) => setTimeout(r, 2000));
    // 시험한 적 없는 Obsidian 판이면 묻는다: 시험 보관함이라 허용하고 다시 나눈다
    const allow = [...document.querySelectorAll(".modal-container button")].find((b) => /Allow experimental use/i.test(b.textContent));
    const allowed = !!allow; if (allow) { allow.click(); await new Promise((r) => setTimeout(r, 1200)); app.workspace.setActiveLeaf(bl, { focus: true }); await new Promise((r) => setTimeout(r, 300)); ok = app.commands.executeCommandById("sidebar-columns:split-right"); await new Promise((r) => setTimeout(r, 2500)); }
    const notices = [...document.querySelectorAll(".notice")].map((n) => n.textContent);
    const modal = [...document.querySelectorAll(".modal-container")].map((m) => m.textContent.slice(0, 200));
    const tree = (it) => ({ t: it.type, d: it.direction, kids: (it.children || []).filter((c) => c.type !== "leaf").map(tree), leaves: (it.children || []).filter((c) => c.type === "leaf").map((l) => l.view && l.view.getViewType()) });
    const empty = app.workspace.getLeavesOfType("empty").find((l) => l.getRoot() === app.workspace.rightSplit);
    if (empty) await empty.setViewState({ type: "tag" });
    await new Promise((r) => setTimeout(r, 1200));
    return { ok, allowed, notices, modal, tree: tree(app.workspace.rightSplit) };`));
});

const MEASURE = `const s = app.workspace.rightSplit; const R = s.containerEl.getBoundingClientRect();
  const g = [...s.containerEl.querySelectorAll(".workspace-tabs")].map((t) => { const f = t.querySelector(":scope > .workspace-tab-container").getBoundingClientRect();
    const h = t.querySelector(":scope > .workspace-tab-header-container");
    const vis = [...h.children].filter((c) => c.getBoundingClientRect().width > 0 && getComputedStyle(c).display !== "none").map((c) => { const m = c.className.match(/lg-nav-more|sidebar-columns-collapse|lg-sc-open|lg-wg-title/); return m ? m[0] + "@" + Math.round(c.getBoundingClientRect().left - R.left) + "w" + Math.round(c.getBoundingClientRect().width) : null; }).filter(Boolean);
    const pips = t.querySelector(".lg-wg-pips");
    return { cls: (t.className.match(/lg-sb-\\w+|lg-one|lg-wg-short|lg-wg-title-up/g) || []).join(","), frame: [f.left - R.left, f.top - R.top, f.right - R.left, f.bottom - R.top].map(Math.round), vis, pips: pips && getComputedStyle(pips).opacity };
  });
  const nested = s.containerEl.querySelector(".workspace-split.mod-vertical");
  return { W: Math.round(R.width), split: s.containerEl.className, nestedBg: nested && getComputedStyle(nested).backgroundColor, body: [...document.body.classList].filter((c) => /translucent|theme-|lg-tab|lg-wg/.test(c)), g };`;

for (const mode of ["widget", "lens"]) {
  await step(mode, async () => {
    await ev(`const pl = window.__pl; pl.settings.tabAnimRight = ${JSON.stringify(mode)}; await pl.saveSettings(); if (pl.applySettings) pl.applySettings(); pl.requestRefresh(); await new Promise((r) => setTimeout(r, 1500));`);
    note(mode + "-measure", await ev(MEASURE));
    shot(mode + "-1-split");
    // 칸 접기: 그 플러그인 버튼을 누른다
    note(mode + "-collapse", await ev(`const b = [...app.workspace.rightSplit.containerEl.querySelectorAll(".sidebar-columns-collapse")].find((x) => !x.disabled); if (!b) return { none: true };
      b.click(); await new Promise((r) => setTimeout(r, 2000));
      const c = app.workspace.rightSplit.containerEl.querySelector(".sidebar-columns-collapsed");
      return { collapsed: !!c, fold: c && c.classList.contains("lg-sc-fold"), w: c && c.offsetWidth, mr: c && getComputedStyle(c).marginRight, vis: c && getComputedStyle(c).visibility, proxy: !!app.workspace.rightSplit.containerEl.querySelector(".lg-sc-open") };`));
    note(mode + "-folded", await ev(MEASURE));
    shot(mode + "-2-folded");
    note(mode + "-expand", await ev(`const p = app.workspace.rightSplit.containerEl.querySelector(".lg-sc-open"); if (!p) return { none: true };
      p.click(); await Promise.resolve(); const sync = { proxy: !!app.workspace.rightSplit.containerEl.querySelector(".lg-sc-open"), collapsed: !!app.workspace.rightSplit.containerEl.querySelector(".sidebar-columns-collapsed") };
      await new Promise((r) => setTimeout(r, 1200));
      return { sync, after: { proxy: !!app.workspace.rightSplit.containerEl.querySelector(".lg-sc-open"), collapsed: !!app.workspace.rightSplit.containerEl.querySelector(".sidebar-columns-collapsed") } };`));
    note(mode + "-expanded", await ev(MEASURE));
  });
}

// 묶음 경계 끌기 (위젯): 위 묶음과 아래 줄 사이 경계를 60px 끌어 놓은 곳에 멈추는지
await step("resize", async () => {
  await ev(`const pl = window.__pl; pl.settings.tabAnimRight = "widget"; await pl.saveSettings(); if (pl.applySettings) pl.applySettings(); pl.requestRefresh(); await new Promise((r) => setTimeout(r, 1500));`);
  for (const which of ["top", "row"]) {
    const h = await ev(`const s = app.workspace.rightSplit; const it = ${which === "top" ? "s.children[0]" : "s.children.find((c) => c.type === 'split')"}; if (!it || !it.resizeHandleEl) return { none: true };
      window.__dims = s.children.map((c) => c.dimension); const r = it.resizeHandleEl.getBoundingClientRect(); window.__H = it.resizeHandleEl;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, last: s.children.indexOf(it) === s.children.length - 1 };`);
    if (!h || h.none || h.err || h.last) { note("resize-" + which, h); continue; }
    await mouse("mouseMoved", h.x, h.y); await mouse("mousePressed", h.x, h.y, { buttons: 1 });
    for (let i = 1; i <= 10; i++) { await mouse("mouseMoved", h.x, h.y + i * 6, { button: "left", buttons: 1 }); await sleep(20); }
    await mouse("mouseReleased", h.x, h.y + 60, { buttons: 0 }); await sleep(600);
    note("resize-" + which, await ev(`const r = window.__H.getBoundingClientRect(); const y = r.top + r.height / 2; const s = app.workspace.rightSplit;
      const out = { mouse: ${h.y + 60}, handle: Math.round(y), diff: Math.round(y - ${h.y + 60}) }; s.children.forEach((c, i) => c.setDimension(window.__dims[i])); return out;`));
    await sleep(500);
  }
});

await step("dark", async () => {
  await ev(`app.changeTheme ? app.changeTheme("obsidian") : app.setTheme("obsidian"); await new Promise((r) => setTimeout(r, 1500));`);
  note("dark-measure", await ev(MEASURE));
  shot("widget-3-dark");
  await ev(`app.changeTheme ? app.changeTheme("moonstone") : app.setTheme("moonstone"); await new Promise((r) => setTimeout(r, 800));`);
});
await step("end", async () => { shot("Z-columns-end"); });
save();
process.exit(0);
