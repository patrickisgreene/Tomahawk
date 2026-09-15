<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import DockTabHeader from "./DockTabHeader.vue";
import ErrorLogPanel from "./ErrorLogPanel.vue";
import QueryPanel from "./QueryPanel.vue";
import AlertsPanel from "./AlertsPanel.vue";

const store = useMonitorStore();
const tabs = computed(() => [
  { id: "errlog", icon: "ph-warning-circle", label: "Error log", badge: store.errors.length },
  { id: "query", icon: "ph-funnel", label: "Query" },
  { id: "alerts", icon: "ph-bell-ringing", label: "Alerts" },
]);
</script>

<template>
  <div class="dock">
    <DockTabHeader dock-id="bottom" :tabs="tabs" :model-value="store.activeBottomTab" @update:modelValue="store.setBottomTab" />
    <ErrorLogPanel v-show="store.activeBottomTab === 'errlog'" />
    <QueryPanel v-show="store.activeBottomTab === 'query'" />
    <AlertsPanel v-show="store.activeBottomTab === 'alerts'" />
  </div>
</template>
