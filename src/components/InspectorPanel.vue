<script setup>
import { reactive, computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import DockTabHeader from "./DockTabHeader.vue";
import HistoryPanel from "./HistoryPanel.vue";
import { statusColor, fmtMs, STATUS_TEXT } from "../data/format";
import { clientInfo, synthRawLine, timingSplits } from "../data/mock";

const store = useMonitorStore();
const tabs = [
  { id: "inspector", icon: "ph-magnifying-glass-plus", label: "Inspector" },
  { id: "history", icon: "ph-clock-counter-clockwise", label: "History" },
];
const collapsed = reactive({});
function toggle(id) {
  collapsed[id] = !collapsed[id];
}

const r = computed(() => store.selectedRow);
const info = computed(() => (r.value ? clientInfo(r.value.ip) : null));
const isDanger = computed(() => !!r.value && r.value.status >= 500);
const pathParts = computed(() => (r.value ? r.value.path.split("?") : ["", null]));
const splits = computed(() => (r.value ? timingSplits(r.value) : [0, 0, 0, 0]));

// Split the synthesized raw log line into plain/highlighted segments so the
// status code can be colored without resorting to v-html.
const rawLineParts = computed(() => {
  if (!r.value) return [];
  const line = synthRawLine(r.value);
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
</script>

<template>
  <div class="dock">
    <DockTabHeader dock-id="inspector" :tabs="tabs" :model-value="store.inspectorTab" @update:modelValue="store.setInspectorTab" />

    <HistoryPanel v-if="store.inspectorTab === 'history'" />

    <template v-else>
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
        <div class="insp-field"><span class="k">Geo / ASN</span><div class="v" style="color:var(--color-neutral-300)">{{ info.geo }}</div></div>
        <div class="insp-field" style="align-items:start">
          <span class="k" style="padding-top:3px">User agent</span>
          <div class="v" style="white-space:normal;height:auto;padding:3px 6px;align-items:flex-start;color:var(--color-neutral-400)">{{ info.ua }}</div>
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
          <div class="timing-triple">
            <div class="timing-chip"><span class="k">T</span><span :style="{ color: statusColor(r.status) }">{{ fmtMs(r.ms) }}</span></div>
            <div class="timing-chip"><span class="k">U</span><span style="color:var(--color-neutral-300)">{{ fmtMs(r.ms * 0.97) }}</span></div>
            <div class="timing-chip"><span class="k">B</span><span style="color:var(--color-neutral-300)">{{ Math.round(r.ms * 0.03) }}ms</span></div>
          </div>
        </div>
        <div class="timing-bar-wrap">
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
    </template>
  </div>
</template>
