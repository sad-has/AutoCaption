# Multi-Phase Roadmap - AutoCaption Studio

## Phase 1: Electron Desktop Shell (Current Phase)
- Setup Electron, React, TypeScript, and Vite.
- Secure main process, isolated preload script, and sandboxed renderer.
- Typed IPC bridge with system info, dialogs, and persistent settings.
- Dark video-editor workspace layout (Toolbar, Left Navigation, Center Preview, Right Caption Controls, Bottom Timeline, Settings Screen).
- Resizable panel framework with 1024x700 responsive support.
- Error boundary and diagnostics logging.
- Verification: typecheck, linting, tests, and production build pass.

## Phase 2: Native Video Engine & Aspect Ratio Canvas
- Hardware-accelerated local video playback via Electron custom protocol / safe file streaming.
- SMPTE timecode calculation, frame-stepping, and playback transport.
- Multi-aspect ratio canvas framing (9:16 vertical shorts, 16:9 widescreen, 1:1 square, 4:5 social).
- TikTok / Reels / Shorts safe margin overlays.

## Phase 3: Local Whisper AI Speech-to-Text Pipeline
- Integrated local Whisper model inference (whisper.cpp or ONNX Runtime).
- Word-level timestamp generation and audio cadence alignment.
- Model manager UI for downloading and caching offline weights (tiny, base, small, medium).

## Phase 4: Cinematic Subtitle & Typography Engine
- Viral styling presets (Hormozi Pop, Beast Punch, Clean Minimal, Desi Gold).
- Real-time text rendering with custom strokes, multi-layer drop shadows, and active word animation.
- Font management with local system font enumeration.

## Phase 5: Multi-Track Timeline Sequencing
- Visual tracks: V1 Video, C1 Captions, A1 Audio Waveform.
- Caption splitting (Razor Cut), trimming handles, snapping, and dragging.
- Draggable CTI needle scrubber synchronized with video playback.

## Phase 6: High-Definition Video Export & Subtitle Delivery
- Local FFmpeg hardware-accelerated video rendering with burned-in subtitles.
- Direct export formats: MP4 (H.264 / HEVC), SRT, VTT, and Premiere Pro / Final Cut Pro XML.
