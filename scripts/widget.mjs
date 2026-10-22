// 위젯 탭 전환 맥 확인: 위젯 방식에서 신호등(창 제어) 호버가 되는지(끌기 띠가 덮는지), 툴바 늘이기(양쪽·왼쪽만·오른쪽만), 조절 표시 펼치기·휠 넘기기·끌기 시작
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const consoleMsgs = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 1500)); };
const save = () => { writeFileSync(`${OUT}/widget.json`, JSON.stringify(log, null, 1)); writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleMsgs, null, 1)); };
setTimeout(() => { save(); process.exit(2); }, 420000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (c) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch (e) { return "ERR " + String(e.message || e).slice(0, 200); } };
let target;
for (let i = 0; i < 90 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9222/json")).json(); target = l.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {} if (!target) await sleep(1000); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); let intercepted = 0;
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Input.dragIntercepted") intercepted++;
  else if (m.method === "Runtime.consoleAPICalled" && /error|warn/.test(m.params.type)) consoleMsgs.push({ type: m.params.type, text: m.params.args.map((a) => a.value !== undefined ? String(a.value) : a.description || "").join(" ").slice(0, 600) });
  else if (m.method === "Runtime.exceptionThrown") consoleMsgs.push({ type: "exception", text: String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 800) });
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description }; return m.result && m.result.result ? m.result.result.value : m; };
const shot = (n, rect) => { sh(`screencapture -x ${rect ? `-R${rect.join(",")}` : ""} "${OUT}/${n}.png"`); };
const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" || type === "mouseWheel" ? "none" : "left", clickCount: 1, ...extra });
const step = async (name, fn) => { try { await fn(); } catch (e) { note(name + "-error", String((e && e.stack) || e)); } save(); };

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);
const hasCliclick = !sh("which cliclick").startsWith("ERR");
note("tools", { cliclick: hasCliclick, sw: sh("sw_vers -productVersion") });

await step("setup", async () => {
  note("setup", await ev(`if (app.plugins.setEnable) await app.plugins.setEnable(true);
    if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf");
    app.customCss.setTheme("Glass Shelf"); app.setting.close(); app.vault.setConfig("nativeMenus", false);
    let pl; for (let i = 0; i < 120; i++) { pl = app.plugins.plugins["glass-shelf"]; if (pl && pl.settings) break;
      if (i === 40 || i === 80) { app.customCss.setTheme(""); await new Promise((r) => setTimeout(r, 500)); await app.plugins.disablePlugin("glass-shelf"); await app.plugins.enablePlugin("glass-shelf"); app.customCss.setTheme("Glass Shelf"); }
      await new Promise((r) => setTimeout(r, 250)); }
    if (!pl || !pl.settings) return { fail: "glass-shelf core not started", body: document.body.className };
    pl.settings.reduceMotion = "off"; await pl.saveSettings();
    await app.workspace.openLinkText("시험", "", false); await new Promise((r) => setTimeout(r, 1200));
    let fe = app.workspace.getLeavesOfType("file-explorer")[0]; if (!fe) { fe = app.workspace.getLeftLeaf(false); await fe.setViewState({ type: "file-explorer" }); }
    if (!app.workspace.getLeavesOfType("search").length) { const s = app.workspace.createLeafInParent(fe.parent, fe.parent.children.length); await s.setViewState({ type: "search", active: false }); }
    let ol = app.workspace.getLeavesOfType("outline")[0]; if (!ol) { ol = app.workspace.getRightLeaf(false); await ol.setViewState({ type: "outline" }); }
    for (const t of ["backlink", "outgoing-link"]) if (!app.workspace.getLeavesOfType(t).length) { const l = app.workspace.createLeafInParent(ol.parent, ol.parent.children.length); await l.setViewState({ type: t, active: false }); }
    app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand(); app.workspace.revealLeaf(fe); app.workspace.revealLeaf(ol);
    window.__pl = pl;
    return { ver: pl.manifest.version, body: document.body.className.slice(0, 300), frameLeft: getComputedStyle(document.body).getPropertyValue("--frame-left-space"), right: ol.parent.children.map((l) => l.view.getViewType()) };`));
  await sleep(1500);
});

// 창 위치·크기(점 좌표)
const winPos = () => { const s = sh(`osascript -e 'tell application "System Events" to tell process "Obsidian" to get {position, size} of window 1'`); const n = s.split(/[, ]+/).map(Number); return n.length >= 4 && n.every((v) => Number.isFinite(v)) ? n : null; };
// 신호등 근처의 끌기 영역(-webkit-app-region: drag) 요소
const TRAFFIC = `const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
  const area = { l: 0, t: 0, r: 90, b: 54 }; const regs = [];
  document.querySelectorAll("*").forEach((e) => { const cs = getComputedStyle(e); if (cs.webkitAppRegion === "drag" && e.getClientRects().length) { const q = e.getBoundingClientRect(); if (q.right > area.l && q.left < area.r && q.bottom > area.t && q.top < area.b) regs.push([e.className.toString().slice(0, 60), ...R(e)]); } });
  const tabs = app.workspace.rootSplit.containerEl.querySelector(".workspace-tabs.mod-top"); const hd = tabs && tabs.querySelector(":scope > .workspace-tab-header-container");
  return { body: [...document.body.classList].filter((c) => /lg-wg|frameless|lg-tab/.test(c)), rootTabs: tabs && tabs.className.split(" ").filter((c) => c.startsWith("lg-wg")), header: hd && R(hd), left: R(app.workspace.leftSplit.containerEl), right: R(app.workspace.rightSplit.containerEl), dragNearTraffic: regs, frameLeft: getComputedStyle(document.body).getPropertyValue("--frame-left-space"), inner: [innerWidth, innerHeight] };`;

const scenarios = process.env.BGONLY ? [["widget", "widget"]] : process.env.DRAGONLY ? [] : [["lens", "lens"], ["widget", "widget"], ["widget", "lens"], ["lens", "widget"]];
for (const [L, Rt] of scenarios) {
  const tag = `${L}-${Rt}`;
  await step(tag, async () => {
    await ev(`const pl = window.__pl; pl.settings.tabAnimLeft = ${JSON.stringify(L)}; pl.settings.tabAnimRight = ${JSON.stringify(Rt)}; await pl.saveSettings(); if (pl.applySettings) pl.applySettings(); pl.requestRefresh(); await new Promise((r) => setTimeout(r, 1500));`);
    const st = await ev(TRAFFIC);
    const wp = winPos();
    note(tag + "-state", { st, win: wp });
    note(tag + "-bg", await ev(`const L = app.workspace.leftSplit.containerEl; const r = L.getBoundingClientRect(); const x = r.right - 6, y = r.top + 300;
      const stack = document.elementsFromPoint(x, y).slice(0, 8).map((e) => { const cs = getComputedStyle(e); return [e.tagName + "." + String(e.className).slice(0, 50), cs.backgroundColor, cs.opacity, cs.backdropFilter.slice(0, 30)]; });
      return { split: getComputedStyle(L).backgroundColor, splitCls: L.className, bodyBg: getComputedStyle(document.body).backgroundColor, bgPrimary: getComputedStyle(document.body).getPropertyValue("--background-primary"), stack };`));
    shot(tag + "-full");
    if (wp && hasCliclick) {
      const [wx, wy] = wp;
      shot(tag + "-tl-before", [wx, wy, 120, 60]);
      // 신호등 세로 자리는 --traffic-lights-offset-y(54) 띠 가운데로 둔다(추정 27). 몇 높이에 올려 본다
      for (const dy of [20, 27, 34]) {
        sh(`cliclick m:${wx + 20},${wy + dy}`); await sleep(700);
        shot(`${tag}-tl-hover-${dy}`, [wx, wy, 120, 60]);
      }
      sh(`cliclick m:${wx + 600},${wy + 400}`); await sleep(300);
    }
  });
}

// 두 패널 위젯: 휠 넘기기(미리 보기 → 멈추면 넘기기), 조절 표시 펼치기, 끌기 시작(왼쪽·오른쪽)
await step("widget-funcs", async () => {
  await ev(`const pl = window.__pl; pl.settings.tabAnimLeft = "widget"; pl.settings.tabAnimRight = "widget"; await pl.saveSettings(); if (pl.applySettings) pl.applySettings(); pl.requestRefresh(); await new Promise((r) => setTimeout(r, 1500));`);
  for (const side of ["left", "right"]) {
    const info = await ev(`const T = document.querySelector(".mod-${side}-split > .workspace-tabs"); const d = T && T.querySelector(".lg-wg-dots"); if (!d) return { none: true };
      const r = d.getBoundingClientRect(); const act = () => { const h = T.querySelector(".workspace-tab-header.is-active"); return h && h.getAttribute("aria-label"); };
      window.__T = T; window.__act = act; window.__pip = () => [...d.querySelectorAll(".lg-wg-pip")].findIndex((p) => p.classList.contains("is-active"));
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, act: act(), n: T.querySelectorAll(".workspace-tab-header").length, widget: T.closest(".workspace-split").classList.contains("lg-tab-widget") };`);
    note(side + "-dots", info);
    if (!info || info.none || info.err) continue;
    await mouse("mouseMoved", info.x, info.y);
    await sleep(300);
    shot(side + "-near");
    const during = [];
    for (let i = 0; i < 2; i++) { await mouse("mouseWheel", info.x, info.y, { deltaX: 0, deltaY: 100 }); await sleep(40); during.push(await ev(`return [window.__act(), window.__pip()];`)); }
    await sleep(120); shot(side + "-wheel-mid");
    await sleep(800);
    const afterWheel = await ev(`return [window.__act(), window.__pip()];`);
    await mouse("mouseMoved", info.x, info.y); await mouse("mousePressed", info.x, info.y); await sleep(60); await mouse("mouseReleased", info.x, info.y);
    await sleep(700); shot(side + "-open");
    const open = await ev(`const T = window.__T; const heads = [...T.querySelectorAll(".workspace-tab-header-container-inner > .workspace-tab-header")]; const h = heads[1]; const b = h && h.getBoundingClientRect();
      return { open: T.classList.contains("lg-wg-open"), tab: b && [b.left + b.width / 2, b.top + b.height / 2], hit: b && String((document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) || {}).className) };`);
    // 끌기 시작: 브라우저가 실제로 끌기를 시작하는지 (끌기 가로채기라 운영체제 끌기 루프에 들어가지 않는다)
    let drag = null;
    if (open && open.tab) {
      await send("Input.setInterceptDrags", { enabled: true });
      const n0 = intercepted; const [x, y] = open.tab; await ev(`window.__ds = 0; document.addEventListener("dragstart", () => window.__ds++, { capture: true, once: true });`);
      await mouse("mouseMoved", x, y); await mouse("mousePressed", x, y, { buttons: 1 });
      for (let i = 1; i <= 8; i++) { await mouse("mouseMoved", x + i * 2, y + i * 3, { button: "left", buttons: 1 }); await sleep(20); }
      await sleep(400);
      drag = { intercepted: intercepted - n0, dragstart: await ev(`return window.__ds || 0;`), horiz: await ev(`return window.__T.classList.contains("lg-wg-drag");`) };
      shot(side + "-drag");
      await send("Input.dispatchDragEvent", { type: "dragCancel", x, y, data: { items: [], dragOperationsMask: 1 } });
      await mouse("mouseReleased", x, y, { buttons: 0 }); await sleep(300);
      await ev(`document.dispatchEvent(new DragEvent("dragend", { bubbles: true }));`);
      await send("Input.setInterceptDrags", { enabled: false });
    }
    await ev(`window.__pl.widgetBar(window.__T, false);`);
    await sleep(500);
    note(side + "-funcs", { before: info.act, during, afterWheel, open, drag });
  }
});
await step("end", async () => { shot("Z-widget-end"); });
save();
process.exit(0);
