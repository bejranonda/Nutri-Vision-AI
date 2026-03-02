# 🧠 Knowledge Base - Nutri-Vision AI (EatInOrder)

This document serves as a central repository for the architectural decisions, domain logic, and technical foundations of the EatInOrder project.

## 🥗 Core Philosophy: "อร่อย ตาม ลำดับ" (Delicious in Order)

The project is built on the scientific principle of **Food Sequencing**. By consuming food in a specific order, we can significantly flatten glucose spikes after meals.

### The Ideal Sequence
1.  **Fiber (Vegetables/Salads)**: Creates a physical mesh in the small intestine, slowing down the absorption of sugars.
2.  **Protein & Fats (Meat/Eggs/Legumes/Healthy Oils)**: Stimulates GLP-1 (Glucagon-like peptide-1), which slows down gastric emptying.
3.  **Carbohydrates (Rice/Bread/Pasta/Fruit)**: Starch is converted to glucose and absorbed more slowly due to the "protective shield" created by steps 1 and 2.
4.  **Sugar (Desserts/Sweet Drinks)**: Consumed last to minimize the insulin spike.

## 📊 8-Dimension Nutrition Scoring

Our proprietary scoring algorithm (found in `backend/app/services/nutrition_scorer.py`) evaluates food across 8 key health metrics:

1.  **Blood Sugar Impact**: GI calculation, fiber-to-carb ratio, and fructose penalties.
2.  **Gut Health**: Fiber content, prebiotic/probiotic indicators, and fermented food bonuses.
3.  **Inflammation**: Omega-3:6 ratio, ORAC values (antioxidants), and pro-inflammatory marker detection.
4.  **Nutrient Density**: Nutrients per calorie (ANDI-style scoring).
5.  **Processing Level**: NOVA classification, Ultra-Processed Food (UPF) ingredient detection.
6.  **Protein Quality**: Quantity and source quality (PDCAAS-based).
7.  **Micronutrient Coverage**: % RDI coverage for 12 essential vitamins/minerals.
8.  **Overall Health Score**: A weighted average (Blood Sugar 20%, others 10-15%).

## 🤖 AI Service (Workers AI)

We use Cloudflare Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) for:
-   **Image Analysis**: Identifying ingredients and portion sizes from photos.
-   **Nutrition Estimation**: Inferring macro and micronutrient profiles.
-   **Robustness**: Client-side 30s `AbortController` timeout + server-side 25s `Promise.race` timeout + automatic 503 retries.
-   **Chatbot (Shinny)**: Providing empathetic, evidence-based nutrition coaching using the "Live long to eat well" persona.

## 🏗️ Technical Architecture

### Frontend (Next.js)
-   **App Router**: Modern React patterns for server and client components.
-   **i18n**: Multi-language support using `next-intl`.
-   **Edge Compatible**: Optimized to run on Cloudflare Pages/Workers.

### API Architecture (Cloudflare Edge)
The core `/api/analyze` route follows a strict **10-Phase Fault-Tolerant Pipeline** to guarantee it never crashes the user experience:
1. Every phase (DB init, session retrieval, AI, etc.) is wrapped in an isolated `try/catch`. 
2. If non-critical services (like D1 Database or Sessions) fail, the pipeline logs the failure but continues, allowing anonymous scans to succeed.
3. **Edge-Safe Binaries**: Node.js `Buffer.from` is avoided for base64 decoding because it lacks standard support in Edge runtimes. We use `atob()` and `Uint8Array` natively.
4. **Server-Side AI Timeouts**: Cloudflare Workers have hard execution limits. The `env.AI.run()` binding is wrapped in a `Promise.race([aiPromise, timeoutPromise])` to abort gracefully instead of hitting the execution limit.
5. **Binding Access**: All Cloudflare bindings (AI, DB, KV, R2) **must** be accessed via the shared helpers in `src/lib/cloudflare.ts` (`getEnv()` or `getEnvSafe()`). The legacy pattern `(req as any).context?.env` does NOT work in the OpenNext runtime and will return `undefined`.

### Backend (FastAPI)
-   **Async First**: All IO operations (DB, AI calls) are asynchronous.
-   **Pydantic Settings**: Environment-based configuration with strict validation.
-   **Structured Logging**: Every request, response, and internal service step is logged for transparency.

## 🛠️ Logging & Monitoring

We use a unified logging system (`src/lib/logger.ts`) across the stack that bridges Client and Server (Edge) logs:
-   **Scan Flow Diagnostics**: 7 dedicated methods (`scanStart`, `scanApiCall`, `scanError`, `scanApiStage`, etc.) track every step of the food scan journey from upload to DB insert.
-   **Cloudflare Dash**: Real-time log streaming through the Cloudflare Dashboard catches both frontend hydration errors and API timeouts.
-   **Structured Context**: All logs include JSON payloads with file sizes, timings (`durationMs`), and exact failure phases to make debugging trivial.
