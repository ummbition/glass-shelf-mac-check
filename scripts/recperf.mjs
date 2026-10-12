// 맥 녹화 + 성능 비교. 테마+플러그인, 반투명 창 켠 상태에서 시작
import { execSync, spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = () => writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));

let target;
for (let i = 0; i < 90 && !target; i++) {
  try { const list = await (await fetch("http://127.0.0.1:9222/json")).json(); target = list.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {}
  if (!target) await sleep(1000);
}
if (!target) { note("error", "no CDP target"); save(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description };
  return m.result && m.result.result ? m.result.result.value : m;
};
const move = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
const wheel = (x, y, dy) => send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: dy });
const click = async (x, y) => { await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());`);
await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isFullScreen()) w.setFullScreen(false); if (w.isMaximized()) w.unmaximize(); const d = require("electron").remote.screen.getPrimaryDisplay().workArea; w.setBounds({ x: d.x + 120, y: d.y + 40, width: d.width - 160, height: d.height - 80 });`);
// 스크롤할 만큼 긴 문서
await ev(`const body = Array.from({ length: 120 }, (_, i) => "## 제목 " + i + "\\n\\n" + "본문 줄입니다. ".repeat(20)).join("\\n\\n"); let f = app.vault.getAbstractFileByPath("긴 문서.md"); if (!f) f = await app.vault.create("긴 문서.md", body); app.workspace.leftSplit.expand(); await app.workspace.getLeaf().openFile(f);`);
await ev(`app.customCss.setTheme("Glass Shelf");`);
await sleep(1000);
note("enable", await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return String(e); } return Object.keys(app.plugins.plugins);`));
await sleep(2000);
await ev(`app.setting.close();`);
await sleep(1500);
await ev(`const w = require("electron").remote.getCurrentWindow(); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);
await sleep(800);

// 움직일 자리
const P = await ev(`const vis = (s) => [...document.querySelectorAll(s)].filter((x) => x.getBoundingClientRect().width > 0).map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }); return { side: vis(".mod-left-split .workspace-tab-header-container .clickable-icon").slice(0, 6), tabs: vis(".mod-left-split .workspace-tab-header-container-inner .workspace-tab-header").slice(0, 3), ed: vis(".mod-root .workspace-tab-header-container .clickable-icon, .mod-root .view-header .clickable-icon").slice(0, 4) };`);
note("points", P);

// 한 묶음 동작: 패널 버튼 훑기 → 패널 탭 누르기 → 편집창 버튼 훑기 → 편집창 스크롤
const workload = async () => {
  for (let r = 0; r < 2; r++) for (const p of P.side) { await move(p.x, p.y); await sleep(90); await move(p.x, p.y + 60); await sleep(60); }
  for (const p of P.tabs) { await click(p.x, p.y); await sleep(250); }
  if (P.tabs[0]) { await click(P.tabs[0].x, P.tabs[0].y); await sleep(250); }
  for (const p of P.ed) { await move(p.x, p.y); await sleep(120); }
  await move(1000, 600);
  for (let i = 0; i < 15; i++) { await wheel(1000, 600, 120); await sleep(40); }
  for (let i = 0; i < 15; i++) { await wheel(1000, 600, -120); await sleep(40); }
  await sleep(300);
};

const STYLE_IDS = ["cfg-nofix", "cfg-norefract"];
const setCfg = async (cfg) => {
  await ev(`for (const id of ${JSON.stringify(STYLE_IDS)}) { const e = document.getElementById(id); if (e) e.remove(); }`);
  const p = `app.plugins.plugins["glass-shelf"]`;
  await ev(`const p = ${p}; const want = ${JSON.stringify(cfg)} !== "norefract"; if (p.settings.refraction !== want) { p.settings.refraction = want; p.applySettings(); }`);
  if (cfg === "off") { await ev(`app.customCss.setTranslucency(false);`); }
  else { await ev(`if (!document.body.classList.contains("is-translucent")) app.customCss.setTranslucency(true);`); }
  if (cfg === "nofix") await ev(`const st = document.createElement("style"); st.id = "cfg-nofix"; st.textContent = "body.lg-acrylic.is-translucent .app-container { opacity: 1 !important; }"; document.head.append(st);`);
  await sleep(1500);
  await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`);
  await sleep(1000);
};

// ---- 녹화 ----
const record = async (name, cfg) => {
  await setCfg(cfg);
  const proc = spawn("screencapture", ["-x", "-V", "16", `${OUT}/${name}.mov`]);
  await sleep(1500);
  await workload();
  await workload();
  await new Promise((r) => proc.on("exit", r));
  note("rec", name);
};
if (process.env.REC) {
  await record("rec-fix", "fix");
  await record("rec-nofix", "nofix");
}

// ---- 성능 ----
if (process.env.PERF) {
  await send("Performance.enable");
  const metrics = async () => { const m = await send("Performance.getMetrics"); const o = {}; for (const x of m.result.metrics) o[x.name] = x.value; return o; };
  await ev(`window.__lgFrames = 0; const tick = () => { window.__lgFrames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);`);
  const run = async (cfg) => {
    await setCfg(cfg);
    const a = await metrics(); const f0 = await ev(`return window.__lgFrames;`); const t0 = Date.now();
    await workload();
    const b = await metrics(); const f1 = await ev(`return window.__lgFrames;`); const ms = Date.now() - t0;
    return { task: Math.round((b.TaskDuration - a.TaskDuration) * 1000), style: Math.round((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000), layout: Math.round((b.LayoutDuration - a.LayoutDuration) * 1000), frames: f1 - f0, ms };
  };
  const cfgs = ["off", "fix", "nofix", "norefract"];
  const res = {};
  for (let round = 0; round < 3; round++) {
    const order = round % 2 ? [...cfgs].reverse() : cfgs;
    for (const c of order) { const r = await run(c); (res[c] = res[c] || []).push(r); note("perf-" + c, r); }
  }
  note("perf", res);
}
save();
ws.close();
process.exit(0);
