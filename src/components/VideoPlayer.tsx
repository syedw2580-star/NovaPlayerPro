import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { VideoItem, SubtitleCue, Bookmark, VideoStats, MediaAudioTrack, MediaSubtitleTrack } from '../types';
import { AudioEngine } from '../utils/audioEngine';
import { getYouTubeVideoId, getVimeoVideoId } from '../utils/urlHelpers';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useFullscreen } from '../hooks/useFullscreen';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  RotateCcw, Sliders, Info, Bookmark as BookmarkIcon, List, 
  Tv, Zap, Minimize, ArrowLeft, Loader2, Gauge, Keyboard, MessageSquare, Headphones
} from 'lucide-react';

interface VideoPlayerProps {
  activeVideo: VideoItem | null;
  cues: SubtitleCue[];
  bookmarks: Bookmark[];
  onAddBookmark: (videoId: string, time: number, note: string) => void;
  onRemoveBookmark: (id: string) => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
  
  // Multi-track streams (VLC style)
  audioTracks?: MediaAudioTrack[];
  activeAudioTrackId?: string;
  onSelectAudioTrack?: (trackId: string) => void;
  subtitleTracks?: MediaSubtitleTrack[];
  activeSubtitleTrackId?: string;
  onSelectSubtitleTrack?: (trackId: string) => void;

  // Custom yellow subtitles styles
  subtitleSize: number;
  subtitleDelay: number;
  setSubtitleDelay?: React.Dispatch<React.SetStateAction<number>>;
  subtitlePosition: number; // raw percentage (e.g., 8%)

  // Audio delay offset sync
  audioDelay: number; // in seconds (-5.0s to +5.0s)
  setAudioDelay: React.Dispatch<React.SetStateAction<number>>;

  // Audio controls linked to App state or internal
  volumeBoost: number; // 0 to 200
  setVolumeBoost: (vol: number) => void;
  
  // Custom video enhancements
  activePreset: 'flat' | 'bass' | 'vocal' | 'cinema' | 'treble' | 'dialogue';
  setActivePreset: (preset: 'flat' | 'bass' | 'vocal' | 'cinema' | 'treble' | 'dialogue') => void;
  
  dialogueBoost?: number; // in dB (0, 6, 12)
  setDialogueBoost?: (db: number) => void;
  
  brightness: number; // 50 to 150 (represented as %)
  setBrightness: (val: number) => void;
  contrast: number; // 50 to 150
  setContrast: (val: number) => void;
  saturation: number; // 0 to 200
  setSaturation: (val: number) => void;

  currentTime?: number;
  setCurrentTime?: (time: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;

  userVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
}

export default function VideoPlayer({
  activeVideo,
  cues,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  onNextVideo,
  onPrevVideo,
  subtitleSize,
  subtitleDelay,
  setSubtitleDelay,
  subtitlePosition,
  audioDelay,
  setAudioDelay,
  volumeBoost,
  setVolumeBoost,
  activePreset,
  setActivePreset,
  dialogueBoost: propDialogueBoost,
  setDialogueBoost: propSetDialogueBoost,
  audioTracks = [],
  activeAudioTrackId = '',
  onSelectAudioTrack,
  subtitleTracks = [],
  activeSubtitleTrackId = '',
  onSelectSubtitleTrack,
  brightness,
  setBrightness,
  contrast,
  setContrast,
  saturation,
  setSaturation,
  currentTime: propCurrentTime,
  setCurrentTime: propSetCurrentTime,
  playbackSpeed,
  setPlaybackSpeed,
  userVideoRef
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Localized playback time state — updates at 60fps without forcing entire app tree re-renders
  const [internalCurrentTime, setInternalCurrentTime] = useState<number>(0);
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : internalCurrentTime;
  const setCurrentTime = (t: number) => {
    setInternalCurrentTime(t);
    if (propSetCurrentTime) propSetCurrentTime(t);
  };
  
  // Internal player play state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [isLiveStream, setIsLiveStream] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [showQuickSettings, setShowQuickSettings] = useState<boolean>(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'fit' | 'fill' | 'stretch' | '16-9' | '4-3'>('fit');

  // Video FX Filter Engine state
  const [hueRotate, setHueRotate] = useState<number>(0);
  const [sepia, setSepia] = useState<number>(0);
  const [grayscale, setGrayscale] = useState<number>(0);
  const [invert, setInvert] = useState<number>(0);
  const [activeVideoFxPreset, setActiveVideoFxPreset] = useState<'normal' | 'cinema' | 'hdr' | 'cyberpunk' | 'noir' | 'vintage' | 'nightvision'>('normal');

  const applyVideoFxPreset = (preset: 'normal' | 'cinema' | 'hdr' | 'cyberpunk' | 'noir' | 'vintage' | 'nightvision') => {
    setActiveVideoFxPreset(preset);
    switch (preset) {
      case 'cinema':
        setBrightness(105);
        setContrast(125);
        setSaturation(115);
        setHueRotate(0);
        setSepia(10);
        setGrayscale(0);
        setInvert(0);
        break;
      case 'hdr':
        setBrightness(115);
        setContrast(140);
        setSaturation(165);
        setHueRotate(0);
        setSepia(0);
        setGrayscale(0);
        setInvert(0);
        break;
      case 'cyberpunk':
        setBrightness(110);
        setContrast(135);
        setSaturation(180);
        setHueRotate(45);
        setSepia(0);
        setGrayscale(0);
        setInvert(0);
        break;
      case 'noir':
        setBrightness(110);
        setContrast(150);
        setSaturation(0);
        setHueRotate(0);
        setSepia(0);
        setGrayscale(100);
        setInvert(0);
        break;
      case 'vintage':
        setBrightness(95);
        setContrast(110);
        setSaturation(85);
        setHueRotate(-15);
        setSepia(50);
        setGrayscale(0);
        setInvert(0);
        break;
      case 'nightvision':
        setBrightness(130);
        setContrast(160);
        setSaturation(200);
        setHueRotate(90);
        setSepia(0);
        setGrayscale(0);
        setInvert(0);
        break;
      case 'normal':
      default:
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
        setHueRotate(0);
        setSepia(0);
        setGrayscale(0);
        setInvert(0);
        break;
    }
  };
  
  // Audio state
  const [isAudioEngineEnabled, setIsAudioEngineEnabled] = useState<boolean>(true);
  const [savedNormalVolume, setSavedNormalVolume] = useState<number>(100);

  // A-B Looping states
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [isLoopEnabled, setIsLoopEnabled] = useState<boolean>(true);

  // New Bookmark input
  const [bookmarkNote, setBookmarkNote] = useState<string>('');
  const [showBookmarkInput, setShowBookmarkInput] = useState<boolean>(false);

  // Subtitle cue to display
  const [activeSubtitleText, setActiveSubtitleText] = useState<string>('');

  // Smart Audio Booster (Dynamic Compressor + Waveshaper Soft-Clipper for 300% safe loudness)
  const [isSmartBoostEnabled, setIsSmartBoostEnabled] = useState<boolean>(true);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Auto-hide controls timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Corrupted Media Auto-Recovery & Watchdog State
  const [recoveryToast, setRecoveryToast] = useState<{ visible: boolean; message: string; timestamp: number } | null>(null);
  const consecutiveErrorsRef = useRef<{ count: number; lastErrorTime: number }>({ count: 0, lastErrorTime: 0 });
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoRecoveringRef = useRef<boolean>(false);
  const pendingSeekAfterRecoveryRef = useRef<number | null>(null);
  const lastSavedPosTimeRef = useRef<number>(0);

  // Auto-dismiss recovery toast after 4.5s
  useEffect(() => {
    if (recoveryToast?.visible) {
      const t = setTimeout(() => {
        setRecoveryToast(null);
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [recoveryToast]);

  // 3D Stereoscopic Playback Modes (SBS / TAB -> 2D Monoscopic Extraction)
  const [threeDMode, setThreeDMode] = useState<'off' | 'sbs-left' | 'sbs-right' | 'tab-top' | 'tab-bottom'>('off');

  // Cycle through 3D Modes (hotkey '3')
  const cycleThreeDMode = () => {
    const modes: ('off' | 'sbs-left' | 'sbs-right' | 'tab-top' | 'tab-bottom')[] = ['off', 'sbs-left', 'sbs-right', 'tab-top', 'tab-bottom'];
    const nextIdx = (modes.indexOf(threeDMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setThreeDMode(nextMode);
    
    const labels: Record<string, string> = {
      'off': '3D Engine: Off (Original Side-by-Side)',
      'sbs-left': '3D Engine: SBS → 2D (Left Eye) 👓',
      'sbs-right': '3D Engine: SBS → 2D (Right Eye) 👓',
      'tab-top': '3D Engine: Top-and-Bottom → 2D (Top Eye) 👓',
      'tab-bottom': '3D Engine: Top-and-Bottom → 2D (Bottom Eye) 👓'
    };
    setRecoveryToast({
      visible: true,
      message: labels[nextMode],
      timestamp: Date.now()
    });
  };

  // Cycle Subtitle Tracks (hotkey 'S')
  const cycleSubtitleTrack = () => {
    if (!subtitleTracks || subtitleTracks.length === 0) return;
    const trackIds = [...subtitleTracks.map(t => t.id), 'off'];
    const currentIdx = trackIds.indexOf(activeSubtitleTrackId || 'off');
    const nextIdx = (currentIdx + 1) % trackIds.length;
    const nextTrackId = trackIds[nextIdx];

    if (onSelectSubtitleTrack) {
      onSelectSubtitleTrack(nextTrackId);
    }

    const selected = subtitleTracks.find(t => t.id === nextTrackId);
    setRecoveryToast({
      visible: true,
      message: selected ? `💬 Subtitle: ${selected.label}` : '💬 Subtitles: Disabled',
      timestamp: Date.now()
    });
  };

  // Cycle Audio Tracks (hotkey 'B')
  const cycleAudioTrack = () => {
    if (!audioTracks || audioTracks.length <= 1) return;
    const currentIdx = audioTracks.findIndex(t => t.id === activeAudioTrackId);
    const nextIdx = (currentIdx + 1) % audioTracks.length;
    const nextTrack = audioTracks[nextIdx];

    if (onSelectAudioTrack) {
      onSelectAudioTrack(nextTrack.id);
    }

    setRecoveryToast({
      visible: true,
      message: `🎧 Audio: ${nextTrack.label}`,
      timestamp: Date.now()
    });
  };

  // Switch HTML5 audio tracks when activeAudioTrackId changes
  useEffect(() => {
    if (!userVideoRef?.current || !activeAudioTrackId) return;
    const videoEl = userVideoRef.current as any;
    if (videoEl.audioTracks && videoEl.audioTracks.length > 0) {
      const selectedTrk = audioTracks.find(t => t.id === activeAudioTrackId);
      const targetIdx = selectedTrk ? selectedTrk.index : 0;
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        videoEl.audioTracks[i].enabled = (i === targetIdx);
      }
    }
  }, [activeAudioTrackId, audioTracks, userVideoRef]);

  // Handle scene bookmark saving
  const handleAddBookmarkInternal = () => {
    if (onAddBookmark && activeVideo) {
      onAddBookmark(activeVideo.id, currentTime, bookmarkNote || 'Scene Bookmark');
    }
    setBookmarkNote('');
    setShowBookmarkInput(false);
    setRecoveryToast({
      visible: true,
      message: `🔖 Scene Bookmarked at ${formatSeconds(currentTime)}`,
      timestamp: Date.now()
    });
  };

  // Auto-detect 3D SBS / TAB format from media filename or title
  useEffect(() => {
    if (activeVideo) {
      const name = (activeVideo.title || (activeVideo as any).name || '').toLowerCase();
      const is3D = name.includes('3d') || name.includes('sbs') || name.includes('hsbs') || name.includes('h-sbs') || name.includes('half-sbs');
      const isTAB = name.includes('tab') || name.includes('h-tab') || name.includes('ou') || name.includes('h-ou') || name.includes('over-under');

      if (is3D) {
        const detectedMode = isTAB ? 'tab-top' : 'sbs-left';
        setThreeDMode(detectedMode);
        setRecoveryToast({
          visible: true,
          message: isTAB ? '🎬 3D Top-and-Bottom Detected — Auto-Switched to 2D Top Eye' : '🎬 3D Side-by-Side (SBS) Detected — Auto-Switched to 2D Left Eye',
          timestamp: Date.now()
        });
      } else {
        setThreeDMode('off');
      }
    }
  }, [activeVideo]);

  // Track cursor location to show tooltip
  const [tooltipX, setTooltipX] = useState<number>(0);
  const [tooltipTime, setTooltipTime] = useState<number>(0);
  const [hoveringProgress, setHoveringProgress] = useState<boolean>(false);

  // Internal fallback dialogue boost state
  const [internalDialogueBoost, setInternalDialogueBoost] = useState<number>(0);
  const dialogueBoost = propDialogueBoost !== undefined ? propDialogueBoost : internalDialogueBoost;
  const setDialogueBoost = propSetDialogueBoost || setInternalDialogueBoost;

  // Toggle Dialogue Boost Cycle (0dB -> +6dB -> +12dB -> 0dB)
  const toggleDialogueBoost = () => {
    const levels = [0, 6, 12];
    const nextIdx = (levels.indexOf(dialogueBoost) + 1) % levels.length;
    const nextLevel = levels[nextIdx];
    setDialogueBoost(nextLevel);

    const labels: Record<number, string> = {
      0: '🗣️ Dialogue Boost: OFF (Standard Mix)',
      6: '🗣️ Dialogue Boost: +6dB (Center Channel & Speech Clarity Active)',
      12: '🗣️ Dialogue Boost: +12dB (Max Dialogue & Whisper Boost)'
    };
    setRecoveryToast({
      visible: true,
      message: labels[nextLevel],
      timestamp: Date.now()
    });
  };

  // Dedicated Audio Engine Hook (Single Source of Truth, avoids duplicate Web Audio contexts)
  const { audioEngine } = useAudioEngine({
    videoRef: userVideoRef,
    activeVideo,
    isAudioEngineEnabled,
    volumeBoost,
    isSmartBoostEnabled,
    activePreset,
    dialogueBoost,
    audioDelay,
  });

  // Handle active video URL, YouTube, HLS live streams, or file changes
  useEffect(() => {
    if (!activeVideo) return;

    const url = activeVideo.url;

    // Destroy any existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const ytId = getYouTubeVideoId(url);
    const vmId = getVimeoVideoId(url);

    if (ytId || vmId) {
      setIsLiveStream(false);
      setIsPlaying(true);
      setDuration(0);
      setLoopA(null);
      setLoopB(null);
      return;
    }

    if (!userVideoRef.current) return;
    const videoEl = userVideoRef.current;

    setIsLiveStream(false);
    setIsPlaying(false);
    setDuration(activeVideo.duration || 0);
    setLoopA(null);
    setLoopB(null);

    const isHlsUrl = url.includes('.m3u8') || url.includes('/hls/') || url.includes('application/x-mpegURL');

    if (isHlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS Engine] Manifest parsed successfully');
        setIsLiveStream(hls.levels[0]?.details?.live || false);
        videoEl.play().then(() => setIsPlaying(true)).catch(console.warn);
      });

      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (data.details?.live) {
          setIsLiveStream(true);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('[HLS Engine] Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });
    } else if (isHlsUrl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple / Safari HLS
      videoEl.src = url;
      videoEl.load();
      setIsLiveStream(true);
    } else {
      // Standard Direct Video (MP4, WebM, MKV, Blob, streaming video URL)
      videoEl.src = url;
      videoEl.load();
    }

    const savedPosition = localStorage.getItem(`playback-pos-${activeVideo.id}`);
    if (savedPosition && !isHlsUrl) {
      const parsedPos = parseFloat(savedPosition);
      videoEl.currentTime = parsedPos;
      setCurrentTime(parsedPos);
    } else {
      videoEl.currentTime = 0;
      setCurrentTime(0);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeVideo]);

  // Active subtitles tracker using O(log N) binary search
  useEffect(() => {
    if (!cues.length) {
      setActiveSubtitleText('');
      return;
    }

    const timeWithDelay = currentTime - subtitleDelay;
    
    // Fast O(log N) binary search on chronologically sorted cues
    let low = 0;
    let high = cues.length - 1;
    let activeCue: SubtitleCue | null = null;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const cue = cues[mid];
      if (timeWithDelay >= cue.startTime && timeWithDelay <= cue.endTime) {
        activeCue = cue;
        break;
      } else if (timeWithDelay < cue.startTime) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Check immediate boundary neighbors for slight cue overlaps
    if (!activeCue) {
      const checkStart = Math.max(0, low - 2);
      const checkEnd = Math.min(cues.length - 1, low + 2);
      for (let i = checkStart; i <= checkEnd; i++) {
        const cue = cues[i];
        if (timeWithDelay >= cue.startTime && timeWithDelay <= cue.endTime) {
          activeCue = cue;
          break;
        }
      }
    }

    setActiveSubtitleText(activeCue ? activeCue.text : '');
  }, [currentTime, cues, subtitleDelay]);

  // Auto-hide controls & mouse cursor handler (YouTube style)
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQuickSettings(false);
        setHoveringProgress(false);
      }, 2500);
    }
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Core Playback Controls
  const togglePlay = () => {
    if (!userVideoRef.current || !activeVideo) return;
    audioEngine?.resume(); // resume AudioContext permissions

    if (isPlaying) {
      userVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      userVideoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play request failed:', err);
          // Auto fallbacks inside some strict browsers if Web Audio fails
          setIsAudioEngineEnabled(false);
          userVideoRef.current?.play().then(() => setIsPlaying(true));
        });
    }
  };

  const setPlayState = (play: boolean) => {
    if (!userVideoRef.current) return;
    if (play) {
      userVideoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      userVideoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekDelta = (seconds: number) => {
    if (!userVideoRef.current) return;
    let target = userVideoRef.current.currentTime + seconds;
    target = Math.max(0, Math.min(target, duration));
    userVideoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const handleSeek = (time: number) => {
    if (!userVideoRef.current) return;
    setIsSeeking(true);
    userVideoRef.current.currentTime = time;
    setCurrentTime(time);
    setIsSeeking(false);
  };

  const toggleMute = () => {
    if (!userVideoRef.current) return;
    if (isMuted) {
      setVolumeBoost(savedNormalVolume);
      setIsMuted(false);
    } else {
      setSavedNormalVolume(volumeBoost);
      setVolumeBoost(0);
      setIsMuted(true);
    }
  };

  const toggleBooster300 = () => {
    const newVol = volumeBoost > 100 ? 100 : 400;
    setIsAudioEngineEnabled(true);
    setIsSmartBoostEnabled(true);
    setVolumeBoost(newVol);

    if (userVideoRef.current) {
      userVideoRef.current.volume = 1.0;
      const engine = audioEngine || AudioEngine.getOrCreate(userVideoRef.current);
      engine.initialize();
      engine.resume();
      engine.setVolumeBoost(newVol);
    }
  };

  // Mobile & Landscape Screen Orientation Handler
  const lockLandscapeOrientation = async () => {
    try {
      if (window.screen && window.screen.orientation && typeof (window.screen.orientation as any).lock === 'function') {
        await (window.screen.orientation as any).lock('landscape').catch(() => {
          return (window.screen.orientation as any).lock('landscape-primary');
        });
      } else if ((window.screen as any).lockOrientation) {
        (window.screen as any).lockOrientation('landscape');
      } else if ((window.screen as any).mozLockOrientation) {
        (window.screen as any).mozLockOrientation('landscape');
      } else if ((window.screen as any).msLockOrientation) {
        (window.screen as any).msLockOrientation('landscape');
      }
    } catch (err) {
      console.warn('Orientation lock notice:', err);
    }
  };

  const unlockOrientation = () => {
    try {
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
        window.screen.orientation.unlock();
      } else if ((window.screen as any).unlockOrientation) {
        (window.screen as any).unlockOrientation();
      } else if ((window.screen as any).mozUnlockOrientation) {
        (window.screen as any).mozUnlockOrientation();
      }
    } catch (err) {
      console.warn('Orientation unlock notice:', err);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    const isFull = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isFull) {
      const el = containerRef.current as any;
      const requestFS = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;

      if (requestFS) {
        requestFS.call(el)
          .then(() => {
            setIsFullscreen(true);
            lockLandscapeOrientation();
          })
          .catch(() => {
            // iOS Safari iPhone video fullscreen fallback
            if (userVideoRef.current && (userVideoRef.current as any).webkitEnterFullscreen) {
              (userVideoRef.current as any).webkitEnterFullscreen();
            } else {
              setIsFullscreen(true);
              lockLandscapeOrientation();
            }
          });
      } else if (userVideoRef.current && (userVideoRef.current as any).webkitEnterFullscreen) {
        (userVideoRef.current as any).webkitEnterFullscreen();
      }
    } else {
      const exitFS = document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).mozCancelFullScreen || (document as any).msExitFullscreen;
      if (exitFS) {
        exitFS.call(document)
          .then(() => {
            setIsFullscreen(false);
            unlockOrientation();
          })
          .catch(() => {
            setIsFullscreen(false);
            unlockOrientation();
          });
      } else {
        setIsFullscreen(false);
        unlockOrientation();
      }
    }
  };

  // Monitor Fullscreen Esc key & mobile orientation events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
      if (isFull) {
        lockLandscapeOrientation();
      } else {
        unlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Modular Keyboard Shortcuts Custom Hook (invoked after togglePlay, toggleFullscreen, etc. are declared)
  useKeyboardShortcuts(
    {
      togglePlay,
      toggleFullscreen,
      toggleMute,
      toggleBooster300,
      seekDelta,
      setShowShortcutsModal,
      setVolumeBoost,
      setIsSmartBoostEnabled,
      setAudioDelay,
      setSubtitleDelay,
      setLoopA,
      setLoopB,
      cycleThreeDMode,
      toggleDialogueBoost,
      cycleSubtitleTrack,
      cycleAudioTrack,
    },
    {
      currentTime,
      loopA,
      loopB,
      volumeBoost,
      isSmartBoostEnabled,
    }
  );

  // Time Updates & Buffering monitoring from HTML5 video element
  const handleTimeUpdate = () => {
    if (!userVideoRef.current || isSeeking) return;
    const current = userVideoRef.current.currentTime;
    setCurrentTime(current);

    // Throttled position persistence (save every 2.5s instead of every tick to avoid synchronous disk I/O)
    if (activeVideo) {
      const now = Date.now();
      if (now - lastSavedPosTimeRef.current > 2500) {
        lastSavedPosTimeRef.current = now;
        localStorage.setItem(`playback-pos-${activeVideo.id}`, current.toString());
      }
    }

    // A-B Looper trigger checks
    if (loopA !== null && loopB !== null && isLoopEnabled) {
      if (current >= loopB || current < loopA) {
        userVideoRef.current.currentTime = loopA;
        setCurrentTime(loopA);
      }
    }
  };

  const handleProgress = () => {
    if (!userVideoRef.current) return;
    const buf = userVideoRef.current.buffered;
    if (buf.length > 0) {
      // Get segment matching active time or overall index
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= currentTime && buf.end(i) >= currentTime) {
          setBufferedTime(buf.end(i));
          break;
        }
      }
    }
  };

  /**
   * Resolves the video source URL directly without broken proxy wrapping.
   */
  const getVideoSourceUrl = (url: string): string => {
    if (!url) return '';
    return url;
  };

  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  const startStallWatchdog = () => {
    clearWatchdog();
    if (!isPlaying) return;
    
    // If stalled on a damaged frame/packet for more than 3 seconds, unfreeze playback
    watchdogTimerRef.current = setTimeout(() => {
      if (userVideoRef.current && isPlaying) {
        const currentPos = userVideoRef.current.currentTime || 0;
        const nudgeTarget = Math.min(currentPos + 1.2, (duration || Infinity) - 0.1);
        console.warn(`[Watchdog] Playback stalled on corrupt/missing frame at ${currentPos.toFixed(1)}s. Nudging to ${nudgeTarget.toFixed(1)}s`);
        
        userVideoRef.current.currentTime = nudgeTarget;
        userVideoRef.current.play().catch(console.warn);
        
        setRecoveryToast({
          visible: true,
          message: `⚡ Skipped frozen frame at ${formatSeconds(currentPos)} — Resumed`,
          timestamp: Date.now()
        });
      }
    }, 3000);
  };

  const handleVideoError = () => {
    const videoEl = userVideoRef.current;
    if (!videoEl || !activeVideo) return;
    const err = videoEl.error;
    const errCode = err ? err.code : 0;
    const errMsg = err ? err.message : '';
    console.warn(`[Corruption Recovery] Video Error Code: ${errCode}, Message: ${errMsg}`);

    const now = Date.now();
    const errorStats = consecutiveErrorsRef.current;
    if (now - errorStats.lastErrorTime > 10000) {
      errorStats.count = 0;
    }
    errorStats.count++;
    errorStats.lastErrorTime = now;

    // Limit consecutive recoveries within 10s window to avoid infinite loops on 0-byte or completely destroyed files
    if (errorStats.count > 6) {
      setRecoveryToast({
        visible: true,
        message: '⚠️ Media stream has severe unrecoverable corruption at current sector.',
        timestamp: now
      });
      return;
    }

    const currentPos = videoEl.currentTime || currentTime || 0;
    const skipTarget = Math.min(currentPos + 1.5, (duration || Infinity) - 0.1);

    setRecoveryToast({
      visible: true,
      message: `⚡ Corrupted frame detected at ${formatSeconds(currentPos)} — Auto-skipping past bad sector...`,
      timestamp: now
    });

    isAutoRecoveringRef.current = true;
    pendingSeekAfterRecoveryRef.current = skipTarget;

    // If Web Audio API crashed on a corrupted audio frame, bypass to native audio
    if (isAudioEngineEnabled) {
      try {
        audioEngine?.resume();
      } catch (e) {
        setIsAudioEngineEnabled(false);
      }
    }

    // Force video element to reload its source buffer and recover cleanly
    try {
      videoEl.load();
    } catch (e) {
      console.error('Error reloading video element:', e);
    }
  };

  const handleLoadedMetadata = () => {
    if (!userVideoRef.current) return;
    setDuration(userVideoRef.current.duration || 0);

    // Auto-Recovery Seek on reload
    if (isAutoRecoveringRef.current && pendingSeekAfterRecoveryRef.current !== null) {
      const target = pendingSeekAfterRecoveryRef.current;
      pendingSeekAfterRecoveryRef.current = null;
      isAutoRecoveringRef.current = false;
      userVideoRef.current.currentTime = target;
      userVideoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setRecoveryToast({
            visible: true,
            message: `✅ Playback smoothly restored at ${formatSeconds(target)}`,
            timestamp: Date.now()
          });
        })
        .catch(console.warn);
    }

    // Automatically enable embedded English subtitle tracks
    try {
      const tracks = userVideoRef.current.textTracks;
      if (tracks && tracks.length > 0) {
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i];
          const lang = (track.language || '').toLowerCase();
          const label = (track.label || '').toLowerCase();
          
          if (lang === 'en' || lang.startsWith('en-') || lang === 'eng' || label.includes('english') || label.includes('eng')) {
            track.mode = 'showing';
            console.log(`Auto-activated embedded English subtitle: ${track.label || track.language}`);
          } else {
            track.mode = 'disabled';
          }
        }
      }
    } catch (e) {
      console.warn('Embedded subtitle track auto-activation failed:', e);
    }
  };

  // Drag scrubber timeline logic
  const handleProgressScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || duration === 0) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = Math.max(0, Math.min(pos * duration, duration));
    handleSeek(targetTime);
  };

  // Tracking position of hover cursor timeline for accurate previews
  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressContainerRef.current || !duration || duration <= 0) {
      setHoveringProgress(false);
      return;
    }
    const rect = progressContainerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    if (relativeX < 0 || relativeX > rect.width) {
      setHoveringProgress(false);
      return;
    }
    const clampedPos = Math.max(0, Math.min(1, relativeX / rect.width));
    const clampedX = Math.max(28, Math.min(relativeX, rect.width - 28));
    
    setTooltipX(clampedX);
    setTooltipTime(clampedPos * duration);
    setHoveringProgress(true);
  };



  // Formatter for visual display: HH:MM:SS
  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec === Infinity) return '00:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Video CSS Adjustments styles builder (Live Video FX Engine)
  const getVideoFiltersStyle = () => {
    return {
      filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hueRotate}deg) sepia(${sepia}%) grayscale(${grayscale}%) invert(${invert}%)`
    };
  };

  // Video 3D Stereoscopic Transform & Filter Styles (Hardware GPU Acceleration for Maximum Native Sharpness)
  const getVideo3DStyle = (): React.CSSProperties => {
    const filters = getVideoFiltersStyle();
    
    let transform = 'translateZ(0)';
    let transformOrigin = 'center center';

    if (threeDMode === 'sbs-left') {
      transform = 'scaleX(2) translateZ(0)';
      transformOrigin = 'left center';
    } else if (threeDMode === 'sbs-right') {
      transform = 'scaleX(2) translateZ(0)';
      transformOrigin = 'right center';
    } else if (threeDMode === 'tab-top') {
      transform = 'scaleY(2) translateZ(0)';
      transformOrigin = 'center top';
    } else if (threeDMode === 'tab-bottom') {
      transform = 'scaleY(2) translateZ(0)';
      transformOrigin = 'center bottom';
    }
    
    return {
      ...filters,
      transform,
      transformOrigin,
      willChange: 'transform',
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
    };
  };

  // Video Alignment Styles based on aspect ratios
  const getVideoClassNames = () => {
    let styles = "w-full h-full transition-all ";
    switch (videoAspectRatio) {
      case 'fill':
        styles += "object-cover";
        break;
      case 'stretch':
        styles += "object-fill";
        break;
      case '16-9':
        styles += "aspect-video object-contain";
        break;
      case '4-3':
        styles += "aspect-[4/3] object-contain";
        break;
      case 'fit':
      default:
        styles += "object-contain";
        break;
    }
    return styles;
  };

  const selectedVideoBookmarks = bookmarks.filter(b => b.videoId === activeVideo?.id);
  const youtubeId = activeVideo ? getYouTubeVideoId(activeVideo.url) : null;
  const vimeoId = activeVideo ? getVimeoVideoId(activeVideo.url) : null;

  return (
    <div 
      id="power-video-player-container"
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`w-full h-full relative overflow-hidden bg-black flex flex-col items-center justify-center select-none group transition-all ${
        isPlaying && !showControls ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* Alert banner if external CORS issues or Web Audio initialization */}
      {!isAudioEngineEnabled && (
        <div className="absolute top-2 left-2 z-30 bg-red-500/10 backdrop-blur-md border border-red-500 px-2.5 py-1.5 text-[11px] text-white flex items-center gap-2 max-w-sm rounded">
          <span>⚠️ Equalizer & Boost node bypassed (CORS / SSL locks).</span>
          <button 
            onClick={() => setIsAudioEngineEnabled(true)}
            className="text-yellow-400 font-bold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* CORRUPTION AUTO-RECOVERY TOAST NOTIFICATION */}
      {recoveryToast && recoveryToast.visible && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-black/90 border border-yellow-500/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-mono text-yellow-300 shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          <span>{recoveryToast.message}</span>
          <button onClick={() => setRecoveryToast(null)} className="text-white/40 hover:text-white ml-1 font-bold">×</button>
        </div>
      )}

      {/* Main Video Viewport Wrapper */}
      {activeVideo ? (
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-black">
          {youtubeId ? (
            <div className="w-full h-full relative">
              {window.location.protocol === 'file:' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-yellow-400/95 text-black px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xl flex items-center gap-3 backdrop-blur-md border border-yellow-300">
                  <span>⚠️ YouTube restricts embeds on <code className="bg-black/20 px-1 py-0.5 rounded font-mono text-[11px]">file:///</code> paths (Error 153).</span>
                  <a
                    href="http://localhost:4173/"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-black text-yellow-300 px-3 py-1 rounded text-xs font-mono font-bold hover:bg-zinc-900 transition flex items-center gap-1 shadow"
                  >
                    Open on Localhost (4173) 🚀
                  </a>
                </div>
              )}
              <iframe
                id="youtube-embed-player"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : vimeoId ? (
            <iframe
              id="vimeo-embed-player"
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
              title={activeVideo.title}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              id="active-html5-video"
              ref={userVideoRef}
              src={getVideoSourceUrl(activeVideo.url)}
              crossOrigin={activeVideo.url.startsWith('http:') || activeVideo.url.startsWith('https:') ? 'anonymous' : undefined}
              onClick={togglePlay}
              onPlay={() => {
                setIsPlaying(true);
                clearWatchdog();
                audioEngine?.resume();
              }}
              onPlaying={() => clearWatchdog()}
              onPause={() => {
                setIsPlaying(false);
                clearWatchdog();
              }}
              onEnded={() => {
                setIsPlaying(false);
                clearWatchdog();
              }}
              onWaiting={startStallWatchdog}
              onStalled={startStallWatchdog}
              onError={handleVideoError}
              onCanPlay={() => {
                if (isAutoRecoveringRef.current && pendingSeekAfterRecoveryRef.current !== null) {
                  const target = pendingSeekAfterRecoveryRef.current;
                  pendingSeekAfterRecoveryRef.current = null;
                  isAutoRecoveringRef.current = false;
                  if (userVideoRef.current) {
                    userVideoRef.current.currentTime = target;
                    userVideoRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
                  }
                }
              }}
              onDoubleClick={toggleFullscreen}
              onTimeUpdate={() => {
                clearWatchdog();
                handleTimeUpdate();
              }}
              onProgress={handleProgress}
              onLoadedMetadata={handleLoadedMetadata}
              style={getVideo3DStyle()}
              className={getVideoClassNames()}
              playsInline
            />
          )}
        </div>
      ) : (
        <div id="no-video-loaded-card" className="flex flex-col items-center justify-center space-y-3.5 p-6 text-center max-w-sm">
          <div className="p-3.5 bg-yellow-400/10 border border-yellow-400/30 rounded-2xl text-yellow-400 shadow-xl shadow-yellow-500/10">
            <Tv size={34} />
          </div>
          <div className="space-y-1">
            <h4 className="text-white font-bold text-sm tracking-wide uppercase">No Media Selected</h4>
            <p className="text-xs text-white/80 leading-relaxed font-medium">
              Choose a video from your library on the right, or drop any MP4, MKV, or subtitles here.
            </p>
          </div>
        </div>
      )}

      {/* CUSTOM YELLOW SUBTITLES OVERLAY */}
      {activeSubtitleText && (
        <div
          id="custom-yellow-subtitles-viewport"
          style={{ 
            fontSize: `${subtitleSize}px`,
            bottom: `${subtitlePosition}%` 
          }}
          className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-20 px-4 py-1 font-sans font-extrabold tracking-wide text-yellow-400 drop-shadow-[0_2px_3px_rgba(0,0,0,1.0)] select-none text-shadow-heavy max-w-[85%]"
        >
          {activeSubtitleText}
        </div>
      )}

      {/* LOADER SPINNER ON SEEKING */}
      {isSeeking && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 z-10">
          <Loader2 className="animate-spin text-yellow-400" size={40} />
        </div>
      )}

      {/* TOP DECK HEADER CONTROLS */}
      {showControls && activeVideo && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-4 flex items-center justify-between z-30 transition-all duration-300">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-black px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider font-mono">
              Now Playing
            </span>
            <h2 className="text-white font-bold text-xs truncate max-w-sm md:max-w-md">
              {activeVideo.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Loop indicator */}
            {loopA !== null && (
              <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                🔁 Looping {formatSeconds(loopA)} {loopB ? `to ${formatSeconds(loopB)}` : '(B not set)'}
              </span>
            )}
            {/* Quick stats toggle */}
            <button
              id="stats-for-nerds-toggle-btn"
              onClick={() => setShowStats(!showStats)}
              className={`p-1.5 rounded transition ${showStats ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              title="Stats for Nerds"
            >
              <Info size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STATS FOR NERDS OVERLAY */}
      {showStats && (
        <div id="stats-for-nerds-panel" className="absolute top-16 left-4 bg-black/95 border border-white/10 rounded p-3.5 shadow-2xl z-25 text-[10px] font-mono text-cyan-400 space-y-2 min-w-[220px] max-w-sm">
          <div className="flex justify-between items-center border-b border-white/10 pb-1.5 mb-1.5">
            <span className="font-bold uppercase tracking-wider text-white/60">📊 Playback Diagnostics</span>
            <button onClick={() => setShowStats(false)} className="text-white/40 hover:text-white text-base">×</button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-white/40">Video ID:</span>
            <span className="text-white/80 truncate">{activeVideo?.id || 'none'}</span>
            
            <span className="text-white/40">Dimensions:</span>
            <span className="text-white/80">
              {userVideoRef.current?.videoWidth || 0}x{userVideoRef.current?.videoHeight || 0}
            </span>
            
            <span className="text-white/40">Speed:</span>
            <span className="text-white/80">{playbackSpeed}x</span>
            
            <span className="text-white/40">Audio EQ Profile:</span>
            <span className="text-white/80 uppercase">{activePreset}</span>

            <span className="text-white/40">Audio Gain:</span>
            <span className="text-yellow-400 font-bold">{(volumeBoost / 100).toFixed(1)}x ({volumeBoost}%)</span>

            <span className="text-white/40">Buffer state:</span>
            <span className="text-white/80">+{formatSeconds(bufferedTime - currentTime)}</span>

            <span className="text-white/40">Cues parsed:</span>
            <span className="text-white/80">{cues.length} tracks</span>

            <span className="text-white/70">Renderer:</span>
            <span className="text-emerald-400 font-bold">Hardware Accelerated</span>
          </div>
        </div>
      )}

      {/* BOTTOM CONTROL DECK */}
      {showControls && activeVideo && (
        <div 
          onMouseLeave={() => setHoveringProgress(false)}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pb-4 pt-8 flex flex-col gap-3.5 z-30 transition-all duration-300"
        >
          
          {/* SCRUB TIMELINE AND BOOKMARKS BAR */}
          <div 
            onMouseLeave={() => setHoveringProgress(false)}
            className="flex flex-col gap-1 relative"
          >
            <div 
              id="progress-scrub-rail"
              ref={progressContainerRef}
              onClick={handleProgressScrub}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={() => setHoveringProgress(false)}
              className="h-1.5 hover:h-2.5 w-full bg-white/10 rounded-full cursor-pointer relative group transition-all duration-150"
            >
              {/* Buffered progress representation */}
              <div 
                style={{ width: `${(bufferedTime / duration) * 100}%` }}
                className="absolute top-0 bottom-0 left-0 bg-white/20 rounded-full pointer-events-none transition-all duration-75"
              />
              {/* Play progress representation */}
              <div 
                style={{ width: `${(currentTime / duration) * 100}%` }}
                className="absolute top-0 bottom-0 left-0 bg-yellow-400 rounded-full pointer-events-none"
              />
              
              {/* LOOP INDICATION BAR */}
              {loopA !== null && (
                <div 
                  style={{ 
                    left: `${(loopA / duration) * 100}%`,
                    width: `${((loopB !== null ? loopB : currentTime) - loopA) / duration * 100}%`
                  }}
                  className="absolute top-0 bottom-0 bg-orange-400/40 pointer-events-none rounded ring-1 ring-orange-400/50"
                />
              )}

              {/* BOOKMARKS VISUAL INDICATOR TICK */}
              {selectedVideoBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  style={{ left: `${(bookmark.time / duration) * 100}%` }}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-red-400 rounded-sm border border-black z-30 cursor-pointer hover:bg-white"
                  title={`Bookmark: ${bookmark.note} at ${formatSeconds(bookmark.time)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(bookmark.time);
                  }}
                />
              ))}

              {/* MOUSE HOVER SEEK TOOLTIP */}
              {hoveringProgress && duration > 0 && (
                <div
                  style={{ left: `${tooltipX}px` }}
                  className="absolute bottom-5 -translate-x-1/2 bg-black text-yellow-400 px-2 py-0.5 rounded border border-white/15 text-[10px] font-mono font-bold whitespace-nowrap z-40 shadow-xl pointer-events-none"
                >
                  {formatSeconds(tooltipTime)}
                </div>
              )}
            </div>
          </div>

          {/* LOWER CONTROLS ROW */}
          <div className="flex items-center justify-between gap-1.5 text-white/80 w-full min-w-0">
            
            {/* LEFT DECK: PLAY, VOLUME & TIME */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Play/Pause */}
              <button
                id="video-play-pause-btn"
                onClick={togglePlay}
                className="p-1.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black transition cursor-pointer shadow flex-shrink-0"
              >
                {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" />}
              </button>

              {/* Back 5s */}
              <button
                id="seek-prev-btn"
                onClick={() => seekDelta(-5)}
                className="p-1 hover:text-white transition text-white/40 flex-shrink-0"
                title="Backward 5s (Left Arrow)"
              >
                <RotateCcw size={13} />
              </button>

              {/* Volume Controller with Smart Booster */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  id="volume-mute-toggle-btn"
                  onClick={toggleMute}
                  className="p-0.5 text-white/60 hover:text-white transition"
                  title="Mute / Unmute"
                >
                  {volumeBoost === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  id="volume-booster-slider"
                  type="range"
                  min="0"
                  max={isSmartBoostEnabled ? "300" : "200"}
                  value={volumeBoost}
                  onChange={(e) => {
                    const newVol = Number(e.target.value);
                    setVolumeBoost(newVol);
                    if (newVol > 0) setIsMuted(false);
                  }}
                  title={`Volume: ${volumeBoost}% ${volumeBoost > 100 ? '(SMART AUDIO BOOST ACTIVE)' : ''}`}
                  className="w-10 sm:w-12 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className={`text-[10px] font-mono leading-none min-w-[24px] ${volumeBoost > 100 ? 'text-amber-400 font-bold' : 'text-white/70'}`}>
                  {volumeBoost}%
                </span>

                {/* Smart Booster Quick Toggle Pill */}
                <button
                  id="smart-booster-quick-toggle"
                  onClick={toggleBooster300}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight transition flex items-center gap-0.5 border ${
                    volumeBoost > 100
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-amber-400/50'
                  }`}
                  title="Toggle 300% Audio Booster (or press 'V' hotkey)"
                >
                  <Zap size={9} className={volumeBoost > 100 ? 'fill-black text-black' : 'text-amber-400'} />
                  <span>{volumeBoost > 100 ? `${volumeBoost}%` : 'BOOST'}</span>
                </button>
              </div>

              {/* Timing clock */}
              <div className="flex items-center text-[10px] font-mono font-medium tracking-tight text-white/70 select-none flex-shrink-0">
                {isLiveStream || duration === Infinity ? (
                  <span className="flex items-center gap-1 text-red-400 font-bold px-1.5 py-0.5 bg-red-500/20 rounded border border-red-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <>
                    <span className="text-white font-semibold">{formatSeconds(currentTime)}</span>
                    <span className="text-white/30 mx-0.5 font-sans">/</span>
                    <span className="text-white/50">{formatSeconds(duration)}</span>
                  </>
                )}
              </div>
            </div>

            {/* MIDDLE DECK: COMPACT SELECTORS & LOOP BUTTONS */}
            <div className="flex items-center gap-1 flex-shrink min-w-0 overflow-hidden">
              {/* Playback speed */}
              <div className="flex items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1 py-0.5 transition" title="Playback Speed">
                <select
                  id="playback-speed-select"
                  value={playbackSpeed}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPlaybackSpeed(val);
                    if (userVideoRef.current) userVideoRef.current.playbackRate = val;
                  }}
                  className="bg-transparent text-white text-[10px] font-semibold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="0.5" className="bg-zinc-900 text-white">0.5x</option>
                  <option value="0.75" className="bg-zinc-900 text-white">0.75x</option>
                  <option value="1" className="bg-zinc-900 text-white">1.0x</option>
                  <option value="1.25" className="bg-zinc-900 text-white">1.25x</option>
                  <option value="1.5" className="bg-zinc-900 text-white">1.5x</option>
                  <option value="2" className="bg-zinc-900 text-white">2.0x</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div className="flex items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1 py-0.5 transition" title="Aspect Ratio">
                <select
                  id="aspect-ratio-selector"
                  value={videoAspectRatio}
                  onChange={(e) => setVideoAspectRatio(e.target.value as any)}
                  className="bg-transparent text-white text-[10px] font-semibold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="fit" className="bg-zinc-900 text-white">Fit</option>
                  <option value="fill" className="bg-zinc-900 text-white">Fill</option>
                  <option value="stretch" className="bg-zinc-900 text-white">Stretch</option>
                  <option value="16-9" className="bg-zinc-900 text-white">16:9</option>
                  <option value="4-3" className="bg-zinc-900 text-white">4:3</option>
                </select>
              </div>

              {/* Audio Track Selector (VLC style) */}
              {audioTracks.length > 0 && (
                <div className="flex items-center gap-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1 py-0.5 transition" title="Audio Track (Hotkey: B)">
                  <Headphones size={10} className="text-white/50 flex-shrink-0" />
                  <select
                    id="audio-track-selector"
                    value={activeAudioTrackId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (onSelectAudioTrack) onSelectAudioTrack(newId);
                      const trk = audioTracks.find(t => t.id === newId);
                      if (trk) {
                        setRecoveryToast({
                          visible: true,
                          message: `🎧 Audio Track: ${trk.label}`,
                          timestamp: Date.now()
                        });
                      }
                    }}
                    className="bg-transparent text-white text-[10px] font-semibold focus:outline-none cursor-pointer font-mono max-w-[70px] sm:max-w-[85px] truncate"
                  >
                    {audioTracks.map((trk) => (
                      <option key={trk.id} value={trk.id} className="bg-zinc-900 text-white">
                        {trk.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subtitle Track Selector (VLC style) */}
              {subtitleTracks.length > 0 && (
                <div className={`flex items-center gap-0.5 border rounded px-1 py-0.5 transition ${
                  activeSubtitleTrackId !== 'off' && cues.length > 0 ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-300 font-bold' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`} title="Subtitle Track (Hotkey: S)">
                  <MessageSquare size={10} className="text-yellow-400 flex-shrink-0" />
                  <select
                    id="subtitle-track-selector"
                    value={activeSubtitleTrackId || 'off'}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (onSelectSubtitleTrack) onSelectSubtitleTrack(newId);
                      const trk = subtitleTracks.find(t => t.id === newId);
                      setRecoveryToast({
                        visible: true,
                        message: trk ? `💬 Subtitle Track: ${trk.label}` : '💬 Subtitles Disabled',
                        timestamp: Date.now()
                      });
                    }}
                    className="bg-transparent text-white text-[10px] font-semibold focus:outline-none cursor-pointer font-mono max-w-[70px] sm:max-w-[85px] truncate"
                  >
                    <option value="off" className="bg-zinc-900 text-red-400">Disable Subs</option>
                    {subtitleTracks.map((trk) => (
                      <option key={trk.id} value={trk.id} className="bg-zinc-900 text-white">
                        {trk.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 3D Stereoscopic Mode choice */}
              <div className={`flex items-center border rounded px-1 py-0.5 transition ${
                threeDMode !== 'off' ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-300 font-bold' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
              }`} title="3D Stereoscopic Engine (Hotkey: 3)">
                <select
                  id="three-d-mode-selector"
                  value={threeDMode}
                  onChange={(e) => setThreeDMode(e.target.value as any)}
                  className="bg-transparent text-white text-[10px] font-semibold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="off" className="bg-zinc-900 text-white">3D Off</option>
                  <option value="sbs-left" className="bg-zinc-900 text-white">SBS-L 👓</option>
                  <option value="sbs-right" className="bg-zinc-900 text-white">SBS-R 👓</option>
                  <option value="tab-top" className="bg-zinc-900 text-white">TAB-T 👓</option>
                  <option value="tab-bottom" className="bg-zinc-900 text-white">TAB-B 👓</option>
                </select>
              </div>

              {/* Quick Loops (A-B) set Buttons */}
              <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded p-0.5">
                <button
                  id="mark-loop-a-btn"
                  onClick={() => setLoopA(currentTime)}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono transition ${
                    loopA !== null ? 'bg-orange-500 text-white font-bold' : 'text-white/60 hover:text-white'
                  }`}
                  title="Loop Start [Hotkey: A]"
                >
                  A{loopA !== null ? `:${formatSeconds(loopA).slice(0, 5)}` : ''}
                </button>
                <button
                  id="mark-loop-b-btn"
                  onClick={() => {
                    if (loopA !== null && currentTime > loopA) {
                      setLoopB(currentTime);
                    }
                  }}
                  disabled={loopA === null}
                  className={`px-1 py-0.5 rounded text-[9px] font-mono transition disabled:opacity-30 ${
                    loopB !== null ? 'bg-orange-500 text-white font-bold' : 'text-white/60 hover:text-white'
                  }`}
                  title="Loop End [Hotkey: B]"
                >
                  B{loopB !== null ? `:${formatSeconds(loopB).slice(0, 5)}` : ''}
                </button>
                {(loopA !== null || loopB !== null) && (
                  <button
                    id="clear-ab-loop-btn"
                    onClick={() => {
                      setLoopA(null);
                      setLoopB(null);
                    }}
                    className="px-0.5 text-white/40 hover:text-white text-[10px]"
                    title="Reset Loop [Hotkey: C]"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT DECK: QUICK SETTINGS, SHORTCUTS HELP, BOOKMARK ADD, FULLSCREEN */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-auto pl-1">
              {/* Keyboard Shortcuts Pro Help Button */}
              <button
                id="keyboard-shortcuts-pro-btn"
                onClick={() => setShowShortcutsModal(prev => !prev)}
                className={`p-1.5 rounded transition ${
                  showShortcutsModal 
                    ? 'bg-yellow-400 text-black font-bold shadow-lg shadow-yellow-500/10' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="Keyboard Shortcuts Pro Guide (Shift + ?)"
              >
                <Keyboard size={15} />
              </button>

              {/* Quick Enhancements settings panel activator */}
              <button
                id="quick-video-settings-toggle-btn"
                onClick={() => setShowQuickSettings(!showQuickSettings)}
                className={`p-1.5 rounded transition ${showQuickSettings ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-500/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                title="Picture Adjustments"
              >
                <Sliders size={15} />
              </button>

              {/* Bookmark scene */}
              <div className="relative">
                <button
                  id="bookmark-scene-input-trigger-btn"
                  onClick={() => setShowBookmarkInput(!showBookmarkInput)}
                  className={`p-1.5 rounded transition ${showBookmarkInput ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-white/60 hover:text-white'}`}
                  title="Bookmark active scene"
                >
                  <BookmarkIcon size={15} />
                </button>
                
                {showBookmarkInput && (
                  <div id="new-bookmark-popup-card" className="absolute bottom-10 right-0 bg-black/95 border border-white/10 rounded p-2.5 shadow-2xl z-40 min-w-[210px] text-xs text-white flex flex-col gap-2">
                    <span className="font-bold text-white/60">Save timestamp: {formatSeconds(currentTime)}</span>
                    <input
                      id="bookmark-note-input"
                      type="text"
                      value={bookmarkNote}
                      onChange={(e) => setBookmarkNote(e.target.value)}
                      placeholder="E.g., Funny scene, VFX drop..."
                      className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-yellow-400"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        id="cancel-bookmark-save-btn"
                        onClick={() => setShowBookmarkInput(false)}
                        className="px-2 py-0.5 text-white/40 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        id="confirm-bookmark-save-btn"
                        onClick={handleAddBookmarkInternal}
                        className="px-2.5 py-0.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle */}
              <button
                id="viewport-fullscreen-toggle-btn"
                onClick={toggleFullscreen}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/5 rounded transition"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>

          </div>

          {/* DYNAMIC QUICK SETTINGS (PICTURE & EQ ADJUSTS CONTROLLER) */}
          {showQuickSettings && (
            <div id="quick-enhancer-tray" className="bg-[#050505]/95 backdrop-blur-md border border-white/10 p-3.5 rounded text-xs space-y-4 shadow-2xl z-30 animate-fade-in text-white">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="font-bold text-yellow-400 flex items-center gap-1 uppercase tracking-wider text-[10px]">
                  <Sliders size={12} />
                  Live Cinematic Enhancer (Web Audio & GPU Filters)
                </span>
                <button onClick={() => setShowQuickSettings(false)} className="text-white/40 hover:text-white text-base">×</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tone adjustment / Equalizer settings */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white/60 block font-mono">1. Web Audio & Smart Booster:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        id="toggle-smart-booster-btn"
                        onClick={toggleBooster300}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border flex items-center gap-1 transition ${
                          volumeBoost > 100
                            ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                            : 'bg-white/5 text-white/40 border-white/10 hover:border-amber-400/50'
                        }`}
                        title="Boost quiet local files by up to 300% (or press V hotkey)"
                      >
                        <Zap size={10} className={volumeBoost > 100 ? 'fill-black' : ''} />
                        {volumeBoost > 100 ? `Booster: ⚡ ${volumeBoost}%` : 'Booster: OFF'}
                      </button>
                      <button
                        id="bypass-web-audio-btn"
                        onClick={() => setIsAudioEngineEnabled(!isAudioEngineEnabled)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isAudioEngineEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'
                        }`}
                      >
                        {isAudioEngineEnabled ? 'Active' : 'Bypassed'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(['flat', 'bass', 'vocal', 'dialogue', 'cinema', 'treble'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          if (isAudioEngineEnabled) {
                            setActivePreset(preset);
                          }
                        }}
                        disabled={!isAudioEngineEnabled}
                        className={`px-2 py-1 text-[10px] uppercase font-mono rounded font-medium border disabled:opacity-40 transition ${
                          activePreset === preset && isAudioEngineEnabled
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-white/5 border-white/10 hover:border-yellow-400 text-white/80'
                        }`}
                      >
                        {preset} {preset === 'dialogue' ? '🗣️' : preset === 'bass' ? '🔥' : preset === 'cinema' ? '🎬' : ''}
                      </button>
                    ))}
                  </div>

                  {/* Dialogue Boost Filter (Center Channel Gain & Speech Clarity 6-12dB) */}
                  <div className="p-2.5 bg-yellow-400/5 rounded-lg border border-yellow-400/20 space-y-2 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="font-bold text-yellow-400 flex items-center gap-1">
                        🗣️ Dialogue Boost (Center Gain & Speech Clarity):
                      </span>
                      <span className={`font-bold ${dialogueBoost > 0 ? 'text-yellow-400' : 'text-white/40'}`}>
                        {dialogueBoost > 0 ? `+${dialogueBoost} dB` : 'OFF'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setDialogueBoost(0)}
                        className={`py-1 rounded border transition font-medium ${
                          dialogueBoost === 0
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        Off (0 dB)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogueBoost(6)}
                        className={`py-1 rounded border transition font-medium ${
                          dialogueBoost === 6
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                        title="Boost center dialogue channel by +6dB"
                      >
                        +6 dB Boost 🗣️
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogueBoost(12)}
                        className={`py-1 rounded border transition font-medium ${
                          dialogueBoost === 12
                            ? 'bg-yellow-400 text-black border-yellow-300 font-bold'
                            : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                        }`}
                        title="Boost center dialogue & whisper presence by +12dB (Night Mode)"
                      >
                        +12 dB Max 🔊
                      </button>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[9px] text-white/50 font-mono">
                        <span>Center Gain & Formant Intensity</span>
                        <span>{dialogueBoost} dB</span>
                      </div>
                      <input
                        id="dialogue-boost-slider"
                        type="range"
                        min="0"
                        max="12"
                        step="1"
                        value={dialogueBoost}
                        onChange={(e) => setDialogueBoost(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                        title={`Dialogue Boost: +${dialogueBoost} dB`}
                      />
                    </div>
                  </div>

                  {/* Audio Stream Delay Sync Offset Control (-5.0s to +5.0s) */}
                  <div className="p-2 bg-white/5 rounded border border-white/10 space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-white/70 font-bold flex items-center gap-1">
                        🔊 Audio Stream Sync Offset:
                      </span>
                      <span className={audioDelay !== 0 ? "text-amber-400 font-bold" : "text-white/40"}>
                        {audioDelay > 0 ? `+${audioDelay.toFixed(1)}s` : `${audioDelay.toFixed(1)}s`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        id="audio-delay-dec-large-btn"
                        onClick={() => setAudioDelay(prev => Math.max(-60.0, Math.round((prev - 1.0) * 10) / 10))}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white transition"
                        title="Audio Delay -1.0s"
                      >
                        -1.0s
                      </button>
                      <button
                        id="audio-delay-dec-btn"
                        onClick={() => setAudioDelay(prev => Math.max(-60.0, Math.round((prev - 0.1) * 10) / 10))}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white transition"
                        title="Shift + J: Audio Delay -0.1s"
                      >
                        -0.1s
                      </button>
                      <input
                        id="audio-delay-range-slider"
                        type="range"
                        min="-60.0"
                        max="60.0"
                        step="0.1"
                        value={audioDelay}
                        onChange={(e) => setAudioDelay(Number(e.target.value))}
                        className="flex-1 h-1 bg-white/10 rounded appearance-none cursor-pointer accent-amber-400 min-w-[100px]"
                        title={`Audio Delay: ${audioDelay.toFixed(1)}s`}
                      />
                      <button
                        id="audio-delay-inc-btn"
                        onClick={() => setAudioDelay(prev => Math.min(60.0, Math.round((prev + 0.1) * 10) / 10))}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white transition"
                        title="Shift + L: Audio Delay +0.1s"
                      >
                        +0.1s
                      </button>
                      <button
                        id="audio-delay-inc-large-btn"
                        onClick={() => setAudioDelay(prev => Math.min(60.0, Math.round((prev + 1.0) * 10) / 10))}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white transition"
                        title="Audio Delay +1.0s"
                      >
                        +1.0s
                      </button>
                      <button
                        id="audio-delay-reset-btn"
                        onClick={() => setAudioDelay(0)}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded text-[10px] font-mono text-white/60 hover:text-white transition"
                        title="Shift + U: Reset Audio Delay to 0.0s"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-white/40 font-mono">
                    * The Cinema preset boosts low-frequency sub-bass and crisp vocals, while Bass Boost elevates details.
                  </p>
                </div>

                {/* GPU Filters / Live Video FX Engine */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white/60 block font-mono">2. Cinematic Video FX Engine:</span>
                    <button
                      id="reset-video-filters-btn"
                      onClick={() => applyVideoFxPreset('normal')}
                      className="px-2 py-0.5 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded text-[10px] font-mono text-white/60 hover:text-white transition"
                    >
                      Reset Video FX
                    </button>
                  </div>
                  
                  {/* Preset Badges */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'normal', label: 'Normal 🎬' },
                      { id: 'cinema', label: 'Cinema Film 📽️' },
                      { id: 'hdr', label: 'HDR Pop 🌟' },
                      { id: 'cyberpunk', label: 'Cyberpunk 🌃' },
                      { id: 'noir', label: 'Retro Noir 🕵️' },
                      { id: 'vintage', label: 'Vintage 📜' },
                      { id: 'nightvision', label: 'Night Vision 🌙' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyVideoFxPreset(p.id as any)}
                        className={`px-2 py-0.5 text-[9px] uppercase font-mono rounded font-bold border transition ${
                          activeVideoFxPreset === p.id
                            ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                            : 'bg-white/5 border-white/10 hover:border-amber-400/50 text-white/80'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Brightness: {brightness}%</span>
                      <input
                        id="video-brightness-range"
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>
                    
                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Contrast: {contrast}%</span>
                      <input
                        id="video-contrast-range"
                        type="range"
                        min="50"
                        max="200"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>
                    
                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Saturation: {saturation}%</span>
                      <input
                        id="video-saturation-range"
                        type="range"
                        min="0"
                        max="200"
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>

                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Hue Shift: {hueRotate}°</span>
                      <input
                        id="video-hue-range"
                        type="range"
                        min="-180"
                        max="180"
                        value={hueRotate}
                        onChange={(e) => setHueRotate(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>

                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Sepia: {sepia}%</span>
                      <input
                        id="video-sepia-range"
                        type="range"
                        min="0"
                        max="100"
                        value={sepia}
                        onChange={(e) => setSepia(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>

                    <div className="p-1.5 bg-white/5 rounded border border-white/10">
                      <span className="block text-white/40 mb-1">Grayscale: {grayscale}%</span>
                      <input
                        id="video-grayscale-range"
                        type="range"
                        min="0"
                        max="100"
                        value={grayscale}
                        onChange={(e) => setGrayscale(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer accent-yellow-450"
                      />
                    </div>
                  </div>
                </div>

                {/* 3D Stereoscopic Mode Engine Panel */}
                <div className="md:col-span-2 p-2.5 bg-yellow-400/5 rounded-lg border border-yellow-400/20 space-y-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-yellow-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                      🎬 3D Stereoscopic Engine (Side-by-Side / Top-Bottom ➔ 2D Conversion):
                    </span>
                    <span className="text-white/50 text-[10px] font-mono">Hotkey: Press [ 3 ] to cycle</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] font-mono">
                    <button
                      onClick={() => setThreeDMode('off')}
                      className={`p-1.5 rounded border transition font-medium ${
                        threeDMode === 'off' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      Off (Raw SBS)
                    </button>
                    <button
                      onClick={() => setThreeDMode('sbs-left')}
                      className={`p-1.5 rounded border transition font-medium ${
                        threeDMode === 'sbs-left' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      SBS ➔ 2D (Left Eye) 👓
                    </button>
                    <button
                      onClick={() => setThreeDMode('sbs-right')}
                      className={`p-1.5 rounded border transition font-medium ${
                        threeDMode === 'sbs-right' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      SBS ➔ 2D (Right Eye) 👓
                    </button>
                    <button
                      onClick={() => setThreeDMode('tab-top')}
                      className={`p-1.5 rounded border transition font-medium ${
                        threeDMode === 'tab-top' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      TAB ➔ 2D (Top Eye) 👓
                    </button>
                    <button
                      onClick={() => setThreeDMode('tab-bottom')}
                      className={`p-1.5 rounded border transition font-medium ${
                        threeDMode === 'tab-bottom' ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      TAB ➔ 2D (Bottom Eye) 👓
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Pro Modal Overlay */}
      {showShortcutsModal && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/15 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 text-white">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="text-yellow-400" size={18} />
                <span className="font-bold text-sm tracking-wider uppercase font-mono">
                  Keyboard Shortcuts Pro
                </span>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-white/40 hover:text-white text-lg font-bold px-2 py-0.5 rounded hover:bg-white/10"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 text-[11px] font-mono max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Seek ±60 seconds (1 min)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">Shift + ← / →</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Seek ±5 seconds</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">← / →</span>
              </div>

              <div className="flex justify-between items-center bg-amber-500/10 p-2.5 rounded border border-amber-500/30">
                <span className="text-amber-200 font-bold flex items-center gap-1">
                  <Zap size={11} className="fill-amber-300" />
                  Smart Audio Boost (300%)
                </span>
                <span className="bg-amber-400 text-black px-2 py-0.5 rounded font-bold">V</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Volume Up / Down (0-300%)</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">↑ / ↓</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Play / Pause</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">Space / K</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Toggle Widescreen Fullscreen</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">F</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Mute / Unmute Volume</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">M</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Mark A-B Loop Points</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">A / B</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Subtitle Offset ±1.0s (or ±0.1s with Shift)</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">[ / ] or Z / X</span>
              </div>

              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Reset Audio & Subtitle Offsets (0.0s)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">R / U</span>
              </div>

              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Cycle Subtitle Tracks (Track 1 ➔ 2 ➔ Off)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">S</span>
              </div>

              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Cycle Audio Streams (Track 1 ➔ 2)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">B / Shift + A</span>
              </div>

              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Toggle Dialogue Boost Filter (0dB / +6dB / +12dB)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">D</span>
              </div>

              <div className="flex justify-between items-center bg-yellow-400/10 p-2.5 rounded border border-yellow-400/30">
                <span className="text-yellow-300 font-bold">Cycle 3D Stereoscopic Modes (SBS / TAB ➔ 2D)</span>
                <span className="bg-yellow-400 text-black px-2 py-0.5 rounded font-bold">3</span>
              </div>

              <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/10">
                <span className="text-white/70">Reset Loop Points</span>
                <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded font-bold">C</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold px-4 py-1.5 rounded transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
