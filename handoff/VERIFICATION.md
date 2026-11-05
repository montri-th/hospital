# CityMETER Hospital 0.1.0 — verification

Release 0.1.0 · 2026-11-05 · cache tag `?v=20261105-r1` · built on CityMETER · Hotel 0.3.6 (montri-th/hotel@177e592).
What was checked, how, and what was not. Snapshot numbers are fixtures of this release.

## 1. Data build

`python3 -I scripts/build-data.py --tabs … --api … --points … --index data/area-index.json --transit <montri-th/transit @5f5232d> --out .`

- 10 tabs of the research master read on 2026-11-05 from the sheet's HTML view (`scripts/export-sheet-tabs.js`), each bound
  by SHA-256 in `meta.tabs` (`02_FACILITIES` 41,828 rows × 62 columns).
- 78 production base-info responses (same base SHA-256 as Hotel's, `data/boundary-receipts.json`); 928 point requests
  (one per district) → 12,516 unique production codes, every one used by a row; receipts' SHA-256 in `meta.points`.
- Build checks (exit non-zero on failure): every basket sum equals its six items; every basket level follows the
  published cut-offs; province totals reconcile with `03_AREA_SUMMARY`; every placed district exists in the index.
- Reported, not fixed: 160 production points in another district than the row's registered one, 48 in another
  province, 1 HCODE district code that disagrees with its name (`meta.checks`).

## 2. Unit tests on the real data — 125 pass, 0 fail

`npm test` (node --test, 20 files): data contract (rows, measures, membership, points, groups, affiliations, quality,
prices, services, rail, hygiene, boundaries), first Aha fixtures (beds and records, ties, spread, filters, EVID-05),
panels (one provenance line, no caveat, Aha copy, district/station/facility/affiliation panels, the no-beds Aha,
comparison set, missing values, names), charts, breadcrumb, cues, labels, pins, scales, camera, massing, x-ray,
MapLibre guards, building join and units, terrain, icons, release consistency and the handoff JSON schema.

## 3. LDS and Location Intelligence parity — 124 ok, 0 failed

`npm run check:lds -- --lds Landometer-Design-System-v0.9.7.md --li Location-Intelligence-Profile-for-LDS-v0.9.7.md`
(SHA-256 `d3085cbc…96` and `5d485604…3c`): `count` and `li.supply` LUTs, anchors and scale versions on both themes,
theme roles, dataState, series 1–10 and the cue order.

## 4. Rendered QA (build container)

Playwright + Chromium, MapLibre 5.6.2 from the npm package; OpenFreeMap, unpkg and the CityMETER building tiles are not
reachable from the container, so the basemap and buildings are empty there (district frames, province frames, pins,
labels and stations draw). Viewports 1440 × 900 (light, dark) and 390 × 844 (phone, light). No console error.

| View | Result |
|---|---|
| First screen | “32% ของเตียงในกรุงเทพมหานคร อยู่ใน 3 เขตนี้” · ราชเทวี · บางกอกน้อย · ปทุมวัน · 10,984 จาก 34,030 เตียง · rail bars 38% / 37% · อันดับ 1 นอกกรุงเทพมหานคร เมืองเชียงใหม่ 4,113 เตียง; district chips with the bed pictogram; legend เตียง \| สถานพยาบาล over the 41-sample ramp; size key 0 · 200 · 1,000 + ไม่ทราบ |
| Facility (`?facility=CMH-11699`) | 3D two-point view; chips 538 เตียง · 500+ · เขตวัฒนา · เอกชน · HA ขั้นก้าวหน้า ถึง 22 พ.ค. 2572 · JCI 3 โปรแกรม · ไม่พบในเครือข่าย สปสช. · เพลินจิต 520 ม.; ราคาแล็บ ฿7,840 สูงมาก + six items; services folded after eight; คู่เทียบ 3 แห่ง ≤ 5 กม.; one provenance line |
| Station (อนุสาวรีย์ชัยสมรภูมิ) | 1,636 เตียง · 7 แห่ง · 500 ม.; list with straight-line distances |
| Affiliation filter (เอกชน) | card 42,876 เตียง · 29,362 แห่ง · 77 จังหวัด · 16% ใกล้รถไฟฟ้า; Aha follows the filter (ห้วยขวาง · วัฒนา · พญาไท) |
| Group without beds (รพ.สต.) | “5,378 แห่ง · ไม่มีเตียงตามทะเบียน” + นับเป็นแห่ง → records Aha (อุบลราชธานี); province list hidden (fixed: it showed the previous filter's provinces) |
| Charts | areas, ประเภท (8 groups), สังกัด; table with เตียง · สังกัด/ระดับ · พื้นที่ · รถไฟฟ้า · มาตรฐาน |
| Dark | district panel (ราชเทวี: อันดับ 1 จาก 916 ทั่วประเทศ · 17% ของกรุงเทพมหานคร · 32% ใกล้รถไฟฟ้า) |
| Phone | one dock (Aha line + measure switch + ramp); the facility sheet opens on the facility |

## 5. Live

Recorded after the deploy (section 5 of the release commit that follows the first push).

## 6. Not verified

- Building massing and CityMETER Building V4 tiles in the container (blocked there): checked on the live site only.
- Screen readers beyond the accessible names asserted by the tests; native mobile browsers.
- The research master's own figures (operation, beds and accreditation as the sources publish them) — the demo
  shows them as recorded.
