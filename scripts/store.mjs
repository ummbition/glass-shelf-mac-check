// 스토어용 맥 스크린샷 (보여주기 보관함). 장면은 scripts/scenekit.js (Windows 와 같다).
// 전체 화면: 지금 설정(preset-mine) 라이트·다크, 기본(렌즈·Finder 기호·줄무늬) 라이트·다크, 편집창 나누기, 쌓인 탭, 웹 뷰어.
// 줄인 창: 바탕화면이 보이게. 배율 110%, 패널-편집창-패널 거의 1:1:1
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

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
const kit = readFileSync(new URL("./scenekit.js", import.meta.url), "utf8").replace("__PRESET_MINE__", readFileSync(new URL("./preset-mine.json", import.meta.url), "utf8"));
note("kit", await ev(`${kit}; return typeof window.__sk;`));
note("zoom", await ev(`return __sk.zoom();`));
note("setup", await ev(`return await __sk.setup();`));
const area = await ev(`return __sk.area();`);
note("area", area);
const W = area.work;
// 줄인 창. Windows 는 화면 아래 오른쪽의 시험 모드 표시와 왼쪽의 러너 창이 안 들어가게 창을 위로 두고 창 둘레만 자른다
const WIN = process.platform === "win32";
const INSET = WIN
  ? { x: 160, y: 40, width: 1600, height: 920 }
  : { x: W.x + Math.round(W.width * 0.1), y: W.y + Math.round(W.height * 0.08), width: Math.round(W.width * 0.8), height: Math.round(W.height * 0.84) };
const CROP = WIN ? { x: 60, y: 0, width: 1800, height: 1010 } : W;

const shot = async (name, { full, bounds, cfg, layout }) => {
  note("cfg", await ev(`return await __sk.config(${JSON.stringify(cfg)});`));
  if (layout) note("layout", await ev(`return await __sk.layout(${JSON.stringify(layout)});`));
  if (full) note("full", await ev(`return await __sk.full(true);`)); else note("bounds", await ev(`return await __sk.bounds(${JSON.stringify(bounds)});`));
  note("sizes", await ev(`return await __sk.sizes();`));
  await front();
  await sleep(1500);
  await ev(`const p = app.plugins.plugins["glass-shelf"]; if (p.vibNudge) p.vibNudge();`);
  await sleep(1000);
  // 커서는 편집창 빈 곳으로 (호버 흔적 없게)
  const b = full ? { width: area.size.width, height: area.size.height } : bounds;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(b.width * 0.62), y: Math.round(b.height * 0.8) });
  await sleep(700);
  try { capture(`${OUT}/${name}.png`, full ? null : CROP); note("shot", name); } catch (e) { note("shot-err", String(e)); }
  save();
};
// 캡처: 맥은 screencapture, Windows 는 PowerShell 화면 복사(DWM 합성 결과라 아크릴·바탕화면이 같이 찍힌다).
// Windows 줄인 창은 작업 영역(작업 표시줄 제외)만 자른다
function capture(file, cropWork) {
  if (process.platform === "win32") {
    const ps = new URL("./wincap.ps1", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const S = area.scale || 1;
    const args = cropWork ? ` ${Math.round(cropWork.x * S)} ${Math.round(cropWork.y * S)} ${Math.round(cropWork.width * S)} ${Math.round(cropWork.height * S)}` : "";
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}" "${file}"${args}`);
  } else execSync(`screencapture -x "${file}"`);
}

// 테마만 (플러그인 끔): 전체 화면 라이트·다크 두 장
if (process.env.HOVERTEST === "themeonly") {
  await ev(`return await __sk.layout("single");`);
  // 플러그인이 다 켜진 뒤에 끈다: 켜지는 도중에 끄면 남은 준비가 끈 뒤에 플러그인 화면(··· 버튼, 폴더 색 등)을 다시 붙였다(추정)
  await sleep(6000);
  note("off", await ev(`await app.plugins.disablePlugin("glass-shelf"); return !app.plugins.plugins["glass-shelf"];`));
  await sleep(2500);
  note("left", await ev(`return { injected: document.querySelectorAll(".lg-injected").length, ui: document.body.classList.contains("lg-ui") };`));

  // 진단: 리본이 패널 위에 겹치는 상태를 무엇이 고치는지 단계마다 찍는다 (THEMEDIAG=1)
  if (process.env.THEMEDIAG) {
    await ev(`if (app.changeTheme) app.changeTheme("moonstone"); return 1;`); await ev(`return await __sk.full(true);`); await front(); await sleep(3000);
    const st = () => ev(`const q = (s) => document.querySelector(s); const r = (e) => e ? [Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().width)] : null; const tg = q(".sidebar-toggle-button.mod-left"); return { ribbon: r(q(".workspace-ribbon.mod-left")), split: r(q(".workspace-split.mod-left-split")), toggle: r(tg), togIn: tg && tg.parentElement && tg.parentElement.className.slice(0, 50), body: document.body.className.slice(0, 300) };`);
    const step = async (n) => { note("st-" + n, await st()); try { capture(`${OUT}/d-${n}.png`, null); } catch {} };
    await step("0-off");
    await ev(`app.workspace.leftSplit.collapse(); await new Promise(r => setTimeout(r, 1200)); app.workspace.leftSplit.expand(); await new Promise(r => setTimeout(r, 2000)); return 1;`); await step("1-api");
    const tb = await ev(`const e = document.querySelector(".sidebar-toggle-button.mod-left"); const b = e && e.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;`);
    if (tb) { for (const t of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: tb.x, y: tb.y, button: "left", clickCount: 1 }); await sleep(1500);
      const tb2 = await ev(`const e = document.querySelector(".sidebar-toggle-button.mod-left"); const b = e && e.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;`); await step("2a-clickclose");
      if (tb2) for (const t of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type: t, x: tb2.x, y: tb2.y, button: "left", clickCount: 1 }); await sleep(2000); await step("2b-clickopen"); }
    note("reopen", await ev(`const l = app.workspace.getLeavesOfType("file-explorer")[0]; if (!l) return null; const p = l.parent; const i = p.children.indexOf(l); const st = l.getViewState(); l.detach(); await new Promise(r => setTimeout(r, 600)); const n = app.workspace.createLeafInParent(p, i); await n.setViewState(st); if (p.selectTab) p.selectTab(n); await new Promise(r => setTimeout(r, 1500)); return i;`)); await step("3-reopen");
    save(); ws.close(); process.exit(0);
  }
  for (const dark of [false, true]) {
    await ev(`if (app.changeTheme) app.changeTheme(${JSON.stringify(dark ? "obsidian" : "moonstone")}); return 1;`);
    await ev(`return await __sk.full(true);`);
    note("sizes", await ev(`return await __sk.sizes();`));
    await front();
    await sleep(3000);
    // 찍기 바로 전에 왼쪽 패널을 닫았다 연다: 플러그인을 끈 뒤 테마 UI 가 이렇게 해야 다시 자리를 잡는다 (사용자 지시)
    await ev(`app.workspace.leftSplit.collapse(); await new Promise(r => setTimeout(r, 1200)); app.workspace.leftSplit.expand(); await new Promise(r => setTimeout(r, 2000)); return 1;`);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(area.size.width * 0.62), y: Math.round(area.size.height * 0.8) });
    await sleep(700);
    const name = dark ? "theme-only-dark" : "theme-only-light";
    try { capture(`${OUT}/${name}.png`, null); note("shot", name); } catch (e) { note("shot-err", String(e)); }
  }
  save(); ws.close(); process.exit(0);
}
// 분할 화면만 다시
if (process.env.HOVERTEST === "splitonly") {
  await shot("full-default-split", { full: true, cfg: { dark: false, mine: false, acrylic: false }, layout: "split" });
  save(); ws.close(); process.exit(0);
}
const MINE_L = { dark: false, mine: true }, MINE_D = { dark: true, mine: true };
const DEF_L = { dark: false, mine: false }, DEF_D = { dark: true, mine: false };
await shot("full-mine-light", { full: true, cfg: MINE_L, layout: "single" });
await shot("full-mine-dark", { full: true, cfg: MINE_D });
await shot("full-default-light", { full: true, cfg: DEF_L });
await shot("full-default-dark", { full: true, cfg: DEF_D });
await shot("full-default-split", { full: true, cfg: DEF_L, layout: "split" });
await shot("full-default-stacked", { full: true, cfg: DEF_L, layout: "stacked" });
await shot("full-default-web", { full: true, cfg: DEF_L, layout: "web" });
await ev(`return await __sk.layout("single");`);
// 줄인 창: Windows 는 좌우 패널 투명(아크릴)을 켠다 (바탕화면이 비친다). 맥은 패널 투명을 쓰지 않는다
const AC = { acrylic: process.platform === "win32" };
await shot("window-mine-light", { bounds: INSET, cfg: { ...MINE_L, ...AC } });
await shot("window-default-light", { bounds: INSET, cfg: { ...DEF_L, ...AC } });
await shot("window-default-dark", { bounds: INSET, cfg: { ...DEF_D, ...AC } });
await ev(`return await __sk.config(${JSON.stringify({ ...DEF_L, acrylic: false })});`);
save();
ws.close();
process.exit(0);
