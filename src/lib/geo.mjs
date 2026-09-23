// Mercator projection into the map's SVG viewBox, cropped to 80°N–56°S (src/data/world-map.json, the OutreachMap
// component). Shared by the build-time outline generator (which uses d3's geoMercator with the same scale/translate)
// and the page, so pins land on the right spot.
const PI = Math.PI;
const XMAX = PI;                                          // projected x at longitude 180
const merc = (lat) => Math.log(Math.tan(PI / 4 + (lat * PI) / 360));
const YMAX = merc(84);                                    // projected y at the top of d3's default Mercator clip
export const MAP_W = 1000;
export const SCALE = MAP_W / (2 * XMAX);
export const MAP_H = Math.round(2 * YMAX * SCALE);
export const ORIGIN_Y = YMAX * SCALE;                       // exact y of the equator (d3 translate uses this, not MAP_H / 2)
/** The part of the projection the map shows: 80°N down to 56°S. [x, y, w, h] in viewBox units. */
export const WORLD = (() => { const top = Math.floor(project(0, 80)[1]), bottom = Math.ceil(project(0, -56)[1]); return [0, top, MAP_W, bottom - top]; })();

/** [lon, lat] in degrees → [x, y] in viewBox units. */
export function project(lon, lat) {
  return [((lon * PI) / 180 + XMAX) * SCALE, (YMAX - merc(Math.max(-84, Math.min(84, lat)))) * SCALE];
}

/** Group pins that would overlap at world scale. Returns arrays of indices. */
export function cluster(points, radius = 26) {
  const groups = []; const seen = new Set();
  points.forEach((p, i) => {
    if (seen.has(i)) return;
    const g = [i]; seen.add(i);
    for (let k = 0; k < g.length; k++) points.forEach((q, j) => {
      if (!seen.has(j) && Math.hypot(points[g[k]][0] - q[0], points[g[k]][1] - q[1]) < radius) { seen.add(j); g.push(j); }
    });
    groups.push(g);
  });
  return groups;
}

/** A zoom box (viewBox units) around a set of points, padded and kept at the map's aspect ratio. */
export function zoomBox(points, minW = 70) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  let w = Math.max(minW, (Math.max(...xs) - Math.min(...xs)) * 1.9), h = w * (WORLD[3] / WORLD[2]);
  const need = (Math.max(...ys) - Math.min(...ys)) * 1.9; if (need > h) { h = need; w = h * (WORLD[2] / WORLD[3]); }
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return [round(cx - w / 2), round(cy - h / 2), round(w), round(h)];
}
const round = (n) => Math.round(n * 100) / 100;

/** Look up a city from places.json; returns [lat, lon] or null (the file also carries a _comment key). */
export function placeOf(places, city) {
  const v = places[city];
  return Array.isArray(v) && v.length === 2 ? [Number(v[0]), Number(v[1])] : null;
}
/** Stable key for a place so entries in the same city share one pin. */
export function placeKey(places, city) { const ll = placeOf(places, city); return ll ? ll.join(',') : ''; }

/**
 * Zoom levels for a set of pins: clusters that would overlap at world scale become a zoom step, and clusters that
 * still overlap inside that step become a nested one (up to maxDepth). Flat list, parents before children:
 * { id, parent ('' = world), members (pin indices), box (viewBox), at (group pin position) }.
 */
export function zoomTree(points, { radius = 48, minW = 70, maxDepth = 3 } = {}) {
  const zooms = [];
  const walk = (idx, parent, scale, depth) => {
    const groups = cluster(idx.map((i) => points[i]), radius * scale).map((g) => g.map((k) => idx[k])).filter((g) => g.length > 1);
    for (const g of groups) {
      const pts = g.map((i) => points[i]), box = zoomBox(pts, minW * scale);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const at = [round((Math.max(...xs) + Math.min(...xs)) / 2), round((Math.max(...ys) + Math.min(...ys)) / 2)];
      const z = { id: `z${zooms.length}`, parent, members: g, box, at };
      zooms.push(z);
      if (depth < maxDepth) walk(g, z.id, box[2] / MAP_W, depth + 1);
    }
  };
  walk(points.map((_, i) => i), '', 1, 1);
  return zooms;
}
