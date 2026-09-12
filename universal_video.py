import os
import sys
import subprocess
import json
import shutil
import urllib.request
import zipfile
import tarfile
import platform
from tkinter import Tk, filedialog

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(SCRIPT_DIR, "tools")

VIDEO_EXTS = {'.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.ts'}

# Known static release mirrors for standalone FFmpeg binaries
FFMPEG_URLS = {
    'windows': 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    'darwin': 'https://evermeet.cx/ffmpeg/getrelease/zip',      # macOS
    'linux': 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
}

def report_progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        percent = min(100.0, (downloaded / total_size) * 100)
        mb_down = downloaded / (1024 * 1024)
        mb_tot = total_size / (1024 * 1024)
        sys.stdout.write(f"\r   ⏳ Downloading: {percent:5.1f}% ({mb_down:.1f} MB / {mb_tot:.1f} MB)")
    else:
        mb_down = downloaded / (1024 * 1024)
        sys.stdout.write(f"\r   ⏳ Downloading: {mb_down:.1f} MB")
    sys.stdout.flush()

def ensure_ffmpeg():
    """
    Checks for ffmpeg and ffprobe on system PATH or local tools/ folder.
    If missing, automatically downloads and extracts static binaries.
    """
    ffmpeg_exe = shutil.which("ffmpeg")
    ffprobe_exe = shutil.which("ffprobe")

    local_ffmpeg = os.path.join(TOOLS_DIR, "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    local_ffprobe = os.path.join(TOOLS_DIR, "ffprobe.exe" if sys.platform == "win32" else "ffprobe")

    if os.path.exists(local_ffmpeg) and os.path.exists(local_ffprobe):
        return local_ffmpeg, local_ffprobe

    if ffmpeg_exe and ffprobe_exe:
        return ffmpeg_exe, ffprobe_exe

    # If only one is found on PATH, check if both are in that directory
    if ffmpeg_exe and not ffprobe_exe:
        candidate = os.path.join(os.path.dirname(ffmpeg_exe), "ffprobe.exe" if sys.platform == "win32" else "ffprobe")
        if os.path.exists(candidate):
            return ffmpeg_exe, candidate

    print("=" * 65)
    print("🎬 NOVA PLAYER PRO — MEDIA TRANSCODER TOOL SETUP")
    print("=" * 65)
    print("⚠️  FFmpeg / FFprobe tools were not found on your system PATH.")
    print("📦 Automatically downloading standalone tools into './tools/'...")
    print("=" * 65)

    os.makedirs(TOOLS_DIR, exist_ok=True)
    system = platform.system().lower()

    if "windows" in system:
        url = FFMPEG_URLS['windows']
        archive_path = os.path.join(TOOLS_DIR, "ffmpeg_win64.zip")
        try:
            print(f"➜ Source: {url}")
            urllib.request.urlretrieve(url, archive_path, report_progress)
            print("\n➜ Unpacking binaries...")
            with zipfile.ZipFile(archive_path, 'r') as zf:
                for member in zf.namelist():
                    basename = os.path.basename(member)
                    if basename.lower() in ("ffmpeg.exe", "ffprobe.exe"):
                        source_stream = zf.open(member)
                        target_file = os.path.join(TOOLS_DIR, basename)
                        with open(target_file, "wb") as f_out:
                            shutil.copyfileobj(source_stream, f_out)
            if os.path.exists(archive_path):
                os.remove(archive_path)
            print("✅ FFmpeg & FFprobe setup completed successfully!\n")
        except Exception as e:
            print(f"\n❌ Automatic download failed: {e}")
            print("Please install FFmpeg manually or place ffmpeg.exe & ffprobe.exe inside the 'tools' folder.")
            sys.exit(1)

    elif "darwin" in system:  # macOS
        url = FFMPEG_URLS['darwin']
        archive_path = os.path.join(TOOLS_DIR, "ffmpeg_mac.zip")
        try:
            print(f"➜ Source: {url}")
            urllib.request.urlretrieve(url, archive_path, report_progress)
            print("\n➜ Unpacking binaries...")
            with zipfile.ZipFile(archive_path, 'r') as zf:
                zf.extractall(TOOLS_DIR)
            if os.path.exists(archive_path):
                os.remove(archive_path)
            for b in [local_ffmpeg, local_ffprobe]:
                if os.path.exists(b):
                    os.chmod(b, 0o755)
            print("✅ FFmpeg setup completed!\n")
        except Exception as e:
            print(f"\n❌ Automatic download failed: {e}")
            sys.exit(1)

    elif "linux" in system:
        url = FFMPEG_URLS['linux']
        archive_path = os.path.join(TOOLS_DIR, "ffmpeg_linux.tar.xz")
        try:
            print(f"➜ Source: {url}")
            urllib.request.urlretrieve(url, archive_path, report_progress)
            print("\n➜ Unpacking binaries...")
            with tarfile.open(archive_path, "r:xz") as tf:
                for member in tf.getmembers():
                    if member.name.endswith(("/ffmpeg", "/ffprobe")):
                        member.name = os.path.basename(member.name)
                        tf.extract(member, path=TOOLS_DIR)
            if os.path.exists(archive_path):
                os.remove(archive_path)
            for b in [local_ffmpeg, local_ffprobe]:
                if os.path.exists(b):
                    os.chmod(b, 0o755)
            print("✅ FFmpeg setup completed!\n")
        except Exception as e:
            print(f"\n❌ Automatic download failed: {e}")
            sys.exit(1)
    else:
        print(f"Unsupported OS for auto-download: {system}. Please install FFmpeg on your PATH.")
        sys.exit(1)

    if os.path.exists(local_ffmpeg) and os.path.exists(local_ffprobe):
        return local_ffmpeg, local_ffprobe

    print("❌ Could not locate extracted binaries in tools/.")
    sys.exit(1)

FFMPEG_EXE, FFPROBE_EXE = ensure_ffmpeg()

def get_stream_info(filepath):
    cmd = [
        FFPROBE_EXE, "-v", "error",
        "-show_entries", "stream=codec_name,codec_type,r_frame_rate,width,height,pix_fmt",
        "-show_entries", "stream_tags=language",
        "-show_entries", "format=format_name,duration",
        "-of", "json",
        filepath
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return json.loads(result.stdout)
    except Exception:
        return None

def get_fps(filepath):
    cmd = [FFPROBE_EXE, "-v", "error", "-select_streams", "v:0",
           "-show_entries", "stream=r_frame_rate",
           "-of", "default=noprint_wrappers=1:nokey=1", filepath]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        fps = result.stdout.strip()
        if fps and fps != "N/A":
            test = [FFMPEG_EXE, "-f", "lavfi", "-i", "nullsrc", "-r", fps, "-t", "0", "-f", "null", "-"]
            subprocess.run(test, capture_output=True, timeout=5)
            return fps
    except Exception:
        pass
    return None

def main():
    root = Tk()
    root.withdraw()

    video_path = filedialog.askopenfilename(
        title="Select video to optimize for universal web playback",
        filetypes=[("Video files", " ".join(f"*{e}" for e in VIDEO_EXTS)), ("All files", "*.*")]
    )
    if not video_path:
        print("No file selected.")
        return

    ext = os.path.splitext(video_path)[1].lower()
    if ext not in VIDEO_EXTS:
        print(f"Unsupported file type: {ext}")
        return

    base = os.path.splitext(video_path)[0]
    out_path = f"{base}_universal.mp4"

    print(f"\n📁 Source: {os.path.basename(video_path)}")
    print("🔍 Analyzing video & audio streams...")

    info = get_stream_info(video_path)
    if not info:
        print("❌ Failed to analyze file.")
        return

    streams = info.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    sub_streams = [s for s in streams if s.get("codec_type") == "subtitle"]

    if not video_stream:
        print("❌ No video stream found.")
        return

    vcodec = video_stream.get("codec_name", "").lower()
    width = video_stream.get("width", "?")
    height = video_stream.get("height", "?")
    acodec = audio_stream.get("codec_name", "").lower() if audio_stream else None

    print(f"   Video: {vcodec.upper()} ({width}x{height})")
    print(f"   Audio: {acodec.upper() if acodec else 'None'}")
    print(f"   Subtitles: {len(sub_streams)} stream(s)")

    cmd = [
        FFMPEG_EXE,
        "-fflags", "+genpts+igndts",
        "-err_detect", "ignore_err",
        "-i", video_path,
    ]

    # EXPLICIT MAPS — required when mapping subtitles manually
    cmd += ["-map", "0:v:0"]
    if audio_stream:
        cmd += ["-map", "0:a:0"]

    video_action = "copy"
    audio_action = "copy"

    # ---- VIDEO CODEC SELECTION ----
    pix_fmt = video_stream.get("pix_fmt", "")
    if vcodec in ("h264", "hevc", "h265") and ("10" not in pix_fmt):
        cmd += ["-c:v", "copy"]
        video_action = "Direct stream copy (Lossless 0-second copy)"
    else:
        detected_fps = get_fps(video_path)
        if detected_fps:
            print(f"   Source FPS: {detected_fps}")
            vf = f"fps=fps={detected_fps},setpts=PTS-STARTPTS"
            fps_args = ["-r", detected_fps]
        else:
            vf = "setpts=PTS-STARTPTS"
            fps_args = []

        cmd += ["-vf", vf]
        cmd += [
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-fps_mode", "cfr",
        ] + fps_args
        video_action = "Transcode -> Universal H.264 (yuv420p, CRF 22)"

    # ---- AUDIO CODEC SELECTION ----
    if audio_stream:
        cmd += [
            "-af", "asetpts=PTS-STARTPTS,aresample=async=1:min_hard_comp=0.100:first_pts=0",
            "-c:a", "aac",
            "-b:a", "384k",
            "-ac", "2"
        ]
        if acodec == "aac":
            audio_action = "Convert -> AAC stereo (downmix/resample)"
        else:
            audio_action = f"Transcode {acodec.upper()} -> Universal AAC Stereo (384k)"
    else:
        cmd += ["-an"]
        audio_action = "none (no audio stream)"

    # ---- SUBTITLES ----
    text_sub_codecs = {"subrip", "srt", "ass", "ssa", "webvtt", "mov_text"}
    sub_mapped = 0
    for i, sub in enumerate(sub_streams):
        scodec = sub.get("codec_name", "").lower()
        if scodec in text_sub_codecs:
            cmd += ["-map", f"0:s:{i}", f"-c:s:{sub_mapped}", "mov_text"]
            sub_mapped += 1
        else:
            print(f"   ⚠️  Skipping image-based subtitle stream {i} ({scodec})")

    # ---- MUXING ----
    cmd += [
        "-max_interleave_delta", "0",
        "-max_muxing_queue_size", "9999",
        "-movflags", "+faststart",
        "-y",
        out_path
    ]

    print(f"\n⚙️  Execution Plan:")
    print(f"   Video Track:    {video_action}")
    print(f"   Audio Track:    {audio_action}")
    print(f"   Subtitle Track: {sub_mapped} text stream(s) embedded")
    print(f"   Destination:    {os.path.basename(out_path)}")
    print("\n🔧 Processing video... (this may take a few moments)\n")

    try:
        subprocess.run(cmd, check=True)
        print(f"\n✅ Success! Browser-compatible video saved to:\n   {out_path}")
        orig_size = os.path.getsize(video_path) / (1024**2)
        new_size = os.path.getsize(out_path) / (1024**2)
        print(f"   File Size: {orig_size:.1f} MB -> {new_size:.1f} MB")
        print("   Ready to play directly in Nova Player Pro!")
    except subprocess.CalledProcessError:
        print("\n❌ FFmpeg conversion failed. The source file may be severely corrupted.")
        if os.path.exists(out_path):
            os.remove(out_path)
    except Exception as e:
        print(f"\n❌ Error: {e}")

    input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
