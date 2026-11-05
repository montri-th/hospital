import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {summarizeAreaInsight, filterAreaRows, RAIL_M} from '../js/area-insight.js';
import {levelWords, areaLabel} from '../js/areas.js';
import {filterRows} from '../js/model.js';
import {buildAreaModel} from '../js/map-layers.js';
import {buildProvinceModel} from '../js/provinces.js';
import {SUPPLY_SCALE, COUNT_SCALE} from '../js/scales.js';

test('first Aha (snapshot fixture, beds): the three เขต with the most registered beds in the province holding the most beds placed at district level', () => {
  const {data, index} = load();
  const a = summarizeAreaInsight(data.rows, index);
  assert.equal(a.metric, 'beds');
  assert.equal(a.home, 'BKK');
  assert.deepEqual(a.areas.map(x => [x.id, x.name, x.value]), [['1037', 'ราชเทวี', 5891], ['1020', 'บางกอกน้อย', 2863], ['1007', 'ปทุมวัน', 2230]]);
  assert.deepEqual([a.value, a.homePlacedValue, a.homeValue, Math.round(a.share)], [10984, 34030, 34030, 32], 'the share is of the province\'s whole total (placed and province-only rows)');
  assert.deepEqual([a.count, a.homePlaced, a.homeUnplacedValue, a.homeBedsUnknown], [243, 3439, 0, 1659]);
  // Rail (CityMETER · Transit): within 500 m of an operating station, rows with a point only; both bases stated.
  assert.equal(RAIL_M, 500);
  assert.deepEqual([a.rail.focus.within, a.rail.focus.base, a.rail.focus.noPoint], [4198, 10983, 1]);
  assert.deepEqual([a.rail.rest.within, a.rail.rest.base, a.rail.rest.noPoint], [8285, 22430, 616]);
  assert.equal(a.rail.focus.base + a.rail.focus.noPoint, a.value, 'beds with and without a point add up to the focus');
  // The district with the most beds outside Bangkok.
  assert.deepEqual([a.outside.id, a.outside.name, a.outside.province, a.outside.value], ['5001', 'เมืองเชียงใหม่', 'CMI', 4113]);
  assert.ok(a.outside.value < a.areas[0].value);
  assert.deepEqual(filterAreaRows(data.rows, new Set(a.areaIds)).length, a.count);
});

test('records Aha: the focus never cuts through a tie (Bangkok: two เขต above a tie); หาดใหญ่ holds more records than any เขต', () => {
  const {data, index} = load();
  const c = summarizeAreaInsight(data.rows, index, {metric: 'count'});
  assert.equal(c.home, 'BKK');
  assert.deepEqual(c.areas.map(x => [x.name, x.value]), [['บางกะปิ', 150], ['จตุจักร', 148]]);
  assert.deepEqual([c.value, c.homePlacedValue, c.homeValue], [298, 3439, 3439]);
  assert.equal(c.homeAreaIds.length, 50);
  assert.deepEqual([c.outside.name, c.outside.value], ['หาดใหญ่', 460]);
  assert.ok(c.outside.value > c.areas[0].value, 'the panel says “มากกว่าทุกเขตของกรุงเทพมหานคร”');
});

test('the focus never cuts through a tie; a province where every district holds the same value is “spread”', () => {
  const {index} = load();
  const row = (area, beds, i) => ({id: `t${area}-${i}`, area, province: index.byId.get(area).province, beds, latitude: null, longitude: null});
  // Bangkok: 1033 (40), then 1037 and 1039 tied (20) above 1001 (10): only the district above the tie is the focus.
  const tie = [row('1033', 40, 1), row('1037', 20, 1), row('1039', 20, 1), row('1001', 10, 1)];
  assert.deepEqual(summarizeAreaInsight(tie, index).areas.map(a => a.id), ['1033', '1037', '1039'], 'the cut after three is above the tie');
  const tie4 = [...tie, row('1002', 20, 1)];
  assert.deepEqual(summarizeAreaInsight(tie4, index).areas.map(a => a.id), ['1033'], 'three districts tied at 20: only 1033 is above them');
  const spread = [row('1033', 5, 1), row('1037', 5, 1), row('1039', 5, 1), row('1001', 5, 1)];
  const s = summarizeAreaInsight(spread, index);
  assert.deepEqual(s.areas, []);
  assert.deepEqual(s.spread, {areas: 4, value: 5});
});

test('the Aha follows the filters: a province, a group, a group without beds, nothing', () => {
  const {data, index} = load();
  const cmi = summarizeAreaInsight(filterRows(data.rows, {province: 'CMI'}), index);
  assert.equal(cmi.home, 'CMI');
  assert.deepEqual(cmi.areas.map(a => a.name), ['เมืองเชียงใหม่', 'แม่ริม', 'สันทราย']);
  assert.equal(cmi.outside, null, 'a one-province selection has no outside finding');
  const priv = summarizeAreaInsight(filterRows(data.rows, {group: 'private'}), index);
  assert.deepEqual([priv.home, priv.areas.map(a => a.name)], ['BKK', ['ห้วยขวาง', 'วัฒนา', 'พญาไท']]);
  // Sub-district health-promoting hospitals have no beds in the register: no beds Aha (the panel offers records).
  const rpst = summarizeAreaInsight(filterRows(data.rows, {group: 'subdistrict'}), index);
  assert.deepEqual([rpst.home, rpst.areas.length, rpst.spread], ['', 0, null]);
  assert.ok(summarizeAreaInsight(filterRows(data.rows, {group: 'subdistrict'}), index, {metric: 'count'}).areas.length > 0);
  const none = summarizeAreaInsight([], index);
  assert.deepEqual([none.areas.length, none.share, none.home], [0, 0, '']);
});

test('district model: EVID-05 — a district without beds is a measured zero; records with no known beds are no data for beds, never 0', () => {
  const {data, index} = load();
  const beds = buildAreaModel(data.rows, index);
  assert.equal(beds.areas.length, 928);
  assert.equal(beds.zeroCount, 12, 'every district holds a record; 12 of them no beds');
  assert.equal(beds.ramp.scaleId, SUPPLY_SCALE.scaleId);
  assert.deepEqual([beds.ramp.min, beds.ramp.max, beds.ramp.steps], [5, 5891, 41]);
  assert.equal(beds.byId.get('1037').fill, SUPPLY_SCALE.lut[40], 'ราชเทวี (the national maximum) closes the ramp on sample 40');
  assert.ok(beds.areas.filter(a => a.state === 'measured_zero').every(a => a.beds === 0));
  const count = buildAreaModel(data.rows, index, {metric: 'count'});
  assert.equal(count.ramp.scaleId, COUNT_SCALE.scaleId);
  assert.equal(count.zeroCount, 0);
  // A district whose records all have unknown beds: no_data under beds, a measured value under records.
  const unknown = [{id: 'u1', area: '1001', province: 'BKK', beds: null}, {id: 'k1', area: '1033', province: 'BKK', beds: 120}];
  assert.equal(buildAreaModel(unknown, index, {province: 'BKK'}).byId.get('1001').state, 'no_data');
  assert.equal(buildAreaModel(unknown, index, {province: 'BKK', metric: 'count'}).byId.get('1001').state, 'measured');
  // A reported 0 is a measured 0, not no data.
  const zero = [{id: 'z1', area: '1001', province: 'BKK', beds: 0}, {id: 'k1', area: '1033', province: 'BKK', beds: 120}];
  assert.equal(buildAreaModel(zero, index, {province: 'BKK'}).byId.get('1001').state, 'measured_zero');
});

test('province frames total the measure per province; rows without a province are on no frame', () => {
  const {data, provincesGeo} = load();
  const m = buildProvinceModel(data.rows, provincesGeo);
  assert.equal(m.provinces.length, 77);
  const by = new Map();
  for (const r of data.rows) if (r.province) by.set(r.province, (by.get(r.province) || 0) + (r.beds > 0 ? r.beds : 0));
  for (const p of m.provinces) assert.equal(p.value, by.get(p.code) || 0, p.code);
  assert.equal(m.provinces.find(p => p.code === 'BKK').fill, SUPPLY_SCALE.lut[40], 'Bangkok closes the province ramp');
  assert.equal(m.zeroCount, 0, 'every province holds beds');
  const none = buildProvinceModel([], provincesGeo);
  assert.ok(none.provinces.every(p => p.state === 'measured_zero'));
});

test('level words follow the province: เขต in Bangkok, อำเภอ elsewhere', () => {
  const {index} = load();
  assert.deepEqual(levelWords('BKK'), {area: 'เขต'});
  assert.deepEqual(levelWords('PKT'), {area: 'อำเภอ'});
  assert.equal(areaLabel(index.byId.get('1039')), 'เขตวัฒนา');
  assert.equal(areaLabel(index.byId.get('8301')), 'อำเภอเมืองภูเก็ต');
});
