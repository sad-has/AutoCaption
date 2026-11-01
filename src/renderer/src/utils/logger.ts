/**
 * Renderer-side diagnostic logger with timestamps and scope tags.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, scope: string, message: string, ...meta: unknown[]): void {
  const timestamp = new Date().toLocaleTimeString();
  const tag = `[${timestamp}] [AutoCaption:${scope}]`;

  switch (level) {
    case 'error':
      console.error(tag, message, ...meta);
      break;
    case 'warn':
      console.warn(tag, message, ...meta);
      break;
    case 'debug':
      console.debug(tag, message, ...meta);
      break;
    case 'info':
    default:
      console.log(tag, message, ...meta);
      break;
  }
}

export const logger = {
  info: (scope: string, message: string, ...meta: unknown[]) => log('info', scope, message, ...meta),
  warn: (scope: string, message: string, ...meta: unknown[]) => log('warn', scope, message, ...meta),
  error: (scope: string, message: string, ...meta: unknown[]) => log('error', scope, message, ...meta),
  debug: (scope: string, message: string, ...meta: unknown[]) => log('debug', scope, message, ...meta),
};
