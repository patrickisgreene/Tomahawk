<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { fmtMs, fmtRate, fmtDuration } from "../data/format";
import { buildPieSlices } from "../data/pieChart";
import PanelTabs from "./PanelTabs.vue";
import MixBarCells from "./MixBarCells.vue";
import MixPieChart from "./MixPieChart.vue";

const store = useMonitorStore();
const TABS = [
  { id: "mix", label: "Mix" },
  { id: "total", label: "Total" },
];

// ---- Mix tab: the per-class bar cells, plus p95 (not part of the Total
// pie — it's a latency figure, not a slice of the request total) ----
const cells = computed(() => {
  const s = store.statusMixStats;
  const base = [
    { lbl: "2xx", pct: s.c2.pct, rate: fmtRate(s.c2.rate), color: "var(--st2)" },
    { lbl: "3xx", pct: s.c3.pct, rate: fmtRate(s.c3.rate), color: "var(--st3)" },
    { lbl: "4xx", pct: s.c4.pct, rate: fmtRate(s.c4.rate), color: "var(--st4)" },
    { lbl: "5xx", pct: s.c5.pct, rate: fmtRate(s.c5.rate), color: "var(--st5)", danger: true },
  ];
  // Standard Apache Combined log format has no timing field at all, so p95
  // is genuinely unavailable for most real sources — show that honestly
  // rather than fabricating a value.
  const p95Cell =
    s.p95 != null
      ? { lbl: "p95", pct: Math.min(100, (s.p95 / 1000) * 100), rate: "latency", color: "var(--color-accent-400)", value: fmtMs(s.p95) }
      : { lbl: "p95", pct: 0, rate: "not in this log format", color: "var(--color-neutral-600)", value: "n/a" };
  return [...base, p95Cell];
});

// ---- Total tab: the same per-class split as a pie chart ----
const STATUS_CLASSES = [
  { key: "c2", label: "2xx", color: "var(--st2)" },
  { key: "c3", label: "3xx", color: "var(--st3)" },
  { key: "c4", label: "4xx", color: "var(--st4)" },
  { key: "c5", label: "5xx", color: "var(--st5)" },
];
const slices = computed(() => {
  const s = store.statusMixStats;
  const classes = STATUS_CLASSES.map((cls) => ({ ...cls, count: s[cls.key].count, pct: s[cls.key].pct }));
  return buildPieSlices(classes, 60, 60, 52);
});
</script>

<template>
  <div class="panel-fill">
    <PanelTabs :tabs="TABS" :active="store.statusPanelTab" @select="store.setStatusPanelTab" />
    <MixBarCells v-if="store.statusPanelTab === 'mix'" :cells="cells" />
    <MixPieChart v-else :slices="slices" :total="store.statusMixStats.total" />
    <div class="mix-foot">
      <span>{{ store.statusMixStats.total.toLocaleString() }} requests</span>
      <span style="margin-left:auto">over {{ fmtDuration(store.statusMixStats.spanSec) }}</span>
    </div>
  </div>
</template>
