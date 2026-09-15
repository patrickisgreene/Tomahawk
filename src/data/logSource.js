// The seam between the UI and "where rows actually come from".
//
// The app works on a resync model (pull-on-demand, not a continuous stream):
// something asks `pull()` for whatever's new since last time. Today that's
// the mock generator, called on a timer the store owns. Once the Rust side
// exists, add a second implementation here (e.g. a Tauri command that reads
// the file's new bytes since the last read offset) and switch on
// `isTauri()` — nothing in src/store or src/components needs to change,
// they only ever call `createLogSource()` and `.pull()`.
import { makeLiveRow } from "./mock";

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function mockPull() {
  const n = 1 + Math.floor(Math.random() * 3); // 1-3 new rows per resync, like a real tail would find
  return Array.from({ length: n }, () => makeLiveRow());
}

/**
 * @returns {{ pull: () => object[] }} pull() returns newly-arrived rows
 */
export function createLogSource() {
  if (isTauri()) {
    // TODO: real Tauri source. Left unimplemented on purpose — wiring this
    // up means deciding the Rust-side command shape first. Falling back to
    // the mock for now rather than silently doing nothing.
    console.warn("[logSource] running inside Tauri but no native source is wired up yet — using the mock generator.");
  }
  return { pull: mockPull };
}
