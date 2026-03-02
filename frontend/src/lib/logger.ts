/**
 * Unified Logging System for Nutri-Vision AI
 * Handles both Client-side and Server-side (Cloudflare Edge) logging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type ScanPhase = 'upload' | 'compress' | 'api_call' | 'api_response' | 'parse' | 'render' | 'complete';

interface ScanLogContext {
  phase: ScanPhase;
  locale?: string;
  tier?: string;
  fileSize?: number;
  fileType?: string;
  compressedSize?: number;
  apiStatus?: number;
  apiDurationMs?: number;
  responseSize?: number;
  errorType?: string;
  confidence?: number;
  foodName?: string;
  [key: string]: any;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // In Cloudflare Pages, console.log/error/warn are captured and visible in the dashboard
    if (level === 'error') {
      console.error(`${prefix} ${message}`, data || '');
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`, data || '');
    } else if (level === 'debug') {
      if (!this.isProduction) {
        console.debug(`${prefix} ${message}`, data || '');
      }
    } else {
      console.log(`${prefix} ${message}`, data || '');
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

  /** Log when user initiates a food scan (image upload) */
  scanStart(ctx: { fileSize: number; fileType: string; locale: string; tier: string }) {
    this.info(`🔍 SCAN START | file=${ctx.fileType} size=${(ctx.fileSize / 1024).toFixed(1)}KB`, ctx);
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

  /** Log scan error with phase identification */
  scanError(phase: ScanPhase, error: any, context?: Partial<ScanLogContext>) {
    const errorMessage = error?.message || String(error);
    const errorType = error?.name || 'UnknownError';
    this.error(
      `❌ SCAN ERROR [${phase}] | type=${errorType} message="${errorMessage}"`,
      { phase, errorType, errorMessage, ...context, stack: error?.stack }
    );
  }

  /** Log API-side scan processing stages */
  scanApiStage(stage: string, details?: any) {
    this.info(`🔧 SCAN API [${stage}]`, details);
  }
}

export const logger = new Logger();

