<script setup>
import { ref, computed } from "vue";
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const metric = ref("requests");
const groupBy = ref("vhost");
const bucket = ref("5m");
const sourceId = ref(""); const domain = ref(""); const windowMs = ref(0); const minStatus = ref(0); const filterText = ref("");
const domains = computed(() => [...new Set(store.tailRows.map((r) => r.hostname).filter(Boolean))].sort());
const visibleRows = computed(() => { const rows = store.tailRows.filter(r => (!sourceId.value || r.id?.startsWith(`${sourceId.value}:`)) && (!domain.value || r.hostname === domain.value) && (!minStatus.value || Number(r.status) >= minStatus.value) && (!filterText.value || JSON.stringify(r).toLowerCase().includes(filterText.value.toLowerCase()))); if (!windowMs.value || !rows.length) return rows; const latest = Math.max(...rows.map(r => Number(r.ts) || 0)); return rows.filter(r => (Number(r.ts) || 0) >= latest - windowMs.value); });
const line = computed(() => Array.from({length: 16}, (_, i) => `${i * 60},${Math.max(12, 170 - ((visibleRows.value[i % Math.max(visibleRows.value.length, 1)]?.status || 1) % 150))}`).join(" "));
const fill = computed(() => `M${line.value} 900,200 0,200Z`);
const tooltipLeft = ref("50%"); const cursorX = ref(450); const cursorY = ref(100); const hoveredIndex = ref(0); const hoveredValue = computed(() => visibleRows.value[hoveredIndex.value] || {});
const onChartMove = (event) => { const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); cursorX.value = x * 900; cursorY.value = y * 200; hoveredIndex.value = Math.min(Math.max(visibleRows.value.length - 1, 0), Math.round(x * Math.max(visibleRows.value.length - 1, 0))); tooltipLeft.value = `${Math.max(8, Math.min(88, x * 100))}%`; };
const errorCount = computed(() => visibleRows.value.filter((r) => Number(r.status) >= 400).length);
const METRICS = [
  { id: "requests", label: "Requests" },
  { id: "bytes", label: "Bytes" },
  { id: "statuses", label: "Status codes" },
  { id: "latency", label: "Latency" },
];

// One traffic curve to hang the chart on â€” the design only specced data for
// the Requests view; the other three metrics switch the active tab but
// reuse this shape rather than inventing unspecified datasets.
const LINE = "0,150 60,140 120,145 180,120 240,130 300,95 360,105 420,75 480,85 540,60 600,70 660,40 700,20 730,10 760,25 800,55 840,90 900,100";
const FILL = `M${LINE} 900,200 0,200Z`;
</script>

<template>
  <div class="panel-fill">
    <div class="toolbar">
      <select class="chip" v-model="sourceId" aria-label="Traffic source"><option value="">All sources</option><option v-for="source in store.sources" :key="source.id" :value="source.id">{{ source.name || source.path }}</option></select>
      <select class="chip" v-model="domain" aria-label="Traffic domain"><option value="">All domains</option><option v-for="domain in domains" :key="domain" :value="domain">{{ domain }}</option></select>
      <select class="chip" v-model.number="windowMs" aria-label="Traffic time window"><option :value="0">All time</option><option :value="900000">15m</option><option :value="3600000">1h</option><option :value="86400000">24h</option></select>
      <select class="chip" v-model.number="minStatus" aria-label="Minimum status"><option :value="0">All status</option><option :value="400">4xx+</option><option :value="500">5xx</option></select>
      <input class="toolbar-search" v-model="filterText" placeholder="Filter traffic..." aria-label="Filter traffic" />
      <div class="seg-strip">
        <span v-for="m in METRICS" :key="m.id" :class="{ active: metric === m.id }" @click="metric = m.id">{{ m.label }}</span>
      </div>
      <select class="chip" v-model="groupBy" aria-label="Group traffic by"><option value="vhost">Group: vhost</option><option value="status">Group: status</option><option value="path">Group: path</option></select>
      <select class="chip" v-model="bucket" aria-label="Traffic bucket"><option value="1m">1m buckets</option><option value="5m">5m buckets</option><option value="15m">15m buckets</option></select>
      <span class="traffic-summary">{{ hoveredValue.status || "—" }} · {{ hoveredValue.path || "request" }} Â· {{ errorCount }} errors</span>
    </div>

    <div class="traffic-chart" @mousemove="onChartMove">
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
        <path :d="fill" fill="url(#trafficFill)" />
        <polyline :points="line" fill="none" stroke="#b5abfc" stroke-width="1.6" />
        <line :x1="cursorX" y1="0" :x2="cursorX" y2="200" stroke="#e08a86" stroke-width="1" stroke-dasharray="3,3" />
        <circle :cx="cursorX" :cy="cursorY" r="3.5" fill="#e08a86" />
      </svg>
      <div class="traffic-tooltip" :style="{ left: tooltipLeft, top: `${Math.max(8, Math.min(62, (cursorY / 2)))}%` }">
        <div class="tt-head">{{ hoveredValue.status || "—" }} · {{ hoveredValue.path || "request" }}</div>
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










