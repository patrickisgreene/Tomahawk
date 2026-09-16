<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: "" },
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: "Select option" },
  disabled: { type: Boolean, default: false },
  align: { type: String, default: "left" },
  menuWidth: { type: Number, default: 0 },
  buttonClass: { type: [String, Array, Object], default: "" },
});
defineOptions({ inheritAttrs: false });
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const activeIndex = ref(0);
const trigger = ref(null);
const menuStyle = ref({});

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue) || props.options[0]);
const enabledOptions = computed(() => props.options.filter((option) => !option.disabled));

function syncActiveIndex() {
  const i = props.options.findIndex((option) => option.value === props.modelValue && !option.disabled);
  activeIndex.value = i >= 0 ? i : Math.max(0, props.options.findIndex((option) => !option.disabled));
}

function positionMenu() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const width = Math.max(props.menuWidth || 0, rect.width, 120);
  const left = props.align === "right" ? rect.right - width : rect.left;
  menuStyle.value = {
    top: `${rect.bottom + 5}px`,
    left: `${Math.max(6, Math.min(left, window.innerWidth - width - 6))}px`,
    width: `${width}px`,
  };
}

function close() {
  open.value = false;
  document.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("resize", positionMenu);
  window.removeEventListener("scroll", positionMenu, true);
}

function onPointerDown(event) {
  if (trigger.value?.contains(event.target)) return;
  if (event.target?.closest?.(".app-select-menu")) return;
  close();
}

async function toggle() {
  if (props.disabled) return;
  if (open.value) return close();
  syncActiveIndex();
  open.value = true;
  await nextTick();
  positionMenu();
  setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
  window.addEventListener("resize", positionMenu);
  window.addEventListener("scroll", positionMenu, true);
}

function selectOption(option) {
  if (option.disabled) return;
  emit("update:modelValue", option.value);
  close();
}

function move(delta) {
  if (!open.value) return;
  const current = props.options[activeIndex.value];
  const enabledIndex = Math.max(0, enabledOptions.value.findIndex((option) => option.value === current?.value));
  const next = enabledOptions.value[(enabledIndex + delta + enabledOptions.value.length) % enabledOptions.value.length];
  activeIndex.value = props.options.findIndex((option) => option.value === next.value);
}

function onKeydown(event) {
  if (event.key === "Escape") {
    close();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!open.value) toggle();
    else move(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!open.value) toggle();
    else move(-1);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (!open.value) toggle();
    else selectOption(props.options[activeIndex.value]);
  }
}

watch(() => props.modelValue, syncActiveIndex);
onBeforeUnmount(close);
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="chip app-select"
    :class="[buttonClass, { open, disabled }]"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :aria-expanded="open"
    aria-haspopup="listbox"
    v-bind="$attrs"
    @click="toggle"
    @keydown="onKeydown"
  >
    <span class="app-select-label">{{ selectedOption?.label ?? "" }}</span>
    <i class="ph ph-caret-down"></i>
  </button>
  <Teleport to="body">
    <div v-if="open" class="app-select-menu" :style="menuStyle" role="listbox" @click.stop>
      <button
        v-for="(option, i) in options"
        :key="String(option.value)"
        type="button"
        class="app-select-option"
        :class="{ active: option.value === modelValue, focused: i === activeIndex, disabled: option.disabled }"
        :disabled="option.disabled"
        role="option"
        :aria-selected="option.value === modelValue"
        @mouseenter="activeIndex = i"
        @click="selectOption(option)"
      >
        <span>{{ option.label }}</span>
        <i v-if="option.value === modelValue" class="ph ph-check"></i>
      </button>
    </div>
  </Teleport>
</template>
