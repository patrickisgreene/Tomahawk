// Seed data + a client-side "live tail" generator. This is the thing that
// gets swapped out for a real Tauri log source later (see src/data/logSource.js) —
// nothing outside this file and logSource.js should know or care that the
// rows are fake.
import { fmtBytes, nowClock } from "./format";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return "r" + idCounter;
}

function row(time, ip, method, status, path, ms, bytes) {
  return { id: nextId(), time, ip, method, status, path, ms, bytes };
}

export function seedTailRows() {
  return [
    row("13:42:04.902", "198.51.100.23", "GET", 200, "/products/hydro-flask-32oz", 84, "18.4k"),
    row("13:42:05.011", "203.0.113.47", "POST", 502, "/checkout/confirm?cart=8f21a", 3102, "1.0k"),
    row("13:42:05.340", "192.0.2.180", "GET", 200, "/assets/app.4f2b.js", 12, "212k"),
    row("13:42:05.588", "198.51.100.77", "GET", 304, "/assets/logo.svg", 6, "0"),
    row("13:42:05.901", "203.0.113.12", "GET", 404, "/wp-login.php", 4, "412"),
    row("13:42:06.118", "192.0.2.44", "GET", 200, "/api/v2/cart", 96, "3.1k"),
    row("13:42:06.402", "198.51.100.23", "POST", 200, "/api/v2/cart/items", 148, "820"),
    row("13:42:06.655", "203.0.113.90", "GET", 200, "/products?page=3&sort=price", 262, "44.1k"),
    row("13:42:06.881", "192.0.2.201", "GET", 499, "/api/v2/search?q=bottle", 1420, "0"),
    row("13:42:07.118", "203.0.113.47", "POST", 502, "/checkout/confirm?cart=8f21a", 3204, "1.0k"),
    row("13:42:07.302", "198.51.100.5", "GET", 200, "/", 38, "26.7k"),
    row("13:42:07.559", "192.0.2.88", "GET", 301, "/blog", 3, "0"),
    row("13:42:07.744", "203.0.113.47", "POST", 500, "/checkout/confirm?cart=8f21a", 2870, "1.0k"),
    row("13:42:07.990", "198.51.100.61", "GET", 200, "/products/steel-tumbler", 71, "17.2k"),
    row("13:42:08.204", "192.0.2.150", "GET", 403, "/.env", 2, "199"),
    row("13:42:08.455", "198.51.100.23", "GET", 200, "/api/v2/recommendations", 312, "9.4k"),
  ];
}

export const seedErrors = [
  { t: "13:41:01", lvl: "error", mod: "proxy_fcgi", msg: "AH01067: Failed to read FastCGI header", meta: "pid 21884 · web-01", count: "×9" },
  { t: "13:41:02", lvl: "error", mod: "proxy", msg: "AH00957: FCGI: attempt to connect to unix:/run/php-fpm.sock failed", meta: "pid 21884 · web-01", count: "×4" },
  { t: "13:41:12", lvl: "warn", mod: "mpm_event", msg: "AH00484: server reached MaxRequestWorkers", meta: "web-01", count: "×2" },
  { t: "13:41:35", lvl: "error", mod: "proxy_fcgi", msg: "AH01070: Error parsing script headers", meta: "pid 21901 · web-02", count: "×3" },
  { t: "13:42:07", lvl: "error", mod: "proxy_fcgi", msg: "AH01067: Failed to read FastCGI header", meta: "pid 21884 · web-01", count: "×9" },
  { t: "13:42:09", lvl: "warn", mod: "core", msg: "AH00558: could not reliably determine server name", meta: "web-03", count: "×1" },
  { t: "13:42:18", lvl: "error", mod: "core", msg: "AH00124: Request exceeded the limit of 10 internal redirects", meta: "web-02", count: "×1" },
  { t: "13:42:24", lvl: "notice", mod: "core", msg: "AH00094: command line: /usr/sbin/httpd -D FOREGROUND", meta: "web-03", count: "×1" },
];

export const talkersData = {
  clients: [
    { label: "203.0.113.47", n: "6.1k", w: "100%" }, { label: "198.51.100.23", n: "4.4k", w: "72%" },
    { label: "192.0.2.180", n: "3.2k", w: "53%" }, { label: "203.0.113.90", n: "2.7k", w: "44%" },
    { label: "192.0.2.44", n: "1.9k", w: "31%" }, { label: "198.51.100.77", n: "1.4k", w: "23%" },
    { label: "192.0.2.201", n: "1.1k", w: "18%" },
  ],
  paths: [
    { label: "/api/v2/cart", n: "812", w: "100%" }, { label: "/checkout/confirm", n: "604", w: "74%" },
    { label: "/products", n: "441", w: "54%" }, { label: "/api/v2/search", n: "318", w: "39%" },
    { label: "/checkout/pay", n: "207", w: "25%" }, { label: "/assets/app.4f2b.js", n: "155", w: "19%" },
  ],
  agents: [
    { label: "python-requests/2.31.0", n: "6.1k", w: "100%" }, { label: "Googlebot/2.1", n: "2.7k", w: "44%" },
    { label: "Mozilla/5.0 (Win64; x64)", n: "2.1k", w: "34%" }, { label: "masscan/1.3", n: "1.4k", w: "23%" },
    { label: "Mozilla/5.0 (iPhone)", n: "960", w: "16%" },
  ],
  referrers: [
    { label: "shop.example.com/cart", n: "3.8k", w: "100%" }, { label: "(direct)", n: "2.9k", w: "76%" },
    { label: "google.com", n: "1.2k", w: "32%" }, { label: "shop.example.com/blog", n: "540", w: "14%" },
  ],
};

export const CLIENTS = {
  "203.0.113.47": { rdns: "crawl-47.datacenter.net", geo: "DE · AS24940", ua: "python-requests/2.31.0", bot: true, rate: "6.1k reqs/24h" },
  "198.51.100.23": { rdns: "198-51-100-23.res.spectrum.net", geo: "US · AS7922", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", bot: false, rate: "4.4k reqs/24h" },
  "192.0.2.180": { rdns: "ec2-192-0-2-180.compute.amazonaws.com", geo: "US · AS16509", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", bot: false, rate: "3.2k reqs/24h" },
  "203.0.113.12": { rdns: "unassigned.example.net", geo: "RU · AS12345", ua: "Mozila/4.0 (compatible)", bot: true, rate: "890 reqs/24h" },
  "192.0.2.44": { rdns: "192-0-2-44.static.example.com", geo: "US · AS16509", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)", bot: false, rate: "1.9k reqs/24h" },
  "203.0.113.90": { rdns: "crawl-90.datacenter.net", geo: "NL · AS60781", ua: "Googlebot/2.1 (+http://www.google.com/bot.html)", bot: true, rate: "2.7k reqs/24h" },
  "192.0.2.201": { rdns: "192-0-2-201.example.org", geo: "FR · AS3215", ua: "Mozilla/5.0 (X11; Linux x86_64)", bot: false, rate: "1.1k reqs/24h" },
  "198.51.100.5": { rdns: "198-51-100-5.res.spectrum.net", geo: "US · AS7922", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", bot: false, rate: "420 reqs/24h" },
  "192.0.2.88": { rdns: "192-0-2-88.example.org", geo: "CA · AS812", ua: "Mozilla/5.0 (Android 14; Mobile)", bot: false, rate: "310 reqs/24h" },
  "198.51.100.61": { rdns: "198-51-100-61.res.spectrum.net", geo: "US · AS7922", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", bot: false, rate: "780 reqs/24h" },
  "192.0.2.150": { rdns: "masscan-150.scanner.io", geo: "SG · AS132203", ua: "masscan/1.3", bot: true, rate: "14k reqs/24h" },
  "198.51.100.77": { rdns: "198-51-100-77.res.spectrum.net", geo: "US · AS7922", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", bot: false, rate: "1.4k reqs/24h" },
};

export function clientInfo(ip) {
  return CLIENTS[ip] || { rdns: "—", geo: "—", ua: "—", bot: false, rate: "—" };
}

const PATHS_POOL = [
  "/products/hydro-flask-32oz", "/checkout/confirm?cart=8f21a", "/api/v2/cart", "/api/v2/cart/items",
  "/products?page=3&sort=price", "/api/v2/search?q=bottle", "/", "/blog", "/products/steel-tumbler", "/.env",
  "/api/v2/recommendations", "/assets/app.4f2b.js", "/assets/logo.svg", "/wp-login.php", "/checkout/pay",
];
const IPS_POOL = Object.keys(CLIENTS);
const METHODS = ["GET", "GET", "GET", "POST", "GET"];
const STATUS_POOL = [200, 200, 200, 200, 200, 200, 304, 301, 404, 403, 499, 500, 502, 502];

export function makeLiveRow() {
  const status = STATUS_POOL[Math.floor(Math.random() * STATUS_POOL.length)];
  const method = METHODS[Math.floor(Math.random() * METHODS.length)];
  const ms = status >= 500 ? 1800 + Math.random() * 2200 : status >= 400 ? 20 + Math.random() * 300 : 3 + Math.random() * 350;
  const bytes = status >= 500 ? Math.round(500 + Math.random() * 1500) : Math.round(Math.random() * 40000);
  return row(
    nowClock(true),
    IPS_POOL[Math.floor(Math.random() * IPS_POOL.length)],
    method,
    status,
    PATHS_POOL[Math.floor(Math.random() * PATHS_POOL.length)],
    Math.round(ms),
    fmtBytes(bytes)
  );
}

export function synthRawLine(r) {
  const referer = r.path.startsWith("/checkout") ? "https://shop.example.com/cart" : "-";
  const info = clientInfo(r.ip);
  const micros = Math.round(r.ms * 1000 + Math.random() * 400);
  const bytesNum = String(r.bytes).replace("k", "000").replace(".", "");
  return `${r.ip} - - [14/Sep/2026:${r.time.split(".")[0]} +0000] "${r.method} ${r.path} HTTP/2.0" ${r.status} ${bytesNum} "${referer}" "${info.ua}" ${micros}`;
}

export function timingSplits(r) {
  if (r.status >= 500) return [4, 3, 88, 5];
  if (r.ms >= 400) return [3, 10, 70, 17];
  return [8, 6, 26, 60];
}

// ---- Hosts page (t6a) ----
export const hostsData = [
  { name: "web-01.iad", role: "shop.example.com", region: "us-east", vhosts: 3, sources: 6, sync: "4s ago", syncColor: "var(--st2)", ingest: "412/s", buffer: "18%", dot: "var(--st2)" },
  { name: "web-02.iad", role: "shop.example.com", region: "us-east", vhosts: 3, sources: 6, sync: "6s ago", syncColor: "var(--st2)", ingest: "388/s", buffer: "21%", dot: "var(--st2)" },
  { name: "web-03.sfo", role: "shop.example.com", region: "us-west", vhosts: 2, sources: 4, sync: "34s ago", syncColor: "var(--st4)", ingest: "204/s", buffer: "44%", dot: "var(--st4)" },
  { name: "web-04.iad", role: "api.example.com", region: "us-east", vhosts: 1, sources: 2, sync: "3s ago", syncColor: "var(--st2)", ingest: "512/s", buffer: "12%", dot: "var(--st2)" },
  { name: "lb-01.iad", role: "edge", region: "us-east", vhosts: 1, sources: 2, sync: "5s ago", syncColor: "var(--st2)", ingest: "1.2k/s", buffer: "9%", dot: "var(--st2)" },
  { name: "cdn-01.fra", role: "static.example.com", region: "eu-central", vhosts: 1, sources: 1, sync: "—", syncColor: "var(--st5)", ingest: "0/s", buffer: "0%", dot: "var(--st5)" },
  { name: "web-05.fra", role: "shop.example.com (eu)", region: "eu-central", vhosts: 2, sources: 4, sync: "9s ago", syncColor: "var(--st2)", ingest: "156/s", buffer: "15%", dot: "var(--st2)" },
  { name: "worker-01.iad", role: "api.example.com", region: "us-east", vhosts: 1, sources: 2, sync: "7s ago", syncColor: "var(--st2)", ingest: "88/s", buffer: "6%", dot: "var(--st2)" },
];

// ---- Reports page (t6b) ----
export const dayBarsData = ["Sep 8", "Sep 9", "Sep 10", "Sep 11", "Sep 12", "Sep 13", "Sep 14"].map((label, i) => ({
  label, h: [58, 64, 60, 72, 69, 40, 76][i] + "%",
}));
export const topPagesData = [
  { p: "/products", n: "1.2M" }, { p: "/api/v2/cart", n: "884k" }, { p: "/checkout/confirm", n: "412k" },
  { p: "/", n: "398k" }, { p: "/api/v2/search", n: "301k" },
];
export const topAgentsData = [
  { p: "Googlebot", n: "1.8M" }, { p: "python-requests", n: "740k" }, { p: "Chrome 128 / Win", n: "620k" },
];

// ---- Alerts page (t6c) — the full rule catalog. AlertsPanel.vue (the dock
// tab) shows only the firing/lagging ones; this is the richer list+detail view. ----
export const alertRules = [
  {
    id: "5xx-shop", dot: "var(--st5)", firing: true, title: "5xx rate > 0.3% on shop.example.com",
    status: "firing for 2m · currently 0.42%", spark: "0,15 10,14 20,12 30,8 40,4 50,3 60,5", sparkColor: "#e08a86",
    condition: "status>=500 rate over 5m > 0.3%\nwhere vhost = shop.example.com",
    notify: ["#incidents (Slack)", "on-call email"],
    history: [
      { t: "13:40 — fired", v: "0.42%", color: "var(--st5)" },
      { t: "08:12 — resolved after 4m", v: "0.18%", color: "" },
      { t: "Yesterday 22:03 — fired", v: "0.51%", color: "" },
    ],
  },
  {
    id: "lag-web03", dot: "var(--st4)", firing: true, title: "Tail lag > 3s on web-03.sfo",
    status: "firing for 6m · currently 4s", spark: "0,16 10,15 20,10 30,6 40,7 50,4 60,3", sparkColor: "#d9b380",
    condition: "resync lag > 3s\nwhere host = web-03.sfo",
    notify: ["#incidents (Slack)"],
    history: [{ t: "13:36 — fired", v: "4s", color: "var(--st4)" }],
  },
  {
    id: "p95-api", dot: "var(--color-neutral-600)", firing: false, title: "p95 latency > 800ms on api.example.com",
    status: "ok · currently 412ms", spark: "0,10 10,11 20,9 30,10 40,8 50,9 60,10", sparkColor: "#9184d9",
    condition: "p95(request_time) over 5m > 800ms\nwhere vhost = api.example.com",
    notify: ["on-call email"],
    history: [{ t: "Yesterday 14:02 — resolved after 9m", v: "710ms", color: "" }],
  },
  {
    id: "404-static", dot: "var(--color-neutral-600)", firing: false, title: "404 rate > 5% on static.example.com",
    status: "ok · currently 1.1%", spark: "0,12 10,12 20,13 30,12 40,13 50,12 60,12", sparkColor: "#9184d9",
    condition: "status==404 rate over 5m > 5%\nwhere vhost = static.example.com",
    notify: ["#incidents (Slack)"],
    history: [],
  },
  {
    id: "buffer-any", dot: "", firing: false, paused: true, title: "Disk buffer > 80% on any host",
    status: "paused", spark: "", sparkColor: "",
    condition: "disk_buffer_pct > 80%\nwhere host = *",
    notify: [],
    history: [],
  },
];

// ---- Panel picker (t3) — the catalog shown in the "+" popover, grouped. ----
export const panelCatalog = [
  { group: "Streams", items: [
    { id: "access", icon: "ph-table", name: "Access log", desc: "Sortable, paused view of parsed request rows — resync to pull latest" },
    { id: "errlog", icon: "ph-warning-circle", name: "Error log", desc: "httpd error_log entries, by severity" },
  ] },
  { group: "Analysis", items: [
    { id: "query", icon: "ph-funnel", name: "Query builder", desc: "Visual field/operator conditions over any source" },
    { id: "traffic", icon: "ph-chart-line", name: "Status & latency charts", desc: "Hit volume, status-code mix, p95/p99 over time" },
    { id: "talkers", icon: "ph-ranking", name: "Top talkers", desc: "Ranked clients, paths, agents and referrers" },
  ] },
  { group: "Structure", items: [
    { id: "sources", icon: "ph-hard-drives", name: "Sources", desc: "Fleet → host → vhost → log file tree" },
    { id: "saved", icon: "ph-bookmark-simple", name: "Saved filters", desc: "Bookmarked queries and cases" },
    { id: "alerts", icon: "ph-bell-ringing", name: "Alerts & thresholds", desc: "Firing rules and their recent history" },
    { id: "inspector", icon: "ph-magnifying-glass-plus", name: "Entry inspector", desc: "Full detail for one selected log line" },
  ] },
];

// ---- Add source dialog (t2) — a tiny mock filesystem, keyed by "/"-joined path. ----
export const fileBrowserFS = {
  "Home/var/log/httpd": [
    { name: "apache2", kind: "dir" },
    { name: "access.log", kind: "file", modified: "4s ago", size: "842 MB", format: "Combined format detected" },
    { name: "error.log", kind: "file", modified: "2m ago", size: "61 MB" },
    { name: "access.log.1.gz", kind: "archive", modified: "Yesterday", size: "118 MB" },
    { name: "access.log.2.gz", kind: "archive", modified: "2 days ago", size: "109 MB" },
  ],
  "Home/var/log/httpd/apache2": [
    { name: "ssl_access.log", kind: "file", modified: "1m ago", size: "44 MB", format: "Combined format detected" },
    { name: "ssl_error.log", kind: "file", modified: "5m ago", size: "9 MB" },
  ],
};
export const sftpBrowserFS = {
  "/var/log": [
    { name: "httpd", kind: "dir" },
  ],
  "/var/log/httpd": [
    { name: "httpd-access.log", kind: "file", modified: "just now", size: "1.1 GB", format: "Combined format" },
    { name: "httpd-error.log", kind: "file", modified: "1m ago", size: "88 MB" },
  ],
};

// ---- Traffic tab (t4c) — the stacked status-mix strip under the chart. ----
export function statusBarsData() {
  return Array.from({ length: 30 }, (_, i) => {
    const spike = i >= 20 && i <= 23;
    const h5 = spike ? 8 + (i - 20) * 4 : 1;
    const h4 = spike ? 6 : 2 + (i % 4);
    const h3 = 3 + (i % 3);
    const h2 = 34 - h5 - h4 - h3;
    return { h5: h5 + "px", h4: h4 + "px", h3: h3 + "px", h2: h2 + "px" };
  });
}

export function sourcesTree() {
  return [
    { kind: "fleet", label: "edge-fleet", count: 18, expanded: true, children: [
      { kind: "host", label: "web-01.iad", status: "var(--st2)", expanded: true, children: [
        { kind: "vhost", label: "shop.example.com", expanded: true, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text", selected: true },
          { kind: "file", label: "error.log", icon: "ph-file-text" },
          { kind: "file", label: "access.log.1.gz", icon: "ph-archive", dim: true },
        ] },
        { kind: "vhost", label: "api.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
          { kind: "file", label: "error.log", icon: "ph-file-text" },
        ] },
        { kind: "vhost", label: "static.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
        ] },
      ] },
      { kind: "host", label: "web-02.iad", status: "var(--st2)", expanded: false, children: [
        { kind: "vhost", label: "shop.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
        ] },
      ] },
      { kind: "host", label: "web-03.sfo", status: "var(--st4)", lag: "lag 4s", expanded: false, children: [
        { kind: "vhost", label: "shop.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
        ] },
      ] },
      { kind: "host", label: "lb-01.iad", status: "var(--st2)", expanded: false, children: [
        { kind: "vhost", label: "lb.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
        ] },
      ] },
    ] },
    { kind: "fleet", label: "staging", count: 3, dim: true, expanded: false, children: [
      { kind: "host", label: "stg-01", status: "var(--color-neutral-600)", expanded: false, children: [
        { kind: "vhost", label: "shop.example.com", expanded: false, children: [
          { kind: "file", label: "access.log", icon: "ph-file-text" },
        ] },
      ] },
    ] },
  ];
}
