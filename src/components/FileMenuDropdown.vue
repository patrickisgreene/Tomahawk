<script setup>
import { useMonitorStore } from "../store/monitor";
import { useClickOutside } from "../composables/useClickOutside";
const store = useMonitorStore();
useClickOutside(() => store.closeFileMenu());

function addSource() {
  store.closeFileMenu();
  store.openAddSourceDialog();
}
function newWorkspace() {
  store.closeFileMenu();
  store.createWorkspace();
}
function openSettings() {
  store.closeFileMenu();
  store.openSettingsDialog();
}
</script>

<template>
  <div class="popup-backdrop" @click="store.closeFileMenu()"></div>
  <div class="dropdown-menu" @click.stop>
    <div class="dropdown-item" @click="newWorkspace"><i class="ph ph-file-plus"></i>New workspace</div>
    <div class="dropdown-item" @click="addSource"><i class="ph ph-folder-open"></i>Add log source…</div>
    <div class="dropdown-sep"></div>
    <div class="dropdown-item" @click="openSettings"><i class="ph ph-gear-six"></i>Settings…</div>
    <div class="dropdown-item dim"><i class="ph ph-power"></i>Quit</div>
  </div>
</template>
