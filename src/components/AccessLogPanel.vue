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
const domains = computed(() => store.tailRows.map((row) => row.hostname?.toLowerCase()).filter((host) => host && host !== "-"));
const sourceOptions = computed(() => [
  { value: "", label: `All sources (${store.sources.length})` },
  ...store.sources.map((source) => ({ value: source.id, label: source.label })),
]);
const domainOptions = computed(() => {
  const options = store.domains.length ? store.domains : domains.value;
  return [
    { value: "", label: "All domains" },
    ...options.map((domain) => ({ value: domain, label: domain })),
  ];
});
const windowOptions = [
  { value: 0, label: "All loaded times" },
  { value: 900000, label: "Last 15m of log" },
  { value: 3600000, label: "Last hour of log" },
  { value: 86400000, label: "Last day of log" },
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
const scrollRef = ref(null);
const headRef = ref(null);
function syncHeaderScroll() {
  if (scrollRef.value && headRef.value) {
    headRef.value.style.transform = `translateX(-${scrollRef.value.scrollLeft}px)`;
  }
}
// Infinite table: scrolling toward the bottom fetches the next SQL page for
// the current filters (the whole database is searched, not just loaded rows).
function onTableScroll() {
  syncHeaderScroll();
  const el = scrollRef.value;
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
    store.loadMoreQuery();
  }
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
      <AppSelect :model-value="store.tailSourceId" :options="sourceOptions" aria-label="Source" @update:model-value="store.setTailSource($event)" />
      <AppSelect :model-value="store.tailDomain" :options="domainOptions" aria-label="Domain" @update:model-value="store.setTailDomain($event)" />
      <AppSelect :model-value="store.tailWindowMs" :options="windowOptions" aria-label="Time window relative to the newest entry" @update:model-value="store.setTailWindow($event)" />
      <AppSelect :model-value="store.tailMinStatus" :options="statusOptions" aria-label="Minimum status" @update:model-value="store.setTailMinStatus($event)" />
      </div>
      <div class="filterbar">
        <i class="ph ph-funnel"></i>
        <input :value="store.tailFilterText" @input="store.setTailFilter($event.target.value)" aria-label="Search all log fields" placeholder="Search the entire database…">
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
    <div class="tail-head access-head" :style="gridStyle" ref="headRef">
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
    <div class="access-scroll" ref="scrollRef" @scroll="onTableScroll">
      <div class="access-table">
        <template v-if="loading">
          <div v-for="i in 8" :key="i" class="tail-row skel" :style="gridStyle"><span v-for="[key] in visibleColumns" :key="key" class="skel-bar"></span></div>
        </template>
        <template v-else>
          <div v-for="row in store.filteredTailRows" :key="row.id" class="tail-row" :style="gridStyle" :class="{ selected: row.id === store.selectedRowId, 'is-error': row.status >= 500 }" @click="store.selectRow(row.id)">
            <span v-for="[key] in visibleColumns" :key="key" :title="titleFor(row, key)" :style="key === 'status' ? { color: statusColor(row.status) } : {}">{{ valueFor(row, key) }}</span>
          </div>
        </template>
        <div v-if="store.queryLoading" class="access-more"><i class="ph ph-circle-notch spin"></i> Loading more rows…</div>
        <div v-else-if="!store.queryHasMore && store.tailRows.length" class="access-more">Reached the beginning of the log.</div>
      </div>
      <div v-if="!loading && !store.filteredTailRows.length" class="access-message">No rows match the current filters.</div>
    </div>
    <div class="tail-foot"><span>{{ store.filteredTailRows.length.toLocaleString() }} shown · {{ store.queryMatchedRows.toLocaleString() }} matched</span><span style="margin-left:auto;color:var(--color-text)">{{ store.queryUniverse.toLocaleString() }} total rows</span></div>
  </div>
</template>
