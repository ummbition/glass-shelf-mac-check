// 맥 러너에서 Obsidian 을 원격 디버깅(CDP)으로 조종하고 화면 전체를 screencapture 로 찍는다
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 90 && !target; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9222/json")).json();
    target = list.find((t) => t.type === "page" && /index\.html/.test(t.url));
  } catch {}
  if (!target) await sleep(1000);
}
if (!target) { note("error", "no CDP target"); writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1)); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description };
  return m.result && m.result.result ? m.result.result.value : m;
};
const shot = async (name) => {
  await ev(`const w = require("electron").remote.getCurrentWindow(); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);
  await sleep(700);
  try { execSync(`screencapture -x "${OUT}/${name}.png"`); note("shot", name); } catch (e) { note("shot-err", String(e)); }
};

// 준비될 때까지
for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(2000);
note("env", await ev(`return { ua: navigator.userAgent, electron: process.versions.electron, app: require("electron").remote.app.getVersion(), cls: document.body.className, dpr: devicePixelRatio, bg: require("electron").remote.getCurrentWindow().getBackgroundColor() }`));
const closeModals = () => ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click()); return document.querySelectorAll(".modal-container").length;`);
note("modals", await closeModals());
note("workArea", await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isFullScreen()) w.setFullScreen(false); if (w.isMaximized()) w.unmaximize(); const d = require("electron").remote.screen.getPrimaryDisplay().workArea; w.setBounds({ x: d.x + 120, y: d.y + 40, width: d.width - 160, height: d.height - 80 }); return d;`));
await ev(`app.workspace.leftSplit.expand(); const f = app.vault.getAbstractFileByPath("시험.md"); if (f) await app.workspace.getLeaf().openFile(f);`);
await sleep(1500);

// A: 기본 테마, 반투명 창
note("A", await ev(`return { translucent: document.body.classList.contains("is-translucent"), bodyBg: getComputedStyle(document.body).backgroundColor, side: getComputedStyle(document.querySelector(".mod-left-split")).backgroundColor }`));
await shot("A-default");
note("stack-A", await ev(`return document.elementsFromPoint(150, 500).map((e) => { const c = getComputedStyle(e); return (e.tagName + "." + [...e.classList].join(".")).slice(0, 90) + " bg=" + c.backgroundColor; })`));

if (process.env.VIBA) {
  // 기본 테마에서: app-container 바탕을 비워 재질만 / 실행 중 setVibrancy 가 먹는지
  const box = () => ev(`return 0`);
  await ev(`const st = document.createElement("style"); st.id = "lg-raw"; st.textContent = ".app-container { background: transparent !important; }"; document.head.append(st);`);
  await sleep(600);
  await shot("V0-raw-before");
  for (const m of ["sidebar", "under-window", "hud", "fullscreen-ui", "window", "content"]) {
    note("vib-" + m, await ev(`try { require("electron").remote.getCurrentWindow().setVibrancy(${JSON.stringify(m)}); return "ok"; } catch (e) { return String(e); }`));
    await sleep(900);
    await shot("V-" + m);
  }
  note("vib-null", await ev(`require("electron").remote.getCurrentWindow().setVibrancy(null); return "ok";`));
  await sleep(900);
  await shot("V-null");
  writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
  ws.close();
  process.exit(0);
}

// B: Glass Shelf 테마 + 플러그인
await ev(`app.customCss.setTheme("Glass Shelf");`);
await sleep(1500);
note("B-plugin", await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return String(e); } return Object.keys(app.plugins.plugins);`));
await sleep(3000);
note("B", await ev(`return { cls: document.body.className, bodyBg: getComputedStyle(document.body).backgroundColor, side: getComputedStyle(document.querySelector(".mod-left-split")).backgroundColor }`));
await shot("B-glass");

// C: 패널 투명 CSS 만 (구멍 없음)
await ev(`document.body.classList.add("lg-acrylic");`);
await sleep(1000);
note("C", await ev(`return { bodyBg: getComputedStyle(document.body).backgroundColor, side: getComputedStyle(document.querySelector(".mod-left-split")).backgroundColor }`));
note("modals2", await closeModals());
note("pills", await ev(`return [...document.querySelectorAll(".mod-left-split .lg-nav-run, .mod-left-split .lg-nav-rest > .clickable-icon, .mod-left-split .workspace-tab-header-container-inner, .workspace-drawer-vault-switcher")].map((b) => { const r = b.getBoundingClientRect(); return [b.className.split(" ")[0], Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })`));
note("win", await ev(`const w = require("electron").remote.getCurrentWindow(); return { b: w.getBounds(), c: w.getContentBounds() };`));
await shot("C-acrylic-css");

// D: 구멍까지
note("D", await ev(`const p = app.plugins.plugins["glass-shelf"]; if (!p || !p.acrylicHoles) return "no acrylicHoles"; p.acrylicHoles(true); return "ok";`));
await sleep(1500);
note("D-under", await ev(`return document.querySelectorAll(".lg-panel-under").length;`));
const stack = () => ev(`return document.elementsFromPoint(150, 500).map((e) => { const c = getComputedStyle(e); return (e.tagName + "." + [...e.classList].join(".")).slice(0, 90) + " bg=" + c.backgroundColor + " img=" + c.backgroundImage.slice(0, 40) + " op=" + c.opacity + " bf=" + c.backdropFilter.slice(0, 30); })`);
note("stack-D", await stack());
note("html-bg", await ev(`return [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor, require("electron").remote.getCurrentWindow().getBackgroundColor()]`));
await shot("D-holes");

// M: 재질 종류 바꿔 보기 (실행 중 setVibrancy). 각 재질마다 Glass Shelf 그대로 / 패널 바탕 층을 끈 것(재질만) 두 장
if (process.env.MATERIALS) {
  const mats = ["sidebar", "under-window", "under-page", "window", "content", "hud", "fullscreen-ui", "popover", "menu", "sheet", "header", "titlebar", "tooltip", "selection"];
  note("vib-before", await ev(`const w = require("electron").remote.getCurrentWindow(); return typeof w.setVibrancy;`));
  for (const m of mats) {
    note("vib-" + m, await ev(`try { require("electron").remote.getCurrentWindow().setVibrancy(${JSON.stringify(m)}); return "ok"; } catch (e) { return String(e); }`));
    await sleep(900);
    await ev(`document.getElementById("lg-raw") && document.getElementById("lg-raw").remove();`);
    await shot("M-" + m);
    await ev(`const st = document.createElement("style"); st.id = "lg-raw"; st.textContent = ".lg-panel-under, .workspace-split.mod-left-split, .workspace-split.mod-right-split { background: transparent !important; } .lg-panel-under { opacity: 0 !important; }"; document.head.append(st);`);
    await sleep(500);
    await shot("R-" + m);
  }
  await ev(`document.getElementById("lg-raw") && document.getElementById("lg-raw").remove(); require("electron").remote.getCurrentWindow().setVibrancy("sidebar");`);
  writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
  ws.close();
  process.exit(0);
}

if (process.env.FIND) {
  const dump = () => ev(`const x = 150, y = 500; const all = []; for (const e of document.querySelectorAll("*")) { for (const pe of [null, "::before", "::after"]) { const c = getComputedStyle(e, pe); if (pe && c.content === "none") continue; if (c.display === "none" || c.visibility === "hidden") continue; const bg = c.backgroundColor; if (bg === "rgba(0, 0, 0, 0)" && c.backgroundImage === "none" && c.backdropFilter === "none") continue; const r = e.getBoundingClientRect(); if (!pe && !(r.left <= x && x <= r.right && r.top <= y && y <= r.bottom)) continue; if (pe && !(r.left <= x && x <= r.right && r.top <= y && y <= r.bottom) && c.position !== "fixed") continue; all.push((e.tagName + "." + [...e.classList].slice(0, 3).join(".") + (pe || "")).slice(0, 80) + " bg=" + bg + " im=" + c.backgroundImage.slice(0, 40) + " bf=" + c.backdropFilter.slice(0, 30) + " pos=" + c.position + " pe=" + c.pointerEvents + (pe ? " rect?" : " " + [r.x, r.y, r.width, r.height].map(Math.round).join(","))); } } const w = require("electron").remote.getCurrentWindow(); const img = await w.webContents.capturePage({ x: 30, y: 430, width: 4, height: 4 }); const bm = img.toBitmap(); return { all, under: [...document.querySelectorAll(".lg-panel-under")].map((u) => getComputedStyle(u).display), bgc: w.getBackgroundColor(), px: [...bm.slice(0, 8)] };`);
  const dumpOld = () => ev(`const out = []; for (const e of document.elementsFromPoint(150, 500)) { for (const pe of [null, "::before", "::after"]) { const c = getComputedStyle(e, pe); if (pe && c.content === "none") continue; const bg = c.backgroundColor, im = c.backgroundImage; if (bg !== "rgba(0, 0, 0, 0)" || im !== "none" || c.backdropFilter !== "none" || c.opacity !== "1") out.push((e.tagName + "." + [...e.classList].slice(0, 3).join(".") + (pe || "")).slice(0, 80) + " bg=" + bg + " im=" + im.slice(0, 50) + " bf=" + c.backdropFilter.slice(0, 40) + " op=" + c.opacity + " pos=" + c.position); } } const u = [...document.querySelectorAll(".lg-panel-under")].map((x) => getComputedStyle(x).backgroundColor + " " + getComputedStyle(x).display); return { out, u };`);
  await ev(`require("electron").remote.getCurrentWindow().setVibrancy("hud"); const st = document.createElement("style"); st.id = "lg-raw1"; st.textContent = ".app-container { background: transparent !important; }"; document.head.append(st);`);
  await sleep(900);
  note("F1", await dump());
  await shot("F1-hud-appc");
  await ev(`const st = document.createElement("style"); st.id = "lg-raw2"; st.textContent = ".lg-panel-under { display: none !important; } .workspace-split.mod-sidedock { background: transparent !important; opacity: 1 !important; }"; document.head.append(st);`);
  await sleep(700);
  note("F2", await dump());
  await shot("F2-no-under");
  note("busy", await ev(`return [...document.querySelectorAll(".workspace-split.mod-sidedock")].map((x) => x.className)`));
  await ev(`const w = require("electron").remote.getCurrentWindow(); const b = w.getBounds(); w.setBounds({ ...b, width: b.width - 2 });`);
  await sleep(900);
  await shot("F2b-resized");
  await ev(`document.getElementById("lg-raw2").remove();`);
  await sleep(900);
  await shot("F2c-under-back");
  await ev(`const w = require("electron").remote.getCurrentWindow(); const b = w.getBounds(); w.setBounds({ ...b, width: b.width + 2 });`);
  await sleep(900);
  await shot("F2d-under-resized");
  note("shape", await ev(`return [...document.querySelectorAll(".mod-left-split .lg-nav-rest > .clickable-icon, .mod-left-split .lg-nav-run, .mod-left-split .lg-nav-more, .mod-left-split .lg-panel-toggle")].map((b) => { const c = getComputedStyle(b); const r = b.getBoundingClientRect(); return [b.className.slice(0, 40), [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(1)).join(","), c.borderRadius, c.cornerShape, c.backgroundColor, c.backdropFilter.slice(0, 60)]; })`));
  await ev(`const st = document.createElement("style"); st.id = "lg-noicon"; st.textContent = ".mod-left-split .workspace-tab-header-container svg { visibility: hidden !important; }"; document.head.append(st);`);
  await sleep(800);
  await shot("S1-holes-noicon");
  await ev(`const p = app.plugins.plugins["glass-shelf"]; p.acrylicHoles(false); document.querySelectorAll(".lg-panel-under").length;`);
  await ev(`const st = document.createElement("style"); st.id = "lg-under-fake"; st.textContent = ".workspace-split.mod-sidedock { background-color: color-mix(in srgb, var(--background-secondary) 70%, transparent) !important; }"; document.head.append(st);`);
  await sleep(800);
  await shot("S2-noholes-noicon");
  await ev(`document.getElementById("lg-under-fake").remove(); document.getElementById("lg-noicon").remove(); app.plugins.plugins["glass-shelf"].acrylicHoles(true);`);
  await sleep(800);
  // 테마 빼고 플러그인만
  await ev(`app.customCss.setTheme("");`);
  await sleep(1500);
  note("F3", await dump());
  await shot("F3-plugin-only");
  // 테마 다시, 플러그인 끔
  await ev(`await app.plugins.disablePlugin("glass-shelf"); app.customCss.setTheme("Glass Shelf");`);
  await sleep(1500);
  note("F4", await dump());
  await shot("F4-theme-only");
  writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
  ws.close();
  process.exit(0);
}

// E: 패널 알약 위 호버
const pt = await ev(`const b = document.querySelector(".mod-left-split .lg-nav-run, .mod-left-split .workspace-tab-header-container-inner"); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + 18, y: r.y + r.height / 2 };`);
note("hover-pt", pt);
if (pt) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y });
  await sleep(500);
  await shot("E-hover");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 700, y: 400 });
}

// F: 파일 탐색기 스크롤 중
await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 120, y: 400, deltaX: 0, deltaY: 120 });
await sleep(120);
await shot("F-scroll");

// G: 다크
await ev(`app.changeTheme ? app.changeTheme("obsidian") : (app.vault.setConfig("theme", "obsidian"), app.updateTheme && app.updateTheme());`);
await sleep(1500);
await shot("G-dark");

// H: 창 포커스 잃음 (Finder 앞으로)
try { execSync(`open -a Finder`); } catch {}
await sleep(1200);
try { execSync(`screencapture -x "${OUT}/H-unfocused.png"`); note("shot", "H"); } catch (e) { note("shot-err", String(e)); }

writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
ws.close();
process.exit(0);
