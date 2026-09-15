<template>
  <div class="panel-fill">
    <div class="alerts-list">
      <div class="alert-row firing"><span class="dot" style="background:var(--st5)"></span><span class="title">5xx &gt; 0.3% · shop</span><span class="age">2m</span></div>
      <div class="alert-row warn"><span class="dot" style="background:var(--st4)"></span><span class="title">web-03 tail lag 4s</span><span class="age">6m</span></div>
      <div class="alert-row"><span class="dot" style="background:var(--color-neutral-600)"></span><span class="title" style="color:var(--color-neutral-500);font-weight:400">p95 &gt; 800ms · api</span><span class="age" style="color:var(--color-neutral-700)">ok</span></div>
    </div>
  </div>
</template>
