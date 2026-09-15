import { defineStore } from "pinia";
import {
  seedTailRows, seedErrors,
  hostsData, dayBarsData, topPagesData, topAgentsData, alertRules,
  panelCatalog, sftpBrowserFS, statusBarsData,
} from "../data/mock";
import { createLogSource, isTauri, loadRecentRows } from "../data/logSource";
import { listLocalDir, addSource as addSourceApi, removeSource as removeSourceApi, listSources, listQueryFields } from "../data/sourcesApi";
import { geoipStatus, lookupGeoip } from "../data/geoipApi";

const MAX_ROWS = 400;
const MAX_HISTORY = 60;
const SAVED_QUERIES_KEY = "tomahawk.savedQueries";
const QUERY_FIELDS = [
  { id: "time", label: "time", type: "text" },
  { id: "ts", label: "ts", type: "number" },
  { id: "ip", label: "ip", type: "text" },
  { id: "method", label: "method", type: "text" },
  { id: "status", label: "status", type: "number" },
  { id: "path", label: "path", type: "text" },
  { id: "bytes", label: "bytes", type: "number" },
  { id: "ms", label: "ms", type: "number" },
  { id: "referer", label: "referer", type: "text" },
  { id: "userAgent", label: "user_agent", type: "text" },
  { id: "raw", label: "raw", type: "text" },
];
const QUERY_OPERATORS = [
  { id: "contains", label: "contains", types: ["text"] },
  { id: "matches", label: "matches", types: ["text"] },
  { id: "=", label: "=", types: ["text", "number"] },
  { id: "!=", label: "!=", types: ["text", "number"] },
  { id: ">", label: ">", types: ["number"] },
  { id: ">=", label: ">=", types: ["number"] },
  { id: "<", label: "<", types: ["number"] },
  { id: "<=", label: "<=", types: ["number"] },
];

function loadSavedQueries() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_QUERIES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedQueries(queries) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_QUERIES_KEY, JSON.stringify(queries));
}

function defaultQueryCondition() {
  return { id: `cond_${Date.now()}_${Math.random().toString(16).slice(2)}`, field: "status", operator: ">=", value: "400" };
}

function querySummary(conditions) {
  return conditions.map((c) => `${c.field} ${c.operator} ${c.value}`.trim()).join(" and ");
}

function conditionMatches(row, condition, fields = QUERY_FIELDS) {
  const field = fields.find((f) => f.id === condition.field);
  if (!field) return true;
  const actual = row[condition.field];
  const expected = condition.value;
  if (expected == null || String(expected).trim() === "") return true;
  if (field.type === "number") {
    const left = Number(actual);
    const right = Number(expected);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (condition.operator === "=") return left === right;
    if (condition.operator === "!=") return left !== right;
    if (condition.operator === ">") return left > right;
    if (condition.operator === ">=") return left >= right;
    if (condition.operator === "<") return left < right;
    if (condition.operator === "<=") return left <= right;
    return false;
  }
  const left = String(actual ?? "").toLowerCase();
  const right = String(expected).toLowerCase();
  if (condition.operator === "contains") return left.includes(right);
  if (condition.operator === "matches") {
    try {
      return new RegExp(expected, "i").test(String(actual ?? ""));
    } catch {
      return false;
    }
  }
  if (condition.operator === "=") return left === right;
  if (condition.operator === "!=") return left !== right;
  return false;
}

export const useMonitorStore = defineStore("monitor", {
  state: () => ({
    // ---- top-level navigation ----
    // "Explore" has no design yet (turn 1-7 never covered it) — ExplorePage.vue
    // says so honestly rather than faking a page for it.
    currentPage: "monitor", // monitor | explore | reports | alerts | hosts

    // ---- access log / resync ----
    // Real sources start with an empty tail — filled in by the first
    // resync — rather than the demo rows, which are only useful in a
    // plain browser dev preview with no real source registered yet.
    tailRows: isTauri() ? [] : seedTailRows(),
    tailLoading: false,
    selectedRowId: null,
    tailFilterText: "",
    tailSortDesc: true, // newest first, matches the design's default caret
    resyncIntervalMs: 30000,
    lastSyncedAt: Date.now(),
    isSyncing: false,
    syncProgress: null, // { completed, total } | null — only set during a real per-source sync
    _source: null,
    _resyncTimer: null,

    statusBars: statusBarsData(),

    // ---- inspector / history ----
    history: [], // [{ id, time, status, method, path, viewedAt }], newest first

    // ---- sources tree ----
    hostFilter: "",
    expandedSourceIds: [], // presentation-only; the backend response carries no expand state

    // ---- top talkers ----
    talkerKind: "clients",

    // ---- error log / bottom dock ----
    errors: seedErrors,
    queryConditions: [defaultQueryCondition()],
    queryName: "",
    queryFieldList: QUERY_FIELDS,
    savedQueries: loadSavedQueries(),
    savedQueryFilter: "",
    activeSavedQueryId: null,
    geoip: {
      status: null,
      byIp: {},
      loadingIps: [],
    },

    bufferedBase: 12400,

    // ---- docks: which panels are open where, and which is focused ----
    dockTabs: {
      stream: ["access", "traffic"],
      bottom: ["errlog", "query", "alerts"],
      inspector: ["inspector", "history"],
      sources: ["sources", "saved"],
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

    // ---- registered log sources (real, once running in Tauri) ----
    sources: [],

    // ---- add source dialog (t2) ----
    showAddSourceDialog: false,
    addSourceTab: "file", // file | directory | sftp
    addSourceRealPath: null, // absolute path currently browsed; null until first loaded
    addSourceListing: [],
    addSourceLoading: false,
    addSourceSelected: null,
    addSourceFilterText: "",
    addSourceHideHidden: true,
    addSourcePattern: "access.log*", // directory kind only
    addSourceIncludeSubfolders: false, // directory kind only
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
      const queried = rows.filter((r) => state.queryConditions.every((c) => conditionMatches(r, c, state.queryFieldList)));
      return state.tailSortDesc ? queried.slice().reverse() : queried;
    },
    queryTotalRows(state) {
      return state.tailRows.length;
    },
    queryMatchedRows(state) {
      return state.tailRows.filter((r) => state.queryConditions.every((c) => conditionMatches(r, c, state.queryFieldList))).length;
    },
    queryFields() {
      return this.queryFieldList;
    },
    queryOperators() {
      return QUERY_OPERATORS;
    },
    filteredSavedQueries(state) {
      const q = state.savedQueryFilter.trim().toLowerCase();
      if (!q) return state.savedQueries;
      return state.savedQueries.filter((saved) => {
        const haystack = `${saved.name || ""} ${querySummary(saved.conditions || [])}`.toLowerCase();
        return haystack.includes(q);
      });
    },
    bufferedCount(state) {
      const n = state.bufferedBase + state.tailRows.length;
      return (n / 1000).toFixed(1) + "k";
    },
    // "Current" throughput, derived from the recent tail window (real,
    // already-ingested rows) rather than a lifetime average — a recent
    // window is the right basis for a "current rate" gauge.
    throughputStats(state) {
      const rows = state.tailRows;
      const N = 21;
      if (rows.length < 2) {
        return { current: 0, avg: 0, min: 0, max: 0, errorPct: 0, spark: Array(N).fill(0), errorSpark: Array(N).fill(0) };
      }
      const first = rows[0].ts;
      const last = rows[rows.length - 1].ts;
      const spanSec = Math.max(1, (last - first) / 1000);
      const bucketSpanSec = spanSec / N;
      const buckets = Array(N).fill(0);
      const errBuckets = Array(N).fill(0);
      for (const r of rows) {
        let idx = Math.floor(((r.ts - first) / (last - first)) * N);
        idx = Math.max(0, Math.min(N - 1, idx));
        buckets[idx]++;
        if (r.status >= 500) errBuckets[idx]++;
      }
      const spark = buckets.map((c) => c / bucketSpanSec);
      const errorSpark = errBuckets.map((c) => c / bucketSpanSec);
      const errorCount = rows.filter((r) => r.status >= 500).length;
      return {
        current: spark[spark.length - 1],
        avg: spark.reduce((a, b) => a + b, 0) / spark.length,
        min: Math.min(...spark),
        max: Math.max(...spark),
        errorPct: (errorCount / rows.length) * 100,
        spark,
        errorSpark,
      };
    },
    statusMixStats(state) {
      const rows = state.tailRows;
      const counts = { c2: 0, c3: 0, c4: 0, c5: 0 };
      const msValues = [];
      for (const r of rows) {
        if (r.status >= 500) counts.c5++;
        else if (r.status >= 400) counts.c4++;
        else if (r.status >= 300) counts.c3++;
        else counts.c2++;
        if (r.ms != null) msValues.push(r.ms);
      }
      const total = rows.length;
      const pct = (n) => (total ? (n / total) * 100 : 0);
      const spanSec = total > 1 ? Math.max(1, (rows[total - 1].ts - rows[0].ts) / 1000) : 1;
      const rate = (n) => n / spanSec;
      let p95 = null;
      if (msValues.length) {
        const sorted = [...msValues].sort((a, b) => a - b);
        p95 = sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
      }
      return {
        total,
        spanSec,
        p95,
        c2: { count: counts.c2, pct: pct(counts.c2), rate: rate(counts.c2) },
        c3: { count: counts.c3, pct: pct(counts.c3), rate: rate(counts.c3) },
        c4: { count: counts.c4, pct: pct(counts.c4), rate: rate(counts.c4) },
        c5: { count: counts.c5, pct: pct(counts.c5), rate: rate(counts.c5) },
      };
    },
    // Ranked clients/paths/agents/referrers over the same recent-activity
    // window as throughputStats/statusMixStats — real counts from tailRows.
    topTalkers(state) {
      const rows = state.tailRows;
      function rank(keyFn) {
        const counts = new Map();
        for (const r of rows) {
          const key = keyFn(r);
          if (!key) continue;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
        const max = sorted[0]?.[1] || 1;
        return sorted.map(([label, n]) => ({
          label,
          n: n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n),
          w: Math.round((n / max) * 100) + "%",
        }));
      }
      return {
        clients: rank((r) => r.ip),
        paths: rank((r) => r.path),
        agents: rank((r) => r.userAgent),
        referrers: rank((r) => (r.referer && r.referer !== "-" ? r.referer : null)),
      };
    },
    selectedAlert(state) {
      return state.alertRules.find((a) => a.id === state.selectedAlertId) || null;
    },
    sftpListing(state) {
      return sftpBrowserFS[state.sftpPath.join("/")] || [];
    },
    filteredSources(state) {
      const q = state.hostFilter.trim().toLowerCase();
      if (!q) return state.sources;
      return state.sources.filter((s) => `${s.label} ${s.path}`.toLowerCase().includes(q));
    },
    filteredAddSourceListing(state) {
      const q = state.addSourceFilterText.trim().toLowerCase();
      return state.addSourceListing.filter((entry) => {
        if (state.addSourceHideHidden && entry.name.startsWith(".")) return false;
        if (!q) return true;
        return entry.name.toLowerCase().includes(q);
      });
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
    // Loads whatever's already ingested from a previous session, so the
    // tail view isn't stuck empty after a restart — pull_new_rows only
    // ever reports bytes read since the last call, which is nothing once
    // a file's tailing cursor is already caught up. Call once on mount,
    // before the resync loop takes over incrementally.
    async hydrateTailRows() {
      this.tailLoading = true;
      try {
        this.tailRows = await loadRecentRows(MAX_ROWS);
      } finally {
        this.tailLoading = false;
      }
    },
    async refreshSourceData() {
      await this.loadSources();
      this.tailRows = await loadRecentRows(MAX_ROWS);
      if (this.selectedRowId && !this.tailRows.some((r) => r.id === this.selectedRowId)) {
        this.selectedRowId = null;
      }
      this.history = this.history.filter((h) => this.tailRows.some((r) => r.id === h.id));
    },
    // Pulls per source, sequentially, rather than one bulk call across every
    // source — that's what makes real per-source sync progress
    // possible instead of just an opaque "please wait".
    async _pull() {
      this.isSyncing = true;
      try {
        const source = this._ensureSource();
        await this.loadSources(); // fresh source list before deciding how to sync
        const ids = this.sources.map((s) => s.id);
        if (!ids.length) {
          const rows = await source.pull();
          this.tailRows.push(...rows);
        } else {
          this.syncProgress = { total: ids.length, completed: 0 };
          for (const id of ids) {
            const rows = await source.pull(id);
            this.tailRows.push(...rows);
            this.syncProgress.completed++;
          }
          await this.loadSources(); // refresh row counts now that ingestion finished
        }
        if (this.tailRows.length > MAX_ROWS) this.tailRows.splice(0, this.tailRows.length - MAX_ROWS);
        this.lastSyncedAt = Date.now();
        this.statusBars = statusBarsData();
      } finally {
        this.isSyncing = false;
        this.syncProgress = null;
      }
    },
    // The manual "Resync" button: pulls immediately and restarts the
    // auto-resync clock, so it isn't immediately followed by an auto one
    // a moment later.
    async resyncNow() {
      // startAutoResync() already pulls immediately before rescheduling, so
      // only call _pull() directly when there's no running clock to restart.
      if (this._resyncTimer) this.startAutoResync();
      else await this._pull();
    },
    setResyncInterval(ms) {
      this.resyncIntervalMs = ms;
      if (this._resyncTimer) this.startAutoResync();
    },
    startAutoResync() {
      if (this._resyncTimer) clearInterval(this._resyncTimer);
      const tick = () => this._pull().catch((e) => console.error("[resync]", e));
      tick(); // don't make the user wait a full interval for the first load
      this._resyncTimer = setInterval(tick, this.resyncIntervalMs);
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
    toggleSourceExpanded(id) {
      const i = this.expandedSourceIds.indexOf(id);
      if (i === -1) this.expandedSourceIds.push(id);
      else this.expandedSourceIds.splice(i, 1);
    },
    async removeSource(id) {
      await removeSourceApi(id);
      await this.refreshSourceData();
      this.expandedSourceIds = this.expandedSourceIds.filter((x) => x !== id);
    },

    // ---- top talkers ----
    setTalkerKind(kind) {
      this.talkerKind = kind;
    },

    // ---- query builder ----
    operatorsForField(fieldId) {
      const field = this.queryFieldList.find((f) => f.id === fieldId) || QUERY_FIELDS[0];
      return QUERY_OPERATORS.filter((op) => op.types.includes(field.type));
    },
    async loadQueryFields() {
      const fields = await listQueryFields();
      if (fields.length) {
        this.queryFieldList = fields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.fieldType,
        }));
      }
    },
    addQueryCondition() {
      this.queryConditions.push(defaultQueryCondition());
    },
    removeQueryCondition(id) {
      this.queryConditions = this.queryConditions.filter((c) => c.id !== id);
      if (!this.queryConditions.length) this.addQueryCondition();
    },
    updateQueryCondition(id, patch) {
      const condition = this.queryConditions.find((c) => c.id === id);
      if (!condition) return;
      Object.assign(condition, patch);
      if (patch.field) {
        const allowed = this.operatorsForField(condition.field);
        if (!allowed.some((op) => op.id === condition.operator)) {
          condition.operator = allowed[0]?.id || "=";
        }
      }
    },
    setQueryName(name) {
      this.queryName = name;
    },
    setSavedQueryFilter(text) {
      this.savedQueryFilter = text;
    },
    savedQueryLabel(query) {
      return query.name || querySummary(query.conditions || []) || "Untitled query";
    },
    savedQuerySummary(query) {
      return querySummary(query.conditions || []);
    },
    newQuery() {
      this.activeSavedQueryId = null;
      this.queryName = "";
      this.queryConditions = [defaultQueryCondition()];
    },
    saveCurrentQuery() {
      const name = this.queryName.trim();
      const saved = {
        id: this.activeSavedQueryId || `query_${Date.now()}`,
        name,
        conditions: this.queryConditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
        savedAt: Date.now(),
      };
      this.savedQueries = [saved, ...this.savedQueries.filter((q) => q.id !== saved.id)];
      this.activeSavedQueryId = saved.id;
      persistSavedQueries(this.savedQueries);
    },
    loadSavedQuery(id) {
      const saved = this.savedQueries.find((q) => q.id === id);
      if (!saved) return;
      this.queryName = saved.name;
      this.queryConditions = saved.conditions.map((c) => ({ ...defaultQueryCondition(), ...c }));
      this.activeSavedQueryId = saved.id;
    },
    removeSavedQuery(id) {
      this.savedQueries = this.savedQueries.filter((q) => q.id !== id);
      if (this.activeSavedQueryId === id) this.activeSavedQueryId = null;
      persistSavedQueries(this.savedQueries);
    },
    async loadGeoipStatus() {
      this.geoip.status = await geoipStatus();
    },
    async lookupGeoipForIp(ip) {
      if (!ip || this.geoip.byIp[ip] || this.geoip.loadingIps.includes(ip)) return;
      this.geoip.loadingIps.push(ip);
      try {
        this.geoip.byIp[ip] = await lookupGeoip(ip);
        if (!this.geoip.status?.installed) await this.loadGeoipStatus();
      } catch (e) {
        this.geoip.byIp[ip] = {
          ip,
          status: "error",
          countryCode: null,
          countryName: e instanceof Error ? e.message : String(e),
          provider: "DB-IP Lite",
          attribution: "IP Geolocation by DB-IP",
        };
      } finally {
        this.geoip.loadingIps = this.geoip.loadingIps.filter((x) => x !== ip);
      }
    },

    // ---- add source dialog ----
    async openAddSourceDialog() {
      this.showAddSourceDialog = true;
      this.showFileMenu = false;
      if (!this.addSourceRealPath) await this.browseAddSourceDir(null);
    },
    closeAddSourceDialog() {
      this.showAddSourceDialog = false;
    },
    setAddSourceTab(tab) {
      this.addSourceTab = tab;
    },
    // Loads a directory's contents into the File/Directory tabs' shared
    // browser. `path` null means "start from the home directory".
    async browseAddSourceDir(path) {
      this.addSourceLoading = true;
      try {
        const listing = await listLocalDir(path);
        this.addSourceRealPath = listing.path;
        this.addSourceListing = listing.entries;
        this.addSourceSelected = null;
      } finally {
        this.addSourceLoading = false;
      }
    },
    openAddSourceFolder(name) {
      this.browseAddSourceDir(`${this.addSourceRealPath}/${name}`);
    },
    goToAddSourceCrumb(index) {
      const parts = (this.addSourceRealPath || "").split("/").filter(Boolean);
      this.browseAddSourceDir("/" + parts.slice(0, index + 1).join("/"));
    },
    setAddSourcePattern(pattern) {
      this.addSourcePattern = pattern;
    },
    setAddSourceFilterText(text) {
      this.addSourceFilterText = text;
      this.clearHiddenAddSourceSelection();
    },
    setAddSourceHideHidden(value) {
      this.addSourceHideHidden = value;
      this.clearHiddenAddSourceSelection();
    },
    setAddSourceIncludeSubfolders(value) {
      this.addSourceIncludeSubfolders = value;
    },
    selectAddSourceFile(name) {
      this.addSourceSelected = name;
    },
    clearHiddenAddSourceSelection() {
      if (
        this.addSourceSelected &&
        !this.filteredAddSourceListing.some((entry) => entry.name === this.addSourceSelected)
      ) {
        this.addSourceSelected = null;
      }
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
    async loadSources() {
      this.sources = await listSources();
    },
    async confirmAddSource() {
      if (this.addSourceTab === "sftp") {
        // SFTP sources aren't wired up yet (a separate milestone — needs a
        // real SSH/SFTP client on the Rust side) — closing here is the
        // honest stopping point rather than pretending it was added.
        this.showAddSourceDialog = false;
        return;
      }
      const kind = this.addSourceTab; // "file" | "directory"
      const path = kind === "file" ? `${this.addSourceRealPath}/${this.addSourceSelected}` : this.addSourceRealPath;
      const label = kind === "file" ? this.addSourceSelected : path.split("/").filter(Boolean).pop() || path;
      await addSourceApi({
        kind,
        label,
        path,
        pattern: kind === "directory" ? this.addSourcePattern : undefined,
        includeSubfolders: kind === "directory" ? this.addSourceIncludeSubfolders : undefined,
      });
      await this.loadSources();
      this.showAddSourceDialog = false;
      // Give immediate feedback (spinner/skeleton) instead of silently
      // waiting for the next automatic resync tick, which could be up to
      // resyncIntervalMs away.
      this.resyncNow().catch((e) => console.error("[addSource] resync failed", e));
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
