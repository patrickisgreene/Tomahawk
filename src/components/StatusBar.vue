<script setup>
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);
</script>

<template>
  <div class="statusbar">
    <span class="live"><i class="ph ph-arrows-clockwise"></i>Synced {{ syncedAgo }} · every {{ store.resyncIntervalMs / 1000 }}s</span>
    <span>web-03.sfo lagging 4s</span>
    <span class="push"><i class="ph ph-git-diff"></i>Combined parser</span>
    <span style="display:flex;align-items:center;gap:5px"><i class="ph ph-clock"></i>UTC</span>
    <span style="display:flex;align-items:center;gap:5px"><i class="ph ph-database"></i>{{ store.bufferedCount }} buffered · 1.2 GB/day</span>
    <span class="accent" style="display:flex;align-items:center;gap:5px"><i class="ph ph-plugs-connected"></i>18 hosts</span>
  </div>
</template>
