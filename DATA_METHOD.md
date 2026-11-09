# CityMETER · Hospital — data and method

How `data/hospitals.json` is built, what one row and one figure mean, and what the demo never claims. Every number below
is a snapshot of release 0.1.0 (data built 2026-11-05 from the research master as read on 2026-11-05 and the production
points retrieved the same day); the page computes everything from the data at run time, so these are fixtures, not
constants.

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

หน้าจอไม่มีคำเตือน (กฎเจ้าของ ต่อจาก CityMETER · Hotel 0.3.1: “ไม่มี caveats เลย”) ทุกบรรทัดที่มาท้ายแผงมีลิงก์ “วิธีนับ” มาที่นี่ ขอบเขตของตัวเลขอยู่ตรงนี้ที่เดียว

- **เตียง** = จำนวนเตียงที่ทะเบียนสถานพยาบาล HCODE รายงาน (`official_reported_beds_text`) รวมต่อพื้นที่ ไม่ใช่เตียงที่เปิดใช้จริง เตียงว่าง อัตราครองเตียง หรือขนาดตลาด สถานพยาบาลที่ทะเบียนรายงานว่าไม่มีเตียง (หน่วยปฐมภูมิ คลินิก) นับเป็น 0 เตียง ส่วนที่ไม่ทราบจำนวนเตียงไม่นับเป็น 0 (แยกเป็น “ไม่ทราบ” ลายทแยง)
- **แห่ง** = หนึ่งรายการของทะเบียน (ชุด Hospital ของ CityMETER production หรือทะเบียน HCODE) ที่เจ้าของอนุมัติเข้าขอบเขต ยังไม่ได้ตรวจภาคสนามว่ายังเปิดอยู่ ชุดข้อมูลเป็น research master ไม่ใช่สำมะโนสถานพยาบาลที่ไม่ซ้ำกัน
- **หมุดบนแผนที่** = จุดของชุด Hospital ใน CityMETER production (12,516 แห่ง) รายการจาก HCODE ส่วนใหญ่เป็นคลินิก ไม่มีหมุด แต่นับในเขต/อำเภอและรายชื่อตามทะเบียน “สถานพยาบาลบนแผนที่รอบ 5 กม.” และตัวเลขรอบสถานีนับเฉพาะที่มีหมุด
- **สัดส่วนของจังหวัด** = เตียง (หรือแห่ง) ในพื้นที่ ÷ ทั้งจังหวัดในตัวกรอง
- **ใกล้รถไฟฟ้า** = ห่างจุดอ้างอิงของสถานีที่เปิดแล้วไม่เกิน 500 ม. เป็นระยะตรง ไม่ใช่ระยะเดินหรือเวลาเดินทาง นับเฉพาะสถานพยาบาลที่มีหมุด (ตัวตั้งและตัวหารอยู่ในคำอธิบายของแต่ละแท่ง)
- **สังกัด / ระดับ** = ตามทะเบียน HCODE (ระดับ A · S · M1 · M2 · F1 · F2 · F3 ของแผนพัฒนาระบบบริการสุขภาพ)
- **มาตรฐาน HA / JCI** = หลักฐานที่สถาบันรับรองเผยแพร่ (ขั้น HA และวันที่ออก–หมดอายุ, โปรแกรม JCI และวันที่มีผล) ไม่ใช่อันดับคุณภาพหรือผลการรักษา สถานพยาบาลที่ไม่มีชิปมาตรฐานคือไม่พบหลักฐานในชีต ไม่ได้แปลว่าไม่ผ่านมาตรฐาน
- **ราคาแล็บ 6 รายการ** = ราคาที่กรมการค้าภายใน (DIT) เผยแพร่ของ CBC · ตรวจปัสสาวะ · ไขมันในเลือด · BUN · ครีเอตินิน · น้ำตาลในเลือด ตรวจ 31 ต.ค. 2569 วันที่มีผลไม่ระบุในแหล่ง ผลรวมและระดับ (ต่ำมาก…สูงมาก) เทียบกับ 262 แห่งที่มีครบ 6 รายการเท่านั้น ไม่ใช่ราคาทั้งโรงพยาบาล ค่ารักษาจริง หรือแพ็กเกจ แสดงรายแห่ง ไม่รวมหรือเฉลี่ยข้ามแห่ง
- **บริการ** = สาขาที่เว็บไซต์ของผู้ให้บริการระบุ บริการตามทะเบียน สปสช. และโปรแกรมที่ได้รับรอง ตามที่ชีตบันทึก (1,409 แห่ง) ไม่มีรายการ ≠ ไม่มีบริการ
- **เครือข่าย สปสช.** = บทบาทของหน่วยบริการในข้อมูลเปิดเครือข่ายหน่วยบริการ สปสช. (mastercupuc ปีงบ 2568 ไตรมาส 3) ตามที่ CityMETER production จัดกลุ่ม: หน่วยบริการประจำ / แม่ข่าย · หน่วยปฐมภูมิ · หน่วยรับส่งต่อเฉพาะ · ไม่พบในเครือข่าย
- **คู่เทียบ** = สถานพยาบาลประเภทเดียวกัน เตียงครึ่งเท่าถึงสองเท่า ในระยะตรง 5 กม. (ไม่มีเตียง: ประเภทเดียวกันใน 2 กม.) เรียงใกล้ก่อน เป็นรายชื่อเริ่มต้นสำหรับเทียบ ไม่ใช่ชุดคู่แข่งหรือเครือข่ายส่งต่อที่ยืนยันแล้ว
- **ชื่อตามทะเบียน** = ชื่อเต็มที่ทะเบียนใช้ แสดงใต้ชื่อเมื่อต่างกัน (เช่นโรงพยาบาลเอกชนที่ทะเบียนต่อท้ายประเภทใบอนุญาต “โรงพยาบาลทั่วไปขนาดใหญ่”) ค้นด้วยชื่อใดก็เจอ
- **อาคาร** = อาคารบนแผนที่ (CityMETER Building V4 หรือ OpenStreetMap ตามพื้นที่) ความสูง “สูงราว” เป็นค่าประมาณของชุดข้อมูล ไม่ใช่ผลรังวัด “สถานพยาบาลในอาคารนี้” = หมุดอยู่ในขอบอาคาร
- **อาคารใกล้หมุด** = เมื่อหมุดไม่อยู่ในขอบอาคารใด มุมมองอาคาร 3 มิติเปิดที่อาคารบนแผนที่ที่ใกล้หมุดที่สุดภายใน 300 ม. (ไม่มีก็ขยายเป็น 800 ม.) โดยมีหมุดอยู่ในภาพด้วย เป็นการเลือกมุมกล้องเท่านั้น ไม่ได้ยืนยันว่าสถานพยาบาลอยู่ในอาคารนั้น
- **สถานีที่กำลังสร้าง** = โครงการ ยังไม่ใช่บริการ

## 1. Sources

| Input | What it is | Published here? |
|---|---|---|
| Research master | Google Sheets “CityMETER Hospital Thailand — Research Master 2026-10-31” (registry id `research.TH.hospital`, internal; Drive modified 2026-11-01T04:46:33Z). Tabs read: `02_FACILITIES` (the rows), `99_SOURCE_OBSERVATIONS` (register district codes and level labels only), `08_ACCREDITATION` (JCI), `11_PRICE_BASKET`, `13_SERVICE_PROFILE`, `15_SERVICE_FRAMEWORK`, `10_SOURCES`, `01_BRANDS`, `03_AREA_SUMMARY` (province reconciliation), `12_IDENTITY_LINKS` | No. The workbook is larger than a Drive export allows, so each tab was read cell by cell from the sheet's HTML view in the owner's browser (`scripts/export-sheet-tabs.js`); only each tab's SHA-256 (rows as canonical JSON, `meta.tabs`) and the derived columns are published |
| CityMETER production base info | `https://landometer.com/api/v2/citymeter-v3/base/info/lv0` and `…/lv1/{uuid}` (77 provinces, 928 districts, production codes, Thai names, areaSqm), fetched by `scripts/fetch-base.py` | Receipts only (`data/boundary-receipts.json`: url, status, bytes, sha256, retrievedAt for 78 responses) |
| English district names | OpenGISData-Thailand `districts.geojson` @ `fafcea1` (CC BY 4.0, DOPA-credited; SHA-256 in `data/area-index.json → metadata.englishNames`), joined by production district code; read on the English page and in search, never as a boundary | Yes (the names, in `data/area-index.json`) |
| CityMETER production Hospital points | `POST https://landometer.com/api/v2/citymeter-v3/hospital/overlayMvt/14/{x}/{y}?inTileType=DISTRICT&inTileId={uuid}`, layer `layer-hospital-detail` (name, main_code, type_code, role_group, is_cup, is_referral), one request per district (928), fetched 2026-11-05 by `scripts/fetch-points.py` | The 12,516 points (6 decimals) and NHSO role of the production rows; the receipts' SHA-256 (`meta.points.receiptsSha256`) |
| District outlines | Display geometry per province (`data/frames/{CODE}.json`) and province frames (`data/provinces.geojson`), copied unchanged from CityMETER · Hotel 0.3.6 (built by `scripts/build-boundaries.py` from production base info); receipts re-fetched 2026-11-05 (same SHA-256) | Yes |
| CityMETER · Transit | `montri-th/transit` `data/transit.json`, commit `5f5232d` and SHA-256 in `meta.context.rail` (release `transit-data-2026-10-31-r1`, as of 2026-10-31): 145 operating and 81 under-construction stations | Station id, name, line labels, status and reference point |
| Building units | `data/building-units/` copied from CityMETER · Hotel 0.3.6: per อปท./เขต holding a hotel, CityMETER Building V4 or OpenStreetMap (§7b) | Yes |

The rows' own sources are those the sheet lists (`10_SOURCES`, 1,824 sources): the CityMETER production Hospital dataset
(12,516 rows, legacy facility types T3–T8), the MOPH health-facility register HCODE (29,312 rows production does not
represent by code), the HA Thailand snapshot of 31 Aug 2026 and its public directory (31 Oct 2026), the JCI directory
(31 Oct 2026), the DIT hospital price pages (31 Oct 2026), the NHSO service-network register, and providers' own pages.

## 2. One row, two measures

**One row = one row of `02_FACILITIES`**: a source identity the owner approved into the dataset on 31 Oct 2026 — a
production record (`CMH-*`, 12,516) or an HCODE register record (`HCODE-*`, 29,312). As the sheet defines it: one source
code, not a field-verified census of unique operating facilities. Nothing is merged, split, moved or re-labelled; the five
code successions of `12_IDENTITY_LINKS` keep both records, as the sheet does. 31 rows carry a cancelled HCODE code (shown
as “ยกเลิกรหัสในทะเบียน”).

| Measure | Column | Meaning | Snapshot |
|---|---|---|---|
| เตียง (default) | `cols.beds` (−1 = unknown) | `official_reported_beds_text`: the beds in use HCODE reports. A number is the reported count; 0 is a reported 0; blank is unknown | 186,453 beds · 1,597 rows with beds · 23,778 reported 0 · 16,453 unknown |
| แห่ง | 1 per row | Records | 41,828 rows · 928 districts · 77 provinces |

`js/model.js#rowValue`: a row adds its beds (unknown or 0 adds 0) or 1. A district whose records all have unknown beds is
`no_data` (hatch) under beds, never a measured 0; a district whose records report 0 beds is a measured 0.

**Facility groups** (`groups`, from `official_facility_type` of the sheet): โรงพยาบาลศูนย์และทั่วไป 148 · โรงพยาบาลเอกชน
503 · โรงพยาบาลชุมชน 757 · โรงพยาบาลรัฐนอกสังกัดสาธารณสุข 201 · โรงพยาบาลส่งเสริมสุขภาพตำบล 5,378 ·
ศูนย์บริการสาธารณสุขและหน่วยปฐมภูมิ 5,977 · คลินิกเอกชน 28,859 · ไม่ระบุประเภท 5. The register's own type stays in the
source details (`rawTypes`). **Affiliations** (`official_affiliation`): กระทรวงสาธารณสุข 6,980 (118,485 beds) · ท้องถิ่นและ
กรุงเทพมหานคร 4,978 (3,040) · หน่วยงานรัฐอื่น 503 (22,052) · เอกชน 29,362 (42,876) · ไม่ระบุ 5. **Bed bands** (beds > 0):
< 30 · 30–89 · 90–199 · 200–499 · 500+.

## 2a. Names

`name_th` as the sheet writes it, except a private hospital's licence class appended to its name by the licence register
(“โรงพยาบาลบางมดโรงพยาบาลทั่วไปขนาดใหญ่”): the name reads without it (`scripts/build-data.py#display_name`, 77 rows) and
the full form is the register name (`nameOff`, “ชื่อตามทะเบียน”, shown under the heading and searched). Map labels use the
everyday abbreviations of the type words (โรงพยาบาล → รพ., โรงพยาบาลส่งเสริมสุขภาพตำบล → รพ.สต., ศูนย์บริการสาธารณสุข →
ศบส., ศูนย์สุขภาพชุมชน → ศสม.); the full name stays the accessible name.

## 3. District membership (build time, never re-assigned on screen)

Every row is matched to a CityMETER production district at build time (`row.admin`, the first that applies):

| Method | Rule | Rows |
|---|---|---|
| `name` | the row's own district name (HCODE when the code matched, else production) is a production district of its province | 41,828 |
| `code` | the row's HCODE district code is a production district of its province | 0 |
| `point` | the production point lies in a production district of the row's province | 0 |
| `province` / `conflict` / `none` | province only / point in another province / no province | 0 |

The production point is never used to move a row: 160 production points lie in another district than the row's
registered one and 48 in another province (`meta.checks`, reported for the research team); membership stays the row's
registered district. Province totals reconcile with `03_AREA_SUMMARY` at build time.

## 4. Points

Production's own points (`layer-hospital-detail`, joined by `main_code` = `citymeter_main_code`), 6 decimals, one symbol
per row, never clustered. HCODE rows carry no point in the sheet and get none: they count in their district and lists,
never as a pin. 98.6% of the beds (183,887 of 186,453) belong to rows with a point.

## 5. Context from the same registry (straight lines, build time)

- **Rail** (CityMETER · Transit): the nearest operating station and the nearest station under construction within
  2,000 m of the production point (`cols.rail`, `railM`, `rail2`, `rail2M`). The station panel lists rows with a point
  within 500 m of the station's reference point.
- **NHSO role** (production): CUP first, else primary, else referral-only, else not found in the open network
  (`view_hospital_role_group` of production, open rows of NHSO's mastercupuc FY2568 Q3).

Never: travel time, catchment, population ratios, market share or a referral network.

## 6. What the page computes

- **First Aha** (`js/area-insight.js`): the leading province = the province with the most of the measure among rows
  placed at district level; up to three of its districts with the most of it, never cutting through a tie and never
  every district that holds the measure; share = Σ focus ÷ the province's whole total in the selection. Rail comparison:
  share of the measure within 500 m of an operating station among the focus rows with a point vs the rest of the
  province's placed rows with a point. Outside finding: the district(s) with the most of the measure outside that
  province. Snapshot (beds): Bangkok · ราชเทวี 5,891 · บางกอกน้อย 2,863 · ปทุมวัน 2,230 = 10,984 / 34,030 (32%); rail 38%
  (4,198/10,983) vs 37% (8,285/22,430); outside: เมืองเชียงใหม่ 4,113. Snapshot (records): Bangkok · บางกะปิ 150 ·
  จตุจักร 148 = 298 / 3,439 (9%; the third district is tied); outside: หาดใหญ่ 460 — more than any เขต.
- **A selection without beds** (primary care, clinics): the Aha shows its records and offers the record measure
  (“นับเป็นแห่ง”); the map shows measured zeros.
- **Station panel** (`buildStationProfile`): rows with a point within 500 m (a row near two stations is listed at both).
  **Station ranking** (`stationsOf`): each row counted once, at its nearest operating station.
- **Comparison set** (`compsetOf`): rows with a point of the same group within 5,000 m whose reported beds are within
  ½–2× the facility's own (both above 0) — or, for a facility without beds, of the same group within 2,000 m — nearest
  first, up to 10; plus every row with a point within the same radius. Reads every row of the dataset, so it does not
  move with the filters. A screening aid, not a competitive or referral set.
- **Lab basket level**: nearest-rank quintiles (P20/P40/P60/P80 = ฿1,470 · ฿2,026 · ฿2,570 · ฿3,598.69) of the basket
  sum over the 262 facilities with all six items; equal sums share a level (`meta.basket`). Shown per facility only.

## 7. Colour and categorical rules

- Beds → Location Intelligence Profile for LDS 0.9.7 `li.supply` (capacity at hand); records → LDS 0.9.7 `count`. All 41
  samples by rank among the measured nonzero values being read (owner standing rule “Color scale ขอให้ใช้ 41 scales ตาม
  LDS เสมอ”), the same HEX on both themes; EVID-05 treatments from the base `dataState`. `npm run check:lds -- --lds
  <base> --li <profile>` compares every shipped value with both source files.
- Facility groups bind by stable id to `landometer-series-10-v8` with the series shape cue (`js/cues.js#GROUP_SERIES`):
  regional 1 circle · private 2 square · community 3 triangle · public_other 4 diamond · center 7 hexagon · clinic 8 ring ·
  other 9 dash · subdistrict 10 plus (no series 6 / star: it would read as a rating).
- Symbol size: the symbol's area grows with the reported beds — radius = k(zoom) · √(beds ÷ 100), beds capped at 1,500,
  never below 3 px (`js/model.js#pinRadius`, `PIN_SCALE`); a reported 0 sits at the floor; unknown beds: the same shape as
  an open outline at the 10-bed size. Quiet context dots: grey, about half size, at most 6 px.
- Ordinal bars (bed bands, stations, affiliations) use one neutral foundation fill; the lab basket level is a five-step
  meter in text colours, never a colour scale.

## 7a. Names near the middle of the view and the hover card

From zoom 12.5, focus rows in the central ellipse compete for a short label (group cue, short name, bed pictogram with
beds when > 0), ranked by `row.importance` (the beds percentile + a step for published accreditation + a step for beds > 0;
ranking only, never shown), at most 9 on desktop and 5 on a phone. Hover or focus opens a card of icon chips: type, beds,
affiliation, level, accreditation.

## 7b. Buildings per area and the building view

Carried over from CityMETER · Hotel 0.3.6 unchanged: CityMETER Building V4 in each อปท. (Bangkok: เขต) where it holds at
least 1.15 × the OpenStreetMap buildings, else OpenStreetMap; OSM buildings mapped in parts are kept; CityMETER heights
are model estimates. **The units of this release are Hotel's** (อปท./เขต holding a hotel with a point): a facility
elsewhere stands among OpenStreetMap buildings. Choosing a facility with a point opens a two-point perspective of a 3D
building — the drawn building whose outline holds the pin, else the drawn building nearest the pin within 300 m (800 m
when nothing is drawn within 300 m), framed with the pin and labelled “อาคารใกล้หมุด”. At hilly sites the buildings stand
on the terrain (SRTM 30 m via Terrain Tiles on AWS, 3D ground × 1.5).

## 8. Not published

Addresses, licence codes, phone numbers, operator groups, researcher notes, review and data-gap codes, identity and
operation evidence states, matching rules, raw source records (`99_SOURCE_OBSERVATIONS`), the review queue and data-gap
tabs, the internal sheet, its tabs as read, and private Drive/Sheet URLs (`meta.excludedFields`). Source links are public
https pages; production rows link to the same district on CityMETER production (`?d=hospital`), never to its API.

## 9. Research follow-ups (reported, not patched in `data/`)

- 160 production points in another district than the row's registered one, 48 in another province, 1 HCODE district
  code that disagrees with its name (`meta.checks`).
- 29,312 HCODE records (mostly clinics) have no point; pins for them need a public, checkable source.
- The 42 brand/service families of `01_BRANDS` are not linked to facilities in the sheet; no family is inferred from a
  name (an affiliation filter stands in for it).
- `data/building-units/` is Hotel's; rebuilding the units round the facility points needs the OpenStreetMap counts of
  each unit (`scripts/build-building-units.py`).
- One HA directory category reads as published (“HA Accreditation2”, 1 row) until the sheet names its stage.

## 10. Rebuild

```sh
python3 -I scripts/fetch-base.py --out $BUILD/api
python3 -I scripts/fetch-points.py --api $BUILD/api --out $BUILD/points
python3 -I scripts/build-receipts.py --api $BUILD/api --out .
# tabs: scripts/export-sheet-tabs.js in the owner's browser on the sheet's HTML view → $BUILD/tabs/<tab>.json
python3 -I scripts/build-data.py --tabs $BUILD/tabs --api $BUILD/api --points $BUILD/points \
    --index data/area-index.json --transit <montri-th/transit checkout> --out .
python3 scripts/build-pictogram-font.py <MaterialSymbolsRounded[FILL,GRAD,opsz,wght].ttf>
npm test
```

Changes to rows, links or names are made in the research sheet itself, then read again and rebuilt — never patched in
`data/`.
