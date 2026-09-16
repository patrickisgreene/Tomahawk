<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { classifyRequest } from "../data/classification";
const store = useMonitorStore();
const alerts = computed(() => {
  const groups = new Map();
  for (const row of store.tailRows) for (const tag of classifyRequest(row, store.localRules)) {
    const item = groups.get(tag.id) || { ...tag, count: 0 };
    item.count++; groups.set(tag.id, item);
  }
  return [...groups.values()].sort((a,b) => (b.severity === "high") - (a.severity === "high") || b.count - a.count);
});
function showAlert(alert) {
  const patterns = { "path-traversal": "\\.\\.|%2e%2e", "sqli-probe": "union|select|sleep|%27|information_schema", "xss-probe": "<script|javascript:|onerror|alert\\(", "command-injection": "powershell|/bin/(sh|bash)|cmd\\.exe|jndi:", webshell: "c99|r57|shell\\.php|backdoor", "config-probe": "\\.env|\\.git|wp-config|\\.htaccess|\\.bak", "login-probe": "wp-login|wp-admin|xmlrpc|phpmyadmin|admin" };
  store.setTailFilter("");
  store.queryConditions = [{ id: "alert-" + alert.id, field: "path", operator: "matches", value: patterns[alert.id] || alert.label }];
}
function clearAlertFilter() {
  store.queryConditions = [];
}
</script>

<template>
  <div class="panel-fill">
    <div class="alerts-list">
      <button v-if="store.queryConditions.length" class="chip txt alert-clear" @click="clearAlertFilter"><i class="ph ph-x"></i>Clear alert filter</button>
      <div v-if="!alerts.length" class="alerts-empty">No classified warnings in the loaded rows.</div>
      <button v-for="alert in alerts" :key="alert.id" class="alert-row" :class="alert.severity === 'high' ? 'firing' : 'warn'" @click="showAlert(alert)"><span class="dot"></span><span class="title">{{ alert.label }}</span><span class="age">{{ alert.count }} rows</span></button>
      <!--
      <div class="alert-row warn"><span class="dot" style="background:var(--st4)"></span><span class="title">web-03 tail lag 4s</span><span class="age">6m</span></div>
      <div class="alert-row"><span class="dot" style="background:var(--color-neutral-600)"></span><span class="title" style="color:var(--color-neutral-500);font-weight:400">p95 &gt; 800ms · api</span><span class="age" style="color:var(--color-neutral-700)">ok</span></div> -->
    </div>
  </div>
</template>
