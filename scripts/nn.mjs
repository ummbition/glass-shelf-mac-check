// Notebook Navigator 맥 확인: 넓게 모드에서 맨 위 묶음에 NN 이 보이면 탭 알약이 첫 줄로(lg-nn-one), 돌아가면 둘째 줄로. 프레임마다 알약 자리 기록
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const consoleMsgs = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 2000)); };
const save = () => { writeFileSync(`${OUT}/nn.json`, JSON.stringify(log, null, 1)); writeFileSync(`${OUT}/console.json`, JSON.stringify(consoleMsgs, null, 1)); };
setTimeout(() => { save(); process.exit(2); }, 240000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 90 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9222/json")).json(); target = l.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {} if (!target) await sleep(1000); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled" && /error|warn/.test(m.params.type)) consoleMsgs.push({ type: m.params.type, text: m.params.args.map((a) => a.value !== undefined ? String(a.value) : a.description || "").join(" ").slice(0, 600) });
  else if (m.method === "Runtime.exceptionThrown") consoleMsgs.push({ type: "exception", text: String((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).slice(0, 800) });
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Runtime.enable");
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description }; return m.result && m.result.result ? m.result.result.value : m; };
const shot = (n) => { try { execSync(`screencapture -x "${OUT}/${n}.png"`); } catch {} };
const click = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) { await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 }); await sleep(type === "mousePressed" ? 120 : 40); }
};
const step = async (name, fn) => { try { await fn(); } catch (e) { note(name + "-error", String(e)); } save(); };

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);

const STATE = `const T = window.__nnTabs; const inner = T && T.querySelector(":scope > .workspace-tab-header-container > .workspace-tab-header-container-inner"); const header = T && T.querySelector(":scope > .workspace-tab-header-container");
  const row = header && header.querySelector(":scope > .lg-nav-row"); const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
  const split = T && T.closest(".workspace-split");
  return { tabsCls: T && T.className, nnOne: !!(T && T.classList.contains("lg-nn-one")), inner: R(inner), header: R(header), collapse: R(header && header.querySelector(".sidebar-toggle-button")), row: row && { cls: row.className, rect: R(row), btns: [...row.querySelectorAll(".lg-nav-btn")].map((b) => [b.className.replace("lg-nav-btn", "").trim(), ...R(b)]) },
    splitNnShown: !!(split && split.classList.contains("lg-nn-shown")), lift: [...document.querySelectorAll(".lg-vault-lift")].map((e) => e.className.slice(0, 100) + " " + JSON.stringify(R(e))), nnShown: app.workspace.getLeavesOfType("notebook-navigator").map((l) => l.view && l.view.containerEl.isShown()) };`;

await step("setup", async () => {
  note("setup", await ev(`if (app.plugins.setEnable) await app.plugins.setEnable(true);
    if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf");
    if (!app.plugins.plugins["notebook-navigator"]) await app.plugins.enablePluginAndSave("notebook-navigator");
    app.customCss.setTheme("Glass Shelf"); app.setting.close(); app.vault.setConfig("nativeMenus", false);
    let pl; for (let i = 0; i < 120; i++) { pl = app.plugins.plugins["glass-shelf"]; if (pl && pl.settings) break;
      if (i === 40 || i === 80) { app.customCss.setTheme(""); await new Promise((r) => setTimeout(r, 500)); await app.plugins.disablePlugin("glass-shelf"); await app.plugins.enablePlugin("glass-shelf"); app.customCss.setTheme("Glass Shelf"); }
      await new Promise((r) => setTimeout(r, 250)); }
    if (!pl || !pl.settings) return { fail: "glass-shelf core not started", body: document.body.className, theme: app.customCss.theme, loaded: Object.keys(app.plugins.plugins) };
    pl = app.plugins.plugins["glass-shelf"]; pl.settings.tabWide = true; pl.settings.reduceMotion = "off"; await pl.saveSettings(); pl.applyBodyState(document);
    await app.workspace.openLinkText("시험", "", false); await new Promise((r) => setTimeout(r, 1500));
    const nnp = app.plugins.plugins["notebook-navigator"];
    return { body: document.body.className, ver: pl.manifest.version, nn: !!nnp, nnVer: nnp && nnp.manifest.version, tabWide: document.body.classList.contains("lg-tab-wide"), ua: navigator.userAgent.match(/obsidian\\/[\\d.]+/i) };`));
  await sleep(1500);
  note("place", await ev(`let fe = app.workspace.getLeavesOfType("file-explorer")[0];
    if (!fe) { fe = app.workspace.getLeftLeaf(false); await fe.setViewState({ type: "file-explorer" }); }
    const parent = fe.parent;
    for (const l of [...parent.children]) if (l !== fe && l.view && l.view.getViewType() !== "notebook-navigator") l.detach();
    try { app.workspace.leftSplit.setSize(520); } catch (e) {}
    for (const l of app.workspace.getLeavesOfType("notebook-navigator")) if (l.parent !== parent) l.detach();
    let nl = app.workspace.getLeavesOfType("notebook-navigator")[0];
    if (!nl) { nl = app.workspace.createLeafInParent(parent, parent.children.length); await nl.setViewState({ type: "notebook-navigator", active: false }); }
    window.__fe = fe; window.__nl = nl; window.__nnTabs = parent.containerEl;
    app.workspace.revealLeaf(fe); await new Promise((r) => setTimeout(r, 1200));
    return { parentTop: parent.containerEl.classList.contains("mod-top"), inLeft: !!parent.containerEl.closest(".mod-left-split"), kids: parent.children.map((l) => l.view && l.view.getViewType()) };`));
  await sleep(1500);
  note("start", await ev(STATE)); shot("00-start-fe");
});

const sw = async (name, leafVar) => {
  await step(name, async () => {
    const before = await ev(STATE);
    await ev(`window.__seq = []; const T = window.__nnTabs; const inner = T.querySelector(":scope > .workspace-tab-header-container > .workspace-tab-header-container-inner"); const header = T.querySelector(":scope > .workspace-tab-header-container");
      const t0 = performance.now(); const f = () => { const b = inner.getBoundingClientRect(); const row = header.querySelector(":scope > .lg-nav-row"); const rb = row && row.getBoundingClientRect();
        window.__seq.push([Math.round(performance.now() - t0), Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10, Math.round(b.width * 10) / 10, T.classList.contains("lg-nn-one") ? 1 : 0, row ? (row.classList.contains("lg-nav-row-out") ? "out" : row.classList.contains("lg-nav-none") ? "none" : "in") : "-", rb ? Math.round(rb.width) : null, row ? [...row.querySelectorAll(".lg-nav-btn")].map((x) => Math.round(x.getBoundingClientRect().width)).join(",") : "", inner.getAnimations().length, inner.offsetWidth, T.classList.contains("lg-nav-fold") ? "fold" : ""]);
        if (performance.now() - t0 < 470) requestAnimationFrame(f); }; requestAnimationFrame(f);`);
    // 탭 머리를 실제로 눌러 바꾼다. 안 보이면 revealLeaf
    const pos = await ev(`const h = window.${leafVar}.tabHeaderEl; const b = h.getBoundingClientRect(); return b.width > 2 && h.offsetParent ? [b.left + b.width / 2, b.top + b.height / 2] : null;`);
    if (pos && !pos.err) await click(pos[0], pos[1]); else await ev(`app.workspace.revealLeaf(window.${leafVar});`);
    await sleep(80); shot(name + "-mid");
    await sleep(600);
    const seq = await ev(`return window.__seq;`);
    const after = await ev(STATE);
    // 폭이 처음과 끝 값 범위를 벗어난(움푹 꺼진·튀어나온) 프레임
    let dips = [], changes = 0;
    if (Array.isArray(seq) && seq.length) {
      const w0 = seq[0][3], w1 = seq[seq.length - 1][3]; const lo = Math.min(w0, w1) - 0.6, hi = Math.max(w0, w1) + 0.6;
      dips = seq.filter((s) => s[3] < lo || s[3] > hi);
      for (let i = 1; i < seq.length; i++) if (Math.abs(seq[i][3] - seq[i - 1][3]) > 0.6) changes++;
    }
    note(name, { clickedAt: pos, before, after, widthChanges: changes, dips, seq });
    shot(name + "-after");
  });
};
await sw("01-fe-to-nn", "__nl");
await sleep(800);
await sw("02-nn-to-fe", "__fe");
await sleep(800);
await sw("03-fe-to-nn-again", "__nl");
await sleep(1000);
await step("nn-final", async () => { note("nn-final", await ev(STATE)); shot("04-nn-final"); });
save();
process.exit(0);
