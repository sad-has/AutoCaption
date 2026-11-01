import { dialog, type BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { OpenFileDialogOptions, FileDialogResult, SaveFileResult } from '../../shared/ipc';
import { logger } from '../logger';

export async function handleOpenFileDialog(
  window: BrowserWindow | null,
  options?: OpenFileDialogOptions
): Promise<FileDialogResult> {
  try {
    const defaultFilters = [
      {
        name: 'Video & Audio Files',
        extensions: ['mp4', 'mov', 'mkv', 'webm', 'mp3', 'wav', 'm4a', 'aac'],
      },
      { name: 'Video Files (*.mp4, *.mov, *.webm, *.mkv)', extensions: ['mp4', 'mov', 'webm', 'mkv'] },
      { name: 'Audio Files (*.mp3, *.wav, *.m4a)', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ];

    const dialogOptions = {
      title: options?.title ?? 'Import Video or Audio for Captions',
      filters: options?.filters ?? defaultFilters,
      properties: ['openFile' as const],
    };

    const result =
      window && !window.isDestroyed()
        ? await dialog.showOpenDialog(window, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, filePath: null, fileName: null };
    }

    const filePath = result.filePaths[0];
    if (!filePath) {
      return { canceled: true, filePath: null, fileName: null };
    }

    const fileName = path.basename(filePath);
    let fileSize: number | undefined;

    try {
      const stats = await fs.stat(filePath);
      fileSize = stats.size;
    } catch (statErr) {
      logger.warn('IPC:Dialog', `Failed to stat selected file: ${filePath}`, statErr);
    }

    logger.info('IPC:Dialog', `File selected: ${fileName} (${fileSize ?? 0} bytes)`);

    return {
      canceled: false,
      filePath,
      fileName,
      fileSize,
    };
  } catch (error) {
    logger.error('IPC:Dialog', 'Error opening file dialog', error);
    throw new Error('Failed to open file dialog');
  }
}

export async function handleSaveFileDialog(
  window: BrowserWindow | null,
  options: {
    sourcePath: string;
    suggestedName?: string;
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }
): Promise<SaveFileResult> {
  try {
    const defaultFilters = [
      { name: 'MP4 Video (*.mp4)', extensions: ['mp4'] },
      { name: 'All Files (*.*)', extensions: ['*'] },
    ];

    if (!dialog || typeof dialog.showSaveDialog !== 'function') {
      if (options.suggestedName && (path.isAbsolute(options.suggestedName) || options.suggestedName.includes(path.sep))) {
        await fs.copyFile(options.sourcePath, options.suggestedName);
        return { success: true, canceled: false, savedPath: options.suggestedName };
      }
      return { success: true, canceled: true };
    }

    const dialogOptions = {
      title: options.title ?? 'Save Rendered Video',
      defaultPath: options.suggestedName ?? 'exported_video.mp4',
      filters: options.filters ?? defaultFilters,
    };

    const result =
      window && !window.isDestroyed()
        ? await dialog.showSaveDialog(window, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true };
    }

    const targetPath = result.filePath;
    await fs.copyFile(options.sourcePath, targetPath);

    logger.info('IPC:Dialog', `Exported video saved to: ${targetPath}`);
    return { success: true, canceled: false, savedPath: targetPath };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('IPC:Dialog', 'Error in save file dialog', error);
    return { success: false, canceled: false, error: msg };
  }
}
