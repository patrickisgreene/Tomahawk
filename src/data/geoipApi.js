import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./logSource";

export async function geoipStatus() {
  if (!isTauri()) return { installed: false, provider: "DB-IP Lite", attribution: "IP Geolocation by DB-IP" };
  return await invoke("geoip_status");
}

export async function downloadGeoipDatabase() {
  if (!isTauri()) return { installed: false, provider: "DB-IP Lite", attribution: "IP Geolocation by DB-IP" };
  return await invoke("download_geoip_database");
}

export async function lookupGeoip(ip) {
  if (!isTauri()) return null;
  return await invoke("lookup_geoip", { ip });
}

// Reverse DNS via the system resolver (dns-lookup on the Rust side).
export async function reverseDns(ip) {
  if (!isTauri()) return null;
  return await invoke("reverse_dns", { ip });
}

// City-level location + ASN data from the DB-IP free City/ASN databases.
export async function lookupNetworkDetails(ip) {
  if (!isTauri())
    return { city: null, region: null, latitude: null, longitude: null, asn: null, organization: null, errors: [] };
  return await invoke("lookup_network_details", { ip });
}
