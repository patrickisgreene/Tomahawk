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

// Shared by the dock panels' Mix tabs (StatusMixContent, MethodMixContent).
export const fmtRate = (r) => {
  if (r >= 1000) return (r / 1000).toFixed(2).replace(/\.?0+$/, "") + "k/s";
  if (r >= 10) return r.toFixed(0) + "/s";
  return r.toFixed(1) + "/s";
};
export const fmtDuration = (sec) => {
  if (sec < 60) return Math.round(sec) + "s";
  const mins = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return mins + "m" + (rem ? " " + rem + "s" : "");
};

export const STATUS_TEXT = {
  200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found",
  304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 408: "Request Timeout", 429: "Too Many Requests", 499: "Client Closed Request",
  500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateParts(date, utc) {
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  const month = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
  const day = utc ? date.getUTCDate() : date.getDate();
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = utc ? date.getUTCMinutes() : date.getMinutes();
  const seconds = utc ? date.getUTCSeconds() : date.getSeconds();
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function formatShortDateParts(date, utc) {
  const month = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
  const day = utc ? date.getUTCDate() : date.getDate();
  const hours = utc ? date.getUTCHours() : date.getHours();
  const minutes = utc ? date.getUTCMinutes() : date.getMinutes();
  return `${pad2(month)}/${pad2(day)} ${pad2(hours)}:${pad2(minutes)}`;
}

// Keep one fixed timestamp shape while switching which timezone supplies
// the date/time parts. `source` returns the original log timestamp string.
export function formatTimestamp(rowOrTs, mode = "local", displayFormat = "full") {
  if ((mode === "source" || displayFormat === "source") && rowOrTs && typeof rowOrTs === "object") return rowOrTs.timestamp || "-";
  const ts = rowOrTs && typeof rowOrTs === "object" ? rowOrTs.ts : rowOrTs;
  if (ts == null || !Number.isFinite(ts)) return "-";
  if (displayFormat === "relative") return formatRelative(ts);
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return "-";
  if (displayFormat === "short") return formatShortDateParts(date, mode === "utc");
  return formatDateParts(date, mode === "utc");
}

export const formatLocalTimestamp = (ts) => formatTimestamp(ts, "local");

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
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}
