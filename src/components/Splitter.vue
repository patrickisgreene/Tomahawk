<script setup>
import { ref } from "vue";
import { useMonitorStore } from "../store/monitor";

const props = defineProps({
  // "width" for vertical bars between columns, "height" for horizontal bars
  // between rows.
  axis: { type: String, default: "width" },
  // Key into store.panelSizes — the panel this handle resizes.
  target: { type: String, required: true },
  // True when the resized panel sits AFTER this handle (right or below),
  // which makes it grow when the handle moves left/up (negative delta).
  invert: { type: Boolean, default: false },
});

const store = useMonitorStore();
const dragging = ref(false);
const last = ref({ x: 0, y: 0 });

function onPointerDown(event) {
  event.preventDefault();
  dragging.value = true;
  last.value = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!dragging.value) return;
  const delta = props.axis === "width" ? event.clientX - last.value.x : event.clientY - last.value.y;
  if (delta === 0) return;
  last.value = { x: event.clientX, y: event.clientY };
  store.resizePanel(props.target, props.invert ? -delta : delta);
}

function endDrag() {
  dragging.value = false;
}
</script>

<template>
  <div
    class="splitter"
    :class="[axis === 'width' ? 'vert' : 'horiz', { dragging }]"
    role="separator"
    :aria-orientation="axis === 'width' ? 'vertical' : 'horizontal'"
    aria-label="Resize panel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
  >···</div>
</template>