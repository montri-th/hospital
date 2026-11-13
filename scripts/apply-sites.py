#!/usr/bin/env python3
"""Apply the campus sites of 49_SITE_BOUNDARY_CHECK to the released data/hospitals.json without rebuilding the rest
(Hospital 0.5.2): the facility records stay as built from the research master on 2026-11-05; only `siteGroups`,
`meta.siteGroups`, the site evidence links in `urls`, `meta.excludedFields` and the site counts of data/build-report.json
change. A later full build (scripts/build-data.py --sites <the same CSV>) gives the same site part.

usage: python3 -I scripts/apply-sites.py --sites <CSV of the live 49_SITE_BOUNDARY_CHECK tab> [--data data/hospitals.json]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sites as S  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sites', required=True, help='CSV of the live 49_SITE_BOUNDARY_CHECK tab (its header and checked rows suffice)')
    ap.add_argument('--data', default='data/hospitals.json')
    ap.add_argument('--report', default='data/build-report.json')
    a = ap.parse_args()
    d = json.load(open(a.data, encoding='utf-8'))
    cols = d['cols']
    # The row links come first in `urls` (interned while the rows were built); site links follow them, so a re-run
    # with another tab gives the same result as a first run.
    keep = max([u for u in cols['url'] if u >= 0], default=-1) + 1
    urls = d['urls'][:keep]
    index = {u: i for i, u in enumerate(urls)}

    def intern(u):
        if u not in index:
            index[u] = len(urls)
            urls.append(u)
        return index[u]

    rows, receipt = S.read_csv(a.sites)
    sites, counts, meta = S.build_sites(rows, cols, intern, receipt)
    d['urls'] = urls
    d['siteGroups'] = sites
    d['meta']['siteGroups'] = meta
    d['meta']['excludedFields'] = [f for f in d['meta'].get('excludedFields', []) if not f.startswith(S.SITE_TAB + '.')] + S.EXCLUDED
    d['meta'].setdefault('counts', {}).update(counts)
    # cols stays last, as scripts/build-data.py writes it
    out = {k: v for k, v in d.items() if k != 'cols'}
    out['cols'] = cols
    with open(a.data, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(a.report):
        rep = json.load(open(a.report, encoding='utf-8'))
        rep.setdefault('counts', {}).update(counts)
        rep['siteGroups'] = {k: meta[k] for k in ('rows', 'buildings', 'checkedOn', 'bySource', 'file')}
        with open(a.report, 'w', encoding='utf-8') as fh:
            json.dump(rep, fh, ensure_ascii=False, indent=1, sort_keys=True)
    print(json.dumps({'sites': len(sites), 'buildings': meta['buildings'], 'checkedOn': meta['checkedOn'], **counts}, ensure_ascii=False))


if __name__ == '__main__':
    main()
