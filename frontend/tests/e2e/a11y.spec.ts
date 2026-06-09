/**
 * Accessibility e2e — iteration 7+ in the post-PR-#41 audit loop.
 *
 * Each block is one accessibility rule that produces an actionable
 * failure when violated. Deliberately narrower than what axe-core
 * would surface — we want every failure here to map to a single
 * concrete fix, not "this could be improved" advisories.
 */
import { test, expect } from '@playwright/test';

test.describe('keyboard navigation — Tab order reaches interactive elements', () => {
  test('/th — Tab from body lands on a focusable element within 5 presses', async ({ page }) => {
    // A11y guarantee: every page must have at least one keyboard-
    // reachable interactive element near the top of the tab order.
    // Pages where Tab traps in browser chrome or skips all content
    // are unusable for keyboard-only users.
    await page.goto('/th');
    // Initial focus: body. Press Tab a few times, capture the
    // active element at each step.
    const focusedTags: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      focusedTags.push(String(tag));
    }
    // At least one Tab press must land on an interactive element.
    const interactive = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    expect(
      focusedTags.some((t) => interactive.includes(t)),
      `5 Tab presses, focus only landed on: ${focusedTags.join(', ')}`,
    ).toBe(true);
  });
});

test.describe('icon-only buttons have an accessible name', () => {
  // Buttons that contain only an icon (no visible text) need
  // `aria-label`, `aria-labelledby`, or `title` so screen readers
  // announce them. Catches the common React-Lucide pattern where
  // `<button><Icon/></button>` ships with no name.
  for (const path of ['/th', '/th/scan', '/th/login']) {
    test(`${path} — every icon-only button has an accessible name`, async ({ page }) => {
      await page.goto(path);
      const unnamed = await page.evaluate(() => {
        const violations: string[] = [];
        document.querySelectorAll('button').forEach((b) => {
          const visibleText = (b.textContent || '').trim();
          if (visibleText.length > 0) return; // text-bearing button — fine
          const hasAriaLabel = !!b.getAttribute('aria-label');
          const hasAriaLabelledBy = !!b.getAttribute('aria-labelledby');
          const hasTitle = !!b.getAttribute('title');
          if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
            violations.push(b.outerHTML.slice(0, 200));
          }
        });
        return violations;
      });
      expect(unnamed, `unnamed icon buttons on ${path}:\n${unnamed.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('focus indicator is visible (outline not removed globally)', () => {
  test('/th — a focused link or button shows an outline ring', async ({ page }) => {
    // Catches `outline: none` global styles. Tailwind's
    // `focus:ring-*` utility provides a visible ring but only when
    // the class is set; a stylesheet that removes outlines without
    // adding rings is a real a11y bug.
    await page.goto('/th');
    // Find the first link/button, focus it programmatically,
    // measure its computed outline / box-shadow.
    const focused = page.locator('a, button').first();
    await focused.focus();
    const focusStyles = await focused.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        outline: cs.outline,
        outlineWidth: cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    });
    // Either an outline (default browser focus ring) or a non-empty
    // box-shadow (Tailwind ring) counts. `outlineWidth: '0px'` AND
    // `boxShadow: 'none'` means no focus indicator at all.
    const hasOutline = focusStyles.outlineWidth !== '0px' && focusStyles.outline !== 'none';
    const hasRing = focusStyles.boxShadow !== 'none';
    expect(
      hasOutline || hasRing,
      `no focus indicator: outline=${focusStyles.outline} boxShadow=${focusStyles.boxShadow}`,
    ).toBe(true);
  });
});

test.describe('form labels are properly associated', () => {
  // Every input must have an accessible name. Either:
  //   - <label for="ID"> ... </label> with matching id on the input
  //   - <label> wrapping the input directly
  //   - aria-label / aria-labelledby on the input itself
  //   - placeholder is NOT sufficient (it disappears on focus/typing)
  test('/th/login — every input has a label or aria-label', async ({ page }) => {
    await page.goto('/th/login', { waitUntil: 'load' });
    const unlabeled = await page.evaluate(() => {
      const violations: string[] = [];
      document.querySelectorAll('input').forEach((input) => {
        const type = input.getAttribute('type');
        // Skip non-user-facing input types.
        if (type === 'hidden' || type === 'submit' || type === 'button') return;

        const id = input.id;
        const hasLabelFor = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasWrappingLabel = !!input.closest('label');
        const hasAriaLabel = !!input.getAttribute('aria-label');
        const hasAriaLabelledBy = !!input.getAttribute('aria-labelledby');

        if (!hasLabelFor && !hasWrappingLabel && !hasAriaLabel && !hasAriaLabelledBy) {
          violations.push(`<input type="${type}" name="${input.name}" id="${id}" placeholder="${input.placeholder}">`);
        }
      });
      return violations;
    });
    expect(unlabeled, `unlabeled inputs on /th/login:\n${unlabeled.join('\n')}`).toEqual([]);
  });
});

test.describe('lang attribute is on every locale-prefixed sub-page', () => {
  // Expanded coverage from deep-probes.spec.ts — every public path
  // under /th must declare lang="th" so screen readers pick the
  // right pronunciation engine.
  for (const path of ['/th/demo', '/th/recipes']) {
    test(`${path} renders <html lang="th">`, async ({ page }) => {
      const res = await page.goto(path);
      // 200 OK before the lang assertion — otherwise we're testing
      // the 404 page's lang, not the real route's.
      expect(res?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', 'th');
    });
  }
});

test.describe('every public page has a <main> landmark + one <h1>', () => {
  // Round-11 a11y inventory found 5 of 6 public pages had no <main>
  // landmark. Screen-reader users had no "skip past the nav to content"
  // target. PR #72 added <main> + aria-labels on unlabeled inputs.
  // This guard locks the contract.
  for (const path of [
    '/th',
    '/th/scan',
    '/th/pricing',
    '/th/login',
    '/th/recipes',
    '/th/demo',
  ]) {
    test(`${path} — main landmark + single h1 + all inputs labeled`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Allow client-side hydration for pages that defer content (login,
      // chat) before counting <main>.
      await page.waitForTimeout(500);
      const counts = await page.evaluate(() => ({
        main: document.querySelectorAll('main, [role="main"]').length,
        h1: document.querySelectorAll('h1').length,
        unlabeledInputs: Array.from(
          document.querySelectorAll('input, textarea, select'),
        )
          .filter((i: any) => i.getAttribute('type') !== 'hidden')
          .filter((i: any) => {
            const id = i.getAttribute('id');
            const labelled =
              id && document.querySelector('label[for="' + id + '"]');
            const aria =
              i.getAttribute('aria-label') || i.getAttribute('aria-labelledby');
            return !labelled && !aria;
          }).length,
      }));
      expect(counts.main, `${path} should have exactly one <main>`).toBe(1);
      expect(counts.h1, `${path} should have exactly one <h1>`).toBe(1);
      expect(
        counts.unlabeledInputs,
        `${path} has ${counts.unlabeledInputs} input(s) without label or aria-label`,
      ).toBe(0);
    });
  }
});

test.describe('color-scheme meta declares light/dark support', () => {
  test('/th declares a color-scheme either via meta or :root CSS', async ({ page }) => {
    // Helps browsers pick the right native widget colors (scrollbar,
    // form controls, autofill background). Either:
    //   - <meta name="color-scheme" content="light dark">
    //   - body computed style includes a color-scheme value
    await page.goto('/th');
    const meta = await page.locator('meta[name="color-scheme"]').count();
    const bodyScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    expect(
      meta > 0 || (bodyScheme && bodyScheme !== 'normal'),
      `no color-scheme declared (meta=${meta}, computed='${bodyScheme}')`,
    ).toBe(true);
  });
});
