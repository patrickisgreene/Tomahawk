use flate2::read::GzDecoder;
use maxminddb::geoip2;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::data_dir;
use crate::types::{GeoipLookup, GeoipStatus};

const PROVIDER: &str = "DB-IP Lite";
const ATTRIBUTION: &str = "IP Geolocation by DB-IP";
const DOWNLOAD_URL: &str = "https://dbip.mirror.framasoft.org/files/dbip-country-lite-latest.mmdb.gz";

#[derive(Debug, Deserialize)]
struct CountryNames {
    names: Option<HashMap<String, String>>,
    iso_code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CountryRecord {
    country: Option<CountryNames>,
}

pub fn status() -> Result<GeoipStatus, String> {
    let path = db_path()?;
    let meta = fs::metadata(&path).ok();
    Ok(GeoipStatus {
        installed: meta.is_some(),
        provider: PROVIDER.to_string(),
        attribution: ATTRIBUTION.to_string(),
        path: meta.as_ref().map(|_| path.to_string_lossy().to_string()),
        size: meta.as_ref().map(|m| m.len()),
        modified: meta.and_then(|m| modified_ms(m.modified().ok()?)),
    })
}

pub fn download_database() -> Result<GeoipStatus, String> {
    let response = reqwest::blocking::get(DOWNLOAD_URL).map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("GeoIP download failed: HTTP {}", response.status()));
    }

    let bytes = response.bytes().map_err(|e| e.to_string())?;
    let mut decoder = GzDecoder::new(bytes.as_ref());
    let mut mmdb = Vec::new();
    decoder.read_to_end(&mut mmdb).map_err(|e| e.to_string())?;

    let path = db_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("mmdb.tmp");
    fs::write(&tmp, mmdb).map_err(|e| e.to_string())?;
    fs::rename(tmp, path).map_err(|e| e.to_string())?;
    status()
}

pub fn lookup(ip: String) -> Result<GeoipLookup, String> {
    let parsed: IpAddr = ip.parse().map_err(|e| format!("invalid IP address: {e}"))?;
    if is_local_ip(parsed) {
        return Ok(GeoipLookup {
            ip,
            status: "local".to_string(),
            country_code: None,
            country_name: None,
            provider: PROVIDER.to_string(),
            attribution: ATTRIBUTION.to_string(),
        });
    }

    if !db_path()?.exists() {
        download_database()?;
    }

    let reader = maxminddb::Reader::open_readfile(db_path()?).map_err(|e| e.to_string())?;
    let record = reader.lookup::<CountryRecord>(parsed);
    let country = match record {
        Ok(country) => country.country,
        Err(maxminddb::MaxMindDBError::AddressNotFoundError(_)) => None,
        Err(_) => {
            let fallback = reader.lookup::<geoip2::Country>(parsed).ok().and_then(|c| c.country);
            return Ok(GeoipLookup {
                ip,
                status: fallback.as_ref().and_then(|c| c.iso_code).map(|_| "ok").unwrap_or("not_found").to_string(),
                country_code: fallback.as_ref().and_then(|c| c.iso_code.map(str::to_string)),
                country_name: fallback
                    .as_ref()
                    .and_then(|c| c.names.as_ref())
                    .and_then(|names| names.get("en"))
                    .map(|name| name.to_string()),
                provider: PROVIDER.to_string(),
                attribution: ATTRIBUTION.to_string(),
            });
        }
    };

    Ok(GeoipLookup {
        ip,
        status: country.as_ref().and_then(|c| c.iso_code.as_ref()).map(|_| "ok").unwrap_or("not_found").to_string(),
        country_code: country.as_ref().and_then(|c| c.iso_code.clone()),
        country_name: country
            .as_ref()
            .and_then(|c| c.names.as_ref())
            .and_then(|names| names.get("en").cloned()),
        provider: PROVIDER.to_string(),
        attribution: ATTRIBUTION.to_string(),
    })
}

fn db_path() -> Result<PathBuf, String> {
    Ok(data_dir()?.join("geoip").join("dbip-country-lite.mmdb"))
}

fn modified_ms(time: SystemTime) -> Option<i64> {
    let duration = time.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as i64)
}

pub(crate) fn is_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_documentation()
                || ip == Ipv4Addr::UNSPECIFIED
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || matches!(ip.segments()[0] & 0xfe00, 0xfc00)
                || matches!(ip.segments()[0] & 0xffc0, 0xfe80)
                || is_documentation_v6(ip)
        }
    }
}

fn is_documentation_v6(ip: Ipv6Addr) -> bool {
    ip.segments()[0] == 0x2001 && ip.segments()[1] == 0x0db8
}
