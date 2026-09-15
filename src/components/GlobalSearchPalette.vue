<script setup>
import { computed, ref, onMounted } from "vue";
import { useMonitorStore } from "../store/monitor";
import { clientInfo } from "../data/mock";

const store = useMonitorStore();
const inputEl = ref(null);
onMounted(() => inputEl.value?.focus());

const q = computed(() => store.globalSearchQuery.trim());

const matchedClient = computed(() => {
  if (!q.value) return null;
  return store.tailRows.some((r) => r.ip === q.value) ? { ip: q.value, info: clientInfo(q.value) } : null;
});

const matchedLines = computed(() => {
  if (!q.value) return [];
  return store.tailRows.filter((r) => r.ip === q.value || r.path.includes(q.value)).slice(-4).reverse();
});

function goTo(page) {
  store.setPage(page);
  store.closeGlobalSearch();
}
function filterByClient() {
  store.openPanel("stream", "access");
  store.setTailFilter(`client=="${q.value}"`);
  store.closeGlobalSearch();
}
</script>

<template>
  <div class="modal-backdrop search-backdrop" @click.self="store.closeGlobalSearch()">
    <div class="search-palette">
      <div class="search-palette-input">
        <i class="ph ph-magnifying-glass" style="color:var(--color-accent-400)"></i>
        <input
          ref="inputEl"
          :value="store.globalSearchQuery"
          @input="store.setGlobalSearchQuery($event.target.value)"
          @keydown.esc="store.closeGlobalSearch()"
          placeholder="Search clients, hosts, filters, settings…"
        >
        <span class="kbd-hint">esc</span>
      </div>
      <div class="popover-list" style="max-height:340px">
        <template v-if="matchedClient">
          <div class="popover-group-label">Clients</div>
          <div class="popover-item" @click="filterByClient">
            <i class="ph ph-user-focus" style="color:var(--color-accent-300)"></i>
            <div style="min-width:0">
              <div class="popover-item-name">{{ matchedClient.ip }}</div>
              <div class="popover-item-desc">{{ matchedClient.info.geo }} · classified {{ matchedClient.info.bot ? "bot" : "human" }} · {{ matchedClient.info.rate }}</div>
            </div>
            <span class="kbd-hint-inline">↵</span>
          </div>
        </template>

        <template v-if="matchedLines.length">
          <div class="popover-group-label">Matching log lines</div>
          <div v-for="r in matchedLines" :key="r.id" class="popover-item" @click="store.selectRow(r.id); goTo('monitor')">
            <span class="history-status" :style="{ color: r.status >= 500 ? 'var(--st5)' : 'var(--color-neutral-400)' }">{{ r.status }}</span>
            <div style="min-width:0">
              <div class="popover-item-name" style="font-family:ui-monospace,Menlo,monospace">{{ r.method }} {{ r.path }}</div>
              <div class="popover-item-desc" style="font-family:ui-monospace,Menlo,monospace">{{ r.time }}</div>
            </div>
          </div>
        </template>

        <template v-if="q">
          <div class="popover-group-label">Filters &amp; jump-to</div>
          <div class="popover-item" @click="filterByClient">
            <i class="ph ph-funnel"></i>
            <span class="popover-item-name" style="font-weight:400">Filter Access log by client {{ q }}</span>
          </div>
          <div class="popover-item">
            <i class="ph ph-bell-ringing"></i>
            <span class="popover-item-name" style="font-weight:400">Create alert on this client</span>
          </div>
        </template>

        <div class="popover-group-label">Go to</div>
        <div class="popover-item" @click="goTo('hosts')">
          <i class="ph ph-hard-drives"></i>
          <span class="popover-item-name" style="font-weight:400;flex:1">Hosts</span>
          <span v-if="q && !matchedClient" class="popover-item-desc">no host matches this IP</span>
        </div>
        <div class="popover-item" @click="goTo('reports')"><i class="ph ph-chart-line"></i><span class="popover-item-name" style="font-weight:400">Reports</span></div>
        <div class="popover-item" @click="goTo('alerts')"><i class="ph ph-bell-ringing"></i><span class="popover-item-name" style="font-weight:400">Alerts</span></div>
      </div>
      <div class="popover-foot">
        <span><span class="kbd-hint-inline">↑↓</span> navigate</span>
        <span><span class="kbd-hint-inline">↵</span> go</span>
        <span style="margin-left:auto">searches hosts, sources, clients, filters, settings</span>
      </div>
    </div>
  </div>
</template>
