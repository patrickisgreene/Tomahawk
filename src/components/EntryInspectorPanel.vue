<script setup>
import { reactive, computed, watch } from "vue";
import { useMonitorStore } from "../store/monitor";
import { statusColor, fmtMs, STATUS_TEXT } from "../data/format";
import { clientInfo, synthRawLine, timingSplits } from "../data/mock";
import { classifyRequest, isLikelyBot } from "../data/classification";
import { isTauri } from "../data/logSource";
import WorldMap from "./WorldMap.vue";

const store = useMonitorStore();
const collapsed = reactive({});
function toggle(id) {
  collapsed[id] = !collapsed[id];
}

const r = computed(() => store.selectedRow);
const info = computed(() => (r.value ? clientInfo(r.value.ip) : null));
const geoip = computed(() => (r.value ? store.geoip.byIp[r.value.ip] : null));
const flagAssets = import.meta.glob("/node_modules/flag-icons/flags/4x3/*.svg", { eager: true, query: "?url", import: "default" });
const countryFlag = computed(() => {
  const code = geoip.value?.countryCode?.toLowerCase();
  if (!code || !/^[a-z]{2}$/.test(code)) return null;
  return flagAssets["/node_modules/flag-icons/flags/4x3/" + code + ".svg"] || null;
});
const geoipLoading = computed(() => !!r.value && store.geoip.loadingIps.includes(r.value.ip));
const isDanger = computed(() => !!r.value && r.value.status >= 500);
const pathParts = computed(() => (r.value ? r.value.path.split("?") : ["", null]));
const splits = computed(() => (r.value ? timingSplits(r.value) : [0, 0, 0, 0]));

// Reverse DNS + city/ASN enrichment, fetched live once per IP. In the plain
// browser dev preview (no Tauri backend) there's nothing to resolve, so the
// demo rows fall back to their canned clientInfo values.
const details = computed(() => (r.value ? store.enrichment.byIp[r.value.ip] : null));
const detailsLoading = computed(() => !!r.value && store.enrichment.loadingIps.includes(r.value.ip));
const rdnsText = computed(() => {
  if (details.value?.rdns) return details.value.rdns;
  if (detailsLoading.value) return "resolving…";
  if (!isTauri() && info.value?.rdns && info.value.rdns !== "not implemented yet") return info.value.rdns;
  return "no PTR record";
});
const locationFallback = computed(() =>
  !isTauri() && info.value?.geo && info.value.geo !== "not implemented yet" ? info.value.geo : null
);
const cityText = computed(() => {
  if (details.value) {
    const city = [details.value.city, details.value.region].filter(Boolean).join(", ");
    if (city) return city;
  }
  return locationFallback.value;
});
const coordsText = computed(() => {
  const d = details.value;
  if (d?.lat != null && d?.lon != null) return `${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}`;
  return null;
});
const asnText = computed(() => {
  const d = details.value;
  if (d?.asn != null) return `AS${d.asn}${d.org ? " · " + d.org : ""}`;
  return null;
});

// URL-pattern classifications for the selected request — tags describe what
// the request looks like, never that an exploit succeeded.
const classification = computed(() => (r.value ? classifyRequest(r.value, store.localRules) : []));
const isBot = computed(() => (r.value ? isLikelyBot(r.value.userAgent || info.value?.ua, store.localRules) : false));

// Split the raw log line into plain/highlighted segments so the status
// code can be colored without resorting to v-html. Real rows carry their
// actual original line (`raw`); mock rows never had one, so they fall
// back to a synthesized approximation.
const rawLineParts = computed(() => {
  if (!r.value) return [];
  const line = r.value.raw || synthRawLine(r.value);
  const status = String(r.value.status);
  const re = new RegExp(`(\\s)(${status})(\\s)`);
  const m = line.match(re);
  if (!m) return [{ text: line, highlight: false }];
  const idx = m.index + m[1].length;
  return [
    { text: line.slice(0, idx), highlight: false },
    { text: status, highlight: true },
    { text: line.slice(idx + status.length), highlight: false },
  ];
});

function filterByEntry() {
  if (!r.value) return;
  store.setTailFilter("");
  store.queryConditions = [
    { id: "entry-status", field: "status", operator: "=", value: String(r.value.status) },
    { id: "entry-path", field: "path", operator: "=", value: r.value.path },
  ];
}

watch(
  () => r.value?.ip,
  (ip) => {
    if (ip) {
      store.lookupGeoipForIp(ip);
      store.lookupEnrichmentForIp(ip);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="panel-fill">
    <div class="insp-search">
      <div class="chip txt"><i class="ph ph-list-dashes"></i>All fields<span class="caret">▾</span></div>
      <div class="filterbar"><i class="ph ph-magnifying-glass"></i><input placeholder="Filter fields…"></div>
      <i class="ph ph-push-pin" style="color:var(--color-neutral-600)"></i>
    </div>
    <div style="padding:6px;flex:none">
      <button class="insp-filter-btn" @click="filterByEntry"><i class="ph ph-funnel-simple"></i>Filter tail by this entry</button>
    </div>

    <div v-if="!r" class="insp-empty">Select a tail row to inspect it.</div>

    <div v-else class="insp-body">
      <div class="insp-section-hd" @click="toggle('logged')">Log fields</div>
      <template v-if="!collapsed.logged">
        <div class="insp-field"><span class="k">Timestamp</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.timestamp ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Hostname</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.hostname ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Ident</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.ident ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Authenticated user</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.authUser ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">X-Forwarded-For</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.forwardedFor ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Full request</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.request ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Referer</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.referer ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Response bytes</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.bytes ?? "-" }}</div></div>
        <div class="insp-field"><span class="k">Source file</span><div class="v" style="white-space:normal;overflow-wrap:anywhere">{{ r.filePath ?? "-" }}</div></div>
      </template>
      <div class="insp-section-hd" @click="toggle('request')">
        <i class="ph" :class="collapsed.request ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-arrow-square-out" style="color:var(--color-accent-400)"></i>Request
        <i class="ph ph-lock-simple" style="color:var(--color-neutral-700);margin-left:auto"></i>
      </div>
      <template v-if="!collapsed.request">
        <div class="insp-field"><span class="k">Method</span><div class="v" style="color:var(--color-accent-2-300)">{{ r.method }}</div></div>
        <div class="insp-field"><span class="k">Path</span><div class="v">{{ pathParts[0] }}</div></div>
        <div class="insp-field"><span class="k">Query</span><div class="v" style="color:var(--color-neutral-400)">{{ pathParts[1] ? "?" + pathParts[1] : "—" }}</div></div>
        <div class="insp-field"><span class="k">Protocol</span><div class="v" style="color:var(--color-neutral-300)">{{ r.protocol || "-" }}</div></div>
      </template>

      <div class="insp-section-hd" @click="toggle('client')">
        <i class="ph" :class="collapsed.client ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-user-focus" style="color:var(--color-accent-400)"></i>Client
        <i class="ph ph-lock-simple" style="color:var(--color-neutral-700);margin-left:auto"></i>
      </div>
      <template v-if="!collapsed.client">
        <div class="insp-field"><span class="k">Remote IP</span><div class="v">{{ r.ip }}<i class="ph ph-copy" style="margin-left:auto;color:var(--color-neutral-600)"></i></div></div>
        <div class="insp-field"><span class="k">Reverse DNS</span><div class="v" style="color:var(--color-neutral-400)">{{ rdnsText }}</div></div>
        <div class="insp-field">
          <span class="k">Country</span>
          <div class="v" style="color:var(--color-neutral-300)">
            <span v-if="geoip?.status === 'ok'"><img v-if="countryFlag" :src="countryFlag" class="country-flag" alt="" aria-hidden="true">{{ geoip.countryName || geoip.countryCode }} <span style="color:var(--color-neutral-600)">({{ geoip.countryCode }})</span></span>
            <span v-else-if="geoip?.status === 'local'">local/private</span>
            <span v-else-if="geoip?.status === 'error'" style="color:var(--st4)">{{ geoip.countryName }}</span>
            <span v-else-if="geoipLoading">downloading GeoIP...</span>
            <span v-else style="color:var(--color-neutral-600)">not found</span>
          </div>
        </div>
        <div class="insp-field"><span class="k">City</span><div class="v" style="color:var(--color-neutral-300)">{{ cityText || "—" }}</div></div>
        <div class="insp-field"><span class="k">Coordinate</span><div class="v" style="color:var(--color-neutral-600)">{{ coordsText || "—" }}</div></div>
        <div class="insp-field"><span class="k">ASN / Net</span><div class="v" style="color:var(--color-neutral-300)">{{ asnText || "—" }}</div></div>
        <WorldMap :lat="details?.lat ?? null" :lon="details?.lon ?? null" :label="cityText || ''" />
        <div class="insp-field" style="align-items:start">
          <span class="k" style="padding-top:3px">User agent</span>
          <div class="v" style="white-space:normal;height:auto;padding:3px 6px;align-items:flex-start;color:var(--color-neutral-400)">{{ r.userAgent || info.ua }}</div>
        </div>
        <div class="insp-field">
          <span class="k">Classified</span>
          <div class="insp-tags">
            <span v-for="t in classification" :key="t.id" class="insp-tag" :class="t.severity === 'high' ? 'sev-high' : 'sev-warn'" :title="t.label">{{ t.label }}</span>
            <span v-if="isBot" class="insp-tag sev-info">bot · likely</span>
            <span v-if="!classification.length && !isBot" class="insp-tag sev-none">normal request</span>
          </div>
        </div>
      </template>

      <div class="insp-section-hd" @click="toggle('timing')">
        <i class="ph" :class="collapsed.timing ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-gauge" style="color:var(--color-accent-400)"></i>Response &amp; timing
      </div>
      <template v-if="!collapsed.timing">
        <div class="insp-field">
          <span class="k">Status</span>
          <div class="insp-status-row">
            <div
              class="insp-status-code"
              :style="{
                background: isDanger ? undefined : 'var(--chrome-bg)',
                borderColor: isDanger ? undefined : 'var(--chrome-border-2)',
                color: statusColor(r.status),
              }"
            >{{ r.status }}</div>
            <div class="insp-status-text">{{ STATUS_TEXT[r.status] || "" }}</div>
          </div>
        </div>
        <div class="insp-field">
          <span class="k">Timing µs</span>
          <div v-if="r.ms != null" class="timing-triple">
            <div class="timing-chip"><span class="k">T</span><span :style="{ color: statusColor(r.status) }">{{ fmtMs(r.ms) }}</span></div>
            <div class="timing-chip"><span class="k">U</span><span style="color:var(--color-neutral-300)">{{ fmtMs(r.ms * 0.97) }}</span></div>
            <div class="timing-chip"><span class="k">B</span><span style="color:var(--color-neutral-300)">{{ Math.round(r.ms * 0.03) }}ms</span></div>
          </div>
          <div v-else class="v" style="color:var(--color-neutral-600)">Not available — this log format doesn't record response time</div>
        </div>
        <div v-if="r.ms != null" class="timing-bar-wrap">
          <div class="timing-bar">
            <div :style="{ width: splits[0] + '%', background: 'var(--color-accent-600)' }"></div>
            <div :style="{ width: splits[1] + '%', background: 'var(--color-accent-400)' }"></div>
            <div :style="{ width: splits[2] + '%', background: isDanger ? 'var(--st5)' : 'var(--color-accent-500)' }"></div>
            <div :style="{ width: splits[3] + '%', background: 'var(--color-neutral-600)' }"></div>
          </div>
          <div class="timing-bar-labels"><span>tls</span><span>proxy</span><span>upstream wait</span><span>write</span></div>
        </div>
      </template>

      <div class="insp-section-hd" @click="toggle('raw')">
        <i class="ph" :class="collapsed.raw ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-code" style="color:var(--color-accent-400)"></i>Raw line
        <i class="ph ph-copy" style="color:var(--color-neutral-600);margin-left:auto"></i>
      </div>
      <div v-if="!collapsed.raw" class="raw-line">
        <template v-for="(part, i) in rawLineParts" :key="i">
          <span v-if="part.highlight" :style="{ color: statusColor(r.status) }">{{ part.text }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
      </div>
    </div>
  </div>
</template>
