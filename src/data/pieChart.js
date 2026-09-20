// Shared pie-wedge geometry for the dock panels' "Total" tabs (StatusMixContent,
// MethodMixContent). Slices are separated by a real angular gap rather than a
// painted border, so the separation reads correctly against any surface color
// behind the chart (see the dataviz skill's "surface gap" rule).
const PIE_GAP = 0.035; // radians of empty space between adjacent slices

function wedgePath(cx, cy, r, start, end) {
  const arcPoint = (angle) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  const [x1, y1] = arcPoint(start);
  const [x2, y2] = arcPoint(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * @param {{ key: string, label: string, color: string, count: number, pct: number }[]} classes
 * @returns slices with a `path` (SVG `d` attribute) added, zero-count classes dropped
 */
export function buildPieSlices(classes, cx, cy, r) {
  const total = classes.reduce((sum, c) => sum + c.count, 0);
  let cursor = 0;
  const result = [];
  for (const cls of classes) {
    const fraction = total ? cls.count / total : 0;
    const start = cursor * Math.PI * 2;
    cursor += fraction;
    const end = cursor * Math.PI * 2;
    const span = end - start - PIE_GAP;
    if (fraction <= 0 || span <= 0) continue;
    const padStart = start + PIE_GAP / 2;
    result.push({ ...cls, path: wedgePath(cx, cy, r, padStart, padStart + span) });
  }
  return result;
}
