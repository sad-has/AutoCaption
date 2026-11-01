import { session, shell, type BrowserWindow } from 'electron';
import { logger } from './logger';

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/**
 * Configure secure Electron defaults, CSP headers, and permission restrictions.
 */
export function setupSecurityPolicies(mainWindow: BrowserWindow): void {
  const currentSession = session.defaultSession;

  // 1. Content Security Policy (CSP)
  currentSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = !mainWindow.isDestroyed() && process.env.VITE_DEV_SERVER_URL !== undefined;

    // In dev mode allow localhost websocket for Vite HMR
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173"
      : "'self'";
    const connectSrc = isDev
      ? "'self' ws://localhost:5173 http://localhost:5173"
      : "'self'";

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: file:",
      "media-src 'self' data: blob: file: local-video:",
      `connect-src ${connectSrc} local-video:`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
      },
    });
  });

  // 2. Permission Request Handler: Deny dangerous permissions by default
  currentSession.setPermissionRequestHandler((webContents, permission, callback) => {
    logger.warn('Security', `Permission request denied for: ${permission}`);
    callback(false);
  });

  // 3. Prevent unexpected top-level navigations
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
    if (isDev && url.startsWith('http://localhost:5173')) {
      return;
    }

    event.preventDefault();
    logger.warn('Security', `Blocked unauthorized navigation to: ${url}`);
  });

  // 4. Safe external link handler: Open external links in user's default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        logger.info('Security', `Opening safe external link: ${url}`);
        void shell.openExternal(url);
      } else {
        logger.warn('Security', `Blocked external link with disallowed protocol: ${url}`);
      }
    } catch (err) {
      logger.error('Security', `Invalid external URL: ${url}`, err);
    }
    return { action: 'deny' };
  });
}
