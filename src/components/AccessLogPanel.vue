<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import { statusColor, fmtMs, fmtBytes, formatLocalTimestamp } from "../data/format";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);
const resyncMenu = ref(null);
const intervals = [[10000, "Every 10 seconds"], [30000, "Every 30 seconds"], [60000, "Every minute"], [300000, "Every 5 minutes"]];
const intervalLabel = computed(() => store.resyncIntervalMs < 60000 ? store.resyncIntervalMs / 1000 + "s" : store.resyncIntervalMs / 60000 + "m");
const domains = computed(() => {
  const values = store.tailRows
    .filter((row) => !store.tailSourceId || row.id.startsWith(store.tailSourceId + ":"))
    .map((row) => row.hostname?.toLowerCase()).filter((host) => host && host !== "-");
  if (store.tailDomain) values.push(store.tailDomain);
  return [...new Set(values)].sort();
});
function closeResyncMenu(event) {
  if (!resyncMenu.value?.contains(event.target)) resyncMenu.value?.removeAttribute("open");
}
onMounted(() => document.addEventListener("pointerdown", closeResyncMenu));
onUnmounted(() => document.removeEventListener("pointerdown", closeResyncMenu));
const loading = computed(() => store.tailLoading || (store.isSyncing && !store.tailRows.length));
const columns = [
  ["timestamp", "Timestamp (local)", 220], ["ip", "Client", 160],
  ["hostname", "Hostname", 180], ["method", "Method", 70],
  ["status", "Status", 60], ["path", "Request path", 340],
  ["bytes", "Bytes", 75], ["protocol", "Protocol", 90],
  ["referer", "Referer", 240], ["userAgent", "User agent", 300],
  ["forwardedFor", "X-Forwarded-For", 180], ["ident", "Ident", 100],
  ["authUser", "Authenticated user", 150], ["request", "Full request", 340],
  ["filePath", "Source file", 300], ["ms", "Duration", 90],
];
const selectedColumns = ref(["timestamp", "ip", "hostname", "method", "status", "path", "bytes", "protocol"]);
const visibleColumns = computed(() => columns.filter(([key]) => selectedColumns.value.includes(key)));
const gridStyle = computed(() => ({
  gridTemplateColumns: visibleColumns.value.map(([, , width]) => `${width}px`).join(" "),
}));
function valueFor(row, key) {
  if (key === "bytes") return fmtBytes(row.bytes);
  if (key === "ms") return fmtMs(row.ms);
  if (key === "timestamp") return formatLocalTimestamp(row.ts);
  return row[key] || "-";
}
onMounted(async () => {
  await store.hydrateTailRows();
  store.startAutoResync();
});
onUnmounted(() => store.stopAutoResync());
</script>

<template>
  <div class="panel-fill access-panel">
    <div class="toolbar access-toolbar">
      <div class="access-controls">
      <select class="chip" aria-label="Source" v-model="store.tailSourceId">
        <option value="">All sources ({{ store.sources.length }})</option>
        <option v-for="source in store.sources" :key="source.id" :value="source.id">{{ source.label }}</option>
      </select>
      <details ref="resyncMenu" class="resync-picker" @keydown.esc="resyncMenu.removeAttribute('open'); resyncMenu.querySelector('summary').focus()">
        <summary class="chip accent" aria-label="Resync settings">
          <i class="ph" :class="store.isSyncing ? 'ph-spinner spin' : 'ph-arrows-clockwise'"></i>
          {{ store.isSyncing ? "Syncing..." : "Resync · " + intervalLabel }}<i class="ph ph-caret-down"></i>
        </summary>
        <div class="resync-options">
          <button class="chip accent" :disabled="store.isSyncing" @click="store.resyncNow()">{{ store.isSyncing ? "Syncing..." : "Resync now" }}</button>
          <fieldset>
            <legend>Automatic resync</legend>
            <label v-for="[value, label] in intervals" :key="value">
              <input type="radio" name="access-resync-interval" :value="value" :checked="store.resyncIntervalMs === value" @change="store.setResyncInterval(value)">{{ label }}
            </label>
          </fieldset>
        </div>
      </details>
      <select class="chip" aria-label="Domain" v-model="store.tailDomain" title="Filter domains in loaded rows">
        <option value="">All domains</option>
        <option v-for="domain in domains" :key="domain" :value="domain">{{ domain }}</option>
      </select>
      <span class="synced-label">synced {{ syncedAgo }}</span>
      <select class="chip" aria-label="Time window relative to newest loaded entry" v-model.number="store.tailWindowMs">
        <option :value="0">All loaded times</option><option :value="900000">Last 15m of log</option>
        <option :value="3600000">Last hour of log</option><option :value="86400000">Last day of log</option>
      </select>
      <select class="chip" aria-label="Loaded row limit" :disabled="loading || store.isSyncing" :value="store.tailLimit" @change="store.setTailLimit(Number($event.target.value))">
        <option :value="400">400 rows</option><option :value="1000">1,000 rows</option><option :value="5000">5,000 rows</option>
      </select>
      <select class="chip" aria-label="Minimum status" v-model.number="store.tailMinStatus">
        <option :value="0">All statuses</option><option :value="200">Status >= 200</option>
        <option :value="300">Status >= 300</option><option :value="400">Status >= 400</option><option :value="500">Status >= 500</option>
      </select>
      </div>
      <div class="filterbar">
        <i class="ph ph-funnel"></i>
        <input :value="store.tailFilterText" @input="store.setTailFilter($event.target.value)" aria-label="Search loaded log fields" placeholder="Search all log fields...">
        <button v-if="store.tailFilterText" class="icon-btn" aria-label="Clear search" @click="store.setTailFilter('')"><i class="ph ph-x"></i></button>
      </div>
      <details class="column-picker">
        <summary class="chip">Columns</summary>
        <div class="column-options">
          <label v-for="[key, label] in columns" :key="key">
            <input type="checkbox" :value="key" v-model="selectedColumns" :disabled="selectedColumns.length === 1 && selectedColumns.includes(key)">{{ label }}
          </label>
        </div>
      </details>
    </div>
    <div v-if="store.syncProgress" class="sync-progress-bar"><div :style="{ width: store.syncProgress.completed / store.syncProgress.total * 100 + '%' }"></div></div>
    <div v-if="store.syncError" role="alert" class="access-message">{{ store.syncError }}</div>
    <div class="access-scroll">
      <div class="access-table">
        <div class="tail-head" :style="gridStyle">
          <span v-for="[key, label] in visibleColumns" :key="key">
            <button v-if="key === 'timestamp'" class="time-sort" @click="store.toggleSort()">{{ label }}<i class="ph" :class="store.tailSortDesc ? 'ph-caret-down' : 'ph-caret-up'"></i></button>
            <template v-else>{{ label }}</template>
          </span>
        </div>
        <template v-if="loading">
          <div v-for="i in 8" :key="i" class="tail-row skel" :style="gridStyle"><span v-for="[key] in visibleColumns" :key="key" class="skel-bar"></span></div>
        </template>
        <template v-else>
          <div v-for="row in store.filteredTailRows" :key="row.id" class="tail-row" :style="gridStyle" :class="{ selected: row.id === store.selectedRowId, 'is-error': row.status >= 500 }" @click="store.selectRow(row.id)">
            <span v-for="[key] in visibleColumns" :key="key" :title="String(row[key] ?? '')" :style="key === 'status' ? { color: statusColor(row.status) } : {}">{{ valueFor(row, key) }}</span>
          </div>
        </template>
      </div>
      <div v-if="!loading && !store.filteredTailRows.length" class="access-message">No loaded rows match the current filters.</div>
    </div>
    <div class="tail-foot"><span>{{ store.filteredTailRows.length.toLocaleString() }} matched / {{ store.tailRows.length.toLocaleString() }} loaded rows</span></div>
  </div>
</template>
