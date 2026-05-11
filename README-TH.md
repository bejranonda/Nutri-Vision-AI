# 🍜 Shinny Guide (Nutri-Vision AI)

**อร่อย ตาม ลำดับ — Delicious in Order**

> อยู่เพื่อกินบำนาญ · Live Long to Eat Well

[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare_Pages-F38020?logo=cloudflare)](https://nutri-vision-ai.pages.dev)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)

## Shinny Guide คืออะไร?

Shinny Guide คือแอป AI ที่ช่วยจัดลำดับการกินอาหารไทย (และอาหารทุกชนิด) เพื่อลดการพุ่งของน้ำตาลในเลือดได้ถึง **70%** ตามหลักวิทยาศาสตร์จริง — กิน **ผัก → โปรตีน → แป้ง → หวาน**

พบกับ **ชินนี่** (Shinny) AI โค้ชโภชนาการที่แนะนำทุกมื้อ!

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | ฟรี | พรีเมียม (฿199/เดือน) | แฟมิลี่ (฿299/เดือน) |
|---------|------|--------------------|-------------------|
| โหมด AI สแกน | มื้ออาหาร | มื้ออาหาร, เมนู, เครื่องดื่ม/ขนม | มื้ออาหาร, เมนู, เครื่องดื่ม/ขนม |
| สแกนอาหาร | 10/เดือน | ∞ | ∞ |
| คะแนนสุขภาพ | 3 มิติ | 8 มิติ | 8 มิติ |
| AI โค้ชชินนี่ | 3 ครั้ง/วัน | ∞ | ∞ |
| อวาตาร์ AI ชินนี่ | — | ✓ (เปลี่ยนท่าทางได้) | ✓ |
| สูตรอาหารไทย | 100 | 1,000+ | 1,000+ |
| วางแผนมื้ออาหาร | — | ✓ | ✓ |
| สมาชิกครอบครัว | — | — | 5 |
| ส่งออกข้อมูล | — | ✓ | ✓ |

### 📱 หน้าแอป
- **หน้าแรก** — แลนดิ้งเพจพร้อมอธิบายแนวคิด & ฟีเจอร์
- **สแกน** — วิเคราะห์อาหารด้วย AI 3 โหมด (มื้ออาหาร, เมนู, ขนม) แสดงลำดับการกิน & คะแนนสุขภาพ 8 มิติ พร้อมโหมด Debug ขั้นสูง
- **เดโม** — สาธิตวิธีกินตามลำดับแบบอินเตอร์แอคทีฟ พร้อมกราฟน้ำตาลก่อน/หลัง
- **เข้าสู่ระบบ** — ลงทะเบียนด้วยอีเมล, Google, LINE พร้อมใช้รหัสโปรโมชั่น
- **แดชบอร์ด** — สถิติสมาชิก, สตรีค, ภารกิจประจำวัน, เกมส์สุขภาพ
- **ราคา** — เปรียบเทียบแพลน รายเดือน/รายปี พร้อมคำถามที่พบบ่อย
- **สูตรอาหาร** — สูตรอาหารไทยพร้อมตัวกรองตามประเภทอาหาร

### 🎟️ ระบบรหัสโปรโมชั่น
รหัสสำหรับแฟนคลับชินนี่และโปรเปิดตัว:
- `SHINNY2024` — พรีเมียมฟรี 30 วัน (แฟนคลับชินนี่)
- `EATWELL` — ทดลองพรีเมียม 7 วัน
- `LAUNCH50` — ลด 50% เดือนแรก
- `FAMILY2024` — ทดลองแฟมิลี่ 14 วัน

## 🧠 วิธีการวิเคราะห์ของ AI (v2.3, พ.ค. 2026)

Nutri-Vision AI ใช้หลักการวิเคราะห์แบบ **Identify-First** ขับเคลื่อนโดยระบบ **Primary + Gemini Cascade Fallback** (สลับผู้ให้บริการ AI อัตโนมัติ และวนผ่านโมเดล Gemini หลายตัวจนกว่าจะพบตัวที่ใช้งานได้)

### ระบบประมวลผลอัจฉริยะ (Inference Pipeline):
1.  **ตัวหลัก (Primary)**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct` (โมเดล multimodal คุณภาพสูง)
2.  **ตัวสำรองแบบ Cascade**: Google Gemini Flash — `gemini-2.5-flash` → `gemini-2.0-flash` (โมเดล multimodal, ฟรีเทียร์ ~1500 ครั้ง/วัน ต่อโมเดล ต่อโปรเจกต์)
    *   หากโมเดล 11B ของ Cloudflare ทำงานล้มเหลวหรือค้างเกิน 25 วินาที ระบบจะวนผ่านรายชื่อโมเดลใน `GEMINI_VISION_MODELS` (`frontend/src/lib/ai-providers.ts`) ตามลำดับ ส่งผลลัพธ์จากโมเดลแรกที่ตอบ 200 OK กลับไป **ข้ามต่อ** เมื่อเจอ 404 (โมเดลถูกปลดระวาง) หรือ 429 (โควต้าโมเดลนั้นหมด) และ throw ทันทีเมื่อเจอ error อื่น (เช่น 5xx / network — โมเดลพี่น้องช่วยไม่ได้)
    *   **ทำไมต้องเป็น Cascade ไม่ใช่ id เดียว**: นโยบายฟรีเทียร์ของ Google เป็นแบบ *per-project AND per-model* — พฤษภาคม 2026 พบว่า `gemini-2.0-flash` ถูกตั้ง `limit: 0` บนคีย์เรา ขณะที่ `gemini-2.5-flash` บนคีย์เดียวกันยังมีโควต้า 1500 ครั้ง/วัน การ hardcode id เดียวคือ "บั๊กแฝง" ที่รอนโยบายผู้ให้บริการเปลี่ยน
    *   **ห้ามใช้ alias `-latest`**: Google ปลดระวาง `gemini-1.5-flash-latest` จาก `v1beta` ในเดือนพฤษภาคม 2026 โดยไม่แจ้งล่วงหน้า — pin id แบบเจาะจงเวอร์ชันเสมอ
    *   **Single source of truth**: chat path (`callGemini`) อ้างอิง `GEMINI_VISION_MODELS[0]` เพื่อให้ scan + chat ไม่หลุดจากกันแบบเงียบ ๆ
    *   **`primaryProviderError`**: เมื่อ /api/analyze ตอบ 503 จะมี field นี้ใน response body เก็บข้อผิดพลาดของ Cloudflare primary ไว้ด้วย ไม่ให้ความผิดพลาดของ provider แรกถูกซ่อนเมื่อ fallback ล้มเหลวด้วย

ระบบถูกออกแบบมาเพื่อความเสถียรระดับ Edge:
1. บีบอัดรูปภาพฝั่งไคลเอนต์ (ลดขนาดจาก 10MB เหลือ ~150KB)
2. **10-Phase Fault-Tolerant Pipeline**: แยกการทำงานแต่ละส่วน (DB, Session, AI) ออกจากกันอย่างเด็ดขาดด้วย `try/catch` โดยในส่วน AI มีระบบ **Auto-Correction Loop** ช่วยสแกนซ้ำถ้าหากพบว่า JSON ไม่สมบูรณ์
3. ระบบป้องกันการค้าง (Timeout) รวม 45 วินาทีที่ฝั่ง Server ด้วย `Promise.race` และ `AbortController` — Cascade แต่ละโมเดลใช้เวลา `floor(งบรวม / จำนวนโมเดล)` เพื่อให้ทั้ง cascade ไม่เกินงบ
4. ระบบติดตาม Request & Telemetry: ใช้ `?debug=1` ในหน้าสแกนเพื่อดูเวลาทำงาน กู้คืนข้อมูล JSON ที่พัง และเครื่องมือคัดลอกข้อมูล Debug ออกมาตรวจสอบ
5. ตรวจสอบโครงสร้าง JSON อย่างเคร่งครัด พร้อมระบบแจ้งเตือน "ไม่ใช่ภาพอาหาร" (Graceful Non-Food Error)
6. ระบบการตรวจสอบ Deployment (Health Verification) ทำงานผ่าน `/api/health` เพื่อเช็คสถานะฐานข้อมูลและ AI API
7. **การตรวจสอบคำขอด้วย Zod**: ทุก `/api/*` route ตรวจสอบ JSON body ด้วย schema ใน `frontend/src/lib/schemas.ts` ก่อนแตะฐานข้อมูลหรือเรียก AI เพื่อกันข้อมูลผิดรูปแบบตั้งแต่ที่ edge
8. **ป้องกัน Promo Code ซ้ำที่ระดับฐานข้อมูล**: โค้ดโปรโมชันถูกบังคับให้ redeem ได้ครั้งเดียวต่อผู้ใช้ผ่าน `UNIQUE INDEX` บน `code_redemptions(user_id, code_id)` — แม้จะมีการยิง request พร้อมกันก็ไม่สามารถรับสิทธิ์ซ้ำได้

## 🛠 เทคโนโลยี

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **i18n**: next-intl (🇬🇧 EN, 🇹🇭 TH, 🇩🇪 DE, 🇩🇰 DA)
- **State**: Zustand + persist middleware
- **ฐานข้อมูล**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI vision** (สแกนอาหาร): Cloudflare Workers AI (Llama 3.2 11B Vision) → Google AI Gemini Flash cascade (`gemini-2.5-flash` → `gemini-2.0-flash`, ข้ามเมื่อ 404/429) — Multimodal fallback chain พร้อม locale-aware prompting
- **AI chat** (Coach Shinny): Groq (Llama 3.3 70B, ฟรี 30 ครั้ง/นาที) → Google AI Gemini (`GEMINI_VISION_MODELS[0]`, ~1500 ครั้ง/วัน) → Cloudflare Workers AI — three-stage cascade, ฟรีเทียร์เป็นหลัก
- **Performance**: บีบอัดรูปภาพฝั่งไคลเอนต์ (HTML5 Canvas) ก่อนส่ง AI

## 🚀 เริ่มต้นใช้งาน

```bash
cd frontend
npm install
npm run dev        # → http://localhost:3000
```

## 📊 ระบบสมาชิก

### ขั้นตอนการสมัคร
1. สมัครด้วยอีเมล/รหัสผ่าน → แพลนฟรี
2. ใช้รหัสโปรโมชั่น → อัปเกรดเป็นพรีเมียม/ทดลองใช้
3. ความปลอดภัยระดับ Edge: จัดการ Session ด้วย HttpOnly Cookies ผ่าน Next.js Edge APIs และ Cloudflare D1

## 📋 การต่อยอดธุรกิจ

### แหล่งรายได้
1. **สมัครสมาชิก B2C** — ฟรี → พรีเมียม/แฟมิลี่
2. **B2B Corporate Wellness** — แพ็กเกจองค์กร
3. **พาร์ทเนอร์ชิพ** — เดลิเวอรี่, ไลเซนส์คอนเทนต์, พันธมิตร
4. **ระบบโปรโมชั่น** — รหัสแฟนคลับ (ชินนี่), รหัสเปิดตัว, รหัสแนะนำ

## 📜 สัญญาอนุญาต

MIT © เวรพล เบจรานนท์
