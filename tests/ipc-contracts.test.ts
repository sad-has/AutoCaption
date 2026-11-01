import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../src/shared/ipc';

describe('IPC Channels and Contracts', () => {
  it('defines required dialog channels', () => {
    expect(IPC_CHANNELS.DIALOG_OPEN_FILE).toBe('dialog:open-file');
    expect(IPC_CHANNELS.DIALOG_SAVE_FILE).toBe('dialog:save-file');
  });

  it('defines media inspection channels', () => {
    expect(IPC_CHANNELS.MEDIA_INSPECT_FILE).toBe('media:inspect-file');
  });

  it('defines required system diagnostics channels', () => {
    expect(IPC_CHANNELS.SYSTEM_GET_INFO).toBe('system:get-info');
    expect(IPC_CHANNELS.SYSTEM_GET_LOGS).toBe('system:get-logs');
  });

  it('defines required settings and local storage channels', () => {
    expect(IPC_CHANNELS.SETTINGS_GET).toBe('settings:get');
    expect(IPC_CHANNELS.SETTINGS_SAVE).toBe('settings:save');
    expect(IPC_CHANNELS.STORAGE_GET_CACHE_INFO).toBe('storage:get-cache-info');
    expect(IPC_CHANNELS.STORAGE_CLEAR_CACHE).toBe('storage:clear-cache');
  });

  it('defines window control channels', () => {
    expect(IPC_CHANNELS.WINDOW_MINIMIZE).toBe('window:minimize');
    expect(IPC_CHANNELS.WINDOW_MAXIMIZE).toBe('window:maximize');
    expect(IPC_CHANNELS.WINDOW_CLOSE).toBe('window:close');
  });

  it('defines speech-to-text transcription channels', () => {
    expect(IPC_CHANNELS.TRANSCRIPTION_START).toBe('transcription:start');
    expect(IPC_CHANNELS.TRANSCRIPTION_CANCEL).toBe('transcription:cancel');
    expect(IPC_CHANNELS.TRANSCRIPTION_GET_STATUS).toBe('transcription:get-status');
    expect(IPC_CHANNELS.TRANSCRIPTION_GET_MODELS).toBe('transcription:get-models');
    expect(IPC_CHANNELS.TRANSCRIPTION_PROGRESS).toBe('transcription:progress');
  });
});
