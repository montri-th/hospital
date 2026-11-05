#!/usr/bin/env python3
"""Build the metric-tile pictogram subset of Material Symbols Rounded (Apache 2.0).

Static instance at the LDS axes for this family (FILL 0, wght 300, GRAD 0, opsz 24),
subset to the pictogram glyphs below, written as WOFF2 next to the approved nav-7
subset (which stays byte-identical). The source variable font is not committed;
pass its path. Requires fonttools + brotli.

  python3 scripts/build-pictogram-font.py "MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf"

Pictogram roles (test exception approved by the owner 2026-10-22 for the CityMETER
demos, to be folded into LDS if it proves itself), carried over from CityMETER ·
Hotel 0.3.6 and narrowed to what Hospital shows: area = map, province =
location_city, segment = category; ai = auto_awesome, streetview, maps =
location_on, building = apartment (Fitness 0.3.0, owner 2026-10-29: icons and
symbols keep the panel text short); beds = bed, rail = train, meeting = groups,
compare = compare_arrows (Hotel 0.1.0); rank = leaderboard, date = event,
distance = straighten (straight line), construction and dataset = database
(Hotel 0.3.1, owner 2026-11-01 “เรื่องภาษา”); elevation = landscape for the
terrain legend (Hotel 0.2.0). Hospital 0.1.0 adds hospital =
local_hospital (records), service = medical_services, accredit = verified,
lab = science, network = hub (the NHSO service network), level = stairs (the
register's service level) and affiliation = account_balance. No star or medal
glyph: it would read as a quality rating. Outbound links keep the nav-7
open_in_new mark.
"""
import hashlib, json, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GLYPHS = {
    'area': ('map', 0xE55B),
    'province': ('location_city', 0xE7F1),
    'segment': ('category', 0xE72C),
    # Fitness 0.3.0 (owner 2026-10-29: icons and symbols instead of long text): contextual actions and the building view.
    'ai': ('auto_awesome', 0xE65F),
    'streetview': ('streetview', 0xE56E),
    'maps': ('location_on', 0xE0C8),
    'building': ('apartment', 0xEA40),
    # Hotel 0.1.0: the measure's unit, rail context, team care and the comparison set.
    'beds': ('bed', 0xEFDF),
    'rail': ('train', 0xE570),
    'meeting': ('groups', 0xF233),
    'compare': ('compare_arrows', 0xE915),
    # Hotel 0.3.1 (owner 2026-11-01, “เรื่องภาษา … ใช้ symbol, logo, icon, charts มาช่วยทำให้ text กระชับ”): ranks,
    # the date and the dataset of the provenance line, straight-line distances and stations under construction.
    'rank': ('leaderboard', 0xF20C),
    'date': ('event', 0xE878),
    'distance': ('straighten', 0xE41C),
    'construction': ('construction', 0xEA3C),
    'dataset': ('database', 0xF20E),
    # Hotel 0.2.0: the terrain mode's legend item (3D ground at hilly sites).
    'elevation': ('landscape', 0xE564),
    # Hospital 0.1.0: records, services, published accreditation, lab prices, the NHSO network, the register's level
    # and the affiliation (สังกัด).
    'hospital': ('local_hospital', 0xE548),
    'service': ('medical_services', 0xF109),
    'accredit': ('verified', 0xEF76),
    'lab': ('science', 0xEA4B),
    'network': ('hub', 0xE9F4),
    'level': ('stairs', 0xF1A9),
    'affiliation': ('account_balance', 0xE84F),
}
AXES = {'FILL': 0, 'wght': 300, 'GRAD': 0, 'opsz': 24}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons' / 'material-pictogram-300.woff2'
MANIFEST = ROOT / 'assets' / 'icons' / 'material-pictogram-300.json'

def main(src):
    font = TTFont(src)
    static = instancer.instantiateVariableFont(font, AXES, inplace=False, updateFontNames=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = []  # codepoint access only (CSS content), no ligatures needed
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.drop_tables += ['GSUB', 'GPOS']
    sub = subset.Subsetter(options)
    sub.populate(unicodes=[cp for _, cp in GLYPHS.values()])
    sub.subset(static)
    static.flavor = 'woff2'
    OUT.parent.mkdir(parents=True, exist_ok=True)
    static.save(OUT)
    data = OUT.read_bytes()
    check = TTFont(OUT)
    cmap = check.getBestCmap()
    missing = [n for n, (_, cp) in GLYPHS.items() if cp not in cmap]
    if missing:
        raise SystemExit(f'missing glyphs: {missing}')
    manifest = {
        'family': 'LDS Material Symbols Rounded Pictogram',
        'file': OUT.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'source': 'google/material-design-icons variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf',
        'sourceSha256': hashlib.sha256(Path(src).read_bytes()).hexdigest(),
        'license': 'Apache-2.0 (assets/icons/material-symbols-Apache-2.0.txt)',
        'axes': AXES,
        'glyphs': {role: {'name': name, 'codepoint': f'U+{cp:04X}'} for role, (name, cp) in GLYPHS.items()},
        'status': 'test exception to LDS nav-7 (owner 2026-10-22; actions and building added 2026-10-29; beds, rail, meeting, compare 2026-11-01; rank, date, distance, construction and dataset 2026-11-01 for short copy; hospital, service, accredit, lab, network, level and affiliation 2026-11-05 for CityMETER Hospital); nav-7 subset unchanged',
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'wrote {OUT} ({len(data)} bytes, sha256 {manifest["sha256"]}) and {MANIFEST.name}')
    print('unicode-range:', ', '.join(f'U+{cp:04X}' for _, cp in GLYPHS.values()))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
