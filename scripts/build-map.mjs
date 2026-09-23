// Generates src/data/world-map.json for the Outreach map: the world as a grid of dots (Natural Earth land, public domain,
// minus lakes from OpenStreetMap via @geo-maps/earth-lakes-10km, ODbL: credited on the page), plus a finer grid for each
// region the map can zoom into (clusters of pins from src/data/places.json, nested where a cluster is still crowded).
// Run by hand after adding a place: node scripts/build-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoContains, geoBounds } from 'd3-geo';
import { project, zoomTree, MAP_W, MAP_H } from '../src/lib/geo.mjs';

const require = createRequire(import.meta.url);
const land110 = feature(require('world-atlas/land-110m.json'), require('world-atlas/land-110m.json').objects.land);
const land50 = feature(require('world-atlas/land-50m.json'), require('world-atlas/land-50m.json').objects.land);
const lakes = require('@geo-maps/earth-lakes-10km')();
const onLand = (land, ll) => geoContains(land, ll) && !geoContains(lakes, ll);
const places = JSON.parse(readFileSync(new URL('../src/data/places.json', import.meta.url), 'utf8'));

// Inverse of the projection by bisection is overkill; sample in lon/lat and project instead.
// Zero-length subpaths with round line caps draw as dots; relative moves keep the string short.
function gridDots(land, lonStep, latStep, box, dp = 0) {
  const out = []; let px = 0, py = 0; const f = 10 ** dp;
  let range = [-180, 180, -58, 84];
  if (box) { // find the lon/lat window that covers the box, then only walk that
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (let lat = -58; lat <= 84; lat += 0.25) for (let lon = -180; lon < 180; lon += 0.25) {
      const [x, y] = project(lon, lat);
      if (x < box[0] || x > box[0] + box[2] || y < box[1] || y > box[1] + box[3]) continue;
      lo = [Math.min(lo[0], lon), Math.min(lo[1], lat)]; hi = [Math.max(hi[0], lon), Math.max(hi[1], lat)];
    }
    range = [lo[0] - 0.5, hi[0] + 0.5, lo[1] - 0.5, hi[1] + 0.5];
    land = clip(land, range);
  }
  for (let lat = range[2]; lat <= range[3]; lat += latStep) for (let lon = range[0]; lon < range[1]; lon += lonStep) {
    let [x, y] = project(lon, lat); x = Math.round(x * f) / f; y = Math.round(y * f) / f;
    if (box && (x < box[0] || x > box[0] + box[2] || y < box[1] || y > box[1] + box[3])) continue;
    if (!onLand(land, [lon, lat])) continue;
    out.push(out.length ? `m${+(x - px).toFixed(dp)} ${+(y - py).toFixed(dp)}h0` : `M${x} ${y}h0`); px = x; py = y;
  }
  return out.join('');
}
// Keep only the land polygons whose bounds touch the window (point-in-polygon on all of the 50m world is slow).
function clip(land, [lon0, lon1, lat0, lat1]) {
  const geoms = land.type === 'FeatureCollection' ? land.features.map((f) => f.geometry) : [land.geometry];
  const polys = geoms.flatMap((g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]));
  const keep = polys.filter((rings) => { const b = geoBounds({ type: 'Polygon', coordinates: rings }); return b[1][0] >= lon0 && b[0][0] <= lon1 && b[1][1] >= lat0 && b[0][1] <= lat1; });
  return { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: keep } };
}

const coarse = gridDots(land110, 1.9, 1.9);
const small = gridDots(land110, 3.6, 3.6); // sparser world for phone-width maps, where 1.9° dots would merge
const pins = Object.entries(places).filter(([k]) => !k.startsWith('_')).map(([name, [lat, lon]]) => ({ name, xy: project(lon, lat) }));
const zooms = zoomTree(pins.map((p) => p.xy)).map((z) => {
  const step = z.box[2] / 100 / 2.8; // ≈100 dots across the box; 2.8 viewBox units ≈ 1° of longitude at the equator
  return { box: z.box, names: z.members.map((i) => pins[i].name), d: gridDots(land50, step, step, z.box, 2) };
});
writeFileSync(new URL('../src/data/world-map.json', import.meta.url), JSON.stringify({ w: MAP_W, h: MAP_H, coarse, small, zooms }));
console.log(`[map] ${coarse.split('h0').length - 1} world dots (${small.split('h0').length - 1} small); ${zooms.length} zoom regions: ${zooms.map((z) => `${z.names.length} places / ${z.d.split('h0').length - 1} dots`).join(', ')}`);
