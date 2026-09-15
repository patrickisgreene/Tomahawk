<script setup>
import SourcesPanel from "./SourcesPanel.vue";
import ThroughputPanel from "./ThroughputPanel.vue";
import TopTalkersPanel from "./TopTalkersPanel.vue";
import LiveTailPanel from "./LiveTailPanel.vue";
import BottomDock from "./BottomDock.vue";
import StatusMixPanel from "./StatusMixPanel.vue";
import InspectorPanel from "./InspectorPanel.vue";
</script>

<template>
  <div class="main">
    <div class="col-left">
      <SourcesPanel />
      <div class="splitter horiz">···</div>
      <ThroughputPanel />
      <div class="splitter horiz">···</div>
      <TopTalkersPanel />
    </div>

    <div class="splitter vert">···</div>

    <div class="col-mid">
      <LiveTailPanel />
      <div class="splitter horiz">···</div>
      <div class="col-mid-bottom">
        <BottomDock />
        <div class="splitter vert">···</div>
        <StatusMixPanel />
      </div>
    </div>

    <div class="splitter vert">···</div>

    <InspectorPanel />
  </div>
</template>
