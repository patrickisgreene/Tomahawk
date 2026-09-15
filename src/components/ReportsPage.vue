<script setup>
import { useMonitorStore } from "../store/monitor";
const store = useMonitorStore();

const STATS = [
  { label: "Total requests", value: "7.9M", note: "▲ 6.2% vs prior week", color: "var(--st2)" },
  { label: "Unique clients", value: "412k", note: "61% classified as bots", color: "" },
  { label: "Bandwidth served", value: "2.4 TB", note: "avg 342 GB/day", color: "" },
  { label: "Error rate", value: "0.38%", note: "▲ 0.11pp vs prior week", color: "var(--st5)", valueColor: "var(--st5)" },
];
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="page-title">Reports</span>
      <div class="chip txt" style="margin-left:12px">Last 7 days<span class="caret">▾</span></div>
      <div class="chip txt">All vhosts<span class="caret">▾</span></div>
      <button class="chip txt" style="margin-left:auto"><i class="ph ph-download-simple"></i>Export CSV</button>
    </div>
    <div class="page-scroll">
      <div class="stat-cards">
        <div v-for="s in STATS" :key="s.label" class="stat-card">
          <div class="stat-card-label">{{ s.label }}</div>
          <div class="stat-card-value" :style="s.valueColor ? { color: s.valueColor } : {}">{{ s.value }}</div>
          <div class="stat-card-note" :style="s.color ? { color: s.color } : {}">{{ s.note }}</div>
        </div>
      </div>
      <div class="report-card">
        <div class="report-card-title">Requests per day</div>
        <div class="day-bars">
          <div v-for="d in store.dayBars" :key="d.label" class="day-bar-col">
            <div class="day-bar" :style="{ height: d.h }"></div>
            <span>{{ d.label }}</span>
          </div>
        </div>
      </div>
      <div class="report-grid-2">
        <div class="report-card">
          <div class="report-card-title">Top pages</div>
          <div v-for="r in store.topPages" :key="r.p" class="rank-row"><span class="rank-label">{{ r.p }}</span><span class="rank-n">{{ r.n }}</span></div>
        </div>
        <div class="report-card">
          <div class="report-card-title">Bots vs. human traffic</div>
          <div class="bot-bar"><div style="width:61%;background:var(--color-accent-600)"></div><div style="width:39%;background:var(--st2)"></div></div>
          <div class="bot-legend"><span><span style="color:var(--color-accent-300)">●</span> Bots 61%</span><span><span style="color:var(--st2)">●</span> Human 39%</span></div>
          <div class="report-subhead">Top user agents</div>
          <div v-for="r in store.topAgents" :key="r.p" class="rank-row small"><span class="rank-label">{{ r.p }}</span><span class="rank-n">{{ r.n }}</span></div>
        </div>
      </div>
    </div>
  </div>
</template>
