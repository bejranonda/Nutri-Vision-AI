/**
 * Unified Logging System for Nutri-Vision AI
 * Handles both Client-side and Server-side (Cloudflare Edge) logging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

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
}

export const logger = new Logger();
