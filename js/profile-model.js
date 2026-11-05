/**
 * Reading-panel view models. Pure: no DOM, no map.
 *
 * Every profile reads `scopeRows` (filters before any area selection) so ranks and comparisons keep the whole
 * selection as reference. A row is one record of the research master (02_FACILITIES); the default measure is beds
 * the register reports (Σ official_reported_beds_text), the other is records (“แห่ง”). Points are production's own and
 * are never upgraded; district membership is the matched production code (row.admin says how).
 *
 * Distances (comparison set, station surroundings) are straight lines between reference points, computed here from
 * the published coordinates; they are not travel routes, travel times or catchments.
 */
import {mixOf, sizeMixOf, affMixOf, hasPoint, valueOf, rowValue, railShare} from './model.js';
import {summarizeAreas, byMetric, levelWords} from './areas.js';

const COLLATOR = new Intl.Collator('th');
/** Lists: most beds first (unknown beds last), then name — the registered size is the order users scan by. */
export const listOrder = (a, b) => (Number.isFinite(b.beds) ? b.beds : -1) - (Number.isFinite(a.beds) ? a.beds : -1) || a.group - b.group ||
  COLLATOR.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, rad = Math.PI / 180;
  const p1 = lat1 * rad, p2 = lat2 * rad, dp = (lat2 - lat1) * rad, dl = (lon2 - lon1) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Districts of a selection ranked by the measure (ties: the other measure, then name). */
export function rankAreas(rows, index, {province = '', metric = 'beds'} = {}) {
  return summarizeAreas(rows, index, {province}).map(a => ({...a, value: valueOf(a, metric)})).sort(byMetric(metric));
}

/** Rows of the selection that no district holds, by reason (rows are never placed by name at runtime). */
export function unplacedOf(rows) {
  let noArea = 0, noProvince = 0, conflict = 0, beds = 0;
  for (const r of rows) {
    if (r.area) continue;
    beds += rowValue(r, 'beds');
    if (r.admin === 'conflict') conflict++;
    else if (r.province) noArea++;
    else noProvince++;
  }
  return {noArea, noProvince, conflict, beds, total: noArea + noProvince + conflict};
}

const sum = (rows, metric) => rows.reduce((s, r) => s + rowValue(r, metric), 0);
const unknownBeds = rows => rows.filter(r => !Number.isFinite(r.beds)).length;
/** Records with published accreditation evidence (an HA stage or a JCI programme). */
export const accreditedOf = rows => rows.filter(r => r.ha || r.jci.length).length;

export function buildOverview(scopeRows, index, {province = '', groups = [], affiliations = [], metric = 'beds'} = {}) {
  return {ranking: rankAreas(scopeRows, index, {province, metric}), unplaced: unplacedOf(scopeRows),
    mix: mixOf(scopeRows, groups), affs: affMixOf(scopeRows, affiliations), sizes: sizeMixOf(scopeRows), count: scopeRows.length,
    beds: sum(scopeRows, 'beds'), bedsUnknown: unknownBeds(scopeRows), accredited: accreditedOf(scopeRows), rail: railShare(scopeRows, metric)};
}

/**
 * EVID-05 state of a selection: every district is in the national scope of the register, so a district with no
 * record is a measured zero of this dataset (“0 ที่พบ”), never no_data.
 */
const selectionState = count => (count ? 'measured' : 'measured_zero');

/**
 * Stations whose 500 m straight-line radius holds the most of the measure among `rows` (each row counted at its
 * nearest operating station only, so the list never adds a row twice).
 */
export function stationsOf(rows, metric = 'beds', m = 500, limit = 6) {
  const by = new Map();
  for (const r of rows) {
    if (!r.rail || r.rail.m > m) continue;
    const s = r.rail.station, e = by.get(s.id) || {station: s, count: 0, beds: 0, value: 0};
    e.count++; e.beds += rowValue(r, 'beds'); e.value += rowValue(r, metric); by.set(s.id, e);
  }
  return [...by.values()].sort((a, b) => b.value - a.value || b.count - a.count || COLLATOR.compare(a.station.name, b.station.name)).slice(0, limit);
}

export function buildAreaProfile(scopeRows, areaId, index, groups, {metric = 'beds', affiliations = []} = {}) {
  const area = index.byId.get(areaId);
  if (!area) return null;
  const ranking = rankAreas(scopeRows, index, {metric});
  const inProvince = ranking.filter(a => a.province === area.province);
  const mine = scopeRows.filter(r => r.area === areaId);
  // Share of the province's whole total in the scope (placed rows and rows placed only at province level).
  const provinceRows = scopeRows.filter(r => r.province === area.province);
  const pos = ranking.findIndex(a => a.id === areaId);
  const posProvince = inProvince.findIndex(a => a.id === areaId);
  const value = sum(mine, metric), provinceValue = sum(provinceRows, metric);
  return {
    area, words: levelWords(area.province), metric, value, count: mine.length, beds: sum(mine, 'beds'), bedsUnknown: unknownBeds(mine),
    km2: area.km2, coverageState: selectionState(mine.length), scopeCount: scopeRows.length,
    rank: pos >= 0 && value > 0 ? pos + 1 : null, rankOf: ranking.filter(a => a.value > 0).length,
    rankProvince: posProvince >= 0 && value > 0 ? posProvince + 1 : null, rankProvinceOf: inProvince.filter(a => a.value > 0).length,
    provinceValue, share: provinceValue ? (value / provinceValue) * 100 : null,
    points: mine.filter(hasPoint).length, ...mixOf(mine, groups), affs: affMixOf(mine, affiliations), sizes: sizeMixOf(mine),
    accredited: accreditedOf(mine), rail: railShare(mine, metric), stations: stationsOf(mine, metric),
    rows: [...mine].sort(listOrder),
  };
}

/**
 * A building the map draws, with the rows whose points fall inside it (building-join.js):
 * sel = {key, kind: 'osm', rows, height}. Not a facility: no name.
 */
export function buildBuildingProfile(sel, index, groups) {
  if (!sel?.rows?.length) return null;
  const rows = [...sel.rows].sort(listOrder);
  const area = index.byId.get(rows[0].area) || null;
  const areaIds = [...new Set(rows.map(r => r.area))];
  return {key: sel.key, kind: sel.kind || 'osm', rows, count: rows.length, beds: sum(rows, 'beds'), bedsUnknown: unknownBeds(rows),
    area, areaCount: areaIds.length, words: levelWords(rows[0].province), height: Number.isFinite(sel.height) ? sel.height : null,
    ...mixOf(rows, groups)};
}

/**
 * An affiliation (สังกัด) of the register in the scope — the overview's card under an affiliation filter (the scope is
 * already that affiliation's rows; other filters apply).
 */
export function buildAffProfile(affId, {scopeRows, affiliations, metric = 'beds'}) {
  const aff = affiliations.find(a => a.id === affId);
  if (!aff) return null;
  const rows = scopeRows.filter(r => r.affId === affId);
  return {aff, count: rows.length, beds: sum(rows, 'beds'), bedsUnknown: unknownBeds(rows), provinces: new Set(rows.map(r => r.province).filter(Boolean)).size,
    accredited: accreditedOf(rows), rail: railShare(rows, metric)};
}

/** Radius of the comparison set: hospitals (a facility with beds) 5 km, every other facility 2 km. */
export const COMPSET_RADIUS_M = 5000;
export const COMPSET_RADIUS_SMALL_M = 2000;
export const COMPSET_LIMIT = 10;

/**
 * Nearby comparison set of a facility (a screening aid, not a competitive or referral set): records with a point
 * within the radius in a straight line, of the same facility group, whose reported beds are within half to double the
 * facility's own (both above 0) — or, for a facility without beds, any record of its group — nearest first. Every
 * record within the radius (any group) is stated beside it. Reads every row of the dataset (`allRows`), so the set does
 * not move with the filters.
 */
export function compsetOf(row, allRows, {limit = COMPSET_LIMIT} = {}) {
  if (!hasPoint(row)) return null;
  const sized = row.beds > 0;
  const radius = sized ? COMPSET_RADIUS_M : COMPSET_RADIUS_SMALL_M;
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((row.latitude * Math.PI) / 180));
  const near = [];
  let count = 0, beds = 0, unknown = 0;
  for (const r of allRows) {
    if (r === row || !hasPoint(r)) continue;
    if (Math.abs(r.latitude - row.latitude) > dLat || Math.abs(r.longitude - row.longitude) > dLon) continue;
    const m = distanceM(row.latitude, row.longitude, r.latitude, r.longitude);
    if (m > radius) continue;
    count++; if (Number.isFinite(r.beds)) beds += r.beds; else unknown++;
    const sizeOK = sized ? r.beds > 0 && r.beds >= row.beds / 2 && r.beds <= row.beds * 2 : true;
    if (r.group === row.group && sizeOK) near.push({row: r, m});
  }
  near.sort((a, b) => a.m - b.m || listOrder(a.row, b.row));
  return {radius, around: {count, beds, unknown}, matches: near.length, rows: near.slice(0, limit),
    rule: sized ? {group: row.group, min: Math.ceil(row.beds / 2), max: row.beds * 2} : {group: row.group, min: null, max: null}};
}

/** Facility detail: the comparison set, the other records of its district and its rail context. */
export function buildFacilityDetail(row, {scopeRows, allRows, index, groups, affiliations = [], building = null}) {
  if (!row) return null;
  const area = row.area ? index.byId.get(row.area) || null : null;
  const sameArea = row.area ? scopeRows.filter(r => r.area === row.area && r.id !== row.id) : [];
  return {row, area, words: levelWords(row.province), group: groups[row.group], affiliation: affiliations[row.aff] || null, building,
    compset: compsetOf(row, allRows),
    sameArea: {count: sameArea.length, beds: sum(sameArea, 'beds')}};
}

export const STATION_RADIUS_M = 500;

/**
 * A rail station of CityMETER · Transit and the records whose points lie within STATION_RADIUS_M of its reference
 * point (straight line; a record near two stations is listed at both — this view never adds stations together).
 */
export function buildStationProfile(station, {scopeRows, groups, radius = STATION_RADIUS_M, metric = 'beds'}) {
  if (!station) return null;
  const rows = [];
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((station.lat * Math.PI) / 180));
  for (const r of scopeRows) {
    if (!hasPoint(r) || Math.abs(r.latitude - station.lat) > dLat || Math.abs(r.longitude - station.lon) > dLon) continue;
    const m = distanceM(station.lat, station.lon, r.latitude, r.longitude);
    if (m <= radius) rows.push({row: r, m});
  }
  rows.sort((a, b) => listOrder(a.row, b.row));
  const list = rows.map(x => x.row);
  return {station, radius, metric, count: list.length, beds: sum(list, 'beds'), bedsUnknown: unknownBeds(list),
    value: sum(list, metric), ...mixOf(list, groups), sizes: sizeMixOf(list), accredited: accreditedOf(list), rows: list, distance: new Map(rows.map(x => [x.row.id, x.m]))};
}
