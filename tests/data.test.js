import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, frameFiles, sha256} from './helpers.js';
import {hasPoint, filterRows, summarize, rowValue, unitWords, sizeOf, pinSizeOf, SIZE_BANDS} from '../js/model.js';
import {distanceM} from '../js/profile-model.js';

test('hospitals.json decodes to every row of 02_FACILITIES, nothing dropped, ids unique; every tab read is bound by its hash', () => {
  const {raw, data} = load();
  assert.equal(data.dropped, 0);
  assert.equal(data.rows.length, raw.meta.rows);
  assert.equal(data.rows.length, raw.meta.counts.rows);
  assert.equal(data.rows.length, raw.meta.tabs['02_FACILITIES'].rows);
  assert.equal(new Set(data.rows.map(r => r.id)).size, data.rows.length);
  assert.ok(data.rows.every(r => /^(CMH-\d+|HCODE-[0-9A-Z]+)$/.test(r.id)), 'a production record (CMH-*) or an HCODE register record (HCODE-*)');
  for (const [tab, t] of Object.entries(raw.meta.tabs)) assert.match(t.sha256, /^[a-f0-9]{64}$/, tab);
  assert.equal(raw.meta.registryId, 'research.TH.hospital');
  assert.equal(raw.meta.productDataset, 'hospital');
  assert.match(raw.meta.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(raw.meta.readOn >= raw.meta.checkedOn);
});

test('measure contract: beds are the beds HCODE reports — 0 is a reported 0, blank is unknown (never 0); records count once', () => {
  const {raw, data} = load();
  const known = data.rows.filter(r => Number.isFinite(r.beds));
  assert.equal(known.length, raw.meta.counts['beds.known']);
  assert.equal(known.filter(r => r.beds > 0).length, raw.meta.counts['beds.positive']);
  assert.equal(known.reduce((s, r) => s + r.beds, 0), raw.meta.counts['beds.sum']);
  assert.ok(data.rows.every(r => r.beds === null || (Number.isInteger(r.beds) && r.beds >= 0)), 'unknown is null, a reported 0 is 0');
  const s = summarize(data.rows);
  assert.equal(s.beds, raw.meta.counts['beds.sum']);
  assert.equal(s.bedsUnknown, data.rows.length - known.length);
  assert.equal(rowValue({beds: null}, 'beds'), 0, 'an unknown adds nothing to a bed total');
  assert.equal(rowValue({beds: 0}, 'beds'), 0);
  assert.equal(rowValue({beds: null}, 'count'), 1);
  assert.deepEqual([unitWords('beds').one, unitWords('count').one, unitWords('').one], ['เตียง', 'แห่ง', 'เตียง']);
  assert.deepEqual([null, 0, 1, 29, 30, 90, 200, 500].map(sizeOf), ['', '', 'b1', 'b1', 'b2', 'b3', 'b4', 'b5']);
  assert.deepEqual([null, 0, 89, 90, 499, 500].map(pinSizeOf), [0, 0, 0, 1, 1, 2]);
  assert.equal(SIZE_BANDS.length, 5);
});

test('membership: a placed row sits in an existing production district of its own province; the rest stop at province or none', () => {
  const {raw, data, index} = load();
  const by = {};
  for (const r of data.rows) {
    by[r.admin] = (by[r.admin] || 0) + 1;
    if (r.area) {
      const a = index.byId.get(r.area);
      assert.ok(a, r.id);
      assert.equal(a.province, r.province, `${r.id} district in its own province`);
      assert.ok(['name', 'code', 'point'].includes(r.admin));
    } else assert.ok(['province', 'conflict', 'none'].includes(r.admin), r.id);
  }
  for (const k of ['name', 'code', 'point', 'province']) assert.equal(by[k] || 0, raw.meta.counts[`admin.${k}`] || 0, k);
  assert.equal(raw.meta.conflicts.length, by.conflict || 0);
  assert.deepEqual(Object.keys(raw.meta.adminMethods), raw.vocab.admin);
});

test('points are CityMETER production points, inside Thailand; HCODE records carry none; never invented', () => {
  const {raw, data} = load();
  const pts = data.rows.filter(hasPoint);
  assert.equal(pts.length, raw.meta.counts.points);
  assert.equal(pts.length, raw.meta.counts['src.production']);
  assert.ok(pts.every(r => r.coordRole === 'production' && r.source.id === 'production' && r.id.startsWith('CMH-')), 'every drawn point is production’s own');
  assert.ok(pts.every(r => r.latitude > 5.5 && r.latitude < 20.6 && r.longitude > 97.3 && r.longitude < 105.7), 'inside Thailand');
  assert.ok(pts.every(r => Math.round(r.latitude * 1e6) / 1e6 === r.latitude), 'six decimals');
  assert.ok(data.rows.filter(r => !hasPoint(r)).every(r => r.latitude === null && r.longitude === null && r.source.id === 'hcode'));
  assert.equal(raw.meta.points.requests, 928, 'one request per production district');
  assert.match(raw.meta.points.receiptsSha256, /^[a-f0-9]{64}$/);
});

test('groups and affiliations partition the rows; the filters agree with them', () => {
  const {data} = load();
  assert.deepEqual(data.groups.map(g => g.id), ['regional', 'private', 'community', 'public_other', 'subdistrict', 'center', 'clinic', 'other']);
  assert.deepEqual(data.affiliations.map(a => a.id), ['moph', 'local', 'public', 'private', 'none']);
  assert.equal(data.groups.reduce((s, g) => s + filterRows(data.rows, {group: g.id}).length, 0), data.rows.length);
  assert.equal(data.affiliations.reduce((s, a) => s + filterRows(data.rows, {aff: a.id}).length, 0), data.rows.length);
  assert.equal(SIZE_BANDS.reduce((s, b) => s + filterRows(data.rows, {size: b.id}).length, 0), data.rows.filter(r => r.beds > 0).length);
  // Search: every word anywhere in the names, code, group, affiliation or area.
  const siriraj = filterRows(data.rows, {search: 'ศิริราช บางกอกน้อย'});
  assert.ok(siriraj.length >= 1 && siriraj.every(r => /ศิริราช/.test(r.haystack) && /บางกอกน้อย/.test(r.haystack)));
  assert.equal(filterRows(data.rows, {search: '   '}).length, data.rows.length, 'a blank search filters nothing');
});

test('accreditation, lab prices and services are per facility, dated, and never summed across facilities', () => {
  const {raw, data} = load();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const ha = data.rows.filter(r => r.ha), jci = data.rows.filter(r => r.jci.length);
  assert.equal(ha.length, raw.meta.counts.ha);
  assert.equal(jci.length, raw.meta.counts.jci);
  assert.ok(ha.every(r => r.ha.th && (!r.ha.to || iso.test(r.ha.to)) && (!r.ha.issued || iso.test(r.ha.issued))));
  assert.ok(jci.every(r => r.jci.every(j => j.programme && (!j.on || iso.test(j.on)))));
  const b = raw.meta.basket;
  assert.equal(b.items.length, 6);
  assert.equal(b.cutoffs.length, 4);
  const baskets = data.rows.filter(r => r.basket);
  assert.equal(baskets.length, raw.meta.counts.basket);
  assert.equal(baskets.length, b.cohort);
  for (const r of baskets) {
    assert.equal(r.basket.items.length, 6, r.id);
    assert.ok(Math.abs(r.basket.items.reduce((s, it) => s + it.thb, 0) - r.basket.sum) < 0.01, `${r.id}: the sum of its six items`);
    assert.equal(r.basket.level, b.cutoffs.filter(c => r.basket.sum > c + 1e-9).length, `${r.id}: the level follows the cut-offs`);
  }
  assert.equal(data.rows.filter(r => r.ref).length, raw.meta.counts.ref);
  assert.ok(data.rows.filter(r => r.ref).every(r => !r.basket && r.ref.thb > 0 && b.items.some(it => it.dit === r.ref.dit)));
  const svc = data.rows.filter(r => r.svc);
  assert.equal(svc.length, raw.meta.counts.services);
  assert.ok(svc.every(r => !r.svc.on || iso.test(r.svc.on)));
  assert.equal(data.rows.filter(r => r.level).length, raw.meta.counts.level);
  assert.equal(data.rows.filter(r => r.role).length, raw.meta.counts.role);
  assert.ok(data.rows.filter(r => r.role).every(hasPoint), 'the NHSO role comes with the production record');
});

test('context from CityMETER Transit: straight-line distances agree with the published points', () => {
  const {raw, data} = load();
  assert.match(raw.meta.context.rail.commit, /^[0-9a-f]{40}$/);
  assert.match(raw.meta.context.rail.sha256, /^[0-9a-f]{64}$/);
  assert.equal(data.stations.filter(s => s.status === 'operating').length, raw.meta.counts['stations.operating']);
  let checked = 0;
  for (const r of data.rows) {
    if (r.rail) {
      assert.ok(hasPoint(r) && r.rail.station.status === 'operating' && r.rail.m <= 2000, r.id);
      if (checked++ < 400) assert.ok(Math.abs(distanceM(r.latitude, r.longitude, r.rail.station.lat, r.rail.station.lon) - r.rail.m) <= 1.5, r.id);
    }
    if (r.railNext) assert.equal(r.railNext.station.status, 'construction');
  }
  assert.ok(checked > 100);
});

test('campus sites (owner 2026-11-13 “ทำ campus boundary ให้ครอบคลุมทุกอาคารของแต่ละ รพ ที่เป็นกลุ่มอาคาร ในลักษณะเดียวกับที่เราทำแล้วกับ hotel”): a checked site publishes its buildings as points — no boundary, note or checker', () => {
  const {raw, data} = load();
  const meta = raw.meta.siteGroups, groups = Object.entries(raw.siteGroups);
  assert.equal(meta.tab, '49_SITE_BOUNDARY_CHECK');
  assert.equal(groups.length, meta.rows);
  assert.equal(groups.length, raw.meta.counts['site.groups']);
  assert.equal(groups.reduce((s, [, v]) => s + v.n, 0), meta.buildings);
  assert.match(meta.file.sha256, /^[a-f0-9]{64}$/, 'the tab read back is bound by its hash');
  for (const f of ['boundary_geojson', 'notes', 'main_building_note', 'checked_by']) assert.ok(raw.meta.excludedFields.includes(`49_SITE_BOUNDARY_CHECK.${f}`), f);
  assert.equal(meta.maxM, 1100, 'a hospital campus may reach 1,100 m from its pin (Hotel: 600 m)');
  const byId = new Map(data.rows.map(r => [r.id, r]));
  for (const [i, v] of groups) {
    const r = byId.get(raw.cols.key[Number(i)]);
    assert.deepEqual(Object.keys(v).sort(), ['n', 'on', 'pts', 'src', 'url'], 'points, count, date, source code and link only');
    assert.equal(v.n, v.pts.length);
    assert.ok(v.n >= 2, `${r.id}: a site is two buildings or more`);
    assert.equal(new Set(v.pts.map(p => p.join(','))).size, v.n, `${r.id}: one point per building`);
    assert.ok(meta.checkedOn.includes(v.on) && v.on >= raw.meta.checkedOn, `${r.id}: dated by its own check, after the research master's`);
    assert.ok(v.src in meta.sources, `${r.id}: a known boundary source`);
    assert.match(raw.urls[v.url], /^https:\/\/www\.openstreetmap\.org\/(way|relation)\/\d+$/, `${r.id}: the OSM element is the reference page`);
    assert.ok(hasPoint(r) && [0, 1, 2, 3, 4].includes(raw.cols.group[Number(i)]), `${r.id}: a hospital with a point`);
    for (const [lon, lat] of v.pts) {
      assert.ok(Math.round(lon * 1e6) / 1e6 === lon && Math.round(lat * 1e6) / 1e6 === lat);
      assert.ok(distanceM(r.latitude, r.longitude, lat, lon) <= meta.maxM, `${r.id}: a site building within ${meta.maxM} m`);
    }
    assert.deepEqual(r.site.points, v.pts);
    assert.equal(r.site.source, meta.sources[v.src]);
    assert.deepEqual(r.site.credit, {text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright'}, `${r.id}: the ODbL credit`);
  }
  assert.equal(data.rows.filter(r => r.site).length, groups.length, 'no other row carries a site');
  // 0.5.2: every site is an OpenStreetMap area of the hospital's own, checked by rule (osm_polygon_auto).
  assert.deepEqual(meta.bySource, {osm_polygon_auto: 353});
  assert.equal(meta.buildings, 10735);
  assert.deepEqual(meta.credits.osm_polygon_auto, {text: '© OpenStreetMap contributors', licence: 'ODbL 1.0',
    url: 'https://www.openstreetmap.org/copyright', note: 'the site follows an OpenStreetMap area of the facility, checked automatically'});
  const sites = {'CMH-10738': [57, 'way/1561812606'], 'CMH-10660': [110, 'way/712600876'], 'CMH-11699': [7, 'relation/19809956'],
    'CMH-13814': [61, 'relation/10888392'], 'CMH-13756': [73, 'way/31974134'], 'CMH-11004': [44, 'way/817792347'], 'CMH-01598': [2, 'way/1177778842']};
  for (const [id, [n, el]] of Object.entries(sites)) {
    const r = byId.get(id);
    assert.equal(r.site?.n, n, id);
    assert.equal(r.site.source, 'กรอบ OpenStreetMap (ตรวจอัตโนมัติ)', id);
    assert.equal(r.site.url, `https://www.openstreetmap.org/${el}`, id);
  }
  // Held: an area that holds another hospital's pin (Bangkok Hospital, Pat Rangsit), an old site (บ้านไผ่ เก่า), an area
  // named for another village (Ban Pafang), a frame far larger than the hospital (Wattana Nakhon), wider than 1,100 m.
  for (const id of ['CMH-11630', 'CMH-11789', 'CMH-11002', 'CMH-40745', 'CMH-10869', 'CMH-12269']) assert.ok(!byId.get(id).site, `${id}: no site`);
  // Nothing of the boundary or the notes is published.
  const site = JSON.stringify([raw.siteGroups, meta]);
  assert.ok(!/geojson|Polygon|coordinates|โฉนด|ระวาง|เลขที่ดิน|ไร่|Claude/.test(site), 'no boundary shape, deed, sheet note or checker');
  assert.ok(Object.values(raw.siteGroups).every(v => v.pts.flat().every(x => !Number.isInteger(x))), 'points only');
});

test('publication hygiene: no phone, address, licence code, raw record or researcher text; links are https and never a private document', () => {
  const {raw} = load();
  for (const f of ['official_address', 'phone', 'official_license_code', 'notes', 'review_reason_codes', 'data_gap_codes', '99_SOURCE_OBSERVATIONS raw records'])
    assert.ok(raw.meta.excludedFields.includes(f), f);
  const text = JSON.stringify(raw);
  for (const k of ['phone', 'address', 'notes', 'license', 'latitude', 'longitude']) assert.ok(!Object.keys(raw.cols).includes(k), k);
  assert.ok(!/(docs|drive)\.google\.com/.test(text), 'no Google document link');
  assert.ok(!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl/.test(text), 'no map links');
  assert.ok(!/landometer\.com\/api\//.test(raw.urls.join(' ')), 'no internal API link as a source link');
  assert.ok(raw.urls.every(u => /^https:\/\//.test(u)), 'source links are https');
  assert.ok(!/\b0\d{1,2}[- ]?\d{3}[- ]?\d{4}\b/.test(text), 'no telephone-like numbers');
});

test('boundaries: 928 districts and 77 provinces from production; per-province frames match the index; receipts bound by hash', () => {
  const {index, indexJSON, provincesGeo} = load();
  assert.equal(index.areas.length, 928);
  assert.equal(index.provinces.length, 77);
  assert.equal(provincesGeo.features.length, 77);
  assert.ok(index.areas.every(a => a.km2 > 0 && Array.isArray(a.label) && Array.isArray(a.bbox)), 'production area, label and bbox for every district');
  const files = frameFiles();
  assert.equal(files.length, 77);
  let areas = 0;
  for (const f of files) {
    const code = f.replace('.json', ''), frame = readJSON(`data/frames/${f}`), p = index.provinceById.get(code);
    assert.ok(p, code);
    assert.equal(frame.areas.features.length, p.areaTotal, `${code} districts`);
    for (const ft of frame.areas.features) assert.equal(index.byId.get(String(ft.id ?? ft.properties.id))?.province, code);
    areas += frame.areas.features.length;
  }
  assert.equal(areas, 928);
  const receipts = readJSON('data/boundary-receipts.json');
  assert.equal(Object.keys(receipts.base).length, 78, 'the country list + 77 province base-info responses');
  assert.equal(indexJSON.metadata.receipts, 78);
  for (const r of Object.values(receipts.base)) {
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.match(r.url, /^https:\/\/landometer\.com\/api\/v2\/citymeter-v3\/base\/info\//);
    assert.equal(r.status, 200);
  }
  const py = v => (Array.isArray(v) ? `[${v.map(py).join(', ')}]` : v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}: ${py(v[k])}`).join(', ')}}` : JSON.stringify(v));
  assert.equal(sha256(Buffer.from(py(receipts.base))), receipts.baseSha256);
  assert.equal(indexJSON.metadata.receiptsSha256, receipts.baseSha256);
});
