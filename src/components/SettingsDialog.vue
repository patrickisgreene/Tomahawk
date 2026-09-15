<script setup>
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const SECTIONS = [
  { id: "general", icon: "ph-sliders-horizontal", label: "General" },
  { id: "parsing", icon: "ph-code", label: "Parsing & format" },
  { id: "ingestion", icon: "ph-database", label: "Ingestion & buffers" },
  { id: "alerts", icon: "ph-bell-ringing", label: "Alerts" },
  { id: "appearance", icon: "ph-palette", label: "Appearance" },
  { id: "shortcuts", icon: "ph-keyboard", label: "Shortcuts" },
];
</script>

<template>
  <div class="modal-backdrop" @click.self="store.closeSettingsDialog()">
    <div class="modal-card" style="width:580px;height:400px">
      <div class="modal-titlebar">
        <i class="ph ph-gear-six" style="color:var(--color-accent-400)"></i>
        <span>Settings</span>
        <i class="ph ph-x" style="margin-left:auto;cursor:pointer;color:var(--color-neutral-500)" @click="store.closeSettingsDialog()"></i>
      </div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:150px 1fr">
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
              <div class="settings-row"><span>Display timezone</span><div class="cond-value" style="height:26px;justify-content:space-between">UTC<i class="ph ph-caret-down"></i></div></div>
              <div class="settings-row">
                <span>Time format</span>
                <div class="seg-strip boxed"><span class="active">24h</span><span>12h</span></div>
              </div>
            </div>
            <div>
              <div class="settings-group-label">Behavior</div>
              <label class="toggle-row"><div><div>Auto-follow new tails</div><div class="settings-sub">Scroll to newest line when a tail opens</div></div><span class="toggle on"><span class="knob"></span></span></label>
              <label class="toggle-row"><div>Confirm before closing a case</div><span class="toggle"><span class="knob"></span></span></label>
            </div>
            <div>
              <div class="settings-group-label">Workspace</div>
              <div class="settings-row"><span>Default log format</span><div class="cond-value" style="height:26px;justify-content:space-between">Combined<i class="ph ph-caret-down"></i></div></div>
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
