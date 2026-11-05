/**
 * Dataset vocabulary, decoding, shared filter and summary helpers.
 *
 * Rows are the records of “CityMETER Hospital Thailand — Research Master 2026-10-31” (data/hospitals.json, built by
 * scripts/build-data.py). One row = one row of the sheet's 02_FACILITIES: a source identity the owner approved into the
 * dataset — a CityMETER production Hospital record (CMH-*) or an HCODE register record (HCODE-*). Nothing here merges,
 * moves or mutates a row.
 *
 * Two measures (a contract, see DATA_METHOD.md §2):
 *   beds (default) — Σ official_reported_beds_text: the beds in use HCODE reports (“เตียง”). A reported 0 (clinics,
 *                    primary-care units) adds 0; a facility with unknown beds adds nothing and is counted apart
 *                    (“ไม่ทราบจำนวนเตียง”), never as 0.
 *   count          — records (“แห่ง”).
 * Lab prices (DIT, six items) are published per facility only, never summed or averaged across facilities, never called
 * a bill, a package or the facility's price level.
 *
 * Area = the เขต/อำเภอ of CityMETER production the build matched for the row (row.admin: name · code · point ·
 * province · conflict · none). Points are production's own (row.coordRole); HCODE rows carry none.
 */
import {seriesOf} from './cues.js';

/** Short labels for tight places (matrix columns, chips); the full Thai label stays in titles, legends and lists. */
export const GROUP_SHORT = Object.freeze({
  regional: 'รพ.ศูนย์/ทั่วไป', private: 'รพ.เอกชน', community: 'รพ.ชุมชน', public_other: 'รพ.รัฐอื่น',
  subdistrict: 'รพ.สต.', center: 'ศูนย์บริการ', clinic: 'คลินิก', other: 'ไม่ระบุ',
});

/** Measures: `beds` (default) and `count`. */
export const METRICS = Object.freeze({
  beds: Object.freeze({id: 'beds', one: 'เตียง', label: 'เตียง', subject: 'เตียง', per: 'เตียง'}),
  count: Object.freeze({id: 'count', one: 'แห่ง', label: 'สถานพยาบาล', subject: 'สถานพยาบาล', per: 'แห่ง'}),
});
export const metricOf = id => METRICS[id] || METRICS.beds;
/** Unit words for a measure ('' = beds). */
export const unitWords = (metric = '') => ({...metricOf(metric), mode: metricOf(metric).id});

/** Bed bands of the record (beds > 0); zero and unknown beds are in none. */
export const SIZE_BANDS = Object.freeze([
  Object.freeze({id: 'b1', th: 'ไม่ถึง 30 เตียง', short: '<30', min: 1, max: 29}),
  Object.freeze({id: 'b2', th: '30–89 เตียง', short: '30–89', min: 30, max: 89}),
  Object.freeze({id: 'b3', th: '90–199 เตียง', short: '90–199', min: 90, max: 199}),
  Object.freeze({id: 'b4', th: '200–499 เตียง', short: '200–499', min: 200, max: 499}),
  Object.freeze({id: 'b5', th: '500 เตียงขึ้นไป', short: '500+', min: 500, max: Infinity}),
]);
export const sizeOf = beds => (Number.isFinite(beds) && beds > 0 ? SIZE_BANDS.find(b => beds >= b.min && beds <= b.max)?.id || '' : '');
/** Beds known (a reported 0 included). */
export const bedsKnown = r => Number.isFinite(r?.beds);
/**
 * Symbol size on the map: the symbol's AREA grows with the reported beds — radius = k(zoom) · √(beds / 100), beds capped
 * at BEDS_SIZE_CAP, never below PIN_MIN_RADIUS (a reported 0 sits at the floor). A record with unknown beds is drawn
 * hollow at the UNKNOWN_BEDS_SIZE size (EVID-05: never a measured 0). PIN_SCALE gives k (px of radius for 100 beds) by
 * zoom; the legend and the HTML pins use the same numbers.
 */
export const PIN_SCALE = Object.freeze([[6, 0.9], [8, 1.3], [10, 2.0], [12, 3.2], [14, 4.8], [16, 5.8], [18, 6.4]]);
export const BEDS_SIZE_CAP = 1500;
export const PIN_MIN_RADIUS = 3;
export const UNKNOWN_BEDS_SIZE = 10;
export function pinK(zoom) {
  const s = PIN_SCALE;
  if (!(zoom > s[0][0])) return s[0][1];
  for (let i = 1; i < s.length; i++) if (zoom <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (zoom - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  return s.at(-1)[1];
}
/** Symbol radius in px for a row's beds at a zoom (unknown beds → the UNKNOWN_BEDS_SIZE size, drawn hollow by the caller). */
export const pinRadius = (beds, zoom) => {
  const n = Number.isFinite(beds) ? Math.min(Math.max(beds, 0), BEDS_SIZE_CAP) : UNKNOWN_BEDS_SIZE;
  return Math.max(PIN_MIN_RADIUS, pinK(zoom) * Math.sqrt(n / 100));
};
/**
 * The same size as a MapLibre expression of feature property `r` (beds; -1 = unknown): min(cap, `factor` × radius)
 * + `add` px (zoom stays the top-level input, as MapLibre requires).
 */
export function pinSizeExpression(factor = 1, add = 0, cap = 1e6) {
  const at = k => ['+', add, ['min', cap, ['*', factor, ['max', PIN_MIN_RADIUS, ['*', k, ['sqrt', ['/', ['case', ['>=', ['get', 'r'], 0], ['min', ['get', 'r'], BEDS_SIZE_CAP], UNKNOWN_BEDS_SIZE], 100]]]]]]];
  return ['interpolate', ['linear'], ['zoom'], ...PIN_SCALE.flatMap(([z, k]) => [z, at(k)])];
}
/** Size class kept for HTML pins and lists: 0 small (< 90 beds, zero or unknown), 1 medium (90–499), 2 large (≥ 500). */
export const pinSizeOf = beds => (Number.isFinite(beds) && beds >= 500 ? 2 : Number.isFinite(beds) && beds >= 90 ? 1 : 0);

/**
 * Importance of a record for labels near the middle of the view: its percentile among all records by reported beds,
 * plus a quarter step for published accreditation (HA stage or JCI) — so a hospital reads before a clinic of the same
 * place. Unknown beds are never guessed (0). Ranking only — never shown as a figure.
 */
export function importanceScores(rows) {
  const sorted = rows.map(r => r.beds).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  const pct = v => {
    if (!Number.isFinite(v) || !n) return 0;
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
    return lo / n;  // share of records at or below v
  };
  return rows.map(r => pct(r.beds) + (r.ha || r.jci.length ? 0.25 : 0) + (r.beds > 0 ? 0.25 : 0));
}

/** The value a row adds to a measure: its beds (known only; a reported 0 adds 0) or 1 record. */
export const rowValue = (r, metric = 'beds') => (metric === 'count' ? 1 : (Number.isFinite(r?.beds) && r.beds > 0 ? r.beds : 0));
/** The value of an aggregate ({count, beds}) under a measure. */
export const valueOf = (a, metric = 'beds') => (metric === 'count' ? a?.count || 0 : a?.beds || 0);

/** Every province of the production base info, keyed by the production route code (/v3/citymeter/{code}). */
let PROVINCE_LIST = [];
export function setProvinces(list) { PROVINCE_LIST = Object.freeze((list || []).map(p => Object.freeze({code: p.id, dopa: p.code, th: p.name, en: p.nameEn}))); }
export const provinces = () => PROVINCE_LIST;
export const provinceByCode = code => PROVINCE_LIST.find(p => p.code === String(code || '').toUpperCase()) || null;
/** Accept a production code (BKK), a DOPA code (10) or an English/Thai name; returns the production code or ''. */
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  const p = PROVINCE_LIST.find(x => x.code === v.toUpperCase() || x.dopa === v || x.en.toLowerCase() === v.toLowerCase() || x.th === v);
  return p ? p.code : '';
};

/** A usable coordinate inside Thailand's bounding box (never invented). */
export const hasPoint = r => Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude) &&
  r.latitude >= 5 && r.latitude <= 21 && r.longitude >= 97 && r.longitude <= 106;

const lower = v => String(v || '').toLocaleLowerCase('th-TH');

/** Label of the register's own name when it differs from the name the facility is listed under. */
export const OFFICIAL_NAME = 'ชื่อตามทะเบียน';
/** The line under a facility's name: its register (HCODE) name when it differs. '' when there is none. */
export const subName = r => r?.nameOff || '';

/**
 * Short name for tight places (map labels): the common type words become their everyday abbreviations
 * (โรงพยาบาลส่งเสริมสุขภาพตำบล → รพ.สต., โรงพยาบาล → รพ., ศูนย์บริการสาธารณสุข → ศบส.); the full name stays the
 * accessible name.
 */
export function shortName(name) {
  return String(name || '')
    .replace(/^โรงพยาบาลส่งเสริมสุขภาพตำบล\s*/, 'รพ.สต.')
    .replace(/^โรงพยาบาล\s*/, 'รพ.')
    .replace(/^ศูนย์บริการสาธารณสุข\s*/, 'ศบส.')
    .replace(/^ศูนย์สุขภาพชุมชน\s*/, 'ศสม.')
    .replace(/^สถานีอนามัย\s*/, 'สอ.')
    .trim();
}

/**
 * Decode data/hospitals.json into row objects plus dictionaries.
 * `index` is the area index (js/areas.js#buildAreaIndex): every placed district code must exist there.
 */
export function decodeDataset(json, index) {
  if (!json?.cols || !Array.isArray(json.cols.key)) throw new Error('Invalid hospital dataset');
  const c = json.cols, n = c.key.length, M = json.meta || {}, V = json.vocab || {};
  const groups = (json.groups || []).map((g, i) => ({...g, index: i, series: seriesOf(g.id), short: GROUP_SHORT[g.id] || g.th}));
  const affiliations = (M.affiliations || []).map((a, i) => ({...a, index: i}));
  const levels = (M.levels || []).map((l, i) => ({...l, index: i}));
  const haStages = (M.haStages || []).map((s, i) => ({...s, index: i}));
  const roles = (M.roles || []).map((s, i) => ({...s, index: i}));
  const sources = json.sources || [];
  const stations = (json.stations || []).map((s, i) => ({...s, index: i}));
  const basketItems = M.basket?.items || [];
  const svcMeta = M.services || {domains: [], named: [], programmes: []};
  const rows = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const area = c.district[i] >= 0 ? json.districts[c.district[i]] : '';
    const province = c.province[i] >= 0 ? json.provinces[c.province[i]] : '';
    if (area && !index?.byId.has(area)) { dropped++; continue; }
    const group = groups[c.group[i]] || groups.at(-1);
    const k = String(i);
    const beds = c.beds[i] >= 0 ? c.beds[i] : null;
    const lat = c.lat[i], lon = c.lon[i];
    const ha = c.ha[i] >= 0 ? {...haStages[c.ha[i]], to: c.haTo[i] || '', issued: json.haOn?.[k]?.[0] || '', asOf: json.haOn?.[k]?.[1] || ''} : null;
    const b = json.basket?.[k];
    const ref = json.ref?.[k];
    const s = json.svc?.[k];
    const row = {
      id: c.key[i], name: c.name[i], nameOff: c.nameOff[i] || '', index: i,
      group: group.index, groupId: group.id, series: group.series, rawType: json.rawTypes?.[c.raw[i]] || '',
      beds, size: sizeOf(beds),
      aff: c.aff[i], affId: affiliations[c.aff[i]]?.id || 'none',
      level: c.level[i] >= 0 ? levels[c.level[i]] : null,
      ha, jci: (json.jci?.[k] || []).map(([programme, on]) => ({programme, on})),
      role: c.role[i] >= 0 ? roles[c.role[i]] : null,
      basket: b ? {sum: b[0], level: b[1], items: b.slice(2).map((thb, j) => ({...basketItems[j], thb}))} : null,
      ref: ref ? {...basketItems[ref[0]], thb: ref[1]} : null,
      svc: s ? {domains: (s.d || []).map(d => svcMeta.domains[d]).filter(Boolean), named: (s.a || []).map(a => svcMeta.named[a]).filter(Boolean),
        programmes: (s.p || []).map(p => svcMeta.programmes[p]).filter(Boolean), team: Boolean(s.t), on: s.on || ''} : null,
      area, province, admin: V.admin?.[c.admin[i]] || 'none',
      longitude: Number.isFinite(lon) ? lon : null, latitude: Number.isFinite(lat) ? lat : null, coordRole: Number.isFinite(lat) ? 'production' : '',
      source: sources[c.src[i]] || {id: '', th: '', url: ''}, url: c.url[i] >= 0 ? json.urls[c.url[i]] : '',
      registry: c.reg[i] === 1 ? 'cancelled' : c.reg[i] === 0 ? 'active' : '',
      rail: c.rail[i] >= 0 ? {station: stations[c.rail[i]], m: c.railM[i]} : null,
      railNext: c.rail2[i] >= 0 ? {station: stations[c.rail2[i]], m: c.rail2M[i]} : null,
    };
    const a = area ? index.byId.get(area) : null;
    const p = province ? PROVINCE_LIST.find(x => x.code === province) : null;
    row.haystack = lower([row.name, row.nameOff, row.id, a?.name, a?.nameEn, p?.th, p?.en, group.th, group.short, row.rawType,
      affiliations[row.aff]?.th].filter(Boolean).join(' '));
    rows.push(row);
  }
  const scores = importanceScores(rows);
  rows.forEach((r, i) => { r.importance = scores[i]; });
  return {meta: M, rows, groups, affiliations, levels, haStages, roles, stations, sources, dropped};
}

/**
 * Shared filter used by map, counters, charts, panel and table.
 * f = {search, group, size, province, aff}.
 * Area selection and area focus are applied by the caller (row scopes, see app.js).
 */
export function filterRows(rows, f = {}) {
  // Every word of the search, anywhere in the facility's names, code, group, type, affiliation or area.
  const terms = lower(f.search).trim().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (f.group && r.groupId !== f.group) return false;
    if (f.size && r.size !== f.size) return false;
    if (f.province && r.province !== f.province) return false;
    if (f.aff && r.affId !== f.aff) return false;
    return terms.every(t => r.haystack.includes(t));
  });
}

/** Totals for a selection: records, known beds, records with unknown beds, points, placement. */
export function summarize(rows) {
  let points = 0, placed = 0, provinced = 0, beds = 0, bedsUnknown = 0, withBeds = 0, accredited = 0;
  const areas = new Set(), provinceSet = new Set();
  for (const r of rows) {
    if (hasPoint(r)) points++;
    if (r.area) { placed++; areas.add(r.area); }
    if (r.province) { provinced++; provinceSet.add(r.province); }
    if (Number.isFinite(r.beds)) { beds += r.beds; if (r.beds > 0) withBeds++; } else bedsUnknown++;
    if (r.ha || r.jci.length) accredited++;
  }
  return {count: rows.length, beds, bedsUnknown, withBeds, accredited, points, placed, provinced, areas: areas.size, provinces: provinceSet.size};
}

/** Records and beds per group for a selection (every group listed, zero kept as a measured 0). */
export function mixOf(rows, groups) {
  const byGroup = groups.map(g => ({id: g.id, index: g.index, series: g.series, th: g.th, short: g.short, count: 0, beds: 0, known: 0}));
  for (const r of rows) { const g = byGroup[r.group]; g.count++; if (Number.isFinite(r.beds)) { g.beds += r.beds; g.known++; } }
  return {byGroup};
}

/** Records and beds per affiliation for a selection (every affiliation listed). */
export function affMixOf(rows, affiliations) {
  const list = affiliations.map(a => ({id: a.id, index: a.index, th: a.th, count: 0, beds: 0}));
  for (const r of rows) { const a = list[r.aff]; if (!a) continue; a.count++; a.beds += rowValue(r, 'beds'); }
  return list;
}

/** Records and beds per bed band (zero and unknown beds apart). */
export function sizeMixOf(rows) {
  const bands = SIZE_BANDS.map(b => ({...b, count: 0, beds: 0}));
  let unknown = 0, zero = 0;
  for (const r of rows) {
    const b = r.size ? bands.find(x => x.id === r.size) : null;
    if (b) { b.count++; b.beds += r.beds; } else if (Number.isFinite(r.beds)) zero++; else unknown++;
  }
  return {bands, unknown, zero};
}

/** Share of the measure that lies within `m` metres (straight line) of an operating rail station; rows with a point only. */
export function railShare(rows, metric = 'beds', m = 500) {
  let within = 0, base = 0, noPoint = 0;
  for (const r of rows) {
    const v = rowValue(r, metric);
    if (!hasPoint(r)) { noPoint += v; continue; }
    base += v;
    if (r.rail && r.rail.m <= m) within += v;
  }
  return {within, base, noPoint, share: base ? (within / base) * 100 : null};
}

export const safeURL = value => {
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; }
  catch { return ''; }
};

/**
 * Production CityMETER deep links (route scheme observed in the production bundle). Production has a hospital
 * dataset (`?d=hospital`), so the link opens the same area with it.
 */
export const PRODUCTION = 'https://landometer.com/v3/citymeter';
export function productionLink({province = '', area = ''} = {}) {
  if (!province) return `${PRODUCTION}?d=hospital`;
  if (area) return `${PRODUCTION}/${province}/D/${area}?d=hospital`;
  return `${PRODUCTION}/${province}?d=hospital`;
}
/** CityMETER sibling demos linked by registry id. */
export const TRANSIT_SITE = 'https://montri-th.github.io/transit/';
export const stationLink = s => (s?.id ? `${TRANSIT_SITE}?station=${encodeURIComponent(s.id)}` : '');
