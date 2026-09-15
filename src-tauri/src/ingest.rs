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
    let cursor = load_cursor(conn, &path_str);
    let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let size = metadata.len() as i64;

    if cursor.done {
        return Ok(vec![]);
    }

    let gzip = is_gzip(path)?;
    let mut new_rows = Vec::new();

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut insert = tx
            .prepare(
                "INSERT INTO access_rows (file_path, ts, ip, method, status, path, bytes, ms, referer, user_agent, raw)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            )
            .map_err(|e| e.to_string())?;

        let mut push_row = |insert: &mut rusqlite::Statement, parsed: crate::parse::ParsedAccessLine, raw: String| -> Result<(), String> {
            insert
                .execute(rusqlite::params![
                    path_str, parsed.ts, parsed.ip, parsed.method, parsed.status, parsed.path, parsed.bytes, parsed.ms,
                    parsed.referer, parsed.user_agent, raw
                ])
                .map_err(|e| e.to_string())?;
            let rowid = tx.last_insert_rowid();
            new_rows.push(AccessLogRow {
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
                if let Some(parsed) = parse_access_line(&line) {
                    push_row(&mut insert, parsed, line)?;
                }
            }
            drop(insert);
            save_cursor(&tx, &path_str, offset, size, false)?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(new_rows)
}
