import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as dotenv from 'dotenv';
import { logger } from './logger';
import { setupSecurityPolicies } from './security';
import { registerIpcHandlers } from './ipc';
import { registerMediaPrivileges, registerLocalVideoProtocol } from './protocol';
import { ensureFontsAvailable, KNOWN_GOOGLE_FONTS_TTF_URLS } from './export/fontCache';

// Load environment variables early from .env.local and .env
const envPaths = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}

// Register media streaming scheme privileges before app is ready
registerMediaPrivileges();

let mainWindow: BrowserWindow | null = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Main', 'Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Register protocol handler for streaming local video
    registerLocalVideoProtocol();
    createWindow();

    // Background pre-cache of all catalog TrueType fonts for instantaneous offline exports
    const fontsDir = path.join(os.tmpdir(), 'autocaption_fonts');
    ensureFontsAvailable(Object.keys(KNOWN_GOOGLE_FONTS_TTF_URLS), fontsDir).catch((err) => {
      logger.warn('Main', 'Background font caching partial or skipped:', err);
    });
  }).catch((err) => {
    logger.error('Main', 'Failed during app initialization', err);
  });
}

function createWindow(): void {
  logger.info('Main', 'Creating main BrowserWindow');

  mainWindow = new BrowserWindow({
    title: 'AutoCaption Studio',
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0d11',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  // Attach security policies
  setupSecurityPolicies(mainWindow);

  // Register typed IPC bridge handlers
  registerIpcHandlers(() => mainWindow);

  // Listen for preload errors if any occur
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error('Main', `Preload error in ${preloadPath}:`, error);
  });

  // Smooth appearance without white flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      logger.info('Main', 'Main window visible and ready');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Main', 'Main window closed');
  });

  // Development vs Production URL loading
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    logger.info('Main', `Loading Vite dev server at ${devServerUrl}`);
    mainWindow.loadURL(devServerUrl).catch((err) => {
      logger.error('Main', `Failed to load URL: ${devServerUrl}`, err);
    });
    // Open DevTools docked on the right in dev mode
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    logger.info('Main', `Loading production bundle from ${indexPath}`);
    mainWindow.loadFile(indexPath).catch((err) => {
      logger.error('Main', `Failed to load file: ${indexPath}`, err);
    });
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    logger.info('Main', 'All windows closed. Quitting app.');
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
