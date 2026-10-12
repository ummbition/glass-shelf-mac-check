// 웹 뷰어 새 탭에서 주소를 열면 경로 알약 주소 표시가 따라오는지
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const OUT = process.env.OUT || "shots";
setTimeout(() => process.exit(2), 180000);
mkdirSync(OUT, { recursive: true });
const log = []; const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 90 && !target; i++) { try { const l = await (await fetch("http://127.0.0.1:9222/json")).json(); target = l.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {} if (!target) await sleep(1000); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); return m.result && m.result.result ? m.result.result.value : m; };
for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();`);
await sleep(1500);
await ev(`try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!app.plugins.plugins["glass-shelf"]) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) {} app.setting.close();`);
await sleep(2000);
const label = () => ev(`return [...document.querySelectorAll(".mod-root .lg-web-url")].map((e) => e.textContent);`);
for (const url of ["obsidian.md", "github.com"]) {
  await ev(`app.commands.executeCommandById("webviewer:open");`); await sleep(1800);
  note("before", await label());
  await ev(`app.commands.executeCommandById("webviewer:focus-address-bar");`); await sleep(500);
  await ev(`const i = document.activeElement; if (i && i.select) i.select();`); await sleep(200);
  for (const ch of url) { await send("Input.insertText", { text: ch }); await sleep(130); }
  note("typed-" + url, await ev(`const i = document.activeElement; return i ? [i.tagName, i.value, i.selectionStart] : null;`));
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await sleep(5000);
  note("after-" + url, { label: await label(), state: await ev(`const v = app.workspace.activeLeaf.view; return { st: v.getState ? v.getState().url : null, url: v.url, input: v.addressBar && v.addressBar.addrInputEl && v.addressBar.addrInputEl.value, pill: [...document.querySelectorAll(".mod-root .lg-path-pill")].map((p) => p.className) };`) });
}
try { execSync(`screencapture -x "${OUT}/web.png"`); } catch {}
// 플러그인을 끄고 같은 입력: 글자가 거꾸로 들어가는 게 플러그인 탓인지
await ev(`await app.plugins.disablePlugin("glass-shelf");`); await sleep(1500);
await ev(`app.commands.executeCommandById("webviewer:open");`); await sleep(1800);
await ev(`app.commands.executeCommandById("webviewer:focus-address-bar");`); await sleep(500);
await ev(`const i = document.activeElement; if (i && i.select) i.select();`); await sleep(200);
for (const ch of "obsidian.md") { await send("Input.insertText", { text: ch }); await sleep(130); }
note("typed-noplugin", await ev(`const i = document.activeElement; return i ? [i.tagName, i.value, i.selectionStart] : null;`));
writeFileSync(`${OUT}/log.json`, JSON.stringify(log, null, 1));
process.exit(0);
