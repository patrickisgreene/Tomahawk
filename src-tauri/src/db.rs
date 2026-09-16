use rusqlite::functions::{Context, FunctionFlags};
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;

use crate::config::source_db_path;

pub(crate) const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS access_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  ts INTEGER NOT NULL,
  ip TEXT NOT NULL,
  method TEXT NOT NULL,
  status INTEGER NOT NULL,
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  ms REAL,
  referer TEXT,
  user_agent TEXT,
  raw TEXT,
  hostname TEXT,
  forwarded_for TEXT,
  ident TEXT,
  auth_user TEXT,
  timestamp TEXT,
  request TEXT,
  protocol TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_ts ON access_rows(ts);
CREATE INDEX IF NOT EXISTS idx_access_status ON access_rows(status);

CREATE TABLE IF NOT EXISTS cursors (
  file_path TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
";

/// Opens (creating if needed) the SQLite database that belongs to one
/// registered source. Each source gets its own file under the XDG data
/// dir so removing a source is just deleting this one file.
pub fn open_source_db(source_id: &str) -> Result<Connection, String> {
    let path = source_db_path(source_id)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| e.to_string())?;
    conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

/// `CREATE TABLE IF NOT EXISTS` doesn't add columns to a table that already
/// exists from an older version of the schema — patch those in by hand.
fn migrate(conn: &Connection) -> Result<(), String> {
    let has_raw_column = conn
        .prepare("SELECT raw FROM access_rows LIMIT 0")
        .is_ok();
    if !has_raw_column {
        conn.execute("ALTER TABLE access_rows ADD COLUMN raw TEXT", [])
            .map_err(|e| e.to_string())?;
    }
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    if version < 1 {
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for field in ["hostname", "forwarded_for", "ident", "auth_user", "timestamp", "request", "protocol"] {
            if tx.prepare(&format!("SELECT {field} FROM access_rows LIMIT 0")).is_err() {
                tx.execute(&format!("ALTER TABLE access_rows ADD COLUMN {field} TEXT"), []).map_err(|e| e.to_string())?;
            }
        }
        {
            let mut select = tx.prepare("SELECT id, raw FROM access_rows WHERE raw IS NOT NULL").map_err(|e| e.to_string())?;
            let mut rows = select.query([]).map_err(|e| e.to_string())?;
            let mut update = tx.prepare("UPDATE access_rows SET hostname = ?1, forwarded_for = ?2, ident = ?3, auth_user = ?4, timestamp = ?5, request = ?6, protocol = ?7 WHERE id = ?8").map_err(|e| e.to_string())?;
            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let id: i64 = row.get(0).map_err(|e| e.to_string())?;
                let raw: String = row.get(1).map_err(|e| e.to_string())?;
                if let Some(parsed) = crate::parse::parse_access_line(&raw) {
                    update.execute(rusqlite::params![parsed.hostname, parsed.forwarded_for, parsed.ident, parsed.auth_user, parsed.timestamp, parsed.request, parsed.protocol, id]).map_err(|e| e.to_string())?;
                }
            }
        }
        tx.pragma_update(None, "user_version", 1).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Registers a SQLite `regexp(text, pattern)` scalar function backed by the
/// `regex` crate, so regex query-builder conditions can be pushed into SQL
/// instead of filtering every row in Rust. The regexes are precompiled once
/// per query and shared across every source connection, so a multi-million-row
/// scan reuses them instead of recompiling on each row.
pub fn register_regexp_fn(
    conn: &mut Connection,
    regexes: Arc<HashMap<String, regex::Regex>>,
) -> Result<(), String> {
    conn.create_scalar_function(
        "regexp",
        2,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        move |ctx: &Context| {
            let text: &str = ctx.get_raw(0).as_str().unwrap_or_default();
            let pattern: &str = ctx.get_raw(1).as_str().unwrap_or_default();
            let matched = regexes.get(pattern).map(|re| re.is_match(text)).unwrap_or(false);
            Ok(matched)
        },
    )
    .map_err(|e| e.to_string())
}

pub fn delete_source_db(source_id: &str) -> Result<(), String> {
    let path = source_db_path(source_id)?;
    for ext in ["", "-wal", "-shm"] {
        let p = if ext.is_empty() {
            path.clone()
        } else {
            Path::new(&format!("{}{}", path.display(), ext)).to_path_buf()
        };
        if p.exists() {
            std::fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

#[test]
    fn migration_backfills_all_fields_and_preserves_rows_and_cursors() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE access_rows (id INTEGER PRIMARY KEY, raw TEXT); CREATE TABLE cursors (byte_offset INTEGER); INSERT INTO cursors VALUES (1234);").unwrap();
        let raw = r#"192.0.2.1 ident alice [15/Sep/2026:00:00:08 -0400] "GET /test?q=1 HTTP/1.1" 200 25 example.com "-" "Browser" "198.51.100.1, 192.0.2.2""#;
        conn.execute("INSERT INTO access_rows VALUES (42, ?1)", [raw]).unwrap();
        migrate(&conn).unwrap();
        migrate(&conn).unwrap();
        let values: Vec<String> = conn.query_row("SELECT hostname, forwarded_for, ident, auth_user, timestamp, request, protocol FROM access_rows WHERE id = 42", [], |row| (0..7).map(|i| row.get(i)).collect()).unwrap();
        assert_eq!(values, ["example.com", "198.51.100.1, 192.0.2.2", "ident", "alice", "15/Sep/2026:00:00:08 -0400", "GET /test?q=1 HTTP/1.1", "HTTP/1.1"]);
assert_eq!(conn.query_row("SELECT COUNT(*) FROM access_rows", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
        assert_eq!(conn.query_row("SELECT byte_offset FROM cursors", [], |r| r.get::<_, i64>(0)).unwrap(), 1234);
    }

    #[test]
    fn regexp_function_filters_rows_in_sql() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE t (path TEXT);
             INSERT INTO t VALUES ('/a'), ('/?url=http://169.254.169.254/latest'), ('/?url=https://example.com/'), ('/c');",
        )
        .unwrap();
        let pattern = "169\\.254|localhost|url=https?://";
        let mut map = HashMap::new();
        map.insert(
            pattern.to_string(),
            regex::RegexBuilder::new(pattern).case_insensitive(true).build().unwrap(),
        );
        register_regexp_fn(&mut conn, Arc::new(map)).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t WHERE regexp(path, ?1)", [pattern], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }
}
