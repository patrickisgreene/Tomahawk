<script setup>
import { computed } from "vue";
import { useMonitorStore } from "./store/monitor";
import TopBar from "./components/TopBar.vue";
import StatusBar from "./components/StatusBar.vue";
import MonitorPage from "./components/MonitorPage.vue";
import ExplorePage from "./components/ExplorePage.vue";
import ReportsPage from "./components/ReportsPage.vue";
import AlertsPage from "./components/AlertsPage.vue";
import HostsPage from "./components/HostsPage.vue";
import PanelPickerPopover from "./components/PanelPickerPopover.vue";
import AddSourceDialog from "./components/AddSourceDialog.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import GlobalSearchPalette from "./components/GlobalSearchPalette.vue";

const store = useMonitorStore();
const PAGES = {
  monitor: MonitorPage,
  explore: ExplorePage,
  reports: ReportsPage,
  alerts: AlertsPage,
  hosts: HostsPage,
};
const currentPageComponent = computed(() => PAGES[store.currentPage] || MonitorPage);
</script>

<template>
  <div class="app">
    <TopBar />
    <component :is="currentPageComponent" />
    <StatusBar />

    <PanelPickerPopover v-if="store.panelPicker" />
    <AddSourceDialog v-if="store.showAddSourceDialog" />
    <SettingsDialog v-if="store.showSettingsDialog" />
    <GlobalSearchPalette v-if="store.showGlobalSearch" />
  </div>
</template>
