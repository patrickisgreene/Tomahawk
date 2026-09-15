use rusqlite::Connection;
use std::path::Path;

use crate::config::source_db_path;

const SCHEMA: &str = "
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
  raw TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_ts ON access_rows(ts);
CREATE INDEX IF NOT EXISTS idx_access_status ON access_rows(status);

CREATE TABLE IF NOT EXISTS error_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  ts INTEGER NOT NULL,
  level TEXT NOT NULL,
  module TEXT,
  pid INTEGER,
  message TEXT NOT NULL
);

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
    Ok(())
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
