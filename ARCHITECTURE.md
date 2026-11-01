# System Architecture Document - AutoCaption Studio

## 1. High-Level Process Architecture

AutoCaption follows the multi-process Electron architecture separated strictly into Main, Preload, and Renderer layers.

```
+-------------------------------------------------------------------+
|                        AutoCaption Desktop                        |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                  Electron Main Process (Node.js)                  |
|  - Window Lifecycle Management (BrowserWindow)                   |
|  - Native Dialogs (Open File, Save File)                         |
|  - System Metrics & Hardware Info                                |
|  - Persistent Settings Store (Local JSON)                        |
|  - Strict Content Security Policy (CSP) & Navigation Guards       |
+-------------------------------------------------------------------+
                                  |
                    [contextBridge / IPC Channels]
                                  v
+-------------------------------------------------------------------+
|                  Preload Script (Isolated World)                  |
|  - Type-safe window.electronAPI wrapper                           |
|  - Whitelisted invoke/send/receive methods                        |
|  - Node primitives strictly withheld                              |
+-------------------------------------------------------------------+
                                  |
                    [Typed ElectronAPI Interface]
                                  v
+-------------------------------------------------------------------+
|                 Renderer Process (React 19 + Vite)                |
|  - Presentation Components (Toolbar, Navigation, Canvas, Panels)  |
|  - Resizable Layout System                                        |
|  - Global State Management (Zustand / Reactive Store)             |
|  - UI ErrorBoundary & Diagnostics Console                         |
+-------------------------------------------------------------------+
```

## 2. Directory Layout

```
AutoCaption/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Window creation & app lifecycle
│   │   ├── ipc/              # Strongly-typed IPC handlers
│   │   │   ├── dialogs.ts    # Native file dialogs
│   │   │   ├── system.ts     # Platform & hardware diagnostics
│   │   │   ├── settings.ts   # Local storage & preferences
│   │   │   └── index.ts      # Handler registry
│   │   └── security.ts       # CSP headers & permission restrictions
│   ├── preload/              # Preload bridge
│   │   └── index.ts          # contextBridge.exposeInMainWorld
│   ├── renderer/             # React application
│   │   ├── index.html        # Entry HTML
│   │   ├── src/
│   │   │   ├── main.tsx      # React root mount
│   │   │   ├── App.tsx       # Root container & panel layout
│   │   │   ├── components/
│   │   │   │   ├── common/   # ErrorBoundary, ResizablePanel, Tooltip
│   │   │   │   ├── layout/   # TopToolbar, LeftNavigation, CenterPreview, RightPanel, BottomTimeline
│   │   │   │   ├── media/    # Media tab & file import view
│   │   │   │   ├── projects/ # Project manager & demo cards
│   │   │   │   ├── fonts/    # Font catalog & inspector
│   │   │   │   ├── captions/ # Caption styling & preset controls
│   │   │   │   ├── timeline/ # Visual timeline sequence & caption list
│   │   │   │   └── settings/ # System diagnostics, models, export settings
│   │   │   ├── hooks/        # Custom hooks (resize, keyboard, ipc)
│   │   │   ├── store/        # State store (active project, styling, UI state)
│   │   │   ├── styles/       # Tailwind CSS & custom scrollbars
│   │   │   └── utils/        # Formatters, loggers, cn helper
│   ├── shared/               # Shared cross-boundary contracts
│   │   ├── ipc.ts            # Channel enum & payload interfaces
│   │   └── types.ts          # Project, Caption, Style, Settings types
├── tests/                    # Vitest unit & integration tests
├── vite.config.ts            # Vite configuration for renderer
├── vite.main.config.ts       # Vite / rollup config for main process
├── vite.preload.config.ts    # Vite / rollup config for preload script
└── tsconfig.json             # Root TypeScript config with path aliases
```

## 3. IPC Bridge Specifications

The bridge exposes `window.electronAPI` with strictly typed contracts:
- `openFileDialog(options)`: Opens native file picker for video/audio.
- `getSystemInfo()`: Retrieves OS, CPU, memory, hardware acceleration, and runtime versions.
- `getSettings()`: Reads persistent configuration.
- `saveSettings(settings)`: Writes persistent configuration.
- `openExternal(url)`: Opens validated external links in default browser safely.
- `minimize()`, `maximize()`, `close()`: Native window controls.

## 4. Security Hardening Measures
1. `contextIsolation: true` is unconditionally enforced.
2. `nodeIntegration: false` ensures renderer code cannot call `require('fs')` or similar.
3. `webSecurity: true` prevents local resource cross-origin bypasses.
4. `allowRunningInsecureContent: false`.
5. Navigation lockdown: `will-navigate` and `setWindowOpenHandler` deny unexpected external page loads or new windows.
6. Custom CSP header: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob: file:;`.
