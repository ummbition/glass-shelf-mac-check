// A/B: 반투명(vibrancy)을 실행 중에 켠 창(A, Obsidian 방식) vs 만들 때 켠 창(B)
const { app, BrowserWindow } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const OUT = process.env.OUT || "/tmp/ab";
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (k, v) => { log.push({ t: Date.now(), k, v }); fs.writeFileSync(`${OUT}/ab-log.json`, JSON.stringify(log, null, 1)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => { try { execSync(`screencapture -x "${OUT}/${name}.png"`); } catch (e) { note("shot-err", String(e)); } };

app.whenReady().then(async () => {
  note("versions", process.versions);
  const base = { width: 620, height: 640, y: 120, backgroundColor: "#00000000", titleBarStyle: "hidden", show: false };
  const a = new BrowserWindow({ ...base, x: 40 });
  const b = new BrowserWindow({ ...base, x: 700, vibrancy: "sidebar" });
  await a.loadFile(path.join(__dirname, "page.html"), { query: { name: "A: vibrancy 실행 중에 켬 (Obsidian 방식)" } });
  await b.loadFile(path.join(__dirname, "page.html"), { query: { name: "B: vibrancy 만들 때 켬" } });
  a.show(); b.show();
  // Obsidian 과 같은 순서: 배경 투명 → setVibrancy("sidebar")
  a.setBackgroundColor("#00000000"); a.setVibrancy("sidebar");
  b.setBackgroundColor("#00000000");
  note("bounds", { a: a.getBounds(), b: b.getBounds(), a2: a.getContentBounds(), b2: b.getContentBounds() });
  const c = new BrowserWindow({ width: 420, height: 300, x: 1360, y: 120, titleBarStyle: "hidden" });
  await c.loadFile(path.join(__dirname, "page.html"), { query: { name: "C: 반투명 없음" } });
  await sleep(4000);
  for (const [k, w] of [["a", a], ["b", b], ["c", c]]) {
    try { note("text-" + k, await w.webContents.executeJavaScript("document.body.innerText.slice(0, 80)")); } catch (e) { note("text-err-" + k, String(e)); }
    try { const im = await w.webContents.capturePage(); fs.writeFileSync(`${OUT}/cap-${k}.png`, im.toPNG()); note("cap-" + k, im.getSize()); } catch (e) { note("cap-err-" + k, String(e)); }
  }
  shot("0-diag");
  const rec = spawn("screencapture", ["-x", "-V", "24", `${OUT}/ab.mov`]);
  const done = new Promise((r) => rec.on("exit", r));
  await sleep(1500);
  shot("1-before");
  const go = (phase) => { for (const w of [a, b]) w.webContents.executeJavaScript(`setPhase(${JSON.stringify(phase)})`); note("phase", phase); };
  // 1) 호버만 (기준)
  go("hover"); await sleep(2500); shot("2-hover"); await sleep(1500);
  go("idle"); await sleep(1500);
  // 2) 불투명한 오른쪽 절반 안에서만 유리가 움직임
  go("right"); await sleep(2500); shot("4-right"); await sleep(1500);
  go("idle"); await sleep(1500);
  // 3) 오른쪽 유리 + 왼쪽(반투명 자리) 호버
  go("rightboth"); await sleep(2500); shot("6-rightboth"); await sleep(2500);
  go("idle"); await sleep(2000); shot("7-end");
  await Promise.race([done, sleep(8000)]);
  note("done", true);
  app.quit();
});
