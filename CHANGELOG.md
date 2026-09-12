# Changelog

All notable changes to **Nova Player Pro** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-12

### 🚀 Added
- **Dynamic Expand / Compact Sidebar**: Added responsive desktop dock resizing between standard compact (`440px`) and wide view (`660px`) with smooth layout animations.
- **Embedded Audio & Subtitle Track Extraction Engine**: Real-time demuxing and track discovery for MKV and MP4 video containers directly in the browser without server transcoding.
- **VLC-Style Stream Selectors**: Bottom bar dropdowns with expanded widths displaying full language, track labels, and audio codecs.
- **Web Audio DSP & Smart Booster (300%)**: Integrated dynamic range compressor and `Math.tanh` soft-clipping limiter to safely amplify quiet local audio up to 300% without digital clipping.
- **Center Channel Dialogue Boost**: Dedicated vocal presence enhancer with +0dB, +6dB, and +12dB clarity filters.
- **Live GPU Picture Enhancements**: Real-time controls for brightness, contrast, saturation, hue shift, sepia, and cinematic color presets.
- **Interactive Pro Shortcuts Guide**: Modal cheat sheet accessible via hotkey (`Shift + ?`) or the player controls bar.

### 🎨 Refined & Improved
- **Header Telemetry**: Replaced placeholder metrics with authentic, high-visibility beacons (Audio DSP Active, stream counts, stream type).
- **Typography & Contrast**: Upgraded sub-headers, timestamps, and cue text for enhanced readability across bright and dark backgrounds.
- **Aligned Controls**: Harmonized search input and category filter heights, eliminated duplicate button icons, and centered video card action icons.
- **Compact Standby State**: Modernized standby cards and drag-and-drop overlays.

### 🐛 Fixed
- Fixed desktop flexbox layout sizing collision that prevented sidebar expansion.
- Fixed booster volume boundary sync between UI toggle and audio gain node.
- Fixed potential race conditions and memory leaks in Object URL blob lifecycles.

---

## [1.0.0] - 2026-08-30

### 🎉 Initial Release
- Core HTML5 video player with HLS streaming support.
- Local video and subtitle drag-and-drop mounting.
- Custom Yellow Subtitles engine with millisecond timing offsets.
- Scene bookmarking and A-B range looping.
- Offline IndexedDB media library persistence.
