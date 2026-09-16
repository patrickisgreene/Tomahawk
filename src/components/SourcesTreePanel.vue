<script setup>
import { ref } from "vue";
import { useMonitorStore } from "../store/monitor";
import { formatRelative } from "../data/format";
import ConfirmDialog from "./ConfirmDialog.vue";

const store = useMonitorStore();
const pendingRemove = ref(null);

function iconFor(source) {
  return source.kind === "directory" ? "ph-folder" : "ph-file-text";
}
function isExpanded(id) {
  return store.expandedSourceIds.includes(id);
}
function onRowClick(source) {
  if (source.kind === "directory" && source.files.length) store.toggleSourceExpanded(source.id);
}
function onRemove(source) {
  pendingRemove.value = source;
}
function cancelRemove() {
  pendingRemove.value = null;
}
function confirmRemove() {
  if (pendingRemove.value) store.removeSource(pendingRemove.value.id);
  pendingRemove.value = null;
}
</script>

<template>
  <div class="panel-fill">
    <div class="search-row">
      <button class="btn-add-src" @click="store.openAddSourceDialog()"><i class="ph ph-plus"></i>Add source</button>
      <div class="filterbar">
        <i class="ph ph-magnifying-glass"></i>
        <input :value="store.hostFilter" @input="store.setHostFilter($event.target.value)" placeholder="Filter sources…">
      </div>
    </div>
    <div class="tree">
      <div v-if="!store.filteredSources.length" class="tree-row dim">No sources added yet.</div>
      <template v-for="source in store.filteredSources" :key="source.id">
        <div class="tree-row" @click="onRowClick(source)">
          <i
            v-if="source.kind === 'directory' && source.files.length"
            class="ph"
            :class="isExpanded(source.id) ? 'ph-caret-down' : 'ph-caret-right'"
          ></i>
          <i class="ph" :class="iconFor(source)" style="color:var(--color-neutral-500)"></i>
          <span>{{ source.label }}</span>
          <span class="count">{{ source.rowCount }} rows</span>
          <span v-if="source.lastTs" class="lag">{{ formatRelative(source.lastTs) }}</span>
          <span class="row-actions"><i class="ph ph-trash" title="Remove source" @click.stop="onRemove(source)"></i></span>
        </div>
        <div
          v-if="source.kind === 'directory' && source.files.length"
          class="tree-children"
          :class="{ collapsed: !isExpanded(source.id) }"
        >
          <div v-for="f in source.files" :key="f.path" class="tree-row file">
            <i class="ph ph-file-text" style="color:var(--color-neutral-600)"></i>
            <span>{{ f.name }}</span>
            <span class="dot" :style="{ background: f.done ? 'var(--color-neutral-600)' : 'var(--st2)' }"></span>
            <span class="count">{{ f.rowCount }} rows</span>
          </div>
        </div>
      </template>
    </div>
    <ConfirmDialog
      v-if="pendingRemove"
      title="Remove source"
      :message="`Remove &quot;${pendingRemove.label}&quot;? This deletes its stored log data and can't be undone.`"
      confirm-label="Remove"
      danger
      @confirm="confirmRemove"
      @cancel="cancelRemove"
    />
  </div>
</template>
