<script setup>
import { useMonitorStore } from "../store/monitor";
import DockTabHeader from "./DockTabHeader.vue";
import SourceTreeNode from "./SourceTreeNode.vue";

const store = useMonitorStore();
const tabs = [{ id: "sources", icon: "ph-hard-drives", label: "Sources" }];
</script>

<template>
  <div class="dock">
    <DockTabHeader dock-id="sources" :tabs="tabs" model-value="sources" />
    <div class="search-row">
      <button class="btn-add-src" @click="store.openAddSourceDialog()"><i class="ph ph-plus"></i>Add source</button>
      <div class="filterbar">
        <i class="ph ph-magnifying-glass"></i>
        <input :value="store.hostFilter" @input="store.setHostFilter($event.target.value)" placeholder="Filter hosts…">
      </div>
      <i class="ph ph-sliders-horizontal" style="color:var(--color-neutral-600)"></i>
    </div>
    <div class="tree">
      <SourceTreeNode v-for="(node, i) in store.tree" :key="i" :node="node" />
    </div>
  </div>
</template>
