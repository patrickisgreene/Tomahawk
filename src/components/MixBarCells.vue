<script setup>
defineProps({
  cells: { type: Array, required: true }, // [{ lbl, pct, rate, color, danger?, value? }]
});
</script>

<template>
  <div class="mix-grid">
    <div v-for="c in cells" :key="c.lbl" class="mix-cell" :class="{ danger: c.danger }">
      <div class="lbl" :style="{ color: c.color }">{{ c.lbl }}</div>
      <div class="bar"><div class="bar-fill" :style="{ height: Math.min(100, c.pct) + '%', background: c.color }"></div></div>
      <div class="pct" :style="c.danger ? { color: c.color } : {}">{{ c.value || c.pct.toFixed(1) + '%' }}</div>
      <div class="rate">{{ c.rate }}</div>
    </div>
  </div>
</template>
