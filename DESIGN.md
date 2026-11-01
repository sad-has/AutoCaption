# Design System & UI Specification - AutoCaption Studio

## 1. Visual Direction
AutoCaption is designed as a desktop video editor inspired by professional nonlinear editing software (DaVinci Resolve, Adobe Premiere Pro). It emphasizes precision, functional density, readability in dim studio environments, and neutral color fidelity.

## 2. Color Palette
- **Base Background**: `#0b0d11` (Deep Charcoal Black)
- **Panel Surfaces**:
  - `Surface 1 (Root Panels)`: `#11141a`
  - `Surface 2 (Cards & Active Areas)`: `#171b23`
  - `Surface 3 (Input Fields & Hover)`: `#1e2430`
  - `Surface 4 (Active / Highlighted Elements)`: `#283040`
- **Borders & Dividers**:
  - Subtle: `#1f2633`
  - Focused / Active: `#323b4e`
- **Accents**:
  - Primary Accent (Emerald Green): `#10b981` (active states, playback indicators, ready badges)
  - Secondary Accent (Warm Amber / Gold): `#f59e0b` (warnings, active karaoke words, keyframe indicators)
  - Destructive: `#ef4444` (delete, error states)
- **Neutral Text**:
  - High Emphasis: `#f3f4f6`
  - Medium Emphasis: `#9ca3af`
  - Low / Disabled: `#64748b`

## 3. Typography
- **Primary Interface**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Monospace (Timecode / Metrics)**: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace.
- **Scale**:
  - Micro / Badges: `10px` (font-semibold, tracking-wider, uppercase)
  - Caption / Helper: `11px` - `12px`
  - Body Text: `13px` (dense desktop standard)
  - Panel Headers / Buttons: `13px` - `14px`
  - Section Titles: `16px` (font-medium)

## 4. UI Layout Grid & Resizable Panels
- **Top Toolbar**: Height `44px`, fixed at top, houses branding, project status, undo/redo, navigation tabs, and primary export.
- **Main Workspace**: Flex row between Left Panel, Center Canvas, and Right Panel.
  - Left Panel: Width `240px` (min `200px`, max `360px`).
  - Center Canvas: Flexible width (min `400px`), centers video aspect ratio box.
  - Right Panel: Width `300px` (min `260px`, max `420px`).
- **Bottom Timeline**: Height `220px` (min `160px`, max `360px`), resizable vertically. Houses caption list tab and multi-track visual timeline.
- **Settings Screen**: Full-workspace overlay or view with category sidebar and responsive forms.

## 5. Micro-Interactions & States
- Fine `1px` crisp borders between panels.
- Smooth transitions (`150ms ease`).
- Custom thin scrollbars (`4px` width, thumb `#2a3242`).
- Empty states featuring realistic contextual actions (e.g. drag & drop target with button fallback, clear supported format indicators).
