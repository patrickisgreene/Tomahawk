use std::{collections::HashMap, net::IpAddr, sync::{Mutex, OnceLock, Arc}, time::{Duration, Instant}};
use serde::Serialize;
use maxminddb::{geoip2, Reader};

type DnsCache = HashMap<IpAddr, (Instant, String)>;
static DNS_CACHE: OnceLock<Mutex<DnsCache>> = OnceLock::new();
static DNS_SLOTS: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();

pub async fn reverse_dns(ip: String) -> Result<String, String> {
    let addr: IpAddr = ip.parse().map_err(|_| "Invalid IP address".to_string())?;
    let cache = DNS_CACHE.get_or_init(Default::default);
    if let Some((when, name)) = cache.lock().map_err(|e| e.to_string())?.get(&addr) {
        if when.elapsed() < Duration::from_secs(3600) { return Ok(name.clone()); }
    }
    let slots = DNS_SLOTS.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(2))).clone();
    let lookup = async move {
        let permit = slots.acquire_owned().await.map_err(|e| e.to_string())?;
        tauri::async_runtime::spawn_blocking(move || {
            // Keep the permit until the OS finishes, even if the UI times out.
            let _permit = permit;
            let name = dns_lookup::lookup_addr(&addr).map_err(|_| "No PTR record or DNS resolver unavailable".to_string())?;
            let name = name.trim_end_matches('.').to_string();
            if name == addr.to_string() || name.is_empty() { return Err("No PTR record".to_string()); }
            let mut cache = DNS_CACHE.get().unwrap().lock().map_err(|e| e.to_string())?;
            if cache.len() >= 1024 { cache.clear(); }
            cache.insert(addr, (Instant::now(), name.clone()));
            Ok(name)
        }).await.map_err(|e| e.to_string())?
    };
    tokio::time::timeout(Duration::from_secs(5), lookup).await.map_err(|_| "DNS lookup timed out".to_string())?
}

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkDetails {
    pub city: Option<String>,
    pub region: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub asn: Option<u32>,
    pub organization: Option<String>,
    pub errors: Vec<String>,
}

// Keep readers in memory; opening the city database per selection is expensive.
static READERS: OnceLock<Mutex<HashMap<String, Reader<Vec<u8>>>>> = OnceLock::new();

fn ensure_reader(kind: &str) -> Result<Reader<Vec<u8>>, String> {
    let directory = crate::config::data_dir()?.join("geoip");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let path = directory.join(format!("dbip-{kind}-lite.mmdb"));
    if !path.exists() {
        let month = chrono::Utc::now().format("%Y-%m").to_string();
        let url = format!("https://download.db-ip.com/free/dbip-{kind}-lite-{month}.mmdb.gz");
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(15)).timeout(Duration::from_secs(180))
            .build().map_err(|e| e.to_string())?;
        let response = client.get(url).send().and_then(|r| r.error_for_status()).map_err(|e| e.to_string())?;
        let mut decoder = flate2::read::GzDecoder::new(response);
        let tmp = directory.join(format!("dbip-{kind}-lite.mmdb.tmp"));
        let result = (|| {
            let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
            std::io::copy(&mut decoder, &mut file).map_err(|e| e.to_string())?;
            drop(file);
            Reader::open_readfile(&tmp).map_err(|e| e.to_string())?;
            std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
            Ok::<_, String>(())
        })();
        if result.is_err() { let _ = std::fs::remove_file(&tmp); }
        result?;
    }
    Reader::open_readfile(path).map_err(|e| e.to_string())
}

pub fn network_details(ip: String) -> Result<NetworkDetails, String> {
    let addr: IpAddr = ip.parse().map_err(|_| "Invalid IP address".to_string())?;
    let mut result = NetworkDetails::default();
    if crate::geoip::is_local_ip(addr) { return Ok(result); }
    let mut readers = READERS.get_or_init(Default::default).lock().map_err(|e| e.to_string())?;
    for kind in ["city", "asn"] {
        if !readers.contains_key(kind) {
            match ensure_reader(kind) {
                Ok(reader) => { readers.insert(kind.to_string(), reader); }
                Err(error) => { result.errors.push(format!("{kind} database: {error}")); continue; }
            }
        }
        let reader = &readers[kind];
        if kind == "city" {
            match reader.lookup::<geoip2::City>(addr) {
                Ok(record) => {
                    result.city = record.city.and_then(|c| c.names).and_then(|n| n.get("en").map(|s| s.to_string()));
                    result.region = record.subdivisions.and_then(|s| s.into_iter().next()).and_then(|s| s.names).and_then(|n| n.get("en").map(|s| s.to_string()));
                    if let Some(location) = record.location {
                        result.latitude = location.latitude;
                        result.longitude = location.longitude;
                    }
                }
                Err(maxminddb::MaxMindDBError::AddressNotFoundError(_)) => {}
                Err(error) => result.errors.push(error.to_string()),
            }
        } else {
            match reader.lookup::<geoip2::Asn>(addr) {
                Ok(record) => {
                    result.asn = record.autonomous_system_number;
                    result.organization = record.autonomous_system_organization.map(str::to_string);
                }
                Err(maxminddb::MaxMindDBError::AddressNotFoundError(_)) => {}
                Err(error) => result.errors.push(error.to_string()),
            }
        }
    }
    Ok(result)
}
