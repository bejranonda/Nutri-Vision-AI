/**
 * Runtime validation schemas for API request bodies.
 *
 * Every /api/* route that accepts JSON should `parse()` its body through
 * one of these before touching the DB or calling the AI. Benefits:
 *   - Rejects malformed input at the boundary with a 400, instead of
 *     letting bad data propagate into SQL queries or AI payloads.
 *   - Gives TypeScript a concrete request type without hand-maintained
 *     interfaces: `z.infer<typeof LoginRequest>` is the single source.
 *   - Uniform error shape for the client.
 *
 * Keep these schemas minimal — validate the shape, not business rules.
 * Business rules (e.g. "code is not expired") stay in the route handler.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** RFC 5321 / practical email length cap. */
const EmailField = z.string().trim().toLowerCase().email().max(254);

/** Password minimum — generous for now; bumped later will need a migration. */
const PasswordField = z.string().min(8).max(200);

/** Display name — allow any printable Unicode but cap length. */
const DisplayNameField = z.string().trim().min(1).max(100);

/** 0–12 photo count matching the image-stitcher's 4x3 max grid. */
const PhotoCountField = z.number().int().min(1).max(12);

/** Lowercase 2-letter locale tag (th / en / de / da). */
const LocaleField = z.enum(['th', 'en', 'de', 'da']);

const ScanModeField = z.enum(['meal', 'menu', 'drink_snack']);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginRequest = z.object({
  email: EmailField,
  password: PasswordField,
});
export type LoginRequestBody = z.infer<typeof LoginRequest>;

export const RegisterRequest = z.object({
  email: EmailField,
  password: PasswordField,
  displayName: DisplayNameField,
});
export type RegisterRequestBody = z.infer<typeof RegisterRequest>;

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

/**
 * Base64 data URI cap. 12 photos × ~1.5 MB base64 expansion ≈ 18 MB;
 * the route layer also re-validates with tighter bounds after decoding.
 */
const ImageBase64Field = z
  .string()
  .min(32)
  .max(25_000_000)
  .regex(/^data:image\//, 'Image must be a data URI with image/* MIME type');

export const AnalyzeRequest = z.object({
  imageBase64: ImageBase64Field,
  locale: LocaleField.optional(),
  scanMode: ScanModeField.optional(),
  photoCount: PhotoCountField.optional(),
  // `forceModel` is a debug hook — accept but don't enforce a shape.
  forceModel: z.string().max(64).optional(),
});
export type AnalyzeRequestBody = z.infer<typeof AnalyzeRequest>;

// ---------------------------------------------------------------------------
// Promo
// ---------------------------------------------------------------------------

export const PromoRedeemRequest = z.object({
  code: z.string().trim().min(1).max(64),
});
export type PromoRedeemRequestBody = z.infer<typeof PromoRedeemRequest>;

// ---------------------------------------------------------------------------
// Standard 400 helper — keeps the error shape identical across routes.
// ---------------------------------------------------------------------------

export interface ValidationFailure {
  error: string;
  fields: Record<string, string>;
}

/**
 * Flatten a ZodError into a uniform shape suitable for
 * `return NextResponse.json(problem, { status: 400 })`. We deliberately
 * drop the message text in production to avoid giving an attacker a
 * schema map — only the field names are returned.
 */
export function zodFailure(err: z.ZodError): ValidationFailure {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_root';
    // Keep the code (e.g. "too_small") but not the message verbatim —
    // codes are stable enums, messages can leak regex internals.
    if (!(path in fields)) fields[path] = issue.code;
  }
  return { error: 'Invalid request body', fields };
}
