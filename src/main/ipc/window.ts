import { shell, type BrowserWindow } from 'electron';
import { logger } from '../logger';

export function handleWindowMinimize(window: BrowserWindow | null): void {
  if (window && !window.isDestroyed()) {
    window.minimize();
  }
}

export function handleWindowMaximize(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) return false;
  if (window.isMaximized()) {
    window.unmaximize();
    return false;
  } else {
    window.maximize();
    return true;
  }
}

export function handleWindowClose(window: BrowserWindow | null): void {
  if (window && !window.isDestroyed()) {
    window.close();
  }
}

export function handleWindowIsMaximized(window: BrowserWindow | null): boolean {
  if (!window || window.isDestroyed()) return false;
  return window.isMaximized();
}

export async function handleShellOpenExternal(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      await shell.openExternal(url);
      return true;
    }
    logger.warn('IPC:Shell', `Attempted to open non-http external URL: ${url}`);
    return false;
  } catch (err) {
    logger.error('IPC:Shell', `Failed to open external url: ${url}`, err);
    return false;
  }
}

export async function handleShellShowInFolder(itemPath: string): Promise<boolean> {
  try {
    if (typeof shell !== 'undefined' && shell && typeof shell.showItemInFolder === 'function') {
      shell.showItemInFolder(itemPath);
      return true;
    }
    return true;
  } catch (err) {
    logger.error('IPC:Shell', `Failed to reveal file in folder: ${itemPath}`, err);
    return false;
  }
}
