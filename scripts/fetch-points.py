#!/usr/bin/env python3
"""Fetch the facility points of CityMETER production Hospital (v3) with a receipt per response.

One request per production DISTRICT (928): POST https://landometer.com/api/v2/citymeter-v3/hospital/overlayMvt/{z}/{x}/{y}
?inTileType=DISTRICT&inTileId={district uuid}. Production returns every shown-type facility whose point lies in the
district (layer `layer-hospital-detail`: name, main_code, type_code, role_group, is_cup, is_referral), unclipped, so one
z14 tile at the district's centre carries them all (0.6 m per tile unit). The tile body is kept in the build directory
(re-readable from the same public endpoint); `points.json` holds the decoded points, `points-receipts.json` the url,
status, bytes, sha256 and retrievedAt of every response.

Usage: python3 -I scripts/fetch-points.py --api <base info dir (scripts/fetch-base.py)> --out DIR
"""
import argparse, concurrent.futures, datetime, glob, hashlib, json, math, os, time, urllib.request

import mapbox_vector_tile

API = 'https://landometer.com/api/v2/citymeter-v3/hospital/overlayMvt'
R = 6378137.0
HALF = math.pi * R
Z = 14
UA = {'Content-Type': 'application/json', 'User-Agent': 'CityMETER-Hospital-build/1.0'}


def tile_of(ext):
    """z14 tile (x, y) holding the centre of an EPSG:3857 extent."""
    cx, cy = (ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2
    n = 2 ** Z
    size = 2 * HALF / n
    return int((cx + HALF) / size), int((HALF - cy) / size)


def to_lonlat(px, py, x, y):
    size = 2 * HALF / 2 ** Z
    mx = -HALF + x * size + px / 4096 * size
    my = HALF - y * size - py / 4096 * size
    lon = mx / R * 180 / math.pi
    lat = (2 * math.atan(math.exp(my / R)) - math.pi / 2) * 180 / math.pi
    return round(lon, 7), round(lat, 7)


def fetch(district, out):
    x, y = tile_of(district['extent'])
    url = f"{API}/{Z}/{x}/{y}?inTileType=DISTRICT&inTileId={district['id']}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, data=b'{}', method='POST', headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                body, status = r.read(), r.status
            break
        except Exception:  # noqa: BLE001 — retried, then raised
            if attempt == 4:
                raise
            time.sleep(2 + attempt * 3)
    path = os.path.join(out, 'tiles', f"{district['code']}.mvt")
    with open(path, 'wb') as fh:
        fh.write(body)
    receipt = {'url': url, 'status': status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
               'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}
    pts = []
    if body:
        layer = mapbox_vector_tile.decode(body, default_options={'y_coord_down': True}).get('layer-hospital-detail')
        for f in (layer or {}).get('features', []):
            g = f['geometry']
            if g['type'] != 'Point':
                continue
            lon, lat = to_lonlat(g['coordinates'][0], g['coordinates'][1], x, y)
            p = f['properties']
            pts.append({'main_code': p.get('main_code'), 'name': p.get('name'), 'type_code': p.get('type_code'),
                        'role_group': p.get('role_group'), 'is_cup': p.get('is_cup'), 'is_referral': p.get('is_referral'),
                        'lon': lon, 'lat': lat, 'district': district['code']})
    return district['code'], receipt, pts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--api', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(os.path.join(a.out, 'tiles'), exist_ok=True)
    districts = []
    for f in sorted(glob.glob(os.path.join(a.api, 'base-*-*-*-*-*.json'))):
        if f.endswith('.meta.json'):
            continue
        districts += json.load(open(f, encoding='utf-8'))['value']['districtInfos']
    receipts, points = {}, []
    with concurrent.futures.ThreadPoolExecutor(6) as ex:
        for code, rec, pts in ex.map(lambda d: fetch(d, a.out), districts):
            receipts[code] = rec
            points += pts
    points.sort(key=lambda p: (p['district'], p['main_code'] or ''))
    json.dump(points, open(os.path.join(a.out, 'points.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(receipts, open(os.path.join(a.out, 'points-receipts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
    print('districts', len(districts), 'points', len(points), 'codes', len({p['main_code'] for p in points}))


if __name__ == '__main__':
    main()
