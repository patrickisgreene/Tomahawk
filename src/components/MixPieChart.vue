<script setup>
import { ref } from "vue";

defineProps({
  slices: { type: Array, required: true }, // [{ key, label, color, count, pct, path }]
  total: { type: Number, required: true },
  emptyLabel: { type: String, default: "No rows ingested yet." },
});

// Hover/focus lifts the slice (see app.css .status-pie path.hovered) and
// mirrors onto the matching legend row — same details reachable by keyboard
// focus as by pointer hover.
const hoverIdx = ref(null);
function summaryFor(slice) {
  return `${slice.label} — ${slice.count.toLocaleString()} requests (${slice.pct.toFixed(1)}%)`;
}
</script>

<template>
  <div v-if="!slices.length" class="insp-empty">{{ emptyLabel }}</div>
  <div v-else class="status-pie-wrap">
    <svg viewBox="0 0 120 120" class="status-pie" role="img" :aria-label="`Split across ${total.toLocaleString()} requests`">
      <path
        v-for="(slice, i) in slices"
        :key="slice.key"
        :d="slice.path"
        :fill="slice.color"
        :class="{ hovered: hoverIdx === i }"
        tabindex="0"
        role="img"
        :aria-label="summaryFor(slice)"
        @pointerenter="hoverIdx = i"
        @pointerleave="hoverIdx === i && (hoverIdx = null)"
        @focus="hoverIdx = i"
        @blur="hoverIdx === i && (hoverIdx = null)"
      ><title>{{ summaryFor(slice) }}</title></path>
    </svg>
    <div class="status-legend">
      <div
        v-for="(slice, i) in slices"
        :key="slice.key"
        class="status-legend-row"
        :class="{ hovered: hoverIdx === i }"
        @pointerenter="hoverIdx = i"
        @pointerleave="hoverIdx === i && (hoverIdx = null)"
      >
        <span class="status-legend-swatch" :style="{ background: slice.color }"></span>
        <span class="status-legend-label">{{ slice.label }}</span>
        <span class="status-legend-count">{{ slice.count.toLocaleString() }}</span>
        <span class="status-legend-pct">{{ slice.pct.toFixed(1) }}%</span>
      </div>
    </div>
  </div>
</template>
