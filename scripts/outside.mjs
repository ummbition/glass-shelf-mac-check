// body 밑(앱 묶음 바깥) 요소가 다시 그려질 때 패널이 불투명해지는지: 바깥/안 번갈아 작은 네모 색을 바꾸며 녹화
import { execSync, spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.OUT || "shots";
setTimeout(() => process.exit(2), 240000);
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
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1000, y: 700 });
// 네모: 편집창 아래쪽(패널과 떨어진 곳). out = body 밑, in = .app-container 안
await ev(`for (const [id, parent] of [["sq-out", document.body], ["sq-in", document.querySelector(".app-container")]]) { const d = document.createElement("div"); d.id = id; d.style.cssText = "position:fixed;left:" + (id === "sq-out" ? 900 : 960) + "px;bottom:40px;width:30px;height:30px;z-index:99999;background:#000;pointer-events:none;"; parent.append(d); }`);
await sleep(2000);

const shotR = (name) => { try { execSync(`screencapture -x -R30,860,350,100 "${OUT}/${name}.png"`); } catch (e) { note("shot-err", String(e).slice(0, 100)); } };
const PHASES = [["out", 8], ["in", 8], ["out", 8], ["in", 8]];
shotR("base-0"); await sleep(400); shotR("base-1");
let k = 0;
for (const [which, n] of PHASES) {
  for (let i = 0; i < n; i++, k++) {
    await ev(`const d = document.getElementById("sq-${which}"); d.style.background = d.style.background === "rgb(0, 0, 0)" ? "#fff" : "#000";`);
    for (let j = 0; j < 3; j++) { await sleep(j ? 150 : 40); shotR(`${String(k).padStart(2, "0")}-${which}-${j}`); }
    await sleep(300);
  }
}
note("done", k);
save();
try { ws.close(); } catch {}
process.exit(0);
