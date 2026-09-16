<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PanelBottomClose, PanelBottomOpen } from "@lucide/vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMonitorStore } from "../store/monitor";
import { useRelativeTime } from "../composables/useRelativeTime";
import FileMenuDropdown from "./FileMenuDropdown.vue";
import PromptDialog from "./PromptDialog.vue";
import { classifyRequest } from "../data/classification";

const store = useMonitorStore();
const syncedAgo = useRelativeTime(() => store.lastSyncedAt);
const resyncOpen = ref(false);
const securityWarningCount = computed(() => store.tailRows.reduce((count, row) => count + classifyRequest(row, store.localRules).length, 0));
const securityHighCount = computed(() => store.tailRows.reduce((count, row) => count + classifyRequest(row, store.localRules).filter((tag) => tag.severity === "high").length, 0));
// Checks the GitHub releases page so the badge stays hidden until a newer
// release is published, then opens the release page when clicked.
const REPO = "patrickisgreene/Tomahawk";
const RELEASE_PAGE = `https://github.com/${REPO}/releases/latest`;
const UPDATE_CHECK_MS = 30 * 60 * 1000;
const updateAvailable = ref(false);
const releaseUrl = ref(RELEASE_PAGE);
let currentVersion = null;
let updateTimer;

function parseVersion(text) {
  const match = String(text || "").trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [+match[1] || 0, +match[2] || 0, +match[3] || 0];
}

function isNewerVersion(candidate, current) {
  if (!candidate || !current) return false;
  return (
    candidate[0] > current[0] ||
    (candidate[0] === current[0] && candidate[1] > current[1]) ||
    (candidate[0] === current[0] && candidate[1] === current[1] && candidate[2] > current[2])
  );
}

async function checkForUpdate() {
  try {
    const release = await invoke("check_latest_release", { repo: REPO });
    if (!release) return;
    if (isNewerVersion(parseVersion(release.tagName), currentVersion)) {
      releaseUrl.value = release.htmlUrl || RELEASE_PAGE;
      updateAvailable.value = true;
    }
  } catch {
    // ignore network/parse failures; keep the badge hidden
  }
}

function openReleasePage() {
  openUrl(releaseUrl.value);
}
const intervals = [
  [1800000, "Every 30 minutes"],
  [3600000, "Every hour"],
  [21600000, "Every 6 hours"],
  [43200000, "Every 12 hours"],
];
const intervalLabel = computed(() => {
  if (store.resyncIntervalMs < 3600000) return store.resyncIntervalMs / 60000 + "m";
  return store.resyncIntervalMs / 3600000 + "h";
});

const appWindow = getCurrentWindow();
const isMaximized = ref(false);
let unlistenResize;

async function syncMaximized() {
  isMaximized.value = await appWindow.isMaximized();
}

onMounted(async () => {
  await syncMaximized();
  unlistenResize = await appWindow.onResized(syncMaximized);
  try {
    currentVersion = parseVersion(await getVersion());
  } catch {
    currentVersion = null;
  }
  await checkForUpdate();
  updateTimer = setInterval(checkForUpdate, UPDATE_CHECK_MS);
});
onUnmounted(() => {
  unlistenResize?.();
  clearInterval(updateTimer);
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
const renaming = ref(null);
function rename(item) { renaming.value = item; }
function cancelRename() { renaming.value = null; }
function confirmRename(name) { if (renaming.value) store.renameWorkspace(renaming.value.id, name); renaming.value = null; }
function openSecurityAlerts() { store.panelVisibility.bottom = true; store.dockActiveTab.bottom = "alerts"; }
function closeResyncMenu() { resyncOpen.value = false; }
function setResyncInterval(value) {
  store.setResyncInterval(value);
  closeResyncMenu();
}

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
    <div class="resync-picker header-resync" :class="{ open: resyncOpen }">
      <div v-if="resyncOpen" class="popup-backdrop" @click="closeResyncMenu"></div>
      <button class="tail-state" title="Resync settings" @click="resyncOpen = !resyncOpen">
      <i class="ph" :class="store.isSyncing ? 'ph-spinner spin' : 'ph-arrows-clockwise'"></i>
      <span>{{ store.isSyncing ? "Syncing" : "Resync" }}</span>
      <span class="tail-interval">{{ intervalLabel }}</span>
      <span class="caret">▾</span>
      </button>
      <div v-if="resyncOpen" class="resync-options" @click.stop>
        <button class="chip accent" :disabled="store.isSyncing" @click="store.resyncNow(); closeResyncMenu()">Resync now</button>
        <fieldset><legend>Automatic resync</legend><label v-for="[value, label] in intervals" :key="value"><input type="radio" name="header-resync-interval" :value="value" :checked="store.resyncIntervalMs === value" @change="setResyncInterval(value)">{{ label }}</label></fieldset>
      </div>
    </div>
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
    <button v-if="updateAvailable" class="warning-badge" title="A new version is available - open the release page" @click="openReleasePage"><i class="ph ph-download-simple"></i>Update available</button>
    <div class="window-controls">
      <button class="icon-btn" title="Minimize" @click="minimizeWindow"><i class="ph ph-minus"></i></button>
      <button class="icon-btn" title="Maximize" @click="toggleMaximizeWindow">
        <i :class="isMaximized ? 'ph ph-corners-in' : 'ph ph-corners-out'"></i>
      </button>
      <button class="icon-btn" title="Close" @click="closeWindow"><i class="ph ph-x"></i></button>
    </div>
    <PromptDialog
      v-if="renaming"
      title="Rename workspace"
      label="Workspace name"
      :initial="renaming.name"
      confirm-label="Save"
      @confirm="confirmRename"
      @cancel="cancelRename"
    />
  </div>
</template>
