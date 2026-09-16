<script setup>
import { onMounted } from "vue";
import { useMonitorStore } from "../store/monitor";
import AppSelect from "./AppSelect.vue";

const store = useMonitorStore();

onMounted(() => {
  store.loadQueryFields().catch((e) => console.error("[query-fields]", e));
});

function barHeight(i) {
  const rows = store.filteredTailRows;
  if (!rows.length) return 8;
  const bucketCount = 16;
  const bucket = Math.floor((i / bucketCount) * rows.length);
  const next = Math.floor(((i + 1) / bucketCount) * rows.length);
  return Math.max(8, Math.round(((next - bucket) / Math.max(1, rows.length / bucketCount)) * 70));
}

function barColor(i) {
  return i > 10 ? "var(--color-accent-600)" : "var(--color-accent-800)";
}

function fieldOptions() {
  return store.queryFields.map((field) => ({ value: field.id, label: field.label }));
}

function operatorOptions(fieldId) {
  return store.operatorsForField(fieldId).map((operator) => ({ value: operator.id, label: operator.label }));
}
</script>

<template>
  <div class="panel-fill">
    <div class="query-row">
      <i class="ph ph-database" style="color:var(--color-accent-300)"></i>
      <div class="sep"></div>
      <input
        class="query-name-input"
        :value="store.queryName"
        placeholder="Name search..."
        @input="store.setQueryName($event.target.value)"
      >
      <button class="chip txt" @click="store.newQuery()"><i class="ph ph-plus"></i>New</button>
      <button class="chip txt" @click="store.saveCurrentQuery()"><i class="ph ph-floppy-disk"></i>Save</button>
      <div class="query-meta">
        matched {{ store.queryMatchedRows.toLocaleString() }} of {{ store.queryTotalRows.toLocaleString() }}
      </div>
    </div>
    <div class="query-body">
      <div v-for="(condition, i) in store.queryConditions" :key="condition.id" class="cond-row">
        <span class="cond-label" :class="{ and: i > 0 }">{{ i === 0 ? "Where" : "and" }}</span>
        <AppSelect
          class="cond-field"
          :model-value="condition.field"
          :options="fieldOptions()"
          aria-label="Query field"
          @update:model-value="store.updateQueryCondition(condition.id, { field: $event })"
        />
        <AppSelect
          class="cond-field cond-op"
          :model-value="condition.operator"
          :options="operatorOptions(condition.field)"
          aria-label="Query operator"
          @update:model-value="store.updateQueryCondition(condition.id, { operator: $event })"
        />
        <input
          class="cond-value"
          :value="condition.value"
          @input="store.updateQueryCondition(condition.id, { value: $event.target.value })"
        >
        <i class="ph ph-x cond-x" @click="store.removeQueryCondition(condition.id)"></i>
      </div>
      <div class="cond-row" style="margin-top:2px">
        <button class="add-cond" @click="store.addQueryCondition()"><i class="ph ph-plus"></i>Add condition</button>
        <button class="edit-text"><i class="ph ph-brackets-curly"></i>Edit as text</button>
      </div>
      <div class="hist">
        <div class="hist-bars">
          <div v-for="i in 16" :key="i" :style="{ height: barHeight(i - 1) + '%', background: barColor(i - 1) }"></div>
        </div>
        <div class="hist-labels"><span>oldest</span><span>current query</span><span>newest</span></div>
      </div>
    </div>
  </div>
</template>
