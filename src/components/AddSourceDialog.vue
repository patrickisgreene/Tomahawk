<script setup>
import { computed } from "vue";
import { useMonitorStore } from "../store/monitor";
import { joinLocalPath, localPathCrumbs } from "../data/localPath";

const store = useMonitorStore();
const TABS = [
  { id: "file", icon: "ph-file-text", label: "File" },
  { id: "directory", icon: "ph-folder", label: "Directory" },
];

const crumbs = computed(() => localPathCrumbs(store.addSourceRealPath));
const canConfirm = computed(() => {
  if (store.addSourceSaving) return false;
  if (store.addSourceTab === "file") return !!store.addSourceSelected;
  if (store.addSourceTab === "directory") return !!store.addSourceRealPath;
  return false;
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
        <i class="ph ph-x" :style="{ marginLeft: 'auto', cursor: store.addSourceSaving ? 'default' : 'pointer', color: 'var(--color-neutral-500)', opacity: store.addSourceSaving ? 0.45 : 1 }" @click="store.closeAddSourceDialog()"></i>
      </div>

      <div style="padding:12px 16px 0">
        <div class="seg-strip boxed">
          <span v-for="t in TABS" :key="t.id" :class="{ active: store.addSourceTab === t.id }" @click="!store.addSourceSaving && store.setAddSourceTab(t.id)">
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
              >{{ part.label }}</span>
              <span v-if="i < crumbs.length - 1" class="crumb-sep">›</span>
            </template>
            <label class="toggle-row compact" style="margin-left:auto" @click="!store.addSourceSaving && store.setAddSourceHideHidden(!store.addSourceHideHidden)">
              <span>Hide dot files</span>
              <span class="toggle" :class="{ on: store.addSourceHideHidden }"><span class="knob"></span></span>
            </label>
            <div class="filterbar" style="max-width:120px">
              <i class="ph ph-magnifying-glass"></i>
              <input
                :value="store.addSourceFilterText"
                :disabled="store.addSourceSaving"
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
                @click="!store.addSourceSaving && (f.kind === 'dir' ? store.openAddSourceFolder(f.name) : store.selectAddSourceFile(f.name))"
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
          <span v-if="store.addSourceSelected">{{ joinLocalPath(store.addSourceRealPath, store.addSourceSelected) }}</span>
          <span v-else style="color:var(--color-neutral-500)">No file selected</span>
        </div>
      </div>

      <!-- ===== Directory tab ===== -->
      <div v-else-if="store.addSourceTab === 'directory'" class="modal-body" style="gap:10px">
        <div class="file-browser" style="border-color:var(--color-accent-700)">
          <div class="file-browser-crumbs">
            <i class="ph ph-house-simple"></i>
            <template v-for="(part, i) in crumbs" :key="i">
              <span class="crumb" :class="{ current: i === crumbs.length - 1 }" @click="store.goToAddSourceCrumb(i)">{{ part.label }}</span>
              <span v-if="i < crumbs.length - 1" class="crumb-sep">›</span>
            </template>
            <label class="toggle-row compact" style="margin-left:auto" @click="!store.addSourceSaving && store.setAddSourceHideHidden(!store.addSourceHideHidden)">
              <span>Hide dot file</span>
              <span class="toggle" :class="{ on: store.addSourceHideHidden }"><span class="knob"></span></span>
            </label>
            <div class="filterbar" style="max-width:120px">
              <i class="ph ph-magnifying-glass"></i>
              <input
                :value="store.addSourceFilterText"
                :disabled="store.addSourceSaving"
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
              <div v-for="f in store.filteredAddSourceListing" :key="f.name" class="file-row" @click="!store.addSourceSaving && f.kind === 'dir' && store.openAddSourceFolder(f.name)">
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
                :disabled="store.addSourceSaving"
                @input="store.setAddSourcePattern($event.target.value)"
                style="background:none;border:none;color:inherit;font:inherit;outline:none;width:110px"
              >
            </div>
          </div>
          <label class="toggle-row" style="padding-top:16px" @click="!store.addSourceSaving && store.setAddSourceIncludeSubfolders(!store.addSourceIncludeSubfolders)">
            <span>Include subfolders</span>
            <span class="toggle" :class="{ on: store.addSourceIncludeSubfolders }"><span class="knob"></span></span>
          </label>
        </div>
        <div class="hint-line"><i class="ph ph-info"></i>Matching files in this folder are ingested now, and new ones picked up automatically on each resync</div>
      </div>

      <div class="modal-footer">
        <span v-if="store.addSourceError" role="alert" style="margin-right:auto;overflow-wrap:anywhere">{{ store.addSourceError }}</span>
        <button class="btn-plain" :disabled="store.addSourceSaving" :style="store.addSourceSaving ? { opacity: 0.5, cursor: 'default' } : {}" @click="store.closeAddSourceDialog()">Cancel</button>
        <button class="chip outline" :style="canConfirm ? {} : { opacity: 0.5, cursor: 'default' }" :disabled="!canConfirm" @click="store.confirmAddSource()">
          <i class="ph" :class="store.addSourceSaving ? 'ph-spinner spin' : 'ph-plus'"></i>{{ store.addSourceSaving ? "Adding..." : "Add source" }}
        </button>
      </div>
    </div>
  </div>
</template>
