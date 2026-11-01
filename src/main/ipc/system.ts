import { app } from 'electron';
import * as os from 'os';
import type { SystemDiagnostics } from '../../shared/ipc';
import { logger } from '../logger';

export async function handleGetSystemInfo(): Promise<SystemDiagnostics> {
  const cpus = os.cpus();
  const firstCpu = cpus[0];
  const cpuModel = firstCpu ? firstCpu.model : 'Unknown CPU';

  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    osVersion: os.version ? os.version() : os.release(),
    cpuModel,
    cpuCores: cpus.length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    electronVersion: process.versions.electron || 'unknown',
    chromeVersion: process.versions.chrome || 'unknown',
    nodeVersion: process.versions.node || 'unknown',
    v8Version: process.versions.v8 || 'unknown',
    hardwareAccelerationActive: true,
    userDataPath: app.getPath('userData'),
    cachePath: app.getPath('sessionData'),
  };
}

export function handleGetRecentLogs() {
  return logger.getRecentLogs();
}
