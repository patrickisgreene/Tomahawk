import { defineStore } from "pinia";
import {
  seedTailRows, seedErrors, talkersData, sourcesTree,
  hostsData, dayBarsData, topPagesData, topAgentsData, alertRules,
  panelCatalog, fileBrowserFS, sftpBrowserFS, statusBarsData,
} from "../data/mock";
import { createLogSource } from "../data/logSource";

const MAX_ROWS = 400;
const MAX_HISTORY = 60;

export const useMonitorStore = defineStore("monitor", {
  state: () => ({
    // ---- top-level navigation ----
    // "Explore" has no design yet (turn 1-7 never covered it) — ExplorePage.vue
    // says so honestly rather than faking a page for it.
    currentPage: "monitor", // monitor | explore | reports | alerts | hosts

    // ---- access log / resync ----
    tailRows: seedTailRows(),
    selectedRowId: null,
    tailFilterText: "",
    tailSortDesc: true, // newest first, matches the design's default caret
    resyncIntervalMs: 30000,
    lastSyncedAt: Date.now(),
    _source: null,
    _resyncTimer: null,

    statusBars: statusBarsData(),

    // ---- inspector / history ----
    history: [], // [{ id, time, status, method, path, viewedAt }], newest first

    // ---- sources tree ----
    tree: sourcesTree(),
    hostFilter: "",

    // ---- top talkers ----
    talkerKind: "clients",
    talkersData,

    // ---- error log / bottom dock ----
    errors: seedErrors,

    bufferedBase: 12400,

    // ---- docks: which panels are open where, and which is focused ----
    dockTabs: {
      stream: ["access", "traffic"],
      bottom: ["errlog", "query", "alerts"],
      inspector: ["inspector", "history"],
      sources: ["sources"],
      talkers: ["talkers"],
      throughput: ["throughput"],
      mix: ["mix"],
    },
    dockActiveTab: {
      stream: "access",
      bottom: "query",
      inspector: "inspector",
      sources: "sources",
      talkers: "talkers",
      throughput: "throughput",
      mix: "mix",
    },

    // ---- add source dialog (t2) ----
    showAddSourceDialog: false,
    addSourceTab: "file", // file | directory | sftp
    addSourcePath: ["Home", "var", "log", "httpd"],
    addSourceSelected: "access.log",
    sftpPath: ["", "var", "log", "httpd"],
    sftpSelected: "httpd-access.log",
    sftpConnected: true,

    // ---- settings dialog (t5b) ----
    showSettingsDialog: false,
    settingsSection: "general",

    // ---- file menu dropdown (t5a) ----
    showFileMenu: false,

    // ---- panel picker popover (t3) ----
    panelPicker: null, // { dockId, anchor: {x,y,width,height}, query: "" } | null

    // ---- global search palette (t7) ----
    showGlobalSearch: false,
    globalSearchQuery: "",

    // ---- static reference data for the new pages ----
    hosts: hostsData,
    dayBars: dayBarsData,
    topPages: topPagesData,
    topAgents: topAgentsData,
    alertRules,
    selectedAlertId: alertRules[0]?.id ?? null,
    panelCatalog,
  }),

  getters: {
    selectedRow(state) {
      return state.tailRows.find((r) => r.id === state.selectedRowId) || null;
    },
    filteredTailRows(state) {
      const q = state.tailFilterText.trim().toLowerCase();
      const rows = !q
        ? state.tailRows
        : state.tailRows.filter((r) => `${r.path} ${r.status} ${r.method}`.toLowerCase().includes(q));
      return state.tailSortDesc ? rows.slice().reverse() : rows;
    },
    bufferedCount(state) {
      const n = state.bufferedBase + state.tailRows.length;
      return (n / 1000).toFixed(1) + "k";
    },
    selectedAlert(state) {
      return state.alertRules.find((a) => a.id === state.selectedAlertId) || null;
    },
    addSourceListing(state) {
      return fileBrowserFS[state.addSourcePath.join("/")] || [];
    },
    sftpListing(state) {
      return sftpBrowserFS[state.sftpPath.join("/")] || [];
    },
    openPanelIds(state) {
      return new Set(Object.values(state.dockTabs).flat());
    },
    filteredPanelCatalog(state) {
      const q = (state.panelPicker?.query || "").trim().toLowerCase();
      if (!q) return state.panelCatalog;
      return state.panelCatalog
        .map((g) => ({ ...g, items: g.items.filter((it) => it.name.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q)) }))
        .filter((g) => g.items.length);
    },
  },

  actions: {
    setPage(page) {
      this.currentPage = page;
    },

    // ---- access log / resync ----
    selectRow(id) {
      this.selectedRowId = id;
      const r = this.tailRows.find((x) => x.id === id);
      if (!r) return;
      this.history = this.history.filter((h) => h.id !== id);
      this.history.unshift({ id: r.id, time: r.time, status: r.status, method: r.method, path: r.path, viewedAt: Date.now() });
      if (this.history.length > MAX_HISTORY) this.history.length = MAX_HISTORY;
    },
    toggleSort() {
      this.tailSortDesc = !this.tailSortDesc;
    },
    setTailFilter(text) {
      this.tailFilterText = text;
    },
    _ensureSource() {
      if (!this._source) this._source = createLogSource();
      return this._source;
    },
    _pull() {
      const rows = this._ensureSource().pull();
      this.tailRows.push(...rows);
      if (this.tailRows.length > MAX_ROWS) this.tailRows.splice(0, this.tailRows.length - MAX_ROWS);
      this.lastSyncedAt = Date.now();
      this.statusBars = statusBarsData();
    },
    // The manual "Resync" button: pulls immediately and restarts the
    // auto-resync clock, so it isn't immediately followed by an auto one
    // a moment later.
    resyncNow() {
      this._pull();
      if (this._resyncTimer) this.startAutoResync();
    },
    setResyncInterval(ms) {
      this.resyncIntervalMs = ms;
      if (this._resyncTimer) this.startAutoResync();
    },
    startAutoResync() {
      if (this._resyncTimer) clearInterval(this._resyncTimer);
      this._resyncTimer = setInterval(() => this._pull(), this.resyncIntervalMs);
    },
    stopAutoResync() {
      if (this._resyncTimer) clearInterval(this._resyncTimer);
      this._resyncTimer = null;
    },

    // ---- inspector / history ----
    clearHistory() {
      this.history = [];
    },
    reopenHistoryEntry(id) {
      if (this.tailRows.some((r) => r.id === id)) {
        this.selectRow(id);
        this.openPanel("inspector", "inspector");
      }
    },

    // ---- sources tree ----
    setHostFilter(text) {
      this.hostFilter = text;
    },
    toggleTreeNode(node) {
      if (node.children) node.expanded = !node.expanded;
    },
    selectSourceFile(tree, target) {
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.kind === "file") n.selected = n === target;
          if (n.children) walk(n.children);
        }
      };
      walk(tree);
    },

    // ---- top talkers ----
    setTalkerKind(kind) {
      this.talkerKind = kind;
    },

    // ---- add source dialog ----
    openAddSourceDialog() {
      this.showAddSourceDialog = true;
      this.showFileMenu = false;
    },
    closeAddSourceDialog() {
      this.showAddSourceDialog = false;
    },
    setAddSourceTab(tab) {
      this.addSourceTab = tab;
    },
    openAddSourceFolder(name) {
      this.addSourcePath = [...this.addSourcePath, name];
    },
    goToAddSourceCrumb(index) {
      this.addSourcePath = this.addSourcePath.slice(0, index + 1);
    },
    selectAddSourceFile(name) {
      this.addSourceSelected = name;
    },
    openSftpFolder(name) {
      this.sftpPath = [...this.sftpPath, name];
    },
    goToSftpCrumb(index) {
      this.sftpPath = this.sftpPath.slice(0, index + 1);
    },
    selectSftpFile(name) {
      this.sftpSelected = name;
    },
    confirmAddSource() {
      // No real filesystem/SFTP backend yet — closing the dialog is the
      // honest stopping point until src/data/logSource.js grows a real
      // implementation to hand this path to.
      this.showAddSourceDialog = false;
    },

    // ---- settings dialog ----
    openSettingsDialog() {
      this.showSettingsDialog = true;
      this.showFileMenu = false;
    },
    closeSettingsDialog() {
      this.showSettingsDialog = false;
    },
    setSettingsSection(section) {
      this.settingsSection = section;
    },

    // ---- file menu ----
    toggleFileMenu() {
      this.showFileMenu = !this.showFileMenu;
    },
    closeFileMenu() {
      this.showFileMenu = false;
    },

    // ---- docks: open tabs per dock ----
    // Switch which already-open tab is focused in a dock.
    setDockTab(dockId, tabId) {
      if (this.dockTabs[dockId]?.includes(tabId)) this.dockActiveTab[dockId] = tabId;
    },
    // Open a panel in a dock, focusing it. A panel only ever lives in one
    // dock at a time, so opening it somewhere new moves it out of wherever
    // it was open before (matching the "already open" hint in the picker).
    openPanel(dockId, panelId) {
      for (const [d, ids] of Object.entries(this.dockTabs)) {
        const idx = ids.indexOf(panelId);
        if (idx === -1) continue;
        if (d === dockId) return void (this.dockActiveTab[dockId] = panelId);
        ids.splice(idx, 1);
        if (this.dockActiveTab[d] === panelId) this.dockActiveTab[d] = ids[ids.length - 1] ?? null;
      }
      if (!this.dockTabs[dockId]) this.dockTabs[dockId] = [];
      this.dockTabs[dockId].push(panelId);
      this.dockActiveTab[dockId] = panelId;
    },
    // Close a tab. If it was the focused one, focus its neighbor instead.
    closeDockTab(dockId, panelId) {
      const ids = this.dockTabs[dockId];
      if (!ids) return;
      const idx = ids.indexOf(panelId);
      if (idx === -1) return;
      ids.splice(idx, 1);
      if (this.dockActiveTab[dockId] === panelId) {
        this.dockActiveTab[dockId] = ids[Math.max(0, idx - 1)] ?? null;
      }
    },

    // ---- panel picker ----
    openPanelPicker(dockId, anchor) {
      this.panelPicker = { dockId, anchor, query: "" };
    },
    closePanelPicker() {
      this.panelPicker = null;
    },
    setPanelPickerQuery(q) {
      if (this.panelPicker) this.panelPicker.query = q;
    },
    choosePanelFromPicker(itemId) {
      if (this.panelPicker) this.openPanel(this.panelPicker.dockId, itemId);
      this.closePanelPicker();
    },

    // ---- global search ----
    openGlobalSearch() {
      this.showGlobalSearch = true;
      this.globalSearchQuery = "";
    },
    closeGlobalSearch() {
      this.showGlobalSearch = false;
    },
    setGlobalSearchQuery(q) {
      this.globalSearchQuery = q;
    },

    // ---- alerts page ----
    selectAlert(id) {
      this.selectedAlertId = id;
    },
  },
});
