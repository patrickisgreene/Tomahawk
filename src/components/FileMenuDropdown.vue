<script setup>
import { useMonitorStore } from "../store/monitor";
import { useClickOutside } from "../composables/useClickOutside";
const store = useMonitorStore();
useClickOutside(() => store.closeFileMenu());

function addSource() {
  store.closeFileMenu();
  store.openAddSourceDialog();
}
function openSettings() {
  store.closeFileMenu();
  store.openSettingsDialog();
}
</script>

<template>
  <div class="dropdown-menu" @click.stop>
    <div class="dropdown-item"><i class="ph ph-file-plus"></i>New workspace<span class="kbd-hint">⌘N</span></div>
    <div class="dropdown-item" @click="addSource"><i class="ph ph-folder-open"></i>Add log source…<span class="kbd-hint">⌘O</span></div>
    <div class="dropdown-item active"><i class="ph ph-clock-counter-clockwise"></i><span>Recent workspaces</span><i class="ph ph-caret-right" style="margin-left:auto;color:var(--color-neutral-500);font-size:11px"></i></div>
    <div class="dropdown-sep"></div>
    <div class="dropdown-item"><i class="ph ph-download-simple"></i>Export view…<span class="kbd-hint">⌘E</span></div>
    <div class="dropdown-item"><i class="ph ph-upload-simple"></i>Import saved filters…</div>
    <div class="dropdown-sep"></div>
    <div class="dropdown-item" @click="openSettings"><i class="ph ph-gear-six"></i>Settings…<span class="kbd-hint">⌘,</span></div>
    <div class="dropdown-item dim"><i class="ph ph-power"></i>Quit</div>
  </div>
</template>
