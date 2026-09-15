<script setup>
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import FileMenuDropdown from "./FileMenuDropdown.vue";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);

const NAV = [
  { id: "monitor", label: "Monitor" },
  { id: "explore", label: "Explore" },
  { id: "reports", label: "Reports" },
  { id: "alerts", label: "Alerts" },
  { id: "hosts", label: "Hosts" },
];
</script>

<template>
  <div class="topbar">
    <div class="topbar-icons">
      <div class="dropdown-anchor">
        <button class="icon-btn" title="Menu" @click="store.toggleFileMenu()"><i class="ph ph-list"></i></button>
        <FileMenuDropdown v-if="store.showFileMenu" />
      </div>
      <button class="icon-btn" title="Undo"><i class="ph ph-arrow-counter-clockwise"></i></button>
      <button class="icon-btn" title="Redo"><i class="ph ph-arrow-clockwise"></i></button>
      <button class="icon-btn" title="Bookmarks"><i class="ph ph-bookmark-simple"></i></button>
      <button class="icon-btn" title="Settings" @click="store.openSettingsDialog()"><i class="ph ph-gear-six"></i></button>
    </div>
    <button class="tail-state" @click="store.resyncNow()" title="Pull the latest lines now">
      <i class="ph ph-arrows-clockwise"></i>
      <span>Resync</span>
      <span class="caret">▾</span>
    </button>
    <div class="topbar-nav">
      <button class="icon-btn" title="Search everything" @click="store.openGlobalSearch()"><i class="ph ph-magnifying-glass"></i></button>
      <span
        v-for="item in NAV"
        :key="item.id"
        :class="{ current: store.currentPage === item.id }"
        @click="store.setPage(item.id)"
      >{{ item.label }}</span>
      <i class="ph ph-plus"></i>
    </div>
    <div class="alert-badge"><i class="ph ph-warning"></i>2 alerts firing</div>
    <div class="window-controls">
      <button class="icon-btn" title="Minimize"><i class="ph ph-minus"></i></button>
      <button class="icon-btn" title="Maximize"><i class="ph ph-square"></i></button>
      <button class="icon-btn" title="Close"><i class="ph ph-x"></i></button>
    </div>
  </div>
</template>
