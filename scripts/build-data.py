#!/usr/bin/env python3
"""Build data/hospitals.json from the hospital research master, CityMETER production (base info and the Hospital
dataset's facility points) and CityMETER · Transit.

Inputs (internal, never committed):
  --tabs     directory of the research master's tabs as read in the owner's browser (scripts/export-sheet-tabs.js:
             <tab>.json = {name, gid, ncols, rows}, rows[0] = the header row) of “CityMETER Hospital Thailand — Research
             Master 2026-10-31” (Google Sheets, registry id research.TH.hospital). The workbook is too large for a Drive
             export (13 MB); every tab is read cell by cell from the sheet's own HTML view and its SHA-256 (rows as
             canonical JSON) is recorded in meta.tabs. Tabs read: 02_FACILITIES, 99_SOURCE_OBSERVATIONS, 08_ACCREDITATION,
             11_PRICE_BASKET, 13_SERVICE_PROFILE, 15_SERVICE_FRAMEWORK, 10_SOURCES, 01_BRANDS, 03_AREA_SUMMARY,
             12_IDENTITY_LINKS.
  --api      production base info with receipts (scripts/fetch-base.py: base-lv0.json, base-{uuid}.json)
  --points   production facility points with receipts (scripts/fetch-points.py: points.json, points-receipts.json)
Public inputs:
  --index    data/area-index.json (district gazetteer)
  --transit  a checkout of montri-th/transit (data/transit.json: rail stations of CityMETER · Transit)

Output: data/hospitals.json — columnar rows + dictionaries + provenance; data/build-report.json — counts and checks.

ONE ROW = one row of 02_FACILITIES: a source identity the owner approved into the dataset (31 Oct 2026) — 12,516
records of CityMETER production Hospital (CMH-*) and 29,312 records of the MOPH health-facility register HCODE that
production does not represent by code (HCODE-*). As the sheet defines it: one source code, not a field-verified census of
unique operating facilities. Nothing is merged, split, moved or re-labelled; the five code successions of
12_IDENTITY_LINKS keep both records, as the sheet does.

NAMES = name_th as the sheet writes it, except a private hospital's licence class appended to the name
(“…โรงพยาบาลทั่วไปขนาดใหญ่”, LICENCE_CLASS): the name reads without it and the full form is kept as the register name
(nameOff, shown under the heading and searched). Programme scopes read “PDSC · …” and “ปลูกถ่ายตับ (สมาชิกสามัญ)”
(programme_name); nothing else is renamed.

BEDS = official_reported_beds_text — the beds in use HCODE reports for the facility, kept as the register writes it: a
number is the reported count (0 is a reported 0: clinics and primary-care units report no beds), blank is unknown (never
0). It is the register's figure, not staffed beds, occupancy or capacity on a given day.

DISTRICT (ADMIN METHODS, the first that applies)
  name      the row's own district (02_FACILITIES.district: HCODE when the code matched, else production) is a
            production district of the row's province
  code      the row's HCODE district code (99_SOURCE_OBSERVATIONS.official_district_code) is a production district of
            the row's province
  point     the row's production point lies in a production district of the row's province (production lists the
            facility under that district)
  province  province only
  conflict  the row's production point lies in another province than its own, and neither its name nor its code places
            it: placed nowhere, reported (meta.conflicts)
A production point that lies in another district than the row's own name or code is kept as a point (it is
production's) and counted for the research team (checks.pointDistrictDisagree, pointProvinceDisagree); membership is
the row's own registered district.

POINTS = production's own points (layer `layer-hospital-detail` of …/citymeter-v3/hospital/overlayMvt, one district per
request, joined by main_code = citymeter_main_code), 6 decimals. HCODE rows carry no point in the sheet and get none:
they count in their district and list, never on the map as a pin.

CONTEXT
  role      production's NHSO service-network group of the facility (CUP · primary · referral · ungrouped), read with the
            point (role_group, is_cup, is_referral); production rows only
  rail      nearest operating rail station of CityMETER · Transit and nearest station under construction, straight line
            from the production point, within RAIL_MAX_M
Never: travel time, catchment, a population ratio or a market share.

QUALITY, LEVEL, PRICE, SERVICES (as the sheet records them; a gap is never a low value)
  level     official_service_plan_level (A · S · M1 · M2 · F1 · F2 · F3 from HCODE, with the register's label)
  ha        HA_published_status (normalised stage), HA_issue_date, HA_expiry_date, quality_level_as_of
  jci       08_ACCREDITATION rows of scheme JCI linked to the facility (programme, effective date)
  basket    11_PRICE_BASKET: the six DIT lab prices, their sum and its quintile level (nearest rank, cohort 262)
  ref       02_FACILITIES.price_reference_service/thb when there is no full basket (one DIT item price)
  services  13_SERVICE_PROFILE: domains providers declare on their own pages, services the NHSO register lists,
            programme scopes (PDSC, HA programmes, membership lists), named team care

Not copied (meta.excludedFields): addresses, licence codes, phone numbers, researcher notes, review and data-gap codes,
identity/operation evidence states, matching rules, internal sheet URLs, raw source records (99_SOURCE_OBSERVATIONS is
read for the register's district codes and level labels only). Source links are public https pages; production rows
link to the same district on CityMETER production (?d=hospital).
"""
import argparse, collections, datetime, glob, hashlib, json, math, os, re, sys, unicodedata

RAIL_MAX_M = 2000
TABS = ['02_FACILITIES', '99_SOURCE_OBSERVATIONS', '08_ACCREDITATION', '11_PRICE_BASKET', '13_SERVICE_PROFILE',
        '15_SERVICE_FRAMEWORK', '10_SOURCES', '01_BRANDS', '03_AREA_SUMMARY', '12_IDENTITY_LINKS']
SHEET_TITLE = 'CityMETER Hospital Thailand — Research Master 2026-10-31'

# Facility groups: official_facility_type of 02_FACILITIES (HCODE) → product group.
GROUPS = [
    ('regional', 'โรงพยาบาลศูนย์และทั่วไป', 'Regional & general hospital', ['โรงพยาบาลศูนย์', 'โรงพยาบาลทั่วไป']),
    ('private', 'โรงพยาบาลเอกชน', 'Private hospital', ['โรงพยาบาลเอกชน']),
    ('community', 'โรงพยาบาลชุมชน', 'Community hospital', ['โรงพยาบาลชุมชน']),
    ('public_other', 'โรงพยาบาลรัฐนอกสังกัดสาธารณสุข', 'Other public hospital', ['โรงพยาบาล นอก สธ.', 'โรงพยาบาล นอก สป.สธ.']),
    ('subdistrict', 'โรงพยาบาลส่งเสริมสุขภาพตำบล', 'Sub-district health-promoting hospital', ['โรงพยาบาลส่งเสริมสุขภาพตำบล']),
    ('center', 'ศูนย์บริการสาธารณสุขและหน่วยปฐมภูมิ', 'Health centre & primary-care unit',
     ['ศูนย์บริการสาธารณสุข อปท.', 'ศูนย์บริการสาธารณสุข', 'ศูนย์สุขภาพชุมชน ของ รพ. / เมือง (ศสม.)',
      'โรงพยาบาล/ศูนย์บริการสาธารณสุข สาขา', 'สถานบริการสาธารณสุขชุมชน', 'หน่วยบริการปฐมภูมิ (PCU)', 'ศูนย์วิชาการ']),
    ('clinic', 'คลินิกเอกชน', 'Private clinic', ['คลินิกเอกชน']),
    ('other', 'ไม่ระบุประเภท', 'Type not recorded', ['']),
]
TYPE_GROUP = {t: i for i, g in enumerate(GROUPS) for t in g[3]}
# Affiliation (official_affiliation, HCODE) → filter group.
AFFILIATIONS = [
    ('moph', 'กระทรวงสาธารณสุข', ['กระทรวงสาธารณสุข']),
    ('local', 'ท้องถิ่นและกรุงเทพมหานคร', ['องค์กรปกครองส่วนท้องถิ่น', 'กรุงเทพมหานคร(สังกัด กทม.)']),
    ('public', 'หน่วยงานรัฐอื่น', []),  # every other public affiliation (ministries, universities, Red Cross, state enterprises …)
    ('private', 'เอกชน', ['เอกชน']),
    ('none', 'ไม่ระบุสังกัด', ['']),
]
AFF_OF = {v: i for i, a in enumerate(AFFILIATIONS) for v in a[2]}
# Bed bands (official_reported_beds_text > 0). Zero and unknown beds stay out of every band.
SIZES = [('b1', 'ไม่ถึง 30 เตียง', 1, 29), ('b2', '30–89 เตียง', 30, 89), ('b3', '90–199 เตียง', 90, 199),
         ('b4', '200–499 เตียง', 200, 499), ('b5', '500 เตียงขึ้นไป', 500, 10 ** 6)]
ADMIN = ['name', 'code', 'point', 'province', 'conflict', 'none']
# Service-plan levels of HCODE (official_service_plan_level), largest first.
LEVELS = ['A', 'S', 'M1', 'M2', 'F1', 'F2', 'F3']
# HA_published_status → normalised stage (scheme, stage). The sheet's text is kept in the source details.
HA_STAGES = [
    ('ha_advanced', 'HA ขั้นก้าวหน้า', ['ขั้นก้าวหน้า', 'HA ขั้นก้าวหน้า']),
    ('ha_standard', 'HA ขั้นมาตรฐาน', ['ขั้นมาตรฐาน', 'HA ขั้นมาตรฐาน']),
    ('ha_dev2', 'HA ขั้นพัฒนา 2', ['ขั้นพัฒนา ขั้นที่ 2', 'HA ขั้นพัฒนา ขั้นที่ 2']),
    ('ha_dev1', 'HA ขั้นพัฒนา 1', ['ขั้นพัฒนา ขั้นที่ 1']),
    ('phc_standard', 'ปฐมภูมิ ขั้นมาตรฐาน', ['ปฐมภูมิ ขั้นมาตรฐาน', 'PHCA ขั้นมาตรฐาน']),
    ('phc_dev', 'ปฐมภูมิ ขั้นพัฒนา', ['ปฐมภูมิ ขั้นพัฒนา']),
    ('ha_process', 'HA ระหว่างกระบวนการ', ['อยู่ระหว่างกระบวนการต่ออายุ', 'อยู่ระหว่างกระบวนการขั้นพัฒนา', 'อยู่ระหว่างกระบวนการขอรับรองขั้นก้าวหน้า']),
    ('ha_listed', 'HA ไม่ระบุขั้น', ['ไม่มีขั้น']),
    ('ha_directory', 'HA Accreditation2', ['HA directory: Accreditation2']),  # the HA directory's own category word
]
HA_OF = {v: i for i, s in enumerate(HA_STAGES) for v in s[2]}
# NHSO service-network group of production (role_group 1–4: view_hospital_role_group — open rows of NHSO's
# mastercupuc, CUP first, else primary, else referral, else ungrouped), in production's own words.
ROLES = [('cup', 'หน่วยบริการประจำ / แม่ข่าย'), ('primary', 'หน่วยปฐมภูมิ'), ('referral', 'หน่วยรับส่งต่อเฉพาะ'),
         ('ungrouped', 'ไม่พบในเครือข่าย สปสช.')]
BASKET = [('CBC_30101_thb', 'CBC', '30101'), ('UA_31001_thb', 'ตรวจปัสสาวะ', '31001'), ('lipid_32004_thb', 'ไขมันในเลือด', '32004'),
          ('BUN_32201_thb', 'BUN', '32201'), ('creatinine_32202_thb', 'ครีเอตินิน', '32202'), ('glucose_32203_thb', 'น้ำตาลในเลือด', '32203')]
PRICE_LEVELS = ['ต่ำมาก', 'ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก']
SOURCES = [
    ('production', 'CityMETER Hospital (ชุดข้อมูลสถานพยาบาลของ CityMETER production)', 'https://landometer.com/v3/citymeter?d=hospital'),
    ('hcode', 'ทะเบียนสถานพยาบาล HCODE กระทรวงสาธารณสุข', 'https://hcode.moph.go.th/'),
]
EXCLUDED = ['official_address', 'official_license_code', 'phone', 'operator_group', 'review_reason_codes', 'data_gap_codes',
            'identity_evidence_state', 'operation_evidence_state', 'matching_rule', 'notes', 'meaning_limit_th',
            'internal sheet / Drive URLs', '99_SOURCE_OBSERVATIONS raw records', '05_REVIEW_QUEUE', '09_DATA_GAPS']


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_tabs(d):
    out, shas = {}, {}
    for t in TABS:
        path = os.path.join(d, t + '.json')
        tab = json.load(open(path, encoding='utf-8'))
        rows = tab['rows']
        head = [h.strip() for h in rows[0]]
        if len(set(head)) != len(head):
            sys.exit(f'{t}: duplicate header')
        bad = sum(1 for r in rows if len(r) != len(head))
        if bad:
            sys.exit(f'{t}: {bad} rows with a cell count other than the header')
        out[t] = [dict(zip(head, r)) for r in rows[1:]]
        canon = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
        shas[t] = {'gid': tab.get('gid'), 'rows': len(rows) - 1, 'columns': len(head), 'sha256': hashlib.sha256(canon).hexdigest()}
    return out, shas


def iso(d):
    """M/D/YYYY (the sheet's display format) → YYYY-MM-DD; '' when empty or unreadable."""
    m = re.fullmatch(r'\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*', d or '')
    if not m:
        m2 = re.fullmatch(r'\s*(\d{4})-(\d{2})-(\d{2}).*', d or '')
        return f'{m2[1]}-{m2[2]}-{m2[3]}' if m2 else ''
    return f'{int(m[3]):04d}-{int(m[1]):02d}-{int(m[2]):02d}'


def th_norm(s):
    s = unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ').replace('ํา', 'ำ').strip()
    s = re.sub(r'^(?:กิ่งอำเภอ|อำเภอ|เขต|อ\.)\s*', '', s)
    return re.sub(r'\s+', '', s)


# A private hospital's licence class appended to its name (Sanatorium Act classes, as the licence register writes
# them: “โรงพยาบาลบางมดโรงพยาบาลทั่วไปขนาดใหญ่”). The name reads without it; the full form stays as the register name.
LICENCE_CLASS = re.compile(r'\s*(โรงพยาบาลทั่วไปขนาด(?:ใหญ่|เล็ก)|โรงพยาบาลเฉพาะทาง\S*ขนาด(?:ใหญ่|กลาง|เล็ก))$')


def display_name(name):
    m = LICENCE_CLASS.search(name)
    if not m or m.start() == 0:
        return name
    rest = name[:m.start()].strip()
    return rest if len(rest) >= 3 else name


def programme_name(name):
    """Programme scopes in the words people read: “PDSC_x” → “PDSC · x”; a transplant-society membership list
    (“รายชื่อโรงพยาบาลสมาชิกสามัญฯ เพื่อปลูกถ่ายตับ”) → “ปลูกถ่ายตับ (สมาชิกสามัญ)”."""
    name = re.sub(r'^(Re-)?PDSC[_\s]+', lambda m: f"{m[1] or ''}PDSC · ", name)
    m = re.match(r'^(?:รายชื่อ)?โรงพยาบาลสมาชิก(สามัญ|สมทบ)ฯ?\s*เพื่อ\s*(.+)$', name)
    return f'{m[2].strip()} (สมาชิก{m[1]})' if m else name


def clean(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ')).strip()


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


class Grid:
    """Points bucketed in ~0.02° cells for nearest-within-radius queries."""
    def __init__(self, items, cell=0.02):
        self.cell, self.cells = cell, collections.defaultdict(list)
        for it in items:
            self.cells[(int(it['lat'] // cell), int(it['lon'] // cell))].append(it)

    def nearest(self, lat, lon, max_m):
        reach = int(math.ceil((max_m / 111320) / self.cell)) + 1
        ci, cj = int(lat // self.cell), int(lon // self.cell)
        best, best_d = None, max_m + 1e-9
        for i in range(ci - reach, ci + reach + 1):
            for j in range(cj - reach, cj + reach + 1):
                for it in self.cells.get((i, j), ()):
                    d = haversine(lat, lon, it['lat'], it['lon'])
                    if d < best_d:
                        best, best_d = it, d
        return (best, best_d) if best else (None, None)


def public_url(u):
    u = (u or '').strip().split('\n')[0].strip()
    if not u.startswith('https://'):
        return ''
    if re.search(r'docs\.google\.com|drive\.google\.com|landometer\.com/api/|/papi/api/|localhost|\.local/', u):
        return ''
    return u


def lines(text):
    return [clean(x) for x in (text or '').split('\n') if clean(x)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tabs', required=True)
    ap.add_argument('--api', required=True)
    ap.add_argument('--points', required=True)
    ap.add_argument('--index', required=True)
    ap.add_argument('--transit', required=True)
    ap.add_argument('--read-on', default='2026-11-05', help='date the tabs were read from the sheet')
    ap.add_argument('--sheet-modified', default='2026-11-01T04:46:33Z', help="the sheet's Drive modifiedTime when read")
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    tabs, tab_shas = read_tabs(a.tabs)
    F = tabs['02_FACILITIES']
    S = {r['proposal_row_id']: r for r in tabs['99_SOURCE_OBSERVATIONS']}
    index = json.load(open(a.index, encoding='utf-8'))
    index_ids = set(index['areas']['id'])
    area_province = dict(zip(index['areas']['id'], index['areas']['province']))

    # ---------- production gazetteer ----------
    lv0 = json.load(open(os.path.join(a.api, 'base-lv0.json'), encoding='utf-8'))['value']['provinceInfos']
    prov_by_name, prov_by_dopa = {}, {}
    for p in lv0:
        prov_by_name[clean(p['nameTh'])] = p['abbrEn']
        prov_by_dopa[p['code']] = p['abbrEn']
    district_by_name, district_by_code = {}, {}
    for f in sorted(glob.glob(os.path.join(a.api, 'base-*-*-*-*-*.json'))):
        if f.endswith('.meta.json'):
            continue
        v = json.load(open(f, encoding='utf-8'))['value']
        pc = v['provinceInfo']['abbrEn']
        for d in v['districtInfos']:
            district_by_name[(pc, th_norm(d['nameTh']))] = d['code']
            district_by_code[d['code']] = pc
    for code in index_ids:
        if area_province[code] != district_by_code.get(code):
            sys.exit(f'area index district {code} does not match the production gazetteer')

    # ---------- production points ----------
    points = {p['main_code']: p for p in json.load(open(os.path.join(a.points, 'points.json'), encoding='utf-8'))}
    point_receipts = json.load(open(os.path.join(a.points, 'points-receipts.json'), encoding='utf-8'))
    receipts_sha = hashlib.sha256(json.dumps(point_receipts, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    retrieved = sorted({r['retrievedAt'][:10] for r in point_receipts.values()})

    # ---------- transit ----------
    transit_path = os.path.join(a.transit, 'data', 'transit.json')
    transit = json.load(open(transit_path, encoding='utf-8'))
    tlines = {l['id']: l for l in transit['lines']}
    stations = []
    for s in transit['stations']:
        if not (isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float))):
            continue
        if s.get('status') not in ('operating', 'construction'):
            continue
        stations.append({'id': s['id'], 'name': s['name'], 'nameEn': s.get('nameEn') or '', 'lat': s['lat'], 'lon': s['lng'], 'status': s['status'],
                         'lines': [tlines[l]['short'] or tlines[l]['name'] for l in s.get('lineIds', []) if l in tlines],
                         'lineIds': s.get('lineIds', [])})
    stations.sort(key=lambda s: s['id'])
    for i, s in enumerate(stations):
        s['i'] = i
    grid_op = Grid([s for s in stations if s['status'] == 'operating'])
    grid_cx = Grid([s for s in stations if s['status'] == 'construction'])

    def repo_commit(path):
        head = open(os.path.join(path, '.git', 'HEAD')).read().strip()
        if head.startswith('ref:'):
            ref = head.split(' ', 1)[1]
            p = os.path.join(path, '.git', ref)
            if os.path.exists(p):
                return open(p).read().strip()
            for line in open(os.path.join(path, '.git', 'packed-refs')):
                if line.strip().endswith(ref):
                    return line.split()[0]
        return head

    # ---------- side tabs by facility ----------
    jci = collections.defaultdict(list)
    for r in tabs['08_ACCREDITATION']:
        if r['scheme'] == 'JCI' and r['facility_id']:
            jci[r['facility_id']].append([clean(r['programme_scope']), iso(r['effective_on'])])
    basket = {}
    cutoffs = None
    for r in tabs['11_PRICE_BASKET']:
        prices = []
        for col, _, _ in BASKET:
            v = r[col].replace(',', '').strip()
            prices.append(round(float(v), 2) if v else None)
        if None in prices:
            sys.exit(f"11_PRICE_BASKET {r['basket_id']}: an item price is missing")
        lvl = next((i for i, w in enumerate(PRICE_LEVELS) if r['price_level'].startswith(w + ' ') or r['price_level'] == w), -1)
        if lvl < 0:
            sys.exit(f"11_PRICE_BASKET {r['basket_id']}: unknown level {r['price_level']!r}")
        total = round(float(r['basket_sum_thb'].replace(',', '')), 2)
        if abs(sum(prices) - total) > 0.01:
            sys.exit(f"11_PRICE_BASKET {r['basket_id']}: sum {total} differs from its items {sum(prices)}")
        cut = [float(r[k].replace(',', '')) for k in ('P20_thb', 'P40_thb', 'P60_thb', 'P80_thb')]
        if cutoffs and cut != cutoffs:
            sys.exit('11_PRICE_BASKET: cut-offs differ between rows')
        cutoffs = cut
        basket[r['facility_id']] = {'sum': total, 'level': lvl, 'items': prices, 'on': iso(r['checked_on'])}
    # every basket level must follow its sum and the published cut-offs (nearest rank; equal sums share a level)
    for fid, b in basket.items():
        want = sum(1 for c in cutoffs if b['sum'] > c + 1e-9)
        if want != b['level']:
            sys.exit(f'11_PRICE_BASKET {fid}: level {b["level"]} does not follow the sum {b["sum"]} and the cut-offs {cutoffs}')
    framework = {r['key']: clean(r['label_th']) for r in tabs['15_SERVICE_FRAMEWORK'] if r['section'] == 'domain'}
    domain_keys = list(framework)
    service_names, service_index = [], {}
    programmes, programme_index = [], {}
    profile = {}
    for r in tabs['13_SERVICE_PROFILE']:
        doms = [domain_keys.index(c) for c in lines(r['service_domains_codes']) if c in framework]
        adv = []
        for line in lines(r['advanced_services_th']):
            if '—' not in line:
                continue
            name = clean(line.split('—', 1)[1])
            if name and name not in service_index:
                service_index[name] = len(service_names)
                service_names.append(name)
            if name and service_index[name] not in adv:
                adv.append(service_index[name])
        prog = []
        for line in lines(r['programme_scopes_th']):
            name = programme_name(clean(line.split(';')[0]))
            if name and name not in programme_index:
                programme_index[name] = len(programmes)
                programmes.append(name)
            if name and programme_index[name] not in prog:
                prog.append(programme_index[name])
        team = 1 if clean(r['multidisciplinary_scope_th']) else 0
        if doms or adv or prog or team:
            profile[r['facility_id']] = {'d': doms, 'a': adv, 'p': prog, 't': team, 'on': iso(r['checked_on'])}
    level_label = {}
    for r in tabs['99_SOURCE_OBSERVATIONS']:
        m = re.match(r'^(A|S|M1|M2|F1|F2|F3)\s*-\s*(.+)$', clean(r['official_hospital_level']))
        if m:
            if m[1] in level_label and level_label[m[1]] != m[2]:
                sys.exit(f'99_SOURCE_OBSERVATIONS: two labels for level {m[1]}')
            level_label[m[1]] = m[2]

    # ---------- rows ----------
    cols = {k: [] for k in ('key', 'name', 'nameOff', 'group', 'raw', 'aff', 'beds', 'level', 'ha', 'haTo', 'role', 'province',
                            'district', 'admin', 'lat', 'lon', 'src', 'url', 'reg', 'rail', 'railM', 'rail2', 'rail2M')}
    raw_types, raw_index = [], {}
    aff_raw, aff_raw_index = [], {}
    urls, url_index = [], {}
    provinces, prov_index = [], {}
    districts, dist_index = [], {}
    counts = collections.Counter()
    conflicts, disagree_district, disagree_province, code_disagree = [], [], [], []
    extra = {'jci': {}, 'basket': {}, 'ref': {}, 'svc': {}, 'haOn': {}}

    def intern(lst, idx, v):
        if v not in idx:
            idx[v] = len(lst)
            lst.append(v)
        return idx[v]

    ids = set()
    for i, r in enumerate(F):
        fid = r['facility_id'].strip()
        if not fid or fid in ids:
            sys.exit(f'02_FACILITIES row {i + 2}: empty or repeated facility_id {fid!r}')
        ids.add(fid)
        s = S.get(fid)
        if s is None:
            sys.exit(f'{fid}: no 99_SOURCE_OBSERVATIONS row')
        prod = r['source_layer'] == 'citymeter_production_minimum'
        main = r['citymeter_main_code'].strip()
        pt = points.get(main) if prod else None
        if prod and pt is None:
            sys.exit(f'{fid}: production main_code {main!r} has no production point')
        # province
        prov = prov_by_name.get(clean(r['province']))
        if not prov:
            sys.exit(f'{fid}: province {r["province"]!r} is not a production province')
        # district: name → code → point
        admin, dcode = 'none', ''
        d_name = district_by_name.get((prov, th_norm(r['district']))) if r['district'].strip() else None
        d_code = s.get('official_district_code', '').strip()
        d_code = d_code if d_code in district_by_code else ''
        if d_name:
            admin, dcode = 'name', d_name
            if d_code and d_code != d_name:
                code_disagree.append(fid)
        elif d_code and district_by_code[d_code] == prov:
            admin, dcode = 'code', d_code
        elif pt and district_by_code.get(pt['district']) == prov:
            admin, dcode = 'point', pt['district']
        elif pt:
            admin = 'conflict'
            conflicts.append({'facility': fid, 'province': prov, 'pointProvince': district_by_code.get(pt['district'], '')})
        else:
            admin = 'province'
        if dcode and dcode not in index_ids:
            counts['district.notInIndex'] += 1
            dcode, admin = '', 'province'
        if pt and dcode and pt['district'] != dcode:
            (disagree_province if district_by_code.get(pt['district']) != prov else disagree_district).append(fid)
        counts['admin.' + admin] += 1
        # group, type, affiliation
        otype = clean(r['official_facility_type'])
        if otype not in TYPE_GROUP:
            sys.exit(f'{fid}: facility type {otype!r} has no product group')
        aff = clean(r['official_affiliation'])
        ai = AFF_OF.get(aff, 2)
        # beds (HCODE text as written: a number, or blank = unknown)
        bt = r['official_reported_beds_text'].strip().replace(',', '')
        if bt and not re.fullmatch(r'\d+', bt):
            sys.exit(f'{fid}: beds text {bt!r} is not a whole number')
        beds = int(bt) if bt else -1
        # level, HA, role
        lvl = r['official_service_plan_level'].strip()
        li = LEVELS.index(lvl) if lvl in LEVELS else -1
        if lvl and li < 0:
            sys.exit(f'{fid}: service-plan level {lvl!r}')
        hs = clean(r['HA_published_status'])
        hi = HA_OF.get(hs, -1)
        if hs and hi < 0:
            sys.exit(f'{fid}: HA status {hs!r} has no stage')
        role = -1
        if pt:
            role = (pt['role_group'] or 4) - 1
            if not 0 <= role < len(ROLES):
                sys.exit(f'{fid}: production role_group {pt["role_group"]!r}')
        # point and rail context
        lat = lon = None
        rail = rail2 = -1
        railm = rail2m = -1
        if pt:
            lat, lon = round(pt['lat'], 6), round(pt['lon'], 6)
            if not (5 <= lat <= 21 and 97 <= lon <= 106):
                sys.exit(f'{fid}: production point outside Thailand')
            st, d = grid_op.nearest(lat, lon, RAIL_MAX_M)
            if st:
                rail, railm = st['i'], int(round(d))
            st, d = grid_cx.nearest(lat, lon, RAIL_MAX_M)
            if st:
                rail2, rail2m = st['i'], int(round(d))
            counts['points'] += 1
        # source link
        link = public_url(r['official_source_url']) if not prod else ''
        ui = intern(urls, url_index, link) if link else -1
        reg = clean(r['registry_status'])
        full = clean(r['name_th'])
        name = display_name(full)
        off = clean(r['official_name_th']) or (full if full != name else '')
        cols['key'].append(fid)
        cols['name'].append(name)
        cols['nameOff'].append(off if off and off != name else '')
        cols['group'].append(TYPE_GROUP[otype])
        cols['raw'].append(intern(raw_types, raw_index, otype))
        cols['aff'].append(ai)
        cols['beds'].append(beds)
        cols['level'].append(li)
        cols['ha'].append(hi)
        cols['haTo'].append(iso(r['HA_expiry_date']))
        cols['role'].append(role)
        cols['province'].append(intern(provinces, prov_index, prov))
        cols['district'].append(intern(districts, dist_index, dcode) if dcode else -1)
        cols['admin'].append(ADMIN.index(admin))
        cols['lat'].append(lat)
        cols['lon'].append(lon)
        cols['src'].append(0 if prod else 1)
        cols['url'].append(ui)
        cols['reg'].append({'กำลังใช้งาน': 0, 'ยกเลิก': 1}.get(reg, -1))
        cols['rail'].append(rail)
        cols['railM'].append(railm)
        cols['rail2'].append(rail2)
        cols['rail2M'].append(rail2m)
        k = str(i)
        if hi >= 0 and (r['HA_issue_date'] or r['quality_level_as_of']):
            extra['haOn'][k] = [iso(r['HA_issue_date']), iso(r['quality_level_as_of'])]
        if fid in jci:
            extra['jci'][k] = jci[fid]
            counts['jci'] += 1
        if fid in basket:
            b = basket[fid]
            extra['basket'][k] = [b['sum'], b['level'], *b['items']]
            counts['basket'] += 1
        elif r['price_reference_thb'].strip():
            svc = clean(r['price_reference_service']).strip('"')
            code = re.search(r'\b(3\d{4})\b', svc)
            item = next((b for b in BASKET if code and b[2] == code[1]), None)
            if not item:
                sys.exit(f'{fid}: reference price service {svc!r} is not one of the six DIT items')
            extra['ref'][k] = [BASKET.index(item), round(float(r['price_reference_thb'].replace(',', '')), 2)]
            counts['ref'] += 1
        if fid in profile:
            extra['svc'][k] = profile[fid]
            counts['services'] += 1
        counts['rows'] += 1
        counts['beds.known'] += beds >= 0
        counts['beds.sum'] += max(beds, 0)
        counts['beds.positive'] += beds > 0
        counts['level'] += li >= 0
        counts['ha'] += hi >= 0
        counts['role'] += role >= 0
        counts['src.' + ('production' if prod else 'hcode')] += 1
        counts['registry.cancelled'] += reg == 'ยกเลิก'
    # Every production point must belong to one row, and every basket/JCI/profile facility to a row.
    used_codes = {r['citymeter_main_code'].strip() for r in F if r['source_layer'] == 'citymeter_production_minimum'}
    if set(points) - used_codes:
        sys.exit(f'{len(set(points) - used_codes)} production points have no row')
    for name, keys in (('11_PRICE_BASKET', basket), ('08_ACCREDITATION JCI', jci), ('13_SERVICE_PROFILE', profile)):
        missing = set(keys) - ids
        if missing:
            sys.exit(f'{name}: {len(missing)} facility ids are not rows')

    # Reconcile province counts with the sheet's own summary (03_AREA_SUMMARY).
    summary = {clean(r['province']): r for r in tabs['03_AREA_SUMMARY']}
    by_prov = collections.Counter(provinces[p] for p in cols['province'])
    mismatch = []
    for name, code in prov_by_name.items():
        want = summary.get(name)
        if want is None:
            mismatch.append(name)
            continue
        if int(float(want['proposal_record_count'].replace(',', ''))) != by_prov[code]:
            mismatch.append(name)
    if mismatch:
        sys.exit(f'03_AREA_SUMMARY: province counts differ for {mismatch[:5]}')

    # stations referenced
    used_stations = sorted({x for x in cols['rail'] + cols['rail2'] if x >= 0})
    remap = {old: new for new, old in enumerate(used_stations)}
    out_stations = []
    for old in used_stations:
        s = stations[old]
        out_stations.append({'id': s['id'], 'name': s['name'], 'nameEn': s['nameEn'], 'lat': round(s['lat'], 6), 'lon': round(s['lon'], 6),
                             'status': s['status'], 'lines': s['lines'], 'lineIds': s['lineIds']})
    for k in ('rail', 'rail2'):
        cols[k] = [remap[x] if x >= 0 else -1 for x in cols[k]]
    counts['stations.operating'] = sum(1 for s in out_stations if s['status'] == 'operating')
    counts['stations.construction'] = sum(1 for s in out_stations if s['status'] == 'construction')

    sources_tab = tabs['10_SOURCES']
    checked = sorted({iso(r['checked_on']) for r in sources_tab if iso(r['checked_on'])})
    meta = {
        'dataset': 'CityMETER Hospital', 'datasetTh': 'โรงพยาบาลและหน่วยบริการสุขภาพในประเทศไทย', 'registryId': 'research.TH.hospital',
        'registryRole': 'Location · TH', 'productDataset': 'hospital', 'sheetTitle': SHEET_TITLE, 'sheetStatus': 'research_master',
        'sheetModified': a.sheet_modified, 'readOn': a.read_on,
        'readMethod': "the sheet's HTML view read cell by cell in the owner's browser (scripts/export-sheet-tabs.js); SHA-256 of each tab's rows as canonical JSON",
        'tabs': tab_shas,
        'checkedOn': checked[-1] if checked else '', 'checkedDates': checked, 'scopeApprovedOn': '2026-10-31',
        'builtOn': datetime.date.today().isoformat(), 'rows': counts['rows'],
        'counts': dict(sorted(counts.items())),
        'unit': {
            'row': 'one row of 02_FACILITIES — a source identity the owner approved into the dataset: a CityMETER production Hospital record or an HCODE register record; not a field-verified census of unique operating facilities',
            'beds': 'official_reported_beds_text — the beds in use HCODE reports; 0 is a reported 0, blank is unknown; not staffed beds or occupancy',
            'price': 'DIT published prices of six lab items (CBC 30101, UA 31001, lipid 32004, BUN 32201, creatinine 32202, glucose 32203) and their sum; effective date not shown by the source; not a bill, a package or the facility’s price level',
            'quality': 'HA stage and recorded dates (HA snapshot 31 Aug 2026 + public directory 31 Oct 2026) and JCI programmes (directory 31 Oct 2026) as published; accreditation evidence, not an outcome ranking',
        },
        'adminMethods': {
            'name': "the row's own district (HCODE, else production) is a production district of its province",
            'code': "the row's HCODE district code is a production district of its province",
            'point': "the row's production point lies in a production district of its province",
            'province': 'province only', 'conflict': "the row's production point lies in another province: placed nowhere", 'none': 'no province',
        },
        'districts': 'CityMETER production base info (lv0/lv1, receipts in data/boundary-receipts.json) + district outlines of data/frames/{CODE}.json',
        'points': {'source': 'CityMETER production Hospital (citymeter-v3/hospital/overlayMvt, layer-hospital-detail, one request per district)',
                   'requests': len(point_receipts), 'receiptsSha256': receipts_sha, 'retrievedOn': retrieved, 'decimals': 6,
                   'rule': 'production point of the facility, joined by citymeter_main_code; HCODE rows carry no point'},
        'context': {
            'rail': {'source': 'CityMETER · Transit (montri-th/transit)', 'commit': repo_commit(a.transit), 'file': 'data/transit.json', 'sha256': sha256_file(transit_path),
                     'release': (transit.get('meta') or {}).get('release', ''), 'asOf': (transit.get('meta') or {}).get('asOf', ''),
                     'rule': 'operating = on the operator roster of CityMETER · Transit; construction = a project station, not a service; straight-line distance from the facility point to the station reference point, up to %d m' % RAIL_MAX_M},
            'role': {'source': 'CityMETER production Hospital (NHSO service network, open data mastercupuc FY2568 Q3)', 'rule': 'role_group of the production point: CUP first, else primary, else referral, else ungrouped'},
        },
        'basket': {'items': [{'id': c, 'th': th, 'dit': code} for c, th, code in BASKET], 'levels': PRICE_LEVELS, 'cutoffs': cutoffs,
                   'cohort': len(basket), 'method': 'DIT6LAB nearest-rank quintiles (P20/P40/P60/P80) of the basket sum over the 262 facilities with all six items; equal sums share a level',
                   'source': 'https://hospitals.dit.go.th/', 'checkedOn': sorted({b['on'] for b in basket.values()})},
        'levels': [{'id': l, 'th': level_label.get(l, '')} for l in LEVELS],
        'haStages': [{'id': s[0], 'th': s[1]} for s in HA_STAGES],
        'roles': [{'id': r[0], 'th': r[1]} for r in ROLES],
        'affiliations': [{'id': x[0], 'th': x[1]} for x in AFFILIATIONS],
        'services': {'domains': [{'id': k, 'th': framework[k]} for k in domain_keys], 'named': service_names, 'programmes': programmes,
                     'rule': 'd = domains providers declare on their own pages; a = services the NHSO register lists (two code lists may name one service twice); p = programme scopes; t = named team care'},
        'families': len(tabs['01_BRANDS']),
        'identityLinks': len(tabs['12_IDENTITY_LINKS']),
        'conflicts': conflicts,
        'checks': {'pointDistrictDisagree': len(disagree_district), 'pointProvinceDisagree': len(disagree_province),
                   'codeNameDisagree': len(code_disagree), 'pointProvinceDisagreeSample': disagree_province[:20]},
        'excludedFields': EXCLUDED,
        'notes': [
            'Distances to rail stations are straight-line distances between reference points.',
            'A gap (no price, no accreditation, no service evidence) is not a low value: most records have not been researched for it.',
        ],
    }
    out = {
        'meta': meta,
        'groups': [{'id': g[0], 'th': g[1], 'en': g[2]} for g in GROUPS],
        'sizes': [{'id': s[0], 'th': s[1], 'min': s[2], 'max': s[3] if s[3] < 10 ** 6 else None} for s in SIZES],
        'rawTypes': raw_types,
        'sources': [{'id': s[0], 'th': s[1], 'url': s[2]} for s in SOURCES],
        'stations': out_stations, 'urls': urls, 'provinces': provinces, 'districts': districts,
        'vocab': {'admin': ADMIN, 'levels': LEVELS},
        **extra,
        'cols': cols,
    }
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    with open(os.path.join(a.out, 'data', 'hospitals.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    report = {'builtOn': meta['builtOn'], 'rows': counts['rows'], 'counts': meta['counts'], 'checks': meta['checks'],
              'conflicts': len(conflicts), 'stations': len(out_stations), 'tabs': {k: v['rows'] for k, v in tab_shas.items()}}
    with open(os.path.join(a.out, 'data', 'build-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1, sort_keys=True)
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
