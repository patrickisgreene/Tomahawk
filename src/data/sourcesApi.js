// Thin wrappers around the Tauri commands that manage registered log
// sources (src-tauri/src/commands.rs). Mirrors logSource.js's pattern:
// isolate the isTauri() check here so the store/components don't need to
// care whether they're running in the desktop app or a plain browser dev
// server (where there's no filesystem to browse or config to persist).
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./logSource";

const NOT_AVAILABLE = "Only available when running inside the Tauri app.";

export async function listLocalDir(path) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("list_local_dir", { path: path ?? null });
}

export async function addSource(input) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("add_source", { input });
}

export async function removeSource(sourceId) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("remove_source", { sourceId });
}

export async function listSources() {
  if (!isTauri()) return [];
  return await invoke("list_sources");
}

export async function listQueryFields() {
  if (!isTauri()) return [];
  return await invoke("list_query_fields");
}
