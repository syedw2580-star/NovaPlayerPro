# Nova Player Pro - Version Changelog

## v1.1.0 - UI Overhaul & Stream Demuxing Fixes

### 🛠️ Subtitle & Audio Track Switching
- **Demuxing & Track Switching**: Fixed subtitle and audio track switching across different MKV and MP4 files so switching tracks actually applies instantly.
- **On-Demand Track Parsing**: Background extraction with `AbortController` cancellation so switching tracks mid-stream doesn't freeze or lag the player.
- **VLC-Style Selectors**: Widened track dropdowns in the bottom bar (`max-w-[170px]`) so full language and track names are readable without truncation.

### 🎨 UI & Layout Overhaul
- **Working Expand / Compact Dock**: Fixed the broken flexbox layout that prevented the sidebar from resizing. Expand / Compact button now actively toggles sidebar width between `440px` and `660px`.
- **Removed Gimmicky Telemetry**: Removed the fake "Decoder: 200%" and "Render Mode: 10-Bit HDR" header badges. Replaced with real-time status indicators (active Audio DSP beacon, live audio/sub track counters, stream type).
- **Compact Standby Card**: Replaced the oversized media drop box with a sleek, compact standby card, freeing up space for the library, subtitle manager, and bookmarks.
- **Typography & Readability**: Brightened all muted grey text across the Catalogue, Subtitle Manager, and Scenes tabs for high visibility.
- **Button & Control Alignment**:
  - Fixed duplicate plus sign on the `+ Add Video File` button.
  - Aligned search input and category dropdown heights (`h-8`).
  - Vertically centered video card action buttons (playlist / delete) with proper padding so long titles don't overlap.
- **Audio Booster**: Fixed the quick boost toggle so it accurately toggles to 300% volume boost.

---

## v1.0.0 - Core Player Base
- Core video player engine with HTML5 and HLS (`.m3u8`) streaming.
- Web Audio API DSP pipeline (volume boost, dialogue clarity, 5-band EQ presets).
- Picture adjustments (brightness, contrast, saturation, hue, color presets).
- Custom Yellow Subtitles engine with timing offset controls.
- Scene bookmarking and A-B loop points.
- Offline library saving with IndexedDB.
