<script setup>
import { computed, ref } from "vue";
import { useMonitorStore } from "../store/monitor";

const props = defineProps({
  rawDomains: { type: Array, default: () => [] },
});

const store = useMonitorStore();
const open = ref(false);
const query = ref("");

// Shared-hosting logs often carry a site both bare ("a.com") and with its
// "www." twin as a separate hostname. Grouping by the bare form collapses
// that pair into a single list entry — the www checkboxes below decide how
// a pick is matched against the underlying rows.
function bareForm(domain) {
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}
const groupedDomains = computed(() => {
  const roots = new Set(props.rawDomains.map(bareForm));
  return [...roots].sort((a, b) => a.localeCompare(b));
});
const filteredDomains = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return groupedDomains.value;
  return groupedDomains.value.filter((domain) => domain.toLowerCase().includes(q));
});
const triggerLabel = computed(() => store.tailDomain || `All domains (${groupedDomains.value.length})`);

function toggle() {
  open.value = !open.value;
  if (open.value) query.value = "";
}
function close() {
  open.value = false;
}
function select(domain) {
  store.setTailDomain(domain);
  close();
}
</script>

<template>
  <div class="domain-picker" :class="{ open }">
    <div v-if="open" class="popup-backdrop" @click="close"></div>
    <button class="chip" aria-label="Domain" @click="toggle">{{ triggerLabel }}</button>
    <div v-if="open" class="domain-options" @click.stop>
      <label class="toggle-row compact" @click="store.setTailIncludeWww(!store.tailIncludeWww)">
        <span>Include www. automatically</span>
        <span class="toggle" :class="{ on: store.tailIncludeWww }"><span class="knob"></span></span>
      </label>
      <label class="toggle-row compact" @click="store.setTailOnlyWww(!store.tailOnlyWww)">
        <span>Only www. traffic</span>
        <span class="toggle" :class="{ on: store.tailOnlyWww }"><span class="knob"></span></span>
      </label>
      <div class="filterbar domain-search">
        <i class="ph ph-magnifying-glass"></i>
        <input v-model="query" placeholder="Search domains…" autofocus>
      </div>
      <div class="domain-list">
        <div class="dropdown-item" :class="{ active: !store.tailDomain }" @click="select('')">
          All domains ({{ groupedDomains.length }})
        </div>
        <div
          v-for="domain in filteredDomains"
          :key="domain"
          class="dropdown-item"
          :class="{ active: domain === store.tailDomain }"
          @click="select(domain)"
        >{{ domain }}</div>
        <div v-if="!filteredDomains.length" class="insp-empty">No domains match.</div>
      </div>
    </div>
  </div>
</template>
