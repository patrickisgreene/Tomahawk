<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";

const store = useMonitorStore();
const TABS = [
  { id: "file", icon: "ph-file-text", label: "File" },
  { id: "directory", icon: "ph-folder", label: "Directory" },
  { id: "sftp", icon: "ph-cloud-arrow-down", label: "SFTP" },
];

const crumbs = computed(() => (store.addSourceRealPath || "").split("/").filter(Boolean));
const canConfirm = computed(() => {
  if (store.addSourceTab === "file") return !!store.addSourceSelected;
  if (store.addSourceTab === "directory") return !!store.addSourceRealPath;
  return true; // sftp tab: not wired up yet, confirming just closes the dialog
});

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
            <template v-for="(part, i) in crumbs" :key="i">
              <span
                class="crumb"
                :class="{ current: i === crumbs.length - 1 }"
                @click="store.goToAddSourceCrumb(i)"
              >{{ part }}</span>
              <span v-if="i < crumbs.length - 1" class="crumb-sep">›</span>
            </template>
            <label class="toggle-row compact" style="margin-left:auto" @click="store.setAddSourceHideHidden(!store.addSourceHideHidden)">
              <span>Hide dot files</span>
              <span class="toggle" :class="{ on: store.addSourceHideHidden }"><span class="knob"></span></span>
            </label>
            <div class="filterbar" style="max-width:120px">
              <i class="ph ph-magnifying-glass"></i>
              <input
                :value="store.addSourceFilterText"
                @input="store.setAddSourceFilterText($event.target.value)"
                placeholder="Filter…"
              >
            </div>
          </div>
          <div class="file-browser-head"><span>Name</span><span>Modified</span><span style="text-align:right">Size</span></div>
          <div class="file-browser-list">
            <template v-if="store.addSourceLoading">
              <div v-for="i in 5" :key="i" class="file-row skel">
                <span class="skel-bar" style="width:65%"></span><span class="skel-bar" style="width:50%"></span><span class="skel-bar" style="width:40%"></span>
              </div>
            </template>
            <template v-else>
              <div
                v-for="f in store.filteredAddSourceListing"
                :key="f.name"
                class="file-row"
                :class="{ selected: f.name === store.addSourceSelected }"
                @click="f.kind === 'dir' ? store.openAddSourceFolder(f.name) : store.selectAddSourceFile(f.name)"
              >
                <span class="file-name"><i class="ph" :class="iconFor(f.kind)"></i>{{ f.name }}</span>
                <span class="file-meta">{{ f.modified || "—" }}</span>
                <span class="file-meta" style="text-align:right">{{ f.size || "" }}</span>
              </div>
            </template>
          </div>
        </div>
        <div class="file-preview">
          <i class="ph ph-file-text" style="color:var(--color-accent-300)"></i>
          <span v-if="store.addSourceSelected">{{ store.addSourceRealPath }}/{{ store.addSourceSelected }}</span>
          <span v-else style="color:var(--color-neutral-500)">No file selected</span>
        </div>
      </div>

      <!-- ===== Directory tab ===== -->
      <div v-else-if="store.addSourceTab === 'directory'" class="modal-body" style="gap:10px">
        <div class="file-browser" style="border-color:var(--color-accent-700)">
          <div class="file-browser-crumbs">
            <i class="ph ph-house-simple"></i>
            <template v-for="(part, i) in crumbs" :key="i">
              <span class="crumb" :class="{ current: i === crumbs.length - 1 }" @click="store.goToAddSourceCrumb(i)">{{ part }}</span>
              <span v-if="i < crumbs.length - 1" class="crumb-sep">›</span>
            </template>
            <label class="toggle-row compact" style="margin-left:auto" @click="store.setAddSourceHideHidden(!store.addSourceHideHidden)">
              <span>Hide dot file</span>
              <span class="toggle" :class="{ on: store.addSourceHideHidden }"><span class="knob"></span></span>
            </label>
            <div class="filterbar" style="max-width:120px">
              <i class="ph ph-magnifying-glass"></i>
              <input
                :value="store.addSourceFilterText"
                @input="store.setAddSourceFilterText($event.target.value)"
                placeholder="Filter…"
              >
            </div>
          </div>
          <div class="file-browser-head"><span>Name</span><span>Modified</span><span style="text-align:right">Size</span></div>
          <div class="file-browser-list">
            <template v-if="store.addSourceLoading">
              <div v-for="i in 5" :key="i" class="file-row skel">
                <span class="skel-bar" style="width:65%"></span><span class="skel-bar" style="width:50%"></span><span class="skel-bar" style="width:40%"></span>
              </div>
            </template>
            <template v-else>
              <div v-for="f in store.filteredAddSourceListing" :key="f.name" class="file-row" @click="f.kind === 'dir' && store.openAddSourceFolder(f.name)">
                <span class="file-name"><i class="ph" :class="iconFor(f.kind)"></i>{{ f.name }}</span>
                <span class="file-meta">{{ f.modified || "—" }}</span>
                <span class="file-meta" style="text-align:right">{{ f.size || "" }}</span>
              </div>
            </template>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
          <div>
            <div class="field-label">Match files</div>
            <div class="cond-value" style="width:fit-content;height:28px">
              <input
                :value="store.addSourcePattern"
                @input="store.setAddSourcePattern($event.target.value)"
                style="background:none;border:none;color:inherit;font:inherit;outline:none;width:110px"
              >
            </div>
          </div>
          <label class="toggle-row" style="padding-top:16px" @click="store.setAddSourceIncludeSubfolders(!store.addSourceIncludeSubfolders)">
            <span>Include subfolders</span>
            <span class="toggle" :class="{ on: store.addSourceIncludeSubfolders }"><span class="knob"></span></span>
          </label>
        </div>
        <div class="hint-line"><i class="ph ph-info"></i>Matching files in this folder are ingested now, and new ones picked up automatically on each resync</div>
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
        <button class="chip outline" :style="canConfirm ? {} : { opacity: 0.5, cursor: 'default' }" :disabled="!canConfirm" @click="store.confirmAddSource()"><i class="ph ph-plus"></i>Add source</button>
      </div>
    </div>
  </div>
</template>
