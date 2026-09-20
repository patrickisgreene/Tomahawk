import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./logSource";

// Opens the WebView's Chromium DevTools — the app disables the native
// right-click menu everywhere (see App.vue), so this is how the custom
// context menus' "Inspect" item replaces what that menu used to offer.
export async function openDevtools() {
  if (!isTauri()) return;
  await invoke("open_devtools");
}

// Replaces the native context menu's "Share" item: triggers the real OS
// share sheet via the Web Share API (supported by WebView2/Chromium), with
// a clipboard copy as the fallback where sharing isn't available.
export async function shareText({ title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
    } catch (error) {
      // Respect a user-cancelled share sheet; only fall back to clipboard
      // when sharing itself was unavailable/failed.
      if (error?.name !== "AbortError") {
        try { await navigator.clipboard.writeText(text); } catch {}
      }
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard access can be denied by the OS/webview — nothing useful to do
  }
}
