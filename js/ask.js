/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search with a question written for the view: a facility (opening hours now, specialist
 *    clinics, accepted rights and insurance, getting there), a district or a station (which hospitals and clinics are
 *    near, emergency care), a building, or the country/province overview (bed and expansion news). Google answers at the
 *    top of the results (AI Overview) and its AI Mode tab carries the question on. Never a link straight into AI Mode
 *    (`udm=50`): Google stops one that comes from another site at “Continue with this search?” (Hotel 0.3.3, measured
 *    2026-11-02 for long and short questions, with or without a referrer; a typed address or Google's own AI Mode tab
 *    opens without it). Owner 2026-11-02: “ทำให้มันตอบทันเลยได้มั้ย”;
 *  - Street View — only where the view has a point (a facility's production point, or a station's reference point,
 *    which is not an entrance: the label says "ใกล้");
 *  - Google Maps — a search by facility name + district + province (or "โรงพยาบาล" + place).
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). The Google names on the
 * buttons say where the answers come from (owner 2026-11-01: no caveat lines).
 */
import {LANG, englishName} from './shell/i18n.js';

// An English page (citymeter-shell 0.5.1) asks in English, with the English names the data gives (js/lang.js); the
// button labels are translated by js/shell/i18n.js like the rest of the page.
const enc = encodeURIComponent;
export const googleAskURL = q => `https://www.google.com/search?q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const join = (...parts) => clean(parts.filter(Boolean).join(' '));
/**
 * ctx: {kind: 'facility'|'building'|'area'|'station'|'overview', row?, area?: {place, province}, station?,
 *       province?, point?: {lat, lon, role}, rows?}
 * → [{id, label, href, note}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}, lang = LANG) {
  if (lang === 'en') return contextActionsEnglish(ctx);
  const out = [], place = ctx.area ? join(ctx.area.place, ctx.area.province) : '';
  const add = (id, label, href, note = '') => { if (href) out.push({id, label, href, note}); };
  if (ctx.kind === 'facility' && ctx.row) {
    const r = ctx.row, name = clean(r.name);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(name, place ? `(${place})` : '')} เปิดให้บริการวันและเวลาใด มีแพทย์เฉพาะทางหรือคลินิกอะไรบ้าง รับสิทธิบัตรทองประกันสังคมหรือประกันสุขภาพไหม และเดินทางไปอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => clean(r.name)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(names.join(' และ '), place)} อยู่อาคารเดียวกันไหม และในอาคารนี้มีบริการอะไรอีกบ้าง`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`โรงพยาบาลและคลินิกใน${clean(ctx.area.place)} ${clean(ctx.area.province)} มีที่ไหนบ้าง ที่ไหนมีห้องฉุกเฉิน 24 ชั่วโมง และมีแพทย์เฉพาะทางอะไรบ้าง`));
    add('maps', 'Google Maps', mapsSearchURL(`โรงพยาบาล ${join(ctx.area.place, ctx.area.province)}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, line = (s.lines || []).join(' ');
    add('ai', 'ถาม Google AI', googleAskURL(`โรงพยาบาลและคลินิกใกล้สถานี${clean(s.name)}${line ? ` (${clean(line)})` : ''} มีที่ไหนบ้าง และเดินไปกี่นาที`));
    add('maps', 'Google Maps', mapsSearchURL(`โรงพยาบาลใกล้สถานี${clean(s.name)}`));
  } else if (ctx.kind === 'overview') {
    const where = clean(ctx.province) || 'ประเทศไทย';
    add('ai', 'ถาม Google AI', googleAskURL(`ภาพรวมโรงพยาบาลและจำนวนเตียงใน${where}ล่าสุด และมีโรงพยาบาลใหม่เปิดหรือประกาศขยายที่ไหนบ้าง`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  }
  return out;
}

/** The same actions for an English page: English questions, English names where the data has them. */
function contextActionsEnglish(ctx = {}) {
  const out = [], N = s => englishName(clean(s));
  const add = (id, label, href) => { if (href) out.push({id, label, href, note: ''}); };
  const where = ctx.area ? [N(ctx.area.place), N(ctx.area.province)].filter(Boolean).join(', ') : '';
  if (ctx.kind === 'facility' && ctx.row) {
    const name = N(ctx.row.name);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''}: what are its opening days and hours, which specialists or clinics does it have, does it accept the gold card, social security or health insurance, and how do I get there?`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, N(ctx.area?.place), N(ctx.area?.province))));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => N(r.name)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`Are ${names.join(' and ')}${where ? ` (${where})` : ''} in the same building, and what other services are in it?`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`Hospitals and clinics in ${where}: where are they, which have a 24-hour emergency room, and which specialists do they have?`));
    add('maps', 'Google Maps', mapsSearchURL(`hospital ${where}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const station = N(ctx.station.name);
    add('ai', 'ถาม Google AI', googleAskURL(`Hospitals and clinics near ${station} station: where are they, and how many minutes' walk?`));
    add('maps', 'Google Maps', mapsSearchURL(`hospital near ${station} station`));
  } else if (ctx.kind === 'overview') {
    const place = N(ctx.province) || 'Thailand';
    add('ai', 'ถาม Google AI', googleAskURL(`Latest overview of hospitals and hospital beds in ${place}, and where have new hospitals opened or announced expansions?`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"${a.note ? ` title="${esc(a.note)}"` : ''}><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}</div>`;
}
