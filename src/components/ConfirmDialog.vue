<script setup>
defineProps({
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  confirmLabel: { type: String, default: "Confirm" },
  danger: { type: Boolean, default: false },
});
const emit = defineEmits(["confirm", "cancel"]);
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-card" style="width:380px">
      <div class="modal-titlebar">
        <i class="ph ph-warning" :style="{ color: danger ? 'var(--st5)' : 'var(--color-accent-400)' }"></i>
        <span>{{ title }}</span>
        <i class="ph ph-x" :style="{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--color-neutral-500)' }" @click="emit('cancel')"></i>
      </div>
      <div class="modal-body" style="padding:16px;overflow:visible">
        <p style="margin:0;line-height:1.5;color:var(--color-text)">{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-plain" @click="emit('cancel')">Cancel</button>
        <button class="chip" :style="danger ? { background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--st5)', fontWeight: 500 } : {}" @click="emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>