/**
 * Unified Logging System for Nutri-Vision AI
 * Handles both Client-side and Server-side (Cloudflare Edge) logging
 * 
 * v3.0 — Added structured error classification, compression timing,
 *         model tracking, retry logging, and per-phase timing breakdown.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type ScanPhase = 'upload' | 'compress' | 'api_call' | 'api_response' | 'parse' | 'render' | 'complete';

/** Structured error categories for debugging and analytics */
type ErrorCategory = 'network' | 'timeout' | 'model_error' | 'parse_error' | 'validation' | 'rate_limit' | 'unknown';

interface ScanLogContext {
  phase: ScanPhase;
  requestId?: string;
  locale?: string;
  tier?: string;
  fileSize?: number;
  fileType?: string;
  compressedSize?: number;
  apiStatus?: number;
  apiDurationMs?: number;
  responseSize?: number;
  errorType?: string;
  errorCategory?: ErrorCategory;
  confidence?: number;
  foodName?: string;
  modelUsed?: string;
  [key: string]: any;
}

/** Classify errors into structured categories for analytics */
function classifyError(error: any): ErrorCategory {
  const msg = (error?.message || String(error)).toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'timeout';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('dns')) return 'network';
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('quota')) return 'rate_limit';
  if (msg.includes('json') || msg.includes('parse') || msg.includes('unexpected token') || msg.includes('syntax')) return 'parse_error';
  if (msg.includes('invalid') || msg.includes('validation') || msg.includes('missing')) return 'validation';
  if (msg.includes('model') || msg.includes('inference') || msg.includes('ai') || msg.includes('500')) return 'model_error';
  return 'unknown';
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // In Cloudflare Pages, console.log/error/warn are captured and visible in the dashboard
    if (level === 'error') {
      console.error(`${prefix} ${message}`, data ? JSON.stringify(data) : '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, data ? JSON.stringify(data) : '');
    } else if (level === 'debug') {
      if (!this.isProduction) {
        console.debug(`${prefix} ${message}`, data ? JSON.stringify(data) : '');
      }
    } else {
      console.log(`${prefix} ${message}`, data ? JSON.stringify(data) : '');
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  /**
   * Specifically for tracking functional status of menus/features
   */
  trackFeature(featureName: string, status: 'success' | 'failure' | 'loading', details?: any) {
    this.info(`Feature: ${featureName} | Status: ${status}`, details);
  }

  // ── Scan-specific diagnostics ──────────────────────────────────

  /** Generate a short correlation ID for request tracing */
  generateRequestId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  /** Log when user initiates a food scan (image upload) */
  scanStart(ctx: { photoCount?: number; fileSize?: number; fileType?: string; locale: string; tier: string }) {
    this.info(`🔍 SCAN START | photos=${ctx.photoCount || 1}${ctx.fileType ? ` file=${ctx.fileType}` : ''}${ctx.fileSize ? ` size=${(ctx.fileSize / 1024).toFixed(1)}KB` : ''}`, ctx);
  }

  /** Log after image compression completes */
  scanCompressed(ctx: { originalSize: number; compressedSize: number }) {
    const ratio = ((1 - ctx.compressedSize / ctx.originalSize) * 100).toFixed(1);
    this.info(`📦 SCAN COMPRESSED | ${(ctx.originalSize / 1024).toFixed(1)}KB → ${(ctx.compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`, ctx);
  }

  /** Log when API call to /api/analyze starts */
  scanApiCall(ctx: { payloadSize: number; locale: string }) {
    this.info(`📡 SCAN API CALL | payload=${(ctx.payloadSize / 1024).toFixed(1)}KB locale=${ctx.locale}`, ctx);
  }

  /** Log API response details */
  scanApiResponse(ctx: { status: number; durationMs: number; responseSize: number; ok: boolean }) {
    const level = ctx.ok ? 'info' : 'error';
    this.log(level, `📡 SCAN API RESPONSE | status=${ctx.status} duration=${ctx.durationMs}ms size=${ctx.responseSize}B ok=${ctx.ok}`, ctx);
  }

  /** Log successful scan result */
  scanSuccess(ctx: { foodName: string; confidence: number; overallScore: number; durationMs: number }) {
    this.info(`✅ SCAN SUCCESS | food="${ctx.foodName}" confidence=${ctx.confidence}% score=${ctx.overallScore} total=${ctx.durationMs}ms`, ctx);
  }

  /** Log scan error with phase identification and structured classification */
  scanError(phase: ScanPhase, error: any, context?: Partial<ScanLogContext>) {
    const errorMessage = error?.message || String(error);
    const errorType = error?.name || 'UnknownError';
    const errorCategory = classifyError(error);
    this.error(
      `❌ SCAN ERROR [${phase}] | category=${errorCategory} type=${errorType} message="${errorMessage}"`,
      { phase, errorType, errorCategory, errorMessage, ...context, stack: error?.stack }
    );
  }

  /** Log classified error with auto-detection of category */
  scanErrorClassified(error: any, context?: Record<string, any>) {
    const category = classifyError(error);
    const msg = error?.message || String(error);
    this.error(`❌ CLASSIFIED ERROR | category=${category} message="${msg}"`, { category, ...context });
  }

  /** Log client-side retry attempt */
  scanRetry(ctx: { attempt: number; reason: string; requestId?: string }) {
    this.warn(`🔄 SCAN RETRY | attempt=${ctx.attempt} reason="${ctx.reason}"`, ctx);
  }

  /** Log which AI model was used for the response */
  scanModelUsed(ctx: { requestId: string; model: string; durationMs: number }) {
    this.info(`🤖 MODEL USED | model=${ctx.model} duration=${ctx.durationMs}ms`, ctx);
  }

  /** Log per-phase timing breakdown */
  scanPhaseTimings(ctx: { requestId: string; timings: Record<string, number> }) {
    const formatted = Object.entries(ctx.timings).map(([k, v]) => `${k}=${v}ms`).join(' ');
    this.info(`⏱️ PHASE TIMINGS [${ctx.requestId}] | ${formatted}`, ctx);
  }

  /** Log API-side scan processing stages (server-side) */
  scanApiStage(stage: string, details?: any) {
    this.info(`🔧 SCAN API [${stage}]`, details);
  }

  /** Log environment binding diagnostics for debugging deployment issues */
  scanEnvDiagnostic(requestId: string, env: any) {
    const sensitivePatterns = ['TOKEN', 'SECRET', 'PASSWORD', 'KEY', 'CREDENTIAL', 'AUTH', 'APIKEY', 'API_KEY'];
    const safeKeys = Object.keys(env || {}).filter(k =>
      !sensitivePatterns.some(p => k.toUpperCase().includes(p))
    );
    this.info(`🔎 ENV DIAGNOSTIC [${requestId}]`, {
      requestId,
      hasAI: !!env?.AI,
      hasDB: !!env?.DB,
      envType: typeof env,
      envKeys: safeKeys.join(','),
      isProcessEnv: env === process.env,
    });
  }

  /** Log session/auth events */
  scanSessionEvent(requestId: string, event: string, details?: any) {
    this.info(`🔐 SESSION [${requestId}] ${event}`, details);
  }
}

export const logger = new Logger();

