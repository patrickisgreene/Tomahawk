mod commands;
mod config;
mod db;
mod fsbrowse;
mod geoip;
mod enrichment;
mod ingest;
mod parse;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::list_local_dir,
            commands::add_source,
            commands::remove_source,
            commands::list_sources,
            commands::get_source_stats,
            commands::query_rows,
            commands::list_domains,
            commands::list_query_fields,
            commands::geoip_status,
            commands::download_geoip_database,
            commands::lookup_geoip,
            commands::reverse_dns,
            commands::lookup_network_details,
            commands::pull_new_rows,
            commands::pull_file,
            commands::load_recent_rows,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
