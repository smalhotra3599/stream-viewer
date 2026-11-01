# Multiview Stream Grid — Plan

## Goal
A full-screen, zero-waste-space grid video player for watching multiple live streams
at once (NFL Sundays being the main use case). Works on any screen size — ultrawide
monitor, regular monitor, or a regular monitor mirrored/extended to a TV via HDMI.

## What this is / isn't
- This is a **generic multi-stream grid player**. You supply stream URLs (HLS
  `.m3u8` links, or iframe embed URLs); the app lays them out optimally and plays
  them. It does not know or care where a URL comes from.
- It does **not** scrape or replicate any specific site's stream list or domain-
  rotation logic. That's a deliberate line — see note in chat.

## Core problems to solve (from investigating RoxieStreams' multiview)
1. **Real grid layout, not a stacked column.** Given N tiles and the current
   viewport size, compute the (rows × cols) combination that maximizes total
   video area while respecting each tile's aspect ratio (~16:9). This is the
   same "tile view" algorithm video-conferencing apps (Zoom/Jitsi/Meet) use.
   Recompute on every resize/fullscreen/orientation change — so it reflows
   correctly whether it's a 32:9 ultrawide or a 16:9 TV.
2. **Zero-chrome full-screen mode.** Use the Fullscreen API on the grid
   container. In full-screen, no header, no nav, no controls bar — just tiles,
   edge to edge, with a thin reveal-on-hover control strip per tile (mute/swap/
   remove) that auto-hides.
3. **Windowed/setup mode.** Outside full-screen, show a minimal header: stream
   count selector, "Add stream" / paste-URL inputs per slot, and a "Go
   Full Screen" button. This is where you configure what's playing before
   locking in.
4. **Expandable stream count.** Start with a clean 2–6 implementation, built so
   adding 7/8/9+ is just raising a constant — not new layout code (the tiling
   algorithm is already general for any N).
5. **Single-audio-focus.** With 6 games on screen you only want one audio feed
   at a time. Clicking a tile makes it the audio tile (mutes others); clicking
   again or a hotkey cycles. Also support a manual mute toggle per tile.

## Tech stack
- **Plain web app**: HTML/CSS/vanilla JS (or lightweight framework — call this
  during setup, not pre-decided) + **hls.js** for playing `.m3u8` streams in
  `<video>` tags (covers Chrome/Edge/Firefox; Safari plays HLS natively).
  Iframe-embed sources are also supported as a tile type for sources that only
  give you an embed, not a raw stream link.
- **CSS Grid** for layout, with `grid-template-columns`/`rows` set
  dynamically via JS from the tiling algorithm — not hardcoded per-count rules
  (this is exactly the bug RoxieStreams has).
- **No backend required initially** — everything runs client-side; stream URLs
  and layout are saved to `localStorage` so your setup persists between
  sessions.
- **Delivery**: a web app first (works in any Chromium browser, including
  fullscreened on an ultrawide or HDMI-connected display — no extra packaging
  needed for your use case). An Electron/Tauri desktop wrapper is a fast
  follow-on if you want a double-clickable app, kiosk mode, or saved
  multi-monitor window positions — not needed for the core functionality.

## Build phases
1. **Tiling engine** — pure function: `(tileCount, containerW, containerH,
   aspectRatio) -> grid layout`. Testable in isolation, this is the fix for
   the core bug you found.
2. **Player shell** — grid container + tile component (video element w/ hls.js
   bound, or iframe), mount/unmount streams into slots.
3. **Setup UI** — windowed mode: count selector (2/4/6/8…), per-slot URL
   input, labels, persistence to localStorage.
4. **Full-screen mode** — Fullscreen API toggle, chrome hidden, hover controls,
   responsive re-tiling on resize.
5. **Audio focus + per-tile controls** — click-to-focus audio, mute/remove/
   swap.
6. **Polish** — keyboard shortcuts (F for fullscreen, number keys to focus
   audio on tile N, Esc to exit), drag-to-reorder tiles.

## Decisions
- Source types: HLS (`.m3u8` via hls.js) + iframe embeds. No mp4/DASH for now.
- Presets: named, saveable slates (e.g. "Sunday 1pm") stored in localStorage,
  switchable from the setup UI.
