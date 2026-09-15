// Real values (e.g. req/s) aren't pre-scaled to fit an SVG viewBox the way
// mock data used to be generated with a fixed min/max — normalize into the
// chart's own coordinate space before handing off to toPolylinePoints.
export function normalizeSpark(values, height, padding = 2) {
  if (!values.length) return [];
  const max = Math.max(...values, 0.0001);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  return values.map((v) => padding + ((v - min) / range) * (height - padding * 2));
}

export function toPolylinePoints(values, width, height) {
  const step = width / (values.length - 1);
  return values.map((v, i) => `${(i * step).toFixed(1)},${(height - v).toFixed(1)}`).join(" ");
}
