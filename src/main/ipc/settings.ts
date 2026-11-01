import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { AppSettings, WhisperModelInfo } from '../../shared/ipc';
import { logger } from '../logger';

function getDefaultSettings(): AppSettings {
  const userData = app.getPath('userData');
  return {
    general: {
      autoSaveIntervalMs: 30000,
      theme: 'charcoal-dark',
      compactMode: false,
    },
    storage: {
      projectDirectory: path.join(userData, 'projects'),
      cacheDirectory: path.join(userData, 'cache'),
      maxCacheSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    },
    models: {
      activeModelId: 'base',
      modelsDirectory: path.join(userData, 'models'),
    },
    exportDefaults: {
      format: 'mp4',
      codec: 'h264',
      resolution: '1080x1920',
      bitrateMbps: 16,
      burnedInSubtitles: true,
      generateSrt: true,
      generateVtt: true,
    },
  };
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export async function handleGetSettings(): Promise<AppSettings> {
  const filePath = getSettingsFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const defaults = getDefaultSettings();
    return {
      general: { ...defaults.general, ...parsed.general },
      storage: { ...defaults.storage, ...parsed.storage },
      models: { ...defaults.models, ...parsed.models },
      exportDefaults: { ...defaults.exportDefaults, ...parsed.exportDefaults },
    };
  } catch {
    const defaults = getDefaultSettings();
    await handleSaveSettings(defaults);
    return defaults;
  }
}

export async function handleSaveSettings(settings: AppSettings): Promise<boolean> {
  const filePath = getSettingsFilePath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.info('IPC:Settings', 'Application settings saved successfully');
    return true;
  } catch (error) {
    logger.error('IPC:Settings', 'Failed to save settings', error);
    throw new Error('Failed to save settings');
  }
}

export async function handleGetCacheInfo(): Promise<{ sizeBytes: number; fileCount: number }> {
  try {
    const settings = await handleGetSettings();
    const cacheDir = settings.storage.cacheDirectory;
    let sizeBytes = 0;
    let fileCount = 0;

    try {
      const entries = await fs.readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const stats = await fs.stat(path.join(cacheDir, entry.name));
          sizeBytes += stats.size;
          fileCount++;
        }
      }
    } catch {
      // Cache directory may not exist yet
    }

    return { sizeBytes, fileCount };
  } catch (err) {
    logger.warn('IPC:Storage', 'Error reading cache info', err);
    return { sizeBytes: 0, fileCount: 0 };
  }
}

export async function handleClearCache(): Promise<boolean> {
  try {
    const settings = await handleGetSettings();
    const cacheDir = settings.storage.cacheDirectory;
    try {
      const entries = await fs.readdir(cacheDir);
      for (const file of entries) {
        await fs.unlink(path.join(cacheDir, file)).catch(() => {});
      }
      logger.info('IPC:Storage', 'Cache directory cleared');
    } catch {
      // Cache dir might not exist
    }
    return true;
  } catch (err) {
    logger.error('IPC:Storage', 'Failed to clear cache', err);
    return false;
  }
}

export async function handleListModels(): Promise<WhisperModelInfo[]> {
  const settings = await handleGetSettings();
  const modelsDir = settings.models.modelsDirectory;

  const modelsCatalog: Array<Omit<WhisperModelInfo, 'downloaded' | 'localPath'>> = [
    {
      id: 'tiny',
      name: 'Whisper Tiny (Multilingual)',
      parameters: '39 M',
      requiredVram: '~1 GB',
      diskSize: '75 MB',
    },
    {
      id: 'base',
      name: 'Whisper Base (Balanced Speed/Accuracy)',
      parameters: '74 M',
      requiredVram: '~1 GB',
      diskSize: '145 MB',
    },
    {
      id: 'small',
      name: 'Whisper Small (High Accuracy)',
      parameters: '244 M',
      requiredVram: '~2 GB',
      diskSize: '480 MB',
    },
    {
      id: 'medium',
      name: 'Whisper Medium (Professional Production)',
      parameters: '769 M',
      requiredVram: '~5 GB',
      diskSize: '1.5 GB',
    },
    {
      id: 'large-v3',
      name: 'Whisper Large v3 (Studio Grade)',
      parameters: '1550 M',
      requiredVram: '~10 GB',
      diskSize: '3.1 GB',
    },
  ];

  // Inspect models directory on disk
  try {
    await fs.mkdir(modelsDir, { recursive: true });
  } catch {}

  return modelsCatalog.map((model) => {
    // Phase 1: Models are not yet downloaded by default; ready for Phase 3 integration
    return {
      ...model,
      downloaded: false,
      localPath: path.join(modelsDir, `${model.id}.bin`),
    };
  });
}
