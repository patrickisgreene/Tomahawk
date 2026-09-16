<script setup>
import { useMonitorStore } from "../store/monitor";
import { BUILT_IN_RULES, slug } from "../data/classification";
import AppSelect from "./AppSelect.vue";

const store = useMonitorStore();
const SECTIONS = [
  { id: "general", icon: "ph-sliders-horizontal", label: "General" },
  { id: "parsing", icon: "ph-code", label: "Parsing & format" },
  { id: "alerts", icon: "ph-bell-ringing", label: "Alerts" },
];
const TIMEZONES = [
  { id: "local", label: "Local" },
  { id: "utc", label: "UTC" },
  { id: "source", label: "Source" },
];
const TIME_FORMATS = [
  { value: "full", label: "2026-09-16 14:05:09" },
  { value: "short", label: "09/16 14:05" },
  { value: "relative", label: "5m ago" },
  { value: "source", label: "Source timestamp" },
];
const LOG_FORMATS = [
  { value: "apache_combined", label: "Apache Combined" },
  { value: "apache_combined_vhost", label: "Combined + vhost" },
  { value: "apache_combined_forwarded", label: "Combined + forwarded-for" },
  { value: "apache_combined_duration", label: "Combined + duration" },
];
const RULE_SCOPES = [
  { value: "url", label: "URL" },
  { value: "ua", label: "User agent" },
  { value: "ip", label: "IP" },
  { value: "method", label: "Method" },
  { value: "status", label: "Status" },
  { value: "raw", label: "Raw line" },
];
const SEVERITIES = [
  { value: "warn", label: "Warning" },
  { value: "high", label: "High" },
];
const builtInRules = BUILT_IN_RULES.map((rule) => ({
  id: slug(rule.label),
  label: rule.label,
  severity: rule.severity,
}));
</script>

<template>
  <div class="modal-backdrop" @click.self="store.closeSettingsDialog()">
    <div class="modal-card" style="width:760px;height:540px">
      <div class="modal-titlebar">
        <i class="ph ph-gear-six" style="color:var(--color-accent-400)"></i>
        <span>Settings</span>
        <i class="ph ph-x" style="margin-left:auto;cursor:pointer;color:var(--color-neutral-500)" @click="store.closeSettingsDialog()"></i>
      </div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:170px 1fr">
        <div class="settings-nav">
          <div
            v-for="s in SECTIONS"
            :key="s.id"
            class="settings-nav-item"
            :class="{ active: store.settingsSection === s.id }"
            @click="store.setSettingsSection(s.id)"
          ><i class="ph" :class="s.icon"></i>{{ s.label }}</div>
        </div>
        <div class="settings-body">
          <template v-if="store.settingsSection === 'general'">
            <div>
              <div class="settings-group-label">Timezone & time</div>
              <div class="settings-row">
                <span>Display timezone</span>
                <div class="seg-strip boxed">
                  <span
                    v-for="tz in TIMEZONES"
                    :key="tz.id"
                    :class="{ active: store.displayTimezone === tz.id }"
                    @click="store.setDisplayTimezone(tz.id)"
                  >{{ tz.label }}</span>
                </div>
              </div>
              <div class="settings-row">
                <div>
                  <div>Time format</div>
                  <div class="settings-sub">Used by the timestamp column in Access log.</div>
                </div>
                <AppSelect
                  :model-value="store.timeDisplayFormat"
                  :options="TIME_FORMATS"
                  aria-label="Time display format"
                  :menu-width="220"
                  @update:model-value="store.setTimeDisplayFormat($event)"
                />
              </div>
            </div>
          </template>
          <template v-else-if="store.settingsSection === 'parsing'">
            <div>
              <div class="settings-group-label">Default Format</div>
              <div class="settings-row">
                <div>
                  <div>Default log format</div>
                  <div class="settings-sub">Used as the default for newly added sources.</div>
                </div>
                <AppSelect
                  :model-value="store.defaultLogFormat"
                  :options="LOG_FORMATS"
                  aria-label="Default log format"
                  :menu-width="220"
                  @update:model-value="store.setDefaultLogFormat($event)"
                />
              </div>
            </div>
          </template>
          <template v-else-if="store.settingsSection === 'alerts'">
            <div>
              <div class="settings-group-label">Local Rules</div>
              <label class="toggle-row">
                <div>
                  <div>Built-in security classifiers</div>
                  <div class="settings-sub">Classify common probes, scanners, and exploit-shaped requests.</div>
                </div>
                <span class="toggle" :class="{ on: store.localRules.builtInEnabled }" @click="store.setLocalRulesFlag('builtInEnabled', !store.localRules.builtInEnabled)"><span class="knob"></span></span>
              </label>
              <label class="toggle-row">
                <div>
                  <div>Bot user-agent detection</div>
                  <div class="settings-sub">Show likely bot tags when crawlers or scanner tools identify themselves.</div>
                </div>
                <span class="toggle" :class="{ on: store.localRules.botDetectionEnabled }" @click="store.setLocalRulesFlag('botDetectionEnabled', !store.localRules.botDetectionEnabled)"><span class="knob"></span></span>
              </label>
            </div>
            <div>
              <div class="settings-group-label">Built-In Rule Visibility</div>
              <div class="settings-rule-grid">
                <button
                  v-for="rule in builtInRules"
                  :key="rule.id"
                  class="rule-chip"
                  :class="{ off: store.localRules.disabledBuiltInRuleIds.includes(rule.id), high: rule.severity === 'high' }"
                  @click="store.toggleBuiltInRule(rule.id)"
                >
                  <span class="dot"></span>{{ rule.label }}
                </button>
              </div>
            </div>
            <div>
              <div class="settings-local-rule-head">
                <div class="settings-group-label" style="margin:0">Custom Regex Rules</div>
                <button class="chip txt" @click="store.addLocalRule()"><i class="ph ph-plus"></i>Add rule</button>
              </div>
              <div v-if="!store.localRules.customRules.length" class="settings-empty">No custom local rules yet.</div>
              <div v-for="rule in store.localRules.customRules" :key="rule.id" class="settings-local-rule">
                <label class="rule-enable" :title="rule.enabled ? 'Disable rule' : 'Enable rule'">
                  <input type="checkbox" :checked="rule.enabled" @change="store.updateLocalRule(rule.id, { enabled: $event.target.checked })">
                </label>
                <input
                  class="settings-input"
                  :value="rule.label"
                  placeholder="Label"
                  @input="store.updateLocalRule(rule.id, { label: $event.target.value })"
                >
                <AppSelect
                  :model-value="rule.scope"
                  :options="RULE_SCOPES"
                  aria-label="Rule scope"
                  :menu-width="140"
                  @update:model-value="store.updateLocalRule(rule.id, { scope: $event })"
                />
                <AppSelect
                  :model-value="rule.severity"
                  :options="SEVERITIES"
                  aria-label="Rule severity"
                  :menu-width="120"
                  @update:model-value="store.updateLocalRule(rule.id, { severity: $event })"
                />
                <input
                  class="settings-input pattern"
                  :value="rule.pattern"
                  placeholder="regex pattern"
                  @input="store.updateLocalRule(rule.id, { pattern: $event.target.value })"
                >
                <button class="icon-btn" title="Remove rule" @click="store.removeLocalRule(rule.id)"><i class="ph ph-trash"></i></button>
              </div>
            </div>
          </template>
          <div v-else class="insp-empty">{{ SECTIONS.find(s => s.id === store.settingsSection)?.label }} isn't designed yet — only General was speced.</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-plain" @click="store.closeSettingsDialog()">Cancel</button>
        <button class="chip outline" @click="store.closeSettingsDialog()">Save</button>
      </div>
    </div>
  </div>
</template>
