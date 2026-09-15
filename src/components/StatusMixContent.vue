<script setup>
const cells = [
  { lbl: "2xx", pct: 88.1, rate: "1.13k/s", color: "var(--st2)" },
  { lbl: "3xx", pct: 7.6, rate: "97/s", color: "var(--st3)" },
  { lbl: "4xx", pct: 3.9, rate: "50/s", color: "var(--st4)" },
  { lbl: "5xx", pct: 0.42, rate: "5.4/s", color: "var(--st5)", danger: true },
  { lbl: "p95", pct: 64, rate: "p99 1.8s", color: "var(--color-accent-400)", value: "412ms" },
];
</script>

<template>
  <div class="panel-fill">
    <div class="mix-grid">
      <div v-for="c in cells" :key="c.lbl" class="mix-cell" :class="{ danger: c.danger }">
        <div class="lbl" :style="{ color: c.color }">{{ c.lbl }}</div>
        <div class="bar"><div class="bar-fill" :style="{ height: Math.min(100, c.pct) + '%', background: c.color }"></div></div>
        <div class="pct" :style="c.danger ? { color: c.color } : {}">{{ c.value || c.pct + '%' }}</div>
        <div class="rate">{{ c.rate }}</div>
      </div>
    </div>
    <div class="mix-foot"><span style="color:var(--st5)">▲ 5xx +0.31pp vs 1h</span><span style="margin-left:auto">window 60s</span></div>
  </div>
</template>
