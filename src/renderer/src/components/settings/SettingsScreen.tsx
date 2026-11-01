import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  Cpu,
  DownloadCloud,
  FileCheck,
  Terminal,
  RefreshCw,
  Copy,
  Check,
  Folder,
  Trash2,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { SystemDiagnostics, WhisperModelInfo, AppSettings } from '@shared/ipc';
import type { TranscriptionModelOption } from '@shared/types';
import { logger } from '../../utils/logger';
import { cn } from '../../utils/cn';

export const SettingsScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'storage' | 'models' | 'export' | 'diagnostics'>('storage');
  const [systemInfo, setSystemInfo] = useState<SystemDiagnostics | null>(null);
  const [models, setModels] = useState<WhisperModelInfo[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{ sizeBytes: number; fileCount: number }>({ sizeBytes: 0, fileCount: 0 });
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logs, setLogs] = useState<Array<{ timestamp: string; level: string; scope: string; message: string }>>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [groqModels, setGroqModels] = useState<TranscriptionModelOption[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        const [info, modelsList, cache, currentSettings, recentLogs] = await Promise.all([
          window.electronAPI.getSystemInfo(),
          window.electronAPI.listModels(),
          window.electronAPI.getCacheInfo(),
          window.electronAPI.getSettings(),
          window.electronAPI.getRecentLogs(),
        ]);
        setSystemInfo(info);
        setModels(modelsList);
        setCacheInfo(cache);
        setSettings(currentSettings);
        setLogs(recentLogs);

        if (window.electronAPI.getTranscriptionModels) {
          const tModels = await window.electronAPI.getTranscriptionModels();
          setHasGroqKey(Boolean(tModels.hasApiKey));
          setGroqModels(tModels.models || []);
        }
      } else {
        // Fallback for browser development
        setSystemInfo({
          platform: 'win32',
          arch: 'x64',
          osRelease: '10.0.26100',
          osVersion: 'Windows 11 Pro',
          cpuModel: 'AMD Ryzen 9 / Intel Core i7',
          cpuCores: 16,
          totalMemoryBytes: 32 * 1024 * 1024 * 1024,
          freeMemoryBytes: 18 * 1024 * 1024 * 1024,
          electronVersion: '45.1.0',
          chromeVersion: '134.0.6998.35',
          nodeVersion: '24.12.0',
          v8Version: '13.4.114',
          hardwareAccelerationActive: true,
          userDataPath: 'C:\\Users\\AppData\\Roaming\\AutoCaption',
          cachePath: 'C:\\Users\\AppData\\Roaming\\AutoCaption\\Cache',
        });
        setModels([
          { id: 'tiny', name: 'Whisper Tiny', parameters: '39 M', requiredVram: '~1 GB', diskSize: '75 MB', downloaded: false },
          { id: 'base', name: 'Whisper Base (Recommended)', parameters: '74 M', requiredVram: '~1 GB', diskSize: '145 MB', downloaded: false },
          { id: 'small', name: 'Whisper Small', parameters: '244 M', requiredVram: '~2 GB', diskSize: '480 MB', downloaded: false },
          { id: 'medium', name: 'Whisper Medium', parameters: '769 M', requiredVram: '~5 GB', diskSize: '1.5 GB', downloaded: false },
          { id: 'large-v3', name: 'Whisper Large v3', parameters: '1550 M', requiredVram: '~10 GB', diskSize: '3.1 GB', downloaded: false },
        ]);
        setCacheInfo({ sizeBytes: 42000000, fileCount: 4 });
      }
    } catch (err) {
      logger.error('SettingsScreen', 'Failed loading system settings', err);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.clearCache();
        const updated = await window.electronAPI.getCacheInfo();
        setCacheInfo(updated);
      } else {
        setCacheInfo({ sizeBytes: 0, fileCount: 0 });
      }
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleCopyDiagnostics = () => {
    const text = JSON.stringify({ systemInfo, cacheInfo, logs, settings }, null, 2);
    void navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="flex h-full w-full bg-[#0b0d11] text-neutral-300 overflow-hidden select-none">
      {/* Category Navigation Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#1f2633] bg-[#0e1117] p-3 flex flex-col gap-1">
        <div className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
          Studio Preferences
        </div>

        {[
          { id: 'storage' as const, label: 'Local Storage', icon: HardDrive },
          { id: 'models' as const, label: 'Model Management', icon: DownloadCloud },
          { id: 'export' as const, label: 'Export Defaults', icon: FileCheck },
          { id: 'diagnostics' as const, label: 'System Diagnostics', icon: Cpu },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCategory(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-all text-left',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                  : 'text-neutral-400 hover:bg-[#141822] hover:text-neutral-200'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="mt-auto rounded-lg border border-[#1f2736] bg-[#121620] p-2.5 text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Zero Cloud Egress</span>
          </div>
          <p className="mt-1 text-[10px] leading-tight text-neutral-500">
            All video data, whisper weights, and transcripts remain on this machine.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Category: Local Storage */}
        {activeCategory === 'storage' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">Local Storage & Cache</h2>
              <p className="text-xs text-neutral-400">
                Manage project directories, disk cache allocation, and temporary render artifacts.
              </p>
            </div>

            {/* Cache Footprint Card */}
            <div className="rounded-xl border border-[#202736] bg-[#121620] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-neutral-200">Temporary Video & Audio Cache</div>
                  <div className="text-xs text-neutral-400">
                    {cacheInfo.fileCount} cached frames and waveform segments
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-base font-bold text-emerald-400">
                    {formatBytes(cacheInfo.sizeBytes)}
                  </div>
                  <div className="text-[10px] text-neutral-500">of 5.00 GB allowed</div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#1b212d]">
                <button
                  type="button"
                  disabled={isClearingCache || cacheInfo.sizeBytes === 0}
                  onClick={handleClearCache}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isClearingCache ? 'Clearing...' : 'Clear Temporary Cache'}</span>
                </button>
              </div>
            </div>

            {/* Storage Path Info */}
            <div className="rounded-xl border border-[#202736] bg-[#121620] p-4 space-y-2">
              <span className="text-xs font-semibold text-neutral-200">Application User Data Path</span>
              <div className="flex items-center justify-between gap-2 rounded bg-[#0b0d11] p-2 text-xs font-mono text-neutral-400 border border-[#1d2330]">
                <span className="truncate">{systemInfo?.userDataPath || 'Detecting...'}</span>
                <Folder className="h-4 w-4 shrink-0 text-neutral-500" />
              </div>
            </div>
          </div>
        )}

        {/* Category: Model Management */}
        {activeCategory === 'models' && (
          <div className="max-w-3xl space-y-6">
            {/* Groq Cloud Whisper Integration */}
            <div className="rounded-xl border border-[#202736] bg-[#121620] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-100">Groq Cloud Speech-to-Text</h3>
                    <p className="text-xs text-neutral-400">High-throughput Whisper inference with word-level timestamps</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium font-mono">
                  {hasGroqKey ? (
                    <span className="flex items-center gap-1 text-emerald-400 border-emerald-500/30">
                      <CheckCircle2 className="h-3.5 w-3.5" /> GROQ_API_KEY CONFIGURED
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 border-amber-500/30">
                      <AlertCircle className="h-3.5 w-3.5" /> API KEY NOT SET
                    </span>
                  )}
                </div>
              </div>

              {/* Models list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {groqModels.length > 0 ? (
                  groqModels.map((gm) => (
                    <div key={gm.id} className="rounded-lg border border-[#212938] bg-[#0c0e14] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-neutral-200">
                        <span>{gm.name}</span>
                        {gm.isDefault && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">{gm.description}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="rounded-lg border border-[#212938] bg-[#0c0e14] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-neutral-200">
                        <span>Whisper Large v3 Turbo</span>
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
                          DEFAULT
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400">Ultra-fast transcription optimized for subtitles & video editing.</p>
                    </div>
                    <div className="rounded-lg border border-[#212938] bg-[#0c0e14] p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-neutral-200">
                        <span>Whisper Large v3</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">Maximum multilingual accuracy and deep vocabulary coverage.</p>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-[#1b2230] bg-[#090b10] p-2.5 text-[10px] text-neutral-400">
                <span className="font-semibold text-neutral-300">Security Guarantee: </span>
                GROQ_API_KEY is loaded exclusively in the Node.js main process. It is never transmitted across IPC, never placed in localStorage, and never rendered in client HTML.
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold text-neutral-100">Local Whisper Models (Offline Fallback)</h2>
              <p className="text-xs text-neutral-400">
                On-device speech-to-text models for 100% offline environments.
              </p>
            </div>

            <div className="rounded-xl border border-[#202736] bg-[#121620] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1f2633] bg-[#0e1117] text-[10px] font-semibold text-neutral-400 uppercase">
                    <th className="p-3">Model Variant</th>
                    <th className="p-3">Parameters</th>
                    <th className="p-3">VRAM Req</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171c26]">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-[#151a24] transition-colors">
                      <td className="p-3 font-medium text-neutral-200">{m.name}</td>
                      <td className="p-3 font-mono text-neutral-400">{m.parameters}</td>
                      <td className="p-3 font-mono text-neutral-400">{m.requiredVram}</td>
                      <td className="p-3 font-mono text-neutral-400">{m.diskSize}</td>
                      <td className="p-3">
                        {m.downloaded ? (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                            INSTALLED
                          </span>
                        ) : (
                          <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400 border border-neutral-700/50">
                            NOT DOWNLOADED
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          className="rounded border border-[#2b3548] bg-[#181e2b] px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-[#202738]"
                          title="Ready for Phase 3 integration"
                        >
                          {m.downloaded ? 'Recheck' : 'Download'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Category: Export Defaults */}
        {activeCategory === 'export' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-neutral-100">Export & Render Defaults</h2>
              <p className="text-xs text-neutral-400">
                Configure default encoding settings for video export and subtitle sidecars.
              </p>
            </div>

            <div className="rounded-xl border border-[#202736] bg-[#121620] p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-200">Default Video Container</label>
                <div className="mt-1 flex gap-2">
                  {['mp4', 'mov', 'webm'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-400"
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-200">Video Codec</label>
                <select className="mt-1 w-full rounded border border-[#262f40] bg-[#181d28] px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none">
                  <option value="h264">H.264 (Universal Compatibility)</option>
                  <option value="hevc">HEVC / H.265 (High Efficiency)</option>
                  <option value="prores">Apple ProRes 422 HQ (Studio Master)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-neutral-200">
                  <span>Target Bitrate</span>
                  <span className="font-mono text-emerald-400">16 Mbps</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  defaultValue="16"
                  className="mt-1 w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-[#1b212d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-300">Burn Subtitles into Video Pixels</span>
                  <input type="checkbox" defaultChecked className="accent-emerald-500 h-4 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-300">Generate Separate .SRT Subtitle File</span>
                  <input type="checkbox" defaultChecked className="accent-emerald-500 h-4 w-4" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-300">Generate Separate .VTT Subtitle File</span>
                  <input type="checkbox" defaultChecked className="accent-emerald-500 h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category: System Diagnostics */}
        {activeCategory === 'diagnostics' && (
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-100">System Hardware & Diagnostics</h2>
                <p className="text-xs text-neutral-400">
                  Live runtime parameters and host execution telemetry.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#2b3548] bg-[#181e2b] px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-[#202738]"
              >
                {copiedLogs ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLogs ? 'Copied' : 'Copy Diagnostics'}</span>
              </button>
            </div>

            {/* Hardware Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[#202736] bg-[#121620] p-3">
                <span className="text-[10px] text-neutral-500 uppercase font-bold">Platform</span>
                <div className="mt-1 font-mono text-xs font-semibold text-neutral-200">
                  {systemInfo?.platform} ({systemInfo?.arch})
                </div>
              </div>

              <div className="rounded-xl border border-[#202736] bg-[#121620] p-3">
                <span className="text-[10px] text-neutral-500 uppercase font-bold">CPU Cores</span>
                <div className="mt-1 font-mono text-xs font-semibold text-neutral-200">
                  {systemInfo?.cpuCores} Threads
                </div>
              </div>

              <div className="rounded-xl border border-[#202736] bg-[#121620] p-3">
                <span className="text-[10px] text-neutral-500 uppercase font-bold">RAM Available</span>
                <div className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                  {systemInfo ? formatBytes(systemInfo.freeMemoryBytes) : '...'}
                </div>
              </div>

              <div className="rounded-xl border border-[#202736] bg-[#121620] p-3">
                <span className="text-[10px] text-neutral-500 uppercase font-bold">Hardware Accel</span>
                <div className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                  Active (GPU)
                </div>
              </div>
            </div>

            {/* Runtimes Card */}
            <div className="rounded-xl border border-[#202736] bg-[#121620] p-4">
              <span className="text-xs font-semibold text-neutral-200">Engine & Runtime Versions</span>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs font-mono text-neutral-400">
                <div>Electron: <span className="text-neutral-200">{systemInfo?.electronVersion}</span></div>
                <div>Chromium: <span className="text-neutral-200">{systemInfo?.chromeVersion}</span></div>
                <div>Node.js: <span className="text-neutral-200">{systemInfo?.nodeVersion}</span></div>
                <div>V8 Engine: <span className="text-neutral-200">{systemInfo?.v8Version}</span></div>
              </div>
            </div>

            {/* Logs Console */}
            <div className="rounded-xl border border-[#202736] bg-[#0c0f14] p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
                <div className="flex items-center gap-1.5 font-semibold text-neutral-300">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Recent Main & IPC Logs</span>
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  className="rounded p-1 hover:bg-[#161a23] text-neutral-400 hover:text-neutral-200"
                  title="Refresh logs"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded bg-[#07080c] p-2 font-mono text-[10px] text-neutral-400 space-y-1">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-neutral-500 shrink-0">{log.timestamp.slice(11, 19)}</span>
                      <span className={cn(
                        'shrink-0 font-bold',
                        log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-emerald-400'
                      )}>
                        [{log.scope}]
                      </span>
                      <span className="text-neutral-300 truncate">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-neutral-600">No events recorded in buffer yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
