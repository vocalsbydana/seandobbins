// Natural Earth projection into the map's SVG viewBox. Shared by the build-time dot generator and the page.
const PI = Math.PI;
const XMAX = PI * 0.8707;               // projected x at longitude 180
const YMAX = 1.4224;                    // projected y at latitude 90
export const MAP_W = 1000;
export const SCALE = MAP_W / (2 * XMAX);
export const MAP_H = Math.round(2 * YMAX * SCALE);

/** [lon, lat] in degrees → [x, y] in viewBox units. */
export function project(lon, lat) {
  const l = (lon * PI) / 180, p = (lat * PI) / 180, p2 = p * p, p4 = p2 * p2;
  const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
  const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
  return [(x + XMAX) * SCALE, (YMAX - y) * SCALE];
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
  let w = Math.max(minW, (Math.max(...xs) - Math.min(...xs)) * 1.9), h = w * (MAP_H / MAP_W);
  const need = (Math.max(...ys) - Math.min(...ys)) * 1.9; if (need > h) { h = need; w = h * (MAP_W / MAP_H); }
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
export function zoomTree(points, { radius = 26, minW = 70, maxDepth = 2 } = {}) {
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
