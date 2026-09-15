# Apache Log Monitor

A Nocturne-themed log monitoring dashboard, running as a Tauri desktop app.
The frontend is Vue 3 (plain JS, not TypeScript — see note below) on mock
data; `src-tauri/` is the native shell.

## Running it

```
npm install
npm run dev          # frontend only, plain browser dev server, no Tauri involved
npm run tauri dev    # the actual desktop app (needs the Rust toolchain + platform webview deps)
npm run build         # frontend production build -> dist/
npm run tauri build  # bundled desktop app
```

## Structure

```
index.html               Vite entry point
src/
  main.ts                 mounts the app — plain JS despite the .ts extension, kept
                           consistent with the scaffold's entry point name
  App.vue                  top-level dock grid layout
  styles/
    tokens.css              the Nocturne design system (colors, type, spacing) — untouched
    app.css                  page chrome shared by every panel (docks, tabs, tables, dialogs, etc.)
  store/
    monitor.js               Pinia store — all shared state lives here (selected row,
                              resync/interval, tree expand state, active tabs, dialogs/popovers,
                              current page, filters)
  data/
    mock.js                   seed data + the client-side generators (log rows, hosts, alerts, etc.)
    format.js                  status/latency color + formatting helpers
    logSource.js                *the seam* — swap this for a real Tauri command later
  composables/
    useSparkline.js, useRelativeTime.js, useClickOutside.js
  components/
    TopBar.vue, StatusBar.vue, MonitorPage.vue
    DockTabHeader.vue        generic reusable tab-strip (used by every dock)
    SourcesTreePanel.vue        registered sources and per-directory file rows
    ThroughputPanel.vue, TopTalkersPanel.vue
    LiveTailPanel.vue + TrafficPanel.vue (Access log / Traffic tabs)
    BottomDock.vue + ErrorLogPanel.vue, QueryPanel.vue, AlertsPanel.vue
    StatusMixPanel.vue
    InspectorPanel.vue + HistoryPanel.vue (Inspector / History tabs)
    AddSourceDialog.vue, SettingsDialog.vue, FileMenuDropdown.vue
    PanelPickerPopover.vue, GlobalSearchPalette.vue
    HostsPage.vue, ReportsPage.vue, AlertsPage.vue, ExplorePage.vue (placeholder — not designed yet)
src-tauri/                the Rust/Tauri native shell (untouched scaffold — no commands wired up yet)
```

## Plain JS, not TypeScript

`create-tauri-app` scaffolded this as a Vue+TypeScript project (`tsconfig.json`,
`vue-tsc`), but the frontend was built as plain JS/Vue elsewhere and copied in
as-is. `src/main.ts` is JS-compatible content under a `.ts` name (kept for
consistency with the scaffold's entry point); every other file is `.js`/`.vue`
without `lang="ts"`. The `build` script was changed from
`vue-tsc --noEmit && vite build` to plain `vite build` accordingly — there's
nothing typed for `vue-tsc` to check. `typescript`/`vue-tsc` are still listed
as devDependencies if you want to convert files and re-enable the check later.

## Wiring up the real backend

`src/data/logSource.js` is the only file that should need a second
implementation — a real Tauri command (e.g. a Rust file-tailer invoked via
`@tauri-apps/api`) swapped in via the `isTauri()` check already in that file.
No store or component code should need to change.
