/**
 * Main process diagnostic logger.
 * Keeps an in-memory ring buffer of logs that can be queried from the renderer for diagnostics.
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  scope: string;
  message: string;
  meta?: unknown;
}

const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];

export function log(level: LogEntry['level'], scope: string, message: string, meta?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    meta,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  const formatted = `[${entry.timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`;
  if (level === 'error') {
    console.error(formatted, meta !== undefined ? meta : '');
  } else if (level === 'warn') {
    console.warn(formatted, meta !== undefined ? meta : '');
  } else {
    console.log(formatted, meta !== undefined ? meta : '');
  }
}

export const logger = {
  info: (scope: string, message: string, meta?: unknown) => log('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => log('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => log('error', scope, message, meta),
  debug: (scope: string, message: string, meta?: unknown) => log('debug', scope, message, meta),
  getRecentLogs: (): LogEntry[] => [...logBuffer],
};
