# 🎬 Nova Player Pro

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.0-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38bdf8.svg)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-ffca28.svg)

### 🚀 **[Live Demo: nova-player-pro.web.app](https://nova-player-pro.web.app)**

*A powerhouse cinema web video player with VLC-style multi-track extraction, live HLS streaming, 300% Web Audio booster, 10-band equalizer, and YouTube/Vimeo stream integration.*

</div>

---

## ✨ Features

- 🎧 **VLC-Style Multi-Track Engine**: Automatically demuxes and switches between **50+ embedded audio and subtitle tracks** inside uploaded MP4 and MKV files with cooperative async event-loop yielding and `AbortSignal` cancellation.
- 📡 **Live HLS Stream Player**: Full `.m3u8` adaptive bitrate live streaming powered by `hls.js` with auto-reconnecting buffer recovery and a live status indicator.
- 📺 **Universal URL Streaming**: Stream YouTube (`youtu.be`, `youtube.com`), Vimeo, and direct video URLs (`.mp4`, `.webm`, `.mkv`) with zero setup.
- ⚡ **300% Smart Audio Booster & 10-Band EQ**: Web Audio API DSP pipeline with dynamic compander/limiter, transparent bypass toggling, and multichannel 5.1 downmixing with automatic stereo fallback.
- 💬 **High-Performance Subtitle Engine**: $O(\log N)$ binary search cue resolution, instant search filter across thousands of dialogue lines, timing sync offsets (±0.1s / ±1.0s), and clean vector subtitle rendering.
- 🎨 **Cinema FX Filter Engine**: Real-time GPU post-processing presets (Cinema, HDR, Cyberpunk, Noir, Vintage, Night Vision) with custom sliders.
- 🛡️ **Frame Corruption Watchdog**: Automatically detects frozen or corrupted video frames and resumes playback seamlessly.
- 💾 **Offline-First Persistence**: IndexedDB saves your uploaded media library, custom playlists, bookmarks, and playback positions across sessions.

---

## 🚀 Quick Start

### Option 1: Try Online (No Install)
Visit the live deployment directly in your browser:  
👉 **[https://nova-player-pro.web.app](https://nova-player-pro.web.app)**

---

### Option 2: Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/syedw2580-star/NovaPlayerPro.git
   cd NovaPlayerPro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build the production single-file bundle:**
   ```bash
   npm run build
   ```

---

## 🐍 1-Click Python Launcher (Desktop)

You can also run the player locally using the included Python launcher:
```bash
python start_player.py
```
*(Automatically serves `dist/` on `http://localhost:4173` and opens your default browser).*

---

## 🎬 Universal Video Transcoder & Codec Optimizer (`universal_video.py`)

Browsers natively support H.264 (AVC), WebM (VP8/VP9), and stereo AAC audio. If you load an MKV, AVI, MOV, or exotic video with codecs not natively decodable by browser hardware (e.g. non-standard video streams, unsupported multi-channel formats, or rare subtitle formats), you can run the included Python utility:

```bash
python universal_video.py
```

### ⚡ Key Features:
- **Zero-Setup / Automatic Tool Downloader**: If FFmpeg/FFprobe are not installed on your system PATH, the script automatically downloads and unpacks standalone static binaries into `./tools/` on Windows, macOS, or Linux.
- **Fast Lossless Remuxing**: If the video stream is already H.264 or compatible MP4, it performs a 0-second direct stream copy without re-encoding quality loss.
- **Hardware-Friendly Transcoding**: Re-encodes incompatible video tracks to standard H.264 (8-bit yuv420p) and audio to high-fidelity AAC stereo (384k) downmixed for clear dialogue.
- **Subtitle Stream Extraction**: Automatically converts and embeds SRT, ASS, SSA, and WebVTT subtitle tracks into standard MP4 `mov_text` streams.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Tailwind CSS v4, Lucide Icons
- **Media Engines**: Web Audio API DSP (single-owner pipeline), `hls.js`, HTML5 Video
- **Format Parsers**: Pure client-side binary Matroska (EBML) & MP4 (ISO BMFF / `moov` / `trak` / `stbl` / `tx3g`) demuxers
- **Storage**: IndexedDB (Offline media catalogue & state persistence)
- **Deployment**: Firebase Hosting & Google Cloud Platform

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
