/**
 * Shared AI Prompt Configuration for Nutri-Vision AI
 *
 * Single source of truth for the food analysis prompt sent to all AI providers
 * (Cloudflare Workers AI, Google Generative AI).
 *
 * v3.0 — Structured sequence schema, dynamic spikeReduction, improved confidence definition.
 */

export const AI_PROMPT = `You are a food identification and nutrition expert. Analyze this image carefully.

CRITICAL RULES:
1. FIRST identify what is actually in the image. Do NOT assume it is a prepared dish.
2. The image may contain: raw fruits, raw vegetables, whole ingredients, snacks, prepared meals, beverages, or non-food items.
3. Only list ingredients/items that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items that are not there.
4. If the image shows a single raw fruit or vegetable, identify it as such (e.g., "Pineapple", "Banana", "Mango").
5. If the image shows MULTIPLE items, list ALL of them separately (e.g., "Pineapple" and "Artichokes").
6. If the image does NOT contain food, set isFood to false.
7. Estimate nutrition per typical serving size visible in the image.
8. Set confidence 0-100 based on how clearly and accurately you can identify the food. Use LOW values (<50) when the image is blurry, dark, or ambiguous.
9. Estimate spikeReduction 0-100: how much eating in the recommended sequence could reduce blood sugar spikes compared to eating randomly. High-fiber, protein-rich meals get higher values.

SEQUENCE RULES:
- Always provide exactly 4 steps in the sequence array.
- Step 1 = fiber/vegetables (category "fiber"), Step 2 = protein/fat (category "protein"), Step 3 = carbohydrates (category "carb"), Step 4 = sweets/sugars (category "sugar").
- Use appropriate food emojis for each step based on actual detected items.
- In the "items" field, list the specific detected foods that belong to that category.

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"foodName":"Name of the dish or ingredient","foodCategory":"fruit|vegetable|prepared_dish|snack|beverage|dessert|other","detectedItems":["🍍 Item 1","🥕 Item 2"],"nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0},"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"sequence":[{"step":1,"emoji":"🥦","items":"Vegetables listed here","category":"fiber"},{"step":2,"emoji":"🍗","items":"Protein foods here","category":"protein"},{"step":3,"emoji":"🍚","items":"Carb foods here","category":"carb"},{"step":4,"emoji":"🍬","items":"Sweet items here","category":"sugar"}],"spikeReduction":65,"tip":"One short helpful tip about this specific food.","confidence":0}`;

export const LOCALE_INSTRUCTION: Record<string, string> = {
  th: '\n\nIMPORTANT: Respond with ALL text values (foodName, detectedItems, sequence items, tip) in Thai language (ภาษาไทย). Use Thai food names when applicable.',
  en: '\n\nIMPORTANT: Respond with ALL text values in English.',
  de: '\n\nIMPORTANT: Respond with ALL text values in German (Deutsch).',
  da: '\n\nIMPORTANT: Respond with ALL text values in Danish (Dansk).',
};

/** Build the full localized prompt */
export function buildLocalizedPrompt(locale: string): string {
  return AI_PROMPT + (LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en);
}

/** Structured sequence step from AI response */
export interface AiSequenceStep {
  step: number;
  emoji: string;
  items: string;
  category: 'fiber' | 'protein' | 'carb' | 'sugar';
}

/** Raw AI response shape (before validation) */
export interface AiRawResponse {
  isFood: boolean;
  foodName: string;
  foodCategory: string;
  detectedItems: string[];
  nutritionSummary: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  scores: {
    bloodSugar: number;
    gutHealth: number;
    inflammation: number;
    nutrientDensity: number;
    processing: number;
    proteinQuality: number;
    micronutrient: number;
  };
  sequence: AiSequenceStep[];
  spikeReduction: number;
  tip: string;
  confidence: number;
}

/** Default sequence fallback when AI returns invalid structure */
export const DEFAULT_SEQUENCE: AiSequenceStep[] = [
  { step: 1, emoji: '🥦', items: 'Eat vegetables first', category: 'fiber' },
  { step: 2, emoji: '🍗', items: 'Protein & healthy fats', category: 'protein' },
  { step: 3, emoji: '🍚', items: 'Carbohydrates', category: 'carb' },
  { step: 4, emoji: '🍬', items: 'Sweets last', category: 'sugar' },
];

const VALID_CATEGORIES = ['fiber', 'protein', 'carb', 'sugar'] as const;

/** Validate and sanitize a single sequence step */
function validateSequenceStep(raw: any, index: number): AiSequenceStep {
  const fallback = DEFAULT_SEQUENCE[index] || DEFAULT_SEQUENCE[0];
  return {
    step: Number(raw?.step) || index + 1,
    emoji: typeof raw?.emoji === 'string' && raw.emoji.length > 0 ? raw.emoji : fallback.emoji,
    items: typeof raw?.items === 'string' && raw.items.length > 0 ? raw.items : fallback.items,
    category: VALID_CATEGORIES.includes(raw?.category) ? raw.category : fallback.category,
  };
}

/** Validate and sanitize full AI response — prevents frontend crashes from malformed model output */
export function validateAiResponse(raw: any): AiRawResponse {
  const safeScores = {
    bloodSugar: Math.min(100, Math.max(0, Number(raw?.scores?.bloodSugar) || 50)),
    gutHealth: Math.min(100, Math.max(0, Number(raw?.scores?.gutHealth) || 50)),
    inflammation: Math.min(100, Math.max(0, Number(raw?.scores?.inflammation) || 50)),
    nutrientDensity: Math.min(100, Math.max(0, Number(raw?.scores?.nutrientDensity) || 50)),
    processing: Math.min(100, Math.max(0, Number(raw?.scores?.processing) || 50)),
    proteinQuality: Math.min(100, Math.max(0, Number(raw?.scores?.proteinQuality) || 50)),
    micronutrient: Math.min(100, Math.max(0, Number(raw?.scores?.micronutrient) || 50)),
  };

  // Parse sequence: support both new structured format and legacy string arrays
  let parsedSequence: AiSequenceStep[];
  if (Array.isArray(raw?.sequence) && raw.sequence.length > 0) {
    if (typeof raw.sequence[0] === 'object' && raw.sequence[0] !== null) {
      // New structured format
      parsedSequence = raw.sequence.slice(0, 4).map((s: any, i: number) => validateSequenceStep(s, i));
    } else {
      // Legacy string format — convert with heuristic category detection
      parsedSequence = raw.sequence.slice(0, 4).map((s: string, i: number) => {
        const text = String(s).toLowerCase();
        let category: AiSequenceStep['category'] = DEFAULT_SEQUENCE[i]?.category || 'fiber';
        if (text.includes('protein') || text.includes('meat') || text.includes('fish') || text.includes('egg')) category = 'protein';
        else if (text.includes('carb') || text.includes('rice') || text.includes('noodle') || text.includes('bread')) category = 'carb';
        else if (text.includes('sugar') || text.includes('sweet') || text.includes('dessert')) category = 'sugar';
        else if (text.includes('fiber') || text.includes('veg') || text.includes('salad')) category = 'fiber';
        return {
          step: i + 1,
          emoji: DEFAULT_SEQUENCE[i]?.emoji || '💡',
          items: String(s),
          category,
        };
      });
    }
  } else {
    parsedSequence = [...DEFAULT_SEQUENCE];
  }

  // Ensure exactly 4 steps
  while (parsedSequence.length < 4) {
    parsedSequence.push(DEFAULT_SEQUENCE[parsedSequence.length] || DEFAULT_SEQUENCE[0]);
  }

  return {
    isFood: raw?.isFood !== false,
    foodName: String(raw?.foodName || 'Unknown Food'),
    foodCategory: String(raw?.foodCategory || 'other'),
    detectedItems: Array.isArray(raw?.detectedItems) ? raw.detectedItems.map(String) : ['Unknown'],
    nutritionSummary: {
      calories: Number(raw?.nutritionSummary?.calories) || 0,
      protein: Number(raw?.nutritionSummary?.protein) || 0,
      carbs: Number(raw?.nutritionSummary?.carbs) || 0,
      fat: Number(raw?.nutritionSummary?.fat) || 0,
      fiber: Number(raw?.nutritionSummary?.fiber) || 0,
    },
    scores: safeScores,
    sequence: parsedSequence,
    spikeReduction: Math.min(100, Math.max(0, Number(raw?.spikeReduction) || 60)),
    tip: String(raw?.tip || 'Eat vegetables first to reduce blood sugar spikes.'),
    confidence: Math.min(100, Math.max(0, Number(raw?.confidence) || 0)),
  };
}
