// Generates src/data/world-map.json for the Outreach map: country outlines and land for the world (Natural Earth 110m,
// public domain, via world-atlas), plus a sharper layer for each region the map can zoom into (Natural Earth 50m
// countries, US state lines from us-atlas, and lakes from OpenStreetMap via @geo-maps/earth-lakes-10km, ODbL, credited
// on the page). Zoom regions are the clusters of pins from src/data/places.json (nested where still crowded).
// Run by hand after adding a place: node scripts/build-map.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature, mesh } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoArea } from 'd3-geo';
import { project, zoomTree, MAP_W, MAP_H, SCALE, WORLD } from '../src/lib/geo.mjs';

const require = createRequire(import.meta.url);
const c110 = require('world-atlas/countries-110m.json'), c50 = require('world-atlas/countries-50m.json'), c10 = require('world-atlas/countries-10m.json'), us = require('us-atlas/states-10m.json');
const lakesAll = require('@geo-maps/earth-lakes-10km')(), lakesFine = require('@geo-maps/earth-lakes-1km')();
// Some OSM polygons wind the wrong way, which makes geoArea report the rest of the sphere; take the smaller side.
const area = (g) => { const a = geoArea(g); return Math.min(a, 4 * Math.PI - a); };
const polys = (gc) => gc.geometries.flatMap((g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).map((c) => ({ type: 'Polygon', coordinates: c })));
const bigLakes = (gc, min) => ({ type: 'GeometryCollection', geometries: polys(gc).filter((g) => area(g) > min) });
const lakesWorld = bigLakes(lakesAll, 2.5e-4), lakesZoom = bigLakes(lakesAll, 2e-5), lakesClose = bigLakes(lakesFine, 5e-6); // ≈10,000 / 800 / 200 km² and up
const places = JSON.parse(readFileSync(new URL('../src/data/places.json', import.meta.url), 'utf8'));

// Same Natural Earth projection as src/lib/geo.mjs (d3's raw projection is the identical formula), so pins line up.
const projection = geoNaturalEarth1().scale(SCALE).translate([MAP_W / 2, MAP_H / 2]);
const draw = (geometry, box, digits = 1) => {
  projection.clipExtent(box ? [[box[0], box[1]], [box[0] + box[2], box[1] + box[3]]] : null);
  return geoPath(projection).digits(digits)(geometry) || '';
};
const layer = (countries, lakes, box, digits) => ({
  land: draw(feature(countries, countries.objects.land), box, digits),
  borders: draw(mesh(countries, countries.objects.countries, (a, b) => a !== b), box, digits),
  lakes: draw(lakes, box, digits),
});

const world = layer(c110, lakesWorld, null, 1);
const pins = Object.entries(places).filter(([k]) => !k.startsWith('_')).map(([name, [lat, lon]]) => ({ name, xy: project(lon, lat) }));
const tree = zoomTree(pins.map((p) => p.xy));
const depth = (z) => (z.parent ? 1 + depth(tree.find((p) => p.id === z.parent)) : 1);
const zooms = tree.map((z) => ({
  box: z.box, names: z.members.map((i) => pins[i].name),
  ...(depth(z) >= 2 ? layer(c10, lakesClose, z.box, 2) : layer(c50, lakesZoom, z.box, 1)), // metro-scale zooms get the 10m coastline
  states: draw(mesh(us, us.objects.states, (a, b) => a !== b), z.box, depth(z) >= 2 ? 2 : 1),
}));
const out = { w: MAP_W, h: MAP_H, world: WORLD, ...world, zooms };
writeFileSync(new URL('../src/data/world-map.json', import.meta.url), JSON.stringify(out));
const kb = (s) => `${Math.round(s.length / 1024)} KB`;
console.log(`[map] world land ${kb(world.land)}, borders ${kb(world.borders)}, lakes ${kb(world.lakes)}; ${zooms.length} zoom regions: ${zooms.map((z) => `${z.names.length} places (${kb(z.land + z.borders + z.lakes + z.states)})`).join(', ')}`);
