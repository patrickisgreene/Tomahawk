<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useMonitorStore } from "../store/monitor";
import { formatTimestamp, statusColor } from "../data/format";

const store = useMonitorStore();
const filterText = ref("");
const historyListEl = ref(null);
const selectedRowEl = ref(null);

const contextRows = computed(() => {
  if (!store.selectedRowId) return [];
  const q = filterText.value.trim().toLowerCase();
  return store.filteredTailRows
    .filter((row) => !q || `${row.path} ${row.status} ${row.method} ${row.ip} ${row.hostname || ""}`.toLowerCase().includes(q));
});
const beforeRows = computed(() => contextRows.value.filter((row) => row.id !== store.selectedRowId && row.ts <= (store.selectedRow?.ts ?? 0)));
const selectedContextRow = computed(() => contextRows.value.find((row) => row.id === store.selectedRowId) || null);
const afterRows = computed(() => contextRows.value.filter((row) => row.id !== store.selectedRowId && row.ts > (store.selectedRow?.ts ?? 0)));
const historyIsActive = computed(() => Object.values(store.dockActiveTab).includes("history"));

function scrollSelectedIntoContext() {
  const list = historyListEl.value;
  const row = selectedRowEl.value;
  if (!list || !row || !list.clientHeight) return;
  list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
}

async function scheduleContextScroll() {
  await nextTick();
  requestAnimationFrame(() => {
    scrollSelectedIntoContext();
    requestAnimationFrame(scrollSelectedIntoContext);
  });
}

watch(
  () => [store.selectedRowId, filterText.value, contextRows.value.length],
  () => scheduleContextScroll(),
  { immediate: true }
);
watch(historyIsActive, (active) => {
  if (active) scheduleContextScroll();
});
</script>

<template>
  <div class="panel-fill">
    <div class="search-row">
      <div class="filterbar">
        <i class="ph ph-magnifying-glass"></i>
        <input v-model="filterText" placeholder="Filter context…">
      </div>
    </div>

    <div v-if="!store.selectedRowId" class="insp-empty">Select a row in the Access log to see nearby entries.</div>
    <div v-else-if="!contextRows.length" class="insp-empty">No nearby loaded rows match this filter.</div>

    <div v-else ref="historyListEl" class="history-list">
      <div v-if="beforeRows.length" class="history-group-label">Before</div>
      <div
        v-for="row in beforeRows"
        :key="row.id"
        class="history-row"
        @click="store.reopenHistoryEntry(row.id)"
      >
        <span class="history-status" :style="{ color: statusColor(row.status) }">{{ row.status }}</span>
        <div style="min-width:0">
          <div class="history-line">{{ row.method }} {{ row.path }}</div>
          <div class="history-meta">{{ formatTimestamp(row, store.displayTimezone, store.timeDisplayFormat) }}</div>
        </div>
      </div>
      <div v-if="selectedContextRow" class="history-group-label">Selected</div>
      <div
        v-if="selectedContextRow"
        ref="selectedRowEl"
        class="history-row selected"
        @click="store.reopenHistoryEntry(selectedContextRow.id)"
      >
        <span class="history-status" :style="{ color: statusColor(selectedContextRow.status) }">{{ selectedContextRow.status }}</span>
        <div style="min-width:0">
          <div class="history-line">{{ selectedContextRow.method }} {{ selectedContextRow.path }}</div>
          <div class="history-meta" style="color:var(--color-accent-300)">{{ formatTimestamp(selectedContextRow, store.displayTimezone, store.timeDisplayFormat) }} · selected</div>
        </div>
      </div>
      <div v-if="afterRows.length" class="history-group-label">After</div>
      <div
        v-for="row in afterRows"
        :key="row.id"
        class="history-row"
        @click="store.reopenHistoryEntry(row.id)"
      >
        <span class="history-status" :style="{ color: statusColor(row.status) }">{{ row.status }}</span>
        <div style="min-width:0">
          <div class="history-line">{{ row.method }} {{ row.path }}</div>
          <div class="history-meta">{{ formatTimestamp(row, store.displayTimezone, store.timeDisplayFormat) }}</div>
        </div>
      </div>
    </div>

    <div class="history-foot">{{ contextRows.length }} loaded rows in context<span style="margin-left:auto">click to inspect</span></div>
  </div>
</template>
