/**
 * What the search box of CityMETER · Hospital knows by name: the entries js/shell/fuzzy.js matches and js/shell/search.js
 * lists (release 0.6.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว implement กับ demo web
 * ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”).
 *
 * The product statement reads where beds and facilities are, by area and by affiliation. So a name typed here opens
 * the level that answers it: a province or a เขต/อำเภอ (its beds and facilities), a rail station (the facilities round
 * it), an affiliation or a facility type (where it is), or one facility (its profile). A facility is also found by its
 * code. The order below is the order among equal matches: places first.
 *
 * Pure: entries from the decoded dataset; no DOM, no numbers shown (a row names what it is and where).
 */
import {areaWord} from './areas.js';
import {provinces} from './model.js';
import {PROVINCE_AKA, withoutMueang} from './shell/fuzzy.js';

export const SEARCH_KINDS = Object.freeze([
  {id: 'province', level: 'province', auto: true}, {id: 'area', level: 'district', auto: true},
  // A facility comes before a station of the same name, and the station is not chosen ahead: the page is about
  // facilities (“ศิริราช”).
  {id: 'aff', auto: true}, {id: 'group', auto: true}, {id: 'facility'}, {id: 'station', level: 'station'},
]);
/** Words a name may begin with, or carry, that people add or leave out; an array is one word and its abbreviations. */
export const SEARCH_HEADS = Object.freeze([['โรงพยาบาลส่งเสริมสุขภาพตำบล', 'รพ.สต.'], ['โรงพยาบาล', 'รพ.'], 'คลินิก', 'สถานพยาบาล', 'ศูนย์บริการสาธารณสุข', 'hospital', 'clinic']);
/** What to try when nothing is found: the kinds of name this demo knows. */
export const SEARCH_HINT = 'ลองชื่อสถานพยาบาล รหัส สังกัด สถานี เขต/อำเภอ หรือจังหวัด';

/** Every entry, the few places and filters first, then the facilities. */
export function* searchEntries({data, index}) {
  const byCode = new Map(provinces().map(p => [p.code, p]));
  for (const p of provinces()) yield {id: p.code, kind: 'province', name: p.th, nameEn: p.en, aka: PROVINCE_AKA[p.th], codes: [p.code, p.dopa], province: p.code};
  const places = new Map();
  for (const a of index.byId.values()) {
    const p = byCode.get(a.province);
    places.set(a.id, [a.name, a.nameEn, p?.th, p?.en]);
    yield {id: a.id, kind: 'area', name: a.name, nameEn: a.nameEn, also: withoutMueang(a.name), codes: [a.id], within: [p?.th, p?.en], province: a.province, area: a.id};
  }
  for (const s of data.stations) yield {id: s.id, kind: 'station', name: s.name, nameEn: s.nameEn, station: s};
  for (const a of data.affiliations) yield {id: a.id, kind: 'aff', name: a.th};
  for (const g of data.groups) yield {id: g.id, kind: 'group', name: g.th, nameEn: g.en, aka: [g.short]};
  const provinceOnly = new Map();
  for (const r of data.rows) {
    let within = r.area ? places.get(r.area) : provinceOnly.get(r.province);
    if (!within) { const p = byCode.get(r.province); within = [p?.th, p?.en]; provinceOnly.set(r.province, within); }
    yield {id: r.id, kind: 'facility', name: r.name, aka: r.nameOff ? [r.nameOff] : undefined, codes: [r.id, String(r.id).split('-').pop()], within, province: r.province, area: r.area, weight: r.importance || 0, row: r};
  }
}

/** The line under a name in the list: what it is and where. Thai; an English page translates it part by part. */
export function searchNote(entry, {index, data}) {
  const province = code => provinces().find(p => p.code === code)?.th || '';
  if (entry.kind === 'province') return 'จังหวัด';
  if (entry.kind === 'area') return [areaWord(entry.province), province(entry.province)].filter(Boolean).join(' · ');
  // A station reads as the head of its own panel does: the word, its lines, “กำลังสร้าง” while it is being built.
  if (entry.kind === 'station') return ['สถานีรถไฟฟ้า', ...(entry.station.lines || []), entry.station.status === 'construction' ? 'กำลังสร้าง' : ''].filter(Boolean).join(' · ');
  if (entry.kind === 'aff') return 'สังกัด';
  if (entry.kind === 'group') return 'ประเภทสถานพยาบาล';
  const r = entry.row, a = r.area ? index.byId.get(r.area) : null;
  return [data.groups[r.group]?.short, a?.name, province(r.province)].filter(Boolean).join(' · ');
}
