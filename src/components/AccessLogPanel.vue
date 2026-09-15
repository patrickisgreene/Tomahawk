<script setup>
import { onMounted, onUnmounted } from "vue";
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import { statusColor, msColor, fmtMs } from "../data/format";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);

const INTERVALS = [10000, 30000, 60000, 300000];
function intervalLabel(ms) {
  return ms < 60000 ? `Every ${ms / 1000}s` : `Every ${ms / 60000}m`;
}
function cycleInterval() {
  const i = INTERVALS.indexOf(store.resyncIntervalMs);
  store.setResyncInterval(INTERVALS[(i + 1) % INTERVALS.length]);
}

onMounted(() => store.startAutoResync());
onUnmounted(() => store.stopAutoResync());

function onFilterKeydown(e) {
  if (e.key === "Enter") store.setTailFilter(e.target.value);
}
</script>

<template>
  <div class="panel-fill">
    <div class="toolbar">
      <div class="chip txt"><i class="ph ph-stack"></i>4 sources<span class="caret">▾</span></div>
      <button class="chip accent" @click="store.resyncNow()"><i class="ph ph-arrows-clockwise"></i>Resync</button>
      <button class="chip" @click="cycleInterval">{{ intervalLabel(store.resyncIntervalMs) }}<span class="caret">▾</span></button>
      <span class="synced-label">synced {{ syncedAgo }}</span>
      <div class="sep"></div>
      <div class="chip"><i class="ph ph-clock-counter-clockwise" style="color:var(--color-neutral-600)"></i>15m</div>
      <div class="chip"><span style="color:var(--color-neutral-600)">buffer</span>5000</div>
      <div class="chip"><span style="color:var(--color-neutral-600)">≥</span>200</div>
      <div class="sep"></div>
      <div class="filterbar">
        <i class="ph ph-funnel" style="color:var(--color-accent-400)"></i>
        <input :value="store.tailFilterText" @keydown="onFilterKeydown" placeholder='status&gt;=400 and path ~ &quot;/checkout&quot;'>
        <span class="kbd">⌘K</span>
      </div>
      <div class="chip txt">Combined<span class="caret">▾</span></div>
      <i class="ph ph-text-align-left" style="color:var(--color-neutral-600)"></i>
      <i class="ph ph-eye" style="color:var(--color-neutral-600)"></i>
      <i class="ph ph-download-simple" style="color:var(--color-neutral-600)"></i>
    </div>

    <div class="stream-tabstrip">
      <div class="stream-tab active"><i class="ph ph-file-text"></i>shop · access.log<span class="close">×</span></div>
      <div class="stream-tab"><i class="ph ph-file-text"></i>api · access.log</div>
      <button class="dock-add" style="margin:0"><i class="ph ph-plus" style="font-size:10px"></i></button>
      <i class="ph ph-corners-out" style="margin-left:auto;color:var(--color-neutral-600)"></i>
    </div>

    <div class="tail-head">
      <span class="sortable" @click="store.toggleSort()">Time<i class="ph" :class="store.tailSortDesc ? 'ph-caret-down' : 'ph-caret-up'"></i></span>
      <span>Client</span><span>Method</span><span>St</span><span>Request</span><span>Bytes</span><span>µs</span>
    </div>
    <div class="tail-body">
      <div
        v-for="r in store.filteredTailRows"
        :key="r.id"
        class="tail-row"
        :class="{ selected: r.id === store.selectedRowId, 'is-error': r.status >= 500 }"
        @click="store.selectRow(r.id)"
      >
        <span style="color:var(--color-neutral-600)">{{ r.time }}</span>
        <span style="color:var(--color-neutral-400)">{{ r.ip }}</span>
        <span style="color:var(--color-accent-2-400)">{{ r.method }}</span>
        <span :style="{ color: statusColor(r.status), fontWeight: 600 }">{{ r.status }}</span>
        <span class="req">{{ r.path }}</span>
        <span style="color:var(--color-neutral-600)">{{ r.bytes }}</span>
        <span class="ms" :style="{ color: msColor(r.ms) }">{{ fmtMs(r.ms) }}</span>
      </div>
    </div>
    <div class="tail-foot">
      <span>{{ store.filteredTailRows.length.toLocaleString() }} rows matched</span>
    </div>
  </div>
</template>
