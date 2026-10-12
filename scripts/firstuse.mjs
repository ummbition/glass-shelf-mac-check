// 첫 동작 때만 패널이 불투명해지는지: Obsidian 을 두 번 새로 띄워, 각각 동작 묶음 S 를 녹화. 1회차는 S 를 한 번 더(데운 뒤)
import { execSync, spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ k, v, wall: Date.now() }); console.log(k, JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
const BIN = "/Applications/Obsidian.app/Contents/MacOS/Obsidian";

let ws, send, ev;
const connect = async () => {
  let target;
  for (let i = 0; i < 90 && !target; i++) {
    try { const list = await (await fetch("http://127.0.0.1:9222/json")).json(); target = list.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {}
    if (!target) await sleep(1000);
  }
  if (!target) throw new Error("no target");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  ev = async (expr) => {
    const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description };
    return m.result && m.result.result ? m.result.result.value : m;
  };
};

let area;
const cursor = (x, y) => { try { execSync(`cliclick -e 200 m:${Math.round(area.x + x)},${Math.round(area.y + y)}`); } catch {} };
const move = async (x, y) => { cursor(x, y); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); };
const click = async (x, y) => { await move(x, y); await sleep(100); await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await sleep(60); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
const center = (sel, filter = "true") => ev(`const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0).find((e) => ${filter}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };`);

const setup = async () => {
  await connect();
  for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
  await sleep(1500);
  await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
  await sleep(1500);
  await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) {} app.setting.close();`);
  await sleep(1500);
  area = await ev(`return require("electron").remote.screen.getPrimaryDisplay().workArea;`);
  await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isMaximized()) w.unmaximize(); w.setBounds(${JSON.stringify(area)}); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);
  await ev(`const v = app.workspace.getLeavesOfType("file-explorer")[0]; app.workspace.revealLeaf(v);`);
  // 계측: 필터·툴팁·렌즈 삽입, 프레임 멈춤, 동기 표시
  await ev(`
    window.__lg = []; const L = (kind, d) => window.__lg.push({ t: Math.round(performance.now()), wall: Date.now(), kind, d });
    new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) { if (!(n instanceof Element)) continue;
      if (n.tagName === "filter") L("filter", n.id);
      else if (n.classList.contains("tooltip")) L("tooltip", n.textContent.slice(0, 20));
      else if (n.classList.contains("lg-seg-indicator")) L("lens-el", "");
      else if (n.querySelector && n.querySelector("filter")) L("filters-in", n.querySelectorAll("filter").length); } })
      .observe(document, { subtree: true, childList: true });
    let last = 0; const tick = (t) => { if (last && t - last > 50) L("stall", Math.round(t - last)); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const m = document.createElement("div"); m.id = "lg-mark"; m.style.cssText = "position:fixed;left:700px;bottom:6px;width:24px;height:24px;z-index:99999;background:#000;pointer-events:none;"; document.body.append(m);
    window.__mark = () => { m.style.background = m.style.background === "rgb(0, 0, 0)" ? "#fff" : "#000"; L("mark", m.style.background); };
  `);
  await sleep(2500);
};
const mark = (step) => ev(`window.__mark(); window.__lg.push({ t: Math.round(performance.now()), wall: Date.now(), kind: "step", d: ${JSON.stringify(step)} });`);

const S = async () => {
  const tabs = {
    files: await center(".mod-left-split .workspace-tab-header", `(e.getAttribute("aria-label") || "").includes("Files")`),
    search: await center(".mod-left-split .workspace-tab-header", `(e.getAttribute("aria-label") || "").includes("Search")`),
    bookmarks: await center(".mod-left-split .workspace-tab-header", `(e.getAttribute("aria-label") || "").includes("Bookmarks")`),
  };
  const edBtn = await center(".mod-root .workspace-tab-header-container .clickable-icon, .mod-root .view-header .clickable-icon");
  await mark("1-editor-btn-hover"); if (edBtn) await move(edBtn.x, edBtn.y); await sleep(2000);
  await mark("2-away"); await move(1000, 700); await sleep(1000);
  await mark("3-hover-search-tab"); await move(tabs.search.x, tabs.search.y); await sleep(2500);
  await mark("4a-click-bookmarks"); await click(tabs.bookmarks.x, tabs.bookmarks.y); await sleep(2000);
  await mark("4b-click-files"); await click(tabs.files.x, tabs.files.y); await sleep(2000);
  await mark("4c-click-search"); await click(tabs.search.x, tabs.search.y); await sleep(2000);
  await mark("5-files-scroll"); await click(tabs.files.x, tabs.files.y); await sleep(600);
  await move(200, 500); for (let i = 0; i < 12; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaX: 0, deltaY: 60 }); await sleep(60); }
  await sleep(800); for (let i = 0; i < 12; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaX: 0, deltaY: -60 }); await sleep(60); }
  await sleep(600);
  await mark("6-hover-bookmarks-tab"); await move(tabs.bookmarks.x, tabs.bookmarks.y); await sleep(2000);
  await mark("end"); await move(1000, 700); await sleep(800);
};

const recordS = async (name, reps) => {
  const t0 = Date.now();
  const rec = spawn("screencapture", ["-x", "-V", String(reps * 24), `${OUT}/${name}.mov`]);
  await sleep(1200);
  note(name + "-rec-start", { wall: t0 });
  for (let r = 0; r < reps; r++) { await mark("S" + (r + 1)); await S(); }
  await new Promise((r) => rec.on("exit", r));
  note(name + "-events", await ev(`return window.__lg;`));
};

// 1회차 (워크플로가 이미 띄운 Obsidian)
await setup();
await recordS("L1", 2);
save();
// 2회차: 새로 띄우기
try { ws.close(); } catch {}
try { execSync(`pkill -f "${BIN}"`); } catch {}
await sleep(4000);
spawn(BIN, ["--remote-debugging-port=9222"], { detached: true, stdio: "ignore" }).unref();
await sleep(8000);
await setup();
await recordS("L2", 1);
save();
try { ws.close(); } catch {}
process.exit(0);
