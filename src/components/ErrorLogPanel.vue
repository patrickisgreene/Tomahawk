<script setup>
import { ref } from "vue";
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const selectedIdx = ref(null);

function levelColor(lvl) {
  return lvl === "error" ? "var(--st5)" : lvl === "warn" ? "var(--st4)" : "var(--color-neutral-500)";
}
</script>

<template>
  <div class="panel-fill">
    <div class="err-body">
      <div
        v-for="(e, i) in store.errors"
        :key="i"
        class="err-row"
        :class="{ selected: selectedIdx === i }"
        @click="selectedIdx = i"
      >
        <div class="err-top">
          <span class="err-t">{{ e.t }}</span>
          <span :style="{ color: levelColor(e.lvl), fontWeight: 600, textTransform: 'uppercase', fontSize: '9px' }">{{ e.lvl }}</span>
          <span class="err-mod">{{ e.mod }}</span>
          <span class="err-count" :style="{ color: levelColor(e.lvl) }">{{ e.count }}</span>
        </div>
        <div class="err-msg" :style="{ color: e.lvl === 'error' ? 'var(--color-neutral-200)' : 'var(--color-neutral-400)' }">{{ e.msg }}</div>
        <div class="err-meta">{{ e.meta }}</div>
      </div>
    </div>
  </div>
</template>
