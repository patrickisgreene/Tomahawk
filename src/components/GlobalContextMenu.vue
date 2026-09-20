<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useMonitorStore } from "../store/monitor";
import { useClickOutside } from "../composables/useClickOutside";
import { openDevtools } from "../data/systemApi";

// Mounted with `v-if="store.globalContextMenu"` (see App.vue) — the
// fallback menu for right-clicks that land outside a log row (which gets
// the richer RowContextMenu instead). Every other native context-menu item
// (Back/Reload/Save as/Print/Cast…) doesn't apply to a desktop app with no
// page navigation, and Share has nothing row-specific to attach here (it's
// the same static text every time), so only Inspect is worth replacing.
const store = useMonitorStore();
useClickOutside(() => store.closeGlobalContextMenu());

const MENU_WIDTH = 180;
const menuRef = ref(null);
const menuStyle = ref({});

function reposition() {
  const anchor = store.globalContextMenu;
  if (!anchor) return;
  const height = menuRef.value?.getBoundingClientRect().height || 0;
  const left = Math.max(6, Math.min(anchor.x, window.innerWidth - MENU_WIDTH - 6));
  const top = Math.max(6, Math.min(anchor.y, window.innerHeight - height - 6));
  menuStyle.value = { left: `${left}px`, top: `${top}px`, width: `${MENU_WIDTH}px` };
}

function onKeydown(event) {
  if (event.key === "Escape") store.closeGlobalContextMenu();
}

onMounted(async () => {
  await nextTick();
  reposition();
  document.addEventListener("keydown", onKeydown);
});
onUnmounted(() => document.removeEventListener("keydown", onKeydown));

function inspect() {
  openDevtools();
  store.closeGlobalContextMenu();
}
</script>

<template>
  <div class="popup-backdrop" @click="store.closeGlobalContextMenu()"></div>
  <div ref="menuRef" class="popover ctx-menu" :style="menuStyle" @click.stop>
    <div class="dropdown-item" @click="inspect"><i class="ph ph-code"></i>Inspect</div>
  </div>
</template>
