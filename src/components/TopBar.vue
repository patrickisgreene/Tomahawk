<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen } from "@lucide/vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import FileMenuDropdown from "./FileMenuDropdown.vue";
import { classifyRequest } from "../data/classification";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);
const securityWarningCount = computed(() => store.tailRows.reduce((count, row) => count + classifyRequest(row, store.localRules).length, 0));
const securityHighCount = computed(() => store.tailRows.reduce((count, row) => count + classifyRequest(row, store.localRules).filter((tag) => tag.severity === "high").length, 0));
// Kept as a single UI flag so the updater can populate it once an update
// endpoint/signing configuration is provided.
const updateAvailable = ref(false);
const intervals = [[10000, "Every 10 seconds"], [30000, "Every 30 seconds"], [60000, "Every minute"], [300000, "Every 5 minutes"]];
const intervalLabel = computed(() => store.resyncIntervalMs < 60000 ? store.resyncIntervalMs / 1000 + "s" : store.resyncIntervalMs / 60000 + "m");

const appWindow = getCurrentWindow();
const isMaximized = ref(false);
let unlistenResize;

async function syncMaximized() {
  isMaximized.value = await appWindow.isMaximized();
}

onMounted(async () => {
  await syncMaximized();
  unlistenResize = await appWindow.onResized(syncMaximized);
});
onUnmounted(() => {
  unlistenResize?.();
});

function minimizeWindow() {
  appWindow.minimize();
}
function toggleMaximizeWindow() {
  appWindow.toggleMaximize();
}
function closeWindow() {
  appWindow.close();
}
function newWorkspace() { store.createWorkspace(); }
function rename(item) { const name = window.prompt("Workspace name", item.name); if (name) store.renameWorkspace(item.id, name); }
function openSecurityAlerts() { store.panelVisibility.bottom = true; store.dockActiveTab.bottom = "alerts"; }

const PANEL_TOGGLES = [
  { side: "left", close: PanelLeftClose, open: PanelLeftOpen },
  { side: "right", close: PanelRightClose, open: PanelRightOpen },
  { side: "bottom", close: PanelBottomClose, open: PanelBottomOpen },
];

const NAV = [
  { id: "monitor", label: "Monitor" },
];
// Migrate the original built-in name for users who already have saved state.
if (store.workspaces.length && store.workspaces[0].id === "monitor" && store.workspaces[0].name === "Monitor") {
  store.renameWorkspace("monitor", "Analyze");
}
</script>

<template>
  <div class="topbar" data-tauri-drag-region>
    <div class="topbar-icons">
      <div class="dropdown-anchor">
        <button class="icon-btn" title="Menu" @click="store.toggleFileMenu()"><i class="ph ph-list"></i></button>
        <FileMenuDropdown v-if="store.showFileMenu" />
      </div>
      <button v-for="panel in PANEL_TOGGLES" :key="panel.side" class="icon-btn panel-toggle"
        :class="{ 'is-visible': store.panelVisibility[panel.side] }"
        :title="`${store.panelVisibility[panel.side] ? 'Hide' : 'Show'} ${panel.side} panels`"
        :aria-label="`${store.panelVisibility[panel.side] ? 'Hide' : 'Show'} ${panel.side} panels`"
        :aria-expanded="store.panelVisibility[panel.side]" :aria-controls="`monitor-${panel.side}`"
        @click="store.togglePanel(panel.side)">
        <component :is="store.panelVisibility[panel.side] ? panel.close : panel.open" :size="15" :stroke-width="1.7" aria-hidden="true" />
      </button>
      <button class="icon-btn" title="Settings" @click="store.openSettingsDialog()"><i class="ph ph-gear-six"></i></button>
    </div>
    <details class="resync-picker header-resync">
      <summary class="tail-state" title="Resync settings">
      <i class="ph" :class="store.isSyncing ? 'ph-spinner spin' : 'ph-arrows-clockwise'"></i>
      <span>{{ store.isSyncing ? "Syncing" : "Resync" }}</span>
      <span class="tail-interval">{{ intervalLabel }}</span>
      <span class="caret">▾</span>
      </summary>
      <div class="resync-options">
        <button class="chip accent" :disabled="store.isSyncing" @click="store.resyncNow()">Resync now</button>
        <fieldset><legend>Automatic resync</legend><label v-for="[value, label] in intervals" :key="value"><input type="radio" name="header-resync-interval" :value="value" :checked="store.resyncIntervalMs === value" @change="store.setResyncInterval(value)">{{ label }}</label></fieldset>
      </div>
    </details>
    <span class="header-sync-age">{{ store.isSyncing ? "syncing now" : "synced " + syncedAgo }}</span>
    <div class="topbar-nav">
      <button class="icon-btn" title="Search everything" @click="store.openGlobalSearch()"><i class="ph ph-magnifying-glass"></i></button>
      <span v-for="item in store.workspaces" :key="item.id"
        :class="{ current: store.activeWorkspaceId === item.id }"
        @dblclick="rename(item)" @click="store.loadWorkspace(item.id)">{{ item.name }}<b v-if="item.id !== 'monitor'" class="workspace-close" @click.stop="store.removeWorkspace(item.id)">×</b></span>
      <button class="icon-btn" title="New workspace" @click="newWorkspace"><i class="ph ph-plus"></i></button>
    </div>
    <button v-if="securityWarningCount" class="alert-badge security-badge" :class="{ 'has-high': securityHighCount }" @click="openSecurityAlerts" title="Open classified security warnings">
      <i class="ph ph-shield-warning"></i>{{ securityWarningCount.toLocaleString() }} security warning{{ securityWarningCount === 1 ? '' : 's' }}
    </button>
    <button v-if="updateAvailable" class="warning-badge" title="An app update is available"><i class="ph ph-download-simple"></i>Update available</button>
    <div class="window-controls">
      <button class="icon-btn" title="Minimize" @click="minimizeWindow"><i class="ph ph-minus"></i></button>
      <button class="icon-btn" title="Maximize" @click="toggleMaximizeWindow">
        <i :class="isMaximized ? 'ph ph-corners-in' : 'ph ph-corners-out'"></i>
      </button>
      <button class="icon-btn" title="Close" @click="closeWindow"><i class="ph ph-x"></i></button>
    </div>
  </div>
</template>
