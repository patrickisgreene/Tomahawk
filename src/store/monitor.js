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

    activeStreamTab: "access", // access | traffic
    statusBars: statusBarsData(),

    // ---- inspector / history ----
    inspectorTab: "inspector", // inspector | history
    history: [], // [{ id, time, status, method, path, viewedAt }], newest first

    // ---- sources tree ----
    tree: sourcesTree(),
    hostFilter: "",

    // ---- top talkers ----
    talkerKind: "clients",
    talkersData,

    // ---- error log / bottom dock ----
    errors: seedErrors,
    activeBottomTab: "query", // errlog | query | alerts

    bufferedBase: 12400,

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
      return new Set(["sources", "talkers", state.activeStreamTab, state.activeBottomTab, state.inspectorTab]);
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
    setStreamTab(tab) {
      this.activeStreamTab = tab;
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
    setInspectorTab(tab) {
      this.inspectorTab = tab;
    },
    clearHistory() {
      this.history = [];
    },
    reopenHistoryEntry(id) {
      if (this.tailRows.some((r) => r.id === id)) {
        this.selectRow(id);
        this.inspectorTab = "inspector";
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

    // ---- bottom dock ----
    setBottomTab(tab) {
      this.activeBottomTab = tab;
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
    // Our docks are a fixed layout (no real drag-resize yet — see the
    // design brief's own "keep it a mockup" fallback), so "adding" a panel
    // can only mean switching to it where the clicked dock already has a
    // tab for it. Anything else just closes the popover.
    choosePanelFromPicker(itemId) {
      const dockId = this.panelPicker?.dockId;
      if (dockId === "stream" && (itemId === "access" || itemId === "traffic")) {
        this.activeStreamTab = itemId;
      } else if (dockId === "bottom" && (itemId === "errlog" || itemId === "query" || itemId === "alerts")) {
        this.activeBottomTab = itemId;
      } else if (dockId === "inspector" && (itemId === "inspector" || itemId === "history")) {
        this.inspectorTab = itemId;
      }
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
