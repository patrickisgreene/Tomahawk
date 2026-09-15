<script setup>
import { useMonitorStore } from "../store/monitor";
import { formatRelative } from "../data/format";

const store = useMonitorStore();

function onLoad(query) {
  store.loadSavedQuery(query.id);
  store.openPanel("bottom", "query");
}
</script>

<template>
  <div class="panel-fill">
    <div class="search-row">
      <div class="filterbar">
        <i class="ph ph-magnifying-glass"></i>
        <input
          :value="store.savedQueryFilter"
          @input="store.setSavedQueryFilter($event.target.value)"
          placeholder="Filter saved searches..."
        >
      </div>
    </div>
    <div class="tree">
      <div v-if="!store.filteredSavedQueries.length" class="tree-row dim">No saved searches yet.</div>
      <div
        v-for="query in store.filteredSavedQueries"
        :key="query.id"
        class="tree-row"
        :class="{ selected: query.id === store.activeSavedQueryId }"
        :title="store.savedQuerySummary(query)"
        @click="onLoad(query)"
      >
        <i class="ph ph-funnel" style="color:var(--color-neutral-500)"></i>
        <span>{{ store.savedQueryLabel(query) }}</span>
        <span class="count">{{ query.conditions.length }} condition{{ query.conditions.length === 1 ? "" : "s" }}</span>
        <span class="lag">{{ formatRelative(query.savedAt) }}</span>
        <span class="row-actions">
          <i class="ph ph-trash" title="Delete saved search" @click.stop="store.removeSavedQuery(query.id)"></i>
        </span>
      </div>
    </div>
  </div>
</template>
