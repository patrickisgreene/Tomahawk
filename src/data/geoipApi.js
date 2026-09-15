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
