<script setup>
import { computed, ref } from "vue";
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const filterText = ref("");
const filtered = computed(() => {
  const q = filterText.value.trim().toLowerCase();
  if (!q) return store.hosts;
  return store.hosts.filter((h) => `${h.name} ${h.role} ${h.region}`.toLowerCase().includes(q));
});
const healthy = computed(() => store.hosts.filter((h) => h.dot === "var(--st2)").length);
const lagging = computed(() => store.hosts.filter((h) => h.dot === "var(--st4)").length);
const offline = computed(() => store.hosts.filter((h) => h.dot === "var(--st5)").length);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="page-title">Hosts</span>
      <span class="page-meta">{{ store.hosts.length }} hosts · 3 regions</span>
      <div class="filterbar" style="max-width:260px;margin-left:12px"><i class="ph ph-magnifying-glass"></i><input v-model="filterText" placeholder="Filter hosts…"></div>
      <div class="chip txt">All statuses<span class="caret">▾</span></div>
      <button class="chip outline" style="margin-left:auto"><i class="ph ph-plus"></i>Add host</button>
    </div>
    <div class="page-table-head hosts-cols">
      <span></span><span>Host</span><span>Region</span><span>Vhosts</span><span>Srcs</span><span>Last sync</span><span>Ingest</span><span>Buffer</span><span></span>
    </div>
    <div class="page-table-body">
      <div v-for="h in filtered" :key="h.name" class="page-table-row hosts-cols">
        <span class="dot" :style="{ background: h.dot }"></span>
        <div style="min-width:0"><div class="host-name">{{ h.name }}</div><div class="host-role">{{ h.role }}</div></div>
        <span class="cell-muted">{{ h.region }}</span>
        <span class="cell-mono">{{ h.vhosts }}</span>
        <span class="cell-mono">{{ h.sources }}</span>
        <span class="cell-mono" :style="{ color: h.syncColor }">{{ h.sync }}</span>
        <span class="cell-mono">{{ h.ingest }}</span>
        <span class="cell-mono">{{ h.buffer }}</span>
        <i class="ph ph-dots-three-vertical" style="color:var(--color-neutral-600)"></i>
      </div>
    </div>
    <div class="page-footer">
      <span style="color:var(--st2)">{{ healthy }} healthy</span>
      <span style="color:var(--st4)">{{ lagging }} lagging</span>
      <span style="color:var(--st5)">{{ offline }} offline</span>
      <span style="margin-left:auto">UTC</span>
    </div>
  </div>
</template>
