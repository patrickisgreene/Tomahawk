<script setup>
import Dock from "./Dock.vue";
import Splitter from "./Splitter.vue";
import { computed, watch } from "vue";
import { useMonitorStore } from "../store/monitor";
const store = useMonitorStore();
const columns = computed(() => [
  ...(store.panelVisibility.left ? [`${store.panelSizes.left}px`, "5px"] : []),
  "minmax(0, 1fr)",
  ...(store.panelVisibility.right ? ["5px", `${store.panelSizes.right}px`] : []),
].join(" "));
watch(() => [store.dockTabs, store.dockActiveTab, store.panelVisibility, store.accessColumnLayout], () => store.saveWorkspaceState(), { deep: true });
</script>

<template>
  <div class="main" :style="{ gridTemplateColumns: columns }">
    <div
      id="monitor-left"
      v-show="store.panelVisibility.left"
      class="col-left"
      :style="{ gridTemplateRows: `minmax(0, 1fr) 5px ${store.panelSizes.throughput}px` }"
    >
      <Dock dock-id="sources" />
      <Splitter axis="height" target="throughput" invert />
      <Dock dock-id="throughput" />
    </div>
    <Splitter v-show="store.panelVisibility.left" axis="width" target="left" />
    <div
      class="col-mid"
      :style="{ gridTemplateRows: store.panelVisibility.bottom ? `minmax(0, 1fr) 5px ${store.panelSizes.bottom}px` : 'minmax(0, 1fr)' }"
    >
      <Dock dock-id="stream" />
      <Splitter v-show="store.panelVisibility.bottom" axis="height" target="bottom" invert />
      <div
        id="monitor-bottom"
        v-show="store.panelVisibility.bottom"
        class="col-mid-bottom"
        :style="{ gridTemplateColumns: `minmax(0, 1fr) 5px ${store.panelSizes.mix}px` }"
      >
        <Dock class="bottom-query-dock" dock-id="bottom" />
        <Splitter class="bottom-mix-splitter" axis="width" target="mix" invert />
        <Dock class="bottom-status-dock" dock-id="mix">
          <template #trailing>
            <div style="margin-left:auto;display:flex;gap:6px;color:var(--color-neutral-600);font-size:11px"></div>
          </template>
        </Dock>
      </div>
    </div>
    <Splitter v-show="store.panelVisibility.right" axis="width" target="right" invert />
    <Dock id="monitor-right" v-show="store.panelVisibility.right" dock-id="inspector" />
  </div>
</template>
