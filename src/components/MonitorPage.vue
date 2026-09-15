<script setup>
import Dock from "./Dock.vue";
</script>

<template>
  <div class="main">
    <div class="col-left">
      <Dock dock-id="sources" />
      <div class="splitter horiz">···</div>
      <Dock dock-id="throughput" />
      <div class="splitter horiz">···</div>
      <Dock dock-id="talkers" />
    </div>
    <div class="splitter vert">···</div>
    <div class="col-mid">
      <Dock dock-id="stream" />
      <div class="splitter horiz">···</div>
      <div class="col-mid-bottom">
        <Dock dock-id="bottom" />
        <div class="splitter vert">···</div>
        <Dock dock-id="mix">
          <template #trailing>
            <div style="margin-left:auto;display:flex;gap:6px;color:var(--color-neutral-600);font-size:11px">
              <i class="ph ph-arrows-out-line-horizontal"></i><i class="ph ph-pause"></i>
            </div>
          </template>
        </Dock>
      </div>
    </div>
    <div class="splitter vert">···</div>
    <Dock dock-id="inspector" />
  </div>
</template>
