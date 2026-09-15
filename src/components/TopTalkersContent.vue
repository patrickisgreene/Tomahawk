<script setup>
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const kinds = [
  { id: "clients", label: "Clients" },
  { id: "paths", label: "Paths" },
  { id: "agents", label: "Agents" },
  { id: "referrers", label: "Referrers" },
];
</script>

<template>
  <div class="panel-fill">
    <div class="talker-tabs">
      <span
        v-for="k in kinds"
        :key="k.id"
        :class="{ active: store.talkerKind === k.id }"
        @click="store.setTalkerKind(k.id)"
      >{{ k.label }}</span>
    </div>
    <div class="talker-list">
      <div v-if="!store.topTalkers[store.talkerKind]?.length" class="tree-row dim">No rows ingested yet.</div>
      <div class="talker-row" v-for="(r, i) in store.topTalkers[store.talkerKind]" :key="i">
        <div style="min-width:0">
          <div class="talker-label">{{ r.label }}</div>
          <div class="talker-bar-track"><div class="talker-bar-fill" :style="{ width: r.w }"></div></div>
        </div>
        <div class="talker-n">{{ r.n }}</div>
      </div>
    </div>
  </div>
</template>
