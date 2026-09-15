<script setup>
import { reactive, computed, watch } from "vue";
import { useMonitorStore } from "../store/monitor";
import { statusColor, fmtMs, STATUS_TEXT } from "../data/format";
import { clientInfo, synthRawLine, timingSplits } from "../data/mock";

const store = useMonitorStore();
const collapsed = reactive({});
function toggle(id) {
  collapsed[id] = !collapsed[id];
}

const r = computed(() => store.selectedRow);
const info = computed(() => (r.value ? clientInfo(r.value.ip) : null));
const geoip = computed(() => (r.value ? store.geoip.byIp[r.value.ip] : null));
const geoipLoading = computed(() => !!r.value && store.geoip.loadingIps.includes(r.value.ip));
const isDanger = computed(() => !!r.value && r.value.status >= 500);
const pathParts = computed(() => (r.value ? r.value.path.split("?") : ["", null]));
const splits = computed(() => (r.value ? timingSplits(r.value) : [0, 0, 0, 0]));

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
  store.setTailFilter(`status==${r.value.status} and path=="${pathParts.value[0]}"`);
}

watch(
  () => r.value?.ip,
  (ip) => {
    if (ip) store.lookupGeoipForIp(ip);
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
      <div class="insp-section-hd" @click="toggle('request')">
        <i class="ph" :class="collapsed.request ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-arrow-square-out" style="color:var(--color-accent-400)"></i>Request
        <i class="ph ph-lock-simple" style="color:var(--color-neutral-700);margin-left:auto"></i>
      </div>
      <template v-if="!collapsed.request">
        <div class="insp-field"><span class="k">Method</span><div class="v" style="color:var(--color-accent-2-300)">{{ r.method }}</div></div>
        <div class="insp-field"><span class="k">Path</span><div class="v">{{ pathParts[0] }}</div></div>
        <div class="insp-field"><span class="k">Query</span><div class="v" style="color:var(--color-neutral-400)">{{ pathParts[1] ? "?" + pathParts[1] : "—" }}</div></div>
        <div class="insp-field"><span class="k">Protocol</span><div class="v" style="color:var(--color-neutral-300)">HTTP/2.0 · TLSv1.3</div></div>
      </template>

      <div class="insp-section-hd" @click="toggle('client')">
        <i class="ph" :class="collapsed.client ? 'ph-caret-right' : 'ph-caret-down'"></i>
        <i class="ph ph-user-focus" style="color:var(--color-accent-400)"></i>Client
        <i class="ph ph-lock-simple" style="color:var(--color-neutral-700);margin-left:auto"></i>
      </div>
      <template v-if="!collapsed.client">
        <div class="insp-field"><span class="k">Remote IP</span><div class="v">{{ r.ip }}<i class="ph ph-copy" style="margin-left:auto;color:var(--color-neutral-600)"></i></div></div>
        <div class="insp-field"><span class="k">Reverse DNS</span><div class="v" style="color:var(--color-neutral-400)">{{ info.rdns }}</div></div>
        <div class="insp-field">
          <span class="k">Country</span>
          <div class="v" style="color:var(--color-neutral-300)">
            <span v-if="geoip?.status === 'ok'">{{ geoip.countryName || geoip.countryCode }} <span style="color:var(--color-neutral-600)">({{ geoip.countryCode }})</span></span>
            <span v-else-if="geoip?.status === 'local'">local/private</span>
            <span v-else-if="geoip?.status === 'error'" style="color:var(--st4)">{{ geoip.countryName }}</span>
            <span v-else-if="geoipLoading">downloading GeoIP...</span>
            <span v-else style="color:var(--color-neutral-600)">not found</span>
          </div>
        </div>
        <div class="insp-field"><span class="k">Geo / ASN</span><div class="v" style="color:var(--color-neutral-300)">{{ info.geo }}</div></div>
        <div class="insp-field"><span class="k">Geo data</span><div class="v" style="color:var(--color-neutral-600)">{{ geoip?.attribution || "IP Geolocation by DB-IP" }}</div></div>
        <div class="insp-field" style="align-items:start">
          <span class="k" style="padding-top:3px">User agent</span>
          <div class="v" style="white-space:normal;height:auto;padding:3px 6px;align-items:flex-start;color:var(--color-neutral-400)">{{ r.userAgent || info.ua }}</div>
        </div>
        <div class="insp-field">
          <span class="k">Classified</span>
          <div class="insp-tags">
            <span v-if="info.bot" class="insp-tag" style="background:#3a3325;color:var(--st4)">bot · likely</span>
            <span class="insp-tag" style="background:#2b2741;color:var(--color-accent-300)">{{ info.rate }}</span>
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

      <div class="correlated-row">
        <i class="ph ph-caret-right"></i><i class="ph ph-link"></i>Correlated error lines
        <span v-if="isDanger" class="badge-count" style="margin-left:auto">3</span>
        <span v-else style="margin-left:auto;color:var(--color-neutral-700)">0</span>
      </div>
    </div>
  </div>
</template>
