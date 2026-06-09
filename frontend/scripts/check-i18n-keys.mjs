#!/usr/bin/env node
/**
 * check-i18n-keys.mjs
 *
 * Scans every .ts/.tsx file under src/ for next-intl translation calls and
 * verifies that each key used in code exists in every locale JSON under
 * src/messages/.
 *
 * Motivation: regression bugs like `scan.dishes_found` / `scan.score_label`
 * rendering as literal "scan.dishes_found" / "SCAN.SCORE_LABEL" in
 * production went unnoticed because nothing automated checked the drift
 * between code and messages/*.json. This script closes that gap.
 *
 * Usage:
 *   node scripts/check-i18n-keys.mjs          # exits non-zero on drift
 *   node scripts/check-i18n-keys.mjs --fix    # prints JSON patch to stdout
 *
 * Detection strategy
 * ------------------
 *   useTranslations('ns')  → binds the t() reader to namespace `ns`
 *   t('a.b.c')             → reads key ns.a.b.c
 *   t.rich('key')          → same
 *
 * We scope each t() call to the nearest preceding useTranslations() in the
 * same file. This matches how next-intl is used in this project. The
 * matcher is deliberately conservative: dynamic keys (t(variable)) and
 * template literals (t(`foo.${x}`)) are skipped with a warning.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_DIR = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(FRONTEND_DIR, 'src');
const MESSAGES_DIR = join(SRC_DIR, 'messages');

// Locales present in the repo define the "must-have" set.
const LOCALES = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));

// ---------------------------------------------------------------------------
// Load locale files
// ---------------------------------------------------------------------------
function loadLocale(locale) {
  const raw = readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8');
  return JSON.parse(raw);
}

function hasKey(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || !(p in cur)) return false;
    cur = cur[p];
  }
  // Accept strings and rich-text objects (next-intl supports nested messages)
  return cur !== undefined;
}

// ---------------------------------------------------------------------------
// Walk src/ and extract t('key') references
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'messages' || entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

// Matches: const <varName> = useTranslations('ns')
// (Also handles `let` / `var` and whitespace variants.)
const USE_T_BINDING_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*useTranslations\(\s*['"]([^'"]+)['"]\s*\)/g;
// Matches: varName('key') or varName.rich('key') — string-literal keys only.
// varName is captured so we can look up its bound namespace.
const T_CALL_RE = /\b([A-Za-z_$][\w$]*)(?:\.rich)?\(\s*['"]([^'"]+)['"]/g;
// Matches dynamic calls we can't statically verify.
const T_DYNAMIC_RE = /\b([A-Za-z_$][\w$]*)(?:\.rich)?\(\s*(?:`|[A-Za-z_])/g;

function extractKeysFromFile(path) {
  const source = readFileSync(path, 'utf8');
  // Strip single-line and block comments so commented-out code doesn't
  // count. (Cheap; good enough for this use case.)
  const cleaned = source
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Build: varName → namespace (e.g. `tNav` → `"nav"`).
  // Only variables that are bound to useTranslations in this file count.
  const nsByVar = new Map();
  for (const m of cleaned.matchAll(USE_T_BINDING_RE)) {
    nsByVar.set(m[1], m[2]);
  }
  if (nsByVar.size === 0) return { keys: [], dynamic: [] };

  const keys = new Set();
  for (const m of cleaned.matchAll(T_CALL_RE)) {
    const varName = m[1];
    const ns = nsByVar.get(varName);
    if (!ns) continue; // varName isn't an i18n binding; ignore.
    keys.add(`${ns}.${m[2]}`);
  }

  const dynamic = [];
  for (const m of cleaned.matchAll(T_DYNAMIC_RE)) {
    const varName = m[1];
    if (!nsByVar.has(varName)) continue;
    // Skip calls that are actually string-literal calls (already caught).
    const snippet = cleaned.slice(m.index, m.index + 60);
    if (new RegExp(`\\b${varName}(?:\\.rich)?\\(\\s*['"]`).test(snippet)) continue;
    dynamic.push({ file: path, snippet: snippet.replace(/\s+/g, ' ') });
  }

  return { keys: [...keys], dynamic };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const files = walk(SRC_DIR);
  const usedKeys = new Set();
  const dynamicCalls = [];
  for (const f of files) {
    const { keys, dynamic } = extractKeysFromFile(f);
    keys.forEach((k) => usedKeys.add(k));
    dynamicCalls.push(...dynamic);
  }

  const locales = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)]));

  const missing = {}; // { locale: [key, ...] }
  for (const locale of LOCALES) {
    missing[locale] = [];
    for (const key of usedKeys) {
      if (!hasKey(locales[locale], key)) missing[locale].push(key);
    }
    missing[locale].sort();
  }

  const totalMissing = Object.values(missing).reduce((n, arr) => n + arr.length, 0);
  const totalKeys = usedKeys.size;

  console.log(
    `\ni18n key check — ${totalKeys} unique keys used across ${files.length} files, ${LOCALES.length} locales`,
  );
  console.log('='.repeat(70));

  if (dynamicCalls.length) {
    console.log(
      `\n⚠  ${dynamicCalls.length} dynamic t(...) call(s) skipped (cannot statically verify):`,
    );
    for (const d of dynamicCalls.slice(0, 10)) {
      console.log(`    ${relative(FRONTEND_DIR, d.file)}  →  ${d.snippet}`);
    }
    if (dynamicCalls.length > 10) {
      console.log(`    … and ${dynamicCalls.length - 10} more`);
    }
  }

  for (const locale of LOCALES) {
    const n = missing[locale].length;
    if (n === 0) {
      console.log(`✓ ${locale}.json — all ${totalKeys} keys present`);
    } else {
      console.log(`\n✗ ${locale}.json — ${n} missing key(s):`);
      for (const k of missing[locale]) {
        console.log(`    ${k}`);
      }
    }
  }

  if (totalMissing > 0) {
    console.log(`\n✗ FAIL — ${totalMissing} missing translation(s) across locales\n`);
    process.exit(1);
  }
  console.log(`\n✓ PASS — all locales complete\n`);
}

main();
