# CityMETER Hospital — handoff

สำหรับนักพัฒนาที่รับงานต่อ เอกสารในโฟลเดอร์นี้มีสองรูปแบบที่ต้องตรงกัน: Markdown สำหรับคนอ่าน และ JSON (schema `handoff.schema.json` 1.5.0) สำหรับเครื่องตรวจ (`tests/release.test.js` ตรวจ schema และเลขรุ่น)

| ไฟล์ | อ่านเพื่อ |
|---|---|
| `../PRODUCT_STATEMENT.md` · `product-statement.json` | ผู้ใช้ ปัญหา คู่เทียบ กลยุทธ์ claim boundary และสมมติฐานที่ต้องทดสอบ |
| `PRODUCT_BRIEF.md` · `product-brief.json` | สัญญาของหน้าจอ: ข้อค้นพบแรก มาตรวัด สี บริบท คู่เทียบ มาตรฐานและราคาแล็บ แผง กราฟ กล้อง |
| `IMPLEMENTATION_PLAN.md` · `implementation-plan.json` | สถาปัตยกรรม โมดูล งาน acceptance criteria และ backlog |
| `VERIFICATION.md` | ผลตรวจของรุ่นนี้: tests, render, live attestation, live walk |
| `../DATA_METHOD.md` | ที่มาของทุกตัวเลข วิธีจับคู่เขต/อำเภอ บริบท และสิ่งที่ไม่เผยแพร่ |
| `../AGENTS.md` | ความต้องการของเจ้าของที่เป็นสัญญา — อ่านก่อนแก้ |

## ลำดับการทำงาน

1. แก้ข้อมูลในชีตวิจัยเท่านั้น แล้วอ่านแท็บใหม่ด้วย `scripts/export-sheet-tabs.js` ในเบราว์เซอร์ของเจ้าของ (ไม่ commit แท็บที่อ่าน)
2. `python3 -I scripts/build-data.py …` ตาม `DATA_METHOD.md` §10
3. `npm test` และ `npm run check:lds -- --lds <base> --li <profile>`
4. ขยับ `?v=YYYYMMDD-rN` ใน `index.html` + `package.json` + `design-intent.json` + handoff JSON
5. push `main` → GitHub Pages → `npm run handoff:manifest` → `npm run verify:live`
6. เดินเว็บจริงที่ 1440 และ 390 px ทั้ง light และ dark ก่อนบอกว่าเสร็จ

## จุดที่ต้องระวัง

- เตียงที่ไม่ทราบ ≠ 0 เตียง (แต่ 0 ที่ทะเบียนรายงานคือ 0) · ราคาแล็บ = รายแห่ง ไม่รวมข้ามแห่ง · มาตรฐาน = หลักฐานที่เผยแพร่ ไม่ใช่อันดับ · ระยะ = ระยะตรง · ไม่มีคำเตือนบนหน้าจอ ข้อจำกัดอยู่หลังลิงก์ “วิธีนับ” (DATA_METHOD.md)
- เขต/อำเภอของแถวมาจาก build (`row.admin`) ห้ามจับคู่ใหม่บนหน้าจอ และห้ามใส่หมุดให้แถว HCODE ด้วยการเดาจากชื่อหรือที่อยู่
- หน่วยอาคาร (`data/building-units/`) เป็นชุดของ CityMETER · Hotel 0.3.6 — สร้างใหม่รอบสถานพยาบาลเป็นงานถัดไป
- MapLibre ล็อกที่ 5.6.2 พร้อม `js/maplibre-guard.js` อย่าอัปเกรดโดยไม่ตรวจบั๊ก tile cover ซ้ำ
- ลำดับ layer มวลอาคาร x-ray สถานี และหมุด มีผลต่อมุมมองอาคาร อย่าสลับโดยไม่ทดสอบ
