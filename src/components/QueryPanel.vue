<script setup>
const heights = [22, 34, 28, 44, 38, 52, 46, 70, 100, 86, 62, 48, 40, 36, 30, 33];
function barColor(h, i) {
  if (i === 8) return "#e08a86";
  if (i === 9) return "#d9736f";
  return h > 60 ? "var(--color-accent-600)" : "var(--color-accent-800)";
}
</script>

<template>
  <div class="panel-fill">
    <div class="query-row">
      <i class="ph ph-caret-right" style="color:var(--color-neutral-600)"></i>
      <i class="ph ph-play" style="color:var(--color-accent-300)"></i>
      <i class="ph ph-stop" style="color:var(--color-neutral-600)"></i>
      <div class="sep"></div>
      <div class="chip txt">checkout 5xx hunt<span class="caret">▾</span></div>
      <div class="chip txt"><i class="ph ph-floppy-disk"></i>Save</div>
      <div class="query-meta">matched 3,418 of 1.2M · 214ms</div>
    </div>
    <div class="query-body">
      <div class="cond-row"><span class="cond-label">Where</span><div class="cond-field">status<span class="caret">▾</span></div><div class="cond-field">&gt;=<span class="caret">▾</span></div><div class="cond-value">400</div><i class="ph ph-x cond-x"></i></div>
      <div class="cond-row"><span class="cond-label and">and</span><div class="cond-field">path<span class="caret">▾</span></div><div class="cond-field">matches<span class="caret">▾</span></div><div class="cond-value">^/checkout/.*</div><i class="ph ph-x cond-x"></i></div>
      <div class="cond-row"><span class="cond-label and">and</span><div class="cond-field">upstream_us<span class="caret">▾</span></div><div class="cond-field">&gt;<span class="caret">▾</span></div><div class="cond-value" style="color:var(--color-neutral-400);border-color:var(--chrome-border-2)">500000</div><i class="ph ph-x cond-x"></i></div>
      <div class="cond-row" style="margin-top:2px">
        <button class="add-cond"><i class="ph ph-plus"></i>Add condition</button>
        <button class="edit-text"><i class="ph ph-brackets-curly"></i>Edit as text</button>
      </div>
      <div class="hist">
        <div class="hist-bars">
          <div v-for="(h, i) in heights" :key="i" :style="{ height: h + '%', background: barColor(h, i) }"></div>
        </div>
        <div class="hist-labels"><span>13:28</span><span>13:35</span><span>13:42</span></div>
      </div>
    </div>
  </div>
</template>
