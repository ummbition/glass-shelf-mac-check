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

const shot = (n) => { try { execSync(`screencapture -x "${OUT}/${n}.png"`); } catch {} };
for (const mode of ["light", "dark"]) {
  note("theme", await ev(`app.changeTheme("${mode === "dark" ? "obsidian" : "moonstone"}"); return app.getTheme();`));
  await sleep(1000);
  await front();
  note("open", await ev(`app.setting.open(); await new Promise(r => setTimeout(r, 1500)); const d = activeDocument; const i = d.querySelector('.modal.mod-settings .setting-search-container input'); const r = i && i.getBoundingClientRect(); return { popout: d.body.classList.contains('is-popout-modal'), mac: d.body.classList.contains('mod-macos'), inp: r && [r.left, r.top, r.width, r.height], frame: d.body.className.slice(0, 200) };`));
  await sleep(800);
  shot(`settings-${mode}`);
  await ev(`app.setting.close();`);
  await sleep(800);
}
save();
process.exit(0);
