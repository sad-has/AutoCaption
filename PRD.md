# Product Requirements Document (PRD) - AutoCaption Studio

## 1. Product Overview
AutoCaption Studio is an offline-capable, local-first professional desktop application tailored for video creators and editors who require high-retention, cinematic captions (Alex Hormozi, MrBeast, Ali Abdaal styles) without uploading sensitive video footage to external cloud services.

## 2. Target Audience
- Short-form content creators (TikTok, Instagram Reels, YouTube Shorts).
- Video podcasters, educators, and commercial video editors.
- Privacy-conscious teams requiring on-device local transcription and rendering.

## 3. Core Functional Requirements (Phase 1: Desktop Shell)

### 3.1 Shell & Security Foundation
- **Platform**: Cross-platform desktop shell powered by Electron, Vite, React, and TypeScript.
- **Process Model**:
  - Secure main process handling window creation, lifecycle, and native integrations.
  - Context-isolated preload script providing a restricted IPC bridge.
  - Sandboxed renderer with strict Content Security Policy (CSP).
- **Window Management**:
  - Minimum resolution support: 1024x700.
  - Sensible default size (1360x860) with persistence.
  - Native window controls integration (maximize, minimize, close).

### 3.2 UI Workspace Layout
- **Top Toolbar**:
  - Application branding ("AutoCaption Studio") and version tag.
  - Active project title with editable moniker.
  - Undo and Redo placeholder controls with keyboard shortcut hints.
  - Real-time project save status indicator ("Saved locally").
  - Primary Export button (with status indicators).
  - Navigation tab switcher (Editor vs. Settings).
- **Left Panel**:
  - Multi-tab navigation: Media Library, Projects, and System Fonts.
  - Media tab: Clear "Import Video" empty state and media asset listing.
  - Projects tab: Active and recent projects list with clear demo labels where applicable.
  - Fonts tab: Installed system fonts preview and custom font loading slot.
- **Center Preview**:
  - Video preview canvas container with aspect ratio framing (9:16, 16:9, 1:1, 4:5).
  - Prominent import dropzone empty state with file picker button and supported format badges (.mp4, .mov, .mkv, .webm).
  - Playback controls bar (Play/Pause, timecode display `00:00:00:00`, loop, aspect ratio switcher).
- **Right Panel (Caption Styling Controls)**:
  - Preset selector (Hormozi Pop, Beast Punch, Clean Minimal, Desi Gold).
  - Typography options: Font family, font weight, font size, tracking, all-caps toggle.
  - Color styling: Primary text color, active karaoke highlight color, text stroke/border color and width.
  - Shadow & Backdrop: Blur, opacity, offset, background box padding, and corner radius.
  - Layout & Alignment: Position sliders (Y-offset, X-offset), safe margins overlay toggle.
- **Bottom Panel (Caption List & Timeline)**:
  - Segmented caption list with start/end timecodes, editable text, and active highlight indicators.
  - Visual timeline tracks: Video Track (V1), Caption Track (C1), and Audio Waveform Track (A1).
  - Zoom controls (zoom in/out, fit timeline) and playhead position scrubber.
- **Settings Screen**:
  - Local Storage: Cache size indicator, clear temporary files, project directory path selector.
  - Model Management: Local Whisper model manager (tiny, base, small, medium, large-v3) with disk status and download buttons.
  - Export Defaults: Default bitrate, codec (H.264 / ProRes), resolution preset, burnt-in vs. soft subtitle toggle.
  - Diagnostics: Hardware acceleration status, Electron / Chromium / Node versions, memory usage, and main process logs.

## 4. Non-Functional Requirements
- **Performance**: Instant UI responsiveness, 60fps render loop, low idle resource utilization.
- **Reliability**: React ErrorBoundary catching render exceptions with recovery actions.
- **Local Privacy**: 0% cloud egress for video or subtitle data.
