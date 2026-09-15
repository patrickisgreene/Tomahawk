<script setup>
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const TABS = [
  { id: "file", icon: "ph-file-text", label: "File" },
  { id: "directory", icon: "ph-folder", label: "Directory" },
  { id: "sftp", icon: "ph-cloud-arrow-down", label: "SFTP" },
];

function iconFor(kind) {
  return kind === "dir" ? "ph-folder" : kind === "archive" ? "ph-archive" : "ph-file-text";
}
</script>

<template>
  <div class="modal-backdrop" @click.self="store.closeAddSourceDialog()">
    <div class="modal-card" style="width:560px;height:500px">
      <div class="modal-titlebar">
        <i class="ph ph-plug" style="color:var(--color-accent-400)"></i>
        <span>Add log source</span>
        <i class="ph ph-x" style="margin-left:auto;cursor:pointer;color:var(--color-neutral-500)" @click="store.closeAddSourceDialog()"></i>
      </div>

      <div style="padding:12px 16px 0">
        <div class="seg-strip boxed">
          <span v-for="t in TABS" :key="t.id" :class="{ active: store.addSourceTab === t.id }" @click="store.setAddSourceTab(t.id)">
            <i class="ph" :class="t.icon"></i>{{ t.label }}
          </span>
        </div>
      </div>

      <!-- ===== File tab ===== -->
      <div v-if="store.addSourceTab === 'file'" class="modal-body" style="gap:10px">
        <div class="file-browser">
          <div class="file-browser-crumbs">
            <i class="ph ph-house-simple"></i>
            <template v-for="(part, i) in store.addSourcePath" :key="i">
              <span
                class="crumb"
                :class="{ current: i === store.addSourcePath.length - 1 }"
                @click="store.goToAddSourceCrumb(i)"
              >{{ part }}</span>
              <span v-if="i < store.addSourcePath.length - 1" class="crumb-sep">›</span>
            </template>
            <div class="filterbar" style="margin-left:auto;max-width:120px"><i class="ph ph-magnifying-glass"></i><input placeholder="Filter…"></div>
          </div>
          <div class="file-browser-head"><span>Name</span><span>Modified</span><span style="text-align:right">Size</span></div>
          <div class="file-browser-list">
            <div
              v-for="f in store.addSourceListing"
              :key="f.name"
              class="file-row"
              :class="{ selected: f.name === store.addSourceSelected }"
              @click="f.kind === 'dir' ? store.openAddSourceFolder(f.name) : store.selectAddSourceFile(f.name)"
            >
              <span class="file-name"><i class="ph" :class="iconFor(f.kind)"></i>{{ f.name }}</span>
              <span class="file-meta">{{ f.modified || "—" }}</span>
              <span class="file-meta" style="text-align:right">{{ f.size || "" }}</span>
            </div>
          </div>
        </div>
        <div class="file-preview">
          <i class="ph ph-file-text" style="color:var(--color-accent-300)"></i>
          <span>/{{ store.addSourcePath.slice(1).join("/") }}/{{ store.addSourceSelected }}</span>
          <span style="margin-left:auto;color:var(--color-neutral-500)">Combined format detected</span>
        </div>
      </div>

      <!-- ===== Directory tab ===== -->
      <div v-else-if="store.addSourceTab === 'directory'" class="modal-body" style="gap:10px">
        <div class="file-browser" style="border-color:var(--color-accent-700)">
          <div class="file-browser-crumbs">
            <i class="ph ph-house-simple"></i>
            <template v-for="(part, i) in store.addSourcePath" :key="i">
              <span class="crumb" :class="{ current: i === store.addSourcePath.length - 1 }" @click="store.goToAddSourceCrumb(i)">{{ part }}</span>
              <span v-if="i < store.addSourcePath.length - 1" class="crumb-sep">›</span>
            </template>
            <span class="tag-pill" style="margin-left:auto">selected folder</span>
          </div>
          <div class="file-browser-head"><span>Name</span><span>Modified</span><span style="text-align:right">Size</span></div>
          <div class="file-browser-list">
            <div v-for="f in store.addSourceListing" :key="f.name" class="file-row" @click="f.kind === 'dir' && store.openAddSourceFolder(f.name)">
              <span class="file-name"><i class="ph" :class="iconFor(f.kind)"></i>{{ f.name }}</span>
              <span class="file-meta">{{ f.modified || "—" }}</span>
              <span class="file-meta" style="text-align:right">{{ f.size || "" }}</span>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;padding:6px 10px;border-top:1px solid var(--chrome-border)">
            <button class="chip outline" style="height:22px"><i class="ph ph-check"></i>Use this folder</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
          <div>
            <div class="field-label">Match files</div>
            <div class="cond-value" style="width:fit-content;height:28px">*.log</div>
          </div>
          <label class="toggle-row" style="padding-top:16px">
            <span>Include subfolders</span>
            <span class="toggle on"><span class="knob"></span></span>
          </label>
        </div>
        <div class="hint-line"><i class="ph ph-info"></i>2 files match now (access.log, error.log) — new matching files added automatically</div>
      </div>

      <!-- ===== SFTP tab ===== -->
      <div v-else class="modal-body" style="gap:10px">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px">
          <div><div class="field-label">Host</div><div class="cond-value" style="height:26px">sftp.web-04.iad.example.com</div></div>
          <div><div class="field-label">Port</div><div class="cond-value" style="height:26px">22</div></div>
          <div><div class="field-label">User</div><div class="cond-value" style="height:26px">deploy</div></div>
          <div><div class="field-label">Auth</div><div class="cond-value" style="height:26px;justify-content:space-between">SSH key<i class="ph ph-caret-down"></i></div></div>
        </div>
        <div class="connected-row"><i class="ph ph-check-circle"></i>Connected<span style="margin-left:auto;color:var(--color-accent-300)">Reconnect</span></div>
        <div class="file-browser" style="flex:1">
          <div class="file-browser-crumbs">
            <i class="ph ph-house-simple"></i>
            <template v-for="(part, i) in store.sftpPath" :key="i">
              <span class="crumb" :class="{ current: i === store.sftpPath.length - 1 }" @click="store.goToSftpCrumb(i)">{{ part || "/" }}</span>
              <span v-if="i < store.sftpPath.length - 1" class="crumb-sep">›</span>
            </template>
          </div>
          <div class="file-browser-list">
            <div
              v-for="f in store.sftpListing"
              :key="f.name"
              class="file-row"
              :class="{ selected: f.name === store.sftpSelected }"
              @click="f.kind === 'dir' ? store.openSftpFolder(f.name) : store.selectSftpFile(f.name)"
            >
              <span class="file-name"><i class="ph" :class="iconFor(f.kind)"></i>{{ f.name }}</span>
              <span class="file-meta">{{ f.modified || "—" }}</span>
              <span class="file-meta" style="text-align:right">{{ f.size || "" }}</span>
            </div>
          </div>
        </div>
        <div class="file-preview">
          <i class="ph ph-file-text" style="color:var(--color-accent-300)"></i>
          <span>{{ store.sftpPath.join("/") }}/{{ store.sftpSelected }}</span>
          <span style="margin-left:auto;color:var(--color-neutral-500)">Combined format</span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-plain" @click="store.closeAddSourceDialog()">Cancel</button>
        <button class="chip outline" @click="store.confirmAddSource()"><i class="ph ph-plus"></i>Add source</button>
      </div>
    </div>
  </div>
</template>
