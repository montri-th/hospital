/**
 * This demo's navigation on the shared header code: the titles of its controls and its pictogram subset. The
 * nav-7 glyphs and the help dialog are js/shell/navigation.js, the dataset picker js/shell/header.js
 * (citymeter-shell: edit those in every repository at once, js/shell/manifest.json).
 */
import {installNavigation, NAV_GLYPHS, NAV_ICON_CONTRACT} from './shell/navigation.js';
import {installHeader} from './shell/header.js';

export {NAV_GLYPHS, NAV_ICON_CONTRACT};

/**
 * Metric-tile pictograms (test exception approved by the owner 2026-10-22 for the
 * Luxury Brands demo; this demo builds its own subset from the same source font with
 * scripts/build-pictogram-font.py; to be registered in LDS if it proves itself). Same family and axes as nav-7, a separate
 * subset so the approved nav-7 bytes stay unchanged. Glyph → meaning in Hospital:
 * hospital (local_hospital) = สถานพยาบาล (records, แห่ง) · beds (bed) = เตียง · area (map) = เขต/อำเภอ · province
 * (location_city) = จังหวัด · segment (category) = ประเภทสถานพยาบาล · affiliation (account_balance) = สังกัด · level
 * (stairs) = ระดับตามทะเบียน · accredit (verified) = มาตรฐาน HA/JCI ที่เผยแพร่ · lab (science) = ราคาแล็บ (DIT) ·
 * service (medical_services) = บริการ · network (hub) = เครือข่ายหน่วยบริการ สปสช. · meeting (groups) = ทีมดูแลร่วม ·
 * compare (compare_arrows) = คู่เทียบ · rail (train) = สถานีราง · building (apartment) = อาคาร · rank, date, distance,
 * construction, dataset = the provenance line and short copy (Hotel 0.3.1) · elevation (landscape) = the terrain legend
 * item. No star or medal glyph: it would read as a quality rating.
 */
export const PICTOGRAM_CONTRACT = Object.freeze({
  family: 'LDS Material Symbols Rounded Pictogram',
  file: 'assets/icons/material-pictogram-300.woff2', bytes: 3532,
  sha256: 'baaf50d8a2adab42cedab20c81a044ded820ee7a1783f9c321cb89d8a5ba6f00',
  manifest: 'assets/icons/material-pictogram-300.json',
  axes: Object.freeze({FILL: 0, wght: 300, GRAD: 0, opsz: 24}),
  glyphs: Object.freeze({area: '\uE55B', province: '\uE7F1', segment: '\uE72C', ai: '\uE65F', streetview: '\uE56E', maps: '\uE0C8', building: '\uEA40',
    beds: '\uEFDF', rail: '\uE570', meeting: '\uF233', compare: '\uE915',
    rank: '\uF20C', date: '\uE878', distance: '\uE41C', construction: '\uEA3C', dataset: '\uF20E', elevation: '\uE564',
    hospital: '\uE548', service: '\uF109', accredit: '\uEF76', lab: '\uEA4B', network: '\uE9F4', level: '\uF1A9', affiliation: '\uE84F'}),
  status: 'test exception to LDS nav-7 (owner 2026-10-22; action and building glyphs 2026-10-29; beds, rail, meeting, compare 2026-11-01; rank, date, distance, construction and dataset glyphs 2026-11-01 for short copy; hospital, service, accredit, lab, network, level and affiliation glyphs 2026-11-05 for CityMETER Hospital)',
  fallback: 'Text labels carry the meaning; pictograms stay hidden until the font has loaded.',
});
const TITLES = {
  'fit-map': 'ปรับแผนที่ให้เห็นพื้นที่ที่โฟกัสหรือพื้นที่ที่เลือก',
  'country-map': 'ดูทั้งประเทศรายจังหวัด',
  'toggle-3d': 'สลับ 3 มิติ / 2 มิติ',
  'toggle-neighborhoods': 'แสดงหรือซ่อนสีและขอบเขตเขต/อำเภอ',
  'close-mobile-panel': 'กลับไปแผนที่',
  'sheet-back': 'กลับไปหน้าก่อน',
  'mobile-panel': 'เปิดแผงข้อมูลและตัวกรอง',
  'open-help': 'เปิดวิธีใช้',
  'open-help-sheet': 'เปิดวิธีใช้',
  'toggle-insights': 'เปิดหรือย่อกราฟเปรียบเทียบพื้นที่',
  'open-table': 'เปิดตารางสถานพยาบาลตามตัวกรอง',
  'toggle-table': 'ปิดตารางและกลับไปแผนที่',
  'search': 'ค้นหาชื่อสถานพยาบาล รหัส ประเภท สังกัด เขต/อำเภอ หรือจังหวัด',
  'group': 'กรองตามประเภทสถานพยาบาล',
  'size': 'กรองตามขนาด (จำนวนเตียงตามทะเบียน)',
  'province': 'กรองตามจังหวัด',
  'aff': 'กรองตามสังกัด',
  'prev-page': 'ดูหน้าก่อนหน้าของตาราง',
  'next-page': 'ดูหน้าถัดไปของตาราง',
  'tab-areas': 'เปรียบเทียบเตียงหรือสถานพยาบาลของแต่ละเขต/อำเภอ',
  'tab-mix': 'ดูประเภทสถานพยาบาลในแต่ละเขต/อำเภอ',
  'tab-aff': 'เปรียบเทียบเตียงหรือสถานพยาบาลของแต่ละสังกัด',
};

if (typeof document !== 'undefined') {
  installNavigation({titles: TITLES, pictogramProbe: PICTOGRAM_CONTRACT.glyphs.hospital});
  installHeader();
}
