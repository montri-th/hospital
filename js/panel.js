/**
 * Reading panel views as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); the app binds one delegated handler.
 * Actions: select-area · select-facility · select-building · select-station · select-province · filter-aff ·
 * filter-group · set-metric · back · explore-top · clear-focus · open-charts · open-table · clear-filter · leave-area.
 *
 * Copy (carried over from CityMETER · Hotel 0.3.1, owner 2026-11-01: “เรื่องภาษา ขอที่ กระชับอ่านเข้าใจง่าย ใช้ symbol,
 * logo, icon, charts มาช่วยทำให้ text กระชับ … ตรงกับ context ของ ICP ตาม product statement ไม่มี caveats เลย และเป็น
 * ธรรมชาติ”): short Thai in the words of the people choosing a site for care, planning a network or screening an area
 * (PRODUCT_STATEMENT §2.1: เตียง แห่ง ประเภท สังกัด ระดับ มาตรฐาน ราคาแล็บ คู่เทียบ ใกล้รถไฟฟ้า); pictograms and
 * small bar charts carry what a sentence used to; no caveat on screen. Exactness comes from the names themselves —
 * “เตียงตามทะเบียน”, “ราคาแล็บ 6 รายการ (DIT)”, “HA … ถึง <date>”, a rank “จาก N”, the numerator and denominator of
 * every share (visible, or in the tile's title and accessible name) — and from one provenance line per view: dataset ·
 * source · date · boundary, then “วิธีนับ” (DATA_METHOD.md, where the method and its limits live). Two measures
 * (js/model.js#METRICS): เตียง (default) · แห่ง. Unknown beds are never 0 (“ไม่ทราบจำนวนเตียง”, a hatched “ไม่ทราบ”
 * bar); a reported 0 is a 0 (“ไม่มีเตียง”). Lab prices per facility only, never summed or averaged across facilities.
 * Distances are straight lines (the distance pictogram; “ระยะตรง” in titles). A facility's pin inside a drawn building
 * is “สถานพยาบาลในอาคารนี้” / “อีก N แห่งในอาคารนี้”, never “ตั้งอยู่ใน”. Sources, methods and ids sit in one closed
 * <details>.
 */
import {LANG} from './shell/i18n.js';
import {productionLink, provinceByCode, hasPoint, stationLink, SIZE_BANDS, subName, OFFICIAL_NAME} from './model.js';
import {areaWord} from './areas.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const num = n => NUMBER.format(n);
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
/** Straight-line distance for display: "320 ม." / "1.4 กม.". */
export const meters = m => (!Number.isFinite(m) ? '' : m < 1000 ? `${num(Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toLocaleString('th-TH', {maximumFractionDigits: 1})} กม.`);
const baht = v => `฿${Number(v).toLocaleString('th-TH', {maximumFractionDigits: 2})}`;
/** A decorative pictogram of the approved subset (js/navigation.js PICTOGRAM_CONTRACT); the text carries the meaning. */
const pic = (kind, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(kind)}" aria-hidden="true"></i>`;
/** The method and its limits (one link at the end of every provenance line). */
export const METHOD_URL = 'DATA_METHOD.md';

export function link(url, label, cls = 'source-link') {
  const u = safeURL(url);
  return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

/** The line under a facility's name (model.js#subName): its register name, labelled, when it differs. */
export function subLine(r, cls, tag = 'p') {
  const sub = subName(r);
  if (!sub) return '';
  return `<${tag} class="${cls} recorded-name"><span class="recorded-label">${OFFICIAL_NAME}</span> ${esc(sub)}</${tag}>`;
}

export function thaiDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** Metric tile with a decorative pictogram; value may be a preformatted string. `detail` (numerator and denominator)
 *  is the tile's title and part of its accessible text. */
export function metricTile(value, label, kind = '', detail = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"${detail ? ` title="${esc(detail)}"` : ''}>${pic(kind || 'plain', 'metric-symbol')}<strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span>${detail ? `<span class="sr-only">${esc(detail)}</span>` : ''}</div>`;
}
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}>${pic(kind)}${esc(text)}</h3>`;

const provinceName = code => provinceByCode(code)?.th || code || '';
/** "เขตราชเทวี" / "อำเภอเมืองเชียงใหม่". */
const placeName = a => (a ? `${areaWord(a.province)}${a.name}` : '');
/** One word for a list of districts: เขต (all Bangkok), อำเภอ (none), else เขต/อำเภอ. */
export const words = areas => {
  const p = new Set(areas.map(a => a.province));
  return p.size === 1 ? areaWord([...p][0]) : 'เขต/อำเภอ';
};
const valueText = (v, unit) => nw(`<strong class="data-number">${num(v)}</strong> ${esc(unit.one)}`);
/** "120 เตียง" · "ไม่มีเตียง" (a reported 0) · "ไม่ทราบจำนวนเตียง". */
export const bedsText = r => (!Number.isFinite(r?.beds) ? 'ไม่ทราบจำนวนเตียง' : r.beds > 0 ? `${num(r.beds)} เตียง` : 'ไม่มีเตียง');
/** "อโศก (สุขุมวิท)" — next to the rail pictogram; "สถานีอโศก (สุขุมวิท)" in running text. */
const stationShort = s => (s ? `${s.name}${s.lines?.length ? ` (${s.lines.join(' · ')})` : ''}` : '');
const stationName = s => (s ? `สถานี${stationShort(s)}` : '');

/* ---------- vocabularies (source details only) ---------- */

/** How the row's district was matched at build time (row.admin). */
export const ADMIN_TH = Object.freeze({
  name: 'จากชื่อเขต/อำเภอในทะเบียน',
  code: 'จากรหัสอำเภอในทะเบียน HCODE',
  point: 'จากหมุดของ CityMETER',
  province: 'ระบุได้แค่จังหวัด',
  conflict: 'หมุดกับทะเบียนอยู่คนละจังหวัด',
  none: 'ไม่ระบุจังหวัด',
});
/** The word of a facility's site chip by facility group (“ทั้งโรงพยาบาล 24 อาคาร”); other groups read “ทั้งโครงการ”. */
const SITE_WORD = Object.freeze({regional: 'โรงพยาบาล', private: 'โรงพยาบาล', community: 'โรงพยาบาล', public_other: 'โรงพยาบาล', subdistrict: 'โรงพยาบาล'});

/**
 * The provenance line every view that shows numbers ends with: dataset · source · date · boundary (each part in
 * `data-prov`, its word for screen readers), then the method link. Rail, accreditation and price sources join the
 * source part when the view shows them.
 */
export function provenance(ctx = {}, boundary = '', {rail = false, quality = false, price = false, services = false, site = null} = {}) {
  const meta = ctx.meta || {};
  const sources = ['CityMETER Hospital', 'ทะเบียน HCODE',
    quality ? 'HA · JCI' : '', price ? 'DIT' : '', services ? 'สปสช. · เว็บผู้ให้บริการ' : '',
    rail ? `CityMETER Transit ${thaiDate(meta.context?.rail?.asOf || '')}`.trim() : '',
    site ? `ไซต์ ${site.source || 'งานวิจัย'} ${thaiDate(site.on || '')}`.trim() : ''].filter(Boolean);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">ชุดข้อมูล </span>CityMETER Hospital</span> <span class="prov-part" data-prov="source"><span class="sr-only">แหล่ง</span>จาก ${esc(sources.join(' · '))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">ตรวจ </span>${esc(thaiDate(meta.checkedOn || ''))}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">ขอบเขต </span>${esc(boundary)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}" target="_blank" rel="noopener">วิธีนับ</a></span></p>`;
}

/* ---------- shared fragments ---------- */

/** Bars per facility group in the group's series colour + shape cue; value = the measure. */
function groupBars(byGroup, unit) {
  const val = g => (unit.id === 'count' ? g.count : g.beds);
  const list = byGroup.filter(g => val(g) > 0).sort((a, b) => val(b) - val(a) || a.index - b.index);
  if (!list.length) return `<p class="hint">ไม่มี${esc(unit.subject)}</p>`;
  const max = Math.max(1, ...list.map(val));
  return `<ul class="mix-list" aria-label="ประเภทสถานพยาบาล (${esc(unit.one)})">${list.map(g => `
    <li><button type="button" class="mix-row" data-action="filter-group" data-value="${esc(g.id)}" title="ดูเฉพาะ${esc(g.th)}"><span class="mix-label">${cueMarkup(g.series)}${esc(g.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${g.series}" style="width:${Math.max(3, Math.round((val(g) / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(val(g))}</span></button></li>`).join('')}</ul>`;
}

/** Bars per affiliation (one neutral fill; an affiliation is not a map category); each filters to it. */
function affBars(affs, unit) {
  const val = a => (unit.id === 'count' ? a.count : a.beds);
  const list = affs.filter(a => val(a) > 0).sort((a, b) => val(b) - val(a) || a.index - b.index);
  if (!list.length) return `<p class="hint">ไม่มี${esc(unit.subject)}</p>`;
  const max = Math.max(1, ...list.map(val));
  return `<ul class="mix-list" aria-label="สังกัด (${esc(unit.one)})">${list.map(a => `
    <li><button type="button" class="mix-row" data-action="filter-aff" data-value="${esc(a.id)}" title="ดูเฉพาะ${esc(a.th)} · ${num(a.count)} แห่ง · ${num(a.beds)} เตียง"><span class="mix-label">${pic('affiliation', 'mix-pic')}${esc(a.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${Math.max(3, Math.round((val(a) / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(val(a))}</span></button></li>`).join('')}</ul>`;
}

/** Records per bed band (bars scaled among the bands); facilities without beds and with unknown beds follow as one line,
 *  the unknown ones beside the hatched no-data swatch (never a band, never 0). */
function sizeBars(sizes) {
  const any = sizes.bands.some(b => b.count);
  if (!any && !sizes.unknown && !sizes.zero) return '';
  const max = Math.max(1, ...sizes.bands.map(b => b.count));
  const width = n => (n ? Math.max(3, Math.round((n / max) * 100)) : 0);
  const bars = any ? `<ul class="mix-list size-list" aria-label="ขนาดตามจำนวนเตียง (แห่ง)">${sizes.bands.map(b => `
    <li><span class="mix-label">${esc(b.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${width(b.count)}%"></span></span>
      <span class="mix-value data-number" title="${num(b.beds)} เตียง">${num(b.count)}</span></li>`).join('')}</ul>` : '';
  const rest = [sizes.zero ? `<span>ไม่มีเตียง ${nw(`<strong class="data-number">${num(sizes.zero)}</strong> แห่ง`)}</span>` : '',
    sizes.unknown ? `<span title="ไม่ทราบจำนวนเตียง"><i class="nodata-swatch legend-nodata" aria-hidden="true"></i>ไม่ทราบ ${nw(`<strong class="data-number">${num(sizes.unknown)}</strong> แห่ง`)}</span>` : '']
    .filter(Boolean).join('<span aria-hidden="true">·</span>');
  return `${bars}${rest ? `<p class="fact-line size-rest">${rest}</p>` : ''}`;
}

function rowMeta(r, {showArea = false, index = null, distance = null, groups = null} = {}) {
  const area = showArea && index && r.area ? index.byId.get(r.area) : null;
  const d = distance?.get?.(r.id);
  return [bedsText(r), groups?.[r.group]?.short || '', area ? placeName(area) : showArea && !r.area ? (r.province ? provinceName(r.province) : 'ไม่ระบุจังหวัด') : '',
    Number.isFinite(d) ? meters(d) : ''].filter(Boolean).join(' · ');
}

/** Facilities: cue (facility group) + name, then beds · where · distance. */
export function facilityList(rows, opts = {}) {
  return `<ul class="outlet-list">${rows.map(r => `<li><button type="button" class="brand-row" data-action="select-facility" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name || 'ไม่มีชื่อ')}</strong>${subLine(r, 'row-branch', 'span')}<span class="row-meta">${esc(rowMeta(r, opts))}</span></span></button></li>`).join('')}</ul>`;
}

/** "ดูทั้งหมด 193 แห่ง" under a shortened list. */
const moreButton = count => `<p class="list-more"><button type="button" class="link-button" data-action="open-table">ดูทั้งหมด ${num(count)} แห่ง</button></p>`;

/** Districts ranked by the measure, bars in the map's 41-sample ramp colour (classOf). */
function areaRanking(list, classOf, unit, {title, note = '', limit = 10, showProvince = false, id = 'rank-title'} = {}) {
  const top = list.filter(a => a.value > 0).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(a => a.value));
  return `<section class="panel-section" aria-labelledby="${esc(id)}">
    <div class="section-heading">${heading('area', title, id)}<span class="hint">${esc(note)}</span></div>
    <ol class="rank-list">${top.map((a, i) => {
      const other = unit.id === 'count' ? `${num(a.beds)} เตียง` : `${num(a.count)} แห่ง`;
      const where = `${showProvince ? `${provinceName(a.province)} · ` : ''}${num(a.value)} ${unit.one} · ${other}`;
      return `<li><button type="button" class="rank-row" data-action="select-area" data-id="${esc(a.id)}" aria-label="อันดับ ${i + 1} ${esc(placeName(a))} ${showProvince ? esc(provinceName(a.province)) : ''} ${num(a.value)} ${esc(unit.one)} ${esc(other)}">
        <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
        <span class="rank-name">${esc(placeName(a))}<small>${esc(where)}</small></span>
        <span class="rank-track" aria-hidden="true"><span class="rank-fill" style="width:${Math.max(3, Math.round((a.value / max) * 100))}%;background:${esc(classOf(a))}"></span></span>
        <span class="rank-value data-number" aria-hidden="true">${num(a.value)}</span></button></li>`;
    }).join('')}</ol>
  </section>`;
}

/** Stations of CityMETER · Transit whose 500 m holds the most of the measure (each row at its nearest station). */
function stationRanking(list, unit, {title = 'สถานีที่มีเตียงรอบ ๆ มากที่สุด', limit = 6} = {}) {
  const top = list.filter(s => s.value > 0).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(s => s.value));
  return `<section class="panel-section"><div class="section-heading">${heading('rail', title)}<span class="hint" title="ระยะตรงจากสถานีที่เปิดแล้ว">${pic('distance', 'hint-pic')}≤ 500 ม.</span></div>
    <ol class="rank-list">${top.map((s, i) => `<li><button type="button" class="rank-row" data-action="select-station" data-id="${esc(s.station.id)}" aria-label="${esc(stationName(s.station))} ${num(s.value)} ${esc(unit.one)}">
      <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
      <span class="rank-name">${esc(stationShort(s.station))}<small>${esc(`${num(s.count)} แห่ง · ${num(s.beds)} เตียง`)}</small></span>
      <span class="rank-track" aria-hidden="true"><span class="rank-fill rail-fill" style="width:${Math.max(3, Math.round((s.value / max) * 100))}%"></span></span>
      <span class="rank-value data-number" aria-hidden="true">${num(s.value)}</span></button></li>`).join('')}</ol></section>`;
}

/** "x จาก y เตียง ห่างสถานีที่เปิดแล้วไม่เกิน 500 ม." — the title and accessible text of a rail share. */
const railDetail = (s, unit) => `${num(s.within)} จาก ${num(s.base)} ${unit.one} ห่างสถานีรถไฟฟ้าที่เปิดแล้วไม่เกิน 500 ม. (ระยะตรง)`;

/** "มีหลักฐานมาตรฐาน HA หรือ JCI 120 แห่ง" — accreditation evidence of a selection, as a fact line. */
const accreditedLine = (n, of) => (n ? `<p class="fact-line" title="หลักฐานมาตรฐานที่เผยแพร่ (HA ระบุขั้น หรือ JCI) ${num(n)} จาก ${num(of)} แห่ง">${pic('accredit', 'fact-icon')}มาตรฐาน HA หรือ JCI ${nw(`<strong class="data-number">${num(n)}</strong> แห่ง`)}</p>` : '');

/* ---------- Overview ---------- */

/** The district(s) with the most of the measure outside the leading province — every district tied at that value. */
function outsideLine(insight, home, unit, province) {
  const o = insight.outside;
  if (!o || province || o.value < 2) return '';
  const linkTo = a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(placeName(a))}</button> ${esc(provinceName(a.province))}`;
  const tied = o.tied || [o];
  const top = insight.areas[0];
  const lead = `${pic('rank')}อันดับ 1 นอก${esc(home)}`;
  if (tied.length === 1) {
    const more = top && o.value > top.value ? ` · มากกว่าทุก${esc(areaWord(insight.home))}ของ${esc(home)}` : '';
    return `<p class="aha-secondary">${lead}: ${linkTo(tied[0])} ${valueText(o.value, unit)}${more}</p>`;
  }
  const shown = tied.slice(0, 3), rest = tied.length - shown.length;
  return `<p class="aha-secondary">${lead} (เท่ากัน ${num(tied.length)} พื้นที่): ${shown.map(linkTo).join(' · ')}${rest ? ` +${num(rest)}` : ''} · ${valueText(o.value, unit)}</p>`;
}

/** Rail comparison of the Aha as two bars: the focus vs the rest of the province (bases in the title and for screen
 *  readers); hidden when nothing is near rail. */
function railCompare(insight, unit, count, w) {
  const f = insight.rail?.focus, r = insight.rail?.rest;
  if (!f || !r || !f.base || !r.base || !(f.within + r.within)) return '';
  const here = count === 1 ? placeName(insight.areas[0]) : `${num(count)} ${w}นี้`;
  const bar = (label, s) => `<li title="${esc(railDetail(s, unit))}"><span class="mix-label">${esc(label)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill rail-fill" style="width:${Math.max(2, Math.round((s.within / s.base) * 100))}%"></span></span>
      <span class="mix-value data-number">${pct(s.within, s.base)}</span><span class="sr-only">${esc(railDetail(s, unit))}</span></li>`;
  return `<div class="aha-rail"><p class="aha-rail-title">${pic('rail')}ใกล้รถไฟฟ้า ≤ 500 ม.</p>
    <ul class="mix-list rail-compare">${bar(here, f)}${bar(`${w}อื่น`, r)}</ul></div>`;
}

/** The affiliation filter's card: what the affiliation holds in the scope. */
export function renderAffCard(p, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit;
  const rail = p.rail?.base ? metricTile(pct(p.rail.within, p.rail.base), 'ใกล้รถไฟฟ้า', 'rail', railDetail(p.rail, unit)) : '';
  return `<section class="brand-card detail-head" aria-labelledby="aff-title">
      <div class="identity">${pic('affiliation', 'identity-pic')}<div>
        <p class="eyebrow">สังกัดตามทะเบียน HCODE</p>
        <h2 id="aff-title">${esc(p.aff.th)}</h2></div></div>
      ${p.count ? `<div class="metrics compact">${metricTile(p.beds, 'เตียง', 'beds')}${metricTile(p.count, 'แห่ง', 'hospital')}${metricTile(p.provinces, 'จังหวัด', 'province')}${rail}</div>` : ''}
      <div class="detail-actions"><button type="button" class="btn quiet" data-action="clear-filter" data-id="aff">ดูทุกสังกัด</button></div>
    </section>`;
}

/**
 * focusMode: 'auto' (default top districts) · 'explicit' (user-chosen) · 'none' (every district).
 */
export function renderOverview({insight, summary, overview, focusMode = 'auto', classOf = () => 'var(--scale-count-3)', provinces = [], unknownProvince = 0,
  province = '', affCard = '', stations = [], ctx = {}}) {
  const unit = ctx.unit;
  const count = insight.areas.length;
  const w = words(insight.areas);
  const names = insight.areas.map(a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join(' · ');
  const home = provinceName(insight.home);
  let aha;
  if (!summary.count && focusMode !== 'explicit') {
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2>ไม่พบสถานพยาบาลตามตัวกรองนี้</h2>
      <div class="aha-actions"><button type="button" data-action="clear-filter" data-id="all" class="btn">ล้างตัวกรอง</button></div></section>`;
  } else if (focusMode === 'explicit') {
    aha = `<section class="aha is-focused" aria-label="ข้อค้นพบ"><p class="eyebrow">โฟกัส ${num(count)} ${esc(w)}</p>
      <h2>${insight.areas.map(a => esc(a.name)).join(' · ')}</h2>
      <p class="aha-copy">${valueText(insight.value, unit)}${unit.id === 'count' ? '' : ` · ${nw(`${num(insight.count)} แห่ง`)}`}</p>
      <div class="aha-actions"><button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (unit.id === 'beds' && overview.count > 0 && overview.beds === 0) {
    // A selection the register lists without beds (primary care, clinics): its records, and the switch to them.
    const allUnknown = overview.bedsUnknown === overview.count;
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${num(overview.count)}</span><span class="aha-headline">แห่ง · ${allUnknown ? 'ไม่ทราบจำนวนเตียง' : 'ไม่มีเตียงตามทะเบียน'}</span></h2>
      <div class="aha-actions"><button type="button" data-action="set-metric" data-value="count" class="btn primary">นับเป็นแห่ง</button><button type="button" data-action="open-table" class="btn quiet">ดูรายชื่อ</button></div></section>`;
  } else if (!count && insight.spread) {
    const sw = areaWord(insight.home), sp = insight.spread;
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${num(sp.areas)}</span><span class="aha-headline">${esc(sw)}ใน${esc(home)} มี${esc(unit.subject)}เท่ากัน ${esc(sw)}ละ ${num(sp.value)} ${esc(unit.one)}</span></h2>
      ${outsideLine(insight, home, unit, province)}
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  } else if (!count) {
    aha = `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2><span class="aha-number data-number">${num(summary.count)}</span><span class="aha-headline">แห่ง · ไม่ระบุเขต/อำเภอ</span></h2>
      <div class="aha-actions"><button type="button" data-action="open-table" class="btn">ดูรายชื่อ</button></div></section>`;
  } else {
    const toggle = focusMode === 'auto'
      ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button>'
      : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(count)} ${esc(w)}นี้</button>`;
    const where = count === 1 ? esc(placeName(insight.areas[0])) : ` ${nw(`${num(count)} ${esc(w)}นี้`)}`;
    const total = insight.homeValue ?? insight.homePlacedValue;
    const subject = unit.id === 'count' ? 'สถานพยาบาลใน' : 'เตียงใน';
    aha = `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${pct(insight.value, total)}</span><span class="aha-headline">ของ${esc(subject)}${esc(home)} อยู่ใน${where}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.value)}</strong> จาก ${num(total)} ${esc(unit.one)}`)}</p>
      ${railCompare(insight, unit, count, w)}${outsideLine(insight, home, unit, province)}
      <div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  }
  const narrowed = focusMode !== 'none' && count > 0 && summary.count !== overview.count;
  const metrics = `<section class="metrics" aria-label="${narrowed ? 'ตัวเลขของพื้นที่ที่โฟกัส' : 'ตัวเลขรวมของข้อมูลที่เลือก'}">
    ${metricTile(summary.beds, `เตียง${narrowed ? ' ในโฟกัส' : ''}`, 'beds', summary.bedsUnknown ? `ไม่ทราบจำนวนเตียง ${num(summary.bedsUnknown)} แห่ง` : '')}
    ${metricTile(summary.count, `แห่ง${narrowed ? ' ในโฟกัส' : ''}`, 'hospital')}
    ${metricTile(summary.areas, narrowed ? w : 'เขต/อำเภอ', 'area')}
    ${metricTile(summary.provinces, 'จังหวัด', 'province')}
  </section>`;
  const scopeText = province ? provinceName(province) : 'ประเทศไทย';
  const provinceRows = p => `<li><button type="button" class="province-row" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(p.name)} ${num(p.value)} ${esc(unit.one)} กดเพื่อดูจังหวัด"><i class="province-swatch" style="background:${esc(p.fill)}" aria-hidden="true"></i><span class="province-name">${esc(p.name)}</span><span class="province-count data-number">${num(p.value)}<small>${esc(unit.one)}</small></span></button></li>`;
  const shown = provinces.slice(0, 8), rest = provinces.slice(8);
  const unknown = unknownProvince ? `<p class="hint">ไม่ระบุจังหวัด ${nw(`${num(unknownProvince)} แห่ง`)}</p>` : '';
  const provinceList = provinces.length > 1 ? `<section class="panel-section" aria-labelledby="province-title">
    <div class="section-heading">${heading('province', `จังหวัดที่มี${unit.subject}มากที่สุด`, 'province-title')}<span class="hint">${num(provinces.length)} จังหวัด</span></div>
    <ul class="province-list">${shown.map(provinceRows).join('')}</ul>
    ${rest.length ? `<details class="more-provinces"><summary>อีก ${num(rest.length)} จังหวัด</summary><ul class="province-list">${rest.map(provinceRows).join('')}</ul></details>` : ''}
    ${unknown}</section>` : '';
  const rw = province ? areaWord(province) : 'เขต/อำเภอ';
  const ranking = areaRanking(overview.ranking, classOf, unit, {title: `${rw}ที่มี${unit.subject}มากที่สุด`, note: `${num(overview.ranking.filter(a => a.value > 0).length)} ${rw}`, showProvince: !province});
  const mix = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภท')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(overview.mix.byGroup, unit)}</section>` : '';
  const sizes = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('beds', 'ขนาดตามจำนวนเตียง')}<span class="hint">แห่ง</span></div>${sizeBars(overview.sizes)}</section>` : '';
  const affs = overview.count && !affCard ? `<section class="panel-section"><div class="section-heading">${heading('affiliation', 'สังกัด')}<span class="hint"><button type="button" class="link-button" data-action="open-charts" data-value="aff">${esc(unit.one)}</button></span></div>${affBars(overview.affs, unit)}${accreditedLine(overview.accredited, overview.count)}</section>` : '';
  const rail = stationRanking(stations, unit, {title: `สถานีที่มี${unit.subject}รอบ ๆ มากที่สุด`});
  return `${affCard}${aha}${metrics}${provinceList}${ranking}${rail}${mix}${sizes}${affs}${affCard ? '' : actionBar({kind: 'overview', province: province ? provinceName(province) : ''})}${provenance(ctx, scopeText, {rail: Boolean(rail || insight.rail?.focus?.within), quality: Boolean(overview.accredited && !affCard)})}`;
}

/* ---------- Empty selections (EVID-05) ---------- */

/**
 * measured_zero: every district is in the register's national scope, so a district with no record under the
 * filters is a measured 0 of this dataset — offered with where the same filters match. Never "no data".
 */
function selectionNote(p, place, ctx) {
  if (p.coverageState !== 'measured_zero') return '';
  const elsewhere = p.scopeCount > 0
    ? `<span>พบในพื้นที่อื่น <strong class="data-number">${num(p.scopeCount)}</strong> แห่ง</span><button type="button" class="btn quiet" data-action="leave-area">ดูพื้นที่ที่พบ</button>`
    : '';
  return `<div class="empty-note" role="note"><strong>ไม่พบสถานพยาบาลใน${esc(place)}${ctx.filtered ? 'ตามตัวกรองนี้' : ''}</strong>${elsewhere}</div>`;
}

/* ---------- District (เขต/อำเภอ) ---------- */

export function renderArea(p, classOf, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.area, w = p.words;
  const place = `${w.area}${a.name}`, prov = provinceName(a.province);
  const rank = p.rank ? `<p class="rank-line">${pic('rank')}อันดับ ${num(p.rank)} จาก ${num(p.rankOf)} ทั่วประเทศ${p.rankProvince && p.rankProvinceOf > 1 ? ` · ${num(p.rankProvince)} จาก ${num(p.rankProvinceOf)} ใน${esc(prov)}` : ''}</p>` : '';
  const listLimit = 30;
  const share = p.count && p.provinceValue ? pct(p.value, p.provinceValue) : '—';
  const shareDetail = p.count && p.provinceValue ? `${num(p.value)} จาก ${num(p.provinceValue)} ${unit.one}ของ${prov}` : '';
  const railShare = p.rail?.base ? pct(p.rail.within, p.rail.base) : '—';
  const head = `<section class="detail-head">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${esc(w.area)} · <button type="button" class="link-button" data-action="select-province" data-id="${esc(a.province)}">${esc(prov)}</button></p>
      <h2>${esc(place)}</h2>${LANG === 'en' ? `<p class="subtle" lang="th" translate="no">${esc(place)}</p>` : a.nameEn ? `<p class="subtle">${esc(a.nameEn)}</p>` : ''}
      ${rank}
      <div class="metrics compact">${metricTile(p.beds, 'เตียง', 'beds', p.bedsUnknown ? `ไม่ทราบจำนวนเตียง ${num(p.bedsUnknown)} แห่ง` : '')}${metricTile(p.count, 'แห่ง', 'hospital')}${metricTile(share, `ของ${prov}`, 'province', shareDetail)}${metricTile(railShare, 'ใกล้รถไฟฟ้า', 'rail', p.rail?.base ? railDetail(p.rail, unit) : '')}</div>
      ${selectionNote(p, place, ctx)}
      ${actionBar({kind: 'area', area: {place, province: prov}})}
      <div class="detail-actions">${p.count ? '<button type="button" class="btn" data-action="open-table">ดูรายชื่อ</button><button type="button" class="btn quiet" data-action="open-charts">เปรียบเทียบพื้นที่</button>' : ''}${link(productionLink({province: a.province, area: a.id}), 'ดูใน CityMETER', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `${place} ${prov}`;
  if (!p.count) return `${head}${provenance(ctx, boundary)}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภท')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(p.byGroup, unit)}</section>
    <section class="panel-section"><div class="section-heading">${heading('beds', 'ขนาดตามจำนวนเตียง')}<span class="hint">แห่ง</span></div>${sizeBars(p.sizes)}</section>
    <section class="panel-section"><div class="section-heading">${heading('affiliation', 'สังกัด')}<span class="hint">${esc(unit.one)}</span></div>${affBars(p.affs, unit)}${accreditedLine(p.accredited, p.count)}</section>
    ${stationRanking(p.stations, unit, {title: 'สถานีใกล้สถานพยาบาล'})}
    <section class="panel-section"><div class="section-heading">${heading('hospital', 'สถานพยาบาล')}<span class="hint">เรียงตามเตียง</span></div>${facilityList(p.rows.slice(0, listLimit), {groups: ctx.groups})}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {rail: Boolean(p.rail?.base), quality: Boolean(p.accredited)})}`;
}

/* ---------- Station (CityMETER · Transit) ---------- */

export function renderStation(p, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, s = p.station;
  const building = s.status !== 'operating';
  const listLimit = 40;
  const head = `<section class="detail-head station">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${pic('rail', 'identity-pic')}<div>
        <p class="eyebrow">สถานีรถไฟฟ้า${s.lines?.length ? ` · ${esc(s.lines.join(' · '))}` : ''}${building ? ` · ${pic('construction')}กำลังสร้าง` : ''}</p>
        <h2>สถานี${esc(s.name)}</h2>${LANG === 'en' ? `<p class="subtle" lang="th" translate="no">สถานี${esc(s.name)}</p>` : s.nameEn ? `<p class="subtle">${esc(s.nameEn)}</p>` : ''}</div></div>
      <div class="metrics compact">${metricTile(p.beds, 'เตียง', 'beds')}${metricTile(p.count, 'แห่ง', 'hospital', `สถานพยาบาลที่มีหมุดในรัศมี ${meters(p.radius)}`)}${metricTile(p.radius, 'ม. รอบสถานี', 'distance', `ระยะตรงจากจุดอ้างอิงของสถานี ${meters(p.radius)}`)}</div>
      ${actionBar({kind: 'station', station: s, point: {lat: s.lat, lon: s.lon, role: 'station'}})}
      <div class="detail-actions">${link(stationLink(s), 'ดูใน CityMETER Transit', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `รัศมี ${meters(p.radius)} จากสถานี${s.name}`;
  if (!p.count) return `${head}<div class="empty-note" role="note"><strong>ไม่พบสถานพยาบาลรอบสถานีนี้</strong></div>${provenance(ctx, boundary, {rail: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภท')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(p.byGroup, unit)}${accreditedLine(p.accredited, p.count)}</section>
    <section class="panel-section"><div class="section-heading">${heading('hospital', 'สถานพยาบาล')}<span class="hint">เรียงตามเตียง</span></div>${facilityList(p.rows.slice(0, listLimit), {showArea: true, index: ctx.index, distance: p.distance, groups: ctx.groups})}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {rail: true, quality: Boolean(p.accredited)})}`;
}

/* ---------- Building (display-time spatial join) ---------- */

/** Where a drawn building's outline and height come from (carried over from CityMETER · Hotel 0.3.0: per อปท./เขต). */
export const BUILDING_SOURCE_TH = Object.freeze({osm: 'OpenStreetMap', cm: 'CityMETER Building V4'});

export function renderBuilding(b, ctx = {}) {
  if (!b) return '';
  const w = b.words;
  const area = b.area ? `${w.area}${b.area.name}` : '';
  const source = BUILDING_SOURCE_TH[b.kind] || BUILDING_SOURCE_TH.osm;
  // “สูงราว”: a CityMETER height is the dataset's model estimate, an OSM height a tag or the schema's default; the
  // source is named in the title and in the provenance line.
  const height = b.height != null ? `<span title="ความสูงจาก ${esc(source)}">สูงราว ${num(Math.round(b.height))} ม.</span>` : '';
  const withPoint = b.rows.find(hasPoint);
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${pic('building')} ${b.area ? `<button type="button" class="link-button" data-action="select-area" data-id="${esc(b.area.id)}">${esc(area)}</button>` : 'อาคาร'}${height ? ` · ${height}` : ''}</p>
      <h2>สถานพยาบาลในอาคารนี้</h2>
      <div class="metrics compact">${metricTile(b.beds, 'เตียง', 'beds')}${metricTile(b.count, 'แห่ง', 'hospital')}</div>
      ${actionBar({kind: 'building', rows: b.rows, area: b.area ? {place: area, province: provinceName(b.area.province)} : null,
        point: withPoint ? {lat: withPoint.latitude, lon: withPoint.longitude, role: 'point'} : null})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('hospital', 'สถานพยาบาล')}<span class="hint">${num(b.count)}</span></div>${facilityList(b.rows.slice(0, 40), {showArea: b.areaCount > 1, index: ctx.index, groups: ctx.groups})}
      ${b.count > 40 ? moreButton(b.count) : ''}</section>
    ${provenance(ctx, `หมุดในขอบอาคาร ${source}${area ? ` · ${area}` : ''}`)}`;
}

/* ---------- Facility ---------- */

/** "฿1,855" — a basket sum or one item price. */
export const priceText = thb => baht(thb);
/** The five basket levels as a small step meter: the level's own step filled, the others outlined. */
function levelMeter(level, levels) {
  return `<span class="level-meter" aria-hidden="true">${levels.map((_, i) => `<i class="${i === level ? 'is-on' : i < level ? 'is-below' : ''}"></i>`).join('')}</span>`;
}

/** Lab prices (DIT): the six-item basket with its level among the 262 facilities that list all six, else one item. */
function priceSection(r, meta) {
  const basket = meta?.basket || {};
  const levels = basket.levels || [];
  if (r.basket) {
    const lvl = levels[r.basket.level] || '';
    const cut = basket.cutoffs || [];
    const ruleTitle = cut.length === 4 ? `ระดับเทียบ ${num(basket.cohort || 0)} แห่งที่มีครบ 6 รายการ · แบ่ง 5 กลุ่มที่ ${cut.map(c => baht(c)).join(' / ')}` : '';
    return `<section class="panel-section price-section"><div class="section-heading">${heading('lab', 'ราคาแล็บ 6 รายการ')}<span class="hint">DIT</span></div>
      <p class="price-head" title="${esc(ruleTitle)}"><strong class="data-number">${esc(baht(r.basket.sum))}</strong> ${levelMeter(r.basket.level, levels)}<span class="price-level">${esc(lvl)}</span></p>
      <ul class="price-items">${r.basket.items.map(it => `<li title="รหัส DIT ${esc(it.dit)}"><span>${esc(it.th)}</span><span class="data-number">${esc(baht(it.thb))}</span></li>`).join('')}</ul></section>`;
  }
  if (r.ref) {
    return `<section class="panel-section price-section"><div class="section-heading">${heading('lab', 'ราคาแล็บ')}<span class="hint">DIT</span></div>
      <p class="price-head" title="รหัส DIT ${esc(r.ref.dit)}"><span>${esc(r.ref.th)}</span> <strong class="data-number">${esc(baht(r.ref.thb))}</strong></p></section>`;
  }
  return '';
}

/** Services as the sheet records them: domains providers declare, services the NHSO register lists, programmes. */
function serviceSection(r) {
  const s = r.svc;
  if (!s || !(s.domains.length || s.named.length || s.programmes.length || s.team)) return '';
  const chips = list => `<ul class="chip-list">${list.map(x => `<li><span class="brand-chip is-static"><span>${esc(x)}</span></span></li>`).join('')}</ul>`;
  const more = (list, word) => (list.length > 8
    ? `${chips(list.slice(0, 8))}<details class="more-services"><summary>อีก ${num(list.length - 8)} ${word}</summary>${chips(list.slice(8))}</details>` : chips(list));
  const named = more(s.named, 'รายการ');
  return `<section class="panel-section service-section"><div class="section-heading">${heading('service', 'บริการ')}</div>
    ${s.domains.length ? `<p class="service-kind">${pic('hospital', 'fact-icon')}สาขาที่เว็บไซต์ระบุ</p>${more(s.domains.map(d => d.th), 'สาขา')}` : ''}
    ${s.named.length ? `<p class="service-kind">${pic('network', 'fact-icon')}บริการตามทะเบียน สปสช.</p>${named}` : ''}
    ${s.programmes.length ? `<p class="service-kind">${pic('accredit', 'fact-icon')}โปรแกรมที่ได้รับรอง</p>${more(s.programmes, 'โปรแกรม')}` : ''}
    ${s.team ? `<p class="fact-line">${pic('meeting', 'fact-icon')}มีทีมดูแลร่วมที่ระบุชัด</p>` : ''}
  </section>`;
}

/** Comparison set: the rule as chips (group · beds · radius), nearest first, and every record round the facility. */
function compsetSection(c, group) {
  if (!c) return '';
  const rule = [`${pic('segment')}${esc(group || 'ประเภทเดียวกัน')}`, c.rule.min ? `${pic('beds')}${num(c.rule.min)}–${num(c.rule.max)} เตียง` : '',
    `${pic('distance')}≤ ${esc(meters(c.radius))}`].filter(Boolean).map(t => `<span class="rule-chip">${t}</span>`).join('');
  const list = c.rows.length
    ? `<ul class="outlet-list compset">${c.rows.map(({row: r, m}) => `<li><button type="button" class="brand-row" data-action="select-facility" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name)}</strong><span class="row-meta">${esc([meters(m), bedsText(r), r.ha?.th || '', r.jci.length ? 'JCI' : ''].filter(Boolean).join(' · '))}</span></span></button></li>`).join('')}</ul>`
    : '<p class="hint">ไม่พบสถานพยาบาลตามเกณฑ์นี้</p>';
  const title = c.rule.min ? `ประเภทเดียวกัน เตียงครึ่งเท่าถึงสองเท่า ในระยะตรง ${meters(c.radius)} เรียงใกล้ก่อน` : `ประเภทเดียวกัน ในระยะตรง ${meters(c.radius)} เรียงใกล้ก่อน`;
  return `<section class="panel-section"><div class="section-heading">${heading('compare', 'คู่เทียบ')}<span class="hint">${num(c.matches)} แห่ง</span></div>
    <p class="rule-chips" title="${esc(title)}">${rule}</p>${list}
    <p class="fact-line" title="สถานพยาบาลทุกประเภทที่มีหมุด ในระยะตรง ${esc(meters(c.radius))}">${pic('hospital', 'fact-icon')}สถานพยาบาลบนแผนที่รอบ ${esc(meters(c.radius))} ${nw(`<strong class="data-number">${num(c.around.count)}</strong> แห่ง`)} · ${nw(`${num(c.around.beds)} เตียง`)}</p></section>`;
}

export function renderFacility(d, ctx = {}) {
  if (!d) return '';
  const r = d.row, w = d.words, meta = ctx.meta || {};
  const prov = provinceName(r.province);
  const coords = hasPoint(r) ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '';
  const areaChip = d.area
    ? `<button type="button" class="fact-chip" data-action="select-area" data-id="${esc(d.area.id)}">${pic('area')}${esc(w.area)}${esc(d.area.name)} · ${esc(prov)}</button>`
    : r.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(r.province)}">${pic('province')}${esc(prov)}</button>` : '<span class="fact-chip is-quiet">ไม่ระบุจังหวัด</span>';
  const size = SIZE_BANDS.find(b => b.id === r.size);
  const bedsChip = `<span class="fact-chip" title="จำนวนเตียงตามทะเบียน HCODE">${pic('beds')}${esc(bedsText(r))}${size ? ` · ${esc(size.short)}` : ''}</span>`;
  const affChip = d.affiliation ? `<button type="button" class="fact-chip" data-action="filter-aff" data-value="${esc(d.affiliation.id)}" title="สังกัดตามทะเบียน HCODE · ดูทุกแห่งของสังกัดนี้">${pic('affiliation')}${esc(d.affiliation.th)}</button>` : '';
  const levelChip = r.level ? `<span class="fact-chip" title="ระดับตามทะเบียน HCODE${r.level.th ? ` · ${esc(r.level.th)}` : ''}">${pic('level')}ระดับ ${esc(r.level.id)}${r.level.th ? ` · ${esc(r.level.th)}` : ''}</span>` : '';
  const haChip = r.ha ? `<span class="fact-chip" title="มาตรฐาน HA ที่เผยแพร่${r.ha.to ? ` · ช่วงรับรองถึง ${esc(thaiDate(r.ha.to))}` : ''}">${pic('accredit')}${esc(r.ha.th)}${r.ha.to ? ` · ถึง ${nw(esc(thaiDate(r.ha.to)))}` : ''}</span>` : '';
  const jciChip = r.jci.length ? `<span class="fact-chip" title="${esc(r.jci.map(j => j.programme).join(' · '))}">${pic('accredit')}JCI${r.jci.length > 1 ? ` · ${num(r.jci.length)} โปรแกรม` : ''}</span>` : '';
  const roleChip = r.role ? `<span class="fact-chip" title="บทบาทในเครือข่ายหน่วยบริการ สปสช. (CityMETER Hospital)">${pic('network')}${esc(r.role.th)}</span>` : '';
  const railChip = r.rail ? `<button type="button" class="fact-chip" data-action="select-station" data-id="${esc(r.rail.station.id)}" title="สถานีที่เปิดแล้วที่ใกล้ที่สุด · ระยะตรง">${pic('rail')}${esc(stationShort(r.rail.station))} ${nw(esc(meters(r.rail.m)))}</button>` : '';
  const nextChip = r.railNext && (!r.rail || r.railNext.m < r.rail.m)
    ? `<span class="fact-chip" title="สถานีที่กำลังสร้างที่ใกล้ที่สุด · ระยะตรง">${pic('construction')}${esc(stationShort(r.railNext.station))} ${nw(esc(meters(r.railNext.m)))} · กำลังสร้าง</span>` : '';
  const bd = d.building;
  const buildingChip = bd?.others ? `<button type="button" class="fact-chip" data-action="select-building" data-id="${esc(bd.key)}" title="หมุดของสถานพยาบาลอีก ${num(bd.others)} แห่งอยู่ในอาคารนี้บนแผนที่">${pic('building')}อีก ${num(bd.others)} แห่งในอาคารนี้</button>` : '';
  const cancelled = r.registry === 'cancelled' ? '<span class="fact-chip is-quiet" title="สถานะรหัสในทะเบียน HCODE">ยกเลิกรหัสในทะเบียน</span>' : '';
  // The facility's campus site (49_SITE_BOUNDARY_CHECK, Hospital 0.5.2): its buildings, as the map shows them together.
  const siteChip = r.site ? `<span class="fact-chip" title="อาคารในขอบเขตไซต์ของสถานพยาบาล · ${esc(r.site.source || 'งานวิจัย')}${r.site.on ? ` · ${esc(thaiDate(r.site.on))}` : ''}">${pic('building')}ทั้ง${esc(SITE_WORD[d.group?.id] || 'โครงการ')} ${nw(`${num(r.site.n)} อาคาร`)}</span>` : '';
  const point = coords
    ? `<span class="data-number">${esc(coords)}</span><br><span class="hint">หมุดของ CityMETER Hospital</span>`
    : '<span>ไม่มีหมุด · นับในพื้นที่ตามทะเบียน</span>';
  const haDates = r.ha ? [r.ha.issued ? `ออก ${thaiDate(r.ha.issued)}` : '', r.ha.to ? `ถึง ${thaiDate(r.ha.to)}` : '', r.ha.asOf ? `ข้อมูล ณ ${thaiDate(r.ha.asOf)}` : ''].filter(Boolean).join(' · ') : '';
  const sourceLink = r.source?.id === 'production' ? link(productionLink({province: r.province, area: r.area}), 'ดูใน CityMETER') : link(r.source?.url, 'เว็บทะเบียน');
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(r.series)}</span><div>
        <p class="eyebrow eyebrow-cue">${esc(d.group?.th || '')}${r.rawType && r.rawType !== d.group?.th ? ` · ${esc(r.rawType)}` : ''}</p>
        <h2>${esc(r.name || 'ไม่มีชื่อ')}</h2>
        ${subLine(r, 'branch-name', 'p')}</div></div>
      <div class="fact-chips">${bedsChip}${areaChip}${affChip}${levelChip}${haChip}${jciChip}${roleChip}${siteChip}${railChip}${nextChip}${buildingChip}${cancelled}${coords ? '' : '<span class="fact-chip is-quiet">ไม่มีหมุด</span>'}</div>
      ${actionBar({kind: 'facility', row: r, area: d.area ? {place: `${w.area}${d.area.name}`, province: prov} : r.province ? {place: '', province: prov} : null,
        point: hasPoint(r) ? {lat: r.latitude, lon: r.longitude, role: 'point'} : null})}
      <details class="source-details"><summary>ที่มาและพิกัด</summary>
        <dl class="facts">
          <dt>แหล่ง</dt><dd>${esc(r.source?.th || 'ทะเบียนทางการ')}${sourceLink ? ` · ${sourceLink}` : ''}</dd>
          <dt>รหัส</dt><dd><span class="hint data-number">${esc(r.id)}</span></dd>
          ${r.nameOff ? `<dt>${OFFICIAL_NAME}</dt><dd>${esc(r.nameOff)}</dd>` : ''}
          <dt>ประเภทตามทะเบียน</dt><dd>${esc(r.rawType || 'ไม่ระบุ')}</dd>
          <dt>พื้นที่</dt><dd>${esc(ADMIN_TH[r.admin] || '')}</dd>
          <dt>พิกัด</dt><dd>${point}</dd>
          <dt>เตียง</dt><dd>${esc(bedsText(r))} · ทะเบียน HCODE</dd>
          ${r.ha ? `<dt>HA</dt><dd>${esc(r.ha.th)}${haDates ? ` · ${esc(haDates)}` : ''}</dd>` : ''}
          ${r.jci.length ? `<dt>JCI</dt><dd>${r.jci.map(j => `${esc(j.programme)}${j.on ? ` · มีผล ${nw(esc(thaiDate(j.on)))}` : ''}`).join('<br>')}</dd>` : ''}
          ${r.basket || r.ref ? `<dt>ราคาแล็บ</dt><dd>${link(meta.basket?.source || 'https://hospitals.dit.go.th/', 'กรมการค้าภายใน (DIT)')}${meta.basket?.checkedOn?.length ? ` · ตรวจ ${nw(esc(thaiDate(meta.basket.checkedOn.at(-1))))}` : ''} · วันที่มีผลไม่ระบุในแหล่ง</dd>` : ''}
          ${r.svc?.on ? `<dt>บริการ</dt><dd>ตรวจ ${nw(esc(thaiDate(r.svc.on)))}</dd>` : ''}
          ${r.registry ? `<dt>สถานะรหัส</dt><dd>${r.registry === 'cancelled' ? 'ยกเลิก' : 'กำลังใช้งาน'} · ทะเบียน HCODE</dd>` : ''}
          ${r.site ? `<dt>ไซต์</dt><dd>${nw(`${num(r.site.n)} อาคาร`)} · ${esc(r.site.source || 'งานวิจัย')}${r.site.url ? ` · ${link(r.site.url, 'หน้าอ้างอิง')}` : ''}${r.site.credit ? ` · ${link(r.site.credit.url, r.site.credit.text)}` : ''}${r.site.on ? ` · ${nw(esc(thaiDate(r.site.on)))}` : ''}</dd>` : ''}
        </dl>
        <p class="links">${d.area ? link(productionLink({province: r.province, area: r.area}), 'ดูพื้นที่นี้ใน CityMETER') : ''}</p>
      </details>
    </section>
    ${priceSection(r, meta)}
    ${serviceSection(r)}
    ${compsetSection(d.compset, d.group?.th)}
    ${provenance(ctx, d.area ? `${w.area}${d.area.name} ${prov}` : prov || 'ไม่ระบุจังหวัด', {rail: Boolean(r.rail || r.railNext), quality: Boolean(r.ha || r.jci.length), price: Boolean(r.basket || r.ref), services: Boolean(r.svc), site: r.site || null})}`;
}

/* ---------- Active filter chips ---------- */

export function renderFilterChips(values, labels) {
  const chips = [];
  const push = (key, text) => chips.push(`<li><button type="button" class="filter-chip" data-action="clear-filter" data-id="${esc(key)}" aria-label="ล้างตัวกรอง ${esc(text)}"><span>${esc(text)}</span><i aria-hidden="true">×</i></button></li>`);
  if (values.search) push('search', `ค้นหา “${values.search}”`);
  if (values.group) push('group', labels.group[values.group] || values.group);
  if (values.size) push('size', labels.size[values.size] || values.size);
  if (values.province) push('province', labels.province[values.province] || values.province);
  if (values.aff) push('aff', labels.aff[values.aff] || values.aff);
  return chips.length ? `<ul class="filter-chips" aria-label="ตัวกรองที่ใช้อยู่">${chips.join('')}<li><button type="button" class="filter-chip clear-all" data-action="clear-filter" data-id="all">ล้างทั้งหมด</button></li></ul>` : '';
}
