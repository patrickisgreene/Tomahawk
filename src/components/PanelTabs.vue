<script setup>
defineProps({
  tabs: { type: Array, required: true }, // [{ id, label }]
  active: { type: String, required: true },
});
const emit = defineEmits(["select"]);
</script>

<template>
  <div class="talker-tabs">
    <span v-for="t in tabs" :key="t.id" :class="{ active: active === t.id }" @click="emit('select', t.id)">{{ t.label }}</span>
  </div>
</template>
