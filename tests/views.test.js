import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {buildOverview, buildAreaProfile, buildFacilityDetail, buildBuildingProfile, buildAffProfile, buildStationProfile, stationsOf, compsetOf, listOrder, unplacedOf, COMPSET_RADIUS_M, COMPSET_RADIUS_SMALL_M} from '../js/profile-model.js';
import {renderOverview, renderArea, renderBuilding, renderFacility, renderStation, renderAffCard, renderFilterChips, provenance, pct, meters, bedsText, thaiDate} from '../js/panel.js';
import {summarizeAreaInsight, filterAreaRows} from '../js/area-insight.js';
import {summarize, productionLink, filterRows, unitWords, hasPoint, stationLink} from '../js/model.js';
import {buildChartModel, areaMatrix, affiliationRanking} from '../js/chart-model.js';
import {buildBreadcrumb, renderBreadcrumb, breadcrumbText, productionHref} from '../js/breadcrumb.js';
import {CUES, CUE_PATHS, GROUP_SERIES, cueMarkup, seriesOf} from '../js/cues.js';
import {contextActions} from '../js/ask.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const ctxFor = (data, index, metric = 'beds', filtered = false) => ({meta: data.meta, unit: unitWords(metric), index, groups: data.groups, filtered});
/** Bumrungrad International (production record): beds, HA, JCI, a DIT basket, services and a rail station nearby. */
const FACILITY = 'CMH-11699';
const VICTORY = 'RAILCAT:BTS_SUKHUMVIT:N3';

function views(metric = 'beds') {
  const {data, index} = load();
  const rows = data.rows, ctx = ctxFor(data, index, metric);
  const insight = summarizeAreaInsight(rows, index, {metric});
  const facility = rows.find(r => r.id === FACILITY);
  const victory = data.stations.find(s => s.id === VICTORY);
  const priv = filterRows(rows, {aff: 'private'});
  const detail = r => buildFacilityDetail(r, {scopeRows: rows, allRows: rows, index, groups: data.groups, affiliations: data.affiliations});
  return {
    overview: renderOverview({insight, summary: summarize(filterAreaRows(rows, new Set(insight.areaIds))), overview: buildOverview(rows, index, {groups: data.groups, affiliations: data.affiliations, metric}),
      focusMode: 'auto', provinces: [], unknownProvince: 0, province: '', stations: stationsOf(rows, metric), ctx}),
    area: renderArea(buildAreaProfile(rows, '1037', index, data.groups, {metric, affiliations: data.affiliations}), () => '#000', ctx),
    facility: renderFacility(detail(facility), ctx),
    hcode: renderFacility(detail(rows.find(r => !hasPoint(r) && r.groupId === 'clinic')), ctx),
    station: renderStation(buildStationProfile(victory, {scopeRows: rows, groups: data.groups, metric}), {...ctx, index}),
    building: renderBuilding(buildBuildingProfile({key: 'osm:1', kind: 'osm', rows: rows.filter(hasPoint).slice(0, 3), height: 24}, index, data.groups), ctx),
    aff: renderOverview({insight: summarizeAreaInsight(priv, index, {metric}), summary: summarize(priv),
      overview: buildOverview(priv, index, {groups: data.groups, affiliations: data.affiliations, metric}), focusMode: 'auto', province: '',
      affCard: renderAffCard(buildAffProfile('private', {scopeRows: priv, affiliations: data.affiliations, metric}), ctx), ctx}),
  };
}

test('every panel view ends with one provenance line — dataset · source · date · boundary, then the method — and carries no caveat on screen', () => {
  for (const metric of ['beds', 'count']) {
    for (const [name, html] of Object.entries(views(metric))) {
      const t = text(html);
      for (const k of ['dataset', 'source', 'date', 'boundary']) assert.equal((html.match(new RegExp(`data-prov="${k}"`, 'g')) || []).length, 1, `${name}: ${k}`);
      assert.ok(t.includes('ชุดข้อมูล CityMETER Hospital'), `${name}: dataset`);
      assert.ok(/แหล่ง\s*จาก CityMETER Hospital · ทะเบียน HCODE/.test(t), `${name}: source`);
      assert.ok(t.includes('ตรวจ 1 พ.ย. 2569'), `${name}: date`);
      assert.ok(/ขอบเขต \S/.test(t), `${name}: boundary`);
      assert.ok(html.includes('<span class="prov-part prov-method"><a href="DATA_METHOD.md"'), `${name}: the method link`);
      assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: exactly one provenance line`);
      // Owner rule carried over from Hotel 0.3.1: “ไม่มี caveats เลย” — exactness comes from names, numerators and
      // denominators, and the provenance.
      assert.ok(!/ไม่ใช่|ยังไม่ได้ตรวจ|อาจเป็น|ไม่ได้แปลว่า|ยืนยันแล้ว|ค่าประมาณ|นับในยอดรวม|ข้อจำกัด/.test(t), `${name}: no caveat on screen — ${(t.match(/.{0,40}(ไม่ใช่|ยังไม่ได้ตรวจ|อาจเป็น|ไม่ได้แปลว่า|ยืนยันแล้ว|ค่าประมาณ|นับในยอดรวม|ข้อจำกัด).{0,40}/) || [''])[0]}`);
      assert.ok(!/ตั้งอยู่ใน|ส่วนแบ่งตลาด|อัตราครองเตียง|รายได้|ความหนาแน่น|ต่อประชากร|คุณภาพดี|อันดับคุณภาพ/.test(t), `${name}: no located-inside, share, occupancy, revenue, density, per-capita or quality-rank claim`);
    }
  }
});

test('first screen (beds): the Aha with numerator and denominator, the rail comparison as two bars with both bases, the outside finding', () => {
  const o = text(views().overview);
  assert.ok(o.includes('32% ของเตียงในกรุงเทพมหานคร อยู่ใน 3 เขตนี้'), o.slice(0, 300));
  assert.ok(o.includes('ราชเทวี · บางกอกน้อย · ปทุมวัน') && o.includes('10,984 จาก 34,030 เตียง'), 'the share of the province\'s whole total');
  assert.ok(o.includes('ใกล้รถไฟฟ้า ≤ 500 ม. 3 เขตนี้ 38% 4,198 จาก 10,983 เตียง') && o.includes('เขตอื่น 37% 8,285 จาก 22,430 เตียง'), 'both bases in the accessible text');
  assert.ok(o.includes('อันดับ 1 นอกกรุงเทพมหานคร: อำเภอเมืองเชียงใหม่ เชียงใหม่ 4,113 เตียง'));
  assert.ok(!o.includes('มากกว่าทุกเขตของกรุงเทพมหานคร'), 'เมืองเชียงใหม่ holds fewer beds than ราชเทวี');
  assert.ok(o.includes('สถานีที่มีเตียงรอบ ๆ มากที่สุด') && o.includes('อนุสาวรีย์ชัยสมรภูมิ (สุขุมวิท) 6 แห่ง · 1,490 เตียง'));
  assert.ok(o.includes('มาตรฐาน HA หรือ JCI 1,727 แห่ง'));
  assert.ok(/ไม่มีเตียง [\d,]+ แห่ง · ไม่ทราบ 16,453 แห่ง/.test(o), 'no beds and unknown beds are their own line, never a 0-bed band');
  const c = text(views('count').overview);
  assert.ok(c.includes('9% ของสถานพยาบาลในกรุงเทพมหานคร อยู่ใน 2 เขตนี้') && c.includes('298 จาก 3,439 แห่ง'));
  assert.ok(c.includes('อันดับ 1 นอกกรุงเทพมหานคร: อำเภอหาดใหญ่ สงขลา 460 แห่ง · มากกว่าทุกเขตของกรุงเทพมหานคร'));
});

test('a selection the register lists without beds offers its records instead of an empty Aha', () => {
  const {data, index} = load();
  const rpst = filterRows(data.rows, {group: 'subdistrict'});
  const html = renderOverview({insight: summarizeAreaInsight(rpst, index), summary: summarize(rpst), overview: buildOverview(rpst, index, {groups: data.groups, affiliations: data.affiliations}),
    focusMode: 'auto', province: '', ctx: ctxFor(data, index)});
  const t = text(html);
  assert.ok(t.includes(`${rpst.length.toLocaleString('en-US')} แห่ง · ไม่มีเตียงตามทะเบียน`), t.slice(0, 200));
  assert.match(html, /data-action="set-metric" data-value="count"[^>]*>นับเป็นแห่ง</);
  assert.ok(!t.includes('ไม่ระบุเขต/อำเภอ'), 'placed rows without beds are not “unplaced”');
});

test('district, station, affiliation and facility panels: ranks, shares, straight-line context, quality, lab prices and the comparison set', () => {
  const v = views();
  const a = text(v.area);
  assert.ok(a.includes('เขตราชเทวี') && a.includes('อันดับ 1 จาก 916 ทั่วประเทศ · 1 จาก 46 ในกรุงเทพมหานคร'), a.slice(0, 240));
  assert.ok(a.includes('17% ของกรุงเทพมหานคร 5,891 จาก 34,030 เตียงของกรุงเทพมหานคร'), 'the share tile carries numerator and denominator');
  assert.ok(a.includes('32% ใกล้รถไฟฟ้า 1,910 จาก 5,891 เตียง'));
  assert.ok(a.includes('โรงพยาบาลพระมงกุฎเกล้า 1,236 เตียง') && a.includes('ดูทั้งหมด 80 แห่ง'));
  const s = text(v.station);
  assert.ok(s.includes('สถานีอนุสาวรีย์ชัยสมรภูมิ') && s.includes('1,636 เตียง') && s.includes('7 แห่ง') && s.includes('500 ม. รอบสถานี'));
  assert.ok(s.includes('โรงพยาบาลราชวิถี 909 เตียง · รพ.รัฐอื่น · เขตราชเทวี · 180 ม.'));
  assert.ok(v.station.includes('pic-distance'), 'the straight-line radius carries the distance pictogram');
  const h = text(v.facility);
  assert.ok(h.includes('โรงพยาบาลบำรุงราษฎร์') && h.includes('538 เตียง · 500+') && h.includes('เขตวัฒนา · กรุงเทพมหานคร'));
  assert.ok(h.includes('HA ขั้นก้าวหน้า · ถึง 22 พ.ค. 2572') && h.includes('JCI · 3 โปรแกรม') && h.includes('เพลินจิต (สุขุมวิท) 520 ม.'));
  assert.ok(h.includes('ราคาแล็บ 6 รายการ DIT ฿7,840 สูงมาก') && h.includes('CBC ฿780'), 'the basket, its level and its items');
  assert.ok(h.includes('วันที่มีผลไม่ระบุในแหล่ง'), 'the price date is a field of the closed source details');
  assert.ok(h.includes('คู่เทียบ 3 แห่ง โรงพยาบาลเอกชน 269–1,076 เตียง ≤ 5 กม.'), 'the comparison rule as chips');
  assert.ok(h.includes('โรงพยาบาลสมิติเวช 2.9 กม. · 275 เตียง · HA ขั้นมาตรฐาน'));
  assert.ok(h.includes('สถานพยาบาลบนแผนที่รอบ 5 กม. 114 แห่ง · 14,652 เตียง'));
  assert.ok(h.includes('สาขาที่เว็บไซต์ระบุ') && h.includes('อีก 18 สาขา'), 'long service lists fold after eight');
  assert.ok(h.includes('ปลูกถ่ายตับ (สมาชิกสามัญ)') && !h.includes('รายชื่อโรงพยาบาลสมาชิก'), 'programme scopes in the words people read');
  const ch = text(v.aff);
  assert.ok(ch.includes('สังกัดตามทะเบียน HCODE เอกชน') && ch.includes('42,876 เตียง') && ch.includes('29,362 แห่ง') && ch.includes('ดูทุกสังกัด'));
  assert.deepEqual([meters(84), meters(1291), meters(2000)], ['80 ม.', '1.3 กม.', '2 กม.']);
});

test('comparison set: same group, beds within ½–2×, straight line ≤ 5 km (≤ 2 km without beds), nearest first; never itself; no point → none', () => {
  const {data} = load();
  const h = data.rows.find(r => r.id === FACILITY);
  const c = compsetOf(h, data.rows);
  assert.equal(c.radius, COMPSET_RADIUS_M);
  assert.deepEqual(c.rule, {group: h.group, min: 269, max: 1076});
  assert.ok(c.rows.every(x => x.row !== h && x.row.group === h.group && x.row.beds >= 269 && x.row.beds <= 1076 && x.m <= 5000));
  for (let i = 1; i < c.rows.length; i++) assert.ok(c.rows[i - 1].m <= c.rows[i].m);
  const rpst = data.rows.find(r => r.groupId === 'subdistrict' && hasPoint(r));
  assert.equal(compsetOf(rpst, data.rows).radius, COMPSET_RADIUS_SMALL_M);
  assert.equal(compsetOf({...h, latitude: null, longitude: null}, data.rows), null);
});

test('missing stays missing: no point, unknown beds, a reported 0 — each says so, never 0 or a guessed place', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const t = text(views().hcode);
  assert.ok(t.includes('ไม่มีหมุด') && !t.includes('คู่เทียบ'), 'no point: no comparison set (the chip says why)');
  assert.ok(t.includes('ทะเบียนสถานพยาบาล HCODE กระทรวงสาธารณสุข'), 'the register is the source');
  assert.deepEqual([bedsText({beds: null}), bedsText({beds: 0}), bedsText({beds: 120})], ['ไม่ทราบจำนวนเตียง', 'ไม่มีเตียง', '120 เตียง']);
  const u = unplacedOf(data.rows);
  assert.deepEqual([u.noArea, u.noProvince, u.conflict], [0, 0, 0]);
  const empty = buildAreaProfile([], '1039', index, data.groups);
  assert.equal(empty.coverageState, 'measured_zero');
  assert.ok(text(renderArea(empty, () => '#000', ctx)).includes('ไม่พบสถานพยาบาลในเขตวัฒนา'));
});

test('charts: districts by the measure, district × group matrix with equal cells, affiliations by the measure', () => {
  const {data, index} = load();
  const m = buildChartModel(data.rows, index, data.groups);
  assert.equal(m.areas.length, 20);
  assert.equal(m.totalAreas, 916);
  assert.equal(m.unplacedValue, 0);
  for (let i = 1; i < m.areas.length; i++) assert.ok(m.areas[i - 1].value >= m.areas[i].value);
  const mx = areaMatrix(m);
  assert.equal(mx.cells.length, 12 * data.groups.length);
  for (const a of mx.areas) assert.equal(mx.cells.filter(c => c.areaId === a.id).reduce((s, c) => s + c.value, 0), a.value, 'cells add up to the district');
  const counts = buildChartModel(data.rows, index, data.groups, {metric: 'count'});
  assert.equal(counts.areas[0].name, 'หาดใหญ่');
  // A cell whose records all have unknown beds is unknown (no data, a dash), never a measured 0.
  const one = {id: 'u', area: '1001', province: 'BKK', beds: null, group: 6, groupId: 'clinic'};
  const um = areaMatrix({areas: [{id: '1001', name: 'พระนคร', province: 'BKK', value: 0, rows: [one]}], groups: data.groups, metric: 'beds'});
  assert.deepEqual(um.cells.filter(c => c.unknown).map(c => [c.groupId, c.count, c.value]), [['clinic', 1, 0]]);
  assert.equal(areaMatrix({areas: [{id: '1001', name: 'พระนคร', province: 'BKK', value: 1, rows: [one]}], groups: data.groups, metric: 'count'}).cells.filter(c => c.unknown).length, 0);
  const aff = affiliationRanking(data.rows, data.affiliations);
  assert.equal(aff.total, 5);
  assert.deepEqual(aff.affiliations.slice(0, 3).map(a => [a.id, a.beds]), [['moph', 118485], ['private', 42876], ['public', 22052]]);
});

test('breadcrumb follows production: ประเทศไทย › จังหวัด › เขต/อำเภอ with /D/ deep links and the hospital dataset', () => {
  const {index} = load();
  const area = index.byId.get('1037');
  const crumbs = buildBreadcrumb({province: 'BKK', area});
  assert.equal(breadcrumbText(crumbs), 'ประเทศไทย › กรุงเทพมหานคร › เขตราชเทวี');
  assert.equal(crumbs.at(-1).current, true);
  assert.equal(crumbs[2].href, 'https://landometer.com/v3/citymeter/BKK/D/1037?d=hospital');
  assert.equal(productionHref(crumbs), 'https://landometer.com/v3/citymeter/BKK/D/1037?d=hospital');
  assert.ok(renderBreadcrumb(crumbs).includes('aria-current="location"'));
  assert.equal(breadcrumbText(buildBreadcrumb({area: index.byId.get('8301')})), 'ประเทศไทย › ภูเก็ต › อำเภอเมืองภูเก็ต');
  assert.equal(productionLink(), 'https://landometer.com/v3/citymeter?d=hospital');
  assert.equal(productionLink({province: 'PKT'}), 'https://landometer.com/v3/citymeter/PKT?d=hospital');
  assert.equal(stationLink({id: 'RAILCAT:BTS_SUKHUMVIT:E4'}), 'https://montri-th.github.io/transit/?station=RAILCAT%3ABTS_SUKHUMVIT%3AE4');
});

test('facility groups bind to LDS series by stable id with the series shape cue; no star (it would read as a rating)', () => {
  const {data} = load();
  assert.deepEqual(CUES, ['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'hexagon', 'ring', 'dash', 'plus']);
  assert.deepEqual(GROUP_SERIES, {regional: 1, private: 2, community: 3, public_other: 4, subdistrict: 10, center: 7, clinic: 8, other: 9});
  assert.ok(!Object.values(GROUP_SERIES).includes(6), 'no star');
  assert.equal(new Set(Object.values(GROUP_SERIES)).size, 8, 'one series per group');
  for (const g of data.groups) assert.equal(g.series, seriesOf(g.id));
  for (const name of CUES) assert.ok(CUE_PATHS[name].startsWith('M'));
  assert.match(cueMarkup(2), /class="cue-shape category-2".*data-cue="square".*aria-hidden="true"/);
});

test('lists put the most registered beds first (unknown last), then group and name — deterministic', () => {
  const {data} = load();
  const rows = data.rows.filter(r => r.area === '1037').sort(listOrder);
  assert.deepEqual([...rows].reverse().sort(listOrder).map(r => r.id), rows.map(r => r.id), 'deterministic');
  const v = r => (Number.isFinite(r.beds) ? r.beds : -1);
  for (let i = 1; i < rows.length; i++) assert.ok(v(rows[i - 1]) >= v(rows[i]));
});

test('Google actions: public names and points only, https, the question of the view; Street View only with a point', () => {
  const {data} = load();
  const h = data.rows.find(r => r.id === FACILITY);
  const acts = contextActions({kind: 'facility', row: h, area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}, point: {lat: h.latitude, lon: h.longitude, role: 'point'}});
  assert.deepEqual(acts.map(a => a.id), ['ai', 'maps', 'streetview']);
  assert.ok(acts.every(a => a.href.startsWith('https://www.google.com/')));
  assert.ok(decodeURIComponent(acts[0].href).includes('รับสิทธิบัตรทองประกันสังคมหรือประกันสุขภาพไหม'));
  // Hotel 0.3.3 (owner 2026-11-02 “ทำให้มันตอบทันเลยได้มั้ย”): a plain Google Search, answered at the top by Google's AI
  // Overview — a link straight into AI Mode (udm=50) stops at Google's “Continue with this search?” from another site.
  const all = [acts, contextActions({kind: 'area', area: {place: 'เขตราชเทวี', province: 'กรุงเทพมหานคร'}}),
    contextActions({kind: 'station', station: {name: 'อนุสาวรีย์ชัยสมรภูมิ', lines: ['สุขุมวิท']}}),
    contextActions({kind: 'overview', province: 'เชียงใหม่'}), contextActions({kind: 'building', rows: [h], area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}})];
  for (const list of all) {
    const ai = list.find(a => a.id === 'ai');
    assert.ok(ai, 'every view asks Google AI');
    assert.match(ai.href, /^https:\/\/www\.google\.com\/search\?q=[^&]+$/, 'a plain search, the question only');
    assert.ok(!/udm=/.test(ai.href), 'never straight into AI Mode');
  }
  assert.ok(!acts.some(a => a.href.includes(h.id)), 'no internal id leaves the page');
  assert.deepEqual(contextActions({kind: 'area', area: {place: 'เขตราชเทวี', province: 'กรุงเทพมหานคร'}}).map(a => a.id), ['ai', 'maps']);
  const st = contextActions({kind: 'station', station: {name: 'อนุสาวรีย์ชัยสมรภูมิ', lines: ['สุขุมวิท']}, point: {lat: 13.7627, lon: 100.537, role: 'station'}});
  assert.equal(st.at(-1).label, 'Street View ใกล้สถานี');
});

test('filter chips escape user text, name the filters and offer one clear-all', () => {
  const html = renderFilterChips({search: '<b>ศิริราช</b>', group: 'private', size: 'b4', province: 'BKK', aff: 'moph'},
    {group: {private: 'โรงพยาบาลเอกชน'}, size: {b4: '200–499 เตียง'}, province: {BKK: 'กรุงเทพมหานคร'}, aff: {moph: 'กระทรวงสาธารณสุข'}});
  assert.ok(!html.includes('<b>'));
  for (const w of ['โรงพยาบาลเอกชน', '200–499 เตียง', 'กรุงเทพมหานคร', 'กระทรวงสาธารณสุข']) assert.ok(text(html).includes(w), w);
  assert.equal((html.match(/data-id="all"/g) || []).length, 1);
});

test('shares print whole percentages; a non-zero part never prints as 0%', () => {
  assert.equal(pct(10984, 34030), '32%');
  assert.equal(pct(1, 352), '<1%');
  assert.equal(pct(0, 10), '0%');
  assert.equal(pct(3, 0), '—');
  assert.ok(text(provenance({meta: {checkedOn: '2026-11-01', context: {rail: {asOf: '2026-10-31'}}}, unit: unitWords('beds')}, 'x', {rail: true})).includes('CityMETER Transit 31 ต.ค. 2569'));
});

test('a private hospital reads without its licence class; the register name sits under the heading', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const hc = data.rows.find(r => r.id === 'CMH-11708');
  assert.equal(hc.name, 'โรงพยาบาลบางมด');
  assert.equal(hc.nameOff, 'โรงพยาบาลบางมดโรงพยาบาลทั่วไปขนาดใหญ่');
  const html = renderFacility(buildFacilityDetail(hc, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups, affiliations: data.affiliations}), ctx);
  assert.match(html, /<h2>โรงพยาบาลบางมด<\/h2>/);
  assert.ok(text(html).includes('ชื่อตามทะเบียน โรงพยาบาลบางมดโรงพยาบาลทั่วไปขนาดใหญ่'));
  assert.ok(filterRows(data.rows, {search: 'บางมด'}).includes(hc), 'both names find it');
  assert.ok(!data.rows.some(r => /\S(โรงพยาบาลทั่วไปขนาด(ใหญ่|เล็ก))$/.test(r.name)), 'no shown name ends with a licence class');
});

test('a facility with a campus site (0.5.2) reads “ทั้งโรงพยาบาล N อาคาร”, its site in the details and the provenance; others read as before', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const base = data.rows.find(r => r.id === FACILITY);
  const detail = r => buildFacilityDetail(r, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups, affiliations: data.affiliations});
  // A fixture site (the shape js/model.js gives a row from data/hospitals.json siteGroups), not a published one.
  const site = {points: [[100.5525, 13.7462], [100.5528, 13.7466], [100.5521, 13.7468]], n: 3, on: '2026-11-13',
    source: 'กรอบ OpenStreetMap (ตรวจอัตโนมัติ)', url: 'https://www.openstreetmap.org/way/1',
    credit: {text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright'}};
  const html = renderFacility(detail({...base, site}), ctx), t = text(html);
  assert.ok(t.includes('ทั้งโรงพยาบาล 3 อาคาร'), 'the chip counts the site’s buildings');
  assert.ok(t.includes('ไซต์ 3 อาคาร · กรอบ OpenStreetMap (ตรวจอัตโนมัติ) · หน้าอ้างอิง · © OpenStreetMap contributors · 13 พ.ย. 2569'),
    'the source details name the site source, its reference page, the ODbL credit and the check date');
  assert.ok(html.includes('href="https://www.openstreetmap.org/way/1"') && html.includes('href="https://www.openstreetmap.org/copyright"'));
  assert.match(t, /จาก [^]*ไซต์ กรอบ OpenStreetMap \(ตรวจอัตโนมัติ\) 13 พ\.ย\. 2569/, 'the provenance names the site source and date');
  // The data's own check date stays the research master's: a site never re-dates the facility records.
  assert.ok(t.includes(`ตรวจ ${thaiDate(data.meta.checkedOn)}`), 'the provenance date is the research master’s check');
  const plain = text(renderFacility(detail({...base, site: null}), ctx));
  assert.ok(!/ทั้ง(โรงพยาบาล|โครงการ) \d/.test(plain) && !/(?:^|\s)ไซต์ (?:\d|กรอบ|รูปแปลง|ผัง|งานวิจัย)/.test(plain),
    'a facility without a site carries no site words (“เว็บไซต์” of its services is not one)');
  // The published site of the same facility (data/hospitals.json siteGroups) reads the same way, with its own count.
  assert.ok(base.site?.n >= 2, 'the fixture facility has a published site');
  assert.ok(text(renderFacility(detail(base), ctx)).includes(`ทั้งโรงพยาบาล ${base.site.n} อาคาร`));
});
