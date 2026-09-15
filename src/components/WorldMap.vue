<script setup>
// Dark-themed world map for the entry inspector. Renders Natural Earth land
// (110m, from the world-atlas package) through a d3-geo projection and marks
// the client's approximate city coordinate. Purely presentational — city
// coordinates are approximate and DB-IP never guarantees their accuracy.
import { computed } from "vue";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import landTopo from "world-atlas/land-110m.json";

const props = defineProps({
  lat: { type: Number, default: null },
  lon: { type: Number, default: null },
  label: { type: String, default: "" },
});

const WIDTH = 286;
const HEIGHT = 132;

// Land + graticule are static; build them once and reuse for every row.
const land = feature(landTopo, landTopo.objects.land);
const projection = geoNaturalEarth1().fitExtent(
  [
    [2, 2],
    [WIDTH - 2, HEIGHT - 2],
  ],
  land
);
const pathGen = geoPath(projection);
const landPath = pathGen(land);
const graticulePath = pathGen(geoGraticule10());

const marker = computed(() => {
  if (props.lat == null || props.lon == null) return null;
  const [x, y] = projection([props.lon, props.lat]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, visible: x >= 0 && x <= WIDTH && y >= 0 && y <= HEIGHT };
});
const coordsText = computed(() =>
  props.lat == null || props.lon == null ? "" : `${props.lat.toFixed(2)}, ${props.lon.toFixed(2)}`
);
const locText = computed(() => {
  const parts = [];
  if (props.label) parts.push(props.label);
  if (coordsText.value) parts.push(coordsText.value);
  return parts.join(" · ");
});
const ariaLabel = computed(() =>
  props.label || coordsText.value
    ? `World map — approximate client location ${locText.value}`
    : "World map — no location data"
);
</script>

<template>
  <div class="insp-map">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" :aria-label="ariaLabel">
      <path :d="graticulePath" class="map-graticule" />
      <path :d="landPath" class="map-land" />
      <template v-if="marker?.visible">
        <circle class="map-pulse" :cx="marker.x" :cy="marker.y" r="6" />
        <circle class="map-marker" :cx="marker.x" :cy="marker.y" r="2.4" />
      </template>
    </svg>
    <div class="insp-map-foot">
      <span v-if="marker" class="insp-map-loc">{{ locText }}</span>
      <span v-else class="insp-map-none">No city-level location data for this address</span>
      <span class="insp-map-attribution">IP Geolocation by DB-IP</span>
    </div>
  </div>
</template>