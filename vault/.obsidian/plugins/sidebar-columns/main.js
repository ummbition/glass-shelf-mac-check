/* Sidebar Columns 0.1.2 - experimental. Source distributed under 0BSD. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SidebarColumns
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/adapter.ts
var import_obsidian = require("obsidian");

// src/patch.ts
function wrapMethod(object, key, intercept) {
  var _a, _b, _c;
  const own = Object.getOwnPropertyDescriptor(object, key);
  const original = Reflect.get(object, key);
  if (typeof original !== "function" || own && !own.configurable && !own.writable) {
    throw new Error(`The required native method ${String(key)} cannot be wrapped safely.`);
  }
  if (own && !("value" in own)) {
    throw new Error(`The required native method ${String(key)} is an accessor.`);
  }
  let enabled = true;
  const wrapped = function(...args) {
    return enabled ? intercept(original, this, args) : Reflect.apply(original, this, args);
  };
  Object.defineProperty(object, key, {
    configurable: (_a = own == null ? void 0 : own.configurable) != null ? _a : true,
    enumerable: (_b = own == null ? void 0 : own.enumerable) != null ? _b : false,
    writable: (_c = own == null ? void 0 : own.writable) != null ? _c : true,
    value: wrapped
  });
  return () => {
    enabled = false;
    if (Reflect.get(object, key) !== wrapped) return;
    if (own) Object.defineProperty(object, key, own);
    else Reflect.deleteProperty(object, key);
  };
}

// src/adapter.ts
var TARGET_MESSAGE = "Select a tab in the main window\u2019s left or right sidebar, then run this command.";
var MAX_ITEMS = 2e3;
function isLeaf(value) {
  return value instanceof import_obsidian.WorkspaceLeaf;
}
function isTabs(value) {
  return value instanceof import_obsidian.WorkspaceTabs;
}
function isSplit(value) {
  return value instanceof import_obsidian.WorkspaceSplit;
}
function isSidebar(value) {
  return value instanceof import_obsidian.WorkspaceSidedock;
}
function nativeItem(value) {
  return value;
}
function sameItems(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
function isInside(item, ancestor) {
  const visited = /* @__PURE__ */ new Set();
  let current = item;
  while (current && !visited.has(current)) {
    if (current === ancestor) return true;
    visited.add(current);
    current = current.parent;
  }
  return false;
}
function message(error) {
  return error instanceof Error ? error.message : "The native sidebar operation failed.";
}
var SidebarAdapter = class {
  constructor(app, notice) {
    this.app = app;
    this.notice = notice;
    __publicField(this, "workspace");
    __publicField(this, "folds", /* @__PURE__ */ new Map());
    __publicField(this, "disposers", []);
    __publicField(this, "columnControls", /* @__PURE__ */ new Map());
    __publicField(this, "actions", null);
    __publicField(this, "gestureEnds", /* @__PURE__ */ new Set());
    __publicField(this, "activeGestures", 0);
    __publicField(this, "externalGestureEnd", null);
    __publicField(this, "operationRunning", false);
    __publicField(this, "installed", false);
    __publicField(this, "nativeDetected", false);
    this.workspace = app.workspace;
  }
  assertCompatible() {
    var _a;
    const ws = this.workspace;
    if (!((_a = ws.containerEl) == null ? void 0 : _a.ownerDocument) || typeof ws.createLeafBySplit !== "function" || typeof ws.setActiveLeaf !== "function" || typeof ws.iterateAllLeaves !== "function" || typeof ws.onDragLeaf !== "function" || typeof ws.changeLayout !== "function" || typeof ws.requestResize !== "function") {
      throw new Error("This Obsidian workspace does not expose the required sidebar operations. The layout was not changed.");
    }
    const prototype = import_obsidian.WorkspaceLeaf.prototype;
    if (typeof prototype.onOpenTabHeaderMenu !== "function") {
      throw new Error("This Obsidian version has an incompatible tab menu hook. The layout was not changed.");
    }
    if (!isSplit(ws.rootSplit) || ws.rootSplit.type !== "split" || ws.rootSplit.direction !== "vertical" || !Array.isArray(ws.rootSplit.children)) {
      throw new Error("The main workspace structure is incompatible. The layout was not changed.");
    }
    const ids = /* @__PURE__ */ new Set();
    this.validateSidebar(ws.leftSplit, ids);
    this.validateSidebar(ws.rightSplit, ids);
    if (ws.leftSplit === ws.rightSplit || ws.leftSplit === ws.rootSplit || ws.rightSplit === ws.rootSplit) {
      throw new Error("The sidebar roots are not distinct. The layout was not changed.");
    }
  }
  validateSidebar(root, ids = /* @__PURE__ */ new Set()) {
    const doc = this.workspace.containerEl.ownerDocument;
    if (!isSidebar(root) || root.type !== "split" || root.direction !== "horizontal" || root.parent !== null || typeof root.collapsed !== "boolean" || !Number.isFinite(root.size) || root.size <= 0) {
      throw new Error("The native desktop sidebar root is incompatible. The layout was not changed.");
    }
    const seen = /* @__PURE__ */ new Set();
    const walk = (item, parent) => {
      var _a, _b, _c;
      if (!item || seen.has(item) || seen.size >= MAX_ITEMS || item.parent !== parent || typeof item.id !== "string" || !item.id || ids.has(item.id) || ((_a = item.containerEl) == null ? void 0 : _a.ownerDocument) !== doc || ((_b = item.resizeHandleEl) == null ? void 0 : _b.ownerDocument) !== doc || typeof item.setDimension !== "function" || !(item.dimension === null || Number.isFinite(item.dimension) && item.dimension > 0 && item.dimension < 100)) {
        throw new Error("The sidebar contains an invalid, detached or cyclic native branch. The layout was not changed.");
      }
      seen.add(item);
      ids.add(item.id);
      if (isLeaf(item)) {
        const leaf = item;
        if (!isTabs(parent) || leaf.type !== "leaf" || ((_c = leaf.tabHeaderEl) == null ? void 0 : _c.ownerDocument) !== doc || !leaf.view || typeof leaf.view.getViewType !== "function" || typeof leaf.view.onTabMenu !== "function" || typeof leaf.detach !== "function") {
          throw new Error("A sidebar tab is incompatible. The layout was not changed.");
        }
        return;
      }
      if (!isTabs(item) && !isSplit(item)) {
        throw new Error("An unsupported sidebar item was found. The layout was not changed.");
      }
      const group = item;
      if (!Array.isArray(group.children) || typeof group.insertChild !== "function" || typeof group.removeChild !== "function" || typeof group.replaceChild !== "function" || item !== root && group.children.length === 0) {
        throw new Error("A native sidebar parent cannot preserve its children safely. The layout was not changed.");
      }
      if (isTabs(item)) {
        const tabs = item;
        if (tabs.type !== "tabs" || !Number.isInteger(tabs.currentTab) || tabs.currentTab < 0 || tabs.currentTab >= tabs.children.length) {
          throw new Error("A sidebar tab group has an invalid selected tab. The layout was not changed.");
        }
      } else if (item.type !== "split" || !["horizontal", "vertical"].includes(item.direction)) {
        throw new Error("A sidebar split has an unsupported orientation. The layout was not changed.");
      }
      for (const child of group.children) walk(child, group);
    };
    walk(root, null);
  }
  resolveTarget(leaf) {
    var _a;
    if (!isLeaf(leaf)) throw new Error(TARGET_MESSAGE);
    const item = nativeItem(leaf);
    const ws = this.workspace;
    let root = item;
    const seen = /* @__PURE__ */ new Set();
    while (root.parent) {
      if (seen.has(root) || seen.size >= MAX_ITEMS) throw new Error(TARGET_MESSAGE);
      seen.add(root);
      if (!Array.isArray(root.parent.children) || !root.parent.children.includes(root)) throw new Error(TARGET_MESSAGE);
      root = root.parent;
    }
    const side = root === ws.leftSplit ? "left" : root === ws.rightSplit ? "right" : null;
    if (!side || ((_a = item.containerEl) == null ? void 0 : _a.ownerDocument) !== ws.containerEl.ownerDocument) throw new Error(TARGET_MESSAGE);
    this.validateSidebar(root);
    const group = item.parent;
    const parent = group == null ? void 0 : group.parent;
    if (!isTabs(group) || !isSplit(parent)) throw new Error(TARGET_MESSAGE);
    return { leaf, side, root, group, parent };
  }
  resolveCommandTarget() {
    const ws = this.workspace;
    const doc = ws.containerEl.ownerDocument;
    const currentDocument = typeof activeDocument === "undefined" ? doc : activeDocument;
    if (currentDocument !== doc || !ws.activeLeaf) throw new Error(TARGET_MESSAGE);
    const current = this.resolveTarget(ws.activeLeaf);
    if (current.root.collapsed || current.group.containerEl.getBoundingClientRect().width <= 0 || this.foldContaining(nativeItem(current.leaf))) throw new Error(TARGET_MESSAGE);
    const activeElement = doc.activeElement;
    if (activeElement && [...this.folds.values()].some((fold) => fold.rail.contains(activeElement))) {
      throw new Error(TARGET_MESSAGE);
    }
    const focused = [];
    if (activeElement && activeElement !== doc.body) {
      ws.iterateAllLeaves((leaf) => {
        var _a, _b;
        const item = nativeItem(leaf);
        if (((_a = item.containerEl) == null ? void 0 : _a.contains(activeElement)) || ((_b = item.tabHeaderEl) == null ? void 0 : _b.contains(activeElement))) focused.push(leaf);
      });
    }
    if (focused.length > 1) throw new Error(TARGET_MESSAGE);
    if (focused.length === 1) {
      if (focused[0] !== ws.activeLeaf) throw new Error(TARGET_MESSAGE);
      return this.resolveTarget(focused[0]);
    }
    if (activeElement && activeElement !== doc.body) throw new Error(TARGET_MESSAGE);
    if (!ws.activeLeaf) throw new Error(TARGET_MESSAGE);
    const target = this.resolveTarget(ws.activeLeaf);
    if (this.foldContaining(nativeItem(target.leaf))) throw new Error(TARGET_MESSAGE);
    return target;
  }
  isCurrent(target) {
    try {
      const current = this.resolveTarget(target.leaf);
      return current.root === target.root && current.side === target.side && current.group === target.group && current.parent === target.parent;
    } catch (e) {
      return false;
    }
  }
  nativeSplitAvailable(target) {
    var _a;
    if (this.nativeDetected) return true;
    if (!this.isCurrent(target) || this.workspace.activeLeaf !== target.leaf) return false;
    const commands = this.app.commands;
    try {
      const command = (_a = commands == null ? void 0 : commands.findCommand) == null ? void 0 : _a.call(commands, "workspace:split-vertical");
      if (typeof (command == null ? void 0 : command.checkCallback) === "function" && command.checkCallback(true) === true) {
        this.nativeDetected = true;
        return true;
      }
    } catch (e) {
    }
    return false;
  }
  install(actions) {
    if (this.installed) throw new Error("The sidebar adapter is already installed.");
    this.assertCompatible();
    this.installed = true;
    this.actions = actions;
    try {
      this.disposers.push(wrapMethod(import_obsidian.WorkspaceLeaf.prototype, "onOpenTabHeaderMenu", (original, receiver, args) => {
        let target;
        try {
          target = this.resolveTarget(receiver);
        } catch (e) {
          return Reflect.apply(original, receiver, args);
        }
        const view = nativeItem(target.leaf).view;
        const seenMenus = /* @__PURE__ */ new Set();
        let release;
        try {
          release = wrapMethod(view, "onTabMenu", (originalMenu, menuReceiver, menuArgs) => {
            const result2 = Reflect.apply(originalMenu, menuReceiver, menuArgs);
            const menu = menuArgs[0];
            if (menu && typeof menu.addItem === "function" && !seenMenus.has(menu)) {
              seenMenus.add(menu);
              menu.addItem((item) => item.setTitle("Add full-height column (experimental)").setIcon("columns-2").onClick(() => actions.addColumn(target)));
              if (this.rowFactoryAvailable(target.side)) {
                menu.addItem((item) => item.setTitle("Add full-width bottom row (experimental)").setIcon("rows-2").onClick(() => actions.addRow(target)));
              }
              if (!this.nativeSplitAvailable(target)) {
                menu.addItem((item) => item.setTitle("Split this row right (experimental)").setIcon("separator-vertical").onClick(() => actions.split(target)));
              }
              if (this.canCollapse(target)) {
                menu.addItem((item) => item.setTitle("Collapse this column (experimental)").setIcon("panel-left-close").onClick(() => actions.collapse(target)));
              }
            }
            return result2;
          });
        } catch (e) {
          this.notice("The native tab menu could not be extended safely. Use the command palette after selecting a sidebar tab.");
        }
        try {
          return Reflect.apply(original, receiver, args);
        } finally {
          release == null ? void 0 : release();
        }
      }));
      this.disposers.push(wrapMethod(this.workspace, "onDragLeaf", (original, receiver, args) => {
        var _a, _b;
        const event = args[0];
        const doc = (_b = (_a = event == null ? void 0 : event.target) == null ? void 0 : _a.ownerDocument) != null ? _b : this.workspace.containerEl.ownerDocument;
        const end = this.startGesture(doc, "drag");
        try {
          return Reflect.apply(original, receiver, args);
        } catch (error) {
          end();
          throw error;
        }
      }));
      this.disposers.push(wrapMethod(this.workspace, "changeLayout", (original, receiver, args) => {
        this.expandAll();
        return Reflect.apply(original, receiver, args);
      }));
      const container = this.workspace.containerEl;
      this.listen(container, "pointerdown", (event) => {
        const pointer = event;
        if (pointer.button !== 0) return;
        if (this.isResizeHandle(event.target)) {
          this.expandAll();
          this.startGesture(container.ownerDocument, "resize");
        }
      }, true);
      this.listen(container, "dblclick", (event) => {
        if (this.isResizeHandle(event.target)) this.expandAll();
      }, true);
      const externalDrag = (event) => {
        var _a;
        if (this.folds.size === 0) return;
        this.expandAll();
        (_a = this.externalGestureEnd) == null ? void 0 : _a.call(this);
        if (event.type !== "drop") this.externalGestureEnd = this.startGesture(container.ownerDocument, "drag");
      };
      this.listen(container.ownerDocument, "dragenter", externalDrag, true);
      this.listen(container.ownerDocument, "dragover", externalDrag, true);
      this.listen(container.ownerDocument, "drop", externalDrag, true);
      this.listen(container.ownerDocument, "dragleave", (event) => {
        const drag = event;
        if (!this.externalGestureEnd) return;
        const related = drag.relatedTarget;
        const roots = [this.workspace.leftSplit.containerEl, this.workspace.rightSplit.containerEl];
        if (related && roots.some((root) => root.contains(related))) return;
        if (!related && drag.target !== container.ownerDocument.body && drag.target !== container.ownerDocument.documentElement && roots.some((root) => {
          const rect = root.getBoundingClientRect();
          return drag.clientX >= rect.left && drag.clientX < rect.right && drag.clientY >= rect.top && drag.clientY < rect.bottom;
        })) return;
        this.externalGestureEnd();
      }, true);
      const cssChange = this.app.workspace.on("css-change", () => {
        if (this.installed) this.refreshColumnControls();
      });
      this.disposers.push(() => this.app.workspace.offref(cssChange));
      this.refreshColumnControls();
    } catch (error) {
      this.dispose();
      throw error;
    }
    return () => this.dispose();
  }
  listen(target, type, callback, capture = false) {
    target.addEventListener(type, callback, capture);
    this.disposers.push(() => target.removeEventListener(type, callback, capture));
  }
  startGesture(doc, kind) {
    var _a;
    this.activeGestures++;
    let active = true;
    const events = kind === "resize" ? ["pointerup", "pointercancel"] : ["drop", "dragend"];
    const end = () => {
      var _a2;
      if (!active) return;
      active = false;
      this.activeGestures--;
      for (const name of events) doc.removeEventListener(name, end, true);
      (_a2 = doc.defaultView) == null ? void 0 : _a2.removeEventListener("blur", end);
      this.gestureEnds.delete(end);
      if (this.externalGestureEnd === end) this.externalGestureEnd = null;
      this.refreshColumnControls();
    };
    this.gestureEnds.add(end);
    for (const name of events) doc.addEventListener(name, end, true);
    (_a = doc.defaultView) == null ? void 0 : _a.addEventListener("blur", end);
    return end;
  }
  isBusyGesture() {
    return this.activeGestures > 0;
  }
  getCollapsedCount() {
    return this.folds.size;
  }
  isResizeHandle(target) {
    const win = this.workspace.containerEl.ownerDocument.defaultView;
    if (!win || !(target instanceof win.Node)) return false;
    const seen = /* @__PURE__ */ new Set();
    const walk = (item) => {
      var _a;
      if (!item || seen.has(item) || seen.size >= MAX_ITEMS) return false;
      seen.add(item);
      if (item.resizeHandleEl === target || ((_a = item.resizeHandleEl) == null ? void 0 : _a.contains(target))) return true;
      return Array.isArray(item.children) && item.children.some(walk);
    };
    return walk(this.workspace.leftSplit) || walk(this.workspace.rightSplit);
  }
  dispose() {
    this.installed = false;
    this.actions = null;
    this.clearColumnControls();
    this.expandAll();
    for (const end of [...this.gestureEnds]) end();
    for (const dispose of this.disposers.splice(0).reverse()) dispose();
    this.installed = false;
  }
  fullHeightContent(root) {
    let parent = root;
    const seen = /* @__PURE__ */ new Set();
    while (parent.children.length === 1 && !seen.has(parent)) {
      seen.add(parent);
      const child = parent.children[0];
      if (!isSplit(child) || isSidebar(child)) return null;
      const split = child;
      if (split.direction === "vertical") return split;
      parent = split;
    }
    return null;
  }
  branchIn(item, parent) {
    const seen = /* @__PURE__ */ new Set();
    while (item.parent && !seen.has(item)) {
      seen.add(item);
      if (item.parent === parent) return item;
      item = item.parent;
    }
    return null;
  }
  column(target) {
    if (!this.isCurrent(target)) return null;
    let branch = target.group;
    let outermost = null;
    const seen = /* @__PURE__ */ new Set();
    while (branch.parent && branch.parent !== target.root && !seen.has(branch)) {
      seen.add(branch);
      const parent = branch.parent;
      if (isSplit(parent) && parent.direction === "vertical") {
        outermost = { branch, parent };
      }
      branch = parent;
    }
    return outermost;
  }
  foldWindow(doc) {
    const win = doc.win;
    return win && typeof win.createDiv === "function" && typeof win.createEl === "function" ? win : null;
  }
  canCollapse(target) {
    if (!this.foldWindow(target.root.containerEl.ownerDocument)) return false;
    if (this.operationRunning || this.isBusyGesture() || target.root.collapsed) return false;
    const column = this.column(target);
    if (!column || this.folds.has(column.branch) || this.foldContaining(column.parent)) return false;
    return column.parent.children.length >= 2 && column.parent.children.some((sibling) => sibling !== column.branch && !this.folds.has(sibling));
  }
  collapse(target) {
    this.assertCompatible();
    const nativeWindow = this.foldWindow(target.root.containerEl.ownerDocument);
    if (!nativeWindow) throw new Error("The native window cannot create sidebar controls safely. Column collapse is unavailable; splitting remains available.");
    if (!this.canCollapse(target)) throw new Error("This tab has no collapsible sidebar column, or it is the last open column.");
    const { branch, parent } = this.column(target);
    for (const fold2 of [...this.folds.values()]) {
      if (isInside(fold2.branch, branch)) this.expandFold(fold2, false);
    }
    const doc = branch.containerEl.ownerDocument;
    const rail = nativeWindow.createDiv();
    rail.className = "sidebar-columns-rail";
    const restore = nativeWindow.createEl("button");
    if (rail.ownerDocument !== doc || restore.ownerDocument !== doc) {
      throw new Error("The sidebar controls belong to a different window. Column collapse is unavailable; splitting remains available.");
    }
    restore.type = "button";
    restore.className = "clickable-icon sidebar-columns-restore";
    restore.setAttribute("aria-label", "Expand sidebar column");
    restore.title = "Expand column";
    restore.setAttribute("aria-expanded", "false");
    (0, import_obsidian.setIcon)(restore, "panel-left-open");
    rail.appendChild(restore);
    const fold = {
      branch,
      parent,
      siblings: parent.children.slice(),
      root: target.root,
      rail,
      restore,
      target,
      inert: /* @__PURE__ */ new Map(),
      styles: /* @__PURE__ */ new Map()
    };
    fold.dimensionDispose = wrapMethod(branch, "setDimension", (original, receiver, args) => {
      try {
        return Reflect.apply(original, receiver, args);
      } finally {
        if (this.folds.get(branch) === fold) this.refreshFoldStyles(fold, branch.containerEl);
      }
    });
    const children = branch.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        fold.inert.set(child.containerEl, child.containerEl.inert);
        child.containerEl.inert = true;
      }
    }
    restore.addEventListener("click", () => this.expandFold(fold, true));
    this.folds.set(branch, fold);
    this.setFoldStyles(fold, branch.containerEl, {
      "flex-grow": "0",
      "flex-shrink": "0",
      "flex-basis": "32px",
      "width": "32px",
      "min-width": "32px",
      "max-width": "32px"
    });
    const win = doc.defaultView;
    for (const child of Array.from(branch.containerEl.children)) {
      if (win && child.instanceOf(win.HTMLElement)) this.setFoldStyles(fold, child, { display: "none" });
    }
    branch.containerEl.appendChild(rail);
    branch.containerEl.classList.add("sidebar-columns-collapsed");
    const active = this.workspace.activeLeaf;
    if (active && isInside(nativeItem(active), branch)) {
      const alternate = parent.children.filter((child) => child !== branch && !this.folds.has(child)).map((child) => this.firstLeaf(child)).find((leaf) => leaf !== null);
      if (alternate) this.workspace.setActiveLeaf(alternate, { focus: false });
    }
    restore.focus({ preventScroll: true });
    this.workspace.requestResize();
    this.refreshColumnControls();
  }
  setFoldStyles(fold, element, values) {
    var _a;
    const entries = (_a = fold.styles.get(element)) != null ? _a : /* @__PURE__ */ new Map();
    fold.styles.set(element, entries);
    for (const [property, value] of Object.entries(values)) {
      const entry = {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
        appliedValue: "",
        appliedPriority: ""
      };
      element.style.setProperty(property, value);
      entry.appliedValue = element.style.getPropertyValue(property);
      entry.appliedPriority = element.style.getPropertyPriority(property);
      entries.set(property, entry);
    }
  }
  refreshFoldStyles(fold, element) {
    var _a;
    for (const [property, entry] of (_a = fold.styles.get(element)) != null ? _a : []) {
      const value = element.style.getPropertyValue(property), priority = element.style.getPropertyPriority(property);
      if (value === entry.appliedValue && priority === entry.appliedPriority) continue;
      entry.value = value;
      entry.priority = priority;
      element.style.setProperty(property, entry.appliedValue, entry.appliedPriority);
    }
  }
  restoreFoldStyles(fold) {
    for (const [element, entries] of fold.styles) {
      for (const [property, entry] of entries) {
        if (element.style.getPropertyValue(property) !== entry.appliedValue || element.style.getPropertyPriority(property) !== entry.appliedPriority) continue;
        if (entry.value) element.style.setProperty(property, entry.value, entry.priority);
        else element.style.removeProperty(property);
      }
    }
  }
  firstLeaf(item) {
    if (isLeaf(item)) return item;
    const children = item.children;
    if (!Array.isArray(children)) return null;
    if (isTabs(item)) {
      const current = children[item.currentTab];
      if (isLeaf(current)) return current;
    }
    for (const child of children) {
      if (this.folds.has(child)) continue;
      const leaf = this.firstLeaf(child);
      if (leaf) return leaf;
    }
    return null;
  }
  foldContaining(item) {
    for (const fold of this.folds.values()) if (isInside(item, fold.branch)) return fold;
    return null;
  }
  expandFold(fold, focus) {
    var _a;
    if (this.folds.get(fold.branch) !== fold) return;
    this.folds.delete(fold.branch);
    fold.branch.containerEl.classList.remove("sidebar-columns-collapsed");
    fold.rail.remove();
    (_a = fold.dimensionDispose) == null ? void 0 : _a.call(fold);
    this.restoreFoldStyles(fold);
    for (const [element, original] of fold.inert) element.inert = original;
    this.workspace.requestResize();
    if (focus) {
      try {
        const target = this.resolveTarget(fold.target.leaf);
        if (target.root === fold.root) this.workspace.setActiveLeaf(target.leaf, { focus: true });
      } catch (e) {
        this.notice(TARGET_MESSAGE);
      }
    }
    this.refreshColumnControls();
  }
  expandAll() {
    for (const fold of [...this.folds.values()]) this.expandFold(fold, false);
  }
  onLayoutChange() {
    for (const fold of [...this.folds.values()]) {
      const stillAttached = isInside(fold.branch, fold.root) && (fold.root === this.workspace.leftSplit || fold.root === this.workspace.rightSplit);
      if (!stillAttached || fold.branch.parent !== fold.parent || !sameItems(fold.parent.children, fold.siblings) || this.workspace.activeLeaf && isInside(nativeItem(this.workspace.activeLeaf), fold.branch)) {
        this.expandFold(fold, false);
      }
    }
    this.refreshColumnControls();
  }
  clearColumnControls() {
    for (const control of this.columnControls.values()) control.dispose();
    this.columnControls.clear();
  }
  controlTarget(control) {
    try {
      if (!this.installed || !this.actions || control.button.parentElement !== control.header || control.group.tabHeaderContainerEl !== control.header || !control.group.containerEl.contains(control.header)) return null;
      const active = this.workspace.activeLeaf;
      const leaf = active && isInside(nativeItem(active), control.branch) ? active : control.group.children[control.group.currentTab];
      const target = this.resolveTarget(leaf);
      const column = this.column(target);
      return (column == null ? void 0 : column.branch) === control.branch && column.parent === control.parent ? target : null;
    } catch (e) {
      return null;
    }
  }
  refreshColumnControls() {
    const actions = this.actions;
    if (!this.installed || !actions) {
      this.clearColumnControls();
      return;
    }
    const candidates = /* @__PURE__ */ new Map();
    try {
      const ids = /* @__PURE__ */ new Set();
      for (const root of [this.workspace.leftSplit, this.workspace.rightSplit]) {
        this.validateSidebar(root, ids);
        if (root.collapsed) continue;
        const walk = (item, column) => {
          if (this.foldContaining(item)) return;
          if (isTabs(item)) {
            if (!column || column.parent.children.length < 2 || candidates.has(column.branch)) return;
            const group = item, header = group.tabHeaderContainerEl;
            const doc = root.containerEl.ownerDocument, win = this.foldWindow(doc);
            if (!win || !header || header.ownerDocument !== doc || header.parentElement !== group.containerEl || header.tagName !== "DIV" || !header.classList.contains("workspace-tab-header-container") || header.getBoundingClientRect().width <= 0 || header.getBoundingClientRect().height <= 0) return;
            const style = win.getComputedStyle(header);
            if (style.flexDirection !== "row" && style.flexDirection !== "row-reverse" || style.direction !== "ltr" && style.direction !== "rtl") return;
            const prepend = style.direction === "rtl" === (style.flexDirection === "row-reverse");
            candidates.set(column.branch, { parent: column.parent, group, header, prepend });
            return;
          }
          if (!isSplit(item)) return;
          const split = item;
          for (const child of split.children) {
            walk(child, !column && split !== root && split.direction === "vertical" ? { branch: child, parent: split } : column);
          }
        };
        walk(root, null);
      }
    } catch (e) {
      this.clearColumnControls();
      return;
    }
    for (const [branch, control] of this.columnControls) {
      const candidate = candidates.get(branch);
      if (!candidate || candidate.parent !== control.parent || candidate.group !== control.group || candidate.header !== control.header || control.button.parentElement !== control.header) {
        control.dispose();
        this.columnControls.delete(branch);
      }
    }
    for (const [branch, candidate] of candidates) {
      let control = this.columnControls.get(branch);
      if (!control) {
        const doc = candidate.header.ownerDocument, win = this.foldWindow(doc);
        if (!win) continue;
        const button = win.createEl("button");
        if (button.ownerDocument !== doc) continue;
        button.type = "button";
        button.className = "clickable-icon sidebar-columns-collapse";
        button.draggable = false;
        button.setAttribute("data-sidebar-columns-branch-id", branch.id);
        button.setAttribute("aria-expanded", "true");
        (0, import_obsidian.setIcon)(button, "panel-left-close");
        let own;
        const stopPointer = (event) => {
          event.stopPropagation();
        };
        const stopDrag = (event) => {
          event.preventDefault();
          event.stopPropagation();
        };
        const click = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!this.installed || this.actions !== actions || this.columnControls.get(branch) !== own || button.disabled) return;
          const target2 = this.controlTarget(own);
          if (!target2 || !this.canCollapse(target2)) {
            this.refreshColumnControls();
            return;
          }
          actions.collapse(target2);
        };
        own = {
          branch,
          parent: candidate.parent,
          group: candidate.group,
          header: candidate.header,
          button,
          dispose: () => {
            button.removeEventListener("pointerdown", stopPointer);
            button.removeEventListener("mousedown", stopPointer);
            button.removeEventListener("dragstart", stopDrag);
            button.removeEventListener("click", click);
            button.remove();
          }
        };
        button.addEventListener("pointerdown", stopPointer);
        button.addEventListener("mousedown", stopPointer);
        button.addEventListener("dragstart", stopDrag);
        button.addEventListener("click", click);
        this.columnControls.set(branch, own);
        control = own;
      }
      control.button.classList.toggle("sidebar-columns-collapse-at-end", !candidate.prepend);
      if (candidate.prepend) {
        if (candidate.header.firstElementChild !== control.button) candidate.header.prepend(control.button);
      } else {
        if (candidate.header.lastElementChild !== control.button) candidate.header.appendChild(control.button);
      }
      const target = this.controlTarget(control);
      const canCollapse = Boolean(target && this.canCollapse(target));
      const lastExpanded = !control.parent.children.some((sibling) => sibling !== branch && !this.folds.has(sibling));
      control.button.disabled = !canCollapse;
      control.button.setAttribute("aria-disabled", String(!canCollapse));
      control.button.setAttribute("aria-label", canCollapse ? "Collapse sidebar column" : lastExpanded ? "Collapse sidebar column unavailable; keep one column expanded" : "Collapse sidebar column unavailable during the current operation");
      control.button.title = canCollapse ? "Collapse column" : lastExpanded ? "Keep at least one column expanded" : "Finish the current sidebar operation first";
    }
  }
  captureTree(root) {
    const tree = /* @__PURE__ */ new Map();
    const walk = (item) => {
      if (tree.has(item) || tree.size >= MAX_ITEMS) throw new Error("The native sidebar tree cannot be captured safely.");
      const children = isSplit(item) || isTabs(item) ? item.children.slice() : void 0;
      tree.set(item, {
        parent: item.parent,
        children,
        dimension: item.dimension,
        direction: isSplit(item) ? item.direction : void 0,
        selected: isTabs(item) ? item.currentTab : void 0,
        view: isLeaf(item) ? item.view : void 0,
        pinned: isLeaf(item) ? item.pinned : void 0
      });
      children == null ? void 0 : children.forEach(walk);
    };
    walk(root);
    return tree;
  }
  structureMatches(tree) {
    return [...tree].every(([item, saved]) => item.parent === saved.parent && (!saved.children || sameItems(item.children, saved.children)) && (saved.direction === void 0 || item.direction === saved.direction));
  }
  createNativeSplit(direction, existing) {
    var _a, _b;
    const split = Reflect.construct(import_obsidian.WorkspaceSplit, [this.workspace, direction]);
    const doc = this.workspace.containerEl.ownerDocument;
    if (!isSplit(split) || isSidebar(split) || split.type !== "split" || split.direction !== direction || split.parent !== null || !Array.isArray(split.children) || split.children.length !== 0 || typeof split.id !== "string" || !split.id || [...existing.keys()].some((item) => item.id === split.id) || ((_a = split.containerEl) == null ? void 0 : _a.ownerDocument) !== doc || ((_b = split.resizeHandleEl) == null ? void 0 : _b.ownerDocument) !== doc || typeof split.setDimension !== "function" || typeof split.insertChild !== "function" || typeof split.removeChild !== "function" || typeof split.replaceChild !== "function") {
      throw new Error("This Obsidian version cannot construct a guarded native sidebar column. The layout was not changed.");
    }
    return split;
  }
  rowFactoryAvailable(side) {
    return side === "left" ? typeof this.workspace.getLeftLeaf === "function" : typeof this.workspace.getRightLeaf === "function";
  }
  async addFullWidthRowBelow(target) {
    if (this.operationRunning || this.isBusyGesture()) throw new Error("Finish the current sidebar operation or drag first.");
    this.assertCompatible();
    if (!this.isCurrent(target)) throw new Error("The selected sidebar tab moved or closed. Select it again.");
    if (!this.rowFactoryAvailable(target.side)) throw new Error("This Obsidian version cannot create a native bottom sidebar row safely. Existing splitting remains available.");
    if (target.root.collapsed) throw new Error("Open the selected sidebar before adding a row.");
    this.expandAll();
    const root = target.root, win = root.containerEl.ownerDocument.defaultView;
    if (!win) throw new Error("The sidebar window is unavailable.");
    if (win.getComputedStyle(root.containerEl).flexDirection !== "column") {
      throw new Error("The theme changes the native sidebar orientation. Restore native sidebar styling before adding a row.");
    }
    const original = this.captureTree(root), children = root.children.slice();
    const rectangles = children.map((child) => child.containerEl.getBoundingClientRect());
    if (!rectangles.length || rectangles.some((rect) => rect.width <= 0 || rect.height <= 0)) throw new Error("The native sidebar content is not visible.");
    const bounds = {
      left: Math.min(...rectangles.map((rect) => rect.left)),
      right: Math.max(...rectangles.map((rect) => rect.right)),
      top: Math.min(...rectangles.map((rect) => rect.top)),
      bottom: Math.max(...rectangles.map((rect) => rect.bottom))
    };
    const weights = children.map((child) => {
      var _a;
      return (_a = child.dimension) != null ? _a : 1;
    }), total = weights.reduce((sum, weight) => sum + weight, 0);
    const originalSize = root.size, originalCollapsed = root.collapsed, active = this.workspace.activeLeaf;
    const originalLeaves = /* @__PURE__ */ new Set();
    this.workspace.iterateAllLeaves((leaf) => originalLeaves.add(leaf));
    let created = null, group = null, post = null;
    let postActive = null;
    this.operationRunning = true;
    try {
      created = target.side === "left" ? this.workspace.getLeftLeaf(true) : this.workspace.getRightLeaf(true);
      if (!created || !isLeaf(created) || originalLeaves.has(created)) throw new Error("The native row factory did not return a new tab.");
      const item = nativeItem(created);
      if (!isTabs(item.parent)) throw new Error("The returned tab has no safely supported native group.");
      group = item.parent;
      post = this.captureTree(root);
      postActive = this.workspace.activeLeaf;
      if (original.has(group) || group.parent !== root || group.children.length !== 1 || group.children[0] !== item || item.view.getViewType() !== "empty" || item.pinned || !sameItems(root.children, [...children, group])) {
        throw new Error("Obsidian did not return an owned empty bottom sidebar row.");
      }
      const setOwnedDimension = (node, requested) => {
        const expected = post == null ? void 0 : post.get(node);
        try {
          node.setDimension(requested);
        } finally {
          if (expected && node.dimension === requested) expected.dimension = requested;
        }
      };
      children.forEach((child, index) => setOwnedDimension(child, weights[index] / total * 50));
      setOwnedDimension(group, 50);
      try {
        this.workspace.setActiveLeaf(created, { focus: false });
      } finally {
        if (this.workspace.activeLeaf === created) postActive = created;
      }
      this.workspace.requestResize();
      await this.nextFrame(win);
      if ((target.side === "left" ? this.workspace.leftSplit : this.workspace.rightSplit) !== root) throw new Error("The sidebar workspace was replaced while adding its row.");
      const next = this.resolveTarget(created);
      const preserved = [...original].every(([node, saved]) => (!saved.children || node === root || sameItems(node.children, saved.children)) && (saved.direction === void 0 || node.direction === saved.direction) && (!saved.view || node.view === saved.view && node.pinned === saved.pinned) && (saved.selected === void 0 || node.currentTab === saved.selected) && (children.includes(node) || node.dimension === saved.dimension));
      if (!this.structureMatches(post) || !preserved || next.root !== root || next.group !== group || next.parent !== root || root.size !== originalSize || root.collapsed !== originalCollapsed || group.children.length !== 1 || group.children[0] !== item || item.view.getViewType() !== "empty" || item.pinned) throw new Error("Obsidian did not preserve the native sidebar while adding its bottom row.");
      const oldRects = children.map((child) => child.containerEl.getBoundingClientRect()), added = group.containerEl.getBoundingClientRect();
      const oldBottom = Math.max(...oldRects.map((rect) => rect.bottom));
      if (added.width <= 0 || added.height <= 0 || Math.abs(added.left - bounds.left) > 1 || Math.abs(added.right - bounds.right) > 1 || added.top < oldBottom - 1 || Math.abs(added.bottom - bounds.bottom) > 1 || Math.abs(Math.min(...oldRects.map((rect) => rect.top)) - bounds.top) > 1) {
        throw new Error("The new native row did not render full width beneath the existing sidebar content. The theme may be incompatible.");
      }
    } catch (error) {
      let rollbackError;
      try {
        if (!created || originalLeaves.has(created) || !group || !post) throw new Error("No safely identified operation-owned tab was returned; the layout was not automatically rewritten.");
        const item = nativeItem(created);
        if ((target.side === "left" ? this.workspace.leftSplit : this.workspace.rightSplit) !== root || !this.structureMatches(post) || item.parent !== group || group.parent !== root || group.children.length !== 1 || group.children[0] !== item || item.view.getViewType() !== "empty" || item.pinned) throw new Error("The added tab moved, changed, or its branch was edited; automatic rollback was stopped.");
        const ratiosUnchanged = [...post].every(([node, saved]) => node.dimension === saved.dimension);
        const focusUnchanged = this.workspace.activeLeaf === postActive;
        item.detach();
        if (!this.structureMatches(original)) throw new Error("The sidebar changed during removal; automatic rollback was stopped.");
        if (ratiosUnchanged) for (const [node, saved] of original) node.setDimension(saved.dimension);
        if (focusUnchanged && this.workspace.activeLeaf === postActive && active && active !== postActive) {
          let attached = false;
          this.workspace.iterateAllLeaves((leaf) => {
            if (leaf === active) attached = true;
          });
          if (attached) this.workspace.setActiveLeaf(active, { focus: false });
        }
        this.workspace.requestResize();
      } catch (rollback) {
        rollbackError = rollback;
      }
      throw new Error(`${message(error)}${rollbackError ? ` ${message(rollbackError)} Use the layout backup if needed.` : " The added row was rolled back."}`);
    } finally {
      this.operationRunning = false;
      this.refreshColumnControls();
    }
  }
  async addColumn(target) {
    var _a;
    if (this.operationRunning || this.isBusyGesture()) throw new Error("Finish the current sidebar operation or drag first.");
    this.assertCompatible();
    if (!this.isCurrent(target)) throw new Error("The selected sidebar tab moved or closed. Select it again.");
    if (target.root.collapsed) throw new Error("Open the selected sidebar before adding a column.");
    this.expandAll();
    const root = target.root;
    const win = root.containerEl.ownerDocument.defaultView;
    if (!win) throw new Error("The sidebar window is unavailable.");
    const fullHeight = this.fullHeightContent(root);
    const branch = fullHeight ? this.branchIn(target.group, fullHeight) : null;
    if (fullHeight && !branch) throw new Error("The selected tab is outside the full-height sidebar columns.");
    const style = win.getComputedStyle((fullHeight != null ? fullHeight : root).containerEl);
    if (style.flexDirection !== (fullHeight ? "row" : "column")) {
      throw new Error("The theme changes the native split orientation. Restore native sidebar styling before adding a column.");
    }
    const before = style.direction === "rtl";
    const bounds = root.containerEl.getBoundingClientRect();
    const visible = target.group.containerEl.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0 || visible.width <= 0 || visible.height <= 0) {
      throw new Error("The selected sidebar tab group is not visible.");
    }
    const rootChildren = root.children.slice();
    const contentRects = rootChildren.map((child) => child.containerEl.getBoundingClientRect());
    if (contentRects.some((rect) => rect.width <= 0 || rect.height <= 0)) {
      throw new Error("The native sidebar content is not visible.");
    }
    const contentBounds = {
      top: Math.min(...contentRects.map((rect) => rect.top)),
      bottom: Math.max(...contentRects.map((rect) => rect.bottom))
    };
    const original = this.captureTree(root);
    const originalSize = root.size, originalCollapsed = root.collapsed;
    const originalActive = this.workspace.activeLeaf;
    const originalLeaves = /* @__PURE__ */ new Set();
    this.workspace.iterateAllLeaves((leaf) => originalLeaves.add(leaf));
    const content = fullHeight != null ? fullHeight : this.createNativeSplit("vertical", original);
    const stack = !fullHeight && rootChildren.length > 1 ? this.createNativeSplit("horizontal", original) : null;
    if ((stack == null ? void 0 : stack.id) === content.id) throw new Error("The native split constructors returned duplicate identities.");
    let created;
    let createdGroup = null;
    let extracted = false, assembled = false;
    let post = null;
    let postActive = null;
    let postGroup = null;
    let existingColumn = branch;
    this.operationRunning = true;
    try {
      created = this.workspace.createLeafBySplit(target.leaf, "vertical", before);
      if (!isLeaf(created) || originalLeaves.has(created)) throw new Error("The native split did not return a new tab.");
      const item = nativeItem(created);
      if (!isTabs(item.parent) || !isSplit((_a = item.parent) == null ? void 0 : _a.parent)) throw new Error("The returned tab has no safely supported native group.");
      createdGroup = item.parent;
      post = this.captureTree(root);
      postGroup = this.captureTree(createdGroup);
      postActive = this.workspace.activeLeaf;
      if (original.has(createdGroup) || createdGroup.children.length !== 1 || createdGroup.children[0] !== item || item.view.getViewType() !== "empty" || item.pinned || !isInside(item, root)) {
        throw new Error("The native split did not return an owned empty sidebar group.");
      }
      createdGroup.parent.removeChild(createdGroup);
      extracted = true;
      postGroup = this.captureTree(createdGroup);
      post = this.captureTree(root);
      if (!this.structureMatches(original)) throw new Error("The existing sidebar changed while preparing its new column.");
      for (const [node, saved] of original) node.setDimension(saved.dimension);
      createdGroup.setDimension(null);
      if (fullHeight) {
        const index = fullHeight.children.indexOf(branch);
        if (index < 0) throw new Error("The selected full-height column moved.");
        const dimension = branch.dimension;
        if (dimension !== null) {
          branch.setDimension(dimension / 2);
          createdGroup.setDimension(dimension / 2);
        }
        fullHeight.insertChild(index + (before ? 0 : 1), createdGroup);
      } else {
        root.insertChild(0, content);
        if (stack) {
          for (const child of rootChildren) {
            root.removeChild(child);
            stack.insertChild(-1, child);
          }
          existingColumn = stack;
        } else {
          existingColumn = rootChildren[0];
          root.removeChild(existingColumn);
        }
        existingColumn.setDimension(50);
        createdGroup.setDimension(50);
        (before ? [createdGroup, existingColumn] : [existingColumn, createdGroup]).forEach((child) => content.insertChild(-1, child));
      }
      assembled = true;
      this.workspace.requestResize();
      post = this.captureTree(root);
      postGroup = this.captureTree(createdGroup);
      postActive = this.workspace.activeLeaf;
      await this.nextFrame(win);
      if ((target.side === "left" ? this.workspace.leftSplit : this.workspace.rightSplit) !== root) {
        throw new Error("The sidebar workspace was replaced while adding its column.");
      }
      const next = this.resolveTarget(created);
      if (next.root !== root || next.group !== createdGroup || next.parent !== content) {
        throw new Error("The new column is no longer attached to the selected sidebar.");
      }
      this.validateSidebar(root);
      const preserved = [...original].every(([node, saved]) => (!saved.view || node.view === saved.view && node.pinned === saved.pinned) && (saved.selected === void 0 || node.currentTab === saved.selected) && (node === branch || !fullHeight && !stack && node === existingColumn || node.dimension === saved.dimension));
      if (!this.structureMatches(post) || !preserved || root.size !== originalSize || root.collapsed !== originalCollapsed || createdGroup.children.length !== 1 || createdGroup.children[0] !== item || item.view.getViewType() !== "empty" || createdGroup.parent !== content || (existingColumn == null ? void 0 : existingColumn.parent) !== content) {
        throw new Error("Obsidian did not preserve the existing native sidebar while adding its full-height column.");
      }
      const oldIndex = content.children.indexOf(existingColumn);
      if (content.children.indexOf(createdGroup) !== oldIndex + (before ? -1 : 1)) {
        throw new Error("The new full-height column is in an unexpected native tree position.");
      }
      const contentRect = content.containerEl.getBoundingClientRect();
      const oldRect = existingColumn.containerEl.getBoundingClientRect();
      const newRect = createdGroup.containerEl.getBoundingClientRect();
      if (oldRect.width <= 0 || newRect.width <= 0 || newRect.left < oldRect.right - 1 || Math.abs(contentRect.top - contentBounds.top) > 1 || Math.abs(contentRect.bottom - contentBounds.bottom) > 1 || Math.abs(newRect.top - contentRect.top) > 1 || Math.abs(newRect.bottom - contentRect.bottom) > 1 || Math.abs(oldRect.top - contentRect.top) > 1 || Math.abs(oldRect.bottom - contentRect.bottom) > 1) {
        throw new Error("The new native sidebar column did not render full height to the right. The theme may be incompatible.");
      }
    } catch (error) {
      let rollbackError;
      try {
        if (!created || originalLeaves.has(created) || !createdGroup || !post || !postGroup) {
          throw new Error("No safely identified operation-owned tab was returned; the layout was not automatically rewritten.");
        }
        const item = nativeItem(created);
        if ((target.side === "left" ? this.workspace.leftSplit : this.workspace.rightSplit) !== root || !this.structureMatches(post) || !this.structureMatches(postGroup) || item.parent !== createdGroup || item.view.getViewType() !== "empty" || item.pinned || createdGroup.children.length !== 1 || createdGroup.children[0] !== item) {
          throw new Error("The added tab moved, changed, or its branch was edited; automatic rollback was stopped.");
        }
        const ratiosUnchanged = [...post, ...postGroup].every(([node, saved]) => node.dimension === saved.dimension);
        const focusUnchanged = this.workspace.activeLeaf === postActive;
        if (assembled && !fullHeight) {
          content.removeChild(existingColumn);
          if (stack) {
            for (const child of rootChildren) {
              stack.removeChild(child);
              root.insertChild(root.children.indexOf(createdGroup), child);
            }
          } else root.insertChild(root.children.indexOf(createdGroup), existingColumn);
        } else if (!assembled && extracted && !this.structureMatches(original)) {
          throw new Error("The sidebar changed during preparation; automatic rollback was stopped.");
        }
        item.detach();
        if (!this.structureMatches(original)) {
          throw new Error("The sidebar changed during removal; automatic rollback was stopped.");
        }
        if (ratiosUnchanged) for (const [node, saved] of original) node.setDimension(saved.dimension);
        if (focusUnchanged && this.workspace.activeLeaf === postActive && originalActive) {
          let attached = false;
          this.workspace.iterateAllLeaves((leaf) => {
            if (leaf === originalActive) attached = true;
          });
          if (attached) this.workspace.setActiveLeaf(originalActive, { focus: false });
        }
        this.workspace.requestResize();
      } catch (rollback) {
        rollbackError = rollback;
      }
      throw new Error(`${message(error)}${rollbackError ? ` ${message(rollbackError)} Use the layout backup if needed.` : " The added column was rolled back."}`);
    } finally {
      this.operationRunning = false;
      this.refreshColumnControls();
    }
  }
  async splitRight(target) {
    var _a;
    if (this.operationRunning || this.isBusyGesture()) throw new Error("Finish the current sidebar operation or drag first.");
    this.assertCompatible();
    if (!this.isCurrent(target)) throw new Error("The selected sidebar tab moved or closed. Select it again.");
    if (this.nativeSplitAvailable(target)) throw new Error("Obsidian already enables its native sidebar split command. Use that command.");
    if (target.root.collapsed) throw new Error("Open the selected sidebar before adding a column.");
    this.expandAll();
    const win = target.root.containerEl.ownerDocument.defaultView;
    if (!win) throw new Error("The sidebar window is unavailable.");
    const style = win.getComputedStyle(target.parent.containerEl);
    if (style.flexDirection !== "row" && style.flexDirection !== "column") {
      throw new Error("The theme changes the native split orientation. Restore native sidebar styling before splitting.");
    }
    const before = style.direction === "rtl";
    const originalRect = target.group.containerEl.getBoundingClientRect();
    if (originalRect.width <= 0 || originalRect.height <= 0) throw new Error("The selected sidebar tab group is not visible.");
    const parent = target.parent;
    const siblings = parent.children.slice();
    const dimensions = siblings.map((item) => item.dimension);
    const groupLeaves = target.group.children.slice();
    const views = groupLeaves.map((item) => item.view);
    const pinned = groupLeaves.map((item) => item.pinned);
    const selectedTab = target.group.currentTab;
    const active = this.workspace.activeLeaf;
    const originalLeaves = /* @__PURE__ */ new Set();
    this.workspace.iterateAllLeaves((leaf) => originalLeaves.add(leaf));
    let created;
    let createdGroup = null;
    let createdParent = null;
    let createdRoot = null;
    const postChildren = /* @__PURE__ */ new Map();
    const postDimensions = /* @__PURE__ */ new Map();
    let postActive = null;
    let postSelectedTab = selectedTab;
    this.operationRunning = true;
    try {
      created = this.workspace.createLeafBySplit(target.leaf, "vertical", before);
      if (!isLeaf(created) || originalLeaves.has(created)) throw new Error("The native split did not return a new tab.");
      const returned = nativeItem(created);
      if (!isTabs(returned.parent) || !isSplit((_a = returned.parent) == null ? void 0 : _a.parent)) {
        throw new Error("The returned tab has no safely supported native group.");
      }
      createdGroup = returned.parent;
      createdParent = createdGroup.parent;
      let immediateRoot = returned;
      const immediatePath = /* @__PURE__ */ new Set();
      while (immediateRoot.parent) {
        if (immediatePath.has(immediateRoot) || immediatePath.size >= MAX_ITEMS || !Array.isArray(immediateRoot.parent.children) || !immediateRoot.parent.children.includes(immediateRoot)) {
          throw new Error("The returned tab has an invalid native attachment.");
        }
        immediatePath.add(immediateRoot);
        immediateRoot = immediateRoot.parent;
      }
      if (![this.workspace.leftSplit, this.workspace.rightSplit, this.workspace.rootSplit].includes(immediateRoot)) {
        throw new Error("The returned tab belongs to an unsupported window.");
      }
      createdRoot = immediateRoot;
      postChildren.set(parent, parent.children.slice());
      postChildren.set(createdParent, createdParent.children.slice());
      postChildren.set(createdGroup, createdGroup.children.slice());
      postChildren.set(target.group, target.group.children.slice());
      for (const owner of postChildren.keys()) {
        postDimensions.set(owner, owner.dimension);
        for (const child of owner.children) postDimensions.set(child, child.dimension);
      }
      postActive = this.workspace.activeLeaf;
      postSelectedTab = target.group.currentTab;
      await this.nextFrame(win);
      const next = this.resolveTarget(created);
      if (next.root !== target.root || next.group !== createdGroup || next.parent !== createdParent || next.group === target.group || next.group.children.length !== 1 || next.group.children[0] !== nativeItem(created) || nativeItem(created).view.getViewType() !== "empty" || nativeItem(target.leaf).parent !== target.group || !sameItems(target.group.children, groupLeaves) || groupLeaves.some((leaf, index) => leaf.view !== views[index] || leaf.pinned !== pinned[index]) || target.group.currentTab !== selectedTab || next.parent.direction !== "vertical" || target.group.parent !== next.parent) {
        throw new Error("Obsidian did not create an empty native column beside the selected sidebar group.");
      }
      const oldIndex = next.parent.children.indexOf(target.group);
      const newIndex = next.parent.children.indexOf(next.group);
      if (newIndex !== oldIndex + (before ? -1 : 1)) throw new Error("The new column is in an unexpected native tree position.");
      const left = target.group.containerEl.getBoundingClientRect();
      const right = next.group.containerEl.getBoundingClientRect();
      if (left.width <= 0 || right.width <= 0 || right.left < left.right - 1 || right.height <= 0) {
        throw new Error("The new native column did not render to the right. The theme may be incompatible.");
      }
    } catch (error) {
      let rollbackError;
      try {
        if (!created || originalLeaves.has(created) || !createdGroup || !createdParent || !createdRoot) {
          throw new Error("No safely identified operation-owned tab was returned; the layout was not automatically rewritten.");
        }
        const item = nativeItem(created);
        const rootStillCurrent = createdRoot === this.workspace.leftSplit || createdRoot === this.workspace.rightSplit || createdRoot === this.workspace.rootSplit;
        if (!rootStillCurrent || item.parent !== createdGroup || createdGroup.parent !== createdParent || !isInside(item, createdRoot) || item.view.getViewType() !== "empty" || item.pinned || createdGroup.children.length !== 1 || createdGroup.children[0] !== item || [...postChildren].some(([owner, children]) => !sameItems(owner.children, children))) {
          throw new Error("The added tab moved, changed, or its branch was edited; automatic rollback was stopped.");
        }
        const ratiosUnchanged = [...postDimensions].every(([node, dimension]) => node.dimension === dimension);
        const selectionUnchanged = target.group.currentTab === postSelectedTab;
        const focusUnchanged = this.workspace.activeLeaf === postActive;
        item.detach();
        if (!sameItems(parent.children, siblings) || target.group.parent !== parent || !sameItems(target.group.children, groupLeaves)) {
          throw new Error("The sidebar changed during removal; automatic rollback was stopped.");
        }
        if (ratiosUnchanged) siblings.forEach((node, index) => node.setDimension(dimensions[index]));
        if (selectionUnchanged && postSelectedTab === selectedTab) target.group.currentTab = selectedTab;
        if (focusUnchanged && this.workspace.activeLeaf === postActive && active) {
          let stillAttached = false;
          this.workspace.iterateAllLeaves((leaf) => {
            if (leaf === active) stillAttached = true;
          });
          if (stillAttached) this.workspace.setActiveLeaf(active, { focus: false });
        }
        this.workspace.requestResize();
      } catch (rollback) {
        rollbackError = rollback;
      }
      throw new Error(`${message(error)}${rollbackError ? ` ${message(rollbackError)} Use the layout backup if needed.` : " The added column was rolled back."}`);
    } finally {
      this.operationRunning = false;
      this.refreshColumnControls();
    }
  }
  nextFrame(win) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        win.clearTimeout(timer);
        resolve();
      };
      const timer = win.setTimeout(finish, 250);
      win.requestAnimationFrame(finish);
    });
  }
};

// src/layout.ts
var LayoutValidationError = class extends Error {
  constructor(message2) {
    super(message2);
    this.name = "LayoutValidationError";
  }
};
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function fail(message2) {
  throw new LayoutValidationError(message2);
}
function checkJson(value, ancestors, depth = 0) {
  if (depth > 128) fail("The layout exceeds the supported nesting depth.");
  if (value === null || value === void 0 || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("The layout contains a non-finite number.");
    return;
  }
  if (typeof value !== "object") fail("The layout contains an unsupported non-JSON value.");
  if (!Array.isArray(value) && !record(value)) fail("The layout contains an unsupported object.");
  if (ancestors.has(value)) fail("The layout contains a cycle.");
  ancestors.add(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) checkJson(child, ancestors, depth + 1);
  ancestors.delete(value);
}
var descendants = {
  split: ["split", "tabs"],
  tabs: ["leaf"],
  floating: ["window"],
  window: ["split", "tabs"]
};
function validateLayout(value) {
  if (!record(value)) fail("The snapshot is not a workspace layout object.");
  checkJson(value, /* @__PURE__ */ new Set());
  const ids = /* @__PURE__ */ new Set();
  const leafIds = /* @__PURE__ */ new Set();
  let nodeCount = 0;
  function visit(nodeValue, allowed, depth) {
    if (depth > 64 || ++nodeCount > 2e4) fail("The workspace tree exceeds the supported size.");
    if (!record(nodeValue)) fail("The workspace tree contains an invalid node.");
    const type = nodeValue.type;
    if (typeof type !== "string" || !allowed.includes(type)) fail("The workspace tree contains an unsupported parent-child relationship.");
    const id = nodeValue.id;
    if (typeof id !== "string" || id.length === 0 || id.length > 200) fail("The workspace tree contains a missing or invalid ID.");
    if (ids.has(id)) fail("The workspace tree contains duplicate IDs.");
    ids.add(id);
    if (nodeValue.dimension !== void 0 && nodeValue.dimension !== null && (typeof nodeValue.dimension !== "number" || nodeValue.dimension < 0 || nodeValue.dimension > 100)) {
      fail("The workspace tree contains an invalid size proportion.");
    }
    if (type === "leaf") {
      leafIds.add(id);
      if (nodeValue.children !== void 0) fail("A workspace leaf cannot contain children.");
      if (!record(nodeValue.state) || typeof nodeValue.state.type !== "string" || nodeValue.state.type.length === 0) {
        fail("The workspace tree contains an invalid view state.");
      }
      return;
    }
    if (!Array.isArray(nodeValue.children)) fail("A workspace parent is missing its children.");
    if (type === "split" && nodeValue.direction !== "horizontal" && nodeValue.direction !== "vertical") {
      fail("The workspace tree contains an invalid split direction.");
    }
    if (type === "tabs" && nodeValue.currentTab !== void 0) {
      const current = nodeValue.currentTab;
      const empty = nodeValue.children.length === 0;
      if (typeof current !== "number" || !Number.isInteger(current) || (empty ? current !== -1 && current !== 0 : current < 0 || current >= nodeValue.children.length)) {
        fail("The workspace tree contains an invalid selected tab.");
      }
    }
    for (const child of nodeValue.children) visit(child, descendants[type], depth + 1);
  }
  for (const side of ["main", "left", "right"]) {
    const root = value[side];
    if (!record(root) || root.type !== "split") fail("The layout is missing a native workspace root.");
    if (root.direction !== (side === "main" ? "vertical" : "horizontal")) fail("The layout has an incompatible outer workspace direction.");
    if (side !== "main") {
      if (root.width !== void 0 && (typeof root.width !== "number" || !Number.isFinite(root.width) || root.width <= 0)) fail("The layout contains an invalid sidebar width.");
      if (root.collapsed !== void 0 && typeof root.collapsed !== "boolean") fail("The layout contains an invalid sidebar collapse state.");
    }
    visit(root, ["split"], 0);
  }
  if (value.floating !== void 0) visit(value.floating, ["floating"], 0);
  if (value.active !== void 0 && value.active !== null && (typeof value.active !== "string" || !leafIds.has(value.active))) fail("The layout refers to a missing active leaf.");
  return value;
}
function parseLayout(text) {
  if (text.length > 32 * 1024 * 1024) fail("The snapshot exceeds the supported file size.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    fail("The snapshot is not valid JSON.");
  }
  return validateLayout(parsed);
}
function cloneLayout(layout) {
  return parseLayout(JSON.stringify(validateLayout(layout)));
}

// src/backups.ts
var BackupError = class extends Error {
  constructor(message2) {
    super(message2);
    this.name = "BackupError";
  }
};
var metadataSuffix = ".metadata.json";
var rawSuffix = ".workspace.json";
var idPattern = /^(?:baseline|snapshot)-[A-Za-z0-9-]{1,100}$/;
function directory(configDir) {
  const normalized = configDir.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes(":") || normalized.includes("\0") || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new BackupError("The vault configuration directory is invalid.");
  }
  return `${normalized}/sidebar-columns-backups`;
}
async function checksum(text, crypto) {
  if (!(crypto == null ? void 0 : crypto.subtle)) throw new BackupError("Secure SHA-256 hashing is unavailable; no layout changes were made.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function metadata(text, expectedId) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new BackupError("A backup metadata file is corrupt. Backups were left untouched.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BackupError("A backup metadata file is incompatible.");
  const entry = value;
  if (entry.formatVersion !== 1 || typeof entry.pluginVersion !== "string" || !entry.pluginVersion || entry.id !== expectedId || !idPattern.test(expectedId) || entry.rawFile !== `${expectedId}${rawSuffix}` || typeof entry.timestamp !== "string" || !Number.isFinite(Date.parse(entry.timestamp)) || typeof entry.baseline !== "boolean" || entry.baseline !== expectedId.startsWith("baseline-") || typeof entry.reason !== "string" || !entry.reason || entry.reason.length > 120 || typeof entry.appVersion !== "string" || !entry.appVersion || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new BackupError("A backup metadata file is incompatible. Backups were left untouched.");
  }
  return entry;
}
var BackupStore = class {
  constructor(adapter, configDir, appVersion, options = {}) {
    this.adapter = adapter;
    this.appVersion = appVersion;
    __publicField(this, "root");
    __publicField(this, "now");
    __publicField(this, "maxRecent");
    __publicField(this, "pluginVersion");
    __publicField(this, "crypto");
    __publicField(this, "creating", false);
    var _a, _b, _c, _d;
    this.root = directory(configDir);
    this.now = (_a = options.now) != null ? _a : () => /* @__PURE__ */ new Date();
    this.maxRecent = (_b = options.maxRecent) != null ? _b : 5;
    if (!Number.isInteger(this.maxRecent) || this.maxRecent < 1 || this.maxRecent > 50) throw new BackupError("The backup retention count is invalid.");
    if (!appVersion) throw new BackupError("The Obsidian version is missing.");
    this.pluginVersion = (_c = options.pluginVersion) != null ? _c : "unknown";
    if (!this.pluginVersion.trim()) throw new BackupError("The plugin version is missing.");
    this.crypto = (_d = options.crypto) != null ? _d : typeof window === "undefined" ? void 0 : window.crypto;
  }
  snapshot(entry) {
    return {
      id: entry.id,
      rawPath: `${this.root}/${entry.rawFile}`,
      metadataPath: `${this.root}/${entry.id}${metadataSuffix}`,
      timestamp: entry.timestamp,
      baseline: entry.baseline,
      reason: entry.reason,
      appVersion: entry.appVersion
    };
  }
  async list() {
    if (!await this.adapter.exists(this.root)) return [];
    const listed = await this.adapter.list(this.root);
    const entries = [];
    const knownRaw = /* @__PURE__ */ new Set();
    for (const path of listed.files) {
      if (!path.endsWith(metadataSuffix)) continue;
      if (!path.startsWith(`${this.root}/`) || path.slice(this.root.length + 1).includes("/")) throw new BackupError("The backup directory contains an unsafe metadata path.");
      const id = path.slice(this.root.length + 1, -metadataSuffix.length);
      const entry = metadata(await this.adapter.read(path), id);
      const item = this.snapshot(entry);
      if (!await this.adapter.exists(item.rawPath)) throw new BackupError("A backup layout file is missing. Backups were left untouched.");
      knownRaw.add(item.rawPath);
      entries.push(item);
    }
    if (listed.files.some((path) => path.endsWith(rawSuffix) && !knownRaw.has(path))) throw new BackupError("An incomplete layout backup needs review. Backups were left untouched.");
    if (entries.length > 0 && entries.filter((entry) => entry.baseline).length !== 1) throw new BackupError("The protected baseline metadata is missing or ambiguous. Backups were left untouched.");
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
  }
  async load(snapshot) {
    if (!idPattern.test(snapshot.id) || snapshot.rawPath !== `${this.root}/${snapshot.id}${rawSuffix}` || snapshot.metadataPath !== `${this.root}/${snapshot.id}${metadataSuffix}`) throw new BackupError("The selected backup path is invalid.");
    const entry = metadata(await this.adapter.read(snapshot.metadataPath), snapshot.id);
    const actual = this.snapshot(entry);
    if (actual.timestamp !== snapshot.timestamp || actual.baseline !== snapshot.baseline || actual.reason !== snapshot.reason || actual.appVersion !== snapshot.appVersion) {
      throw new BackupError("The selected backup metadata changed. Select the backup again.");
    }
    const raw = await this.adapter.read(actual.rawPath);
    if (await checksum(raw, this.crypto) !== entry.sha256) throw new BackupError("The layout backup failed its integrity check. It was not restored.");
    return parseLayout(raw);
  }
  async create(layout, reason) {
    var _a;
    if (this.creating) throw new BackupError("Another layout backup is already in progress.");
    this.creating = true;
    let rawTemp;
    let metadataTemp;
    try {
      if (!reason || reason.length > 120) throw new BackupError("The backup reason is invalid.");
      const raw = JSON.stringify(cloneLayout(layout), null, 2);
      const existing = await this.list();
      for (const item of existing) await this.load(item);
      if (!await this.adapter.exists(this.root)) await this.adapter.mkdir(this.root);
      const baseline = existing.length === 0;
      const timestamp = this.now().toISOString();
      const random = new Uint8Array(8);
      if (!((_a = this.crypto) == null ? void 0 : _a.getRandomValues)) throw new BackupError("Secure backup ID generation is unavailable.");
      this.crypto.getRandomValues(random);
      const entropy = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const id = `${baseline ? "baseline" : "snapshot"}-${timestamp.replace(/[:.]/g, "-")}-${entropy}`;
      const rawPath = `${this.root}/${id}${rawSuffix}`;
      const metadataPath = `${this.root}/${id}${metadataSuffix}`;
      if (await this.adapter.exists(rawPath) || await this.adapter.exists(metadataPath)) throw new BackupError("The backup filename already exists; no backup was overwritten.");
      const entry = {
        formatVersion: 1,
        pluginVersion: this.pluginVersion,
        id,
        rawFile: `${id}${rawSuffix}`,
        timestamp,
        baseline,
        reason,
        appVersion: this.appVersion,
        sha256: await checksum(raw, this.crypto)
      };
      rawTemp = `${rawPath}.tmp`;
      metadataTemp = `${metadataPath}.tmp`;
      await this.adapter.write(rawTemp, raw);
      const readback = await this.adapter.read(rawTemp);
      parseLayout(readback);
      if (await checksum(readback, this.crypto) !== entry.sha256) throw new BackupError("The layout backup could not be verified; no layout changes were made.");
      await this.adapter.write(metadataTemp, JSON.stringify(entry, null, 2));
      metadata(await this.adapter.read(metadataTemp), id);
      await this.adapter.rename(rawTemp, rawPath);
      await this.adapter.rename(metadataTemp, metadataPath);
      const created = this.snapshot(entry);
      await this.load(created);
      const previousRecent = existing.filter((item) => !item.baseline).sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
      const retainedPrevious = this.maxRecent - (created.baseline ? 0 : 1);
      for (const old of previousRecent.slice(retainedPrevious)) {
        await this.adapter.remove(old.metadataPath);
        await this.adapter.remove(old.rawPath);
      }
      return created;
    } catch (error) {
      if (error instanceof BackupError || error instanceof Error && error.name === "LayoutValidationError") throw error;
      throw new BackupError("The layout backup could not be saved. No layout changes were made.");
    } finally {
      for (const path of [rawTemp, metadataTemp]) {
        if (!path) continue;
        try {
          if (await this.adapter.exists(path)) await this.adapter.remove(path);
        } catch (e) {
        }
      }
      this.creating = false;
    }
  }
};

// src/operations.ts
function result(status, message2, snapshot) {
  return snapshot ? { status, message: message2, snapshot } : { status, message: message2 };
}
var OperationService = class {
  constructor(port) {
    this.port = port;
    __publicField(this, "running", false);
    __publicField(this, "disposed", false);
    __publicField(this, "generation", 0);
  }
  get busy() {
    return this.running;
  }
  dispose() {
    this.disposed = true;
    this.generation++;
  }
  addColumn(target) {
    return this.run("addColumn", target);
  }
  addRow(target) {
    return this.run("addRow", target);
  }
  split(target) {
    return this.run("split", target);
  }
  collapse(target) {
    return this.run("collapse", target);
  }
  alive(generation) {
    return !this.disposed && generation === this.generation;
  }
  unavailable() {
    return result("blocked", "The plugin was disabled before the operation could finish.");
  }
  stale() {
    return result("stale", "The workspace changed. Select the sidebar tab again and retry.");
  }
  async consent(generation) {
    if (this.port.isAcknowledged()) return true;
    if (!await this.port.requestConsent() || !this.alive(generation)) return false;
    await this.port.persistAcknowledgement();
    return this.alive(generation);
  }
  exclusive(work) {
    if (this.disposed) return Promise.resolve(this.unavailable());
    if (this.running) return Promise.resolve(result("blocked", "Another sidebar operation is already in progress."));
    this.running = true;
    const generation = this.generation;
    return work(generation).catch((error) => result("error", error instanceof Error ? error.message : "The sidebar operation failed.")).finally(() => {
      this.running = false;
    });
  }
  run(action, target) {
    return this.exclusive(async (generation) => {
      if (!await this.port.checkCompatibility()) return result("blocked", "This Obsidian version or workspace structure is not enabled for experimental sidebar columns.");
      if (!this.alive(generation)) return this.unavailable();
      if (!this.port.isTargetCurrent(target)) return this.stale();
      if (!await this.consent(generation)) return this.alive(generation) ? result("cancelled", "No layout changes were made.") : this.unavailable();
      if (!this.alive(generation)) return this.unavailable();
      if (!this.port.isTargetCurrent(target)) return this.stale();
      const revision = this.port.captureRevision();
      const layout = validateLayout(this.port.captureLayout());
      const backupReason = {
        addColumn: "before-add-column",
        addRow: "before-add-row",
        split: "before-split",
        collapse: "before-collapse"
      }[action];
      const snapshot = await this.port.createBackup(layout, backupReason);
      if (!this.alive(generation)) return this.unavailable();
      if (!this.port.isRevisionCurrent(revision) || !this.port.isTargetCurrent(target)) return this.stale();
      await this.port[action](target);
      const successMessage = {
        addColumn: "An empty full-height sidebar column was added.",
        addRow: "An empty full-width bottom sidebar row was added.",
        split: "An empty column was added beside this row.",
        collapse: "The sidebar column was collapsed."
      }[action];
      return result("success", successMessage, snapshot);
    });
  }
  restore(snapshot) {
    return this.exclusive(async (generation) => {
      if (!await this.port.checkCompatibility()) return result("blocked", "Restoration is unavailable for this Obsidian version or workspace structure.");
      if (!this.alive(generation)) return this.unavailable();
      const layout = validateLayout(await this.port.loadBackup(snapshot));
      if (!this.alive(generation)) return this.unavailable();
      if (!await this.port.confirmFullRestore(snapshot)) return result("cancelled", "The workspace was not restored.");
      if (!this.alive(generation)) return this.unavailable();
      if (!await this.consent(generation)) return this.alive(generation) ? result("cancelled", "The workspace was not restored.") : this.unavailable();
      if (!this.alive(generation)) return this.unavailable();
      const revision = this.port.captureRevision();
      const current = validateLayout(this.port.captureLayout());
      const beforeRestore = await this.port.createBackup(current, "pre-restore");
      if (!this.alive(generation)) return this.unavailable();
      if (!this.port.isRevisionCurrent(revision)) return this.stale();
      await this.port.applyFullLayout(layout);
      return result("success", "The full workspace layout was restored.", beforeRestore);
    });
  }
};

// src/main.ts
var TESTED_VERSION = "1.14.4";
var EXPLANATION = "Sidebar columns are experimental. Obsidian intentionally disabled this unsupported arrangement because themes and interactions were designed around single-column sidebars. Visual, resizing, focus and compatibility issues are possible. Updates may break the feature or saved layouts. A layout backup does not back up note contents or unsaved plugin input.";
var SidebarColumns = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { acknowledged: false, versionOverrides: [] });
    __publicField(this, "adapter");
    __publicField(this, "backups");
    __publicField(this, "operations");
    __publicField(this, "modals", /* @__PURE__ */ new Set());
    __publicField(this, "alive", false);
    __publicField(this, "lifecycle", 0);
    __publicField(this, "disposeAdapter");
    __publicField(this, "settingsTab");
  }
  async onload() {
    const generation = ++this.lifecycle;
    const data = await this.loadData();
    if (generation !== this.lifecycle) return;
    if (data && typeof data === "object") {
      const saved = data;
      this.settings = {
        acknowledged: saved.acknowledged === true,
        versionOverrides: Array.isArray(saved.versionOverrides) ? saved.versionOverrides.filter((version) => typeof version === "string" && /^\d+\.\d+\.\d+$/.test(version)) : []
      };
    }
    this.alive = true;
    this.adapter = new SidebarAdapter(this.app, (message2) => new import_obsidian2.Notice(message2));
    this.backups = new BackupStore(this.app.vault.adapter, this.app.vault.configDir, import_obsidian2.apiVersion, { pluginVersion: this.manifest.version });
    this.operations = new OperationService({
      checkCompatibility: () => this.checkCompatibility(),
      isTargetCurrent: (target) => this.adapter.isCurrent(target),
      isAcknowledged: () => this.settings.acknowledged,
      requestConsent: () => this.confirm("Enable experimental sidebar columns?", [
        EXPLANATION,
        "The first change requires a protected layout baseline and subsequent changes require recent snapshots. Snapshots remain local and may contain private file paths and plugin state.",
        "New columns and rows start empty. Existing panels are not cloned."
      ], "Enable experimental sidebar columns"),
      persistAcknowledgement: async () => {
        var _a;
        const previous = this.settings.acknowledged;
        this.settings.acknowledged = true;
        try {
          await this.saveData(this.settings);
        } catch (error) {
          this.settings.acknowledged = previous;
          throw error;
        }
        (_a = this.settingsTab) == null ? void 0 : _a.update();
      },
      captureLayout: () => validateLayout(this.app.workspace.getLayout()),
      captureRevision: () => JSON.stringify(this.app.workspace.getLayout()),
      isRevisionCurrent: (token) => token === JSON.stringify(this.app.workspace.getLayout()),
      createBackup: (layout, reason) => this.backups.create(layout, reason),
      loadBackup: (snapshot) => this.backups.load(snapshot),
      confirmFullRestore: (snapshot) => this.confirm("Restore the full workspace?", [
        "This replaces the central workspace, both sidebars and saved pop-out layouts with the selected snapshot. Current tabs and transient view state, including unsaved plugin input, may be discarded.",
        "A required pre-restore snapshot will be written first. This is not a note-content restore.",
        "Snapshot: " + snapshot.timestamp + " (" + snapshot.reason + "). Saved with Obsidian " + snapshot.appVersion + "."
      ], "Restore full workspace"),
      addColumn: (target) => this.adapter.addColumn(target),
      addRow: (target) => this.adapter.addFullWidthRowBelow(target),
      split: (target) => this.adapter.splitRight(target),
      collapse: (target) => this.adapter.collapse(target),
      applyFullLayout: (layout) => this.applyFullLayout(layout)
    });
    this.addCommand({ id: "add-column", name: "Add full-height sidebar column (experimental)", checkCallback: (checking) => {
      if (!checking) void this.command("addColumn");
      return this.alive;
    } });
    this.addCommand({ id: "add-row-below", name: "Add full-width bottom sidebar row (experimental)", checkCallback: (checking) => {
      if (!checking) void this.command("addRow");
      return this.alive;
    } });
    this.addCommand({ id: "split-right", name: "Split focused sidebar row right (experimental)", checkCallback: (checking) => {
      if (!checking) void this.command("split");
      return this.alive;
    } });
    this.addCommand({ id: "collapse-column", name: "Collapse focused sidebar column (experimental)", checkCallback: (checking) => {
      if (!checking) void this.command("collapse");
      return this.alive;
    } });
    this.addCommand({ id: "expand-all-columns", name: "Expand all columns", callback: () => this.adapter.expandAll() });
    this.addCommand({ id: "restore-workspace", name: "Restore full workspace from a layout backup", callback: () => {
      void this.openRestorePicker();
    } });
    this.settingsTab = new SidebarSettings(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.app.workspace.onLayoutReady(() => {
      if (!this.alive) return;
      try {
        this.disposeAdapter = this.adapter.install({
          addColumn: (target) => {
            void this.report(this.operations.addColumn(target));
          },
          addRow: (target) => {
            void this.report(this.operations.addRow(target));
          },
          split: (target) => {
            void this.report(this.operations.split(target));
          },
          collapse: (target) => {
            void this.report(this.operations.collapse(target));
          }
        });
      } catch (error) {
        new import_obsidian2.Notice("Sidebar Columns is unavailable: " + errorMessage(error), 12e3);
      }
    });
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      if (this.alive) this.adapter.onLayoutChange();
    }));
  }
  onunload() {
    var _a, _b, _c;
    this.lifecycle++;
    this.alive = false;
    this.settingsTab = void 0;
    (_a = this.operations) == null ? void 0 : _a.dispose();
    for (const modal of [...this.modals]) modal.close();
    this.modals.clear();
    (_b = this.disposeAdapter) == null ? void 0 : _b.call(this);
    (_c = this.adapter) == null ? void 0 : _c.expandAll();
  }
  async command(kind) {
    try {
      const target = this.adapter.resolveCommandTarget();
      if (kind === "split" && this.adapter.nativeSplitAvailable(target)) {
        new import_obsidian2.Notice("Obsidian provides native sidebar splitting here. Use its built-in split action.");
        return;
      }
      await this.report(this.operations[kind](target));
    } catch (error) {
      new import_obsidian2.Notice(errorMessage(error), 8e3);
    }
  }
  async report(pending) {
    try {
      const result2 = await pending;
      if (this.alive && result2.status !== "cancelled") new import_obsidian2.Notice(result2.message, result2.status === "success" ? 4e3 : 1e4);
    } catch (error) {
      if (this.alive) new import_obsidian2.Notice(errorMessage(error), 1e4);
    }
  }
  async checkCompatibility() {
    var _a;
    if (!this.alive) return false;
    this.adapter.assertCompatible();
    if (import_obsidian2.apiVersion === TESTED_VERSION || this.settings.versionOverrides.includes(import_obsidian2.apiVersion)) return true;
    if (!/^\d+\.\d+\.\d+$/.test(import_obsidian2.apiVersion)) throw new Error("Cannot identify this Obsidian version. Leave the workspace unchanged and check for a compatible Sidebar Columns update.");
    const accepted = await this.confirm("Untested Obsidian version", [
      "Sidebar Columns has an initial compatibility baseline of Obsidian " + TESTED_VERSION + ". You are running " + import_obsidian2.apiVersion + ".",
      "The plugin uses guarded undocumented menu and layout internals. Structural checks cannot prove visual or runtime compatibility. Check for native sidebar columns before overriding.",
      "This override applies only to " + import_obsidian2.apiVersion + "; required backups and all structural guards remain in force."
    ], "Allow experimental use on " + import_obsidian2.apiVersion);
    if (!accepted || !this.alive) return false;
    const previous = [...this.settings.versionOverrides];
    this.settings.versionOverrides.push(import_obsidian2.apiVersion);
    try {
      await this.saveData(this.settings);
    } catch (error) {
      this.settings.versionOverrides = previous;
      throw error;
    }
    (_a = this.settingsTab) == null ? void 0 : _a.update();
    return true;
  }
  async openRestorePicker() {
    if (!this.alive) return;
    try {
      const snapshots = await this.backups.list();
      if (!this.alive) return;
      if (!snapshots.length) {
        new import_obsidian2.Notice("No valid layout backups are available.");
        return;
      }
      const picker = new BackupPicker(this.app, snapshots, (snapshot) => {
        void this.report(this.operations.restore(snapshot));
      }, (modal) => this.modals.delete(modal));
      this.modals.add(picker);
      picker.open();
    } catch (error) {
      if (this.alive) new import_obsidian2.Notice("Cannot read layout backups: " + errorMessage(error), 1e4);
    }
  }
  confirm(title, paragraphs, acceptLabel) {
    if (!this.alive) return Promise.resolve(false);
    return new Promise((resolve) => {
      const modal = new ChoiceModal(this.app, title, paragraphs, acceptLabel, (answer) => {
        this.modals.delete(modal);
        resolve(answer && this.alive);
      });
      this.modals.add(modal);
      modal.open();
    });
  }
  async applyFullLayout(layout) {
    this.adapter.expandAll();
    await this.app.workspace.changeLayout(layout);
    validateLayout(this.app.workspace.getLayout());
    this.app.workspace.requestSaveLayout();
  }
  async clearOverrides() {
    var _a;
    const previous = [...this.settings.versionOverrides];
    this.settings.versionOverrides = [];
    try {
      await this.saveData(this.settings);
    } catch (error) {
      this.settings.versionOverrides = previous;
      throw error;
    }
    (_a = this.settingsTab) == null ? void 0 : _a.update();
  }
};
function errorMessage(error) {
  return error instanceof Error ? error.message : "The operation failed. Your layout has not been automatically restored.";
}
var ChoiceModal = class extends import_obsidian2.Modal {
  constructor(app, title, paragraphs, acceptLabel, complete) {
    super(app);
    this.title = title;
    this.paragraphs = paragraphs;
    this.acceptLabel = acceptLabel;
    this.complete = complete;
    __publicField(this, "answer", false);
    __publicField(this, "settled", false);
  }
  onOpen() {
    this.setTitle(this.title);
    for (const paragraph of this.paragraphs) this.contentEl.createEl("p", { text: paragraph });
    const buttons = new import_obsidian2.Setting(this.contentEl);
    buttons.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
    buttons.addButton((button) => button.setButtonText(this.acceptLabel).setCta().onClick(() => {
      this.answer = true;
      this.close();
    }));
  }
  onClose() {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.complete(this.answer);
    }
  }
};
var BackupPicker = class extends import_obsidian2.SuggestModal {
  constructor(app, snapshots, choose, closed) {
    super(app);
    this.snapshots = snapshots;
    this.choose = choose;
    this.closed = closed;
    this.setPlaceholder("Choose a full-workspace layout backup");
  }
  getSuggestions(query) {
    return this.snapshots.filter((snapshot) => this.label(snapshot).toLowerCase().includes(query.toLowerCase()));
  }
  renderSuggestion(snapshot, element) {
    element.setText(this.label(snapshot));
  }
  onChooseSuggestion(snapshot) {
    this.choose(snapshot);
  }
  onClose() {
    this.closed(this);
  }
  label(snapshot) {
    return (snapshot.baseline ? "Protected baseline \xB7 " : "") + snapshot.timestamp + " \xB7 " + snapshot.reason;
  }
};
var SidebarSettings = class extends import_obsidian2.PluginSettingTab {
  constructor(app, owner) {
    super(app, owner);
    this.owner = owner;
  }
  getSettingDefinitions() {
    return [{
      type: "group",
      heading: "Sidebar columns",
      items: [
        {
          name: "Experimental sidebar columns",
          desc: EXPLANATION + " Full-width rows below existing columns can form a T-shaped sidebar.",
          aliases: ["warning", "unsupported layouts", "visual risks"]
        },
        {
          name: "Compatibility and consent",
          desc: "Initial compatibility baseline: " + TESTED_VERSION + ". Current version: " + import_obsidian2.apiVersion + ". Experimental acknowledgement: " + (this.owner.settings.acknowledged ? "saved" : "required before the first change") + ".",
          aliases: ["Obsidian version", "experimental acknowledgement"]
        },
        {
          name: "Session-only column collapse",
          desc: "Each native column can fold into a 32px expand rail. Tabs stay loaded. Restarting, native drag/resizing, workspace replacement or disabling the plugin expands folded columns.",
          aliases: ["expand all columns", "fold", "rail"],
          render: (setting) => {
            setting.addButton((button) => button.setButtonText("Expand all columns").onClick(() => this.owner.adapter.expandAll()));
          }
        },
        {
          name: "Layout backups",
          desc: "Protected baseline and five recent snapshots in " + this.app.vault.configDir + "/sidebar-columns-backups/. Raw .workspace.json files are suitable for documented manual recovery; .metadata.json files are not. Restoring replaces the full workspace and requires confirmation.",
          aliases: ["restore full workspace", "recovery", "snapshots"],
          render: (setting) => {
            setting.addButton((button) => button.setButtonText("Restore full workspace...").onClick(() => {
              void this.owner.openRestorePicker();
            }));
          }
        },
        {
          name: "Untested-version overrides",
          desc: this.owner.settings.versionOverrides.length ? this.owner.settings.versionOverrides.join(", ") : "None. Untested versions require an explicit per-version choice.",
          aliases: ["compatibility", "clear overrides"],
          render: (setting) => {
            setting.addButton((button) => button.setButtonText("Clear overrides").onClick(() => {
              void this.owner.clearOverrides().catch((error) => new import_obsidian2.Notice(errorMessage(error)));
            }));
          }
        },
        {
          name: "Plugin removal and recovery",
          desc: "Removing the plugin and reversing its native columns are separate actions. Existing columns can remain after removal. Backups contain layout information, not copies of notes."
        },
        {
          name: "Why sidebar splitting is experimental",
          desc: "Historical explanation of the deliberately disabled feature.",
          aliases: ["unsupported layouts", "Obsidian developer reasoning"],
          render: (setting) => {
            setting.descEl.createEl("a", { text: "Read the developer's explanation", href: "https://forum.obsidian.md/t/unable-to-perform-split-right-in-a-left-leaf/84130/4" });
          }
        }
      ]
    }];
  }
};

/* nosourcemap */