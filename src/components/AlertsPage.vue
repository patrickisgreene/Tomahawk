<script setup>
import { useMonitorStore } from "../store/monitor";
const store = useMonitorStore();
</script>

<template>
  <div class="page">
    <div class="page-header">
      <span class="page-title">Alerts</span>
      <div class="filterbar" style="max-width:220px;margin-left:12px"><i class="ph ph-magnifying-glass"></i><input placeholder="Filter rules…"></div>
      <button class="chip outline" style="margin-left:auto"><i class="ph ph-plus"></i>New alert rule</button>
    </div>
    <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 360px">
      <div class="alert-rule-list">
        <div
          v-for="a in store.alertRules"
          :key="a.id"
          class="alert-rule-row"
          :class="{ selected: a.id === store.selectedAlertId }"
          @click="store.selectAlert(a.id)"
        >
          <span class="dot" :class="{ ring: !a.dot }" :style="a.dot ? { background: a.dot } : {}"></span>
          <div style="min-width:0;flex:1">
            <div class="alert-rule-title" :style="a.firing ? {} : { color: 'var(--color-neutral-300)', fontWeight: 400 }">{{ a.title }}</div>
            <div class="alert-rule-status">{{ a.status }}</div>
          </div>
          <svg v-if="a.spark" viewBox="0 0 60 20" width="60" height="20"><polyline :points="a.spark" fill="none" :stroke="a.sparkColor" stroke-width="1.4" /></svg>
        </div>
      </div>
      <div v-if="store.selectedAlert" class="alert-detail">
        <div class="alert-detail-head"><span class="dot" :style="{ background: store.selectedAlert.dot || 'var(--color-neutral-600)' }"></span>{{ store.selectedAlert.title }}</div>
        <div class="settings-group-label">Condition</div>
        <div class="alert-condition">{{ store.selectedAlert.condition }}</div>
        <div class="settings-group-label">Notify</div>
        <div class="alert-notify">
          <span v-for="n in store.selectedAlert.notify" :key="n" class="insp-tag" style="background:#2b2741;color:var(--color-accent-300)">{{ n }}</span>
          <span v-if="!store.selectedAlert.notify.length" class="cell-muted">none configured</span>
        </div>
        <div class="settings-group-label">History</div>
        <div class="alert-history">
          <div v-for="(h, i) in store.selectedAlert.history" :key="i" class="alert-history-row">
            <span>{{ h.t }}</span><span :style="h.color ? { color: h.color } : {}">{{ h.v }}</span>
          </div>
          <div v-if="!store.selectedAlert.history.length" class="cell-muted">no history</div>
        </div>
        <div class="alert-detail-actions">
          <button class="chip txt" style="flex:1;justify-content:center"><i class="ph ph-pencil-simple"></i>Edit</button>
          <button class="chip txt" style="flex:1;justify-content:center"><i class="ph ph-bell-slash"></i>Mute 1h</button>
        </div>
      </div>
    </div>
  </div>
</template>
