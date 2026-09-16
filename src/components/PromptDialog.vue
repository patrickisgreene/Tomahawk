<script setup>
import { ref, onMounted } from "vue";
const props = defineProps({
  title: { type: String, default: "" },
  label: { type: String, default: "" },
  initial: { type: String, default: "" },
  confirmLabel: { type: String, default: "Save" },
});
const emit = defineEmits(["confirm", "cancel"]);
const value = ref(props.initial);
const input = ref(null);

onMounted(() => {
  input.value?.focus();
  input.value?.select();
});

function confirm() {
  if (value.value.trim()) emit("confirm", value.value.trim());
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-card" style="width:380px">
      <div class="modal-titlebar">
        <i class="ph ph-pencil-line" style="color:var(--color-accent-400)"></i>
        <span>{{ title }}</span>
        <i class="ph ph-x" :style="{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--color-neutral-500)' }" @click="emit('cancel')"></i>
      </div>
      <div class="modal-body" style="padding:16px;overflow:visible;gap:8px">
        <div class="field-label">{{ label }}</div>
        <div class="cond-value" style="width:100%;height:28px">
          <input
            ref="input"
            :value="value"
            @input="value = $event.target.value"
            @keydown.enter="confirm"
            @keydown.esc="emit('cancel')"
            style="background:none;border:none;color:inherit;font:inherit;outline:none;width:100%"
          >
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-plain" @click="emit('cancel')">Cancel</button>
        <button class="chip accent" :disabled="!value.trim()" :style="value.trim() ? {} : { opacity: 0.5, cursor: 'default' }" @click="confirm">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>