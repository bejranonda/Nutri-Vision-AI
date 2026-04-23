/**
 * Unit tests for lib/ai-prompt.ts validator + builder logic.
 *
 * These lock in the server-side contract the validator gives the UI:
 *   - Every dish has a `sourcePhotoIndex` (normalised from the model).
 *   - Out-of-range model values fall back to the array index.
 *   - The collage prompt preamble + reinforcement is built correctly
 *     for each scan mode.
 */
import { describe, it, expect } from 'vitest';
import {
  buildLocalizedPrompt,
  validateMultiDishResponse,
} from '@/lib/ai-prompt';

describe('buildLocalizedPrompt', () => {
  it('single-photo scan has no COLLAGE preamble', () => {
    const prompt = buildLocalizedPrompt('en', 'meal', 1);
    expect(prompt).not.toContain('COLLAGE MODE');
    expect(prompt).not.toContain('FINAL REMINDER');
  });

  it('multi-photo meal scan includes preamble AND final reminder', () => {
    const prompt = buildLocalizedPrompt('en', 'meal', 3);
    expect(prompt).toContain('COLLAGE MODE');
    expect(prompt).toContain('COLLAGE of 3 SEPARATE PHOTOS');
    expect(prompt).toContain('FINAL REMINDER');
    expect(prompt).toContain('"dishes" array MUST have exactly 3 entries');
    // sourcePhotoIndex guidance must be in both preamble and reminder
    expect(prompt.match(/sourcePhotoIndex/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('multi-photo menu scan emits menu-specific instructions', () => {
    const prompt = buildLocalizedPrompt('en', 'menu', 2);
    expect(prompt).toContain('COLLAGE of 2');
    expect(prompt).toContain('menuItems');
  });

  it('drink_snack schema is single-item — prompt tells model to pick one tile', () => {
    const prompt = buildLocalizedPrompt('en', 'drink_snack', 2);
    expect(prompt).toContain('COLLAGE of 2');
    expect(prompt).toContain('supports only ONE item');
  });

  it('Thai locale instruction forbids romanization (regression for PR #7)', () => {
    const prompt = buildLocalizedPrompt('th', 'meal', 1);
    // The rule must be present and specific enough that the model follows it.
    expect(prompt).toContain('DO NOT add romanized');
    expect(prompt).toContain('No Latin letters in parentheses');
  });

  it('English locale also forbids parenthetical translations', () => {
    const prompt = buildLocalizedPrompt('en', 'meal', 1);
    expect(prompt).toContain(
      'Do not append transliterations or translations in parentheses',
    );
  });
});

describe('validateMultiDishResponse.sourcePhotoIndex', () => {
  const baseDish = {
    name: 'Dish',
    detectedItems: ['🥦 Veg'],
    nutritionSummary: { calories: 200, protein: 10, carbs: 30, fat: 5, fiber: 3 },
    scores: {
      bloodSugar: 60,
      gutHealth: 60,
      inflammation: 60,
      nutrientDensity: 60,
      processing: 60,
      proteinQuality: 60,
      micronutrient: 60,
    },
    sequence: [
      { step: 1, emoji: '🥦', items: 'v', category: 'fiber' },
      { step: 2, emoji: '🍗', items: 'p', category: 'protein' },
      { step: 3, emoji: '🍚', items: 'c', category: 'carb' },
      { step: 4, emoji: '🍬', items: 's', category: 'sugar' },
    ],
    spikeReduction: 60,
    tip: 't',
  };

  it('preserves valid model-supplied sourcePhotoIndex values', () => {
    const result = validateMultiDishResponse({
      isFood: true,
      dishCount: 2,
      dishes: [
        { ...baseDish, sourcePhotoIndex: 1 },
        { ...baseDish, sourcePhotoIndex: 0 },
      ],
    });
    expect(result.dishes[0].sourcePhotoIndex).toBe(1);
    expect(result.dishes[1].sourcePhotoIndex).toBe(0);
  });

  it('falls back to array index when the model omits sourcePhotoIndex', () => {
    const result = validateMultiDishResponse({
      isFood: true,
      dishCount: 3,
      dishes: [baseDish, baseDish, baseDish],
    });
    expect(result.dishes.map((d) => d.sourcePhotoIndex)).toEqual([0, 1, 2]);
  });

  it('clamps out-of-range values to the dish array index', () => {
    const result = validateMultiDishResponse({
      isFood: true,
      dishCount: 2,
      dishes: [
        // Model returned index 7 for a 2-dish response — nonsensical.
        { ...baseDish, sourcePhotoIndex: 7 },
        { ...baseDish, sourcePhotoIndex: 0 },
      ],
    });
    // Dish 0: fall back to its array index (0) because 7 >= dishes.length.
    expect(result.dishes[0].sourcePhotoIndex).toBe(0);
    // Dish 1: valid value preserved.
    expect(result.dishes[1].sourcePhotoIndex).toBe(0);
  });

  it('returns empty dishes (and no crash) on isFood=false', () => {
    const result = validateMultiDishResponse({
      isFood: false,
      nonFoodReason: 'That looks like a keyboard, not food 🙃',
    });
    expect(result.isFood).toBe(false);
    expect(result.dishes).toEqual([]);
    expect(result.dishCount).toBe(0);
  });
});
