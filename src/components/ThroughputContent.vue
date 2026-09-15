<script setup>
import { useSparkline, toPolylinePoints } from "../composables/useSparkline";

const spark = useSparkline({ count: 21, min: 4, max: 30, jitter: 6 });
const errSpark = useSparkline({ count: 13, min: 2, max: 17, jitter: 5 });
</script>

<template>
  <div class="panel-fill">
    <div class="stat-block">
      <span class="stat-num">1,284</span><span class="stat-unit">req/s</span>
      <div class="stat-meta">avg 1,102 · min 640 · max 2,318</div>
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
      <span class="stat-num" style="color:var(--st5)">0.42%</span><span class="stat-unit">5xx · last 15m</span>
      <svg viewBox="0 0 248 18" preserveAspectRatio="none">
        <polyline :points="toPolylinePoints(errSpark, 248, 18)" fill="none" stroke="#e08a86" stroke-width="1.2" />
      </svg>
    </div>
  </div>
</template>
