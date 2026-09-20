use rusqlite::Connection;
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use crate::parse::parse_access_line;
use crate::types::AccessLogRow;

fn is_gzip(path: &Path) -> Result<bool, String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 2];
    match f.read_exact(&mut magic) {
        Ok(()) => Ok(magic == [0x1f, 0x8b]),
        Err(_) => Ok(false), // shorter than 2 bytes — can't be gzip
    }
}

struct Cursor {
    byte_offset: i64,
    done: bool,
}

fn load_cursor(conn: &Connection, file_path: &str) -> Cursor {
    conn.query_row(
        "SELECT byte_offset, done FROM cursors WHERE file_path = ?1",
        [file_path],
        |row| {
            Ok(Cursor {
                byte_offset: row.get(0)?,
                done: row.get::<_, i64>(1)? != 0,
            })
        },
    )
    .unwrap_or(Cursor {
        byte_offset: 0,
        done: false,
    })
}

fn save_cursor(conn: &Connection, file_path: &str, byte_offset: i64, size: i64, done: bool) -> Result<(), String> {
    conn.execute(
        "INSERT INTO cursors (file_path, byte_offset, size, mtime, done) VALUES (?1, ?2, ?3, 0, ?4)
         ON CONFLICT(file_path) DO UPDATE SET byte_offset = excluded.byte_offset, size = excluded.size, done = excluded.done",
        rusqlite::params![file_path, byte_offset, size, done as i64],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Reports whether a file's cursor is marked fully ingested (rotation /
/// gzip archives), so callers can surface that state in the UI without
/// duplicating the cursor lookup.
pub fn cursor_done(conn: &Connection, file_path: &str) -> bool {
    load_cursor(conn, file_path).done
}

/// Reads whatever access-log lines are new in `path` since the last
/// recorded cursor, parses them, batch-inserts them into `conn`, and
/// returns just the newly added rows (for live-tail display).
///
/// Plain files are tailed by real byte offset (resumable, cheap). Gzip
/// archives aren't cheaply seekable, so a `.gz` file is only ever fully
/// decompressed once — after that its cursor is marked `done` and it's
/// skipped entirely on future polls, since rotated archives never change.
pub fn ingest_access_file(conn: &mut Connection, source_id: &str, path: &Path) -> Result<Vec<AccessLogRow>, String> {
    let path_str = path.to_string_lossy().to_string();
    let mut cursor = load_cursor(conn, &path_str);
    // Older parsers silently consumed unsupported files. Retry those files
    // after an upgrade without duplicating any successfully imported rows.
    if cursor.byte_offset > 0 || cursor.done {
        let has_rows: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM access_rows WHERE file_path = ?1)",
            [&path_str], |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if !has_rows {
            cursor = Cursor { byte_offset: 0, done: false };
        }
    }
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let size = metadata.len() as i64;

    if cursor.done {
        return Ok(vec![]);
    }

    let gzip = is_gzip(path)?;
    let mut new_rows = Vec::new();
    let mut nonempty_lines = 0usize;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut insert = tx
            .prepare(
                "INSERT INTO access_rows (file_path, ts, ip, method, status, path, bytes, ms, referer, user_agent, raw, hostname, forwarded_for, ident, auth_user, timestamp, request, protocol)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            )
            .map_err(|e| e.to_string())?;

        let mut push_row = |insert: &mut rusqlite::Statement, parsed: crate::parse::ParsedAccessLine, raw: String| -> Result<(), String> {
            insert
                .execute(rusqlite::params![
                    path_str, parsed.ts, parsed.ip, parsed.method, parsed.status, parsed.path, parsed.bytes, parsed.ms,
                    parsed.referer, parsed.user_agent, raw, parsed.hostname, parsed.forwarded_for, parsed.ident, parsed.auth_user, parsed.timestamp, parsed.request, parsed.protocol
                ])
                .map_err(|e| e.to_string())?;
            let rowid = tx.last_insert_rowid();
            new_rows.push(AccessLogRow {
                hostname: parsed.hostname,
                forwarded_for: parsed.forwarded_for,
                ident: parsed.ident,
                auth_user: parsed.auth_user,
                timestamp: parsed.timestamp,
                request: parsed.request,
                protocol: parsed.protocol,

                id: format!("{source_id}:{rowid}"),
                file_path: path_str.clone(),
                ts: parsed.ts,
                time: parsed.time,
                ip: parsed.ip,
                method: parsed.method,
                status: parsed.status,
                path: parsed.path,
                bytes: parsed.bytes,
                ms: parsed.ms,
                referer: parsed.referer,
                user_agent: parsed.user_agent,
                raw,
                tags: Vec::new(), // freshly ingested row — can't have tags yet
            });
            Ok(())
        };

        if gzip {
            let file = File::open(path).map_err(|e| e.to_string())?;
            let decoder = flate2::read::GzDecoder::new(file);
            let reader = BufReader::new(decoder);
            let mut line_no: i64 = 0;
            for line in reader.lines() {
                let line = line.map_err(|e| e.to_string())?;
                line_no += 1;
                if line_no <= cursor.byte_offset {
                    continue; // already ingested on a prior (interrupted) pass
                }
                if let Some(parsed) = parse_access_line(&line) {
                    push_row(&mut insert, parsed, line)?;
                }
                nonempty_lines += 1;
            }
            drop(insert);
            save_cursor(&tx, &path_str, line_no, size, true)?;
        } else {
            let start_offset = if size < cursor.byte_offset { 0 } else { cursor.byte_offset };
            let mut file = File::open(path).map_err(|e| e.to_string())?;
            file.seek(SeekFrom::Start(start_offset as u64)).map_err(|e| e.to_string())?;
            let mut reader = BufReader::new(file);
            let mut offset = start_offset;
            loop {
                let mut line = String::new();
                let n = reader.read_line(&mut line).map_err(|e| e.to_string())?;
                if n == 0 {
                    break;
                }
                if !line.ends_with('\n') {
                    // Partial line — the writer hasn't flushed the newline
                    // yet. Leave it for next time rather than parsing a
                    // truncated line.
                    break;
                }
                offset += n as i64;
                line.truncate(line.trim_end().len());
                if !line.trim().is_empty() { nonempty_lines += 1; }
                if let Some(parsed) = parse_access_line(&line) {
                    push_row(&mut insert, parsed, line)?;
                }
            }
            drop(insert);
            save_cursor(&tx, &path_str, offset, size, false)?;
        }
    }
    if nonempty_lines > 0 && new_rows.is_empty() {
        return Err(format!("{path_str}: none of {nonempty_lines} log lines matched a supported access log format"));
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(new_rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::db::SCHEMA).unwrap();
        conn
    }

    #[test]
    fn recovers_empty_import_without_reimporting_successful_rows() {
        let path = std::env::temp_dir().join(format!("tomahawk-{}.log", uuid::Uuid::new_v4()));
        let line = "192.0.2.1 - - [15/Sep/2026:00:00:08 -0400] \"GET / HTTP/1.1\" 200 25 example.com \"-\" \"Browser\" \"-\"\n";
        std::fs::write(&path, line).unwrap();
        let mut conn = database();
        let file_path = path.to_string_lossy();
        save_cursor(&conn, &file_path, line.len() as i64, line.len() as i64, false).unwrap();
        assert_eq!(ingest_access_file(&mut conn, "test", &path).unwrap().len(), 1);
        assert!(ingest_access_file(&mut conn, "test", &path).unwrap().is_empty());
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn unsupported_file_reports_error_without_advancing_cursor() {
        let path = std::env::temp_dir().join(format!("tomahawk-{}.log", uuid::Uuid::new_v4()));
        std::fs::write(&path, "unsupported log format\n").unwrap();
        let mut conn = database();
        let error = ingest_access_file(&mut conn, "test", &path).unwrap_err();
        assert!(error.contains("none of 1 log lines"));
        assert_eq!(load_cursor(&conn, &path.to_string_lossy()).byte_offset, 0);
        std::fs::remove_file(path).unwrap();
    }

    // Local diagnostic: keeps the user\'s log out of the repository fixtures.
    #[test]
    #[ignore = "requires TOMAHAWK_TEST_LOG pointing to a local access log"]
    fn imports_local_log() {
        let path = std::path::PathBuf::from(std::env::var("TOMAHAWK_TEST_LOG").unwrap());
        let mut conn = database();
        let started = std::time::Instant::now();
        let rows = ingest_access_file(&mut conn, "test", &path).unwrap();
        let input = File::open(&path).unwrap();
        let reader: Box<dyn Read> = if is_gzip(&path).unwrap() {
            Box::new(flate2::read::GzDecoder::new(input))
        } else {
            Box::new(input)
        };
        let lines = BufReader::new(reader).lines().count();
        println!("Imported {} of {lines} lines in {:?}", rows.len(), started.elapsed());
        assert_eq!(rows.len(), lines);
        for row in &rows {
            assert!(!row.hostname.is_empty());
            assert_eq!(row.forwarded_for, "-");
            assert!(!row.timestamp.is_empty());
            let stored: String = conn.query_row("SELECT hostname FROM access_rows WHERE id = ?1", [row.id.strip_prefix("test:").unwrap()], |r| r.get(0)).unwrap();
            assert_eq!(stored, row.hostname);
        }
        assert!(ingest_access_file(&mut conn, "test", &path).unwrap().is_empty());
    }
}
