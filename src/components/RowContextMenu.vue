<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useMonitorStore } from "../store/monitor";
import { useClickOutside } from "../composables/useClickOutside";
import { openDevtools, shareText } from "../data/systemApi";

// Mounted with `v-if="store.rowContextMenu"` (see AccessLogPanel.vue), so
// store.rowContextMenu is assumed non-null for this component's whole
// lifetime — same convention as PanelPickerPopover/FileMenuDropdown.
const store = useMonitorStore();
useClickOutside(() => store.closeRowContextMenu());

const MENU_WIDTH = 260;
const menuRef = ref(null);
const menuStyle = ref({});
const newTag = ref("");

const row = computed(() => store.tailRows.find((r) => r.id === store.rowContextMenu?.rowId) || null);

function reposition() {
  const anchor = store.rowContextMenu;
  if (!anchor) return;
  const height = menuRef.value?.getBoundingClientRect().height || 0;
  const left = Math.max(6, Math.min(anchor.x, window.innerWidth - MENU_WIDTH - 6));
  const top = Math.max(6, Math.min(anchor.y, window.innerHeight - height - 6));
  menuStyle.value = { left: `${left}px`, top: `${top}px`, width: `${MENU_WIDTH}px` };
}

// Re-measure whenever the tag list changes height (add/remove), not just on
// open, so the menu never overflows the viewport as it grows or shrinks.
watch(() => row.value?.tags?.length, async () => {
  await nextTick();
  reposition();
});

function onKeydown(event) {
  if (event.key === "Escape") store.closeRowContextMenu();
}

onMounted(async () => {
  await nextTick();
  reposition();
  document.addEventListener("keydown", onKeydown);
});
onUnmounted(() => document.removeEventListener("keydown", onKeydown));

function addTag() {
  const tag = newTag.value.trim();
  if (!tag || !row.value) return;
  store.addRowTag(row.value.id, tag);
  newTag.value = "";
}
async function copyRaw() {
  if (!row.value) return;
  try {
    await navigator.clipboard.writeText(row.value.raw || "");
  } catch {
    // clipboard access can be denied by the OS/webview — nothing useful to do
  }
  store.closeRowContextMenu();
}
// Seeds a custom alert rule from this row's path, then opens Settings to
// Alerts so the auto-generated regex gets a look before it starts firing.
function addToAlerts() {
  if (!row.value) return;
  store.addLocalRuleFromRow(row.value);
  store.closeRowContextMenu();
  store.openSettingsDialog();
  store.setSettingsSection("alerts");
}
// Replaces the native menu's "Share" — shares a plain-text summary of the
// row through the OS share sheet (see systemApi.js).
function share() {
  if (!row.value) return;
  const r = row.value;
  const summary = [`${r.method} ${r.path}`, `Status ${r.status}`, r.hostname, r.ip].filter(Boolean).join(" · ");
  shareText({ title: "Tomahawk log entry", text: summary });
  store.closeRowContextMenu();
}
// Replaces the native menu's "Inspect" — the app disables the native
// context menu app-wide (see App.vue), so this is the only way left to
// reach DevTools.
function inspect() {
  openDevtools();
  store.closeRowContextMenu();
}
</script>

<template>
  <div class="popup-backdrop" @click="store.closeRowContextMenu()"></div>
  <div v-if="row" ref="menuRef" class="popover ctx-menu" :style="menuStyle" @click.stop>
    <div class="popover-group-label ctx-title">{{ row.method }} {{ row.path }}</div>
    <div class="dropdown-item" @click="copyRaw"><i class="ph ph-copy"></i>Copy raw line</div>
    <div class="dropdown-item" @click="addToAlerts"><i class="ph ph-shield-warning"></i>Add path regex to Alerts</div>
    <div class="dropdown-sep"></div>
    <div class="popover-group-label">Tags</div>
    <div class="ctx-tags">
      <span v-for="tag in row.tags || []" :key="tag" class="insp-tag insp-tag-editable">
        {{ tag }}
        <i class="ph ph-x" title="Remove tag" @click="store.removeRowTag(row.id, tag)"></i>
      </span>
      <span v-if="!(row.tags || []).length" class="ctx-tags-empty">No tags yet</span>
    </div>
    <div class="ctx-tag-add">
      <input v-model="newTag" placeholder="Add a tag…" maxlength="40" @keydown.enter="addTag">
      <button class="icon-btn" :disabled="!newTag.trim()" title="Add tag" @click="addTag"><i class="ph ph-plus"></i></button>
    </div>
    <div class="dropdown-sep"></div>
    <div class="dropdown-item" @click="share"><i class="ph ph-share-network"></i>Share</div>
    <div class="dropdown-item" @click="inspect"><i class="ph ph-code"></i>Inspect</div>
  </div>
</template>
