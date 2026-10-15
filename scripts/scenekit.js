// 스토어 촬영 장면 모음. Obsidian 창 안(페이지)에서 실행해 window.__sk 에 함수를 둔다.
// 맥(store.mjs, CDP)과 Windows(dbg2 winshots.js, remote.BrowserWindow)가 같은 장면을 쓴다.
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = () => app.plugins.plugins["glass-shelf"];
  const MINE = __PRESET_MINE__;
  const DEFAULT = { tabAnim: "lens", tabListSides: "both", fileIcons: "finder", fileStripes: true, fileGuides: true, miniBar: true, showPath: true, compactWindowControls: true, sideAcrylic: false };
  const FILES = ["Notes/Essays/On Glass Interfaces.md", "Notes/Design Principles.md", "Journal/2026-10-08.md"];
  const FOLDERS = ["Areas", "Areas/Finance", "Areas/Health", "Journal", "Notes", "Notes/Essays", "Projects", "Projects/Podcast", "Resources", "Resources/Recipes", "Travel"];
  const sk = {
    async setup() {
      for (const b of document.querySelectorAll(".modal-container button")) if (/Trust author/i.test(b.textContent)) b.click();
      await sleep(500);
      try { if (app.plugins.setEnable) await app.plugins.setEnable(true); if (!P()) await app.plugins.enablePluginAndSave("glass-shelf"); } catch (e) { return { err: String(e) }; }
      await sleep(1500);
      app.setting.close(); document.querySelectorAll(".modal-close-button").forEach((b) => b.click());
      app.workspace.leftSplit.expand(); app.workspace.rightSplit.expand();
      // 편집창 탭 3개: 첫 묶음에 지정 파일만 남긴다
      const root = app.workspace.rootSplit;
      const leaves = []; app.workspace.iterateRootLeaves((l) => leaves.push(l));
      const tabs = leaves[0] ? leaves[0].parent : null;
      const opened = [];
      for (const path of FILES) {
        const f = app.vault.getAbstractFileByPath(path);
        if (!f) continue;
        const l = app.workspace.getLeaf("tab");
        await l.openFile(f, { active: false });
        opened.push(l);
      }
      // 지정 파일 말고는 닫는다 (다시 모아서: 고정된 탭은 풀고 닫는다)
      const rest = []; app.workspace.iterateRootLeaves((l) => { if (!opened.includes(l)) rest.push(l); });
      for (const l of rest) { try { if (l.getViewState().pinned) l.setPinned(false); l.detach(); } catch {} }
      await sleep(300);
      if (opened[0]) app.workspace.setActiveLeaf(opened[0], { focus: false });
      // 탐색기: 폴더를 열어 스크롤되게
      const fe = app.workspace.getLeavesOfType("file-explorer")[0];
      if (fe) { app.workspace.revealLeaf(fe); const v = fe.view; for (const p of FOLDERS) { const it = v.fileItems[p]; if (it && it.setCollapsed) await it.setCollapsed(false); } }
      // 미뤄 둔 탭을 모두 불러온다 (저장된 옛 언어의 탭 이름이 남지 않게)
      const all = []; app.workspace.iterateAllLeaves((l) => all.push(l));
      for (const l of all) { try { if (l.loadIfDeferred) await l.loadIfDeferred(); } catch {} }
      // 패널 탭을 한 번씩 열어 이름을 지금 언어로 바꾼다
      for (const l of all) { if (l.getRoot && l.getRoot() !== app.workspace.rootSplit) { try { app.workspace.revealLeaf(l); if (l.tabHeaderEl) l.tabHeaderEl.click(); if (l.updateHeader) l.updateHeader(); await sleep(300); } catch {} } }
      // 오른쪽 패널: 태그 탭은 닫는다 (탭 4개 이하)
      for (const l of app.workspace.getLeavesOfType("tag")) try { l.detach(); } catch {}
      // 오른쪽 패널은 개요
      const ol = app.workspace.getLeavesOfType("outline")[0]; if (ol) app.workspace.revealLeaf(ol);
      await sleep(800);
      // 편집창 본문 맨 위, 탐색기 맨 위
      const fc = document.querySelector(".nav-files-container"); if (fc) fc.scrollTop = 0;
      return { tabs: opened.length, root: !!root, heads: [...document.querySelectorAll(".mod-sidedock .workspace-tab-header-inner-title")].map((e) => e.textContent) };
    },
    async config({ dark, mine, acrylic }) {
      const p = P();
      Object.assign(p.settings, mine ? MINE : DEFAULT);
      if (acrylic != null) p.settings.sideAcrylic = !!acrylic;
      await p.saveSettings();
      if (p.applySettings) p.applySettings();
      const t = dark ? "obsidian" : "moonstone";
      if (app.changeTheme) app.changeTheme(t); else { app.vault.setConfig("theme", t); app.updateTheme && app.updateTheme(); }
      await sleep(2500);
      if (p.vibNudge) p.vibNudge();
      await sleep(600);
      return { theme: app.vault.getConfig("theme"), tabAnim: p.settings.tabAnim, acrylic: document.body.classList.contains("lg-acrylic") };
    },
    async layout(kind) {
      // 이전 장면 되돌리기
      if (sk._extra) { for (const l of sk._extra) try { l.detach(); } catch {} sk._extra = null; }
      sk._split = false;
      if (sk._stacked) { try { sk._stacked.setStacked(false); } catch {} sk._stacked = null; }
      await sleep(300);
      const leaves = []; app.workspace.iterateRootLeaves((l) => leaves.push(l));
      const first = leaves[0];
      if (!first) return "no-leaf";
      app.workspace.setActiveLeaf(first, { focus: false });
      if (kind === "split") {
        const l = app.workspace.getLeaf("split", "vertical");
        const f = app.vault.getAbstractFileByPath(FILES[1]) || app.vault.getAbstractFileByPath(FILES[0]);
        await l.openFile(f, { active: false });
        sk._extra = [l]; sk._split = true;
      } else if (kind === "stacked") {
        first.parent.setStacked(true);
        sk._stacked = first.parent;
      } else if (kind === "web") {
        const l = app.workspace.getLeaf("tab");
        await l.setViewState({ type: "webviewer", state: { url: "https://obsidian.md/" }, active: true });
        sk._extra = [l];
        await sleep(5000);
      }
      await sleep(900);
      app.workspace.setActiveLeaf(kind === "web" && sk._extra ? sk._extra[0] : first, { focus: false });
      await sleep(400);
      return kind;
    },
    // 패널-편집창-패널을 거의 1:1:1 로, 편집창을 조금 넓게
    // 분할 화면은 편집창을 더 넓게 (사용자 요청)
    async sizes(r) {
      const w = window.innerWidth, side = Math.round(w * (r || (sk._extra && sk._split ? 0.22 : 0.3)));
      for (const sp of [app.workspace.leftSplit, app.workspace.rightSplit]) { if (sp.setSize) sp.setSize(side); else sp.containerEl.style.width = side + "px"; }
      app.workspace.onLayoutChange && app.workspace.onLayoutChange();
      await sleep(600);
      return { w, side };
    },
    // 배율 110% (Obsidian 설정의 확대 단계 0.5 와 같다)
    zoom() { const wf = require("electron").webFrame; wf.setZoomLevel(0.5); return wf.getZoomFactor(); },
    win() { return require("electron").remote.getCurrentWindow(); },
    async full(on, disp) { const w = sk.win(); if (on && disp && !w.isFullScreen()) { if (w.isMaximized()) w.unmaximize(); w.setBounds({ x: disp.x + 100, y: disp.y + 100, width: 1200, height: 800 }); await sleep(600); } if (w.isFullScreen() !== !!on) { w.setFullScreen(!!on); await sleep(1800); } return w.isFullScreen(); },
    async bounds(b) { const w = sk.win(); if (w.isFullScreen()) { w.setFullScreen(false); await sleep(1500); } if (w.isMaximized()) w.unmaximize(); w.setBounds(b); await sleep(900); return w.getBounds(); },
    area(pick) { const sc = require("electron").remote.screen; const d = (pick && sc.getAllDisplays().find((x) => x.bounds.width !== 1920)) || sc.getPrimaryDisplay(); return { id: String(d.id), bounds: d.bounds, work: d.workArea, size: d.size, scale: d.scaleFactor }; },
  };
  window.__sk = sk;
  return "kit";
})();
