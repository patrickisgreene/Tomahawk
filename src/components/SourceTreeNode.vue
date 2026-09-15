<script setup>
import { useMonitorStore } from "../store/monitor";

const props = defineProps({ node: { type: Object, required: true } });
const store = useMonitorStore();

function onRowClick() {
  if (props.node.children) {
    store.toggleTreeNode(props.node);
  } else if (props.node.kind === "file") {
    store.selectSourceFile(store.tree, props.node);
  }
}

function fleetIconColor(node) {
  return node.dim ? "var(--color-neutral-500)" : "var(--color-accent-400)";
}
function fileIconColor(node) {
  return node.selected ? "var(--color-accent-300)" : node.dim ? "var(--color-neutral-600)" : "var(--st5)";
}

// Matches the original prototype's filter behaviour: hide a row (not its
// subtree) if its own label doesn't contain the filter text.
function matchesFilter(node) {
  const q = store.hostFilter.trim().toLowerCase();
  if (!q) return true;
  return node.label.toLowerCase().includes(q);
}
</script>

<template>
  <div>
    <div
      v-show="matchesFilter(node)"
      class="tree-row"
      :class="[node.kind, { selected: node.selected, dim: node.dim }]"
      @click="onRowClick"
    >
      <i v-if="node.children" class="ph" :class="node.expanded ? 'ph-caret-down' : 'ph-caret-right'"></i>
      <i v-if="node.kind === 'fleet'" class="ph ph-globe-hemisphere-west" :style="{ color: fleetIconColor(node) }"></i>
      <i v-if="node.kind === 'host'" class="ph ph-hard-drives" style="color:var(--color-neutral-500)"></i>
      <i v-if="node.kind === 'vhost'" class="ph ph-folder" style="color:var(--color-neutral-500)"></i>
      <i v-if="node.kind === 'file'" class="ph" :class="node.icon" :style="{ color: fileIconColor(node) }"></i>
      <span>{{ node.label }}</span>
      <span v-if="node.status" class="dot" :style="{ background: node.status }"></span>
      <span v-if="node.lag" class="lag" style="color:var(--st4)">{{ node.lag }}</span>
      <span v-if="node.count != null" class="count">{{ node.count }}</span>
      <span
        v-if="node.kind === 'file'"
        class="row-actions"
        :style="{ color: node.selected ? 'var(--color-accent-300)' : 'var(--color-neutral-600)' }"
      >
        <i class="ph ph-eye"></i><i class="ph ph-push-pin"></i>
      </span>
    </div>
    <div v-if="node.children" class="tree-children" :class="{ collapsed: !node.expanded }">
      <SourceTreeNode v-for="(child, i) in node.children" :key="i" :node="child" />
    </div>
  </div>
</template>
