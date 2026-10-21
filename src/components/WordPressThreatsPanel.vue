<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { classifyRequest } from "../data/classification";
const store = useMonitorStore();
const CATEGORIES = [
  { id: "xmlrpc", label: "XML-RPC activity", pattern: "xmlrpc\\.php" },
  { id: "rest", label: "REST API probing", pattern: "wp-json" },
  { id: "plugins", label: "Plugin scans", pattern: "wp-content/plugins/" },
  { id: "themes", label: "Theme scans", pattern: "wp-content/themes/" },
  { id: "sitemap", label: "Sitemap discovery", pattern: "wp-sitemap(-index)?\\.xml" },
  { id: "cron", label: "Cron and trackback", pattern: "wp-(cron|comments-post|trackback|links-opml|mail)\\.php" },
  { id: "install", label: "Installation probing", pattern: "wp-admin/install|wp-includes/" },
];
const threats = computed(() => {
  return CATEGORIES.map((category) => ({ ...category, count: store.tailRows.filter((row) => new RegExp(category.pattern, "i").test(row.path || "")).length }))
    .filter((category) => category.count > 0).sort((a, b) => b.count - a.count);
});
function filterThreat(category) { store.setTailFilter(""); store.applyAlertConditions([{ id: "wordpress-threat-" + category.id, field: "path", operator: "matches", value: category.pattern }]); }
</script>
<template>
  <div class="panel-fill">
    <div class="settings-group-label" style="padding:10px 12px 4px">WordPress threats</div>
    <div class="settings-sub" style="padding:0 12px 10px">Classified activity in the loaded log rows.</div>
    <div class="wordpress-threat-list">
      <div v-if="!threats.length" class="insp-empty">No WordPress threats found.</div>
      <button v-for="threat in threats" :key="threat.id" class="alert-row warn" @click="filterThreat(threat)"><span class="dot"></span><span class="title">{{ threat.label }}</span><span class="age">{{ threat.count }} rows</span></button>
    </div>
  </div>
</template>
