# Changelog

## v1.1.5 - Instant Subtitle Streaming & High-Throughput MKV Extraction

### Fixed & Optimized
- **Instant Progressive Subtitle Streaming**: Embedded subtitle cues are now streamed progressively to the player engine in real-time as media clusters are parsed, making dialogue subtitles available within milliseconds of opening the video rather than waiting for multi-gigabyte files to finish indexing.
- **High-Throughput 16MB Chunk Pipeline**: Upgraded the MKV subtitle extractor to a 16MB sliding window buffer, reducing disk I/O and slice promises by 75%.
- **Time-Budgeted Cooperative Scheduling**: Replaced static block-count yielding with dynamic 25ms time budgeting (`performance.now()`), eliminating timer clamp latency penalties.
- **Accurate Subtitle Status Feedback**: Replaced misleading `OFF` badge and empty cue states with real-time extraction indicators (`LOADING...`, `Indexing...`, pulse animation) while tracks are processing in the background.

## v1.1.4 - Aspect Ratio Sizing & Display Modes Fix

### Fixed
- **Aspect Ratio Switching (Fit, Fill, Stretch, 16:9, 4:3)**: Fixed aspect ratio modes failing to resize the video correctly. Applied explicit `aspectRatio`, `objectFit`, and adaptive dimension constraints directly to the video element to properly override the native video stream bounds.

## v1.1.3 - Universal 7.1 Surround & Multi-Channel Dialogue Clarity

### Fixed
- **7.1 Surround Sound Dialogue Mixing**: Upgraded multichannel processing to dynamically support 8-channel (7.1) and 6-channel (5.1) audio streams.
- **ITU-R Downmix Matrix**: Properly routes discrete channels (Front Left/Right, Center dialogue, LFE subwoofer, Side surrounds, and Rear surrounds) to stereo outputs without channel truncation or phase muddiness.
- **Center Channel Isolation**: Prevents side and rear surround sound effects from bleeding into the dialogue filter, keeping voices crystal clear even during heavy action sequences.

## v1.1.2 - Audio / Video Playback Clock Synchronization & Drift Elimination

### Fixed
- **Audio / Video Drift Over Playback Time**: Resolved audio lagging or getting out of sync with video during prolonged playback sessions.
- **AudioContext Clock Calibration**: Configured the Web Audio context with `{ latencyHint: 'playback' }` to ensure stable sample clock timing and eliminate internal hardware ring-buffer slippage.
- **Immediate Seek & Pause Resynchronization**: Wired immediate clock realignment and parameter queue clearing when seeking, scrubbing, pausing, unpausing, or changing playback speed.
- **Continuous Clock Alignment Watchdog**: Integrated a non-intrusive background synchronization watchdog that actively keeps the HTML5 media element clock and Web Audio DSP graph aligned throughout long movies.

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
