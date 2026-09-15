use directories::UserDirs;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use crate::types::{DirListing, FsEntry};

fn home_dir() -> Result<PathBuf, String> {
    UserDirs::new()
        .map(|d| d.home_dir().to_path_buf())
        .ok_or_else(|| "could not resolve the home directory".to_string())
}

fn looks_gzip(path: &Path) -> bool {
    if path.extension().and_then(|e| e.to_str()) == Some("gz") {
        return true;
    }
    let Ok(mut f) = File::open(path) else { return false };
    let mut magic = [0u8; 2];
    f.read_exact(&mut magic).map(|_| magic == [0x1f, 0x8b]).unwrap_or(false)
}

fn fmt_size(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit = 0;
    while size >= 1024.0 && unit < UNITS.len() - 1 {
        size /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{bytes} {}", UNITS[unit])
    } else {
        format!("{size:.1} {}", UNITS[unit])
    }
}

fn fmt_modified(metadata: &std::fs::Metadata) -> Option<String> {
    let modified = metadata.modified().ok()?;
    let datetime: chrono::DateTime<chrono::Local> = modified.into();
    Some(datetime.format("%Y-%m-%d %H:%M").to_string())
}

/// Lists a local directory for the Add Source dialog's File/Directory
/// browsers. `path` defaults to the user's home directory. Returns the
/// resolved absolute path alongside the entries so the caller can build
/// breadcrumbs without duplicating home-dir resolution.
pub fn list_local_dir(path: Option<String>) -> Result<DirListing, String> {
    let dir = match path {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => home_dir()?,
    };

    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("{}: {e}", dir.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue, // e.g. a broken symlink — skip rather than fail the whole listing
        };
        let name = entry.file_name().to_string_lossy().to_string();
        let kind = if metadata.is_dir() {
            "dir"
        } else if looks_gzip(&entry.path()) {
            "archive"
        } else {
            "file"
        };
        entries.push(FsEntry {
            name,
            kind: kind.to_string(),
            modified: fmt_modified(&metadata),
            size: if metadata.is_dir() { None } else { Some(fmt_size(metadata.len())) },
        });
    }

    entries.sort_by(|a, b| match (a.kind == "dir", b.kind == "dir") {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    let dir = std::fs::canonicalize(&dir).unwrap_or(dir);
    Ok(DirListing {
        path: dir.to_string_lossy().to_string(),
        entries,
    })
}
