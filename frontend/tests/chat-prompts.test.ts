/**
 * Tests for lib/chat-prompts.ts.
 *
 * The system prompt is what enforces the brand's three rules at the
 * model level. If a future contributor edits the persona and drops
 * one of the rules, these tests fail loudly so the regression doesn't
 * ship to a pilot user.
 */
import { describe, it, expect } from 'vitest';
import { buildChatSystemPrompt, COACH_DISPLAY_NAME } from '@/lib/chat-prompts';

describe('buildChatSystemPrompt', () => {
  it('returns Thai persona for locale "th"', () => {
    const p = buildChatSystemPrompt('th');
    expect(p).toContain('ชินนี่');
    expect(p).toContain('อร่อย ตาม ลำดับ');
  });

  it('returns English persona for locale "en"', () => {
    const p = buildChatSystemPrompt('en');
    expect(p).toContain('Shinny');
    expect(p).toContain('Delicious in Order');
  });

  it('falls back to English for unknown locale', () => {
    const p = buildChatSystemPrompt('fr');
    expect(p).toContain('Shinny');
    expect(p).toContain('Delicious in Order');
  });

  it('Thai prompt includes the three brand rules', () => {
    const p = buildChatSystemPrompt('th');
    // Rule 1: never forbid food
    expect(p).toContain('ห้ามห้ามอาหาร');
    // Rule 2: warm older-sister tone
    expect(p).toContain('พี่สาว');
    // Rule 3: stay in scope
    expect(p).toMatch(/อยู่ในขอบเขต|เน้นที่เรื่องการกิน/);
  });

  it('English prompt includes the three brand rules', () => {
    const p = buildChatSystemPrompt('en');
    expect(p).toContain('Never forbid');
    expect(p).toContain('older sister');
    expect(p).toMatch(/Stay in food|nutrition scope/i);
  });

  it('Thai prompt forbids karaoke transliteration (regression)', () => {
    // The PR #15 lesson: every locale prompt must explicitly forbid
    // English-in-parentheses output, otherwise Gemma-class models
    // helpfully add "(Pad Thai)" after the Thai name.
    const p = buildChatSystemPrompt('th');
    expect(p).toContain('คาราโอเกะ');
  });

  it('mentions premium tier when user is premium', () => {
    const free = buildChatSystemPrompt('en', 'free');
    const prem = buildChatSystemPrompt('en', 'premium');
    expect(free).not.toContain('premium plan');
    expect(prem).toContain('premium plan');
  });

  it('does not mention tier hint for free users', () => {
    const p = buildChatSystemPrompt('en', 'free');
    expect(p).not.toMatch(/free plan|family plan/i);
  });
});

describe('COACH_DISPLAY_NAME', () => {
  it('uses Thai-script name for th locale', () => {
    expect(COACH_DISPLAY_NAME.th).toBe('ชินนี่');
  });

  it('uses Latin "Shinny" for non-Thai locales', () => {
    expect(COACH_DISPLAY_NAME.en).toBe('Shinny');
    expect(COACH_DISPLAY_NAME.de).toBe('Shinny');
    expect(COACH_DISPLAY_NAME.da).toBe('Shinny');
  });
});
