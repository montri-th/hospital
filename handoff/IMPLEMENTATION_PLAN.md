# CityMETER Hospital — Implementation Plan (0.1.0)

คู่กับ `implementation-plan.json`

## สถาปัตยกรรม

Static site บน GitHub Pages: ES modules ผ่าน import map (cache tag เดียวทุกโมดูล) ไม่มี build step ของหน้าเว็บ · MapLibre GL JS 5.6.2 (unpkg, pinned) + `js/maplibre-guard.js` · basemap สร้างเองบน OpenFreeMap · กราฟเป็น HTML ไม่มีไลบรารี · ข้อมูล `data/hospitals.json` (columnar) สร้างด้วย Python จากแท็บของชีตวิจัย + production base info + จุดของชุด Hospital ใน production + CityMETER · Transit

| ชั้น | โมดูล |
|---|---|
| ข้อมูลและมาตรวัด | `js/model.js` (decode, `METRICS`, `rowValue`, `pinRadius`, `shortName`) · `js/areas.js` · `js/area-insight.js` |
| มุมมองแผง | `js/profile-model.js` (overview, area, station, building, facility, affiliation, `compsetOf`) · `js/panel.js` · `js/ask.js` · `js/breadcrumb.js` |
| กราฟและตาราง | `js/chart-model.js` · `js/charts.js` · ตารางใน `js/app.js` |
| แผนที่ | `js/app.js` (orchestration) · `js/map-style.js` · `js/map-layers.js` · `js/provinces.js` · `js/frames.js` · `js/pins.js` · `js/labels.js` · `js/stations.js` · `js/scales.js` · `js/cues.js` |
| อาคารและกล้อง | `js/massing.js` · `js/building-units.js` · `js/building-join.js` · `js/venue-xray.js` · `js/camera.js` · `js/terrain.js` · `js/maplibre-guard.js` |
| สคริปต์ | `scripts/export-sheet-tabs.js` · `fetch-base.py` · `fetch-points.py` · `build-receipts.py` · `build-data.py` · `build-pictogram-font.py` · `build-building-units.py` · `check-lds-parity.mjs` · `build-handoff.mjs` · `verify-live.mjs` |

## งาน (ทั้งหมดเสร็จในรุ่นนี้)

T1 อ่านแท็บของชีตพร้อม SHA-256 · T2 base info และหมุด production พร้อมใบรับ · T3 สร้างข้อมูล · T4 โมเดลและแผงสถานพยาบาล · T5 แผนที่ (หมุดตามเตียง ป้าย สถานี มุมมองอาคาร) · T6 ไอคอนชุดสถานพยาบาล · T7 หน้าเว็บและข้อความ · T8 เอกสารและ handoff · T9 เผยแพร่ ตรวจ live และอัปเดตทะเบียน

## Acceptance criteria

A1–A15 ใน `implementation-plan.json` (ข้อมูล ข้อค้นพบ แผง มาตรวัด สมาชิกภาพเขต EVID-05 คู่เทียบ ชื่อ ความเป็นส่วนตัว release render และ live)

## Backlog

B1 หน่วยอาคารรอบสถานพยาบาล · B2 หมุดของแถว HCODE จากแหล่งที่ตรวจย้อนได้ · B3 ผูก 42 กลุ่มแบรนด์/บริการกับสถานพยาบาลในชีตแล้วเพิ่มตัวกรองเครือ · B4 ตรวจหมุด production ที่ตกต่างเขต 160 / ต่างจังหวัด 48 · B5 ฝั่งความต้องการ (ประชากรและการใช้บริการ) คู่กับอุปทาน
