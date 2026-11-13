#!/usr/bin/env node
// Research helper for 49_SITE_BOUNDARY_CHECK of the hospital research master (campus sites, Hospital 0.5.2; owner
// 2026-11-13 09:27 “ทำ campus boundary ให้ครอบคลุมทุกอาคารของแต่ละ รพ ที่เป็นกลุ่มอาคาร ในลักษณะเดียวกับที่เราทำแล้วกับ hotel”).
// Ported from CityMETER · Hotel (scripts/site-candidates.mjs, 0.3.8). Run from the root of a clone of this repo (Node 20+,
// no packages). It reads the buildings with the same code the demo map uses (js/massing.js, js/shell/mvt.js,
// js/shell/building-units.js, js/shell/building-join.js), so a point it writes stands inside a building the map draws.
// It writes nothing in data/ — the research sheet stays the record; outputs go to sites/ (git-ignored).
//
//   node scripts/site-candidates.mjs candidates <facility_id> [--reach 400] [--osm-buildings <file.geojson> --osm-date YYYY-MM-DD]
//       → sites/<facility_id>/candidates.json · candidates.csv · candidates.png (numbered buildings, north up, pin red)
//       Inside a CityMETER unit (data/building-units) the buildings are CityMETER Building V4 tiles, as the map draws them.
//       Elsewhere the map draws OpenStreetMap buildings (OpenFreeMap): --osm-buildings gives their outlines, read from a
//       dated OpenStreetMap extract (owner 2026-11-13 “สร้างเลย ครอบคลุมด้วย”); without it the helper stops there.
//   node scripts/site-candidates.mjs row <facility_id> (--site site.geojson [--add 3,7] [--drop 12] | --pick 1,2,5)
//       --source osm_polygon_auto|osm_polygon+site_layout|dol_parcels+site_layout|site_layout --evidence <https page>
//       [--main "…"] [--notes "…"] [--by "…"]
//       (osm_polygon_auto: an OpenStreetMap area of the facility's own — skill osm-area-site-join, class own — checked
//       automatically, other uses cut by rule (skill osm-site-national-run), no layout or imagery check, the OSM element page
//       as --evidence, --by "Claude (ตรวจอัตโนมัติ)"; a layout check later turns the row into osm_polygon+site_layout;
//       dol_parcels+site_layout: Department of Lands parcels read on LandsMaps / D-Value with the layout; site_layout: the
//       layout and imagery alone)
//       → sites/<facility_id>/row.json · picked.png and the row in sites/site_rows.csv (one row per facility_id)
//   node scripts/site-candidates.mjs check <facility_id> --points "lon,lat;lon,lat"
//       → which drawn building holds each point (a sheet row's buildings_in_boundary); exits 1 if one is outside
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {tilesForRegions, planCmRequests, shapeCmTile, roundingRadiusM, encloseOffsetM} from '../js/massing.js';
import {parseVectorTile} from '../js/shell/mvt.js';
import {zonesOf, zoneAt, cmTileUrl} from '../js/shell/building-units.js';
import {footprint, containsPoint, interiorOf} from '../js/shell/building-join.js';

const MAX_SITE_M = 600; // scripts/build-data.py SITE_MAX_M: a site building farther from the facility's point stops the build
const SOURCES = ['osm_polygon_auto', 'osm_polygon+site_layout', 'dol_parcels+site_layout', 'site_layout'];
const COLUMNS = ['venue_id', 'boundary_status', 'boundary_source', 'boundary_evidence_url', 'boundary_geojson',
  'buildings_in_boundary', 'main_building_note', 'checked_by', 'checked_on', 'notes'];
const [cmd, venue] = process.argv.slice(2);
const argv = process.argv.slice(4);
const opt = (k, d = '') => { const i = argv.indexOf(`--${k}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const ids = s => (s ? s.split(',').map(x => Number(x.trim())).filter(Number.isInteger) : []);
const fail = msg => { console.error(`STOP: ${msg}`); process.exit(1); };
if (!['candidates', 'row', 'check'].includes(cmd) || !venue) fail('usage: node scripts/site-candidates.mjs candidates|row|check <venue_id> [options]');
if (!existsSync('js/massing.js') || !existsSync('data/hospitals.json')) fail('run from the root of a clone of montri-th/hospital');

// The facility as the map shows it (data/hospitals.json, the published point).
const data = JSON.parse(readFileSync('data/hospitals.json', 'utf8'));
const row = data.cols.key.indexOf(venue);
if (row < 0) fail(`${venue} is not in data/hospitals.json`);
const lon0 = data.cols.lon[row], lat0 = data.cols.lat[row];
const facilityName = data.cols.name[row];
if (!Number.isFinite(lon0) || !Number.isFinite(lat0)) fail(`${venue} has no point on the map — leave its row todo`);
const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574;
const toM = ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky];
const toLL = ([x, y]) => [+(lon0 + x / kx).toFixed(6), +(lat0 + y / ky).toFixed(6)];
const dir = `sites/${venue}`;
mkdirSync(dir, {recursive: true});

if (cmd === 'candidates') await candidates();
else if (cmd === 'row') await makeRow();
else check();

function check() {
  if (!existsSync(`${dir}/candidates.json`)) fail(`run candidates for ${venue} first`);
  const cand = JSON.parse(readFileSync(`${dir}/candidates.json`, 'utf8')).candidates.map(c => ({...c, fp: footprint({key: c.cid, outer: c.outer, holes: c.holes})}));
  const pts = opt('points').split(/[;\s]+/).filter(Boolean).map(p => p.split(',').map(Number));
  if (!pts.length || pts.some(p => p.length !== 2 || !p.every(Number.isFinite))) fail('--points must be "lon,lat;lon,lat"');
  let outside = 0;
  const held = pts.map(p => { const c = cand.filter(b => containsPoint(b.fp, p)).map(b => b.cid); if (!c.length) outside++; return c; });
  pts.forEach((p, i) => console.log(`${p.join(',')} → ${held[i].length ? `building ${held[i].join(' + ')}` : 'OUTSIDE every drawn building'}`));
  console.log(`${pts.length - outside} of ${pts.length} points stand in a drawn building; ${new Set(held.flat()).size} buildings`);
  if (outside) process.exit(1);
}

async function candidates() {
  const reach = Math.min(MAX_SITE_M, Math.max(100, Number(opt('reach', 400)) || 400));
  const dLon = reach / kx, dLat = reach / ky;
  const ring = [[lon0 - dLon, lat0 - dLat], [lon0 + dLon, lat0 - dLat], [lon0 + dLon, lat0 + dLat], [lon0 - dLon, lat0 + dLat], [lon0 - dLon, lat0 - dLat]];
  const zones = readdirSync('data/building-units').filter(f => /^[A-Z]{3}\.json$/.test(f))
    .flatMap(f => zonesOf(JSON.parse(readFileSync(`data/building-units/${f}`, 'utf8'))));
  const pieces = [], seen = new Set();
  let requests = 0, basis = 'cm', rule = 'CityMETER Building V4 as the demo map draws it (production building/detailMvt z14, version V4); point = a point well inside the building';
  if (!zoneAt(zones, [lon0, lat0])) {
    // OpenStreetMap side (owner 2026-11-13 “สร้างเลย ครอบคลุมด้วย”): the map draws OpenStreetMap buildings here
    // (OpenFreeMap tiles, which the container cannot read); their outlines come from a dated OpenStreetMap extract.
    const file = opt('osm-buildings'), on = opt('osm-date');
    if (!file) fail('the map draws OpenStreetMap buildings at this facility, not CityMETER Building V4 — give --osm-buildings <file> (outlines from a dated OpenStreetMap extract) and --osm-date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) fail('--osm-date YYYY-MM-DD: the date of the OpenStreetMap data the outlines come from');
    pieces.push(...osmPieces(file, ring));
    basis = 'osm';
    rule = `OpenStreetMap buildings (extract with data to ${on}, © OpenStreetMap contributors, ODbL 1.0), as the demo map draws OpenStreetMap buildings at this facility; point = a point well inside the building`;
  }
  const {tiles} = basis === 'cm' ? tilesForRegions([ring], 14, 64, [lon0, lat0]) : {tiles: []};
  const plan = basis === 'cm' ? planCmRequests(tiles, zones, {max: 400, center: [lon0, lat0]}) : {requests: []};
  if (basis === 'cm' && !plan.requests.length) fail('the map draws OpenStreetMap buildings here, not CityMETER Building V4 — run again with --osm-buildings');
  requests = plan.requests.length;
  const radiusM = roundingRadiusM(18, lat0), offsetM = encloseOffsetM(radiusM);
  for (const q of plan.requests) {
    const url = cmTileUrl(q.tile, q.tileUnit, q.tileType);
    let buf = null;
    for (let attempt = 0; attempt < 3 && !buf; attempt++) {
      try { const r = await fetch(url); if (r.ok) buf = new Uint8Array(await r.arrayBuffer()); else if (r.status < 500) fail(`tile ${q.key} answered ${r.status}`); }
      catch { /* retried */ }
      if (!buf) await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
    }
    if (!buf) fail(`tile ${q.key} did not load after 3 tries — run again later; never fill points by hand`);
    const layer = buf.byteLength ? parseVectorTile(buf).layers['building-detail'] || {extent: 4096, features: []} : {extent: 4096, features: []};
    pieces.push(...shapeCmTile(q.tile, layer, {regions: [ring], radiusM, offsetM, slot: q.slot, seen}).footprints);
    await new Promise(res => setTimeout(res, 250));
  }
  const list = pieces.map(p => {
    const fp = footprint({...p, key: p.id});
    return {fp, point: deepPoint(fp), area_m2: Math.round(Math.abs(areaM(p.outer)) - p.holes.reduce((s, h) => s + Math.abs(areaM(h)), 0)),
      height_m: Math.round(p.height * 10) / 10, outer: p.outer, holes: p.holes};
  }).map(c => ({...c, dist_m: Math.round(Math.hypot(...toM(c.point)))})).sort((a, b) => a.dist_m - b.dist_m);
  list.forEach((c, i) => { c.cid = i + 1; });
  const out = {venue_id: venue, name: facilityName, point: [lon0, lat0], reach_m: reach, read_on: today(), requests, basis, rule,
    candidates: list.map(({cid, point, area_m2, height_m, dist_m, outer, holes}) => ({cid, point, area_m2, height_m, dist_m,
      outer: outer.map(q => q.map(v => +v.toFixed(7))), holes: holes.map(h => h.map(q => q.map(v => +v.toFixed(7))))}))};
  writeFileSync(`${dir}/candidates.json`, JSON.stringify(out));
  writeFileSync(`${dir}/candidates.csv`, ['cid,lon,lat,area_m2,height_m,dist_m', ...list.map(c => [c.cid, c.point[0], c.point[1], c.area_m2, c.height_m, c.dist_m].join(','))].join('\n') + '\n');
  writeFileSync(`${dir}/candidates.png`, plot(list, [], null, reach));
  console.log(`${venue} · ${facilityName}: ${list.length} buildings within ${reach} m (${basis === 'cm' ? `${requests} tiles read` : 'OpenStreetMap outlines'})`);
  console.log(`files: ${dir}/candidates.png (numbered, north up, pin red), candidates.csv, candidates.json`);
  console.log(`the same buildings on the demo: https://montri-th.github.io/hospital/?facility=${encodeURIComponent(venue)}`);
}

/**
 * OpenStreetMap building outlines round the facility from a GeoJSON FeatureCollection (Polygon / MultiPolygon in lon/lat,
 * properties.id = the OSM element, e.g. "w123"): every outer ring that reaches the reach square is one piece, as the map
 * draws a part of a multipolygon on its own. Heights are the outline's own when it states one, else 3 m per level, else 3 m.
 */
function osmPieces(file, ring) {
  const fc = JSON.parse(readFileSync(file, 'utf8'));
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) fail(`${file} is not a GeoJSON FeatureCollection`);
  const [w, s, e, n] = [ring[0][0], ring[0][1], ring[2][0], ring[2][1]];
  const out = [];
  for (const f of fc.features) {
    const g = f?.geometry, id = String(f?.properties?.id || '');
    if (!g || !['Polygon', 'MultiPolygon'].includes(g.type) || !id) continue;
    const h = Number(f.properties.height), lv = Number(f.properties.levels);
    const height = Number.isFinite(h) && h > 0 ? h : Number.isFinite(lv) && lv > 0 ? lv * 3 : 3;
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach((poly, k) => {
      const outer = poly[0];
      if (!outer || outer.length < 4) return;
      const xs = outer.map(p => p[0]), ys = outer.map(p => p[1]);
      if (Math.max(...xs) < w || Math.min(...xs) > e || Math.max(...ys) < s || Math.min(...ys) > n) return;
      out.push({id: `osm:${id}:${k}`, outer, holes: poly.slice(1).filter(r => r.length >= 4), height});
    });
  }
  return out;
}

async function makeRow() {
  if (!existsSync(`${dir}/candidates.json`)) fail(`run candidates for ${venue} first`);
  const cand = JSON.parse(readFileSync(`${dir}/candidates.json`, 'utf8'));
  const byId = new Map(cand.candidates.map(c => [c.cid, {...c, fp: footprint({key: c.cid, outer: c.outer, holes: c.holes})}]));
  let members, boundary;
  if (opt('site')) {
    const geom = readGeometry(opt('site'));
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    const inside = p => polys.some(pg => inRing(p, pg[0]) && !pg.slice(1).some(h => inRing(p, h)));
    members = new Set(cand.candidates.filter(c => inside(c.point)).map(c => c.cid));
    for (const id of ids(opt('add'))) members.add(id);
    for (const id of ids(opt('drop'))) members.delete(id);
    boundary = {type: geom.type, coordinates: geom.type === 'Polygon' ? round(geom.coordinates) : geom.coordinates.map(round)};
  } else if (opt('pick')) {
    members = new Set(ids(opt('pick')));
    boundary = null;
  } else fail('give --site <geojson> or --pick <ids>');
  for (const id of members) if (!byId.has(id)) fail(`building ${id} is not in candidates.json`);
  const list = [...members].sort((a, b) => a - b).map(id => byId.get(id));
  if (list.length < 2) fail('fewer than 2 buildings — not a multi-building site; leave the row todo');
  for (const c of list) {
    if (!containsPoint(c.fp, c.point)) fail(`point of building ${c.cid} is not inside it — re-run candidates`);
    if (Math.hypot(...toM(c.point)) > MAX_SITE_M) fail(`building ${c.cid} is ${Math.round(Math.hypot(...toM(c.point)))} m from the facility (limit ${MAX_SITE_M} m)`);
  }
  boundary ||= envelope(list.map(c => c.outer.map(toM)), 6);
  const evidence = opt('evidence');
  if (!/^https:\/\/[^\s]+$/.test(evidence) || /google\.com\/(maps|drive)|docs\.google|landometer\.com\/api/.test(evidence)) fail('--evidence must be a public https page that shows the layout or, for osm_polygon_auto, the OpenStreetMap element (not a Google Maps/Drive link, not an API)');
  const source = opt('source');
  if (!SOURCES.includes(source)) fail('--source is required: osm_polygon_auto (an OpenStreetMap area of the facility, checked by rule), osm_polygon+site_layout (the same, checked with the layout), dol_parcels+site_layout (parcels read on LandsMaps / D-Value, with the layout) or site_layout (the layout and imagery alone)');
  const cells = {venue_id: venue, boundary_status: 'checked', boundary_source: source, boundary_evidence_url: evidence,
    boundary_geojson: JSON.stringify(boundary), buildings_in_boundary: list.map(c => `${c.point[0].toFixed(6)},${c.point[1].toFixed(6)}`).join(';'),
    main_building_note: opt('main'), checked_by: opt('by', 'ChatGPT (owner batch)'), checked_on: today(), notes: opt('notes')};
  writeFileSync(`${dir}/row.json`, JSON.stringify({...cells, buildings: list.map(c => c.cid), read_on: cand.read_on}, null, 1));
  const csvPath = 'sites/site_rows.csv';
  const esc = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const prior = existsSync(csvPath) ? readFileSync(csvPath, 'utf8').split('\n').slice(1).filter(l => l && !l.startsWith(`${venue},`)) : [];
  writeFileSync(csvPath, [COLUMNS.join(','), ...prior, COLUMNS.map(k => esc(cells[k])).join(',')].join('\n') + '\n');
  writeFileSync(`${dir}/picked.png`, plot(cand.candidates, list.map(c => c.cid), boundary, cand.reach_m));
  console.log(`${venue}: ${list.length} buildings [${list.map(c => c.cid).join(', ')}] → ${csvPath} · check ${dir}/picked.png (blue = site, orange = boundary)`);
}

// ---------- geometry (local metres round the facility) ----------
function areaM(ring) { let a = 0; const r = ring.map(toM); for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; }
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function edgeDist(p, rings) { let d = Infinity; for (const r of rings) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, segDist(p, r[i], r[i + 1])); return d; }
/** A point well inside the building (the farthest from its walls on a fine grid), checked against the map's own test. */
function deepPoint(fp) {
  const rings = [fp.outer, ...fp.holes].map(r => r.map(toM)), out = rings[0];
  const xs = out.map(p => p[0]), ys = out.map(p => p[1]);
  let best = null, bestD = -1;
  const scan = (x0, x1, y0, y1, step) => {
    for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) {
      const p = [x, y];
      if (!inRing(p, out) || rings.slice(1).some(h => inRing(p, h))) continue;
      const d = edgeDist(p, rings);
      if (d > bestD) { bestD = d; best = p; }
    }
  };
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), step = Math.max(0.25, Math.min(w, h) / 24);
  scan(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), step);
  if (best) scan(best[0] - step, best[0] + step, best[1] - step, best[1] + step, step / 6);
  const pt = best ? toLL(best) : null;
  if (pt && containsPoint(fp, pt)) return pt;
  const alt = interiorOf(fp.outer).map(v => +v.toFixed(6));
  if (!containsPoint(fp, alt)) fail('a building has no point that stays inside it at 6 decimals');
  return alt;
}
/** The site's buildings with a margin (m): cells of 1 m within `margin` of a building, holes filled, outer outline traced. */
function envelope(polys, margin) {
  const all = polys.flat(), pad = margin + 2;
  const x0 = Math.floor(Math.min(...all.map(p => p[0])) - pad), y0 = Math.floor(Math.min(...all.map(p => p[1])) - pad);
  const W = Math.ceil(Math.max(...all.map(p => p[0])) + pad) - x0, H = Math.ceil(Math.max(...all.map(p => p[1])) + pad) - y0;
  const on = new Uint8Array(W * H);
  for (const pg of polys) {
    const bx0 = Math.min(...pg.map(p => p[0])) - margin, bx1 = Math.max(...pg.map(p => p[0])) + margin;
    const by0 = Math.min(...pg.map(p => p[1])) - margin, by1 = Math.max(...pg.map(p => p[1])) + margin;
    for (let i = Math.max(0, Math.floor(bx0 - x0)); i < Math.min(W, Math.ceil(bx1 - x0)); i++) {
      for (let j = Math.max(0, Math.floor(by0 - y0)); j < Math.min(H, Math.ceil(by1 - y0)); j++) {
        if (on[j * W + i]) continue;
        const p = [x0 + i + 0.5, y0 + j + 0.5];
        if (inRing(p, pg) || edgeDist(p, [pg]) <= margin) on[j * W + i] = 1;
      }
    }
  }
  const outside = new Uint8Array(W * H), stack = [];
  for (let i = 0; i < W; i++) stack.push([i, 0], [i, H - 1]);
  for (let j = 0; j < H; j++) stack.push([0, j], [W - 1, j]);
  while (stack.length) {
    const [i, j] = stack.pop();
    if (i < 0 || j < 0 || i >= W || j >= H || on[j * W + i] || outside[j * W + i]) continue;
    outside[j * W + i] = 1; stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const filled = i => !outside[i];
  const at = (i, j) => i >= 0 && j >= 0 && i < W && j < H && filled(j * W + i);
  const edges = new Map(), key = (i, j) => `${i},${j}`;
  const add = (a, b) => { const k = key(...a); (edges.get(k) || edges.set(k, []).get(k)).push({a, b, used: false}); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!at(i, j)) continue;
    if (!at(i, j - 1)) add([i, j], [i + 1, j]);
    if (!at(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
    if (!at(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
    if (!at(i - 1, j)) add([i, j + 1], [i, j]);
  }
  const loops = [];
  for (const list of edges.values()) for (const e0 of list) {
    if (e0.used) continue;
    const loop = [e0.a]; let e = e0;
    while (!e.used) {
      e.used = true; loop.push(e.b);
      const next = (edges.get(key(...e.b)) || []).filter(n => !n.used);
      if (!next.length) break;
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
      const turn = n => { const ex = n.b[0] - n.a[0], ey = n.b[1] - n.a[1]; return dx * ey - dy * ex; }; // < 0: right
      e = next.sort((p, q) => turn(p) - turn(q))[0];
    }
    if (loop.length > 4) loops.push(loop);
  }
  const rings = loops.map(l => simplify(l.map(([i, j]) => [x0 + i, y0 + j]), 0.8)).filter(r => r.length >= 4 && ringArea(r) > 0)
    .map(r => r.map(toLL));
  return rings.length === 1 ? {type: 'Polygon', coordinates: [rings[0]]} : {type: 'MultiPolygon', coordinates: rings.map(r => [r])};
}
function ringArea(r) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; }
function simplify(ring, tol) {
  const dp = (pts) => {
    if (pts.length < 3) return pts;
    let idx = 0, max = 0;
    for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], pts[0], pts.at(-1)); if (d > max) { max = d; idx = i; } }
    return max > tol ? [...dp(pts.slice(0, idx + 1)).slice(0, -1), ...dp(pts.slice(idx))] : [pts[0], pts.at(-1)];
  };
  const half = Math.floor(ring.length / 2);
  const a = dp(ring.slice(0, half + 1)), b = dp(ring.slice(half));
  return [...a.slice(0, -1), ...b];
}
function round(rings) { return rings.map(r => r.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)])); }
function readGeometry(path) {
  let g = JSON.parse(readFileSync(path, 'utf8'));
  if (g.type === 'FeatureCollection') g = g.features.length === 1 ? g.features[0] : fail('the site file must hold one site (one feature)');
  if (g.type === 'Feature') g = g.geometry;
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) fail('the site must be a GeoJSON Polygon or MultiPolygon in lon/lat');
  const pts = (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()).flat();
  if (!pts.every(([x, y]) => x > 97 && x < 106 && y > 5 && y < 21)) fail('the site is not in lon/lat inside Thailand');
  if (pts.some(p => Math.hypot(...toM(p)) > MAX_SITE_M + 100)) fail(`the site reaches more than ${MAX_SITE_M} m from the facility's point`);
  return g;
}
function today() { return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Bangkok'}).format(new Date()); }

// ---------- a PNG without packages: grey = CityMETER buildings, blue = site, orange = boundary, red = the facility's point ----------
function plot(cands, pickedIds, boundary, reach) {
  const S = 1200, s = S / (2 * reach), img = new Uint8Array(S * S * 3).fill(246);
  const px = p => { const [x, y] = toM(p); return [S / 2 + x * s, S / 2 - y * s]; };
  const set = (x, y, c) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= S || y >= S) return; const k = (y * S + x) * 3; img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2]; };
  const fill = (rings, c) => {
    const rs = rings.map(r => r.map(px)), ys = rs.flat().map(p => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(S - 1, Math.ceil(Math.max(...ys))); y++) {
      const xs = [];
      for (const r of rs) for (let i = 0; i < r.length - 1; i++) {
        const [ax, ay] = r[i], [bx, by] = r[i + 1];
        if ((ay <= y + 0.5) !== (by <= y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(x, y, c);
    }
  };
  const line = ([ax, ay], [bx, by], c, w = 1) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay)) + 1;
    for (let i = 0; i <= n; i++) { const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n; for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++) set(x + dx, y + dy, c); }
  };
  const outline = (rings, c, w) => { for (const r of rings) { const q = r.map(px); for (let i = 0; i < q.length - 1; i++) line(q[i], q[i + 1], c, w); } };
  const picked = new Set(pickedIds);
  for (const c of cands) { fill([c.outer, ...c.holes], picked.has(c.cid) ? [47, 127, 182] : [200, 200, 200]); outline([c.outer], picked.has(c.cid) ? [11, 61, 98] : [110, 110, 110], 1); }
  if (boundary) for (const pg of boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates) outline(pg, [240, 140, 0], 2);
  const [cx, cy] = px([lon0, lat0]);
  for (let a = 0; a < 360; a += 2) for (let r = 0; r <= 7; r++) set(cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180), r > 5 ? [255, 255, 255] : [214, 39, 40]);
  for (const c of cands) text(String(c.cid), ...px(c.point));
  line([30, S - 30], [30 + 100 * s, S - 30], [0, 0, 0], 3);
  text('100m', 30 + 50 * s, S - 48); text('N', S - 40, 40);
  return png(S, S, img);
  function text(t, x, y) {
    const F = {0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
      6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111', m: '000000000000111110101010101010', N: '1000111001101011001110001'};
    const width = ch => (ch === 'm' ? 6 : ch === 'N' ? 5 : 3), sc = 2, tw = [...t].reduce((a, ch) => a + (width(ch) + 1) * sc, 0);
    let ox = Math.round(x - tw / 2), oy = Math.round(y - 5 * sc / 2);
    for (let i = -2; i < tw + 1; i++) for (let j = -2; j < 5 * sc + 2; j++) set(ox + i, oy + j, [255, 255, 255]);
    for (const ch of t) {
      const w = width(ch), bits = F[ch] || '';
      for (let r = 0; r < 5; r++) for (let col = 0; col < w; col++) if (bits[r * w + col] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) set(ox + col * sc + a, oy + r * sc + b, [0, 0, 0]);
      ox += (w + 1) * sc;
    }
  }
}
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const table = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const v of b) c = table[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(type), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
