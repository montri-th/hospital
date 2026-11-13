"""Campus sites of CityMETER · Hospital (0.5.2): the checked rows of 49_SITE_BOUNDARY_CHECK in the hospital research master
→ data/hospitals.json `siteGroups` + `meta.siteGroups`. Shared by scripts/build-data.py (--sites) and scripts/apply-sites.py.

Owner 2026-11-13 09:27, VERBATIM: “ช่วยเช็ค demo ของ hospital แล้ว ทำ campus boundary ให้ครอบคลุมทุกอาคารของแต่ละ รพ ที่เป็น
กลุ่มอาคาร ในลักษณะเดียวกับที่เราทำแล้วกับ hotel แล้ว publish ใหม่” — as CityMETER · Hotel's stay sites (Hotel 0.3.6–0.3.10):
a facility of several buildings whose row is `checked` publishes its buildings — `buildings_in_boundary`, the interior points
of the drawn buildings (CityMETER Building V4 or OpenStreetMap) inside the research site boundary, as "lon,lat;lon,lat" —
so the map can show them as one site (siteGroups[row] = {pts, n, on, src, url}). The boundary itself, the notes, the main
building note and the checker stay in the sheet; a site building farther than SITE_MAX_M from the facility's own point
stops the build. The site's check date dates the site (meta.siteGroups.checkedOn and the site's own `on`), not the facility
records (meta.checkedOn stays the research master's check).
"""
import csv
import hashlib
import math
import os
import re
import sys

SITE_TAB = '49_SITE_BOUNDARY_CHECK'
SITE_STATUS = ('checked',)
SITE_MAX_M = 600  # a site building this far from the facility's own point is a sheet error, not a site
SITE_SOURCES = {  # boundary_source codes of 49_SITE_BOUNDARY_CHECK → the words the provenance line uses
    # owner 2026-11-13 “ในลักษณะเดียวกับที่เราทำแล้วกับ hotel”: Hotel's automatic source — an OSM area of the facility's own
    # checked by rule, no layout yet
    'osm_polygon_auto': 'กรอบ OpenStreetMap (ตรวจอัตโนมัติ)',
    'osm_polygon+site_layout': 'กรอบ OpenStreetMap + ผังโรงพยาบาล',
    'dol_parcels+site_layout': 'รูปแปลงกรมที่ดิน + ผังโรงพยาบาล',
    'site_layout': 'ผังโรงพยาบาล',
}
SITE_CREDITS = {  # boundary sources whose points are derived from an open database → the credit the site row links to
    'osm_polygon_auto': {'text': '© OpenStreetMap contributors', 'licence': 'ODbL 1.0',
                         'url': 'https://www.openstreetmap.org/copyright',
                         'note': 'the site follows an OpenStreetMap area of the facility, checked automatically'},
    'osm_polygon+site_layout': {'text': '© OpenStreetMap contributors', 'licence': 'ODbL 1.0',
                                'url': 'https://www.openstreetmap.org/copyright', 'note': 'the site follows an OpenStreetMap area of the facility'},
}
SITE_RULE = ("a checked 49_SITE_BOUNDARY_CHECK row publishes the interior points of the drawn buildings inside the research site "
             "boundary (buildings_in_boundary); the map shows the buildings whose outline holds one of them as the facility's site; "
             "the boundary (an OpenStreetMap area of the facility checked by rule, later its layout), notes and checker stay in the "
             "sheet; a site is a grouping of buildings for the map, never a land title, an area of land or ownership")
EXCLUDED = [SITE_TAB + '.boundary_geojson', SITE_TAB + '.notes', SITE_TAB + '.main_building_note', SITE_TAB + '.checked_by']


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def site_points(text):
    """buildings_in_boundary: "lon,lat;lon,lat" (WGS 84, Thailand) → [[lon, lat], …] (6 decimals)."""
    pts = []
    for part in re.split(r'[;\s]+', (text or '').strip()):
        if not part:
            continue
        m = re.fullmatch(r'(\d{2,3}\.\d+),(\d{1,2}\.\d+)', part)
        if not m:
            sys.exit(f'{SITE_TAB}: buildings_in_boundary entry {part!r} is not "lon,lat"')
        lon, lat = float(m[1]), float(m[2])
        if not (97 <= lon <= 106 and 5 <= lat <= 21):
            sys.exit(f'{SITE_TAB}: buildings_in_boundary entry {part!r} lies outside Thailand')
        pts.append([round(lon, 6), round(lat, 6)])
    return pts


def public_https(u):
    u = (u or '').strip()
    if not re.fullmatch(r'https://[^\s]+', u) or re.search(r'google\.com/(maps|drive)|docs\.google|landometer\.com/api', u):
        return ''
    return u


def read_csv(path):
    """The live tab as CSV (its header and checked rows suffice) and its receipt {sha256, bytes}."""
    with open(path, encoding='utf-8') as fh:
        rows = list(csv.DictReader(fh))
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        h.update(fh.read())
    return rows, {'sha256': h.hexdigest(), 'bytes': os.path.getsize(path)}


def build_sites(site_rows, cols, intern, receipt=None):
    """Checked rows → ({row index: {pts, n, on, src, url}}, counts, meta.siteGroups). `intern(url)` → index in urls."""
    sites, counts = {}, {'site.rowsRead': len(site_rows), 'site.groups': 0, 'site.buildings': 0, 'site.unmatched': 0, 'site.noBuildings': 0}
    row_of = {k: i for i, k in enumerate(cols['key'])}
    for r in site_rows:
        if (r.get('boundary_status') or '').strip() not in SITE_STATUS:
            continue
        vid = (r.get('venue_id') or '').strip()
        i = row_of.get(vid)
        if i is None:
            counts['site.unmatched'] += 1
            continue
        pts = site_points(r.get('buildings_in_boundary'))
        if not pts:
            counts['site.noBuildings'] += 1
            continue
        if cols['lat'][i] is None or cols['lon'][i] is None:
            sys.exit(f'{SITE_TAB}: {vid} has a site but no point on the map')
        far = max(haversine(cols['lat'][i], cols['lon'][i], p[1], p[0]) for p in pts)
        if far > SITE_MAX_M:
            sys.exit(f'{SITE_TAB}: {vid} lists a site building {far:.0f} m from its point (more than {SITE_MAX_M} m)')
        if i in sites:
            sys.exit(f'{SITE_TAB}: {vid} has two checked rows')
        on = (r.get('checked_on') or '').strip().lstrip("'")[:10]
        src = (r.get('boundary_source') or '').strip()
        evidence = public_https(r.get('boundary_evidence_url'))
        sites[i] = {'pts': pts, 'n': len(pts), 'on': on if re.fullmatch(r'\d{4}-\d{2}-\d{2}', on) else '',
                    'src': src if src in SITE_SOURCES else 'other', 'url': intern(evidence) if evidence else -1}
        counts['site.groups'] += 1
        counts['site.buildings'] += len(pts)
    meta = {'tab': SITE_TAB, 'rowsRead': len(site_rows), 'rows': len(sites), 'buildings': sum(v['n'] for v in sites.values()),
            'status': list(SITE_STATUS), 'checkedOn': sorted({v['on'] for v in sites.values() if v['on']}),
            'bySource': {s: sum(1 for v in sites.values() if v['src'] == s) for s in sorted({v['src'] for v in sites.values()})},
            'sources': SITE_SOURCES, 'credits': SITE_CREDITS, 'file': receipt, 'rule': SITE_RULE, 'maxM': SITE_MAX_M}
    return {str(k): v for k, v in sorted(sites.items())}, counts, meta
