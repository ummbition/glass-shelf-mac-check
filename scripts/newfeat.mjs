// 새 기능 맥 확인: 메뉴 모양(컴팩트 끔/켬), 드롭다운 방향, 그래프 설정 창 테두리, 짬통, 보기 헤더 버튼·퍼즐, 북마크 표시, 웹 주소칸, 설정 예시 애니메이션
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const OUT = process.env.OUT || "shots";
mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)); };
const save = () => writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
setTimeout(() => { save(); process.exit(2); }, 300000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 90 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9222/json")).json(); target = l.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {} if (!target) await sleep(1000); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (m.result && m.result.exceptionDetails) return { err: m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description }; return m.result && m.result.result ? m.result.result.value : m; };
const shot = (n) => { try { execSync(`screencapture -x "${OUT}/${n}.png"`); } catch {} };
const click = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) { await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 }); await sleep(type === "mousePressed" ? 120 : 40); }
};
const clickSel = async (sel) => { const r = await ev(`const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];`); if (r && !r.err) await click(r[0], r[1]); return r; };
const key = async (k, code, vk) => { await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); };
const esc = () => key("Escape", "Escape", 27);
const step = async (name, fn) => { try { await fn(); } catch (e) { note(name + "-error", String(e)); } save(); };
const menuInfo = `const m = [...document.querySelectorAll(".menu:not(.lg-menu-ghost)")].pop(); if (!m) return null; const cs = getComputedStyle(m); const it = m.querySelector(".menu-item"); const r = m.getBoundingClientRect();
  return { rect: [r.left, r.top, r.width, r.height].map(Math.round), r: cs.borderTopLeftRadius, shape: cs.cornerShape, minW: cs.minWidth, itemH: it && it.offsetHeight, itemR: it && getComputedStyle(it).borderTopLeftRadius, itemShape: it && getComputedStyle(it).cornerShape, bTop: cs.borderTopColor, bLeft: cs.borderLeftColor, bg: cs.backgroundImage.slice(0, 90), cls: m.className, items: [...m.querySelectorAll(".menu-item-title")].map((e) => e.textContent) };`;

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);
await step("setup", async () => {
  note("setup", await ev(`if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); app.customCss.setTheme("Glass Shelf"); app.setting.close(); const nat0 = app.vault.getConfig("nativeMenus"); app.vault.setConfig("nativeMenus", false); const wv = app.internalPlugins.getPluginById("webviewer"); if (wv && !wv.enabled) await wv.enable();
    await app.workspace.openLinkText("시험", "", false); await new Promise((r) => setTimeout(r, 1500));
    const pl = app.plugins.plugins["glass-shelf"];
    return { cls: document.body.className, ver: pl && pl.manifest.version, rm: pl && pl.settings.reduceMotion, native0: nat0, native: app.vault.getConfig("nativeMenus"), wv: !!(wv && wv.enabled) };`));
  await sleep(1500); shot("00-start");
});
const setRm = (v) => ev(`const pl = app.plugins.plugins["glass-shelf"]; pl.settings.reduceMotion = "${v}"; await pl.saveSettings(); pl.applyBodyState(document); return document.body.classList.contains("lg-rm");`);

for (const rm of ["off", "pc"]) {
  await step("rm-" + rm, async () => {
    note("rm-" + rm, await setRm(rm)); await sleep(500);
    note(rm + "-rib-btn", await clickSel(".lg-rib-menu")); await sleep(250);
    note(rm + "-rib-menu-early", await ev(menuInfo)); await sleep(700);
    note(rm + "-rib-menu", await ev(menuInfo)); shot(`${rm}-1-rib-menu`); await esc(); await sleep(500);
    await ev(`const w = document.body.createDiv({ cls: "lg-test-dd" }); w.style.cssText = "position:fixed;right:420px;top:240px;z-index:50"; const s = w.createEl("select", { cls: "dropdown" }); for (const t of ["가", "나나", "다"]) s.createEl("option", { text: t });`);
    await sleep(300);
    const sr = await ev(`const b = document.querySelector(".lg-test-dd select").getBoundingClientRect(); return [b.left, b.right, b.top, b.bottom];`);
    note(rm + "-dd-select", sr);
    await click((sr[0] + sr[1]) / 2, (sr[2] + sr[3]) / 2); await sleep(900);
    note(rm + "-dd-menu", await ev(menuInfo)); shot(`${rm}-2-dropdown`);
    await ev(`window.__seq = []; const t0 = performance.now(); const f = () => { const g = document.querySelector(".menu.lg-menu-ghost"); if (g) { const r = g.getBoundingClientRect(); window.__seq.push([Math.round(performance.now() - t0), Math.round(r.left), Math.round(r.right)]); } if (performance.now() - t0 < 400) requestAnimationFrame(f); }; requestAnimationFrame(f);`);
    await esc(); await sleep(600);
    note(rm + "-dd-close", await ev(`return window.__seq;`));
    await ev(`document.querySelectorAll(".lg-test-dd").forEach((e) => e.remove());`); await sleep(300);
  });
}
await setRm("off"); await sleep(400);
await step("graph", async () => {
  await ev(`app.commands.executeCommandById("graph:open");`); await sleep(2500);
  note("graph-btn", await clickSel(".mod-root .graph-controls.is-close .graph-controls-button.mod-open") || await clickSel(".mod-root .graph-controls.is-close"));
  await sleep(900);
  note("graph", await ev(`const g = document.querySelector(".mod-root .graph-controls:not(.is-close)"); if (!g) return null; const cs = getComputedStyle(g); return { bg: cs.backgroundImage.slice(0, 120), clip: cs.backgroundClip, bt: cs.borderTopColor, r: cs.borderTopLeftRadius };`));
  shot("graph");
  await ev(`app.workspace.activeLeaf.detach();`); await sleep(800);
  await ev(`await app.workspace.openLinkText("시험", "", false);`); await sleep(1000);
});
await step("junk", async () => {
  note("junk", await ev(`const rr = document.querySelector(".workspace-ribbon.mod-right"); const a = createDiv({ cls: "side-dock-ribbon-action clickable-icon lg-test-rr", attr: { "aria-label": "시험 오른쪽 리본" } }); a.setText("★"); if (rr) (rr.querySelector(".side-dock-actions") || rr).appendChild(a);
    app.plugins.plugins["glass-shelf"].requestRefresh(); await new Promise((r) => setTimeout(r, 1200));
    const j = document.querySelector(".lg-junk"), m = document.querySelector(".lg-rib-menu"); const hc = m && m.closest(".workspace-tab-header-container");
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width].map(Math.round); };
    return { rr: !!rr, junk: R(j), rib: R(m), pad: hc && getComputedStyle(hc).paddingLeft, tabsCls: hc && hc.parentElement.className };`));
  shot("junk");
  await clickSel(".lg-junk"); await sleep(800); note("junk-menu", await ev(menuInfo));
  shot("junk-menu"); await esc(); await sleep(400);
});
await step("acts", async () => {
  note("acts", await ev(`const v = app.workspace.activeLeaf.view; for (let i = 0; i < 7; i++) v.addAction(["star", "heart", "zap", "sun", "moon", "cloud", "flag"][i], "시험 " + i, () => {});
    app.plugins.plugins["glass-shelf"].requestRefresh(); await new Promise((r) => setTimeout(r, 1200));
    const t = document.querySelector(".mod-root .workspace-tabs.mod-active .lg-tab-tools") || document.querySelector(".mod-root .lg-tab-tools");
    return { shown: t ? t.querySelectorAll(".lg-act-btn:not(.lg-act-more)").length : null, more: !!(t && t.querySelector(".lg-act-more")), w: innerWidth };`));
  shot("acts");
  await clickSel(".mod-root .lg-act-more"); await sleep(800);
  note("acts-menu", await ev(menuInfo));
  shot("acts-menu"); await esc(); await sleep(400);
});
await step("bookmark", async () => {
  note("bm", await ev(`const bp = app.internalPlugins.getPluginById("bookmarks"); if (!bp.enabled) await bp.enable(); bp.instance.addItem({ type: "file", path: "시험.md", title: "" }); await new Promise((r) => setTimeout(r, 1500));
    app.plugins.plugins["glass-shelf"].requestRefresh(); await new Promise((r) => setTimeout(r, 800));
    const tb = document.querySelector(".mod-root .lg-tab-bm"); return { showPath: document.body.classList.contains("lg-show-path"), tabBm: !!tb, tabBmVis: tb ? getComputedStyle(tb).display + "/" + getComputedStyle(tb).opacity : null, pathBm: !!document.querySelector(".mod-root .lg-path-bm") };`));
  shot("bm-onerow");
  note("bm-path", await ev(`const pl = app.plugins.plugins["glass-shelf"]; pl.settings.showPath = true; await pl.saveSettings(); pl.applyBodyState(document); pl.requestRefresh(); await new Promise((r) => setTimeout(r, 1500)); const b = document.querySelector(".mod-root .lg-path-bm"); return { pathBm: !!b, vis: b ? getComputedStyle(b).display : null, pill: [...document.querySelectorAll(".mod-root .lg-path-pill")].map((p) => p.className) };`));
  shot("bm-path");
});
await step("web", async () => {
  await ev(`app.commands.executeCommandById("webviewer:open");`); await sleep(2000);
  await ev(`app.commands.executeCommandById("webviewer:focus-address-bar");`); await sleep(500);
  await ev(`const i = document.activeElement; if (i && i.select) i.select();`);
  for (const ch of "example.com") { await send("Input.insertText", { text: ch }); await sleep(80); }
  await key("Enter", "Enter", 13);
  await sleep(4000);
  const geo = `const p = document.querySelector(".mod-root .workspace-tabs.mod-active .lg-path-pill.lg-path-web") || document.querySelector(".mod-root .lg-path-pill.lg-path-web"); if (!p) return null; const pr = p.getBoundingClientRect(); const u = p.querySelector(".lg-web-url"); const ur = u && u.getBoundingClientRect();
    return { cls: p.className, pill: [pr.left, pr.right, pr.width].map(Math.round), urlMid: ur && Math.round(ur.left + ur.width / 2), pillMid: Math.round(pr.left + pr.width / 2), body: document.body.classList.contains("lg-addr-typing"), focus: document.activeElement && document.activeElement.tagName };`;
  note("web-loaded", await ev(geo)); shot("web-loaded");
  await ev(`app.commands.executeCommandById("webviewer:focus-address-bar");`); await sleep(600);
  note("web-typing", await ev(geo)); shot("web-typing");
  const c = await ev(`const v = document.querySelector(".mod-root .workspace-leaf.mod-active .view-content"); const b = v.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];`);
  await click(c[0], c[1]); await sleep(800);
  note("web-after-body", await ev(geo)); shot("web-after-body");
});
await step("settings", async () => {
  await ev(`app.setting.open(); app.setting.openTabById("glass-shelf");`); await sleep(2000);
  note("settings", await ev(`const d = (app.setting.popout && app.setting.popout.win && app.setting.popout.win.document) || document; const demo = d.querySelector(".lg-mdemo"); if (demo) demo.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 800));
    const menu = d.querySelector(".lg-mdemo-menu"); const samp = []; for (let i = 0; i < 12; i++) { const r = menu && menu.getBoundingClientRect(); samp.push(menu ? [Math.round(r.width), getComputedStyle(menu).opacity, menu.getAnimations().length] : null); await new Promise((r) => setTimeout(r, 400)); }
    const name = demo && demo.closest(".setting-item").querySelector(".setting-item-name"); const pick = d.querySelector(".lg-pick");
    return { popout: d !== document, demo: !!demo, name: name && name.textContent, samp, state: d.querySelector(".lg-mdemo-state") && d.querySelector(".lg-mdemo-state").textContent, pick: pick && [pick.scrollWidth, pick.clientWidth, getComputedStyle(pick).overflowX] };`));
  shot("settings-demo");
  await ev(`app.setting.close();`);
});
save();
process.exit(0);
