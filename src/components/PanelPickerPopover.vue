<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { useClickOutside } from "../composables/useClickOutside";

const store = useMonitorStore();
useClickOutside(() => store.closePanelPicker());

const style = computed(() => {
  const a = store.panelPicker.anchor;
  return { left: a.x + "px", top: a.y + 6 + "px" };
});
const panelCount = computed(() => store.panelCatalog.reduce((n, g) => n + g.items.length, 0));
</script>

<template>
  <div class="popover panel-picker" :style="style" @click.stop>
    <div class="popover-search">
      <i class="ph ph-magnifying-glass"></i>
      <input
        autofocus
        :value="store.panelPicker.query"
        @input="store.setPanelPickerQuery($event.target.value)"
        placeholder="Search panels…"
      >
      <span class="kbd-hint">esc</span>
    </div>
    <div class="popover-list">
      <template v-for="group in store.filteredPanelCatalog" :key="group.group">
        <div class="popover-group-label">{{ group.group }}</div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="popover-item"
          @click="store.choosePanelFromPicker(item.id)"
        >
          <i class="ph" :class="item.icon"></i>
          <div style="min-width:0">
            <div class="popover-item-name">{{ item.name }}</div>
            <div class="popover-item-desc">{{ item.desc }}</div>
          </div>
          <span v-if="store.openPanelIds.has(item.id)" class="popover-item-open">already open</span>
        </div>
      </template>
      <div v-if="!store.filteredPanelCatalog.length" class="insp-empty">No panels match.</div>
    </div>
    <div class="popover-foot">
      <span><span class="kbd-hint-inline">↑↓</span> navigate</span>
      <span><span class="kbd-hint-inline">↵</span> add here</span>
      <span style="margin-left:auto">{{ panelCount }} panels</span>
    </div>
  </div>
</template>
