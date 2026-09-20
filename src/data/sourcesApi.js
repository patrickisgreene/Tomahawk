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

export async function setSourceHidden(sourceId, hidden) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("set_source_hidden", { sourceId, hidden });
}

export async function getSourceStats(sourceId) {
  if (!isTauri()) return null;
  return await invoke("get_source_stats", { sourceId });
}

/**
 * Runs the SQL-backed access-log query (search text, domain/source/window/
 * status/method filters and query-builder conditions are all applied against
 * the *entire* database, sorted by `sortBy` [a query field id, or "ts" for
 * the timestamp column], then a page is returned for the requested offset).
 * Resolves to { rows, total, universe }.
 */
export async function queryRows(filters, sortBy, sortDesc, offset, limit) {
  if (!isTauri()) return { rows: [], total: 0, universe: 0 };
  return await invoke("query_rows", { input: filters, sortBy, sortDesc, offset, limit });
}

/**
 * Distinct hostnames on disk for the domain filter dropdown — sourced from
 * the database, not the rows currently loaded in the frontend.
 */
export async function listDomains(sourceId) {
  if (!isTauri()) return [];
  return await invoke("list_domains", { sourceId: sourceId || null });
}

export async function listQueryFields() {
  if (!isTauri()) return [];
  return await invoke("list_query_fields");
}

/**
 * Distinct tags in use, for the Tag filter dropdown.
 */
export async function listTags(sourceId) {
  if (!isTauri()) return [];
  return await invoke("list_tags", { sourceId: sourceId || null });
}

/**
 * Adds/removes a tag on one row. Resolves to that row's full updated tag
 * list (sorted), so the store can replace its local copy in place.
 */
export async function addRowTag(rowId, tag) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("add_row_tag", { rowId, tag });
}

export async function removeRowTag(rowId, tag) {
  if (!isTauri()) throw new Error(NOT_AVAILABLE);
  return await invoke("remove_row_tag", { rowId, tag });
}
