// 스토어용 맥 스크린샷 (보여주기 보관함). 꽉 찬 창 / 조금 줄인 창 × 설정 조합
import { execSync } from "node:child_process";
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
const front = () => ev(`const w = require("electron").remote.getCurrentWindow(); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(2000);
note("trust", await ev(`let n = 0; for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) { b.click(); n++; } return n;`));
await sleep(2000);
note("enable", await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return String(e); } return Object.keys(app.plugins.plugins);`));
await sleep(2500);
await ev(`app.setting.close(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());`);
await sleep(1000);
note("env", await ev(`return { cls: [...document.body.classList].filter((c) => /translucent|acrylic|theme-/.test(c)), theme: app.customCss.theme, active: app.workspace.getActiveFile() && app.workspace.getActiveFile().path };`));

// 폴더 몇 개 열기
note("open-folders", await ev(`const v = app.workspace.getLeavesOfType("file-explorer")[0].view; const out = []; for (const p of ["Areas", "Journal", "Notes", "Projects", "Reading"]) { const it = v.fileItems[p]; if (it && it.setCollapsed) { await it.setCollapsed(false); out.push(p); } } return out;`));
await sleep(800);
const area = await ev(`return require("electron").remote.screen.getPrimaryDisplay().workArea;`);
note("workArea", area);
const setBounds = (b) => ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isFullScreen()) w.setFullScreen(false); if (w.isMaximized()) w.unmaximize(); w.setBounds(${JSON.stringify(b)});`);
const FULL = { x: area.x, y: area.y, width: area.width, height: area.height };
const INSET = { x: area.x + Math.round(area.width * 0.11), y: area.y + Math.round(area.height * 0.09), width: Math.round(area.width * 0.78), height: Math.round(area.height * 0.82) };

const base = await ev(`const s = app.plugins.plugins["glass-shelf"].settings; return { tabAnim: s.tabAnim, tabListSides: s.tabListSides, fileIcons: s.fileIcons };`);
note("base", base);
const setCfg = async ({ dark, tabAnim, tabListSides, fileIcons }) => {
  await ev(`const p = app.plugins.plugins["glass-shelf"]; Object.assign(p.settings, ${JSON.stringify({ tabAnim, tabListSides, fileIcons })}); await p.saveSettings();`);
  await ev(`const t = ${dark} ? "obsidian" : "moonstone"; if (app.changeTheme) app.changeTheme(t); else { app.vault.setConfig("theme", t); app.updateTheme && app.updateTheme(); }`);
  await sleep(2500);
};
const shot = async (name, bounds, cfg) => {
  await setCfg(cfg);
  await setBounds(bounds);
  await front();
  await sleep(1500);
  await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`);
  await sleep(1200);
  // 커서는 편집창 빈 곳으로 (호버 흔적 없게)
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(bounds.width * 0.6), y: Math.round(bounds.height * 0.75) });
  await sleep(600);
  try { execSync(`screencapture -x "${OUT}/${name}.png"`); note("shot", name); } catch (e) { note("shot-err", String(e)); }
};

const LENS = { tabAnim: "lens", tabListSides: base.tabListSides || "both", fileIcons: "finder" };
const LIST = { tabAnim: "list", tabListSides: "left", fileIcons: "line" };
const BASE = { tabAnim: base.tabAnim, tabListSides: base.tabListSides, fileIcons: base.fileIcons };

await shot("full-1-light", FULL, { dark: false, ...BASE });
await shot("full-2-dark", FULL, { dark: true, ...BASE });
await shot("full-3-light-lens-default", FULL, { dark: false, ...LENS });
await shot("full-4-light-listleft-simple", FULL, { dark: false, ...LIST });
await shot("window-1-light", INSET, { dark: false, ...BASE });
await shot("window-2-dark", INSET, { dark: true, ...BASE });
await shot("window-3-light-listleft-simple", INSET, { dark: false, ...LIST });

// 스크롤바 확인 (편집창 스크롤 중)
await setBounds(FULL);
await setCfg({ dark: false, ...BASE });
await front(); await sleep(800);
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1100, y: 600 });
for (let i = 0; i < 4; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 1100, y: 600, deltaX: 0, deltaY: 60 }); await sleep(60); }
try { execSync(`screencapture -x "${OUT}/check-scrollbar.png"`); } catch {}
note("sb", await ev(`const s = document.querySelector(".mod-root .workspace-leaf.mod-active .cm-scroller, .mod-root .workspace-leaf.mod-active .markdown-preview-view"); const c = getComputedStyle(s); return { sw: c.scrollbarWidth, sc: c.scrollbarColor, w: s.offsetWidth - s.clientWidth };`));
save();
ws.close();
process.exit(0);
