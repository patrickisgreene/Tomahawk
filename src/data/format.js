// Formatting + color-coding helpers shared by every panel. Ported straight
// from the static prototype's inline script (Apache Log Monitor.html).

export const statusColor = (st) =>
  st >= 500 ? "var(--st5)" : st >= 400 ? "var(--st4)" : st >= 300 ? "var(--st3)" : "var(--st2)";

export const msColor = (ms) =>
  ms == null ? "var(--color-neutral-700)" : ms >= 1000 ? "var(--st5)" : ms >= 400 ? "var(--st4)" : "var(--color-neutral-500)";

// Standard Combined log format doesn't include response time at all (it
// needs a custom LogFormat directive like %D/%T) — `ms` is genuinely
// absent for most real log sources, not just zero.
export const fmtMs = (ms) => (ms == null ? "—" : ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : Math.round(ms) + "ms");

export const fmtBytes = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

export const STATUS_TEXT = {
  200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found",
  304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 408: "Request Timeout", 429: "Too Many Requests", 499: "Client Closed Request",
  500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Use the absolute timestamp and the computer\'s timezone (including DST).
export function formatLocalTimestamp(ts) {
  if (ts == null || !Number.isFinite(ts)) return "-";
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function nowClock(withMs) {
  const d = new Date();
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return withMs ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
}

// A non-ticking relative-time formatter — for rendering a per-row timestamp
// inside a v-for over a dynamic list, where useRelativeTime's per-instance
// setInterval (meant for a single "synced Xs ago" label) isn't a fit.
export function formatRelative(ts) {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 1) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
