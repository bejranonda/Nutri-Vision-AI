# 🍜 Shinny Guide: แอป AI สแกนอาหาร & จัดลำดับการกิน เพื่อจัดการน้ำตาลในเลือด (Nutri-Vision AI)

**อร่อย ตาม ลำดับ — Delicious in Order**

> อยู่เพื่อกินบำนาญ · Live Long to Eat Well

[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare_Pages-F38020?logo=cloudflare)](https://nutri-vision-ai.pages.dev)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)](https://nextjs.org)
[![CI](https://github.com/bejranonda/Nutri-Vision-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/bejranonda/Nutri-Vision-AI/actions/workflows/ci.yml)

## Shinny Guide คืออะไร?

Shinny Guide คือ **แอป AI สแกนอาหาร** และ **จัดลำดับการกิน** ที่ออกแบบมาเพื่อการ **จัดการน้ำตาลในเลือด** เพียงแค่ถ่ายรูปอาหารไทย (หรืออาหารชาติใดก็ได้) แอปจะบอกคุณว่าควรกินอะไรก่อนหลัง ด้วยการกินตามลำดับที่ถูกต้อง—**ผัก → โปรตีน → แป้ง → หวาน**—คุณสามารถลดการพุ่งของน้ำตาลในเลือดได้ถึง **70%**\*

<sub>\*อ้างอิงจากงานวิจัย Weill Cornell Medical Center (Shukla et al., 2015) ในผู้ป่วยเบาหวานชนิดที่ 2 ผลลัพธ์อาจแตกต่างกันในแต่ละบุคคล (เพิ่มการอ้างอิงนี้บนหน้าแรกใน UX-audit Round 7 iter 9, PR #53)</sub>

พบกับ **ชินนี่** (Shinny) **AI โค้ชโภชนาการ** ส่วนตัวของคุณ ที่ช่วยแทร็กแคลอรี่ ให้คะแนนสุขภาพ 8 มิติ และแนะนำสูตรอาหารเพื่อสุขภาพกว่า 1,000+ สูตร!

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

ทุกหน้าใช้ `<SiteHeader/>` เดียวกัน (โลโก้ + เมนู Scan/Recipes/Pricing + LanguageSwitcher + ปุ่ม Login/Dashboard ที่รับรู้สถานะล็อกอิน + drawer hamburger สำหรับมือถือ) เพิ่มใน UX-audit Round 7 iter 3 (PR #48) เพื่อแทน "Back to home" ที่ไม่สม่ำเสมอในแต่ละหน้าที่ผู้ใช้รายใหม่เคยเจอ — ดู [`docs/KNOWLEDGE_BASE.md`](docs/KNOWLEDGE_BASE.md) → *Fresh-user audit loop*

- **หน้าแรก** — แลนดิ้งเพจพร้อมอธิบายแนวคิด, ฟีเจอร์, ข้อความสร้างความมั่นใจ "ฟรี ไม่ต้องสมัครก็ใช้ได้" และ CTA หลักที่ใช้ข้อความเดียวกันทั้งเว็บ (*เริ่มสแกนเลย*)
- **สแกน** — วิเคราะห์อาหารด้วย AI 3 โหมด (มื้ออาหาร, เมนู, ขนม) แสดงลำดับการกิน & คะแนนสุขภาพ 8 มิติ มีข้อความเรื่องความเป็นส่วนตัวใต้พื้นที่อัปโหลด ("วิเคราะห์ภาพแบบ real time ไม่เก็บภาพไว้บนเซิร์ฟเวอร์เว้นแต่ผู้ใช้กดบันทึก") พร้อมโหมด Debug ผ่าน `?debug=1`
- **เดโม** — สาธิตวิธีกินตามลำดับแบบอินเตอร์แอคทีฟ พร้อมกราฟน้ำตาลก่อน/หลัง
- **เข้าสู่ระบบ** — อีเมล + รหัสผ่าน, ช่อง voucher ในฟอร์มสมัคร, แท็บ Register เป็นค่าเริ่มต้นสำหรับผู้เยือนรายใหม่ ปุ่ม Google + LINE social-login ขณะนี้แสดงผลเป็น **disabled พร้อม badge "เร็วๆ นี้"** (Round 7 iter 6, PR #50) — บอกว่าเป็นฟีเจอร์อนาคต แต่ไม่หลอกผู้ใช้ว่าใช้ได้แล้ว (OAuth ยังไม่ได้เชื่อม — ดู [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md) ข้อ 1a)
- **แดชบอร์ด** — สถิติสมาชิก, สตรีค, ภารกิจประจำวัน, เกมส์สุขภาพ
- **ราคา** — เปรียบเทียบแพลน รายเดือน/รายปี, คำถามที่พบบ่อย และ **disclosure ขยายได้ที่อธิบายคะแนนสุขภาพทั้ง 8 มิติ** พร้อมคำอธิบายสั้น ๆ และ badge "Free" บนมิติ 3 ตัวที่แพลนฟรีปลดล็อก (Round 7 iter 5, PR #49) ให้ผู้เยือนรายใหม่ประเมินคุณค่าของแพลน Premium ได้โดยไม่ต้องลงทะเบียนสแกนก่อน
- **สูตรอาหาร** — placeholder ระหว่างที่กำลังเตรียมเนื้อหาจริง หน้านี้เคยเป็น "coming soon" แบบโล่ง ๆ ใน Round 7 iter 4 (PR #48) เปลี่ยนเป็น empty state ที่ใช้น้ำเสียงชินนี่พร้อมปุ่มไปสแกนเพื่อไม่ให้ผู้ใช้ติดทางตัน

### 🎟️ ระบบรหัสโปรโมชั่น
รหัสสำหรับแฟนคลับชินนี่และโปรเปิดตัว:
- `SHINNY2024` — พรีเมียมฟรี 30 วัน (แฟนคลับชินนี่)
- `EATWELL` — ทดลองพรีเมียม 7 วัน
- `LAUNCH50` — ลด 50% เดือนแรก
- `FAMILY2024` — ทดลองแฟมิลี่ 14 วัน

## 🧠 วิธีการวิเคราะห์ของ AI (v2.3, พ.ค. 2026)

Nutri-Vision AI ใช้หลักการวิเคราะห์แบบ **Identify-First** ขับเคลื่อนโดยระบบ **Primary + Gemini Cascade Fallback** (สลับผู้ให้บริการ AI อัตโนมัติ และวนผ่านโมเดล Gemini หลายตัวจนกว่าจะพบตัวที่ใช้งานได้)

### ระบบประมวลผลอัจฉริยะ (Inference Pipeline):
1.  **ตัวหลัก (Primary)**: Google Gemini Flash cascade — `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` (โมเดล multimodal, ฟรีเทียร์ ~1500 ครั้ง/วัน ต่อโมเดล ต่อโปรเจกต์)
    *   ระบบวนผ่านรายชื่อโมเดลใน `GEMINI_VISION_MODELS` (`frontend/src/lib/ai-providers.ts`) ตามลำดับ ส่งผลลัพธ์จากโมเดลแรกที่ตอบ 200 OK กลับไป **ข้ามต่อ** เมื่อเจอ 404 (โมเดลถูกปลดระวาง) หรือ 429 (โควต้าโมเดลนั้นหมด) และ throw ทันทีเมื่อเจอ error อื่น (เช่น 5xx / network — โมเดลพี่น้องช่วยไม่ได้)
    *   **ทำไมต้องเป็น Cascade ไม่ใช่ id เดียว**: นโยบายฟรีเทียร์ของ Google เป็นแบบ *per-project AND per-model* — พฤษภาคม 2026 พบว่า `gemini-2.0-flash` ถูกตั้ง `limit: 0` บนคีย์เรา ขณะที่ `gemini-2.5-flash` บนคีย์เดียวกันยังมีโควต้า 1500 ครั้ง/วัน การ hardcode id เดียวคือ "บั๊กแฝง" ที่รอนโยบายผู้ให้บริการเปลี่ยน
    *   **ห้ามใช้ alias `-latest`**: Google ปลดระวาง `gemini-1.5-flash-latest` จาก `v1beta` ในเดือนพฤษภาคม 2026 โดยไม่แจ้งล่วงหน้า — pin id แบบเจาะจงเวอร์ชันเสมอ
    *   **Single source of truth**: chat path (`callGemini`) อ้างอิง `GEMINI_VISION_MODELS[0]` เพื่อให้ scan + chat ไม่หลุดจากกันแบบเงียบ ๆ
2.  **ตัวสำรองสุดท้าย (Safety-net Fallback)**: Cloudflare `@cf/meta/llama-3.2-11b-vision-instruct` (multimodal, ฟรีพร้อมกับ Pages plan)
    *   ทำงานเฉพาะเมื่อ cascade ของ Gemini หมดทุกตัว (ทุกตัว 429/404) หรือคืน JSON ที่ผ่าน validation ไม่ได้ พฤษภาคม 2026 ค้นพบว่าโมเดล CF Llama 3.2 11B vision อ่อนกว่า Gemini มากในงานนี้ — ระบุ "Pineapple" ทั้งที่ภาพคือข้าวผัดกุ้ง ด้วยความมั่นใจ 100% และ JSON output ก็ไม่สม่ำเสมอ การเก็บไว้เป็น last-resort ทำให้ผู้ใช้ได้ *บางอย่าง* แทน 503 เมื่อ Gemini หมด แต่สำหรับเส้นทาง happy-path ปกติ ความแม่นยำของ Gemini ชนะ
    *   ระบบจะ auto-accept Meta Llama Community License ในการเรียกครั้งแรกที่เจอ 5016 (ผ่าน `prompt: 'agree'`) ดังนั้นเส้นทาง fallback ไม่ต้องการ operator มากด accept ใน CF dashboard ด้วยตนเอง
    *   **`primaryProviderError`**: เมื่อ /api/analyze ตอบ 503 จะมี field นี้ใน response body เก็บข้อผิดพลาดของ Gemini primary ไว้ด้วย ไม่ให้ความผิดพลาดของ provider แรกถูกซ่อนเมื่อ fallback ล้มเหลวด้วย

ระบบถูกออกแบบมาเพื่อความเสถียรระดับ Edge:
1. บีบอัดรูปภาพฝั่งไคลเอนต์ (ลดขนาดจาก 10MB เหลือ ~150KB)
2. **10-Phase Fault-Tolerant Pipeline**: แยกการทำงานแต่ละส่วน (DB, Session, AI) ออกจากกันอย่างเด็ดขาดด้วย `try/catch` โดยในส่วน AI มีระบบ **Auto-Correction Loop** ช่วยสแกนซ้ำถ้าหากพบว่า JSON ไม่สมบูรณ์
3. ระบบป้องกันการค้าง (Timeout) รวม 45 วินาทีที่ฝั่ง Server ด้วย `Promise.race` และ `AbortController` — Cascade แต่ละโมเดลใช้เวลา `floor(งบรวม / จำนวนโมเดล)` เพื่อให้ทั้ง cascade ไม่เกินงบ
4. ระบบติดตาม Request & Telemetry: ใช้ `?debug=1` ในหน้าสแกนเพื่อดูเวลาทำงาน กู้คืนข้อมูล JSON ที่พัง และเครื่องมือคัดลอกข้อมูล Debug ออกมาตรวจสอบ
5. ตรวจสอบโครงสร้าง JSON อย่างเคร่งครัด พร้อมระบบแจ้งเตือน "ไม่ใช่ภาพอาหาร" (Graceful Non-Food Error)
6. ระบบการตรวจสอบ Deployment (Health Verification) ทำงานผ่าน `/api/health` เพื่อเช็คสถานะฐานข้อมูลและ AI API
7. **การตรวจสอบคำขอด้วย Zod**: ทุก `/api/*` route ตรวจสอบ JSON body ด้วย schema ใน `frontend/src/lib/schemas.ts` ก่อนแตะฐานข้อมูลหรือเรียก AI เพื่อกันข้อมูลผิดรูปแบบตั้งแต่ที่ edge
8. **ป้องกัน Promo Code ซ้ำที่ระดับฐานข้อมูล**: โค้ดโปรโมชันถูกบังคับให้ redeem ได้ครั้งเดียวต่อผู้ใช้ผ่าน `UNIQUE INDEX` บน `code_redemptions(user_id, code_id)` — แม้จะมีการยิง request พร้อมกันก็ไม่สามารถรับสิทธิ์ซ้ำได้
9. **Per-IP Rate Limiting** (`lib/rate-limit.ts`): sliding-window throttle ทุก POST endpoint สาธารณะ — `/api/auth/login` (10/15นาที), `/api/auth/register` (3/15นาที), `/api/voucher/check` (30/นาที), `/api/chat` (20/นาที). Primary store เป็น `Map` ระดับ module (V8 heap, per-worker-instance) เปลี่ยนจาก `caches.default` หลังจาก bug-hunt พ.ค. 2026 พบว่า Workers Cache API ไม่ให้ same-millisecond consistency ใน OpenNext-on-Pages runtime — 40 parallel voucher probes ต่อ limit 30/นาที ตอบ 200 ทั้งหมด ทดสอบด้วย 5 enforcement test cases ที่พิสูจน์ว่า limit ทำงานจริง ไม่ใช่แค่ไม่ throw
10. **เก้าอี้ห้าขาของการทดสอบ** (Rounds 7 → 12, พ.ค.–มิ.ย. 2026): โปรเจกต์มองว่าความถูกต้องมี 5 มุมที่อิสระจากกัน
    - **unit** (`vitest`, invariant ระดับโค้ด) — 171 cases
    - **e2e** (`playwright` ยิงตรงเข้า production URL) — 97 cases
    - **fresh-user audit** (มนุษย์/AI เดินดูแอปด้วยมุมมองคนที่ไม่รู้ context — จับ bug ด้าน editorial / IA / ความซื่อตรงที่ automated probe จับไม่ได้)
    - **Web Vitals + accessibility inventory** (เพิ่มใน Round 11) — ขับเบราว์เซอร์จริงและตรวจ DOM แบบ axe เพื่อจับ perf regressions (FCP/LCP/CLS) และช่องว่าง WCAG 2.1 AA (`<main>`, ลำดับ h1, การเชื่อม label)
    - **full user-journey** (เพิ่มใน Round 12, `tests/e2e/user-journey.spec.ts`) — สเปคเดียวที่เดินทั้งแอปแบบผู้ใช้จริง: เข้าหน้าแรก + สลับภาษา → อัปโหลดรูป → AI วิเคราะห์ → เห็นผลลัพธ์, สมัครสมาชิกครบวงจร, เดินดู recipes/chat/dashboard — ทุก flow ต้องจบที่ *terminal UI state* ไม่ใช่ spinner ค้างหรือ crash
    Recipe ของทั้ง 5 มุมอยู่ใน [`docs/GUIDELINE.md`](docs/GUIDELINE.md) → *The fresh-user audit lens*, *The Web-Vitals + a11y inventory lens* และ *The full user-journey lens*
11. **GitHub Actions CI** (`.github/workflows/ci.yml`, เพิ่มใน Round 11) — รัน frontend `check:all` + backend `pytest` ทุก PR ก่อนหน้านี้ไม่มี CI เลย; standalone backend ขาดการตรวจสอบไป 6 สัปดาห์ระหว่าง Round 8–9 จน Round 9 พบ bcrypt บั๊ก 3 ตัว + `python-cors==1.0.0` ที่ไม่มีบน PyPI ทำให้ `pip install` ล้ม CI ตอนนี้จับ rot ชั้นนี้ที่ PR time ก่อนรวมเข้า main

## 🛠 เทคโนโลยี

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **i18n**: next-intl (🇬🇧 EN, 🇹🇭 TH, 🇩🇪 DE, 🇩🇰 DA)
- **State**: Zustand + persist middleware
- **ฐานข้อมูล**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Deploy**: Cloudflare Pages + Workers
- **AI vision** (สแกนอาหาร): Google AI Gemini Flash cascade (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash`, ข้ามเมื่อ 404/429) → Cloudflare Workers AI (Llama 3.2 11B Vision) — Cascade เน้นความแม่นยำเป็นหลัก พร้อม fallback แบบ multimodal และ locale-aware prompting
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
