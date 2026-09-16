import { acceptHMRUpdate, defineStore } from "pinia";
import {
  seedTailRows,
  hostsData, dayBarsData, topPagesData, topAgentsData, alertRules,
  panelCatalog, statusBarsData,
} from "../data/mock";
import { createLogSource, isTauri, pullFile } from "../data/logSource";
import { listLocalDir, addSource as addSourceApi, removeSource as removeSourceApi, listSources, getSourceStats, listQueryFields, queryRows as queryRowsApi, listDomains as listDomainsApi } from "../data/sourcesApi";
import { geoipStatus, lookupGeoip, reverseDns, lookupNetworkDetails } from "../data/geoipApi";
import { joinLocalPath, localPathCrumbs } from "../data/localPath";


const MAX_HISTORY = 60;
// Rows fetched per SQL query page — the access-log table is an infinite
// scroll over the database, so this is a scroll step, not a data limit.
const QUERY_PAGE_SIZE = 1000;
const SAVED_QUERIES_KEY = "tomahawk.savedQueries";
const SETTINGS_KEY = "tomahawk.settings";
const WORKSPACES_KEY = "tomahawk.workspaces";
const DEFAULT_LOCAL_RULES = {
  builtInEnabled: true,
  botDetectionEnabled: true,
  disabledBuiltInRuleIds: [],
  customRules: [],
};
function loadSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
function saveSettings(value) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); } catch {} }
const INITIAL_SETTINGS = loadSettings();
function normalizeLocalRules(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    builtInEnabled: input.builtInEnabled !== false,
    botDetectionEnabled: input.botDetectionEnabled !== false,
    disabledBuiltInRuleIds: Array.isArray(input.disabledBuiltInRuleIds) ? input.disabledBuiltInRuleIds.filter(Boolean) : [],
    customRules: Array.isArray(input.customRules)
      ? input.customRules.map((rule) => ({
          id: rule.id || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          label: rule.label || "",
          scope: rule.scope || "url",
          pattern: rule.pattern || "",
          severity: rule.severity === "high" ? "high" : "warn",
          enabled: rule.enabled !== false,
        }))
      : [],
  };
}
function persistedSettings(store) {
  return {
    displayTimezone: store.displayTimezone,
    timeDisplayFormat: store.timeDisplayFormat,
    defaultLogFormat: store.defaultLogFormat,
    inspectorShowAllFields: store.inspectorShowAllFields,
    inspectorSectionOrder: store.inspectorSectionOrder,
    localRules: store.localRules,
  };
}
function loadWorkspaces() {
  try { const value = JSON.parse(localStorage.getItem(WORKSPACES_KEY) || "null"); return Array.isArray(value) && value.length ? value : null; } catch { return null; }
}
function saveWorkspaces(value) { try { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(value)); } catch {} }
const PANEL_SIZES_KEY = "tomahawk.panelSizes";
const PANEL_SIZES_DEFAULTS = { left: 272, right: 306, bottom: 244, mix: 322, throughput: 184, talkers: 196 };
const PANEL_SIZE_LIMITS = {
  left: { min: 170, max: 640 },
  right: { min: 220, max: 720 },
  bottom: { min: 120, max: 520 },
  mix: { min: 220, max: 720 },
  throughput: { min: 84, max: 420 },
  talkers: { min: 84, max: 420 },
};
const DEFAULT_ACCESS_COLUMN_ORDER = [
  "timestamp", "ip", "hostname", "method", "status", "path", "bytes", "protocol",
  "referer", "userAgent", "forwardedFor", "ident", "authUser", "request", "filePath", "ms",
];
const DEFAULT_ACCESS_VISIBLE_COLUMNS = ["timestamp", "ip", "hostname", "method", "status", "path", "bytes", "protocol"];
const DEFAULT_INSPECTOR_SECTION_ORDER = ["logged", "request", "client", "timing", "raw"];
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
  { id: "hostname", label: "hostname", type: "text" },
  { id: "forwardedFor", label: "forwarded_for", type: "text" },
  { id: "ident", label: "ident", type: "text" },
  { id: "authUser", label: "auth_user", type: "text" },
  { id: "timestamp", label: "timestamp", type: "text" },
  { id: "request", label: "request", type: "text" },
  { id: "protocol", label: "protocol", type: "text" },
  { id: "raw", label: "raw", type: "text" },
];

function normalizeAccessColumnLayout(layout) {
  const inputOrder = Array.isArray(layout?.order) ? layout.order : DEFAULT_ACCESS_COLUMN_ORDER;
  const order = [
    ...inputOrder.filter((key) => DEFAULT_ACCESS_COLUMN_ORDER.includes(key)),
    ...DEFAULT_ACCESS_COLUMN_ORDER.filter((key) => !inputOrder.includes(key)),
  ];
  const inputVisible = Array.isArray(layout?.visible) ? layout.visible : DEFAULT_ACCESS_VISIBLE_COLUMNS;
  const visible = inputVisible.filter((key) => order.includes(key));
  return { order, visible: visible.length ? visible : [order[0]] };
}

function normalizeInspectorSectionOrder(order) {
  const input = Array.isArray(order) ? order : DEFAULT_INSPECTOR_SECTION_ORDER;
  return [
    ...input.filter((id) => DEFAULT_INSPECTOR_SECTION_ORDER.includes(id)),
    ...DEFAULT_INSPECTOR_SECTION_ORDER.filter((id) => !input.includes(id)),
  ];
}
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

function loadPanelSizes() {
  if (typeof window === "undefined") return { ...PANEL_SIZES_DEFAULTS };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PANEL_SIZES_KEY) || "{}");
    const sizes = { ...PANEL_SIZES_DEFAULTS, ...parsed };
    for (const key of Object.keys(PANEL_SIZES_DEFAULTS)) {
      const limits = PANEL_SIZE_LIMITS[key];
      const value = Number(sizes[key]);
      sizes[key] = Number.isFinite(value) ? Math.max(limits.min, Math.min(limits.max, value)) : PANEL_SIZES_DEFAULTS[key];
    }
    return sizes;
  } catch {
    return { ...PANEL_SIZES_DEFAULTS };
  }
}

function persistPanelSizes(sizes) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(sizes));
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
    currentPage: "monitor",
    workspaces: loadWorkspaces() || [{ id: "monitor", name: "Analyze", dockTabs: null, dockActiveTab: null }],
    activeWorkspaceId: "monitor",

    // ---- access log / resync ----
    // Real sources start with an empty tail — filled in by the first
    // resync — rather than the demo rows, which are only useful in a
    // plain browser dev preview with no real source registered yet.
    tailRows: isTauri() ? [] : seedTailRows(),
    tailLoading: false,
    selectedRowId: null,
    tailFilterText: "",
    // The table is an infinite scroll over the whole database: every query
    // (search box, source/domain/window/status filters, query-builder
    // conditions) runs in SQL against *all* rows. `tailRows` is only the
    // window fetched so far; `queryResultTotal` is the full DB match count.
    queryPageSize: QUERY_PAGE_SIZE,
    queryOffset: 0,
    queryResultTotal: 0,
    queryUniverse: 0,
    queryHasMore: false,
    queryLoading: false,
    _querySeq: 0,
    _queryTimer: null,
    panelVisibility: { left: true, right: true, bottom: true },
    panelSizes: loadPanelSizes(),
    tailSourceId: "",
    tailDomain: "",
    tailWindowMs: 0,
    tailMinStatus: 0,
    tailSortDesc: true, // newest first, matches the design's default caret
    // Distinct hostnames on disk (for the domain filter dropdown), refreshed
    // from the database after sync / source changes.
    domains: [],
    accessColumnLayout: normalizeAccessColumnLayout(),
    resyncIntervalMs: 1800000,
    lastSyncedAt: Date.now(),
    syncError: null,
    isSyncing: false,
    syncProgress: null, // { completed, total } | null — only set during a real per-source sync
    syncActiveFiles: [], // [{ sourceId, filePath }] — files currently being ingested, for the sources panel
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

    // ---- query builder / bottom dock ----
    queryConditions: [],
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

    // Per-IP reverse DNS + city/ASN enrichment, resolved on demand when a
    // row is selected. `byIp` values are one merged object:
    // { rdns, city, region, lat, lon, asn, org, errors }.
    enrichment: {
      byIp: {},
      loadingIps: [],
    },

    bufferedBase: 12400,

    // ---- docks: which panels are open where, and which is focused ----
    dockTabs: {
      stream: ["access"],
      bottom: ["query", "alerts"],
      inspector: ["inspector", "history"],
      sources: ["sources", "saved"],
      talkers: [],
      throughput: ["talkers", "throughput"],
      mix: ["mix"],
    },
    dockActiveTab: {
      stream: "access",
      bottom: "query",
      inspector: "inspector",
      sources: "sources",
      talkers: null,
      throughput: "talkers",
      mix: "mix",
    },

    // ---- registered log sources (real, once running in Tauri) ----
    sources: [],

    // ---- add source dialog (t2) ----
    showAddSourceDialog: false,
    addSourceTab: "file", // file | directory
    addSourceRealPath: null, // absolute path currently browsed; null until first loaded
    addSourceError: null,
    addSourceListing: [],
    addSourceLoading: false,
    addSourceSaving: false,
    addSourceSelected: null,
    addSourceFilterText: "",
    addSourceHideHidden: true,
    addSourcePattern: "access.log*", // directory kind only
    addSourceIncludeSubfolders: false, // directory kind only

    // ---- settings dialog (t5b) ----
    showSettingsDialog: false,
    settingsSection: "general",
    displayTimezone: INITIAL_SETTINGS.displayTimezone || "local", // local | utc | source
    timeDisplayFormat: INITIAL_SETTINGS.timeDisplayFormat || "full", // full | short | relative | source
    defaultLogFormat: INITIAL_SETTINGS.defaultLogFormat || "apache_combined",
    inspectorShowAllFields: INITIAL_SETTINGS.inspectorShowAllFields === true,
    inspectorSectionOrder: normalizeInspectorSectionOrder(INITIAL_SETTINGS.inspectorSectionOrder),
    localRules: normalizeLocalRules(INITIAL_SETTINGS.localRules || DEFAULT_LOCAL_RULES),

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
      // In the desktop app every row has already been filtered and ordered
      // by the backend query_rows — no client-side re-filter needed.
      if (isTauri()) return state.tailRows;
      // Browser dev preview: no real database; apply the old client-side
      // filtering so the mock seed rows still respond to the toolbar.
      const q = state.tailFilterText.trim().toLowerCase();
      const sourceRows = state.tailRows.filter((r) => !state.tailSourceId || r.id.startsWith(`${state.tailSourceId}:`));
      const latest = sourceRows.reduce((ts, r) => Math.max(ts, r.ts || 0), 0);
      const rows = sourceRows.filter((r) =>
        (!state.tailDomain || r.hostname?.toLowerCase() === state.tailDomain) &&
        (!state.tailWindowMs || r.ts >= latest - state.tailWindowMs) &&
        r.status >= state.tailMinStatus &&
        (!q || Object.values(r).some((value) => String(value ?? "").toLowerCase().includes(q)))
      );
      const queried = rows.filter((r) => state.queryConditions.every((c) => conditionMatches(r, c, state.queryFieldList)));
      return state.tailSortDesc ? queried.slice().reverse() : queried;
    },
    queryTotalRows(state) {
      // "of N" in the query panel: rows in the involved sources, regardless
      // of any filter — the total universe the DB contains.
      return state.queryUniverse;
    },
    queryMatchedRows(state) {
      return state.queryResultTotal;
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
      this._refreshQuerySoon(0);
    },
    // ---- SQL-backed table query ----
    _queryInput() {
      return {
        sourceId: this.tailSourceId || null,
        domain: this.tailDomain || null,
        minStatus: this.tailMinStatus || 0,
        windowMs: this.tailWindowMs || 0,
        text: this.tailFilterText.trim() || null,
        conditions: this.queryConditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
      };
    },
    // Debounced re-query for filter inputs (search text / query builder typing).
    _refreshQuerySoon(delay) {
      if (this._queryTimer) clearTimeout(this._queryTimer);
      this._queryTimer = setTimeout(() => {
        this._queryTimer = null;
        this.refreshQuery().catch(() => {});
      }, delay);
    },
    // The query-builder conditions mutate their object in place (updateQueryCondition
    // assigns onto the existing condition), so `_queryInput()` is stable.
    async refreshQuery(showLoading = true) {
      if (!isTauri()) {
        this.queryResultTotal = this.tailRows.length;
        this.queryUniverse = this.tailRows.length;
        this.queryOffset = 0;
        this.queryHasMore = false;
        this.tailLoading = false;
        return;
      }
      const seq = ++this._querySeq;
      if (showLoading) this.tailLoading = true;
      this.queryLoading = true;
      let result = null;
      try {
        result = await queryRowsApi(this._queryInput(), this.tailSortDesc, 0, this.queryPageSize);
      } catch (error) {
        if (!this.isSyncing) this.syncError = `Could not query log rows: ${String(error)}`;
      } finally {
        if (seq === this._querySeq) {
          this.queryLoading = false;
          this.tailLoading = false;
        }
      }
      if (seq !== this._querySeq || !result) return;
      this.tailRows = result.rows;
      this.queryOffset = result.rows.length;
      this.queryResultTotal = result.total;
      this.queryUniverse = result.universe;
      this.queryHasMore = result.rows.length >= this.queryPageSize && result.rows.length < result.total;
    },
    // Fetches the next page and appends it — the infinite-scroll step.
    async loadMoreQuery() {
      if (!isTauri() || this.queryLoading || !this.queryHasMore || !this.tailRows.length) return;
      const seq = this._querySeq;
      this.queryLoading = true;
      let result = null;
      try {
        result = await queryRowsApi(this._queryInput(), this.tailSortDesc, this.queryOffset, this.queryPageSize);
      } catch (error) {
        if (!this.isSyncing) this.syncError = `Could not load more rows: ${String(error)}`;
      }
      this.queryLoading = false;
      if (seq !== this._querySeq || !result || !result.rows.length) return;
      this.tailRows = this.tailRows.concat(result.rows);
      this.queryOffset += result.rows.length;
      this.queryResultTotal = result.total;
      this.queryUniverse = result.universe;
      this.queryHasMore = result.rows.length >= this.queryPageSize && this.queryOffset < result.total;
    },
    async refreshDomains() {
      if (!isTauri()) return;
      try {
        this.domains = (await listDomainsApi(this.tailSourceId || null)).sort((a, b) => a.localeCompare(b));
      } catch (error) {
        console.error("[domains]", error);
      }
    },
    workspaceSnapshot() {
      return {
        dockTabs: JSON.parse(JSON.stringify(this.dockTabs)),
        dockActiveTab: JSON.parse(JSON.stringify(this.dockActiveTab)),
        accessColumnLayout: JSON.parse(JSON.stringify(this.accessColumnLayout)),
      };
    },
    saveWorkspaceState() {
      const current = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
      if (!current) return;
      Object.assign(current, this.workspaceSnapshot());
      saveWorkspaces(this.workspaces);
    },
    createWorkspace() {
      this.saveWorkspaceState();
      const id = `workspace-${Date.now()}`;
      const snapshot = this.workspaceSnapshot();
      this.workspaces.push({ id, name: `Monitor ${this.workspaces.length}`, ...snapshot });
      this.activeWorkspaceId = id;
      this.loadWorkspace(id);
      saveWorkspaces(this.workspaces);
      return id;
    },
    loadWorkspace(id) {
      const workspace = this.workspaces.find((w) => w.id === id);
      if (!workspace) return;
      this.saveWorkspaceState();
      this.activeWorkspaceId = id;
      if (workspace.dockTabs) this.dockTabs = JSON.parse(JSON.stringify(workspace.dockTabs));
      if (workspace.dockActiveTab) this.dockActiveTab = JSON.parse(JSON.stringify(workspace.dockActiveTab));
      this.accessColumnLayout = normalizeAccessColumnLayout(workspace.accessColumnLayout);
      saveWorkspaces(this.workspaces);
    },
    renameWorkspace(id, name) {
      const workspace = this.workspaces.find((w) => w.id === id);
      if (!workspace || !name.trim()) return;
      workspace.name = name.trim(); saveWorkspaces(this.workspaces);
    },
    removeWorkspace(id) {
      if (id === "monitor" || this.workspaces.length === 1) return;
      const index = this.workspaces.findIndex((w) => w.id === id);
      if (index < 0) return;
      this.workspaces.splice(index, 1);
      if (this.activeWorkspaceId === id) this.loadWorkspace(this.workspaces[Math.max(0, index - 1)].id);
      saveWorkspaces(this.workspaces);
    },
togglePanel(side) {
      if (!Object.hasOwn(this.panelVisibility, side)) return;
      this.panelVisibility[side] = !this.panelVisibility[side];
      this.panelPicker = null;
    },
    resizePanel(key, delta) {
      const limits = PANEL_SIZE_LIMITS[key];
      if (!limits) return;
      const current = this.panelSizes[key];
      if (current == null) return;
      const next = Math.max(limits.min, Math.min(limits.max, current + delta));
      if (next === current) return;
      this.panelSizes[key] = next;
      persistPanelSizes(this.panelSizes);
    },
    setTailFilter(text) {
      this.tailFilterText = text;
      this._refreshQuerySoon(300);
    },
    setTailSource(sourceId) {
      this.tailSourceId = sourceId;
      this._refreshQuerySoon(0);
      this.refreshDomains();
    },
    setTailDomain(domain) {
      this.tailDomain = domain;
      this._refreshQuerySoon(0);
    },
    setTailWindow(windowMs) {
      this.tailWindowMs = windowMs;
      this._refreshQuerySoon(0);
    },
    setTailMinStatus(minStatus) {
      this.tailMinStatus = minStatus;
      this._refreshQuerySoon(0);
    },
    setAccessColumnVisible(key, visible) {
      if (!this.accessColumnLayout.order.includes(key)) return;
      const next = new Set(this.accessColumnLayout.visible);
      if (visible) next.add(key);
      else if (next.size > 1) next.delete(key);
      this.accessColumnLayout.visible = this.accessColumnLayout.order.filter((column) => next.has(column));
      this.saveWorkspaceState();
    },
    moveAccessColumn(key, targetKey) {
      if (key === targetKey) return;
      const index = this.accessColumnLayout.order.indexOf(key);
      const targetIndex = this.accessColumnLayout.order.indexOf(targetKey);
      if (index === -1 || targetIndex === -1) return;
      const order = [...this.accessColumnLayout.order];
      const [column] = order.splice(index, 1);
      order.splice(targetIndex, 0, column);
      const visibleSet = new Set(this.accessColumnLayout.visible);
      this.accessColumnLayout.order = order;
      this.accessColumnLayout.visible = order.filter((column) => visibleSet.has(column));
      this.saveWorkspaceState();
    },
    resetAccessColumns() {
      this.accessColumnLayout = normalizeAccessColumnLayout();
      this.saveWorkspaceState();
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
      this.syncError = null;
      await this.refreshQuery(true);
      this.refreshDomains();
    },
    async refreshSourceData() {
      await this.loadSources();
      await this.refreshSourceStats();
      await this.refreshQuery(true);
      if (this.selectedRowId && !this.tailRows.some((r) => r.id === this.selectedRowId)) {
        this.selectedRowId = null;
      }
      this.history = this.history.filter((h) => this.tailRows.some((r) => r.id === h.id));
    },
    // Pulls individually, rather than one bulk call across every source —
    // that's what makes real per-source sync progress possible instead of
    // just an opaque "please wait".
    // When the backend reports the file list, each file is pulled on its own
    // (still backgrounded in Rust) so the sources panel can show exactly
    // which file is loading and update its counters as it finishes.
    //
    // The table shows what's in SQLite (query_rows), so the rows returned by
    // each pull are not appended to `tailRows` — instead the current page is
    // re-queried after each finished source (only when viewing the top page,
    // so a deep scroll isn't disrupted), and the sources panel's counters
    // come from the pull result directly.
    async _pull() {
      if (this.isSyncing) return;
      this.isSyncing = true;
      this.syncError = null;
      try {
        const source = this._ensureSource();
        await this.loadSources(); // fast: sources appear in the panel immediately
        const ids = this.sources.map((s) => s.id);
        if (!ids.length) {
          const rows = await source.pull();
          this.tailRows.push(...rows);
        } else {
          this.syncProgress = { total: ids.length, completed: 0 };
          // Fill in real counts/cursors before pulling, so the tree shows what
          // is already imported and fully-ingested files can be skipped fast.
          await this.refreshSourceStats();
          for (const id of ids) {
            const info = this.sources.find((s) => s.id === id);
            const files = info?.files?.length ? info.files : null;
            if (!files || !isTauri()) {
              const rows = await source.pull(id);
              this.tailRows.push(...rows);
            } else {
              this.syncActiveFiles = files.map((f) => ({ sourceId: id, filePath: f.path }));
              for (const f of files) {
                try {
                  if (f.done) continue; // rotated/gz archive already imported
                  const result = await pullFile(id, f.path, 200);
                  // Patch the live source tree so counts/done states tick up
                  // as each file finishes.
                  const sourceInfo = this.sources.find((s) => s.id === id);
                  const fileInfo = sourceInfo?.files?.find((x) => x.path === f.path);
                  if (sourceInfo && fileInfo) {
                    fileInfo.rowCount = result.rowCount;
                    fileInfo.done = result.done;
                    sourceInfo.rowCount = (sourceInfo.files || []).reduce((sum, x) => sum + x.rowCount, 0);
                  }
                } catch (error) {
                  this.syncError = this.syncError ? `${this.syncError}; ${String(error)}` : String(error);
                } finally {
                  this.syncActiveFiles = this.syncActiveFiles.filter((x) => !(x.sourceId === id && x.filePath === f.path));
                }
              }
              this.syncActiveFiles = [];
            }
            this.syncProgress.completed++;
            // Refresh the visible top page as each source finishes, so the
            // table fills in progressively during a big import without the
            // user waiting for the whole sync to finish.
            if (this.queryOffset === 0) await this.refreshQuery(false).catch(() => {});
          }
          await this.refreshSourceStats(); // authoritative counts once ingestion is done
          this.refreshDomains();
        }
        this.lastSyncedAt = Date.now();
        this.statusBars = statusBarsData();
      } catch (error) {
        this.syncError = String(error);
        throw error;
      } finally {
        this.isSyncing = false;
        this.syncProgress = null;
        this.syncActiveFiles = [];
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
    // True while any of the source's files are being ingested — the sources
    // panel shows a spinner on the row during this.
    isSourceLoading(sourceId) {
      return this.syncActiveFiles.some((x) => x.sourceId === sourceId);
    },
    // True while that specific file is being ingested.
    isFileLoading(sourceId, filePath) {
      return this.syncActiveFiles.some((x) => x.sourceId === sourceId && x.filePath === filePath);
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
      this._refreshQuerySoon(300);
    },
    removeQueryCondition(id) {
      this.queryConditions = this.queryConditions.filter((c) => c.id !== id);
      this._refreshQuerySoon(300);
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
      this._refreshQuerySoon(300);
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
      this.queryConditions = [];
      this._refreshQuerySoon(0);
    },
    // Replaces the query-builder conditions (e.g. from an alerts click) and
    // re-runs the SQL query so the table reflects them immediately.
    applyAlertConditions(conditions) {
      this.queryConditions = conditions.map((c) => ({
        id: c.id || `query_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        field: c.field,
        operator: c.operator,
        value: String(c.value ?? ""),
      }));
      this._refreshQuerySoon(0);
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
      this._refreshQuerySoon(0);
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
    // Resolves reverse DNS (system resolver) and city/ASN details for one
    // IP, cached per address. Either lookup can fail independently — a
    // missing PTR record or an offline GeoIP provider shouldn't drop the
    // other result.
    async lookupEnrichmentForIp(ip) {
      if (!ip || typeof ip !== "string") return;
      if (this.enrichment.byIp[ip] || this.enrichment.loadingIps.includes(ip)) return;
      this.enrichment.loadingIps.push(ip);
      try {
        const [rdns, net] = await Promise.all([
          reverseDns(ip).catch(() => null),
          lookupNetworkDetails(ip).catch(() => null),
        ]);
        this.enrichment.byIp[ip] = {
          rdns: rdns || null,
          city: net?.city ?? null,
          region: net?.region ?? null,
          lat: net?.latitude ?? null,
          lon: net?.longitude ?? null,
          asn: net?.asn ?? null,
          org: net?.organization ?? null,
          errors: Array.isArray(net?.errors) ? net.errors : [],
        };
      } finally {
        this.enrichment.loadingIps = this.enrichment.loadingIps.filter((x) => x !== ip);
      }
    },

    // ---- add source dialog ----
    async openAddSourceDialog() {
      this.showAddSourceDialog = true;
      this.showFileMenu = false;
      if (!this.addSourceRealPath) await this.browseAddSourceDir(null);
    },
    closeAddSourceDialog() {
      if (this.addSourceSaving) return;
      this.showAddSourceDialog = false;
    },
    setAddSourceTab(tab) {
      this.addSourceTab = tab;
    },
    // Loads a directory's contents into the File/Directory tabs' shared
    // browser. `path` null means "start from the home directory".
    async browseAddSourceDir(path) {
      this.addSourceLoading = true;
      this.addSourceError = null;
      try {
        const listing = await listLocalDir(path);
        this.addSourceRealPath = listing.path;
        this.addSourceListing = listing.entries;
        this.addSourceSelected = null;
      } catch (error) {
        this.addSourceError = String(error);
      } finally {
        this.addSourceLoading = false;
      }
    },
    openAddSourceFolder(name) {
      return this.browseAddSourceDir(joinLocalPath(this.addSourceRealPath, name));
    },
    goToAddSourceCrumb(index) {
      const crumb = localPathCrumbs(this.addSourceRealPath)[index];
      if (crumb) return this.browseAddSourceDir(crumb.path);
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
    async loadSources() {
      this.sources = await listSources();
    },
    // Fills the fast source list in with real DB stats (row counts, per-file
    // cursors), one source at a time so the tree populates progressively
    // instead of waiting for all the COUNT queries to finish.
    async loadSourceStats(sourceId) {
      const stats = await getSourceStats(sourceId);
      if (!stats) return;
      const source = this.sources.find((s) => s.id === sourceId);
      if (!source) return;
      source.rowCount = stats.rowCount;
      source.lastTs = stats.lastTs;
      source.files = stats.files;
    },
    async refreshSourceStats() {
      await Promise.all(this.sources.map((s) => this.loadSourceStats(s.id).catch(() => {})));
    },
    async confirmAddSource() {
      if (this.addSourceSaving) return;
      const kind = this.addSourceTab; // "file" | "directory"
      const path = kind === "file" ? joinLocalPath(this.addSourceRealPath, this.addSourceSelected) : this.addSourceRealPath;
      const label = kind === "file" ? this.addSourceSelected : localPathCrumbs(path).at(-1)?.label || path;
      this.addSourceSaving = true;
      this.addSourceError = null;
      try {
        await addSourceApi({
          kind,
          label,
          path,
          pattern: kind === "directory" ? this.addSourcePattern : undefined,
          includeSubfolders: kind === "directory" ? this.addSourceIncludeSubfolders : undefined,
          logFormat: this.defaultLogFormat,
        });
        await this.loadSources();
        this.showAddSourceDialog = false;
        // Give immediate feedback (spinner/skeleton) instead of silently
        // waiting for the next automatic resync tick, which could be up to
        // resyncIntervalMs away.
        this.resyncNow().catch((e) => console.error("[addSource] resync failed", e));
      } catch (error) {
        this.addSourceError = error instanceof Error ? error.message : String(error);
      } finally {
        this.addSourceSaving = false;
      }
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
    setDisplayTimezone(mode) {
      this.displayTimezone = mode;
      saveSettings(persistedSettings(this));
    },
    setTimeDisplayFormat(format) {
      this.timeDisplayFormat = format;
      saveSettings(persistedSettings(this));
    },
    setDefaultLogFormat(format) {
      this.defaultLogFormat = format;
      saveSettings(persistedSettings(this));
    },
    setInspectorShowAllFields(enabled) {
      this.inspectorShowAllFields = !!enabled;
      saveSettings(persistedSettings(this));
    },
    moveInspectorSection(sectionId, targetSectionId) {
      if (sectionId === targetSectionId) return;
      const order = normalizeInspectorSectionOrder(this.inspectorSectionOrder);
      const index = order.indexOf(sectionId);
      const targetIndex = order.indexOf(targetSectionId);
      if (index === -1 || targetIndex === -1) return;
      const [section] = order.splice(index, 1);
      order.splice(targetIndex, 0, section);
      this.inspectorSectionOrder = order;
      saveSettings(persistedSettings(this));
    },
    resetInspectorSections() {
      this.inspectorSectionOrder = normalizeInspectorSectionOrder();
      saveSettings(persistedSettings(this));
    },
    persistSettings() {
      saveSettings(persistedSettings(this));
    },
    setLocalRulesFlag(flag, enabled) {
      if (!Object.hasOwn(this.localRules, flag)) return;
      this.localRules[flag] = !!enabled;
      this.persistSettings();
    },
    toggleBuiltInRule(ruleId) {
      const disabled = new Set(this.localRules.disabledBuiltInRuleIds);
      if (disabled.has(ruleId)) disabled.delete(ruleId);
      else disabled.add(ruleId);
      this.localRules.disabledBuiltInRuleIds = [...disabled];
      this.persistSettings();
    },
    addLocalRule() {
      this.localRules.customRules.push({
        id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        label: "Local rule",
        scope: "url",
        pattern: "",
        severity: "warn",
        enabled: true,
      });
      this.persistSettings();
    },
    updateLocalRule(id, patch) {
      const rule = this.localRules.customRules.find((item) => item.id === id);
      if (!rule) return;
      Object.assign(rule, patch);
      if (rule.severity !== "high") rule.severity = "warn";
      if (!["url", "ua", "ip", "method", "status", "raw"].includes(rule.scope)) rule.scope = "url";
      this.persistSettings();
    },
    removeLocalRule(id) {
      this.localRules.customRules = this.localRules.customRules.filter((rule) => rule.id !== id);
      this.persistSettings();
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

// Keep existing data while updating actions, getters, and new state fields
// when Vite replaces this module in the running desktop app.
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMonitorStore, import.meta.hot));
}
