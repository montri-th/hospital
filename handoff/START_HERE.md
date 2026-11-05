# CityMETER Hospital — Developer Handoff

รุ่นเผยแพร่ 0.1.0 · 5 พ.ย. 2569 · ชีตวิจัยตรวจแหล่งถึง 1 พ.ย. 2569 (อ่าน 5 พ.ย. 2569)

เริ่มอ่าน `source/handoff/README.md` จากนั้น Product Statement (`source/PRODUCT_STATEMENT.md` + `source/handoff/product-statement.json`), Product Brief และ Implementation Plan ในโฟลเดอร์ `source/handoff` ทั้ง `.md` และ `.json` ใช้คู่กัน

เข้าโฟลเดอร์ `source` แล้วรัน `npm test` และ `npm start` เปิด http://127.0.0.1:4173/

ชุดนี้มี source code (ES modules มีคอมเมนต์สัญญาทุกโมดูล), datasets (ดัชนีเขต/อำเภอ + ขอบเขต 77 จังหวัด + สถานพยาบาล เตียง สังกัด มาตรฐาน ราคาแล็บ บริการ สถานี), assets ที่ตรวจ hash แล้ว, unit tests บนข้อมูลจริง, JSON Schema 1.5.0, acceptance criteria A1–A15, สคริปต์อ่านแท็บของชีต ดึงข้อมูล production สร้างข้อมูล/ใบรับ/manifest/bundle ตรวจ LDS + Location Intelligence parity และตรวจ live bytes อ่าน `source/AGENTS.md` ก่อนแก้ไข

เว็บจริง: https://montri-th.github.io/hospital/
Repository: https://github.com/montri-th/hospital

`RELEASE_RECEIPT.json` (ถ้ามีในชุด) ผูกชุดส่งต่อกับ commit ผล GitHub Pages และ live attestation ส่วน `evidence/` เป็นหลักฐานหน้าจอและผลเทียบ hash ของไฟล์บนเว็บ แยกจาก source ที่ commit แล้ว
