<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import DockTabHeader from "./DockTabHeader.vue";
import { PANEL_REGISTRY } from "../data/panelRegistry";

const props = defineProps({
  dockId: { type: String, required: true },
});
const store = useMonitorStore();

const openIds = computed(() => store.dockTabs[props.dockId] || []);
const validOpenIds = computed(() => openIds.value.filter((id) => PANEL_REGISTRY[id]));
const tabs = computed(() =>
  validOpenIds.value.map((id) => {
    const meta = PANEL_REGISTRY[id];
    return { id, icon: meta.icon, label: meta.label, badge: meta.badge ? meta.badge(store) : null };
  })
);
const activeId = computed(() => {
  const current = store.dockActiveTab[props.dockId];
  return PANEL_REGISTRY[current] ? current : validOpenIds.value[0] || null;
});
</script>

<template>
  <div class="dock">
    <DockTabHeader
      :dock-id="dockId"
      :tabs="tabs"
      :model-value="activeId"
      @update:modelValue="store.setDockTab(dockId, $event)"
      @close="store.closeDockTab(dockId, $event)"
    >
      <template #trailing><slot name="trailing" /></template>
    </DockTabHeader>
    <div v-if="!openIds.length" class="insp-empty">No panels open — use <i class="ph ph-plus"></i> above to add one.</div>
    <component :is="PANEL_REGISTRY[id].component" v-for="id in validOpenIds" :key="id" v-show="id === activeId" />
  </div>
</template>
