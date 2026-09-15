import { ref, onMounted, onUnmounted } from "vue";

// A small random-walk series for the throughput sparklines. Re-rolls itself
// every `intervalMs` so the panel feels alive without needing real metrics
// wired up yet.
export function useSparkline({ count, min, max, jitter, intervalMs = 4000 }) {
  function generate() {
    let v = (min + max) / 2;
    const arr = [];
    for (let i = 0; i < count; i++) {
      v += (Math.random() - 0.5) * jitter;
      v = Math.max(min, Math.min(max, v));
      arr.push(v);
    }
    return arr;
  }

  const points = ref(generate());
  let timer;
  onMounted(() => {
    timer = setInterval(() => { points.value = generate(); }, intervalMs);
  });
  onUnmounted(() => clearInterval(timer));
  return points;
}

export function toPolylinePoints(values, width, height) {
  const step = width / (values.length - 1);
  return values.map((v, i) => `${(i * step).toFixed(1)},${(height - v).toFixed(1)}`).join(" ");
}
