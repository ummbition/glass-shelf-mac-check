// 맥: 화면이 움직이는 동안 반투명 패널이 불투명해지는 조건 가르기 (기본 테마, 플러그인 없음)
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
  try { const list = await (await fetch("http://127.0.0.1:9222/json")).json(); target = list.find((t) => t.type === "page" && /index\.html/.test(t.url)); } catch {}
  if (!target) await sleep(1000);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const m = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); return m.result && m.result.result ? m.result.result.value : m; };
const cap = (name) => { try { execSync(`screencapture -x "${OUT}/${name}.png"`); note("shot", name); } catch (e) { note("shot-err", String(e)); } };
const move = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });

for (let i = 0; i < 60; i++) { if (await ev(`return !!(window.app && app.workspace && app.workspace.layoutReady)`) === true) break; await sleep(1000); }
await sleep(1500);
await ev(`for (const b of document.querySelectorAll(".modal-container button")) if (/Restricted/i.test(b.textContent)) b.click(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());`);
await ev(`const w = require("electron").remote.getCurrentWindow(); if (w.isMaximized()) w.unmaximize(); const d = require("electron").remote.screen.getPrimaryDisplay().workArea; w.setBounds({ x: d.x + 120, y: d.y + 40, width: d.width - 160, height: d.height - 80 }); w.focus();`);
await ev(`app.workspace.leftSplit.expand(); const f = app.vault.getAbstractFileByPath("시험.md"); if (f) await app.workspace.getLeaf().openFile(f);`);
// 재질은 잘 보이게 hud, 흰 막 비움
await ev(`require("electron").remote.getCurrentWindow().setVibrancy("hud"); const st = document.createElement("style"); st.textContent = ".app-container { background: transparent !important; } #iso-anim { position: fixed; left: 1200px; top: 600px; width: 40px; height: 40px; background: red; } #iso-anim.on { animation: isoSpin 1s linear infinite; } @keyframes isoSpin { to { transform: rotate(360deg); } } #iso-bf { position: fixed; left: 1300px; top: 600px; width: 80px; height: 80px; border-radius: 40px; backdrop-filter: blur(8px); background: rgb(255 255 255 / 0.2); } #iso-op.on { animation: isoOp 1s linear infinite alternate; } #iso-op { position: fixed; left: 1100px; top: 600px; width: 40px; height: 40px; background: blue; } @keyframes isoOp { to { opacity: 0.3; } }"; document.head.append(st); for (const k of ["iso-anim", "iso-op"]) { const d = document.createElement("div"); d.id = k; document.body.append(d); }`);
await sleep(1500);
await move(900, 500);
await sleep(1500);
cap("T0-idle");
await ev(`document.getElementById("iso-anim").classList.add("on");`);
await sleep(1200);
cap("T1-transform-anim");
await ev(`document.getElementById("iso-anim").classList.remove("on"); document.getElementById("iso-op").classList.add("on");`);
await sleep(1200);
cap("T2-opacity-anim");
await ev(`document.getElementById("iso-op").classList.remove("on");`);
await sleep(1500);
cap("T3-idle-again");
// 뒤 필터 요소가 있을 때
await ev(`const d = document.createElement("div"); d.id = "iso-bf"; document.body.append(d);`);
await sleep(1500);
cap("T4-backdrop-idle");
await ev(`document.getElementById("iso-anim").classList.add("on");`);
await sleep(1200);
cap("T5-backdrop-plus-anim");
await ev(`document.getElementById("iso-anim").classList.remove("on");`);
await sleep(1500);
cap("T6-idle");
// 뒤 필터 요소 자체가 움직일 때: blur / SVG url()
await ev(`const ns = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(ns, "svg"); svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute"; svg.innerHTML = '<filter id="isoDisp" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.02" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G"/></filter>'; document.body.append(svg); const st = document.createElement("style"); st.textContent = "#iso-bf.move { animation: isoMove 1s linear infinite alternate; } @keyframes isoMove { to { transform: translateX(120px); } } #iso-svg { position: fixed; left: 1300px; top: 750px; width: 80px; height: 80px; border-radius: 40px; backdrop-filter: url(#isoDisp); background: rgb(255 255 255 / 0.2); } #iso-svg.move { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st); const d = document.createElement("div"); d.id = "iso-svg"; document.body.append(d);`);
await sleep(1500);
cap("U0-svg-static");
await ev(`document.getElementById("iso-anim").classList.add("on");`);
await sleep(1200);
cap("U1-svg-static-plus-anim");
await ev(`document.getElementById("iso-anim").classList.remove("on"); document.getElementById("iso-bf").classList.add("move");`);
await sleep(1200);
cap("U2-blur-moving");
await ev(`document.getElementById("iso-bf").classList.remove("move");`);
await sleep(1500);
cap("U3-idle");
await ev(`document.getElementById("iso-svg").classList.add("move");`);
await sleep(1200);
cap("U4-svg-moving");
await ev(`document.getElementById("iso-svg").classList.remove("move");`);
await sleep(2500);
cap("U5-idle");
await ev(`document.getElementById("iso-svg").remove();`);
// 텍스트가 뒤에서 움직일 때 (스크롤과 비슷): 고정 blur 요소 밑으로 글자 지나가기
await ev(`const t = document.createElement("div"); t.id = "iso-text"; t.textContent = "가나다라마바사 아자차카타파하 ".repeat(30); t.style.cssText = "position:fixed;left:1250px;top:580px;width:300px;font-size:20px;color:#000;z-index:-1;"; document.querySelector(".app-container").append(t); const st = document.createElement("style"); st.textContent = "#iso-text { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
await sleep(1200);
cap("U6-text-under-blur");
await ev(`document.getElementById("iso-text").remove();`);
await sleep(1500);
cap("U7-idle");

// 우리 굴절과 같은 짜임: feFlood + feImage(지도 그림) + feComposite + feDisplacementMap (+ 색수차)
for (const chroma of [false, true]) {
  const tag = chroma ? "W" : "V";
  await ev(`const c = document.createElement("canvas"); c.width = 80; c.height = 80; const g = c.getContext("2d"); const im = g.createImageData(80, 80); for (let i = 0; i < 80 * 80; i++) { const x = i % 80, y = (i / 80) | 0; im.data[i * 4] = 128 + (x - 40) * 2; im.data[i * 4 + 1] = 128 + (y - 40) * 2; im.data[i * 4 + 2] = 128; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); const url = c.toDataURL();
  const ns = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(ns, "svg"); svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
  const ch = ${chroma} ? '<feDisplacementMap in="SourceGraphic" in2="map" scale="20" xChannelSelector="R" yChannelSelector="G" result="dr"/><feDisplacementMap in="SourceGraphic" in2="map" scale="20.4" xChannelSelector="R" yChannelSelector="G" result="dg"/><feDisplacementMap in="SourceGraphic" in2="map" scale="20.8" xChannelSelector="R" yChannelSelector="G" result="db"/><feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/><feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>' : '<feDisplacementMap in="SourceGraphic" in2="map" scale="20" xChannelSelector="R" yChannelSelector="G"/>';
  svg.innerHTML = '<filter id="isoRf${tag}" x="0" y="0" width="80" height="80" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-color="rgb(128,128,128)" flood-opacity="1" result="neutral"/><feImage href="' + url + '" x="0" y="0" width="80" height="80" preserveAspectRatio="none" result="mapimg"/><feComposite in="mapimg" in2="neutral" operator="over" result="map"/>' + ch + '</filter>'; document.body.append(svg);
  const d = document.createElement("div"); d.id = "iso-rf"; d.style.cssText = "position:fixed;left:1300px;top:750px;width:80px;height:80px;border-radius:40px;background:rgb(255 255 255 / 0.2);backdrop-filter:url(#isoRf${tag});"; document.body.append(d);`);
  await sleep(1500);
  cap(tag + "0-rf-static");
  await ev(`document.getElementById("iso-rf").classList.add("move"); const st = document.createElement("style"); st.textContent = "#iso-rf.move { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
  await sleep(1200);
  cap(tag + "1-rf-moving");
  await ev(`document.getElementById("iso-rf").remove();`);
  await sleep(1500);
  cap(tag + "2-idle");
}

// 투명한 사이드바 위에서: 반투명 뒤를 떠 오는 뒤 필터
for (const [tag, bf] of [["P", "url(#isoRfW)"], ["Q", "blur(6px)"], ["R", "saturate(1.5)"]]) {
  await ev(`const d = document.createElement("div"); d.id = "iso-side"; d.style.cssText = "position:fixed;left:200px;top:250px;width:80px;height:80px;border-radius:40px;background:rgb(255 255 255 / 0.2);backdrop-filter:${bf};z-index:50;"; document.body.append(d); const st = document.createElement("style"); st.id = "iso-side-st"; st.textContent = "#iso-side.on { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
  await sleep(1500);
  cap(tag + "0-side-static");
  await ev(`document.getElementById("iso-side").classList.add("on");`);
  await sleep(1200);
  cap(tag + "1-side-moving");
  await ev(`document.getElementById("iso-side").remove(); document.getElementById("iso-side-st").remove();`);
  await sleep(1500);
  cap(tag + "2-idle");
}

// 반투명 바탕 위 굴절: 사이드바 자리에 70% 바탕 판을 깔고 그 위에서 굴절 요소를 움직이기
for (const [tag, bf] of [["K", "url(#isoRfW)"], ["L", "blur(6px)"]]) {
  await ev(`const pane = document.createElement("div"); pane.id = "iso-pane"; pane.style.cssText = "position:fixed;left:40px;top:120px;width:420px;height:700px;background:rgb(246 246 246 / 0.7);z-index:40;"; document.body.append(pane); const d = document.createElement("div"); d.id = "iso-k"; d.style.cssText = "position:fixed;left:200px;top:200px;width:80px;height:34px;border-radius:17px;background:rgb(246 246 246 / 0.5);backdrop-filter:${bf};z-index:50;"; document.body.append(d); const st = document.createElement("style"); st.id = "iso-k-st"; st.textContent = "#iso-k.on { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
  await sleep(1500);
  cap(tag + "0-static");
  await ev(`document.getElementById("iso-k").classList.add("on");`);
  await sleep(1200);
  cap(tag + "1-moving");
  await ev(`document.getElementById("iso-k").classList.remove("on");`);
  await sleep(1500);
  cap(tag + "2-stopped");
  await ev(`document.getElementById("iso-k").remove(); document.getElementById("iso-pane").remove(); document.getElementById("iso-k-st").remove();`);
  await sleep(1000);
}

// 채움: 굴절 요소에 우리 알약처럼 진한 채움(80% + 광택 + 테두리)
for (const [tag, fill] of [["F", "background:rgb(246 246 246 / 0.8);"], ["G", "background-color:rgb(246 246 246 / 0.8);background-image:linear-gradient(to bottom, rgb(255 255 255 / 0.5), transparent);box-shadow:inset 0 0 0 1px rgb(255 255 255 / 0.6), 0 2px 8px rgb(0 0 0 / 0.12);"]]) {
  for (const [where, left] of [["s", 200], ["e", 1300]]) {
    const t = tag + where;
    await ev(`const d = document.createElement("div"); d.id = "iso-fill"; d.style.cssText = "position:fixed;left:${left}px;top:250px;width:80px;height:80px;border-radius:40px;backdrop-filter:url(#isoRfW);z-index:50;${fill}"; document.body.append(d); const st = document.createElement("style"); st.id = "iso-fill-st"; st.textContent = "#iso-fill.on { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
    await sleep(1500);
    cap(t + "0-static");
    await ev(`document.getElementById("iso-fill").classList.add("on");`);
    await sleep(1200);
    cap(t + "1-moving");
    await ev(`document.getElementById("iso-fill").remove(); document.getElementById("iso-fill-st").remove();`);
    await sleep(1500);
    cap(t + "2-idle");
  }
}
if (process.env.ISO_ONLY_FILL) { save(); ws.close(); process.exit(0); }

// 개수: 뒤 필터 요소를 여러 개 깔고 하나만 움직이기
for (const [tag, n, kind] of [["X", 12, "rf"], ["Y", 40, "rf"], ["Z", 40, "blur"]]) {
  await ev(`const host = document.createElement("div"); host.id = "iso-many"; document.body.append(host); for (let i = 0; i < ${n}; i++) { const d = document.createElement("div"); d.style.cssText = "position:fixed;left:" + (900 + (i % 10) * 90) + "px;top:" + (300 + Math.floor(i / 10) * 90) + "px;width:80px;height:80px;border-radius:40px;background:rgb(255 255 255 / 0.2);backdrop-filter:" + ("${kind}" === "rf" ? "url(#isoRfW)" : "blur(6px)") + ";"; if (i === 0) d.className = "mv"; host.append(d); } const st = document.createElement("style"); st.id = "iso-many-st"; st.textContent = "#iso-many .mv.on { animation: isoMove 1s linear infinite alternate; }"; document.head.append(st);`);
  await sleep(1500);
  cap(tag + "0-many-static");
  await ev(`document.querySelector("#iso-many .mv").classList.add("on");`);
  await sleep(1200);
  cap(tag + "1-many-one-moving");
  await ev(`document.getElementById("iso-many").remove(); document.getElementById("iso-many-st").remove();`);
  await sleep(1500);
  cap(tag + "2-idle");
}

// 사이드바 Obsidian 버튼 호버 (기본 테마)
const pt = await ev(`const b = [...document.querySelectorAll(".mod-left-split .clickable-icon, .side-dock-ribbon-action")].find((x) => x.getBoundingClientRect().width > 0); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
await move(pt.x, pt.y);
await sleep(150);
cap("T7-hover-150ms");
await sleep(800);
cap("T8-hover-950ms");
// 편집창에서 마우스만 움직이기 (그려지는 것 거의 없음)
await move(900, 500);
await sleep(1500);
for (let i = 0; i < 10; i++) { await move(900 + i * 5, 500); await sleep(30); }
cap("T9-mousemove");
save(); ws.close(); process.exit(0);
