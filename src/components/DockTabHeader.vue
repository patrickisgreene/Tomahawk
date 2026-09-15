<script setup>
// The tab-strip that tops every dock (Sources, Access log/Traffic,
// Error log/Query/Alerts, Inspector/History, and the single-tab docks like
// Throughput). One component instead of copy-pasting this markup 7 times.
//
// The "+" button is shared too: it opens the panel-picker popover (t3),
// anchored to wherever it was clicked.
import { useMonitorStore } from "../store/monitor";

const props = defineProps({
  tabs: { type: Array, required: true }, // [{ id, icon, label, badge? }]
  modelValue: { type: String, required: true },
  dockId: { type: String, default: "" },
});
defineEmits(["update:modelValue"]);
const store = useMonitorStore();

function openPicker(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  store.openPanelPicker(props.dockId, { x: rect.left, y: rect.bottom, width: rect.width, height: rect.height });
}
</script>

<template>
  <div class="dock-tabs">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="dock-tab"
      :class="{ active: tab.id === modelValue }"
      @click="$emit('update:modelValue', tab.id)"
    >
      <i class="ph" :class="tab.icon"></i>{{ tab.label }}
      <span v-if="tab.badge != null" class="badge-count">{{ tab.badge }}</span>
      <span class="close">×</span>
    </button>
    <button class="dock-add" @click="openPicker"><i class="ph ph-plus"></i></button>
    <slot name="trailing" />
  </div>
</template>
