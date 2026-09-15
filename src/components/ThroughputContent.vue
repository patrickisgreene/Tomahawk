<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { normalizeSpark, toPolylinePoints } from "../composables/useSparkline";

const store = useMonitorStore();
const spark = computed(() => normalizeSpark(store.throughputStats.spark, 34));
const errSpark = computed(() => normalizeSpark(store.throughputStats.errorSpark, 18));
</script>

<template>
  <div class="panel-fill">
    <div class="stat-block">
      <span class="stat-num">{{ Math.round(store.throughputStats.current).toLocaleString() }}</span><span class="stat-unit">req/s</span>
      <div class="stat-meta">avg {{ Math.round(store.throughputStats.avg) }} · min {{ Math.round(store.throughputStats.min) }} · max {{ Math.round(store.throughputStats.max) }}</div>
      <svg viewBox="0 0 248 34" preserveAspectRatio="none">
        <defs>
          <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9184d9" stop-opacity=".45" />
            <stop offset="1" stop-color="#9184d9" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon :points="toPolylinePoints(spark, 248, 34) + ' 248,34 0,34'" fill="url(#throughputFill)" />
        <polyline :points="toPolylinePoints(spark, 248, 34)" fill="none" stroke="#b5abfc" stroke-width="1.2" />
      </svg>
    </div>
    <div class="stat-block sub">
      <span class="stat-num" style="color:var(--st5)">{{ store.throughputStats.errorPct.toFixed(2) }}%</span><span class="stat-unit">5xx</span>
      <svg viewBox="0 0 248 18" preserveAspectRatio="none">
        <polyline :points="toPolylinePoints(errSpark, 248, 18)" fill="none" stroke="#e08a86" stroke-width="1.2" />
      </svg>
    </div>
  </div>
</template>
