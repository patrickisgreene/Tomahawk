<script setup>
import { ref } from "vue";
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const metric = ref("requests");
const METRICS = [
  { id: "requests", label: "Requests" },
  { id: "bytes", label: "Bytes" },
  { id: "statuses", label: "Status codes" },
  { id: "latency", label: "Latency" },
];

// One traffic curve to hang the chart on — the design only specced data for
// the Requests view; the other three metrics switch the active tab but
// reuse this shape rather than inventing unspecified datasets.
const LINE = "0,150 60,140 120,145 180,120 240,130 300,95 360,105 420,75 480,85 540,60 600,70 660,40 700,20 730,10 760,25 800,55 840,90 900,100";
const FILL = `M${LINE} 900,200 0,200Z`;
</script>

<template>
  <div class="panel-fill">
    <div class="toolbar">
      <div class="seg-strip">
        <span v-for="m in METRICS" :key="m.id" :class="{ active: metric === m.id }" @click="metric = m.id">{{ m.label }}</span>
      </div>
      <div class="chip txt">Group by vhost<span class="caret">▾</span></div>
      <div class="chip">5m buckets</div>
      <div class="chip txt" style="margin-left:auto"><i class="ph ph-arrows-out"></i>Compare period</div>
    </div>

    <div class="traffic-chart">
      <svg viewBox="0 0 900 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#9184d9" stop-opacity=".35" />
            <stop offset="1" stop-color="#9184d9" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="50" x2="900" y2="50" stroke="#2e3140" stroke-width="1" />
        <line x1="0" y1="100" x2="900" y2="100" stroke="#2e3140" stroke-width="1" />
        <line x1="0" y1="150" x2="900" y2="150" stroke="#2e3140" stroke-width="1" />
        <path :d="FILL" fill="url(#trafficFill)" />
        <polyline :points="LINE" fill="none" stroke="#b5abfc" stroke-width="1.6" />
        <line x1="730" y1="0" x2="730" y2="200" stroke="#e08a86" stroke-width="1" stroke-dasharray="3,3" />
        <circle cx="730" cy="10" r="3.5" fill="#e08a86" />
      </svg>
      <div class="traffic-tooltip" style="left:calc(730 / 900 * 100% - 74px)">
        <div class="tt-head">13:42 — 2,318 req</div>
        <div class="tt-row"><span>2xx</span><span style="color:var(--st2)">2,041</span></div>
        <div class="tt-row"><span>5xx</span><span style="color:var(--st5)">14</span></div>
      </div>
    </div>

    <div class="traffic-mix">
      <div v-for="(b, i) in store.statusBars" :key="i" class="traffic-mix-col">
        <div :style="{ height: b.h2, background: 'var(--st2)' }"></div>
        <div :style="{ height: b.h3, background: 'var(--st3)' }"></div>
        <div :style="{ height: b.h4, background: 'var(--st4)' }"></div>
        <div :style="{ height: b.h5, background: 'var(--st5)' }"></div>
      </div>
    </div>
    <div class="traffic-axis"><span>12:40</span><span>13:00</span><span>13:20</span><span>13:40</span><span>14:00</span></div>
  </div>
</template>
