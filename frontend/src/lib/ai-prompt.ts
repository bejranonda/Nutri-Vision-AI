/**
 * Shared AI Prompt Configuration for Nutri-Vision AI
 *
 * Single source of truth for the food analysis prompts sent to all AI providers
 * (Cloudflare Workers AI, Google Generative AI).
 *
 * v4.0 — Multi-mode scanning: meal (multi-dish), menu, drink & snack.
 */

// ─── Scan Mode Type ──────────────────────────────────────────────────────────

export type ScanMode = 'meal' | 'menu' | 'drink_snack';

// ─── Meal Scan Prompt (Multi-Dish Aware) ─────────────────────────────────────

export const AI_PROMPT_MEAL = `You are a food identification and nutrition expert. Analyze this image carefully.

CRITICAL RULES:
1. FIRST identify what is actually in the image. Do NOT assume it is a prepared dish.
2. The image may contain: raw fruits, raw vegetables, whole ingredients, snacks, prepared meals, beverages, or non-food items.
3. Only list ingredients/items that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items that are not there.
4. If the image shows a single raw fruit or vegetable, identify it as such (e.g., "Pineapple", "Banana", "Mango").
5. If the image does NOT contain food (e.g. a keyboard, a dog, a landscape), set "isFood" to false and provide a funny, polite "nonFoodReason" explaining that Shinny only analyzes food. Leave all other arrays empty.
6. Set confidence 0-100 based on how clearly and accurately you can identify the food. Use LOW values (<50) when the image is blurry, dark, or ambiguous.
7. Estimate spikeReduction 0-100: how much eating in the recommended sequence could reduce blood sugar spikes compared to eating randomly.

MULTI-DISH DETECTION:
- If the image shows MULTIPLE separate dishes (e.g., several plates/bowls on a table), identify EACH dish separately in the "dishes" array.
- If there is only ONE dish or a single food item, still use the "dishes" array with one entry.
- For each dish, provide its own name, detected items, nutrition, scores, and per-dish eating sequence.
- Set "sourcePhotoIndex" to the 0-based position of the photo the dish came from. For a single-photo scan always use 0. For a collage, number tiles in reading order: top-left=0, then left-to-right, top-to-bottom (e.g. a 2x2 grid is indices 0,1,2,3). Every dish MUST include this field.
- Provide a "crossDishSequence" that tells the user the optimal order to eat ACROSS all dishes (e.g., "Start with vegetables from the salad, then protein from the grilled chicken, then rice from the curry").

SEQUENCE RULES (per dish):
- Always provide exactly 4 steps in each dish's sequence array.
- Step 1 = fiber/vegetables (category "fiber"), Step 2 = protein/fat (category "protein"), Step 3 = carbohydrates (category "carb"), Step 4 = sweets/sugars (category "sugar").
- Use appropriate food emojis for each step.

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"nonFoodReason":"","dishCount":1,"dishes":[{"name":"Dish Name","sourcePhotoIndex":0,"detectedItems":["🍍 Item 1","🥕 Item 2"],"nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0},"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"sequence":[{"step":1,"emoji":"🥦","items":"Vegetables listed here","category":"fiber"},{"step":2,"emoji":"🍗","items":"Protein foods here","category":"protein"},{"step":3,"emoji":"🍚","items":"Carb foods here","category":"carb"},{"step":4,"emoji":"🍬","items":"Sweet items here","category":"sugar"}],"spikeReduction":65,"tip":"One short helpful tip about this dish."}],"crossDishSequence":[{"step":1,"emoji":"🥦","dishIndex":0,"items":"Start with vegetables from Dish 1","category":"fiber"},{"step":2,"emoji":"🍗","dishIndex":0,"items":"Then protein from Dish 1","category":"protein"},{"step":3,"emoji":"🍚","dishIndex":0,"items":"Then carbs from Dish 1","category":"carb"},{"step":4,"emoji":"🍬","dishIndex":0,"items":"Sweets last","category":"sugar"}],"overallTip":"One helpful tip about the entire meal.","confidence":0}`;

// ─── Menu Scan Prompt ────────────────────────────────────────────────────────

export const AI_PROMPT_MENU = `You are a nutritionist who can read restaurant menus in ANY language (Thai, English, German, Danish, Chinese, Japanese, etc.). Analyze this menu photo carefully.

CRITICAL RULES:
1. Read ALL menu items visible in the image, even if the text is in Thai (ภาษาไทย), Chinese, Japanese, or another language.
2. For each menu item, provide: name, estimated health score (0-100), estimated calories, key pros and cons.
3. If you cannot read the menu clearly, set confidence low.
4. If the image does NOT contain a menu, set "isFood" to false and provide a funny, polite "nonFoodReason" explaining why.

RECOMMENDATIONS:
Provide scenario-based recommendations so users can choose based on their current mood or goal:
- "light": best option for a light meal (low calorie)
- "protein": best high-protein option
- "gut_friendly": best for gut health (fermented foods, fiber)
- "blood_sugar_safe": lowest blood sugar impact
- "balanced": most nutritionally balanced option
- "indulgent": if they want to treat themselves (but with health tips)
Also provide a "combo" recommendation: 2 items that go well together for a balanced meal.

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"nonFoodReason":"","menuItems":[{"name":"Item Name","originalName":"ชื่อเมนู (original language if not English)","price":"฿120 (if visible)","healthScore":75,"estimatedCalories":450,"category":"main|appetizer|dessert|drink|snack|soup|salad","pros":["High in protein","Good fiber"],"cons":["High sodium"],"tags":["spicy","vegetarian","gluten-free"]}],"recommendations":{"light":{"itemIndex":0,"reason":"Only 200 calories with plenty of vegetables"},"protein":{"itemIndex":1,"reason":"30g protein from grilled chicken"},"gut_friendly":{"itemIndex":2,"reason":"Fermented ingredients support gut health"},"blood_sugar_safe":{"itemIndex":0,"reason":"Low glycemic load, high fiber"},"balanced":{"itemIndex":1,"reason":"Good ratio of protein, carbs, and fat"},"indulgent":{"itemIndex":3,"reason":"Treat yourself! Just eat the veggies first."}},"combo":{"items":[0,2],"reason":"These two dishes complement each other with protein and fiber."},"overallTip":"One helpful tip about ordering from this menu.","confidence":0}`;

// ─── Drink & Snack Prompt ────────────────────────────────────────────────────

export const AI_PROMPT_DRINK_SNACK = `You are a nutrition expert specializing in beverages and snacks. Analyze this image carefully.

CRITICAL RULES:
1. Identify the drink or snack in the image. It may be: a beverage (coffee, tea, juice, soda, smoothie, alcohol), a packaged snack, fresh fruit, baked goods, candy, etc.
2. If the image does NOT contain a drink or snack, set "isFood" to false and provide a funny, polite "nonFoodReason".
3. Set confidence 0-100 based on clarity.
4. Focus on SUGAR CONTENT — estimate sugar in grams and convert to sugar cubes (1 cube = 4g sugar).
5. Provide healthier alternatives that satisfy the same craving.
6. Give timing advice: when is the best time to consume this (e.g., "after a meal" vs "on empty stomach").

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"nonFoodReason":"","itemName":"Iced Thai Tea","itemCategory":"beverage|snack|dessert|fruit|baked_good|candy|other","nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0},"sugarCubes":8,"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"healthAlerts":["High sugar content","Contains artificial coloring"],"alternatives":[{"name":"Unsweetened Thai Tea","reason":"Same flavor, 70% less sugar","caloriesSaved":150},{"name":"Green Tea","reason":"Antioxidants, zero sugar","caloriesSaved":200}],"timingAdvice":"Best consumed after a meal to reduce blood sugar spike. Avoid on empty stomach.","tip":"One helpful tip about this drink or snack.","confidence":0}`;

// ─── Locale Instructions ─────────────────────────────────────────────────────

export const LOCALE_INSTRUCTION: Record<string, string> = {
  // NOTE on "no transliteration": without an explicit prohibition, smaller
  // models (Gemma in particular) helpfully append a romanized/English version
  // in parentheses, e.g. `ซุปปลา (Soup Pla)` — native speakers find this
  // "karaoke" spelling noisy. Every locale below includes the same rule.
  th:
    '\n\nIMPORTANT: Respond with ALL text values (names, items, tips, reasons, pros, cons) in Thai language (ภาษาไทย). Use Thai food names when applicable. Keep JSON keys in English.' +
    '\nDO NOT add romanized / English / phonetic transliteration after the Thai text. Write "ซุปปลา", never "ซุปปลา (Soup Pla)" or "ซุปปลา (Sup pla)". No Latin letters in parentheses, no pronunciation hints, no translations — the reader already reads Thai.',
  en: '\n\nIMPORTANT: Respond with ALL text values in English. Do not append transliterations or translations in parentheses.',
  de:
    '\n\nIMPORTANT: Respond with ALL text values in German (Deutsch). Keep JSON keys in English.' +
    '\nDo not append English translations or transliterations in parentheses.',
  da:
    '\n\nIMPORTANT: Respond with ALL text values in Danish (Dansk). Keep JSON keys in English.' +
    '\nDo not append English translations or transliterations in parentheses.',
};

/**
 * Collage-awareness instruction. Prepended to the prompt when the client
 * stitched N>1 photos into a single image. Without this, the model often
 * interprets the stitched collage as a single scene and returns only one
 * dish/item, even though the user uploaded several.
 *
 * We return { preamble, reinforcement } so the caller can place the
 * preamble at the TOP of the prompt AND a short reinforcement at the END,
 * right before the model starts generating JSON. LLMs (especially smaller
 * open-weight ones like Gemma) often "forget" early instructions once the
 * JSON schema portion of the prompt dominates their context, so we repeat
 * the constraint at both ends.
 */
function buildCollageInstruction(
  photoCount: number,
  scanMode: ScanMode,
): { preamble: string; reinforcement: string } {
  if (photoCount <= 1) return { preamble: '', reinforcement: '' };

  const shared = `
IMPORTANT — COLLAGE MODE:
The image you are analyzing is a COLLAGE of ${photoCount} SEPARATE PHOTOS that the user uploaded. The photos are arranged in a grid on a white background, with white padding between them. Each tile is a DISTINCT item that was photographed independently — they are NOT part of the same scene.
`.trim();

  if (scanMode === 'meal') {
    const preamble =
      shared +
      `
You MUST return one entry in the "dishes" array for EACH of the ${photoCount} tiles (even if two tiles look similar). The "dishCount" field MUST equal ${photoCount}. Number the dishes in reading order: left-to-right, top-to-bottom. Do not merge tiles, do not skip tiles.
Set "sourcePhotoIndex" on each dish to the 0-based tile index it came from (top-left tile = 0, then increasing left-to-right, top-to-bottom). The dish for the top-left tile must have sourcePhotoIndex=0; the dish for the bottom-right tile of a ${photoCount}-tile grid must have sourcePhotoIndex=${photoCount - 1}.
` +
      '\n\n';

    // Final-reminder line placed after the JSON schema. Short and direct
    // because it's the LAST thing the model reads before generating.
    const reinforcement = `\n\nFINAL REMINDER: the image contains ${photoCount} separate photos. Your "dishes" array MUST have exactly ${photoCount} entries and "dishCount" MUST be ${photoCount}. Each dish MUST include "sourcePhotoIndex" (0..${photoCount - 1}) matching the tile it came from. Before you finish, count your dishes array — if it is not ${photoCount}, you have made an error.\n`;

    return { preamble, reinforcement };
  }

  if (scanMode === 'menu') {
    const preamble =
      shared +
      `
Each tile may be a page or section of a menu (the user may have photographed a multi-page menu). Read items from ALL ${photoCount} tiles and include them in a single "menuItems" array. Do not ignore any tile.
` +
      '\n\n';

    const reinforcement = `\n\nFINAL REMINDER: the image contains ${photoCount} separate menu photos. Your "menuItems" array must include dishes from every tile, not just the first one.\n`;

    return { preamble, reinforcement };
  }

  // drink_snack — schema is single-item. Tell the model to pick the most
  // prominent / center tile so the result is at least deterministic.
  const preamble =
    shared +
    `
Note: the drink & snack schema supports only ONE item. Choose the most prominent item (the user's primary subject — usually the center or largest tile) and analyze only that one. You may mention the other ${photoCount - 1} tile(s) briefly in the "tip" field.
` +
    '\n\n';

  return { preamble, reinforcement: '' };
}

/**
 * Build the full localized prompt for a given scan mode.
 *
 * @param locale      UI locale ('th' | 'en' | 'de' | 'da'); used to pick
 *                    the response-language instruction.
 * @param scanMode    Which schema the model should return.
 * @param photoCount  Number of separate photos the client stitched into
 *                    the image. When > 1, a collage-awareness preamble is
 *                    prepended so the model treats each tile as distinct.
 */
export function buildLocalizedPrompt(
  locale: string,
  scanMode: ScanMode = 'meal',
  photoCount: number = 1,
): string {
  const prompts: Record<ScanMode, string> = {
    meal: AI_PROMPT_MEAL,
    menu: AI_PROMPT_MENU,
    drink_snack: AI_PROMPT_DRINK_SNACK,
  };
  const { preamble, reinforcement } = buildCollageInstruction(photoCount, scanMode);
  const localeInstruction = LOCALE_INSTRUCTION[locale] || LOCALE_INSTRUCTION.en;
  return preamble + prompts[scanMode] + localeInstruction + reinforcement;
}

// ─── Shared Types ────────────────────────────────────────────────────────────

/** Structured sequence step from AI response */
export interface AiSequenceStep {
  step: number;
  emoji: string;
  items: string;
  category: 'fiber' | 'protein' | 'carb' | 'sugar';
}

/** Cross-dish sequence step (references which dish) */
export interface AiCrossDishStep extends AiSequenceStep {
  dishIndex: number;
}

/** Single dish analysis within a multi-dish response */
export interface AiDishAnalysis {
  name: string;
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
  /**
   * 0-based index of the photo (in the collage reading order: left-to-right,
   * top-to-bottom) that this dish came from. Lets the UI display the source
   * photo next to each dish card. Optional for backward compatibility; the
   * validator fills it in with the dish's array index when missing.
   */
  sourcePhotoIndex?: number;
}

/** Multi-dish meal response */
export interface AiMultiDishResponse {
  isFood: boolean;
  nonFoodReason?: string;
  dishCount: number;
  dishes: AiDishAnalysis[];
  crossDishSequence: AiCrossDishStep[];
  overallTip: string;
  confidence: number;
}

/** Menu item from AI */
export interface AiMenuItem {
  name: string;
  originalName?: string;
  price?: string;
  healthScore: number;
  estimatedCalories: number;
  category: string;
  pros: string[];
  cons: string[];
  tags: string[];
}

/** Scenario recommendation */
export interface AiMenuRecommendation {
  itemIndex: number;
  reason: string;
}

/** Menu scan response */
export interface AiMenuResponse {
  isFood: boolean;
  nonFoodReason?: string;
  menuItems: AiMenuItem[];
  recommendations: Record<string, AiMenuRecommendation>;
  combo: {
    items: number[];
    reason: string;
  };
  overallTip: string;
  confidence: number;
}

/** Drink/snack alternative */
export interface AiDrinkAlternative {
  name: string;
  reason: string;
  caloriesSaved: number;
}

/** Drink & snack response */
export interface AiDrinkSnackResponse {
  isFood: boolean;
  nonFoodReason?: string;
  itemName: string;
  itemCategory: string;
  nutritionSummary: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
  sugarCubes: number;
  scores: {
    bloodSugar: number;
    gutHealth: number;
    inflammation: number;
    nutrientDensity: number;
    processing: number;
    proteinQuality: number;
    micronutrient: number;
  };
  healthAlerts: string[];
  alternatives: AiDrinkAlternative[];
  timingAdvice: string;
  tip: string;
  confidence: number;
}

// ─── Legacy Types (backwards compat) ─────────────────────────────────────────

/** Raw AI response shape — legacy single-dish format (kept for backward compat) */
export interface AiRawResponse {
  isFood: boolean;
  nonFoodReason?: string;
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

// ─── Default Fallbacks ───────────────────────────────────────────────────────

export const DEFAULT_SEQUENCE: AiSequenceStep[] = [
  { step: 1, emoji: '🥦', items: 'Eat vegetables first', category: 'fiber' },
  { step: 2, emoji: '🍗', items: 'Protein & healthy fats', category: 'protein' },
  { step: 3, emoji: '🍚', items: 'Carbohydrates', category: 'carb' },
  { step: 4, emoji: '🍬', items: 'Sweets last', category: 'sugar' },
];

const VALID_CATEGORIES = ['fiber', 'protein', 'carb', 'sugar'] as const;

// ─── Validation Helpers ──────────────────────────────────────────────────────

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

/** Clamp a number between 0 and 100 */
function clamp100(val: any, fallback = 50): number {
  return Math.min(100, Math.max(0, Number(val) || fallback));
}

/** Validate score object */
function validateScores(raw: any) {
  return {
    bloodSugar: clamp100(raw?.bloodSugar),
    gutHealth: clamp100(raw?.gutHealth),
    inflammation: clamp100(raw?.inflammation),
    nutrientDensity: clamp100(raw?.nutrientDensity),
    processing: clamp100(raw?.processing),
    proteinQuality: clamp100(raw?.proteinQuality),
    micronutrient: clamp100(raw?.micronutrient),
  };
}

/** Parse and validate a sequence array (supports structured and legacy string format) */
function validateSequenceArray(raw: any): AiSequenceStep[] {
  let parsedSequence: AiSequenceStep[];
  if (Array.isArray(raw) && raw.length > 0) {
    if (typeof raw[0] === 'object' && raw[0] !== null) {
      parsedSequence = raw.slice(0, 4).map((s: any, i: number) => validateSequenceStep(s, i));
    } else {
      // Legacy string format
      parsedSequence = raw.slice(0, 4).map((s: string, i: number) => {
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
  return parsedSequence;
}

// ─── Mode-Specific Validators ────────────────────────────────────────────────

/** Validate single-dish analysis (used within multi-dish and legacy single) */
function validateDishAnalysis(raw: any): AiDishAnalysis {
  // `sourcePhotoIndex` is optional in the raw response. Coerce to a
  // non-negative integer if present; leave undefined otherwise and let the
  // caller fall back to the array index.
  let sourcePhotoIndex: number | undefined;
  const rawIdx = raw?.sourcePhotoIndex;
  if (rawIdx !== undefined && rawIdx !== null) {
    const n = Number(rawIdx);
    if (Number.isFinite(n) && n >= 0) {
      sourcePhotoIndex = Math.floor(n);
    }
  }

  return {
    name: String(raw?.name || raw?.foodName || 'Unknown Food'),
    detectedItems: Array.isArray(raw?.detectedItems) ? raw.detectedItems.map(String) : ['Unknown'],
    nutritionSummary: {
      calories: Number(raw?.nutritionSummary?.calories) || 0,
      protein: Number(raw?.nutritionSummary?.protein) || 0,
      carbs: Number(raw?.nutritionSummary?.carbs) || 0,
      fat: Number(raw?.nutritionSummary?.fat) || 0,
      fiber: Number(raw?.nutritionSummary?.fiber) || 0,
    },
    scores: validateScores(raw?.scores),
    sequence: validateSequenceArray(raw?.sequence),
    spikeReduction: clamp100(raw?.spikeReduction, 60),
    tip: String(raw?.tip || 'Eat vegetables first to reduce blood sugar spikes.'),
    sourcePhotoIndex,
  };
}

/** Validate multi-dish meal response */
export function validateMultiDishResponse(raw: any): AiMultiDishResponse {
  // Handle early exit if not food
  if (raw?.isFood === false) {
    return {
      isFood: false,
      nonFoodReason: String(raw?.nonFoodReason || "This doesn't look like food. Please upload a clear photo of your meal!"),
      dishCount: 0,
      dishes: [],
      crossDishSequence: [],
      overallTip: "Try scanning another food photo.",
      confidence: 100,
    };
  }

  // Handle both new multi-dish format and legacy single-dish format
  let dishes: AiDishAnalysis[];
  if (Array.isArray(raw?.dishes) && raw.dishes.length > 0) {
    dishes = raw.dishes.map((d: any) => validateDishAnalysis(d));
  } else {
    // Legacy single-dish — wrap into dishes array
    dishes = [validateDishAnalysis(raw)];
  }

  // Normalize `sourcePhotoIndex` so downstream UI never has to branch on
  // undefined. The prompt asks the model to set it in reading order, but
  // we apply a safety net:
  //   - fall back to the dish's array index when missing,
  //   - cap out-of-range values (a broken model could return e.g. index 9
  //     for the 2nd dish in a 3-photo collage) to the dish's array index.
  // This keeps the dish ↔ photo mapping deterministic even when the model
  // misbehaves.
  dishes = dishes.map((d, i) => {
    const idx =
      d.sourcePhotoIndex === undefined || d.sourcePhotoIndex >= dishes.length
        ? i
        : d.sourcePhotoIndex;
    return { ...d, sourcePhotoIndex: idx };
  });

  // Parse cross-dish sequence
  let crossDishSequence: AiCrossDishStep[];
  if (Array.isArray(raw?.crossDishSequence) && raw.crossDishSequence.length > 0) {
    crossDishSequence = raw.crossDishSequence.map((s: any, i: number) => ({
      ...validateSequenceStep(s, i),
      dishIndex: Number(s?.dishIndex) || 0,
    }));
  } else {
    // Fallback: use the first dish's sequence as cross-dish
    crossDishSequence = dishes[0].sequence.map((s, i) => ({
      ...s,
      dishIndex: 0,
    }));
  }

  return {
    isFood: raw?.isFood !== false,
    dishCount: dishes.length,
    dishes,
    crossDishSequence,
    overallTip: String(raw?.overallTip || raw?.tip || 'Eat vegetables first to reduce blood sugar spikes.'),
    confidence: clamp100(raw?.confidence, 0),
  };
}

/** Validate menu scan response */
export function validateMenuResponse(raw: any): AiMenuResponse {
  // Handle early exit if not food/menu
  if (raw?.isFood === false || raw?.isMenu === false) {
    return {
      isFood: false,
      nonFoodReason: String(raw?.nonFoodReason || "This doesn't look like a menu. Please upload a clear photo of a restaurant menu!"),
      menuItems: [],
      recommendations: {},
      combo: { items: [], reason: '' },
      overallTip: "Try scanning another menu photo.",
      confidence: 100,
    };
  }

  const menuItems: AiMenuItem[] = Array.isArray(raw?.menuItems)
    ? raw.menuItems.map((item: any) => ({
        name: String(item?.name || 'Unknown Item'),
        originalName: item?.originalName ? String(item.originalName) : undefined,
        price: item?.price ? String(item.price) : undefined,
        healthScore: clamp100(item?.healthScore),
        estimatedCalories: Number(item?.estimatedCalories) || 0,
        category: String(item?.category || 'main'),
        pros: Array.isArray(item?.pros) ? item.pros.map(String) : [],
        cons: Array.isArray(item?.cons) ? item.cons.map(String) : [],
        tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
      }))
    : [];

  const defaultRec = { itemIndex: 0, reason: 'Best available option' };
  const recs = raw?.recommendations || {};
  const recommendations: Record<string, AiMenuRecommendation> = {};
  for (const key of ['light', 'protein', 'gut_friendly', 'blood_sugar_safe', 'balanced', 'indulgent']) {
    if (recs[key]) {
      recommendations[key] = {
        itemIndex: Number(recs[key].itemIndex) || 0,
        reason: String(recs[key].reason || ''),
      };
    }
  }

  return {
    isFood: raw?.isFood !== false && raw?.isMenu !== false,
    menuItems,
    recommendations,
    combo: {
      items: Array.isArray(raw?.combo?.items) ? raw.combo.items.map(Number) : [0],
      reason: String(raw?.combo?.reason || 'A balanced combination.'),
    },
    overallTip: String(raw?.overallTip || 'Choose dishes with plenty of vegetables for better health.'),
    confidence: clamp100(raw?.confidence, 0),
  };
}

/** Validate drink & snack response */
export function validateDrinkSnackResponse(raw: any): AiDrinkSnackResponse {
  // Handle early exit if not food
  if (raw?.isFood === false) {
    return {
      isFood: false,
      nonFoodReason: String(raw?.nonFoodReason || "This doesn't look like a drink or snack. Please upload a clear photo!"),
      itemName: "Unknown",
      itemCategory: "other",
      nutritionSummary: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
      sugarCubes: 0,
      scores: { bloodSugar: 0, gutHealth: 0, inflammation: 0, nutrientDensity: 0, processing: 0, proteinQuality: 0, micronutrient: 0 },
      healthAlerts: [],
      alternatives: [],
      timingAdvice: "",
      tip: "",
      confidence: 100,
    };
  }

  return {
    isFood: raw?.isFood !== false,
    itemName: String(raw?.itemName || 'Unknown Item'),
    itemCategory: String(raw?.itemCategory || 'other'),
    nutritionSummary: {
      calories: Number(raw?.nutritionSummary?.calories) || 0,
      protein: Number(raw?.nutritionSummary?.protein) || 0,
      carbs: Number(raw?.nutritionSummary?.carbs) || 0,
      fat: Number(raw?.nutritionSummary?.fat) || 0,
      fiber: Number(raw?.nutritionSummary?.fiber) || 0,
      sugar: Number(raw?.nutritionSummary?.sugar) || 0,
    },
    sugarCubes: Number(raw?.sugarCubes) || 0,
    scores: validateScores(raw?.scores),
    healthAlerts: Array.isArray(raw?.healthAlerts) ? raw.healthAlerts.map(String) : [],
    alternatives: Array.isArray(raw?.alternatives)
      ? raw.alternatives.map((a: any) => ({
          name: String(a?.name || 'Alternative'),
          reason: String(a?.reason || ''),
          caloriesSaved: Number(a?.caloriesSaved) || 0,
        }))
      : [],
    timingAdvice: String(raw?.timingAdvice || 'Best consumed after a meal.'),
    tip: String(raw?.tip || 'Be mindful of sugar content.'),
    confidence: clamp100(raw?.confidence, 0),
  };
}

/** Validate and sanitize full AI response — LEGACY function for backwards compat */
export function validateAiResponse(raw: any): AiRawResponse {
  // If it's a multi-dish response, convert the first dish to legacy format
  const multiDish = validateMultiDishResponse(raw);
  const firstDish = multiDish.dishes[0];

  return {
    isFood: multiDish.isFood,
    nonFoodReason: multiDish.nonFoodReason,
    foodName: firstDish?.name || 'Unknown',
    foodCategory: String(raw?.foodCategory || 'other'),
    detectedItems: firstDish?.detectedItems || [],
    nutritionSummary: firstDish?.nutritionSummary || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    scores: firstDish?.scores || { bloodSugar: 0, gutHealth: 0, inflammation: 0, nutrientDensity: 0, processing: 0, proteinQuality: 0, micronutrient: 0 },
    sequence: firstDish?.sequence || [],
    spikeReduction: firstDish?.spikeReduction || 0,
    tip: firstDish?.tip || '',
    confidence: multiDish.confidence,
  };
}
