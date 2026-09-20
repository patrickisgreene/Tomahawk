<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { fmtRate, fmtDuration } from "../data/format";
import { buildPieSlices } from "../data/pieChart";
import PanelTabs from "./PanelTabs.vue";
import MixBarCells from "./MixBarCells.vue";
import MixPieChart from "./MixPieChart.vue";

const store = useMonitorStore();
const TABS = [
  { id: "mix", label: "Mix" },
  { id: "total", label: "Total" },
];

// GET/POST/PUT get their own categorical color; everything else (DELETE,
// PATCH, HEAD, OPTIONS, CONNECT, TRACE, non-standard verbs) folds into
// "Other" in neutral gray. A pie chart needs every slice pairwise distinct
// under color-blindness simulation (any two slices can sit side by side),
// which caps this app's validated categorical ramp at 3 hues — see the
// --cat-* comment in app.css.
const METHOD_CLASSES = [
  { key: "get", label: "GET", color: "var(--cat-1)" },
  { key: "post", label: "POST", color: "var(--cat-2)" },
  { key: "put", label: "PUT", color: "var(--cat-3)" },
  { key: "other", label: "Other", color: "var(--color-neutral-600)" },
];

const cells = computed(() => {
  const s = store.methodMixStats;
  return METHOD_CLASSES.map((cls) => ({
    lbl: cls.label,
    pct: s[cls.key].pct,
    rate: fmtRate(s[cls.key].rate),
    color: cls.color,
  }));
});
const slices = computed(() => {
  const s = store.methodMixStats;
  const classes = METHOD_CLASSES.map((cls) => ({ ...cls, count: s[cls.key].count, pct: s[cls.key].pct }));
  return buildPieSlices(classes, 60, 60, 52);
});
</script>

<template>
  <div class="panel-fill">
    <PanelTabs :tabs="TABS" :active="store.methodPanelTab" @select="store.setMethodPanelTab" />
    <MixBarCells v-if="store.methodPanelTab === 'mix'" :cells="cells" />
    <MixPieChart v-else :slices="slices" :total="store.methodMixStats.total" />
    <div class="mix-foot">
      <span>{{ store.methodMixStats.total.toLocaleString() }} requests</span>
      <span style="margin-left:auto">over {{ fmtDuration(store.methodMixStats.spanSec) }}</span>
    </div>
  </div>
</template>
