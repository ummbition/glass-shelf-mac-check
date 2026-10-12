// 실제 커서(cliclick) 이동이 있을 때만 패널이 불투명해지는지: 같은 동작을 실제 커서 켬/끔 번갈아, 동작마다 패널 자리 사진 연사
import { execSync, spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.OUT || "shots";
setTimeout(() => process.exit(2), 420000);
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ k, v, wall: Date.now() }); console.log(k, JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));

let target;
for (let i = 0; i < 90 && !target; i++) {
  try { const list = await (await fetch("http://127.0.0.1:9222/json")).json(); target = list.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {}
  if (!target) await sleep(1000);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); return m.result && m.result.result ? m.result.result.value : m; };

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);
await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) {} app.setting.close();`);
await sleep(1500);
const area = await ev(`return require("electron").remote.screen.getPrimaryDisplay().workArea;`);
await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isMaximized()) w.unmaximize(); w.setBounds(${JSON.stringify(area)}); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);
await sleep(1500);

let real = false;
const cursor = (x, y) => { if (!real) return; try { execSync(`cliclick -e 150 m:${Math.round(area.x + x)},${Math.round(area.y + y)}`); } catch {} };
const move = async (x, y) => { cursor(x, y); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); };
const click = async (x, y) => { await move(x, y); await sleep(80); await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await sleep(50); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
const center = (sel, filter = "true") => ev(`const e = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0).find((e) => ${filter}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };`);
const tab = (n) => center(".mod-left-split .workspace-tab-header", `(e.getAttribute("aria-label") || "").includes(${JSON.stringify(n)})`);
const T = { files: await tab("Files"), search: await tab("Search"), bookmarks: await tab("Bookmarks") };
const edBtn = await center(".mod-root .workspace-tab-header-container .clickable-icon, .mod-root .view-header .clickable-icon");
note("points", { T, edBtn });

let k = 0;
const burst = async (tag) => { for (let j = 0; j < 4; j++) { await sleep(j ? 180 : 60); try { execSync(`screencapture -x -R30,860,350,100 "${OUT}/${String(k).padStart(3, "0")}-${real ? "real" : "cdp"}-${tag}-${j}.png"`); } catch {} } k++; };
const actions = async () => {
  await move(edBtn.x, edBtn.y); await burst("edhover");
  await move(1000, 700); await burst("away");
  await move(T.search.x, T.search.y); await burst("tabhover");
  await click(T.bookmarks.x, T.bookmarks.y); await burst("click-bm");
  await click(T.files.x, T.files.y); await burst("click-files");
  await click(T.search.x, T.search.y); await burst("click-search");
  await click(T.files.x, T.files.y); await burst("click-files2");
  await move(200, 500); for (let i = 0; i < 10; i++) { cursor(200, 500); await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaX: 0, deltaY: 60 }); await sleep(50); } await burst("scroll");
  for (let i = 0; i < 10; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 500, deltaX: 0, deltaY: -60 }); await sleep(50); } await burst("scrollup");
  await move(T.bookmarks.x, T.bookmarks.y); await burst("tabhover2");
  await move(1000, 700); await burst("away2");
};
if (process.env.RECCMP) {
  real = false;
  for (const recOn of [true, false, true, false, true, false]) {
    let proc = null;
    if (recOn) { proc = spawn("screencapture", ["-x", "-V", "30", `${OUT}/rec-${k}.mov`]); await sleep(1500); }
    const k0 = k;
    await actions();
    note("round", { rec: recOn, from: k0, to: k });
    if (proc) { try { proc.kill("SIGINT"); } catch {} await sleep(1500); }
    save();
  }
  save(); try { ws.close(); } catch {} process.exit(0);
}
for (const r of [true, false, true, false, true, false]) { real = r; if (!r) { try { execSync(`cliclick m:${Math.round(area.x + 1000)},${Math.round(area.y + 700)}`); } catch {} } await actions(); note("round", { real: r, k }); save(); }
save();
try { ws.close(); } catch {}
process.exit(0);
