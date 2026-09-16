<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useMonitorStore } from "../store/monitor";
import { statusColor, fmtMs, fmtBytes, formatTimestamp } from "../data/format";
import AppSelect from "./AppSelect.vue";

const store = useMonitorStore();
const relativeClock = ref(Date.now());
const draggedColumn = ref(null);
const dragOverColumn = ref(null);
const columnMenuOpen = ref(false);
let relativeTimer;
const domains = computed(() => {
  const values = store.tailRows
    .filter((row) => !store.tailSourceId || row.id.startsWith(store.tailSourceId + ":"))
    .map((row) => row.hostname?.toLowerCase()).filter((host) => host && host !== "-");
  if (store.tailDomain) values.push(store.tailDomain);
  return [...new Set(values)].sort();
});
const sourceOptions = computed(() => [
  { value: "", label: `All sources (${store.sources.length})` },
  ...store.sources.map((source) => ({ value: source.id, label: source.label })),
]);
const domainOptions = computed(() => [
  { value: "", label: "All domains" },
  ...domains.value.map((domain) => ({ value: domain, label: domain })),
]);
const windowOptions = [
  { value: 0, label: "All loaded times" },
  { value: 900000, label: "Last 15m of log" },
  { value: 3600000, label: "Last hour of log" },
  { value: 86400000, label: "Last day of log" },
];
const limitOptions = [
  { value: 400, label: "400 rows" },
  { value: 1000, label: "1,000 rows" },
  { value: 5000, label: "5,000 rows" },
];
const statusOptions = [
  { value: 0, label: "All statuses" },
  { value: 200, label: "Status >= 200" },
  { value: 300, label: "Status >= 300" },
  { value: 400, label: "Status >= 400" },
  { value: 500, label: "Status >= 500" },
];
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
const columnByKey = new Map(columns.map((column) => [column[0], column]));
const orderedColumns = computed(() => store.accessColumnLayout.order.map((key) => columnByKey.get(key)).filter(Boolean));
const visibleColumns = computed(() => store.accessColumnLayout.visible.map((key) => columnByKey.get(key)).filter(Boolean));
const timestampLabel = computed(() => {
  if (store.timeDisplayFormat === "relative") return "Timestamp (relative)";
  if (store.timeDisplayFormat === "source") return "Timestamp (source)";
  if (store.displayTimezone === "utc") return "Timestamp (UTC)";
  if (store.displayTimezone === "source") return "Timestamp (source)";
  return "Timestamp (local)";
});
const gridStyle = computed(() => ({
  gridTemplateColumns: visibleColumns.value.map(([, , width]) => `${width}px`).join(" "),
}));
function valueFor(row, key) {
  if (key === "bytes") return fmtBytes(row.bytes);
  if (key === "ms") return fmtMs(row.ms);
  if (key === "timestamp") {
    if (store.timeDisplayFormat === "relative") relativeClock.value;
    return formatTimestamp(row, store.displayTimezone, store.timeDisplayFormat);
  }
  return row[key] || "-";
}
function titleFor(row, key) {
  if (key === "timestamp") return formatTimestamp(row, store.displayTimezone, "full");
  return String(row[key] ?? "");
}
function startColumnDrag(event, key) {
  draggedColumn.value = key;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", key);
}
function dropColumn(event, key) {
  const dragged = draggedColumn.value || event.dataTransfer.getData("text/plain");
  draggedColumn.value = null;
  dragOverColumn.value = null;
  if (dragged) store.moveAccessColumn(dragged, key);
}
function endColumnDrag() {
  draggedColumn.value = null;
  dragOverColumn.value = null;
}
onMounted(async () => {
  await store.hydrateTailRows();
  store.startAutoResync();
  relativeTimer = setInterval(() => { relativeClock.value = Date.now(); }, 30000);
});
onUnmounted(() => {
  store.stopAutoResync();
  clearInterval(relativeTimer);
});
</script>

<template>
  <div class="panel-fill access-panel">
    <div class="toolbar access-toolbar">
      <div class="access-controls">
      <AppSelect v-model="store.tailSourceId" :options="sourceOptions" aria-label="Source" />
      <AppSelect v-model="store.tailDomain" :options="domainOptions" aria-label="Domain" />
      <AppSelect v-model="store.tailWindowMs" :options="windowOptions" aria-label="Time window relative to newest loaded entry" />
      <AppSelect :model-value="store.tailLimit" :options="limitOptions" aria-label="Loaded row limit" :disabled="loading || store.isSyncing" @update:model-value="store.setTailLimit($event)" />
      <AppSelect v-model="store.tailMinStatus" :options="statusOptions" aria-label="Minimum status" />
      </div>
      <div class="filterbar">
        <i class="ph ph-funnel"></i>
        <input :value="store.tailFilterText" @input="store.setTailFilter($event.target.value)" aria-label="Search loaded log fields" placeholder="Search all log fields...">
        <button v-if="store.tailFilterText" class="icon-btn" aria-label="Clear search" @click="store.setTailFilter('')"><i class="ph ph-x"></i></button>
      </div>
      <div class="column-picker" :class="{ open: columnMenuOpen }">
        <div v-if="columnMenuOpen" class="popup-backdrop" @click="columnMenuOpen = false"></div>
        <button class="chip" @click="columnMenuOpen = !columnMenuOpen">Columns</button>
        <div v-if="columnMenuOpen" class="column-options" @click.stop>
          <div class="column-options-head">
            <span>Columns for this tab</span>
            <button class="btn-plain" @click="store.resetAccessColumns()">Reset</button>
          </div>
          <div
            v-for="[key, label] in orderedColumns"
            :key="key"
            class="column-option-row"
            :class="{ dragging: draggedColumn === key, 'drag-over': dragOverColumn === key && draggedColumn !== key }"
            draggable="true"
            @dragstart="startColumnDrag($event, key)"
            @dragover.prevent="dragOverColumn = key"
            @dragleave="dragOverColumn === key && (dragOverColumn = null)"
            @drop.prevent="dropColumn($event, key)"
            @dragend="endColumnDrag"
          >
            <i class="ph ph-dots-six-vertical column-drag-handle" title="Drag to reorder"></i>
            <label>
              <input
                type="checkbox"
                :checked="store.accessColumnLayout.visible.includes(key)"
                :disabled="store.accessColumnLayout.visible.length === 1 && store.accessColumnLayout.visible.includes(key)"
                @change="store.setAccessColumnVisible(key, $event.target.checked)"
              >{{ label }}
            </label>
          </div>
        </div>
      </div>
    </div>
    <div v-if="store.syncProgress" class="sync-progress-bar"><div :style="{ width: store.syncProgress.completed / store.syncProgress.total * 100 + '%' }"></div></div>
    <div v-if="store.syncError" role="alert" class="access-message">{{ store.syncError }}</div>
    <div class="access-scroll">
      <div class="access-table">
        <div class="tail-head" :style="gridStyle">
          <span
            v-for="[key, label] in visibleColumns"
            :key="key"
            class="tail-head-cell"
            :class="{ dragging: draggedColumn === key, 'drag-over': dragOverColumn === key && draggedColumn !== key }"
            draggable="true"
            @dragstart="startColumnDrag($event, key)"
            @dragover.prevent="dragOverColumn = key"
            @dragleave="dragOverColumn === key && (dragOverColumn = null)"
            @drop.prevent="dropColumn($event, key)"
            @dragend="endColumnDrag"
          >
            <button v-if="key === 'timestamp'" class="time-sort" @click="store.toggleSort()">{{ timestampLabel }}<i class="ph" :class="store.tailSortDesc ? 'ph-caret-down' : 'ph-caret-up'"></i></button>
            <template v-else><i class="ph ph-dots-six-vertical tail-head-drag"></i>{{ label }}</template>
          </span>
        </div>
        <template v-if="loading">
          <div v-for="i in 8" :key="i" class="tail-row skel" :style="gridStyle"><span v-for="[key] in visibleColumns" :key="key" class="skel-bar"></span></div>
        </template>
        <template v-else>
          <div v-for="row in store.filteredTailRows" :key="row.id" class="tail-row" :style="gridStyle" :class="{ selected: row.id === store.selectedRowId, 'is-error': row.status >= 500 }" @click="store.selectRow(row.id)">
            <span v-for="[key] in visibleColumns" :key="key" :title="titleFor(row, key)" :style="key === 'status' ? { color: statusColor(row.status) } : {}">{{ valueFor(row, key) }}</span>
          </div>
        </template>
      </div>
      <div v-if="!loading && !store.filteredTailRows.length" class="access-message">No loaded rows match the current filters.</div>
    </div>
    <div class="tail-foot"><span>{{ store.filteredTailRows.length.toLocaleString() }} matched / {{ store.tailRows.length.toLocaleString() }} loaded rows</span></div>
  </div>
</template>
