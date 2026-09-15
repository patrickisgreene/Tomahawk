use serde::Serialize;

/// One parsed access-log row, shaped to match what the frontend's mock
/// generator already produced (src/data/mock.js's `row()`), minus the
/// pre-formatted `bytes` string (kept numeric here; the frontend formats
/// it at render time) and plus `ts` for correct cross-source ordering.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessLogRow {
    pub hostname: String,
    pub forwarded_for: String,
    pub ident: String,
    pub auth_user: String,
    pub timestamp: String,
    pub request: String,
    pub protocol: String,

    pub id: String,
    pub file_path: String,
    pub ts: i64,
    pub time: String,
    pub ip: String,
    pub method: String,
    pub status: u16,
    pub path: String,
    pub bytes: u64,
    pub ms: Option<f64>,
    pub referer: String,
    pub user_agent: String,
    /// The original log line, verbatim — lets the Inspector show real raw
    /// text instead of reconstructing one (which is all the mock data can
    /// do, since it never had a real line to begin with).
    pub raw: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<FsEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    /// "dir" | "file" | "archive" (archive = looks gzip-compressed)
    pub kind: String,
    pub modified: Option<String>,
    pub size: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFileSummary {
    pub name: String,
    pub path: String,
    pub row_count: i64,
    pub last_ts: Option<i64>,
    /// cursors.done — fully ingested (rotated/gz archive) vs still growing.
    pub done: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSummary {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub path: String,
    pub row_count: i64,
    pub last_ts: Option<i64>,
    pub files: Vec<SourceFileSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryFieldSummary {
    pub id: String,
    pub label: String,
    pub field_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoipStatus {
    pub installed: bool,
    pub provider: String,
    pub attribution: String,
    pub path: Option<String>,
    pub size: Option<u64>,
    pub modified: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoipLookup {
    pub ip: String,
    pub status: String,
    pub country_code: Option<String>,
    pub country_name: Option<String>,
    pub provider: String,
    pub attribution: String,
}
