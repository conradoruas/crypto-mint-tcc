/**
 * Minimal structured logger.
 *
 * - Development: human-readable output via console (full error + stack).
 * - Production:  single-line JSON written to stdout/stderr — ready for any
 *   log-aggregation pipeline (Datadog, Sentry, CloudWatch, etc.).
 *
 * Works in both server (API routes, Server Components) and client contexts.
 */

type LogContext = Record<string, unknown>;

const isDev = process.env.NODE_ENV !== "production";

function serialize(
  level: "error" | "warn",
  message: string,
  error?: unknown,
  context?: LogContext,
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
    ...(error instanceof Error
      ? { error: { name: error.name, message: error.message, stack: error.stack } }
      : error !== undefined && { error: String(error) }),
  });
}

export const logger = {
  error(message: string, error?: unknown, context?: LogContext): void {
    if (isDev) {
      console.error(`[ERROR] ${message}`, ...[error, context].filter(Boolean));
    } else {
      console.error(serialize("error", message, error, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...[context].filter(Boolean));
    } else {
      console.warn(serialize("warn", message, undefined, context));
    }
  },
};
