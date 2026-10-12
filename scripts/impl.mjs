// 구현 확인: 반투명 창 켠 보관함에서 테마+플러그인을 켜고, 실제 흐름대로 찍는다
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
  try {
    const list = await (await fetch("http://127.0.0.1:9222/json")).json();
    target = list.find((t) => t.type === "page" && /index\.html/.test(t.url));
  } catch {}
  if (!target) await sleep(1000);
}
if (!target) { note("error", "no CDP target"); save(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
let lastLayers = null;
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === "LayerTree.layerTreeDidChange" && m.params && m.params.layers) lastLayers = m.params.layers; });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description };
  return m.result && m.result.result ? m.result.result.value : m;
};
const front = () => ev(`const w = require("electron").remote.getCurrentWindow(); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);
const cap = (name) => { try { execSync(`screencapture -x "${OUT}/${name}.png"`); note("shot", name); } catch (e) { note("shot-err", String(e)); } };
const shot = async (name, wait = 700) => { await front(); await sleep(wait); cap(name); };
const move = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
const state = () => ev(`const w = require("electron").remote.getCurrentWindow(); const img = await w.webContents.capturePage({ x: 30, y: 430, width: 2, height: 2 }); return { alpha: img.toBitmap()[3], cls: [...document.body.classList].filter((c) => /translucent|acrylic|theme-|lg-vib/.test(c)), appc: getComputedStyle(document.querySelector(".app-container")).backgroundColor, under: document.querySelectorAll(".lg-panel-under").length, dots: document.querySelectorAll(".lg-dmg-dot").length, bg: w.getBackgroundColor() };`);

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());`);
note("workArea", await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isFullScreen()) w.setFullScreen(false); if (w.isMaximized()) w.unmaximize(); const d = require("electron").remote.screen.getPrimaryDisplay().workArea; w.setBounds({ x: d.x + 120, y: d.y + 40, width: d.width - 160, height: d.height - 80 }); return d;`));
await ev(`app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand(); const f = app.vault.getAbstractFileByPath("시험.md"); if (f) await app.workspace.getLeaf().openFile(f);`);
await sleep(800);

// 1. 테마 + 플러그인 켜기 (반투명 창은 보관함 설정으로 켜져 있음)
await ev(`app.customCss.setTheme("Glass Shelf");`);
await sleep(1000);
note("enable", await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return String(e); } return Object.keys(app.plugins.plugins);`));
await sleep(2500);
await ev(`app.setting.close();`);
await sleep(1500);
note("s1", await state());
await shot("1-on-light", 300);

if (process.env.HOVERTEST) {
  const btn = await ev(`const b = [...document.querySelectorAll(".mod-left-split .workspace-tab-header-container .clickable-icon")].find((x) => x.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
  const run = async (tag) => {
    await move(btn.x + 400, btn.y + 400); await sleep(2500);
    cap(tag + "-0-idle");
    await move(btn.x, btn.y); await sleep(500);
    cap(tag + "-a-hover");
    await move(btn.x + 400, btn.y + 400); await sleep(2500);
    cap(tag + "-b-wait");
  };
  await run("H1");
  if (process.env.HOVERTEST === "11") {
    const nudge = async () => { await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(900); };
    const eb = await ev(`const b = [...document.querySelectorAll(".mod-root .workspace-tab-header-container .clickable-icon, .mod-root .view-header .clickable-icon")].find((x) => x.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
    // 실험 1: 바탕 층을 30% 빨강으로
    await ev(`const st = document.createElement("style"); st.id = "red"; st.textContent = ".lg-panel-under { background-color: rgb(255 0 0 / 0.3) !important; }"; document.head.append(st);`);
    await nudge();
    await run("R1");
    await ev(`document.getElementById("red").remove();`);
    await nudge();
    // 실험 2: .app-container 를 뒤 필터 기준(backdrop root)으로
    await ev(`const st = document.createElement("style"); st.id = "root999"; st.textContent = ".app-container { opacity: 0.999 !important; }"; document.head.append(st);`);
    await nudge();
    for (let k = 1; k <= 3; k++) {
      await run("A" + k);
    }
    await move(eb.x, eb.y); await sleep(500); cap("A-editorbtn-hover");
    await move(900, 600); await sleep(300);
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 900, y: 500, deltaX: 0, deltaY: 300 }); await sleep(120); cap("A-scroll");
    await sleep(2000); cap("A-scroll-wait");
    // 실험 2 + 빨강 (불투명이 남아 있으면 색으로 구분)
    await ev(`const st = document.createElement("style"); st.id = "red"; st.textContent = ".lg-panel-under { background-color: rgb(255 0 0 / 0.3) !important; }"; document.head.append(st);`);
    await nudge();
    await run("AR");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "10") {
    await send("LayerTree.enable");
    const groups = [["editor", ".workspace-split.mod-root"], ["right", ".workspace-split.mod-right-split"], ["ribbon", ".workspace-ribbon"], ["status", ".status-bar"], ["titlebar", ".titlebar"]];
    const keepOnly = (keep) => ev(`document.getElementById("only") && document.getElementById("only").remove(); const st = document.createElement("style"); st.id = "only"; st.textContent = ${JSON.stringify(groups)}.filter(([k]) => !${JSON.stringify(keep)}.includes(k)).map(([, s]) => s + " { visibility: hidden !important; }").join(" "); document.head.append(st);`);
    const layers = async (tag) => {
      lastLayers = null;
      await ev(`document.body.style.setProperty("--lg-poke", String(Math.random()));`);
      for (let i = 0; i < 20 && !lastLayers; i++) await sleep(100);
      const L = lastLayers || [];
      const drawn = L.filter((l) => l.drawsContent);
      note("layers-" + tag, { total: L.length, drawsContent: drawn.length });
    };
    for (const keep of [["editor", "right", "ribbon", "status", "titlebar"], [], ["editor"], ["editor", "ribbon"], ["right", "ribbon", "status", "titlebar"]]) {
      const tag = keep.length ? keep.join("+") : "none";
      await keepOnly(keep);
      await sleep(1500);
      await layers(tag);
      await move(btn.x, btn.y); await sleep(500);
      cap("L-" + tag + "-a-hover");
      await move(btn.x + 400, btn.y + 400); await sleep(2000);
    }
    // 편집창 + 리본 상태에서 편집창 본문만 숨기기 (레이어 줄이기)
    await keepOnly(["editor", "ribbon"]);
    await ev(`const st = document.createElement("style"); st.id = "less"; st.textContent = ".mod-root .workspace-leaf-content > .view-content { visibility: hidden !important; }"; document.head.append(st);`);
    await sleep(1500);
    await layers("editor+ribbon-nobody");
    await move(btn.x, btn.y); await sleep(500);
    cap("L-editor+ribbon-nobody-a-hover");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "9") {
    const groups = [["editor", ".workspace-split.mod-root"], ["right", ".workspace-split.mod-right-split"], ["ribbon", ".workspace-ribbon"], ["status", ".status-bar"], ["titlebar", ".titlebar"]];
    const keepOnly = (keep) => ev(`document.getElementById("only") && document.getElementById("only").remove(); const st = document.createElement("style"); st.id = "only"; st.textContent = ${JSON.stringify(groups)}.filter(([k]) => !${JSON.stringify(keep)}.includes(k)).map(([, s]) => s + " { visibility: hidden !important; }").join(" "); document.head.append(st);`);
    note("rf-count", await ev(`const out = {}; for (const e of document.querySelectorAll("*")) { const c = getComputedStyle(e); if (c.backdropFilter.includes("url(")) { const g = e.closest(".mod-root") ? "editor" : e.closest(".mod-right-split") ? "right" : e.closest(".mod-left-split") ? "left" : e.closest(".status-bar") ? "status" : e.closest(".titlebar") ? "titlebar" : e.closest(".workspace-ribbon") ? "ribbon" : (e.className || e.tagName); out[g] = (out[g] || 0) + 1; } } return out;`));
    const keys = groups.map(([k]) => k);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const pair = [keys[i], keys[j]];
      await keepOnly(pair);
      await move(btn.x + 400, btn.y + 400); await sleep(2000);
      await move(btn.x, btn.y); await sleep(500);
      cap("E-" + pair.join("+") + "-a-hover");
      await move(btn.x + 400, btn.y + 400); await sleep(2000);
      cap("E-" + pair.join("+") + "-b-wait");
    }
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "8") {
    const groups = [["editor", ".workspace-split.mod-root"], ["right", ".workspace-split.mod-right-split"], ["ribbon", ".workspace-ribbon"], ["status", ".status-bar"], ["titlebar", ".titlebar"]];
    const hide = (keep) => ev(`document.getElementById("only") && document.getElementById("only").remove(); const st = document.createElement("style"); st.id = "only"; st.textContent = ${JSON.stringify(groups)}.filter(([k]) => k !== ${JSON.stringify(keep)}).map(([, s]) => s + " { visibility: hidden !important; }").join(" "); document.head.append(st);`);
    await hide("none");
    await run("D0-allhidden");
    for (const [k] of groups) {
      await hide(k);
      await run("D-" + k);
      await hide("none");
      await move(btn.x + 400, btn.y + 400); await sleep(2500);
      cap("D-" + k + "-z-allhidden");
    }
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "7") {
    // 하나씩 (누적 아님): 숨기고 확인한 뒤 되돌린다
    note("titlebar", await ev(`const t = document.querySelector(".titlebar"); if (!t) return null; return [...t.querySelectorAll("*")].filter((e) => getComputedStyle(e).backdropFilter !== "none" || getComputedStyle(e).webkitAppRegion === "drag").slice(0, 12).map((e) => e.className + " | bf=" + getComputedStyle(e).backdropFilter.slice(0, 40) + " | region=" + getComputedStyle(e).webkitAppRegion);`));
    note("statusbar", await ev(`const t = document.querySelector(".status-bar"); if (!t) return null; const c = getComputedStyle(t); return [t.className, c.backdropFilter.slice(0, 80), c.position, c.backgroundColor];`));
    const one = [
      ["C1-titlebar", ".titlebar"],
      ["C2-status", ".status-bar"],
      ["C3-ribbon", ".workspace-ribbon"],
      ["C4-wc", ".titlebar-button-container"],
      ["C5-dragband", ".lg-drag-band"],
    ];
    for (const [tag, sel] of one) {
      await ev(`const st = document.createElement("style"); st.id = "one"; st.textContent = ${JSON.stringify("")} + ${JSON.stringify(sel)} + " { visibility: hidden !important; }"; document.head.append(st);`);
      await run(tag);
      await ev(`document.getElementById("one").remove();`);
      await move(btn.x + 400, btn.y + 400); await sleep(1500);
      cap(tag + "-z-restored");
    }
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "6") {
    // 반씩 빼기: 굴절은 켠 채로 화면 부분을 차례로 숨긴다(누적). 숨김은 visibility 라 배치는 그대로
    const steps = [
      ["B1-editor", ".workspace-split.mod-root"],
      ["B2-right", ".workspace-split.mod-right-split"],
      ["B3-chrome", ".workspace-ribbon, .status-bar, .titlebar, .lg-dmg-dot"],
      ["B4-list", ".mod-left-split .workspace-tab-container"],
      ["B5-vault", ".mod-left-split .workspace-sidedock-vault-profile"],
    ];
    for (const [tag, sel] of steps) {
      await ev(`const st = document.createElement("style"); st.textContent = ${JSON.stringify("")} + ${JSON.stringify(sel)} + " { visibility: hidden !important; }"; document.head.append(st);`);
      await run(tag);
    }
    // 마지막: 패널 탭 줄 안에서 버튼 하나만 남기기
    await ev(`const st = document.createElement("style"); st.textContent = ".mod-left-split .workspace-tab-header-container > *:not(.lg-nav-rest) { visibility: hidden !important; }"; document.head.append(st);`);
    await run("B6-onlyrest");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "5") {
    // 굴절이 걸린 요소의 채움만 빼기 (요소 자신)
    note("rf-els", await ev(`let n = 0; for (const e of document.querySelectorAll("*")) { const c = getComputedStyle(e); if (c.backdropFilter.includes("url(")) { e.style.setProperty("background-color", "transparent", "important"); e.style.setProperty("background-image", "none", "important"); n++; } } return n;`));
    await sleep(2500); cap("J1-0-nofill-self");
    await run("J1");
    // 가상 요소(호버 유리 등)까지 전부 채움 빼기 (패널 바탕 층·패널은 남김)
    await ev(`const st = document.createElement("style"); st.textContent = ".workspace-split.mod-sidedock *, .workspace-split.mod-sidedock *::before, .workspace-split.mod-sidedock *::after, .mod-root *, .mod-root *::before, .mod-root *::after { background-color: transparent !important; background-image: none !important; }"; document.head.append(st);`);
    await sleep(2500); cap("J2-0-nofill-all");
    await run("J2");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "4") {
    // 라이트에서 포커스 잃었을 때 색 (불투명 = 비활성 재질인지 비교)
    try { execSync(`open -a Finder`); } catch {}
    await sleep(1500); cap("I1-unfocused-light");
    note("I1-focus", await ev(`const w = require("electron").remote.getCurrentWindow(); return { focused: w.isFocused(), key: document.hasFocus() };`));
    await front(); await sleep(1500); cap("I2-refocused");
    // 호버 중 창 포커스 상태
    await move(btn.x, btn.y); await sleep(300);
    note("I3-focus-hover", await ev(`const w = require("electron").remote.getCurrentWindow(); return { focused: w.isFocused(), key: document.hasFocus() };`));
    cap("I3-hover");
    // 재질 상태를 항상 활성으로 (visualEffectState 는 생성 때만이라 실행 중엔 못 바꿈) 대신 setVibrancy 다시 걸기
    await ev(`require("electron").remote.getCurrentWindow().setVibrancy("hud");`); await sleep(800); cap("I4-hover-revib");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "3") {
    // 편집창 탭 줄 버튼 호버 (굴절 켠 채)
    const eb = await ev(`const b = [...document.querySelectorAll(".mod-root .workspace-tab-header-container .clickable-icon, .mod-root .view-header .clickable-icon")].find((x) => x.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, c: b.className };`);
    note("eb", eb);
    await move(eb.x, eb.y); await sleep(500); cap("H7-a-editor-hover");
    await move(900, 600); await sleep(2500); cap("H7-b-wait");
    // 편집창 스크롤
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 900, y: 500, deltaX: 0, deltaY: 300 }); await sleep(100); cap("H8-editor-scroll");
    await sleep(2500); cap("H8-b-wait");
    // 패널 안 굴절만 끈 상태에서 패널 호버
    await ev(`const st = document.createElement("style"); st.textContent = ".workspace-split.mod-sidedock *, .workspace-split.mod-sidedock *::before, .workspace-split.mod-sidedock *::after { backdrop-filter: var(--lg-haze) !important; }"; document.head.append(st);`);
    await sleep(2500); cap("H9-0");
    await run("H9");
    await move(eb.x, eb.y); await sleep(500); cap("H10-a-editor-hover");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.HOVERTEST === "2") {
    // 굴절 끄기
    await ev(`const p = app.plugins.plugins["glass-shelf"]; p.settings.refraction = false; p.applySettings();`);
    await sleep(1500); cap("H4-0-norefract");
    await run("H4");
    // 뒤 필터 전부 끄기
    await ev(`const st = document.createElement("style"); st.textContent = "*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }"; document.head.append(st);`);
    await sleep(1500); cap("H5-0-nobackdrop");
    await run("H5");
    // 마스크·필터 전부 끄기
    await ev(`const st = document.createElement("style"); st.textContent = "*, *::before, *::after { mask-image: none !important; filter: none !important; }"; document.head.append(st);`);
    await sleep(1500); cap("H6-0-nomask");
    await run("H6");
    save(); ws.close(); process.exit(0);
  }
  // 바탕 층 새로 만들기
  await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(900); cap("H1-c-nudge");
  // 패널 아무 곳 아닌 편집창에서 커서만 움직이기
  await move(900, 500); await sleep(300); await move(950, 520); await sleep(800); cap("H1-d-editor-move");
  // 구멍 끄고 호버
  await ev(`app.plugins.plugins["glass-shelf"].acrylicHoles(false); const st = document.createElement("style"); st.id = "fake"; st.textContent = "body.lg-acrylic .workspace-split.mod-sidedock { background-color: color-mix(in srgb, var(--background-secondary) 70%, transparent) !important; }"; document.head.append(st);`);
  await sleep(500); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(900); cap("H2-0-noholes");
  await run("H2");
  // 우회 점(Windows 용)을 켜고 구멍으로 호버
  await ev(`document.getElementById("fake").remove(); app.plugins.plugins["glass-shelf"].acrylicHoles(true); for (let i = 0; i < 2; i++) { const d = document.createElement("div"); d.className = "lg-dmg-dot lg-damage"; d.style.left = (i ? 400 : 0) + "px"; d.style.top = (i ? 800 : 40) + "px"; document.body.append(d); }`);
  await sleep(500); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(900); cap("H3-0-dots");
  await run("H3");
  save(); ws.close(); process.exit(0);
}

// 2. 패널 버튼 호버, 3. 파일 목록 스크롤
const pt = await ev(`const b = [...document.querySelectorAll(".mod-left-split .workspace-tab-header-container .clickable-icon")].find((x) => x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
note("hover-pt", pt);
if (pt) { await move(pt.x, pt.y); await shot("2-hover", 400); await move(pt.x + 60, pt.y + 300); await sleep(150); cap("2b-hover-leave"); }
await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 150, y: 400, deltaX: 0, deltaY: 200 });
await sleep(100);
cap("3-scroll");

// 4. 다크
await ev(`app.changeTheme ? app.changeTheme("obsidian") : (app.vault.setConfig("theme", "obsidian"), app.updateTheme && app.updateTheme());`);
await sleep(1500);
note("s4", await state());
await shot("4-dark", 300);

// 5. 창 포커스 잃음
try { execSync(`open -a Finder`); } catch {}
await sleep(1200);
cap("5-unfocused");

// 6. 메뉴·명령 팔레트·설정 (다크)
await front();
await sleep(500);
await ev(`const el = document.querySelector(".nav-file-title"); if (el) el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 180 }));`);
await shot("6-menu", 600);
const mi = await ev(`const m = document.querySelector(".menu .menu-item"); if (!m) return null; const r = m.getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height / 2 };`);
if (mi) { for (let i = 0; i < 4; i++) { await move(mi.x, mi.y + i * 30); await sleep(120); } cap("6b-menu-hover"); }
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);
await ev(`app.commands.executeCommandById("command-palette:open");`);
await shot("7-palette", 700);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);
await ev(`app.changeTheme ? app.changeTheme("moonstone") : (app.vault.setConfig("theme", "moonstone"), app.updateTheme && app.updateTheme());`);
await sleep(1500);
note("s7b-light", await state());
await shot("7b-light-again", 300);
await ev(`app.setting.open();`);
await sleep(2000);
cap("8-settings");
note("settings-popout", await ev(`return !!(app.setting.popout && app.setting.popout.win);`));
await ev(`app.setting.close();`);
await sleep(800);

// 9. 반투명 창 끄기 → 켜기 (재시작 없이)
await ev(`app.customCss.setTranslucency(false);`);
await sleep(1200);
note("s9-off", await state());
await shot("9-translucency-off", 300);
await ev(`app.customCss.setTranslucency(true);`);
await sleep(1500);
note("s10-on", await state());
await shot("10-translucency-on", 300);

// 11. 플러그인 끄기 (Obsidian 재질로 되돌림)
await ev(`await app.plugins.disablePlugin("glass-shelf");`);
await sleep(1500);
note("s11-off", await state());
await shot("11-plugin-off", 300);

save();
ws.close();
process.exit(0);
