import { onMounted, onUnmounted } from "vue";

// Fires `onOutside` on the first click anywhere once mounted. Attaching on
// the *next* tick (not immediately) means the very click that opened the
// popover doesn't also close it, since that click hasn't finished
// bubbling to `document` yet when this runs.
export function useClickOutside(onOutside) {
  function handler() {
    onOutside();
  }
  onMounted(() => {
    setTimeout(() => document.addEventListener("click", handler), 0);
  });
  onUnmounted(() => document.removeEventListener("click", handler));
}
