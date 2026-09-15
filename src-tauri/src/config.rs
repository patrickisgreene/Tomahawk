use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn project_dirs() -> Result<ProjectDirs, String> {
    ProjectDirs::from("com", "vsteks", "tomahawk")
        .ok_or_else(|| "could not resolve a config directory for this platform".to_string())
}

pub fn config_dir() -> Result<PathBuf, String> {
    Ok(project_dirs()?.config_dir().to_path_buf())
}

pub fn data_dir() -> Result<PathBuf, String> {
    Ok(project_dirs()?.data_dir().to_path_buf())
}

/// Where a source's own SQLite database lives — one file per source, so
/// removing a source is just deleting this path.
pub fn source_db_path(source_id: &str) -> Result<PathBuf, String> {
    let dir = data_dir()?.join("sources");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{source_id}.db")))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceConfig {
    pub id: String,
    pub kind: SourceKind,
    pub label: String,
    /// File kind: path to the log file. Directory kind: the root directory.
    pub path: String,
    /// Directory kind only: glob matched against file names in the directory.
    #[serde(default = "default_pattern")]
    pub pattern: String,
    #[serde(default)]
    pub include_subfolders: bool,
}

fn default_pattern() -> String {
    "access.log*".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default = "default_resync_interval_ms")]
    pub resync_interval_ms: u64,
    #[serde(default)]
    pub sources: Vec<SourceConfig>,
}

fn default_version() -> u32 {
    1
}

fn default_resync_interval_ms() -> u64 {
    30000
}

impl Default for Config {
    fn default() -> Self {
        Config {
            version: default_version(),
            resync_interval_ms: default_resync_interval_ms(),
            sources: Vec::new(),
        }
    }
}

fn config_path() -> Result<PathBuf, String> {
    Ok(config_dir()?.join("config.json"))
}

pub fn load_config() -> Result<Config, String> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(Config::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn save_config(config: &Config) -> Result<(), String> {
    let path = config_path()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}
