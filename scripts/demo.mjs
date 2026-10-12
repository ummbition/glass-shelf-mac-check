// 시연 녹화 (보여주기 보관함, 꽉 찬 창, 라이트, 렌즈): 패널 탭 렌즈 전환 → 편집창 스크롤 → 웹 뷰어 주소 입력 →
// 북마크 탭 검색창 늘렸다 줄이기 → 늘린 채로 다른 탭 전환. 한 번에 통으로 녹화
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
const front = () => ev(`const w = require("electron").remote.getCurrentWindow(); w.show(); w.focus(); require("electron").remote.app.focus({ steal: true });`);

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(2000);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(2000);
note("enable", await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return String(e); } return Object.keys(app.plugins.plugins);`));
await sleep(2500);
await ev(`app.setting.close(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());`);
const area = await ev(`return require("electron").remote.screen.getPrimaryDisplay().workArea;`);
note("workArea", area);
await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isMaximized()) w.unmaximize(); w.setBounds(${JSON.stringify(area)});`);
await ev(`const p = app.plugins.plugins["glass-shelf"]; Object.assign(p.settings, { tabAnim: "lens", fileIcons: "finder" }); await p.saveSettings(); if (app.changeTheme) app.changeTheme("moonstone");`);
note("open-folders", await ev(`const v = app.workspace.getLeavesOfType("file-explorer")[0].view; const out = []; for (const p of ["Areas", "Journal", "Notes", "Projects", "Reading"]) { const it = v.fileItems[p]; if (it && it.setCollapsed) { await it.setCollapsed(false); out.push(p); } } app.workspace.revealLeaf(app.workspace.getLeavesOfType("file-explorer")[0]); return out;`));
await ev(`const f = app.vault.getAbstractFileByPath("Notes/Essays/On Glass Interfaces.md"); if (f) await app.workspace.getLeaf(false).openFile(f);`);
await front();
await sleep(2500);
await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`);
await sleep(1000);

// 진짜 커서도 같이 옮긴다 (cliclick 이 있으면). 창 안 좌표 → 화면 좌표
let cli = true;
try { execSync("which cliclick"); } catch { cli = false; }
note("cliclick", cli);
const scr = (x, y) => [Math.round(area.x + x), Math.round(area.y + y)];
const cursor = (x, y) => { if (!cli) return; const [sx, sy] = scr(x, y); try { execSync(`cliclick -e 250 m:${sx},${sy}`); } catch (e) { cli = false; note("cliclick-err", String(e).slice(0, 200)); } };
const move = async (x, y) => { cursor(x, y); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); };
const click = async (x, y) => {
  await move(x, y); await sleep(120);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(70);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
const typeText = async (t, gap = 110) => { for (const ch of t) { await send("Input.insertText", { text: ch }); await sleep(gap); } };
const key = async (k, code, vk) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); };
const center = (sel, pick = 0, filter = "true") => ev(`const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0).filter((e) => ${filter}); const e = els[${pick}]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };`);
const leftTab = (name) => center(".mod-left-split .workspace-tab-header", 0, `(e.getAttribute("aria-label") || e.textContent || "").includes(${JSON.stringify(name)})`);

const tabs = { files: await leftTab("Files"), search: await leftTab("Search"), bookmarks: await leftTab("Bookmarks") };
note("tabs", tabs);
await move(900, 700);

if (process.env.LENSCMP) {
  const run = async (name) => {
    await move(900, 700); await sleep(1500);
    const proc = spawn("screencapture", ["-x", "-V", "14", `${OUT}/${name}.mov`]);
    const done = new Promise((r) => proc.on("exit", r));
    await sleep(1200);
    for (const t of ["search", "bookmarks", "files", "search", "bookmarks", "files"]) { await click(tabs[t].x, tabs[t].y); await sleep(1500); await move(tabs[t].x, tabs[t].y + 260); await sleep(300); }
    await Promise.race([done, sleep(6000)]);
    note("done", name);
  };
  if (process.env.LENSCMP5) {
    // 패널 바탕 0% + sidebar 재질 + 줄무늬·선택 줄을 점묘(픽셀마다 완전 불투명 또는 완전 투명)로
    await ev(`app.plugins.plugins["glass-shelf"].acrylicHoles(false); const st = document.createElement("style"); st.id = "zero"; st.textContent = "body.lg-acrylic .workspace-split.mod-sidedock:not(#lg):not(#lg) { background-color: transparent !important; }"; document.head.append(st); require("electron").remote.getCurrentWindow().setVibrancy("sidebar");`);
    await sleep(900);
    await ev(`document.body.classList.add("lg-vib-nudge"); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("lg-vib-nudge")));`);
    await sleep(900);
    await run("P-plain");
    try { execSync(`screencapture -x "${OUT}/look-plain.png"`); } catch {}
    note("dither", await ev(`
      const B = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
      const tile = (r, g, b, a) => { const c = document.createElement("canvas"); c.width = c.height = 8; const x = c.getContext("2d"); const im = x.createImageData(8, 8); for (let i = 0; i < 64; i++) { const on = B[i] < Math.round(a * 64); im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = on ? 255 : 0; } x.putImageData(im, 0, 0); return c.toDataURL(); };
      const px = 8 / devicePixelRatio;
      const stripe = tile(255, 255, 255, 0.35);
      const sel = tile(0, 0, 0, 0.09);
      const hov = tile(0, 0, 0, 0.05);
      const st = document.createElement("style"); st.id = "dither";
      st.textContent = ".lg-stripe-bar:not(#lg):not(#lg) { background-color: transparent !important; background-image: url(" + stripe + ") !important; background-size: " + px + "px " + px + "px !important; image-rendering: pixelated; }" +
        ".workspace-split.mod-sidedock .tree-item-self:is(.is-active, .is-selected):not(#lg):not(#lg):not(#lg) { background-color: transparent !important; background-image: url(" + sel + ") !important; background-size: " + px + "px " + px + "px !important; image-rendering: pixelated; }" +
        ".workspace-split.mod-sidedock .tree-item-self:hover:not(.is-active):not(#lg):not(#lg):not(#lg) { background-color: transparent !important; background-image: url(" + hov + ") !important; background-size: " + px + "px " + px + "px !important; image-rendering: pixelated; }";
      document.head.append(st); return { dpr: devicePixelRatio, len: stripe.length };`));
    await sleep(900);
    await ev(`document.body.classList.add("lg-vib-nudge"); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("lg-vib-nudge")));`);
    await sleep(900);
    try { execSync(`screencapture -x "${OUT}/look-dither.png"`); } catch {}
    await run("Q-dither");
    await run("Q2-dither");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.LENSCMP4) {
    // 패널 바탕 0% (바탕 층·구멍 끔), 패널 색은 macOS 재질에 맡긴다
    await ev(`app.plugins.plugins["glass-shelf"].acrylicHoles(false); const st = document.createElement("style"); st.id = "zero"; st.textContent = "body.lg-acrylic .workspace-split.mod-sidedock:not(#lg):not(#lg) { background-color: transparent !important; }"; document.head.append(st);`);
    for (const m of ["sidebar", "under-window", "menu", "popover", "hud"]) {
      await ev(`require("electron").remote.getCurrentWindow().setVibrancy(${JSON.stringify(m)});`);
      await sleep(900);
      await ev(`document.body.classList.add("lg-vib-nudge"); requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove("lg-vib-nudge")));`);
      await sleep(900);
      try { execSync(`screencapture -x "${OUT}/look-${m}.png"`); } catch {}
      await run("Z-" + m);
    }
    save(); ws.close(); process.exit(0);
  }
  if (process.env.LENSCMP3) {
    await run("A3-base");
    // F: 바탕 층을 독립 레이어로
    await ev(`const st = document.createElement("style"); st.id = "f"; st.textContent = ".lg-panel-under { will-change: transform; }"; document.head.append(st);`);
    await sleep(800); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(1000);
    await run("F-underlayer");
    await ev(`document.getElementById("f").remove();`);
    await sleep(800); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(1000);
    // G: 창 양 끝 구석 1px 점을 계속 깜빡여 창 전체를 다시 그리게
    await ev(`const st = document.createElement("style"); st.id = "g"; st.textContent = ".lg-full-dot { position: fixed; width: 1px; height: 1px; z-index: 99999; pointer-events: none; background: rgb(128 128 128 / 0.008); will-change: opacity; animation: lgFullBlink 1s linear infinite alternate; } @keyframes lgFullBlink { from { opacity: 0.5; } to { opacity: 1; } }"; document.head.append(st); for (const [l, t] of [[0, 0], [window.innerWidth - 1, window.innerHeight - 1]]) { const d = document.createElement("div"); d.className = "lg-full-dot"; d.style.left = l + "px"; d.style.top = t + "px"; document.querySelector(".app-container").append(d); }`);
    await sleep(800);
    await run("G-fulldamage");
    // H: 점을 body 밑(앱 묶음 바깥)에
    await ev(`document.querySelectorAll(".lg-full-dot").forEach((d) => document.body.append(d));`);
    await sleep(800);
    await run("H-fulldamage-body");
    save(); ws.close(); process.exit(0);
  }
  if (process.env.LENSCMP2) {
    await run("A2-base");
    await ev(`const p = app.plugins.plugins["glass-shelf"]; p.settings.refraction = false; p.applySettings();`);
    await sleep(1500); await ev(`p = app.plugins.plugins["glass-shelf"]; p.vibNudge();`); await sleep(1000);
    await run("D-norefract");
    // E: 굴절 끈 채로 뒤 필터도 모두 끄기 (흐림·채도 포함)
    await ev(`const st = document.createElement("style"); st.textContent = "*, *::before, *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }"; document.head.append(st);`);
    await sleep(1000); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(1000);
    await run("E-nobackdrop");
    save(); ws.close(); process.exit(0);
  }
  await run("A-base");
  // B: 구멍 끄기 (패널 바탕은 패널 자신에 70% 로 칠해 겉모습을 비슷하게)
  await ev(`app.plugins.plugins["glass-shelf"].acrylicHoles(false); const st = document.createElement("style"); st.id = "b"; st.textContent = "body.lg-acrylic .workspace-split.mod-sidedock { background-color: color-mix(in srgb, var(--background-secondary) 70%, transparent) !important; }"; document.head.append(st);`);
  await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(1000);
  await run("B-noholes");
  await ev(`document.getElementById("b").remove(); app.plugins.plugins["glass-shelf"].acrylicHoles(true);`);
  await sleep(800); await ev(`app.plugins.plugins["glass-shelf"].vibNudge();`); await sleep(1000);
  // C: 렌즈 굴절만 끄기
  await ev(`const st = document.createElement("style"); st.id = "c"; st.textContent = ".lg-seg-lens, .lg-seg-indicator { --lg-refract: none !important; } .lg-seg-lens:not(#lg):not(#lg):not(#lg) { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }"; document.head.append(st);`);
  await sleep(800);
  await run("C-nolensrefract");
  save(); ws.close(); process.exit(0);
}
if (process.env.AUDIT) {
  // 패널 안 뒤 필터 중첩: 뒤 필터를 단 요소(가상 요소 포함)와, 그 조상 중 뒤 필터를 단 요소
  const audit = () => ev(`
    const has = (el, pe) => { const c = getComputedStyle(el, pe); return c.backdropFilter && c.backdropFilter !== "none" ? c.backdropFilter.slice(0, 40) : null; };
    const name = (e) => (e.tagName.toLowerCase() + "." + [...e.classList].slice(0, 3).join(".")).slice(0, 70);
    const out = [];
    for (const root of document.querySelectorAll(".workspace-split.mod-sidedock")) {
      for (const e of root.querySelectorAll("*")) {
        for (const pe of [null, "::before", "::after"]) {
          if (pe && getComputedStyle(e, pe).content === "none") continue;
          const bf = has(e, pe); if (!bf) continue;
          const r = e.getBoundingClientRect(); if (!r.width) continue;
          const anc = []; for (let a = pe ? e : e.parentElement; a && a !== root.parentElement; a = a.parentElement) { if (a !== e || pe) { const b = has(a, null); if (b && !(a === e && !pe)) anc.push(name(a)); } if (a === root) break; }
          out.push({ el: name(e) + (pe || ""), bf, nestedIn: anc });
        }
      }
    }
    return out;`);
  note("rest", await audit());
  await click(tabs.search.x, tabs.search.y);
  await sleep(150);
  note("moving", await audit());
  save(); ws.close(); process.exit(0);
}
if (process.env.LENSONLY) {
  await move(900, 700); await sleep(800);
  const proc = spawn("screencapture", ["-x", "-V", "16", `${OUT}/lens.mov`]);
  const done = new Promise((r) => proc.on("exit", r));
  await sleep(1500);
  for (const t of ["search", "bookmarks", "files", "search", "bookmarks", "files"]) { await click(tabs[t].x, tabs[t].y); await sleep(1700); await move(tabs[t].x, tabs[t].y + 260); await sleep(300); }
  await Promise.race([done, sleep(8000)]);
  save(); ws.close(); process.exit(0);
}
if (process.env.TEST3) {
  const shotAt = (name) => { try { execSync(`screencapture -x "${OUT}/${name}.png"`); } catch {} };
  const setTip = (on) => ev(`const e = document.getElementById("notipbf"); if (e) e.remove(); if (!${on}) { const st = document.createElement("style"); st.id = "notipbf"; st.textContent = "body .tooltip:not(#lg):not(#lg) { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }"; document.head.append(st); }`);
  const order = [["A", true, "search"], ["B", false, "bookmarks"], ["C", true, "files"], ["D", false, "search"], ["E", true, "bookmarks"], ["F", false, "files"], ["G", false, "search"], ["H", true, "search"]];
  for (const [tag, on, tab] of order) {
    await setTip(on);
    await move(900, 700); await sleep(1800); shotAt(`${tag}-${on ? "bf" : "nobf"}-0`);
    await move(tabs[tab].x, tabs[tab].y);
    for (let i = 1; i <= 4; i++) { await sleep(350); shotAt(`${tag}-${on ? "bf" : "nobf"}-${i}`); }
    note(tag + "-tip", await ev(`return document.querySelectorAll(".tooltip").length;`));
  }
  save(); ws.close(); process.exit(0);
}
if (process.env.TEST2) {
  const panelSd = () => { try { execSync(`screencapture -x /tmp/p.png`); const out = execSync(`python3 -c "import struct,zlib;print(1)"`).toString(); } catch {} };
  const shotAt = (name) => { try { execSync(`screencapture -x "${OUT}/${name}.png"`); } catch {} };
  // 툴팁: 패널 탭 위에 커서를 두고 툴팁이 뜨는 동안 여러 장
  const tipRun = async (tag, tab) => {
    await move(900, 700); await sleep(1500); shotAt(tag + "-0-before");
    await move(tab.x, tab.y);
    for (let i = 1; i <= 6; i++) { await sleep(300); shotAt(tag + "-" + i); }
    note(tag + "-tooltip", await ev(`return document.querySelectorAll(".tooltip").length;`));
    await move(900, 700); await sleep(1200); shotAt(tag + "-9-after");
  };
  await tipRun("T1", tabs.search);
  await ev(`const st = document.createElement("style"); st.id = "notipbf"; st.textContent = "body .tooltip:not(#lg):not(#lg) { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }"; document.head.append(st);`);
  await tipRun("T2", tabs.bookmarks);
  await ev(`document.getElementById("notipbf").remove();`);
  await tipRun("T3", tabs.files);
  // 렌즈 프레임 간격 (녹화 없이 / 녹화 중 / 굴절 끔)
  await ev(`window.__lgT = []; const tick = (t) => { window.__lgT.push(t); requestAnimationFrame(tick); }; requestAnimationFrame(tick);`);
  const lensRun = async (tag) => {
    const res = [];
    for (const t of ["search", "bookmarks", "files", "bookmarks", "files", "search", "files"]) {
      await ev(`window.__lgT.length = 0;`);
      await click(tabs[t].x, tabs[t].y);
      await sleep(700);
      const d = await ev(`const a = window.__lgT; const ds = []; for (let i = 1; i < a.length; i++) ds.push(+(a[i] - a[i - 1]).toFixed(1)); return ds;`);
      res.push({ n: d.length, max: Math.max(...d), over25: d.filter((x) => x > 25).length, over50: d.filter((x) => x > 50).length });
    }
    note("lens-" + tag, res);
  };
  await move(900, 700);
  await lensRun("norec");
  const rec = spawn("screencapture", ["-x", "-V", "8", `${OUT}/lens-rec.mov`]);
  await sleep(500);
  await lensRun("rec");
  await new Promise((r) => rec.on("exit", r));
  await ev(`const p = app.plugins.plugins["glass-shelf"]; p.settings.refraction = false; p.applySettings();`);
  await sleep(1500);
  await lensRun("norefract");
  save(); ws.close(); process.exit(0);
}

// ---- 녹화 시작 ----
const proc = spawn("screencapture", ["-x", "-V", "58", `${OUT}/demo.mov`]);
await sleep(1800);

// 1. 패널 탭 렌즈 전환
for (const t of ["search", "bookmarks", "files", "bookmarks", "files"]) { if (tabs[t]) { await click(tabs[t].x, tabs[t].y); await sleep(900); } }
await sleep(500);

// 2. 편집창 스크롤
await move(1100, 560); await sleep(400);
for (let i = 0; i < 18; i++) { cursor(1100, 560); await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 1100, y: 560, deltaX: 0, deltaY: 70 }); await sleep(55); }
await sleep(700);
for (let i = 0; i < 18; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 1100, y: 560, deltaX: 0, deltaY: -70 }); await sleep(55); }
await sleep(800);

// 3. 웹 뷰어: 새 탭으로 열고 주소 입력
note("webviewer", await ev(`const ids = Object.keys(app.commands.commands).filter((k) => k.startsWith("webviewer:")); const id = ids.find((k) => /open$/.test(k)) || ids[0]; if (id) app.commands.executeCommandById(id); return ids;`));
await sleep(1800);
await ev(`app.commands.executeCommandById("webviewer:focus-address-bar");`);
await sleep(700);
const addr = await ev(`const a = document.activeElement; if (!a) return null; const r = a.getBoundingClientRect(); return { tag: a.tagName, cls: a.className, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), v: a.value };`);
note("addr", addr);
if (addr && addr.tag === "INPUT") {
  await move(addr.x, addr.y); await sleep(300);
  await ev(`const i = document.activeElement; if (i && i.select) i.select();`);
  await typeText("obsidian.md");
  await sleep(400);
  await key("Enter", "Enter", 13);
  await sleep(5000);
  note("web-url", await ev(`const v = app.workspace.activeLeaf && app.workspace.activeLeaf.view; return v && v.getState ? v.getState() : null;`));
}

// 4. 북마크 탭: 검색창 늘렸다 줄이기
if (tabs.bookmarks) { await click(tabs.bookmarks.x, tabs.bookmarks.y); await sleep(1200); }
const sbtn = await center(".mod-left-split .lg-nav-row .lg-nav-btn", 0, `!!e.querySelector(".lucide-search")`);
note("searchbtn", sbtn);
if (sbtn) {
  await click(sbtn.x, sbtn.y); await sleep(1300);
  await typeText("design", 140); await sleep(1000);
  // 줄이기: 넓어진 알약 왼쪽의 돋보기를 누른다 (오른쪽 끝은 지우기 버튼)
  const s2 = await center(".mod-left-split .lg-nav-search svg.lucide-search");
  note("searchicon", s2);
  if (s2) { await click(s2.x, s2.y); await sleep(1400); }
  // 5. 다시 늘리고 그대로 다른 탭으로
  const s3 = await center(".mod-left-split .lg-nav-row .lg-nav-btn", 0, `!!e.querySelector(".lucide-search")`);
  if (s3) { await click(s3.x, s3.y); await sleep(1400); }
  if (tabs.files) { await click(tabs.files.x, tabs.files.y); await sleep(1600); }
  if (tabs.bookmarks) { await click(tabs.bookmarks.x, tabs.bookmarks.y); await sleep(1600); }
}
await move(900, 700);
note("rec-wait", "until end");
await new Promise((r) => proc.on("exit", r));
note("rec", "done");
save();
ws.close();
process.exit(0);
