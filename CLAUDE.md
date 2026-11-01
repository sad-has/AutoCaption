# CLAUDE.md - AutoCaption Studio Development Guidelines

AutoCaption is a local-first, professional desktop video caption and subtitle editor built with Electron, React, TypeScript, and Vite.

## Common Development Commands

- `npm run dev` : Launch Vite dev server and Electron main process concurrently in development mode with HMR.
- `npm run build` : Typecheck and build main process, preload script, and renderer for production.
- `npm run build:renderer` : Compile Vite React frontend to `dist/renderer`.
- `npm run build:main` : Compile Electron main process and preload script to `dist/main` and `dist/preload`.
- `npm run start` : Run Electron from the compiled `dist` directory.
- `npm run typecheck` : Run TypeScript compiler checks across main, preload, and renderer.
- `npm run lint` : Run ESLint on the codebase.
- `npm run test` : Run unit tests using Vitest.

## Architectural Principles & Strict Constraints

1. **Security & Context Isolation**:
   - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (or strictly isolated preload).
   - Never expose raw `ipcRenderer`, `fs`, `child_process`, or Node.js built-ins to the renderer.
   - All renderer-to-main communication occurs through the typed IPC bridge exposed via `window.electronAPI`.

2. **No Cloud / No Account Systems**:
   - AutoCaption is strictly local-first. Do not introduce remote authentication, Supabase accounts, or cloud database dependencies.
   - All state, settings, models, and project caches reside on the local filesystem.

3. **Code Modularity**:
   - Do not build monolithic components. Decompose UI into focused, reusable components: TopToolbar, LeftNavigation, CenterPreview, RightPanel, BottomTimeline, SettingsScreen, etc.
   - Keep state logic separated into dedicated stores or custom hooks.

4. **Design & Aesthetics**:
   - Professional dark video editor aesthetic (charcoal `#0d0f12`, neutral surfaces `#161922`, borders `#252b38`).
   - Accents are restrained emerald/forest green (`#10b981`) or warm amber (`#f59e0b`).
   - Strictly avoid neon, purple, or generic AI dashboard styling.
   - Responsive layouts supporting compact desktop windows (min 1024x700).
   - Any sample or demo items must be clearly flagged as demo content.

5. **Future-Proofing**:
   - No fake transcriptions or fake exports.
   - UI empty states and controls must reflect real operational hooks ready for Phase 2+ (video player engine, Whisper integration, FFmpeg burner).
