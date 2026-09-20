# Tomahawk

Advanced HTTP Error Log Analyzer

<p align="center">
  <img src="images/screenshot.png" alt="Tomahawk desktop app" width="1100" />
</p>

Tomahawk is a desktop application for working with HTTP access logs at scale. It is built for teams and operators who need to inspect raw web traffic, find suspicious requests, filter noisy log streams, and understand where problems are coming from.

The app combines a native Rust + Tauri backend with a Vue 3 frontend. It reads Apache-style access logs from files or directories, keeps per-source SQLite databases, parses and enriches rows, and exposes a live dashboard for investigation.

## Why Tomahawk

- Investigate large access logs without leaving the desktop app
- Track suspicious or malicious-looking requests with built-in classifiers
- Correlate behavior across IPs, paths, user agents, and hosts
- Tail log sources incrementally without re-reading whole files
- Persist workspaces, panel layouts, filters, and settings between sessions
- Use real data in the desktop app, or mock data in the browser during frontend development

## Features

### Log ingestion and source management

- Add a file or a directory of log files as a source
- Optional glob matching and recursive directory scanning
- Per-source SQLite storage for parsed rows and ingestion cursors
- Manual resync and automatic resync intervals
- Source-level parsing configuration for common Apache log formats

### Access log analysis

- Live access-log table with sorting and column visibility controls
- Search across all parsed fields
- Request inspector with row history and expanded metadata
- Status coloring and filtering for fast triage
- Persistent workspace layouts and docked panels

### Query and filtering

- Global search palette for fast navigation
- Saved filters and custom query conditions
- Row-driven drilldown from alert and traffic views
- Multiple workspace tabs with independent layouts

### Security and anomaly detection

Tomahawk includes a built-in classifier layer for common web-attack patterns and noisy probing behavior. It catches patterns such as:

- path traversal and local file inclusion attempts
- SQL injection and reflected XSS probes
- command injection and SSRF-style values
- config, login, and debug surface probing
- webshell and uploaded-executable requests
- scanner and bot user-agent patterns

The classifications are configurable and can be toggled on a per-rule basis. You can also define custom regex rules scoped to URL, IP, method, status, user agent, or raw log line content.

### Geo and network enrichment

- Optional DB-IP City/ASN lookup support
- Reverse DNS and network detail enrichment
- Country and ASN display in the inspector and summary views
- Geo-aware traffic analysis for suspicious hosts and source regions

### Reporting and dashboards

The app includes dashboard-style views for operational summaries and traffic breakdowns, including:

- monitor view for live log workflow
- alerts view for rule-driven investigation
- reports view for traffic summaries
- hosts and related views for higher-level analysis patterns

These screens are designed to complement the primary access-log workflow rather than replace it.

## Project status

The Monitor workflow is the primary real-data path in the current app. The desktop experience is working against real ingested log sources, and the app maintains source state, filters, workspace layout, and classification settings in persistent local storage.

Some secondary views (for example dashboard-style pages) are still more presentation-oriented than fully production-complete, but the core log-tail, parse, classify, inspect, and query paths are in place and actively used.

## Getting started

### Requirements

- Node.js and npm
- Rust toolchain for the Tauri desktop app
- Tauri prerequisites for your platform

### Install dependencies

```bash
npm install
```

### Run locally

```bash
# Browser-only frontend with mock data
npm run dev

# Full desktop app with the Tauri/Rust backend
npm run tauri dev
```

### Production build

```bash
# Frontend build
npm run build

# Native desktop bundle
npm run tauri build
```

## Project structure

```text
.
├── index.html
├── package.json
├── public/
├── src/
│   ├── App.vue
│   ├── components/
│   ├── composables/
│   ├── data/
│   ├── store/
│   └── styles/
├── src-tauri/
│   ├── src/
│   ├── Capabilities/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── images/
├── scripts/
├── README.md
├── .github/
└── package-lock.json
```

### Frontend

The frontend is built with Vue 3 and Vite. It handles:

- layout and panels
- global search and saved filters
- log-table rendering
- settings and configuration
- alert and report views
- browser fallback/mock data

### Native backend

The Rust/Tauri backend under `src-tauri/` handles:

- source registration and local configuration
- log file discovery and directory walking
- incremental parsing and cursor tracking
- SQLite persistence per log source
- geo-IP and DNS enrichment calls
- command surface consumed by the UI

## How a log source flows through the app

1. Add a source by pointing Tomahawk at a log file or directory.
2. The app validates the path, creates the source configuration, and initializes a SQLite database.
3. A resync operation reads new bytes from the file(s), parses Apache-style entries, and stores them in the source database.
4. The UI loads the newest rows into the live tail window and allows filtering, alerting, and inspection.
5. Security rules and enrichment steps can flag suspicious entries or append metadata like ASN or geo info.

## Configuration and data locations

Tomahawk stores local app state under the platform-specific user data directory used by Rust's `ProjectDirs` mechanism. This includes:

- source configuration
- one SQLite database per source
- any optional geo-IP enrichment data

The app also persists workspace layouts, display preferences, and rule settings locally so your analysis environment survives restarts.

## Development notes

The project was scaffolded with Tauri/Vite defaults, but the app logic is centered around the log-analysis workflow rather than a generic starter template. The core code paths live primarily in:

- `src/store/monitor.js` — app state, filters, workspaces, sync logic, and settings
- `src/data/classification.js` — built-in attack and probe detection
- `src/components/MonitorPage.vue` and related panel components — main investigation UI
- `src-tauri/src/` — file ingestion, SQLite handling, parsing, and enrichment logic

## Current state

This project is actively evolving around the real log-analysis workflow. The primary experience is the desktop Monitor view, where you can add sources, resync files, inspect rows, classify suspicious traffic, and work through a live filtered access log.

## License

This project is not currently documented with a project-wide license file. If you plan to distribute or reuse the code, confirm the intended licensing before publishing builds or shipping modified binaries.
