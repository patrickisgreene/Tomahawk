import { ref, computed, onMounted, onUnmounted } from "vue";

// Ticks once a second so a "synced Xs ago" label anywhere in the UI stays
// live without each caller managing its own timer.
export function useRelativeTime(timestampGetter) {
  const now = ref(Date.now());
  let timer;
  onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
  onUnmounted(() => clearInterval(timer));

  return computed(() => {
    const secs = Math.max(0, Math.round((now.value - timestampGetter()) / 1000));
    if (secs < 1) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    return `${mins}m ago`;
  });
}
