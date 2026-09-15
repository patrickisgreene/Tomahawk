<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { fmtMs } from "../data/format";

const store = useMonitorStore();

function fmtRate(r) {
  if (r >= 1000) return (r / 1000).toFixed(2).replace(/\.?0+$/, "") + "k/s";
  if (r >= 10) return r.toFixed(0) + "/s";
  return r.toFixed(1) + "/s";
}
function fmtDuration(sec) {
  if (sec < 60) return Math.round(sec) + "s";
  const mins = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return mins + "m" + (rem ? " " + rem + "s" : "");
}

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
</script>

<template>
  <div class="panel-fill">
    <div class="mix-grid">
      <div v-for="c in cells" :key="c.lbl" class="mix-cell" :class="{ danger: c.danger }">
        <div class="lbl" :style="{ color: c.color }">{{ c.lbl }}</div>
        <div class="bar"><div class="bar-fill" :style="{ height: Math.min(100, c.pct) + '%', background: c.color }"></div></div>
        <div class="pct" :style="c.danger ? { color: c.color } : {}">{{ c.value || c.pct.toFixed(1) + '%' }}</div>
        <div class="rate">{{ c.rate }}</div>
      </div>
    </div>
    <div class="mix-foot">
      <span>{{ store.statusMixStats.total.toLocaleString() }} requests</span>
      <span style="margin-left:auto">over {{ fmtDuration(store.statusMixStats.spanSec) }}</span>
    </div>
  </div>
</template>
