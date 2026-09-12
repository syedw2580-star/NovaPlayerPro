# Changelog

## v1.1.1 - Codec Optimizer & Universal Video Transcoder

### Added
- **Universal Video Transcoder (`universal_video.py`)**: Included a standalone Python media optimizer script to convert videos with unsupported browser codecs (non-standard video profiles, rare container streams, or exotic multi-channel audio) into standard H.264 MP4 with AAC stereo audio.
- **Automatic Tool Downloader**: The Python script automatically detects if FFmpeg and FFprobe are present on the system. If missing, it automatically downloads and unpacks standalone static binaries into `./tools/` without needing manual installation or administrative privileges across Windows, macOS, and Linux.
- **In-App Codec Fix Guide**: Added a `Codec Fix` helper button and modal in the Media Library header, plus automatic codec warning toast suggestions if a loaded video encounters browser decode errors.
- **Codec Documentation**: Added Section 6 to `Nova_Player_Pro_Documentation.txt` detailing the browser codec support matrix and the zero-install transcoder workflow.

## v1.1.0 - UI & Usability Improvements

### UI Improvements
- **Expand / Compact Sidebar**: Fixed the sidebar toggle so clicking Expand / Compact smoothly resizes the sidebar between 440px and 660px.
- **Header Cleaned Up**: Removed the fake "Decoder: 200%" and "Render Mode: 10-Bit HDR" text; replaced with clean, real-time status indicators.
- **Compact Standby Box**: Shrunk the oversized drop box to give more screen space to the Catalogue, Yellow Subs, and Bookmarks tabs.
- **Typography & Readability**: Brightened muted grey text across all tabs for clear visibility.
- **Button & Control Polish**:
  - Removed duplicate plus sign on the `+ Add Video File` button.
  - Aligned search input and category dropdown heights.
  - Vertically centered video card action buttons with proper spacing.
  - Widened audio and subtitle track dropdowns so language names fit cleanly without getting cut off.

### Usability Improvements
- **Track Switching**: Fixed embedded subtitle and audio track switching so changing tracks applies reliably across different video files.
- **Audio Booster**: Fixed the quick boost toggle to accurately toggle 300% volume.
