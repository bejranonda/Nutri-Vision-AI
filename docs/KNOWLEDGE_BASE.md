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

## 🤖 AI Service (Gemini AI)

We use Google's Gemini 1.5 Pro/Flash for:
-   **Image Analysis**: Identifying ingredients and portion sizes from photos.
-   **Nutrition Estimation**: Inferring macro and micronutrient profiles.
-   **Chatbot (Shinny)**: Providing empathetic, evidence-based nutrition coaching using the "Live long to eat well" persona.

## 🏗️ Technical Architecture

### Frontend (Next.js)
-   **App Router**: Modern React patterns for server and client components.
-   **i18n**: Multi-language support using `next-intl`.
-   **Edge Compatible**: Optimized to run on Cloudflare Pages/Workers.

### Backend (FastAPI)
-   **Async First**: All IO operations (DB, AI calls) are asynchronous.
-   **Pydantic Settings**: Environment-based configuration with strict validation.
-   **Structured Logging**: Every request, response, and internal service step is logged for transparency.

## 🛠️ Logging & Monitoring

We use a unified logging system across the stack:
-   **Backend**: Python's `logging` with request-response middleware.
-   **Frontend**: Custom `Logger` utility (`src/lib/logger.ts`) that bridges Client and Server (Edge) logs.
-   **Cloudflare**: Real-time log streaming through the Cloudflare Dashboard.
