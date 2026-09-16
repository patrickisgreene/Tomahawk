<script setup>
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import { computed } from "vue";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);
const sourceFileCount = computed(() => store.sources.reduce((total, source) => total + (source.files?.length || 0), 0));
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
const syncLabel = computed(() => store.isSyncing ? "Syncing" : "Synced");
const intervalLabel = computed(() => {
  if (store.resyncIntervalMs < 3600000) return `${store.resyncIntervalMs / 60000}m`;
  return `${store.resyncIntervalMs / 3600000}h`;
});
</script>

<template>
  <div class="statusbar">
    <span class="live"><i class="ph ph-arrows-clockwise" :class="{ spin: store.isSyncing }"></i>{{ syncLabel }} {{ syncedAgo }} · every {{ intervalLabel }}</span>
    <span v-if="store.syncError" class="status-error status-error-tip" tabindex="0">sync error
      <span class="status-error-popover" role="tooltip">{{ store.syncError }}</span>
    </span>
    <span class="push" style="display:flex;align-items:center;gap:5px"><i class="ph ph-files"></i>{{ sourceFileCount }} log files · {{ store.tailRows.length.toLocaleString() }} loaded</span>
    <span style="display:flex;align-items:center;gap:5px"><i class="ph ph-clock"></i>{{ timezone }}</span>
    <span style="display:flex;align-items:center;gap:5px"><i class="ph ph-database"></i>{{ store.bufferedCount }} buffered</span>
    <span class="accent" style="display:flex;align-items:center;gap:5px"><i class="ph ph-plugs-connected"></i>{{ store.sources.length }} sources</span>
  </div>
</template>
