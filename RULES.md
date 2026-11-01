# Engineering Rules & Guidelines - AutoCaption Studio

## 1. Zero Cloud Dependency Rule
- AutoCaption is an on-premise, local-first application.
- No Supabase, Firebase, AWS Cognito, or remote telemetry/auth may be added.
- All media processing, inference, and rendering must execute on the user's host machine.

## 2. Process Separation & Security
- Never set `nodeIntegration: true`.
- Never set `contextIsolation: false`.
- Never expose the `ipcRenderer` directly on the window object (e.g. `window.ipc = ipcRenderer` is strictly forbidden).
- Provide explicit method signatures for every IPC message with TypeScript type validation.
- Sanitize and validate all arguments passed across IPC boundaries.

## 3. Truth in Implementation
- Do not build mock or fake transcription generators (e.g., random text generators pretending to be speech-to-text).
- Do not build fake export pipelines that download dummy files or invent bogus progress timers.
- Build clean, functional shells with realistic empty states, ready for real service bindings in upcoming phases.
- Any sample project or sample subtitle must be explicitly labeled as `[DEMO CONTENT]`.

## 4. UI Architecture & Code Quality
- Components must be single-responsibility and located in dedicated files.
- Resizable panels must handle container constraints gracefully without breaking layout at 1024x700 resolution.
- Catch rendering crashes cleanly using React Error Boundaries.
- Include informative console logging with prefixes (e.g., `[AutoCaption:Main]`, `[AutoCaption:Renderer]`).

## 5. Visual Standards
- Stick strictly to the neutral charcoal / slate palette.
- Accents: Emerald Green (`#10b981`) and Warm Amber (`#f59e0b`).
- No neon colors, no purple gradients, no generic AI chatbots.
