// Formatting + color-coding helpers shared by every panel. Ported straight
// from the static prototype's inline script (Apache Log Monitor.html).

export const statusColor = (st) =>
  st >= 500 ? "var(--st5)" : st >= 400 ? "var(--st4)" : st >= 300 ? "var(--st3)" : "var(--st2)";

export const msColor = (ms) =>
  ms >= 1000 ? "var(--st5)" : ms >= 400 ? "var(--st4)" : "var(--color-neutral-500)";

export const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : Math.round(ms) + "ms");

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

export function nowClock(withMs) {
  const d = new Date();
  const base = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return withMs ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
}
