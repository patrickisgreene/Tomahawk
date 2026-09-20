<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useMonitorStore, STANDARD_HTTP_METHODS, NONSTANDARD_METHOD_VALUE } from "../store/monitor";
import { statusColor, fmtMs, fmtBytes, formatTimestamp } from "../data/format";
import AppSelect from "./AppSelect.vue";
import DomainSelect from "./DomainSelect.vue";
import RowContextMenu from "./RowContextMenu.vue";

const store = useMonitorStore();
const relativeClock = ref(Date.now());
const draggedColumn = ref(null);
const dragOverColumn = ref(null);
const resizingColumn = ref(null);
const columnMenuOpen = ref(false);
let relativeTimer;
const domains = computed(() => store.tailRows.map((row) => row.hostname?.toLowerCase()).filter((host) => host && host !== "-"));
const sourceOptions = computed(() => [
  { value: "", label: `All sources (${store.sources.filter((s) => !s.hidden).length})` },
  ...store.sources.map((source) => ({ value: source.id, label: source.hidden ? `${source.label} (hidden)` : source.label })),
]);
const rawDomains = computed(() => (store.domains.length ? store.domains : domains.value));
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
const methodOptions = [
  { value: "", label: "All methods" },
  ...STANDARD_HTTP_METHODS.map((method) => ({ value: method, label: method })),
  { value: NONSTANDARD_METHOD_VALUE, label: "Non-standard methods" },
];
const tagOptions = computed(() => [
  { value: "", label: "All tags" },
  ...store.tags.map((tag) => ({ value: tag, label: tag })),
]);
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
  ["tags", "Tags", 180],
];
// "tags" is a joined field, not a real backend column — it can't be pushed
// through query_column()/ORDER BY like the others, so its header isn't
// click-to-sort (see the template).
const UNSORTABLE_COLUMNS = new Set(["tags"]);
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
  gridTemplateColumns: visibleColumns.value.map(([key, , width]) => `${store.accessColumnLayout.widths[key] ?? width}px`).join(" "),
}));
// The backend/store sort field for a column key ("timestamp" sorts by the
// numeric "ts" column, not the pre-formatted "timestamp" text column).
function sortFieldFor(key) {
  return key === "timestamp" ? "ts" : key;
}
function valueFor(row, key) {
  if (key === "bytes") return fmtBytes(row.bytes);
  if (key === "ms") return fmtMs(row.ms);
  if (key === "tags") return (row.tags || []).join(", ") || "-";
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
// Auto-fit-to-content: shrink each column (that the user hasn't manually
// drag-resized) to the widest header/cell text currently loaded, so adding
// more columns doesn't require hand-dragging every one down. Measured via a
// throwaway canvas rather than the DOM so it stays cheap even with the
// row/header chrome (drag handle, sort caret, gap) folded in as flat
// allowances instead of real layout.
const ROW_FONT = "400 11px ui-monospace, Menlo, monospace";
const HEADER_CHROME_WIDTH = 38;
const ROW_TEXT_PADDING = 6;
const AUTO_FIT_SAMPLE_SIZE = 400;
let measureCtx = null;
let headerFont = null;
function getMeasureCtx() {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}
function getHeaderFont() {
  if (!headerFont) headerFont = `500 9.5px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
  return headerFont;
}
function computeAutoColumnWidths() {
  const ctx = getMeasureCtx();
  const sample = store.filteredTailRows.slice(0, AUTO_FIT_SAMPLE_SIZE);
  const widths = {};
  for (const [key, label] of visibleColumns.value) {
    if (store.accessColumnLayout.resized.includes(key)) continue;
    ctx.font = getHeaderFont();
    let max = ctx.measureText(key === "timestamp" ? timestampLabel.value : label).width + HEADER_CHROME_WIDTH;
    ctx.font = ROW_FONT;
    for (const row of sample) {
      const width = ctx.measureText(String(valueFor(row, key))).width + ROW_TEXT_PADDING;
      if (width > max) max = width;
    }
    widths[key] = max;
  }
  if (Object.keys(widths).length) store.setAutoColumnWidths(widths);
}
let autoFitTimer = null;
function scheduleAutoFit() {
  clearTimeout(autoFitTimer);
  autoFitTimer = setTimeout(computeAutoColumnWidths, 150);
}
function clearColumnResize(key) {
  store.clearAccessColumnResize(key);
  scheduleAutoFit();
}
function startColumnDrag(event, key) {
  draggedColumn.value = key;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", key);
}
// Explicitly setting dropEffect (not just calling preventDefault) is what
// keeps the cursor showing "move" instead of "not-allowed" while dragging
// over a valid target — some WebViews don't infer it from effectAllowed.
function onColumnDragOver(event, key) {
  event.dataTransfer.dropEffect = "move";
  dragOverColumn.value = key;
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
const lastResizeX = ref(0);
// Drag-to-resize a column header, mirroring Splitter.vue's pointer-capture
// pattern. Kept separate from the header cell's native HTML5 drag-and-drop
// reorder (the handle sets draggable="false" so it can't start that instead).
function startColumnResize(event, key) {
  event.preventDefault();
  event.stopPropagation();
  resizingColumn.value = key;
  lastResizeX.value = event.clientX;
  window.addEventListener("pointermove", onColumnResize);
  window.addEventListener("pointerup", endColumnResize);
  window.addEventListener("pointercancel", endColumnResize);
}
function onColumnResize(event) {
  if (!resizingColumn.value) return;
  const delta = event.clientX - lastResizeX.value;
  if (delta === 0) return;
  lastResizeX.value = event.clientX;
  store.resizeAccessColumn(resizingColumn.value, delta);
}
function endColumnResize() {
  resizingColumn.value = null;
  window.removeEventListener("pointermove", onColumnResize);
  window.removeEventListener("pointerup", endColumnResize);
  window.removeEventListener("pointercancel", endColumnResize);
}
const scrollRef = ref(null);
// Infinite table: scrolling toward the bottom fetches the next SQL page for
// the current filters (the whole database is searched, not just loaded rows).
function onTableScroll() {
  const el = scrollRef.value;
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
    store.loadMoreQuery();
  }
}
watch(() => store.filteredTailRows, scheduleAutoFit);
watch(visibleColumns, scheduleAutoFit);
onMounted(async () => {
  await store.hydrateTailRows();
  store.startAutoResync();
  relativeTimer = setInterval(() => { relativeClock.value = Date.now(); }, 30000);
  computeAutoColumnWidths();
});
onUnmounted(() => {
  store.stopAutoResync();
  clearInterval(relativeTimer);
  clearTimeout(autoFitTimer);
  endColumnResize();
});
</script>

<template>
  <div class="panel-fill access-panel">
    <div class="toolbar access-toolbar">
      <div class="access-controls">
      <AppSelect :model-value="store.tailSourceId" :options="sourceOptions" aria-label="Source" @update:model-value="store.setTailSource($event)" />
      <DomainSelect :raw-domains="rawDomains" />
      <AppSelect :model-value="store.tailWindowMs" :options="windowOptions" aria-label="Time window relative to the newest entry" @update:model-value="store.setTailWindow($event)" />
      <AppSelect :model-value="store.tailMinStatus" :options="statusOptions" aria-label="Minimum status" @update:model-value="store.setTailMinStatus($event)" />
      <AppSelect :model-value="store.tailMethod" :options="methodOptions" aria-label="Method" @update:model-value="store.setTailMethod($event)" />
      <AppSelect :model-value="store.tailTag" :options="tagOptions" aria-label="Tag" @update:model-value="store.setTailTag($event)" />
      </div>
      <div class="filterbar">
        <i class="ph ph-funnel"></i>
        <input
          :value="store.tailFilterText"
          @input="store.setTailFilter($event.target.value)"
          aria-label="Search all log fields"
          :placeholder="store.tailFilterRegex ? 'Regex search…' : 'Search the entire database…'"
          title="Prefix with ! to exclude matches, e.g. !googlebot"
        >
        <button
          type="button"
          class="filter-toggle"
          :class="{ active: store.tailFilterCaseSensitive }"
          :aria-pressed="store.tailFilterCaseSensitive"
          title="Case-sensitive search"
          @click="store.setTailFilterCaseSensitive(!store.tailFilterCaseSensitive)"
        >Aa</button>
        <button
          type="button"
          class="filter-toggle"
          :class="{ active: store.tailFilterRegex }"
          :aria-pressed="store.tailFilterRegex"
          title="Regex search"
          @click="store.setTailFilterRegex(!store.tailFilterRegex)"
        >.*</button>
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
            @dragover.prevent="onColumnDragOver($event, key)"
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
    <div class="access-scroll" ref="scrollRef" @scroll="onTableScroll">
      <div class="tail-head access-head" :style="gridStyle">
        <span
          v-for="[key, label] in visibleColumns"
          :key="key"
          class="tail-head-cell"
          :class="{ dragging: draggedColumn === key, 'drag-over': dragOverColumn === key && draggedColumn !== key, resizing: resizingColumn === key }"
          draggable="true"
          @dragstart="startColumnDrag($event, key)"
          @dragover.prevent="onColumnDragOver($event, key)"
          @dragleave="dragOverColumn === key && (dragOverColumn = null)"
          @drop.prevent="dropColumn($event, key)"
          @dragend="endColumnDrag"
        >
          <i class="ph ph-dots-six-vertical tail-head-drag" title="Drag to reorder"></i>
          <button v-if="!UNSORTABLE_COLUMNS.has(key)" class="col-sort" @click="store.setSort(key)" :aria-label="`Sort by ${label}`">
            {{ key === 'timestamp' ? timestampLabel : label }}
            <i v-if="store.tailSortBy === sortFieldFor(key)" class="ph" :class="store.tailSortDesc ? 'ph-caret-down' : 'ph-caret-up'"></i>
          </button>
          <span v-else class="col-sort col-sort-static">{{ label }}</span>
          <span
            class="col-resize-handle"
            draggable="false"
            title="Drag to resize column. Double-click to auto-fit."
            @pointerdown="startColumnResize($event, key)"
            @dblclick.stop="clearColumnResize(key)"
            @dragover.prevent.stop="onColumnDragOver($event, key)"
            @drop.prevent.stop="dropColumn($event, key)"
          ></span>
        </span>
      </div>
      <div class="access-table">
        <template v-if="loading">
          <div v-for="i in 8" :key="i" class="tail-row skel" :style="gridStyle"><span v-for="[key] in visibleColumns" :key="key" class="skel-bar"></span></div>
        </template>
        <template v-else>
          <div
            v-for="row in store.filteredTailRows"
            :key="row.id"
            class="tail-row"
            :style="gridStyle"
            :class="{ selected: row.id === store.selectedRowId, 'is-error': row.status >= 500 }"
            @click="store.selectRow(row.id)"
            @contextmenu.prevent="store.openRowContextMenu(row.id, $event.clientX, $event.clientY)"
          >
            <span v-for="[key] in visibleColumns" :key="key" :title="titleFor(row, key)" :style="key === 'status' ? { color: statusColor(row.status) } : {}">{{ valueFor(row, key) }}</span>
          </div>
        </template>
        <div v-if="store.queryLoading" class="access-more"><i class="ph ph-circle-notch spin"></i> Loading more rows…</div>
        <div v-else-if="!store.queryHasMore && store.tailRows.length" class="access-more">Reached the beginning of the log.</div>
      </div>
      <div v-if="!loading && !store.filteredTailRows.length" class="access-message">No rows match the current filters.</div>
    </div>
    <div class="tail-foot"><span>{{ store.filteredTailRows.length.toLocaleString() }} shown · {{ store.queryMatchedRows.toLocaleString() }} matched</span><span style="margin-left:auto;color:var(--color-text)">{{ store.queryUniverse.toLocaleString() }} total rows</span></div>
    <RowContextMenu v-if="store.rowContextMenu" />
  </div>
</template>
