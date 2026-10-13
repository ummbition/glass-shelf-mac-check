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
  await sleep(4000);
  const rec = spawn("screencapture", ["-x", "-V", "26", `${OUT}/ab.mov`]);
  const done = new Promise((r) => rec.on("exit", r));
  await sleep(1500);
  shot("1-before");
  const go = (phase) => { for (const w of [a, b]) w.webContents.executeJavaScript(`setPhase(${JSON.stringify(phase)})`); note("phase", phase); };
  // 1) 호버처럼 반투명 칠만 깜빡임 (유리 없음)
  go("hover"); await sleep(2500); shot("2-hover"); await sleep(2500);
  go("idle"); await sleep(1500); shot("3-after-hover");
  // 2) 유리(backdrop-filter) 렌즈가 알약 위를 움직임
  go("lens"); await sleep(2500); shot("4-lens"); await sleep(2500);
  go("idle"); await sleep(1500); shot("5-after-lens");
  // 3) 유리 + 호버 같이
  go("both"); await sleep(2500); shot("6-both"); await sleep(2500);
  go("idle"); await sleep(2000); shot("7-end");
  await Promise.race([done, sleep(8000)]);
  note("done", true);
  app.quit();
});
