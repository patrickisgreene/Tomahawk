use serde::Deserialize;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::config::{load_config, save_config, SourceConfig, SourceKind};
use crate::db;
use crate::fsbrowse;
use crate::geoip;
use crate::ingest;
use crate::types::{AccessLogRow, DirListing, QueryFieldSummary, SourceFileSummary, SourceSummary};
use crate::types::{GeoipLookup, GeoipStatus};

#[tauri::command]
pub fn list_local_dir(path: Option<String>) -> Result<DirListing, String> {
    fsbrowse::list_local_dir(path)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddSourceInput {
    pub kind: String, // "file" | "directory"
    pub label: String,
    pub path: String,
    pub pattern: Option<String>,
    pub include_subfolders: Option<bool>,
    pub log_format: Option<String>,
}

#[tauri::command]
pub fn add_source(input: AddSourceInput) -> Result<SourceSummary, String> {
    let kind = match input.kind.as_str() {
        "file" => SourceKind::File,
        "directory" => SourceKind::Directory,
        other => return Err(format!("unknown source kind: {other}")),
    };

    let mut config = load_config()?;
    let source = SourceConfig {
        id: format!("src_{}", Uuid::new_v4().simple()),
        kind,
        label: input.label,
        path: input.path,
        pattern: input.pattern.unwrap_or_else(|| "access.log*".to_string()),
        include_subfolders: input.include_subfolders.unwrap_or(false),
        log_format: input.log_format.unwrap_or_else(|| "apache_combined".to_string()),
    };

    // Fail fast if the path isn't readable, before it's persisted.
    files_for_source(&source)?;
    db::open_source_db(&source.id)?; // creates schema so it's ready for the first pull

    let summary = summarize(&source);
    config.sources.push(source);
    save_config(&config)?;
    Ok(summary)
}

#[tauri::command]
pub fn remove_source(source_id: String) -> Result<(), String> {
    let mut config = load_config()?;
    config.sources.retain(|s| s.id != source_id);
    save_config(&config)?;
    db::delete_source_db(&source_id)
}

#[tauri::command]
pub fn list_sources() -> Result<Vec<SourceSummary>, String> {
    let config = load_config()?;
    Ok(config.sources.iter().map(summarize).collect())
}

#[tauri::command]
pub fn geoip_status() -> Result<GeoipStatus, String> {
    geoip::status()
}

#[tauri::command]
pub fn download_geoip_database() -> Result<GeoipStatus, String> {
    geoip::download_database()
}

#[tauri::command]
pub fn lookup_geoip(ip: String) -> Result<GeoipLookup, String> {
    geoip::lookup(ip)
}

#[tauri::command]
pub async fn reverse_dns(ip: String) -> Result<String, String> {
    crate::enrichment::reverse_dns(ip).await
}

#[tauri::command]
pub async fn lookup_network_details(ip: String) -> Result<crate::enrichment::NetworkDetails, String> {
    tauri::async_runtime::spawn_blocking(move || crate::enrichment::network_details(ip))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn list_query_fields() -> Result<Vec<QueryFieldSummary>, String> {
    let config = load_config()?;
    let Some(source) = config.sources.first() else {
        return Ok(default_query_fields());
    };
    let conn = db::open_source_db(&source.id)?;
    let mut stmt = conn.prepare("PRAGMA table_info(access_rows)").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let name: String = row.get(1)?;
            let sqlite_type: String = row.get(2)?;
            Ok((name, sqlite_type))
        })
        .map_err(|e| e.to_string())?;

    let mut fields = Vec::new();
    for row in rows {
        let (name, sqlite_type) = row.map_err(|e| e.to_string())?;
        if name == "id" {
            continue;
        }
        let id = match name.as_str() {
            "file_path" => "filePath".to_string(),
            "forwarded_for" => "forwardedFor".to_string(),
            "auth_user" => "authUser".to_string(),
            "user_agent" => "userAgent".to_string(),
            _ => name.clone(),
        };
        let field_type = if sqlite_type.eq_ignore_ascii_case("integer") || sqlite_type.eq_ignore_ascii_case("real") {
            "number"
        } else {
            "text"
        };
        fields.push(QueryFieldSummary {
            id,
            label: name,
            field_type: field_type.to_string(),
        });
    }
    Ok(fields)
}

/// Loads whatever's already in the database for the given sources (or
/// every registered source, if `None`) — regardless of tailing cursors.
/// `pull_new_rows` only ever returns bytes newly read *since the last
/// call*, so on a fresh app launch (frontend state empty, but the file's
/// cursor is already at EOF from a prior session) it reports nothing new
/// forever. This is what hydrates the tail view with already-ingested
/// history on startup, before the resync loop takes over incrementally.
#[tauri::command]
pub fn load_recent_rows(source_ids: Option<Vec<String>>, limit: i64) -> Result<Vec<AccessLogRow>, String> {
    let config = load_config()?;
    let sources: Vec<&SourceConfig> = match &source_ids {
        Some(ids) => config.sources.iter().filter(|s| ids.contains(&s.id)).collect(),
        None => config.sources.iter().collect(),
    };

    let mut all_rows = Vec::new();
    for source in &sources {
        let conn = db::open_source_db(&source.id)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, file_path, ts, ip, method, status, path, bytes, ms, referer, user_agent, raw, hostname, forwarded_for, ident, auth_user, timestamp, request, protocol
                 FROM access_rows ORDER BY ts DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![limit], |row| {
                let id: i64 = row.get(0)?;
                let file_path: String = row.get(1)?;
                let ts: i64 = row.get(2)?;
                Ok(AccessLogRow {
                    hostname: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
                    forwarded_for: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                    ident: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
                    auth_user: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                    timestamp: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                    request: row.get::<_, Option<String>>(17)?.unwrap_or_default(),
                    protocol: row.get::<_, Option<String>>(18)?.unwrap_or_default(),

                    id: format!("{}:{id}", source.id),
                    file_path,
                    ts,
                    time: format_time(ts),
                    ip: row.get(3)?,
                    method: row.get(4)?,
                    status: row.get(5)?,
                    path: row.get(6)?,
                    bytes: row.get(7)?,
                    ms: row.get(8)?,
                    referer: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                    user_agent: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                    raw: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                })
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            all_rows.push(row.map_err(|e| e.to_string())?);
        }
    }

    all_rows.sort_by_key(|r| r.ts);
    if all_rows.len() as i64 > limit {
        let start = all_rows.len() - limit as usize;
        all_rows.drain(0..start);
    }
    Ok(all_rows)
}

fn format_time(ts_ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ts_ms)
        .map(|dt| dt.format("%H:%M:%S").to_string())
        .unwrap_or_default()
}

fn default_query_fields() -> Vec<QueryFieldSummary> {
    [
        ("filePath", "file_path", "text"),
        ("ts", "ts", "number"),
        ("ip", "ip", "text"),
        ("method", "method", "text"),
        ("status", "status", "number"),
        ("path", "path", "text"),
        ("bytes", "bytes", "number"),
        ("ms", "ms", "number"),
        ("referer", "referer", "text"),
        ("userAgent", "user_agent", "text"),
        ("raw", "raw", "text"),
        ("hostname", "hostname", "text"),
        ("forwardedFor", "forwarded_for", "text"),
        ("ident", "ident", "text"),
        ("authUser", "auth_user", "text"),
        ("timestamp", "timestamp", "text"),
        ("request", "request", "text"),
        ("protocol", "protocol", "text"),

    ]
    .into_iter()
    .map(|(id, label, field_type)| QueryFieldSummary {
        id: id.to_string(),
        label: label.to_string(),
        field_type: field_type.to_string(),
    })
    .collect()
}

/// Pulls whatever's new since the last call for the given sources (or
/// every registered source, if `None`). This is the real implementation
/// behind src/data/logSource.js's `pull()` — called on the store's
/// existing resync timer, same as the mock generator was.
#[tauri::command]
pub fn pull_new_rows(source_ids: Option<Vec<String>>) -> Result<Vec<AccessLogRow>, String> {
    let config = load_config()?;
    let sources: Vec<&SourceConfig> = match &source_ids {
        Some(ids) => config.sources.iter().filter(|s| ids.contains(&s.id)).collect(),
        None => config.sources.iter().collect(),
    };

    let mut all_rows = Vec::new();
    for source in sources {
        let mut conn = db::open_source_db(&source.id)?;
        for file in files_for_source(source)? {
            let rows = ingest::ingest_access_file(&mut conn, &source.id, &file)?;
            all_rows.extend(rows);
        }
    }
    all_rows.sort_by_key(|r| r.ts);
    Ok(all_rows)
}

fn summarize(source: &SourceConfig) -> SourceSummary {
    let kind = match source.kind {
        SourceKind::File => "file",
        SourceKind::Directory => "directory",
    }
    .to_string();

    let (row_count, last_ts, files) = compute_stats(source).unwrap_or_else(|e| {
        eprintln!("[sources] failed to compute stats for {}: {e}", source.id);
        (0, None, Vec::new())
    });

    SourceSummary {
        id: source.id.clone(),
        kind,
        label: source.label.clone(),
        path: source.path.clone(),
        log_format: source.log_format.clone(),
        row_count,
        last_ts,
        files,
    }
}

fn compute_stats(source: &SourceConfig) -> Result<(i64, Option<i64>, Vec<SourceFileSummary>), String> {
    let conn = db::open_source_db(&source.id)?;
    let (row_count, last_ts): (i64, Option<i64>) = conn
        .query_row("SELECT COUNT(*), MAX(ts) FROM access_rows", [], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();
    // A directory whose root became unreadable shouldn't erase the source
    // from the panel — just show it with an empty file list.
    for path in files_for_source(source).unwrap_or_default() {
        let path_str = path.to_string_lossy().to_string();
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path_str.clone());
        let (file_rows, file_last_ts): (i64, Option<i64>) = conn
            .query_row(
                "SELECT COUNT(*), MAX(ts) FROM access_rows WHERE file_path = ?1",
                [path_str.as_str()],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((0, None));
        let done: bool = conn
            .query_row("SELECT done FROM cursors WHERE file_path = ?1", [path_str.as_str()], |row| {
                row.get::<_, i64>(0)
            })
            .map(|d| d != 0)
            .unwrap_or(false);
        files.push(SourceFileSummary {
            name,
            path: path_str,
            row_count: file_rows,
            last_ts: file_last_ts,
            done,
        });
    }
    Ok((row_count, last_ts, files))
}

fn files_for_source(source: &SourceConfig) -> Result<Vec<PathBuf>, String> {
    match source.kind {
        SourceKind::File => Ok(vec![PathBuf::from(&source.path)]),
        SourceKind::Directory => {
            let mut matches = Vec::new();
            collect_matching_files(Path::new(&source.path), &source.pattern, source.include_subfolders, &mut matches)?;
            Ok(matches)
        }
    }
}

fn collect_matching_files(dir: &Path, pattern: &str, recurse: bool, out: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            if recurse {
                collect_matching_files(&path, pattern, recurse, out)?;
            }
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if glob_matches(pattern, &name) {
            out.push(path);
        }
    }
    Ok(())
}

fn glob_matches(pattern: &str, name: &str) -> bool {
    let escaped = regex::escape(pattern).replace(r"\*", ".*");
    regex::Regex::new(&format!("^{escaped}$"))
        .map(|re| re.is_match(name))
        .unwrap_or(false)
}
