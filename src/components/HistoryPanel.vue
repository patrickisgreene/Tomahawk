<script setup>
import { ref, computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { statusColor } from "../data/format";

const store = useMonitorStore();
const filterText = ref("");

const justNowMs = 15 * 60 * 1000;

const groups = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  const now = Date.now();
  const items = store.history.filter((h) => !q || `${h.path} ${h.status} ${h.method}`.toLowerCase().includes(q));
  const justNow = items.filter((h) => now - h.viewedAt < justNowMs);
  const earlier = items.filter((h) => now - h.viewedAt >= justNowMs);
  return [
    { label: "Just now", items: justNow },
    { label: "Earlier today", items: earlier },
  ].filter((g) => g.items.length);
});
</script>

<template>
  <div class="panel-fill">
    <div class="search-row">
      <div class="filterbar">
        <i class="ph ph-magnifying-glass"></i>
        <input v-model="filterText" placeholder="Filter history…">
      </div>
      <i class="ph ph-trash" style="color:var(--color-neutral-600);cursor:pointer" @click="store.clearHistory()" title="Clear history"></i>
    </div>

    <div v-if="!store.history.length" class="insp-empty">Nothing viewed yet — select a row in the Access log.</div>

    <div v-else class="history-list">
      <template v-for="g in groups" :key="g.label">
        <div class="history-group-label">{{ g.label }}</div>
        <div
          v-for="h in g.items"
          :key="h.id"
          class="history-row"
          :class="{ selected: h.id === store.selectedRowId }"
          @click="store.reopenHistoryEntry(h.id)"
        >
          <span class="history-status" :style="{ color: statusColor(h.status) }">{{ h.status }}</span>
          <div style="min-width:0">
            <div class="history-line">{{ h.method }} {{ h.path }}</div>
            <div class="history-meta" :style="h.id === store.selectedRowId ? { color: 'var(--color-accent-300)' } : {}">
              {{ h.time }}{{ h.id === store.selectedRowId ? " · viewing" : "" }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="history-foot">{{ store.history.length }} viewed today<span style="margin-left:auto">click to reopen</span></div>
  </div>
</template>
