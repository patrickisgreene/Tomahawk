// The seam between the UI and "where rows actually come from".
//
// The app works on a resync model (pull-on-demand, not a continuous stream):
// something asks `pull()` for whatever's new since last time. Outside Tauri
// (plain browser dev) that's the mock generator; inside Tauri it's the real
// `pull_new_rows` command, which tails whatever sources are registered in
// the user's config (see src-tauri/src/commands.rs) — nothing in src/store
// or src/components needs to know which one is running.
import { invoke } from "@tauri-apps/api/core";
import { makeLiveRow } from "./mock";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function mockPull() {
  const n = 1 + Math.floor(Math.random() * 3); // 1-3 new rows per resync, like a real tail would find
  return Array.from({ length: n }, () => makeLiveRow());
}

async function tauriPull(sourceId) {
  return await invoke("pull_new_rows", { sourceIds: sourceId ? [sourceId] : null });
}

/**
 * @returns {{ pull: (sourceId?: string) => Promise<object[]> }} pull() resolves to newly-arrived rows.
 * Passing a sourceId pulls just that one source (used for real per-source
 * sync progress) — the mock ignores it, since it has no real sources.
 */
export function createLogSource() {
  return { pull: isTauri() ? tauriPull : mockPull };
}

// pull()/pull_new_rows only ever returns bytes read *since the last call* —
// on a fresh launch the frontend has forgotten everything, but a file's
// tailing cursor is already at EOF from the previous session, so it would
// report nothing new forever. This loads what's already in the database so
// the tail view isn't stuck empty after a restart.
export async function loadRecentRows(limit) {
  if (!isTauri()) return [];
  return await invoke("load_recent_rows", { sourceIds: null, limit });
}
