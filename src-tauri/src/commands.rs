use serde::{Deserialize, Serialize};
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
        hidden: false,
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

/// Hides/unhides a source. Hidden sources are excluded from "all sources"
/// aggregates (the access log table, domain/tag lists, stats) but keep
/// syncing in the background and can still be viewed by picking them
/// directly from the Source filter.
#[tauri::command]
pub fn set_source_hidden(source_id: String, hidden: bool) -> Result<(), String> {
    let mut config = load_config()?;
    let source = config
        .sources
        .iter_mut()
        .find(|s| s.id == source_id)
        .ok_or_else(|| format!("unknown source: {source_id}"))?;
    source.hidden = hidden;
    save_config(&config)
}

#[tauri::command]
pub fn list_sources() -> Result<Vec<SourceSummary>, String> {
    let config = load_config()?;
    // Fast path: config + a filesystem scan for file names only — no SQLite
    // queries. This keeps the sources panel responsive the moment the list is
    // requested; exact row counts / done flags are filled in afterwards by
    // `get_source_stats` (which runs off the main thread).
    Ok(config.sources.iter().map(fast_summarize).collect())
}

/// Builds a SourceSummary from the config and directory contents alone, with
/// placeholder stats (zero row counts, unknown done flags). Good enough to
/// show the source tree before any per-source stats are ready.
fn fast_summarize(source: &SourceConfig) -> SourceSummary {
    let kind = match source.kind {
        SourceKind::File => "file",
        SourceKind::Directory => "directory",
    }
    .to_string();
    let files = files_for_source(source)
        .unwrap_or_default()
        .into_iter()
        .map(|path| {
            let path_str = path.to_string_lossy().to_string();
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path_str.clone());
            SourceFileSummary {
                name,
                path: path_str,
                row_count: 0,
                last_ts: None,
                done: false,
            }
        })
        .collect();
    SourceSummary {
        id: source.id.clone(),
        kind,
        label: source.label.clone(),
        path: source.path.clone(),
        log_format: source.log_format.clone(),
        row_count: 0,
        last_ts: None,
        files,
        hidden: source.hidden,
    }
}

/// Refreshed per-source stats (row counts, last timestamp, per-file cursors).
/// Queries run off the main thread so a batch of multi-million row sources
/// can't freeze the window while the stats are computed.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStats {
    pub row_count: i64,
    pub last_ts: Option<i64>,
    pub files: Vec<SourceFileSummary>,
}

#[tauri::command]
pub async fn get_source_stats(source_id: String) -> Result<SourceStats, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = load_config()?;
        let source = config
            .sources
            .iter()
            .find(|s| s.id == source_id)
            .ok_or_else(|| format!("unknown source: {source_id}"))?;
        let (row_count, last_ts, files) = compute_stats(source).unwrap_or_else(|e| {
            eprintln!("[sources] failed to compute stats for {}: {e}", source.id);
            (0, None, Vec::new())
        });
        Ok(SourceStats { row_count, last_ts, files })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Opens the WebView's DevTools — the app disables the native right-click
/// menu everywhere (see App.vue), so this backs the custom context menus'
/// "Inspect" item, which otherwise has no way to reach it.
#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    window.open_devtools();
    Ok(())
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
pub async fn load_recent_rows(source_ids: Option<Vec<String>>, limit: i64) -> Result<Vec<AccessLogRow>, String> {
    tauri::async_runtime::spawn_blocking(move || load_recent_rows_impl(source_ids, limit))
        .await
        .map_err(|e| e.to_string())?
}

/// Column list shared by every query that materializes rows — keep the index
/// order in sync with `access_row_from_sql`.
const ROW_COLUMNS: &str =
    "id, file_path, ts, ip, method, status, path, bytes, ms, referer, user_agent, raw, hostname, forwarded_for, ident, auth_user, timestamp, request, protocol";

/// The searchable columns of `access_rows`, used to build the "search all
/// fields" predicate and to validate query-builder field ids before they're
/// spliced into SQL (never trust a field name from the UI directly).
const ALL_QUERY_COLUMNS: &[&str] = &[
    "file_path",
    "ts",
    "ip",
    "method",
    "status",
    "path",
    "bytes",
    "ms",
    "referer",
    "user_agent",
    "raw",
    "hostname",
    "forwarded_for",
    "ident",
    "auth_user",
    "timestamp",
    "request",
    "protocol",
];

const NUMERIC_QUERY_COLUMNS: &[&str] = &["ts", "status", "bytes", "ms"];

/// The HTTP methods offered by the "Method" filter dropdown, lowercased for
/// comparison. Anything a real log line contains outside this list (the
/// parser doesn't constrain `method` to an enum) falls into "Non-standard".
const STANDARD_HTTP_METHODS: &[&str] = &["get", "head", "post", "put", "delete", "connect", "options", "trace", "patch"];

/// Sentinel value for `QueryInput.method` meaning "any method not in
/// `STANDARD_HTTP_METHODS`", sent by the frontend's "Non-standard methods"
/// filter option.
const NONSTANDARD_METHOD_SENTINEL: &str = "__nonstandard__";

/// Maps a query-builder field id (the camelCase ids the UI uses) to its real
/// column, and validates it against the schema.
fn query_column(field: &str) -> Option<&'static str> {
    let column = match field {
        "filePath" => "file_path",
        "forwardedFor" => "forwarded_for",
        "authUser" => "auth_user",
        "userAgent" => "user_agent",
        other => other,
    };
    ALL_QUERY_COLUMNS.iter().copied().find(|c| *c == column)
}

/// Builds an `AccessLogRow` from one SQL result row, using the shared
/// `ROW_COLUMNS` index order.
fn access_row_from_sql(source_id: &str, row: &rusqlite::Row) -> Result<AccessLogRow, rusqlite::Error> {
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

        id: format!("{source_id}:{id}"),
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
        tags: Vec::new(), // attached after pagination — see attach_tags()
    })
}

/// Splits a composite row id (`"{source_id}:{local_rowid}"`, see
/// `access_row_from_sql`) back into its parts. Never trust this as parsed
/// from the frontend without validating the source exists.
fn parse_row_id(id: &str) -> Option<(&str, i64)> {
    let (source_id, rowid) = id.rsplit_once(':')?;
    Some((source_id, rowid.parse().ok()?))
}

/// Fills in `.tags` on an already-paginated page of rows, one indexed
/// `row_id IN (...)` lookup per source involved — bounded by the page size
/// (typically ~1000), not the whole database, unlike the over-fetch used to
/// compute the page itself.
fn attach_tags(rows: &mut [AccessLogRow]) -> Result<(), String> {
    use std::collections::HashMap;
    let mut by_source: HashMap<&str, Vec<i64>> = HashMap::new();
    for row in rows.iter() {
        if let Some((source_id, local_id)) = parse_row_id(&row.id) {
            by_source.entry(source_id).or_default().push(local_id);
        }
    }
    let mut tags_by_full_id: HashMap<String, Vec<String>> = HashMap::new();
    for (source_id, local_ids) in &by_source {
        let conn = db::open_source_db(source_id)?;
        let placeholders = local_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("SELECT row_id, tag FROM row_tags WHERE row_id IN ({placeholders}) ORDER BY tag");
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params = rusqlite::params_from_iter(local_ids.iter());
        let mapped = stmt
            .query_map(params, |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        for entry in mapped {
            let (local_id, tag) = entry.map_err(|e| e.to_string())?;
            tags_by_full_id.entry(format!("{source_id}:{local_id}")).or_default().push(tag);
        }
    }
    for row in rows.iter_mut() {
        if let Some(tags) = tags_by_full_id.remove(&row.id) {
            row.tags = tags;
        }
    }
    Ok(())
}

/// Numeric rowid embedded in the composite `source:rowid` id — the tie-break
/// for deterministic cross-source ordering.
fn row_id(row: &AccessLogRow) -> i64 {
    row.id.rsplit(':').next().and_then(|s| s.parse().ok()).unwrap_or(0)
}

/// Orders two rows by the chosen sort column (falling back to (ts, rowid) as
/// a deterministic tiebreak), matching the SQL `ORDER BY {col}, ts, id`
/// direction used per-source so the final cross-source merge agrees with it.
/// `sort_col` is always a value already validated by `query_column()`.
fn compare_rows(a: &AccessLogRow, b: &AccessLogRow, sort_col: &str, sort_desc: bool) -> std::cmp::Ordering {
    let primary = match sort_col {
        "status" => a.status.cmp(&b.status),
        "bytes" => a.bytes.cmp(&b.bytes),
        "ms" => a.ms.partial_cmp(&b.ms).unwrap_or(std::cmp::Ordering::Equal),
        "file_path" => a.file_path.to_lowercase().cmp(&b.file_path.to_lowercase()),
        "ip" => a.ip.to_lowercase().cmp(&b.ip.to_lowercase()),
        "method" => a.method.to_lowercase().cmp(&b.method.to_lowercase()),
        "path" => a.path.to_lowercase().cmp(&b.path.to_lowercase()),
        "referer" => a.referer.to_lowercase().cmp(&b.referer.to_lowercase()),
        "user_agent" => a.user_agent.to_lowercase().cmp(&b.user_agent.to_lowercase()),
        "raw" => a.raw.to_lowercase().cmp(&b.raw.to_lowercase()),
        "hostname" => a.hostname.to_lowercase().cmp(&b.hostname.to_lowercase()),
        "forwarded_for" => a.forwarded_for.to_lowercase().cmp(&b.forwarded_for.to_lowercase()),
        "ident" => a.ident.to_lowercase().cmp(&b.ident.to_lowercase()),
        "auth_user" => a.auth_user.to_lowercase().cmp(&b.auth_user.to_lowercase()),
        "timestamp" => a.timestamp.to_lowercase().cmp(&b.timestamp.to_lowercase()),
        "request" => a.request.to_lowercase().cmp(&b.request.to_lowercase()),
        "protocol" => a.protocol.to_lowercase().cmp(&b.protocol.to_lowercase()),
        _ => a.ts.cmp(&b.ts),
    };
    let primary = if sort_desc { primary.reverse() } else { primary };
    if primary != std::cmp::Ordering::Equal {
        return primary;
    }
    let by_ts = if sort_desc { b.ts.cmp(&a.ts) } else { a.ts.cmp(&b.ts) };
    if by_ts != std::cmp::Ordering::Equal {
        return by_ts;
    }
    if sort_desc { row_id(b).cmp(&row_id(a)) } else { row_id(a).cmp(&row_id(b)) }
}

/// Runs off the main thread — a large `limit` across several multi-million
/// row sources would otherwise freeze the window (SQLite scan + serialize).
fn load_recent_rows_impl(source_ids: Option<Vec<String>>, limit: i64) -> Result<Vec<AccessLogRow>, String> {
    let config = load_config()?;
    let sources: Vec<&SourceConfig> = match &source_ids {
        Some(ids) => config.sources.iter().filter(|s| ids.contains(&s.id)).collect(),
        None => config.sources.iter().filter(|s| !s.hidden).collect(),
    };

    let mut all_rows = Vec::new();
    for source in &sources {
        let conn = db::open_source_db(&source.id)?;
        let sql = format!("SELECT {ROW_COLUMNS} FROM access_rows ORDER BY ts DESC LIMIT ?1");
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![limit], |row| access_row_from_sql(&source.id, row))
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryConditionInput {
    pub field: String,
    pub operator: String,
    pub value: String,
}

/// Everything the access-log table can be filtered by. Each field is optional
/// so a bare `{ }` means "all rows, no filters".
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryInput {
    pub source_id: Option<String>,
    pub domain: Option<String>,
    /// How `domain` is matched against a shared-hosting log's `www.`/bare
    /// hostname pairs: `"merge"` (default) matches both the given domain and
    /// its `www.` twin, `"wwwOnly"` matches only the `www.` form, anything
    /// else matches `domain` exactly.
    pub domain_www_mode: Option<String>,
    pub min_status: Option<i64>,
    /// A specific HTTP method (case-insensitive), or the sentinel
    /// `"__nonstandard__"` meaning "not one of `STANDARD_HTTP_METHODS`".
    pub method: Option<String>,
    /// A tag assigned via `add_row_tag` (case-insensitive; stored lowercase).
    pub tag: Option<String>,
    pub window_ms: Option<i64>,
    /// The free-text search box. A leading "!" negates the match (rows where
    /// no field matches, instead of rows where some field does).
    pub text: Option<String>,
    /// When true, `text` is matched byte-exact instead of the default
    /// case-insensitive match.
    pub text_case_sensitive: Option<bool>,
    /// When true, `text` (minus any leading "!") is compiled as a regex via
    /// the Rust `regex` crate and pushed into SQLite's registered `regexp()`
    /// function, instead of treated as a plain substring.
    pub text_regex: Option<bool>,
    pub conditions: Option<Vec<QueryConditionInput>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRowsResult {
    pub rows: Vec<AccessLogRow>,
    /// Rows matching every filter (search text + query builder conditions).
    pub total: i64,
    /// Rows in the involved sources regardless of filters — the "of N" in the
    /// query panel's "matched X of N".
    pub universe: i64,
}

/// SQL-backed paginated table query. The UI's search box, source/domain/time/
/// status filters and the query-builder conditions are all pushed down into
/// SQLite so filtering always operates on the *entire* database, not just the
/// rows currently loaded in the frontend. Runs off the main thread.
#[tauri::command]
pub async fn query_rows(input: QueryInput, sort_by: Option<String>, sort_desc: bool, offset: i64, limit: i64) -> Result<QueryRowsResult, String> {
    tauri::async_runtime::spawn_blocking(move || query_rows_impl(input, sort_by, sort_desc, offset, limit))
        .await
        .map_err(|e| e.to_string())?
}

/// Escapes SQL LIKE's own wildcards (`%`, `_`) so a "contains"/plain-text
/// search matches them literally — without this, typing e.g. a URL-encoded
/// "%20" or a path with an underscore into the search box would silently act
/// as a wildcard even with regex mode off. Paired with `LIKE ? ESCAPE '\'`.
fn escape_like(value: &str) -> String {
    value.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

/// Characters that make a "matches" value a real regex rather than plain text.
const REGEX_META_CHARS: &str = ".+*?^$()[]{}|\\";

fn is_literal_regex(value: &str) -> bool {
    !value.chars().any(|c| REGEX_META_CHARS.contains(c))
}

/// Cache key for the free-text search box's compiled regex, shared between
/// `build_box_filters` (which only needs the key to bind as a param) and
/// `compile_text_regex` (which owns the actual `Regex`). Namespaced with a
/// control character prefix so it can never collide with a query-builder
/// condition's regex cache key (see `compile_regexes`), and includes the
/// case-sensitivity flag since the same pattern text compiles differently
/// depending on it.
fn text_regex_cache_key(needle: &str, case_sensitive: bool) -> String {
    format!("\u{1}text\u{1}{case_sensitive}\u{1}{needle}")
}

/// Splits the free-text search box's raw input into its negation flag and
/// the actual needle — a leading "!" means "rows where no field matches".
fn parse_text_filter(raw: &str) -> (bool, &str) {
    match raw.strip_prefix('!') {
        Some(rest) => (true, rest.trim()),
        None => (false, raw),
    }
}

/// The toolbar filters (everything except the query-builder conditions) become
/// one SQL WHERE fragment with ordered parameters. `min_ts` is the precomputed
/// start of a "last N of log" window.
fn build_box_filters(input: &QueryInput, min_ts: Option<i64>) -> (Vec<String>, Vec<rusqlite::types::Value>) {
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(domain) = input.domain.as_deref().map(|d| d.trim()).filter(|d| !d.is_empty()) {
        let root = domain.to_lowercase();
        let www = format!("www.{root}");
        match input.domain_www_mode.as_deref() {
            Some("wwwOnly") => {
                clauses.push("LOWER(COALESCE(hostname,'')) = ?".to_string());
                params.push(www.into());
            }
            Some("exact") => {
                clauses.push("LOWER(COALESCE(hostname,'')) = ?".to_string());
                params.push(root.into());
            }
            _ => {
                clauses.push("LOWER(COALESCE(hostname,'')) IN (?, ?)".to_string());
                params.push(root.into());
                params.push(www.into());
            }
        }
    }
    let min_status = input.min_status.unwrap_or(0);
    if min_status > 0 {
        clauses.push("status >= ?".to_string());
        params.push(min_status.into());
    }
    if let Some(method) = input.method.as_deref().map(|m| m.trim()).filter(|m| !m.is_empty()) {
        if method == NONSTANDARD_METHOD_SENTINEL {
            let placeholders = STANDARD_HTTP_METHODS.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            clauses.push(format!("LOWER(method) NOT IN ({placeholders})"));
            for m in STANDARD_HTTP_METHODS {
                params.push(m.to_string().into());
            }
        } else {
            clauses.push("LOWER(method) = ?".to_string());
            params.push(method.to_lowercase().into());
        }
    }
    if let Some(tag) = input.tag.as_deref().map(|t| t.trim()).filter(|t| !t.is_empty()) {
        clauses.push("id IN (SELECT row_id FROM row_tags WHERE tag = ?)".to_string());
        params.push(tag.to_lowercase().into());
    }
    if let Some(mts) = min_ts {
        clauses.push("ts >= ?".to_string());
        params.push(mts.into());
    }
    if let Some(raw) = input.text.as_deref().map(|t| t.trim()).filter(|t| !t.is_empty()) {
        let (negate, needle) = parse_text_filter(raw);
        if !needle.is_empty() {
            let case_sensitive = input.text_case_sensitive.unwrap_or(false);
            let mut parts = Vec::new();
            if input.text_regex.unwrap_or(false) {
                let key = text_regex_cache_key(needle, case_sensitive);
                for col in ALL_QUERY_COLUMNS {
                    parts.push(format!("regexp(COALESCE(CAST({col} AS TEXT),''), ?)"));
                    params.push(key.clone().into());
                }
            } else if case_sensitive {
                // SQLite's LIKE is case-insensitive for ASCII regardless of
                // collation, so an exact-case "contains" needs INSTR instead.
                for col in ALL_QUERY_COLUMNS {
                    parts.push(format!("INSTR(COALESCE(CAST({col} AS TEXT),''), ?) > 0"));
                    params.push(needle.to_string().into());
                }
            } else {
                for col in ALL_QUERY_COLUMNS {
                    parts.push(format!("COALESCE(CAST({col} AS TEXT),'') LIKE ? ESCAPE '\\'"));
                    params.push(format!("%{}%", escape_like(&needle.to_lowercase())).into());
                }
            }
            let joined = format!("({})", parts.join(" OR "));
            clauses.push(if negate { format!("NOT {joined}") } else { joined });
        }
    }
    (clauses, params)
}

/// The query-builder conditions become a second WHERE fragment. Plain-text
/// values degrade to `LIKE` (which they'll match anyway); values with actual
/// regex syntax push down through the `regexp()` scalar function registered on
/// the connection (see `db::register_regexp_fn`), so filtering happens in
/// SQLite and only matching rows are ever materialized.
fn build_condition_filters(conditions: &[QueryConditionInput]) -> Result<(Vec<String>, Vec<rusqlite::types::Value>), String> {
    let mut clauses: Vec<String> = Vec::new();
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    for condition in conditions {
        let column = query_column(&condition.field)
            .ok_or_else(|| format!("unknown query field: {}", condition.field))?;
        let value = condition.value.trim();
        if value.is_empty() {
            continue; // an empty value means "no constraint", like the frontend
        }
        let op = condition.operator.as_str();
        if NUMERIC_QUERY_COLUMNS.contains(&column) {
            let num: f64 = value.parse().map_err(|_| format!("value \"{value}\" is not a number for field {}", condition.field))?;
            match op {
                "=" => { clauses.push(format!("{column} = ?")); params.push(num.into()); }
                "!=" => { clauses.push(format!("{column} <> ?")); params.push(num.into()); }
                ">" => { clauses.push(format!("{column} > ?")); params.push(num.into()); }
                ">=" => { clauses.push(format!("{column} >= ?")); params.push(num.into()); }
                "<" => { clauses.push(format!("{column} < ?")); params.push(num.into()); }
                "<=" => { clauses.push(format!("{column} <= ?")); params.push(num.into()); }
                other => return Err(format!("operator \"{other}\" is not supported on numeric field \"{}\"", condition.field)),
            }
        } else {
            match op {
                "contains" => {
                    clauses.push(format!("COALESCE({column},'') LIKE ? ESCAPE '\\'"));
                    params.push(format!("%{}%", escape_like(&value.to_lowercase())).into());
                }
                "matches" if is_literal_regex(value) => {
                    clauses.push(format!("COALESCE({column},'') LIKE ? ESCAPE '\\'"));
                    params.push(format!("%{}%", escape_like(&value.to_lowercase())).into());
                }
                "matches" => {
                    clauses.push(format!("regexp({column}, ?)"));
                    params.push(value.to_string().into());
                }
                "=" => {
                    clauses.push(format!("LOWER(COALESCE({column},'')) = ?"));
                    params.push(value.to_lowercase().into());
                }
                "!=" => {
                    clauses.push(format!("LOWER(COALESCE({column},'')) <> ?"));
                    params.push(value.to_lowercase().into());
                }
                other => return Err(format!("operator \"{other}\" is not supported on text field \"{}\"", condition.field)),
            }
        }
    }
    Ok((clauses, params))
}

fn joined_where(box_clauses: &[String], cond_clauses: &[String]) -> String {
    let all: Vec<&str> = box_clauses
        .iter()
        .map(|s| s.as_str())
        .chain(cond_clauses.iter().map(|s| s.as_str()))
        .collect();
    if all.is_empty() { String::new() } else { format!("WHERE {}", all.join(" AND ")) }
}

/// Compiles every non-literal "matches" condition once per query. The compiled
/// regexes are handed to `db::register_regexp_fn`, so SQLite matches rows
/// through the shared `regexp()` function without recompiling per row.
fn compile_regexes(conditions: &[QueryConditionInput]) -> Result<std::collections::HashMap<String, regex::Regex>, String> {
    let mut regexes = std::collections::HashMap::new();
    for condition in conditions {
        if condition.operator.as_str() != "matches" {
            continue;
        }
        let value = condition.value.trim();
        if value.is_empty() || is_literal_regex(value) {
            continue;
        }
        let re = regex::RegexBuilder::new(value)
            .case_insensitive(true)
            .build()
            .map_err(|e| format!("invalid regex for field {}: {e}", condition.field))?;
        regexes.insert(value.to_string(), re);
    }
    Ok(regexes)
}

/// Compiles the free-text search box's pattern when regex mode is on, keyed
/// by `text_regex_cache_key` so `build_box_filters` can bind the same key
/// without owning the `Regex` itself. Unlike the query-builder's "matches"
/// operator, this always compiles as regex when the toggle is on — there's
/// no literal-text fallback, since the box already has its own plain
/// substring mode to switch back to.
fn compile_text_regex(input: &QueryInput) -> Result<Option<(String, regex::Regex)>, String> {
    if !input.text_regex.unwrap_or(false) {
        return Ok(None);
    }
    let Some(raw) = input.text.as_deref().map(|t| t.trim()).filter(|t| !t.is_empty()) else {
        return Ok(None);
    };
    let (_, needle) = parse_text_filter(raw);
    if needle.is_empty() {
        return Ok(None);
    }
    let case_sensitive = input.text_case_sensitive.unwrap_or(false);
    let re = regex::RegexBuilder::new(needle)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| format!("invalid search regex: {e}"))?;
    Ok(Some((text_regex_cache_key(needle, case_sensitive), re)))
}

/// Trims/slices a globally-sorted row list down to the requested page.
fn paginate(rows: &mut Vec<AccessLogRow>, offset: usize, limit: usize) {
    if offset >= rows.len() {
        rows.clear();
        return;
    }
    let end = (offset + limit).min(rows.len());
    if end < rows.len() {
        rows.drain(end..);
    }
    if offset < rows.len() {
        rows.drain(0..offset);
    }
}

fn query_rows_impl(input: QueryInput, sort_by: Option<String>, sort_desc: bool, offset_input: i64, limit_input: i64) -> Result<QueryRowsResult, String> {
    let offset = offset_input.max(0) as usize;
    let limit = if limit_input <= 0 { 1000 } else { limit_input as usize };
    // Validated against the same whitelist as query-builder fields — never
    // splice an unvalidated column name into SQL.
    let sort_col = sort_by.as_deref().and_then(query_column).unwrap_or("ts");
    let sort_collate = if NUMERIC_QUERY_COLUMNS.contains(&sort_col) { "" } else { " COLLATE NOCASE" };

    let config = load_config()?;
    let sources: Vec<&SourceConfig> = match &input.source_id {
        Some(id) => config.sources.iter().filter(|s| s.id == *id).collect(),
        None => config.sources.iter().filter(|s| !s.hidden).collect(),
    };

    // "Last N of log" windows are relative to the newest row across the
    // involved sources at query time, not the newest visible row.
    let min_ts = if input.window_ms.unwrap_or(0) > 0 {
        let window = input.window_ms.unwrap_or(0);
        let mut max_ts: i64 = 0;
        for source in &sources {
            let conn = db::open_source_db(&source.id)?;
            if let Some(ts) = conn
                .query_row("SELECT MAX(ts) FROM access_rows", [], |r| r.get::<_, Option<i64>>(0))
                .unwrap_or(None)
            {
                max_ts = max_ts.max(ts);
            }
        }
        Some(max_ts.saturating_sub(window).max(0))
    } else {
        None
    };

    let (box_clauses, box_params) = build_box_filters(&input, min_ts);
    let (cond_clauses, cond_params) = build_condition_filters(input.conditions.as_deref().unwrap_or(&[]))?;
    let mut regexes = compile_regexes(input.conditions.as_deref().unwrap_or(&[]))?;
    if let Some((key, re)) = compile_text_regex(&input)? {
        regexes.insert(key, re);
    }
    let regexes = std::sync::Arc::new(regexes);

    let mut universe: i64 = 0;
    let mut collected: Vec<AccessLogRow> = Vec::new();

    // Everything (including regex conditions, through the registered regexp()
    // function) is pushed into SQL. Each source over-fetches `offset + limit`
    // rows, then the global merge-slice produces the correct cross-source page
    // for this offset.
    let fetch = offset + limit;
    for source in &sources {
        let mut conn = db::open_source_db(&source.id)?;
        if !regexes.is_empty() {
            db::register_regexp_fn(&mut conn, regexes.clone())?;
        }
        universe += conn
            .query_row("SELECT COUNT(*) FROM access_rows", [], |r| r.get::<_, i64>(0))
            .map_err(|e| e.to_string())?;

        let mut params = Vec::new();
        params.extend(box_params.clone());
        params.extend(cond_params.clone());
        params.push((fetch as i64).into());
        params.push(0i64.into());
        let sql = format!(
            "SELECT {ROW_COLUMNS} FROM access_rows {} ORDER BY {sort_col}{sort_collate} {}, ts {}, id {} LIMIT ? OFFSET ?",
            joined_where(&box_clauses, &cond_clauses),
            if sort_desc { "DESC" } else { "ASC" },
            if sort_desc { "DESC" } else { "ASC" },
            if sort_desc { "DESC" } else { "ASC" },
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| access_row_from_sql(&source.id, row))
            .map_err(|e| e.to_string())?;
        for row in rows {
            collected.push(row.map_err(|e| e.to_string())?);
        }
    }

    let mut total: i64 = 0;
    for source in &sources {
        let mut conn = db::open_source_db(&source.id)?;
        if !regexes.is_empty() {
            db::register_regexp_fn(&mut conn, regexes.clone())?;
        }
        let mut params = Vec::new();
        params.extend(box_params.clone());
        params.extend(cond_params.clone());
        let sql = format!("SELECT COUNT(*) FROM access_rows {}", joined_where(&box_clauses, &cond_clauses));
        total += conn
            .query_row(&sql, rusqlite::params_from_iter(params.iter()), |r| r.get::<_, i64>(0))
            .map_err(|e| e.to_string())?;
    }

    collected.sort_by(|a, b| compare_rows(a, b, sort_col, sort_desc));
    paginate(&mut collected, offset, limit);
    attach_tags(&mut collected)?;
    Ok(QueryRowsResult { rows: collected, total, universe })
}

/// Distinct hostnames across the involved sources (or one source, if given),
/// for the domain filter dropdown — sourced from the database rather than the
/// rows currently loaded, so filtering can reach every domain on disk.
#[tauri::command]
pub async fn list_domains(source_id: Option<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = load_config()?;
        let sources: Vec<&SourceConfig> = match &source_id {
            Some(id) => config.sources.iter().filter(|s| s.id == *id).collect(),
            None => config.sources.iter().filter(|s| !s.hidden).collect(),
        };
        let mut domains: Vec<String> = Vec::new();
        for source in &sources {
            let conn = db::open_source_db(&source.id)?;
            let mut stmt = conn
                .prepare("SELECT DISTINCT hostname FROM access_rows WHERE hostname IS NOT NULL AND hostname <> '' AND hostname <> '-' ORDER BY hostname")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
            for row in rows {
                if let Ok(domain) = row {
                    if !domains.iter().any(|existing| existing.eq_ignore_ascii_case(&domain)) {
                        domains.push(domain);
                    }
                }
            }
        }
        domains.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        Ok(domains)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Distinct tags across the involved sources, for the Tag filter dropdown.
/// Tags are always stored lowercase (see `row_tags` in db.rs), so unlike
/// `list_domains` there's no case-fold dedup to do here.
#[tauri::command]
pub async fn list_tags(source_id: Option<String>) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = load_config()?;
        let sources: Vec<&SourceConfig> = match &source_id {
            Some(id) => config.sources.iter().filter(|s| s.id == *id).collect(),
            None => config.sources.iter().filter(|s| !s.hidden).collect(),
        };
        let mut tags: Vec<String> = Vec::new();
        for source in &sources {
            let conn = db::open_source_db(&source.id)?;
            let mut stmt = conn.prepare("SELECT DISTINCT tag FROM row_tags ORDER BY tag").map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
            for row in rows {
                let tag = row.map_err(|e| e.to_string())?;
                if !tags.contains(&tag) {
                    tags.push(tag);
                }
            }
        }
        tags.sort();
        Ok(tags)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Trims, lowercases, and length-caps user-entered tag text. `None` for
/// blank input — the frontend must not call add/remove with an empty tag.
fn normalize_tag(tag: &str) -> Option<String> {
    let trimmed = tag.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.chars().take(40).collect::<String>().to_lowercase())
}

fn tags_for_row(conn: &rusqlite::Connection, local_id: i64) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT tag FROM row_tags WHERE row_id = ?1 ORDER BY tag")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![local_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Adds a tag to one row (idempotent — re-adding an existing tag is a no-op,
/// enforced by `row_tags`'s primary key) and returns that row's full updated
/// tag list, sorted, so the frontend can replace its local copy in place
/// instead of re-querying the whole table.
#[tauri::command]
pub async fn add_row_tag(row_id: String, tag: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (source_id, local_id) = parse_row_id(&row_id).ok_or_else(|| "invalid row id".to_string())?;
        let tag = normalize_tag(&tag).ok_or_else(|| "tag cannot be empty".to_string())?;
        let conn = db::open_source_db(source_id)?;
        conn.execute("INSERT OR IGNORE INTO row_tags (row_id, tag) VALUES (?1, ?2)", rusqlite::params![local_id, tag])
            .map_err(|e| e.to_string())?;
        tags_for_row(&conn, local_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_row_tag(row_id: String, tag: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (source_id, local_id) = parse_row_id(&row_id).ok_or_else(|| "invalid row id".to_string())?;
        let tag = normalize_tag(&tag).ok_or_else(|| "tag cannot be empty".to_string())?;
        let conn = db::open_source_db(source_id)?;
        conn.execute("DELETE FROM row_tags WHERE row_id = ?1 AND tag = ?2", rusqlite::params![local_id, tag])
            .map_err(|e| e.to_string())?;
        tags_for_row(&conn, local_id)
    })
    .await
    .map_err(|e| e.to_string())?
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

/// Cap on rows shipped back to the UI per pull. Everything is still written
/// to SQLite in full; this only limits the live-tail payload, which the
/// frontend trims to its own tail window anyway. Without it, a first-time
/// import of a multi-million line file would build and serialize every row
/// on the sync thread.
const MAX_PULL_ROWS: i64 = 5000;

/// Per-file ingest result, so the sources panel can show exactly which file
/// is being loaded (and its counters while ingestion is still running).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePullResult {
    pub file_path: String,
    pub rows: Vec<AccessLogRow>,
    /// Whether the file is fully ingested (cursor marked done).
    pub done: bool,
    /// Total rows now stored for this file.
    pub row_count: i64,
}

/// Pulls whatever's new since the last call for the given sources (or
/// every registered source, if `None`). This is the real implementation
/// behind src/data/logSource.js's `pull()` — called on the store's
/// existing resync timer, same as the mock generator was.
#[tauri::command]
pub async fn pull_new_rows(source_ids: Option<Vec<String>>) -> Result<Vec<AccessLogRow>, String> {
    tauri::async_runtime::spawn_blocking(move || pull_new_rows_impl(source_ids))
        .await
        .map_err(|e| e.to_string())?
}

/// Off-main-thread body of `pull_new_rows` — the file read, parsing and
/// SQLite inserts otherwise block the window's event loop.
fn pull_new_rows_impl(source_ids: Option<Vec<String>>) -> Result<Vec<AccessLogRow>, String> {
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
        if all_rows.len() as i64 > MAX_PULL_ROWS {
            all_rows.drain(0..all_rows.len() - MAX_PULL_ROWS as usize);
        }
    }
    all_rows.sort_by_key(|r| r.ts);
    Ok(all_rows)
}

/// Ingests exactly one file for one source and reports that file's progress
/// back, so the frontend can mark individual files as "loading" instead of
/// blocking on a whole source at once.
#[tauri::command]
pub async fn pull_file(source_id: String, file_path: String, limit: i64) -> Result<FilePullResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let config = load_config()?;
        let source = config
            .sources
            .iter()
            .find(|s| s.id == source_id)
            .ok_or_else(|| format!("unknown source: {source_id}"))?;
        let path = PathBuf::from(&file_path);
        let mut conn = db::open_source_db(&source.id)?;
        let mut rows = ingest::ingest_access_file(&mut conn, &source.id, &path)?;
        if limit > 0 && rows.len() as i64 > limit {
            rows.drain(0..rows.len() - limit as usize);
        }
        rows.sort_by_key(|r| r.ts);
        let done = ingest::cursor_done(&conn, &file_path);
        let row_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM access_rows WHERE file_path = ?1",
                [&file_path],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(FilePullResult { file_path, rows, done, row_count })
    })
    .await
    .map_err(|e| e.to_string())?
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
        hidden: source.hidden,
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
