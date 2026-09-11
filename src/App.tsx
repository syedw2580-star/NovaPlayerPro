import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoItem, Playlist, SubtitleCue, Bookmark, MediaAudioTrack, MediaSubtitleTrack } from './types';
import { defaultVideos, sampleSrtSubtitles } from './data/defaultCatalog';
import { parseSubtitles } from './utils/subtitleParser';
import { extractEmbeddedSubtitles, extractAllMediaTracks, extractEmbeddedSubtitleTrack } from './utils/embeddedSubtitleExtractor';
import { 
  getVideosFromDB, 
  saveVideoToDB, 
  deleteVideoFromDB, 
  getAppState, 
  saveAppState,
  SavedVideo
} from './utils/db';
import { stringifySRT } from './utils/srtStringifier';
import { getVideoPoster } from './utils/urlHelpers';

// Components
import VideoPlayer from './components/VideoPlayer';
import CatalogueList from './components/CatalogueList';
import SubtitleManager from './components/SubtitleManager';
import BookmarksTab from './components/BookmarksTab';
import ErrorBoundary from './components/ErrorBoundary';

// Icons
import { Film, List as ListIcon, Subtitles, Bookmark as BookmarkIcon, Github, Laptop, Sparkles, HelpCircle, HardDriveDownload, Maximize2, Minimize2 } from 'lucide-react';

export default function App() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<'normal' | 'wide'>('normal');

  // Subtitle cues & multi-track streams state
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<MediaSubtitleTrack[]>([]);
  const [activeSubtitleTrackId, setActiveSubtitleTrackId] = useState<string>('off');
  const [audioTracks, setAudioTracks] = useState<MediaAudioTrack[]>([]);
  const [activeAudioTrackId, setActiveAudioTrackId] = useState<string>('audio-track-default');

  // Subtitle preferences
  const [subtitleSize, setSubtitleSize] = useState<number>(24);
  const [subtitleDelay, setSubtitleDelay] = useState<number>(0);
  const [subtitlePosition, setSubtitlePosition] = useState<number>(8); // bottom offset in %

  // Audio & video controls
  const [audioDelay, setAudioDelay] = useState<number>(0);
  const [volumeBoost, setVolumeBoost] = useState<number>(100);
  const [activePreset, setActivePreset] = useState<'flat' | 'bass' | 'vocal' | 'cinema' | 'treble' | 'dialogue'>('flat');
  const [dialogueBoost, setDialogueBoost] = useState<number>(0); // in dB: 0 (Off), 6 (+6dB), 12 (+12dB)
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Selected sidebar active tab: 'catalogue' | 'subtitles' | 'bookmarks'
  const [activeTab, setActiveTab] = useState<'catalogue' | 'subtitles' | 'bookmarks'>('catalogue');

  // Drag and drop overlay state
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Abort controller ref for in-flight subtitle extraction cancellation
  const extractionAbortControllerRef = useRef<AbortController | null>(null);

  // Object URLs registry for fast teardown
  const createdObjectUrlsRef = useRef<Set<string>>(new Set());

  const createTrackedObjectURL = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    createdObjectUrlsRef.current.add(url);
    return url;
  };

  useEffect(() => {
    return () => {
      createdObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdObjectUrlsRef.current.clear();
      if (extractionAbortControllerRef.current) {
        extractionAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Raw HTML5 video node reference
  const userVideoRef = useRef<HTMLVideoElement | null>(null);

  const checkAndAutoLoadSubtitles = useCallback(async (video: VideoItem | null) => {
    // 1. Immediately flush all previous cues and tracks so no tracks ever leak across videos
    setCues([]);
    setSubtitleTracks([]);
    setActiveSubtitleTrackId('off');
    setAudioTracks([{
      id: 'audio-track-default',
      index: 0,
      label: 'Track 1: Stereo Audio (Default)',
      language: 'und',
      enabled: true
    }]);
    setActiveAudioTrackId('audio-track-default');

    if (!video) return;

    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    extractionAbortControllerRef.current = controller;

    if (video.file) {
      try {
        const fileObj = video.file as File;
        const tracks = await extractAllMediaTracks(fileObj);
        if (controller.signal.aborted) return;

        if (tracks.audioTracks.length > 0) {
          setAudioTracks(tracks.audioTracks);
          setActiveAudioTrackId(tracks.audioTracks[0].id);
        }
        
        let allSubs = [...tracks.subtitleTracks];
        if (video.subtitleText) {
          const extTrack: MediaSubtitleTrack = {
            id: 'sub-ext',
            index: 0,
            label: video.subtitleName || 'External Subtitle Track (SRT)',
            language: 'und',
            isExternal: true,
            srtText: video.subtitleText,
            mode: 'showing'
          };
          allSubs = [extTrack, ...allSubs];
        }
        setSubtitleTracks(allSubs);

        // Default subtitle track to English or external or Track 1 (VLC style)
        if (video.subtitleText) {
          setActiveSubtitleTrackId('sub-ext');
          setCues(parseSubtitles(video.subtitleText));
          return;
        } else if (allSubs.length > 0) {
          const enSub = allSubs.find(t => t.language?.toLowerCase().startsWith('en') || t.label?.toLowerCase().includes('english'));
          const chosenSub = enSub || allSubs[0];
          setActiveSubtitleTrackId(chosenSub.id);
          if (chosenSub.number !== undefined) {
            const result = await extractEmbeddedSubtitleTrack(fileObj, chosenSub.number, chosenSub.id, controller.signal);
            if (controller.signal.aborted) return;
            if (result && result.cues.length > 0) {
              chosenSub.cues = result.cues;
              chosenSub.srtText = result.srtText;
              setCues(result.cues);
              video.subtitleText = result.srtText;
              video.subtitleName = chosenSub.label;
            } else {
              setCues([]);
            }
          }
          return;
        }
      } catch (e) {
        console.warn('Error extracting media tracks from file:', e);
      }
    }

    if (video.subtitleText) {
      setCues(parseSubtitles(video.subtitleText));
      setActiveSubtitleTrackId('sub-ext');
      return;
    }
  }, []);

  const handleSelectAudioTrack = useCallback((trackId: string) => {
    setActiveAudioTrackId(trackId);
    setAudioTracks(prev => prev.map(t => ({
      ...t,
      enabled: t.id === trackId
    })));

    // Apply native HTML5 audio track selection if supported
    if (userVideoRef.current) {
      const videoEl = userVideoRef.current as any;
      if (videoEl.audioTracks && videoEl.audioTracks.length > 0) {
        setAudioTracks(prev => {
          const selectedTrk = prev.find(t => t.id === trackId);
          const targetIdx = selectedTrk ? selectedTrk.index : 0;
          for (let i = 0; i < videoEl.audioTracks.length; i++) {
            videoEl.audioTracks[i].enabled = (i === targetIdx);
          }
          return prev;
        });
      }
    }
  }, []);

  const handleSelectSubtitleTrack = useCallback(async (trackId: string) => {
    setActiveSubtitleTrackId(trackId);

    if (trackId === 'off' || !trackId) {
      setCues([]);
      return;
    }

    const selectedTrack = subtitleTracks.find(t => t.id === trackId);
    if (!selectedTrack) {
      setCues([]);
      return;
    }

    // 1. Instant Cache Hit: If already extracted once, switch in 0ms!
    if (selectedTrack.cues && selectedTrack.cues.length > 0) {
      setCues(selectedTrack.cues);
      return;
    }

    if (selectedTrack.srtText) {
      const parsed = parseSubtitles(selectedTrack.srtText);
      selectedTrack.cues = parsed;
      setCues(parsed);
      return;
    }

    // Cancel any previous extraction in flight
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    extractionAbortControllerRef.current = controller;

    // 2. High-speed extraction for MKV or MP4 embedded track
    if (activeVideo?.file && selectedTrack.number !== undefined) {
      try {
        const extracted = await extractEmbeddedSubtitleTrack(activeVideo.file as File, selectedTrack.number, selectedTrack.id, controller.signal);
        if (controller.signal.aborted) return;
        if (extracted && extracted.cues.length > 0) {
          selectedTrack.cues = extracted.cues;
          selectedTrack.srtText = extracted.srtText;
          setCues(extracted.cues);
        } else {
          setCues([]);
        }
      } catch (e) {
        console.error('Error extracting selected subtitle track:', e);
        setCues([]);
      }
    }
  }, [subtitleTracks, activeVideo]);

  // Load custom values and storage arrays on mount
  useEffect(() => {
    const loadIndexedDBData = async () => {
      try {
        const dbVideos = await getVideosFromDB();
        if (dbVideos && dbVideos.length > 0) {
          const loaded: VideoItem[] = dbVideos.map(dv => {
            const objectUrl = dv.fileBlob ? createTrackedObjectURL(dv.fileBlob) : (dv.url || '');
            return {
              id: dv.id,
              title: dv.title,
              url: objectUrl,
              file: dv.fileBlob,
              duration: 0,
              addedAt: dv.addedAt,
              category: dv.category || 'Uploaded File',
              subtitleText: dv.subtitleText,
              subtitleName: dv.subtitleName
            };
          });

          setVideos(loaded);

          const savedActiveId = await getAppState('active_video_id');
          const foundActive = loaded.find(v => v.id === savedActiveId) || loaded[0] || null;
          setActiveVideo(foundActive);
          await checkAndAutoLoadSubtitles(foundActive);
        } else {
          // No videos in DB, initialize with completely empty library
          setVideos([]);
          setActiveVideo(null);
          setCues([]);
        }
      } catch (e) {
        console.error('Error loading library from IndexedDB:', e);
        setVideos([]);
        setActiveVideo(null);
        setCues([]);
      }
    };

    loadIndexedDBData();

    // 2. Playlists
    const cachedPlaylists = localStorage.getItem('power_player_playlists');
    if (cachedPlaylists) {
      try {
        setPlaylists(JSON.parse(cachedPlaylists));
      } catch (e) {
        setPlaylists([]);
      }
    } else {
      setPlaylists([]); // Empty playlists initially - no demo
    }

    // 3. Bookmarks
    const cachedBookmarks = localStorage.getItem('power_player_bookmarks');
    if (cachedBookmarks) {
      try {
        setBookmarks(JSON.parse(cachedBookmarks));
      } catch (e) {
        setBookmarks([]);
      }
    }
  }, []);

  const handleCuesChange = async (newCues: SubtitleCue[]) => {
    setCues(newCues);
    if (activeVideo) {
      const srtText = stringifySRT(newCues);
      activeVideo.subtitleText = srtText;
      if (!activeVideo.subtitleName) {
        activeVideo.subtitleName = 'subtitles.srt';
      }

      try {
        const dbVideos = await getVideosFromDB();
        const existing = dbVideos.find(v => v.id === activeVideo.id);
        if (existing) {
          existing.subtitleText = srtText;
          existing.subtitleName = activeVideo.subtitleName;
          await saveVideoToDB(existing);
        }
      } catch (e) {
        console.error('Error saving cues change to IndexedDB:', e);
      }
    }
  };

  const handleSubtitlesUploaded = async (text: string, filename: string) => {
    const parsed = parseSubtitles(text);
    setCues(parsed);

    if (activeVideo) {
      activeVideo.subtitleText = text;
      activeVideo.subtitleName = filename;

      try {
        const dbVideos = await getVideosFromDB();
        const existing = dbVideos.find(v => v.id === activeVideo.id);
        if (existing) {
          existing.subtitleText = text;
          existing.subtitleName = filename;
          await saveVideoToDB(existing);
        }
      } catch (e) {
        console.error('Error saving uploaded subtitles to IndexedDB:', e);
      }
    }
  };

  const handleAddMultipleLocalFiles = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.wmv', '.m4v', '.ts', '.3gp', '.ogv'];
    const videoFiles: File[] = [];
    const subtitleFilesMap = new Map<string, File>();

    for (const f of filesArray) {
      const lower = f.name.toLowerCase();
      const ext = f.name.includes('.') ? f.name.substring(f.name.lastIndexOf('.')).toLowerCase() : '';
      if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
        const base = f.name.replace(/\.[^/.]+$/, "").toLowerCase().trim();
        subtitleFilesMap.set(base, f);
      } else if (videoExtensions.includes(ext) || f.type.startsWith('video/')) {
        videoFiles.push(f);
      }
    }

    if (videoFiles.length === 0) return;

    // Process all video items instantly
    const newVidItems: VideoItem[] = [];

    for (let i = 0; i < videoFiles.length; i++) {
      const file = videoFiles[i];
      const objectUrl = createTrackedObjectURL(file);
      const id = `local-file-${Date.now()}-${i}-${Math.floor(Math.random()*1000)}`;
      const baseTitle = file.name.replace(/\.[^/.]+$/, "");
      const normTitle = baseTitle.toLowerCase().trim();

      let subText: string | undefined = undefined;
      let subName: string | undefined = undefined;

      // Auto-match subtitle file if present in the same folder / selection
      if (subtitleFilesMap.has(normTitle)) {
        try {
          const subFile = subtitleFilesMap.get(normTitle)!;
          subText = await subFile.text();
          subName = subFile.name;
        } catch (e) {
          console.warn('Could not read matched subtitle file:', e);
        }
      }

      newVidItems.push({
        id,
        title: baseTitle,
        url: objectUrl,
        file: file,
        duration: 0,
        addedAt: Date.now() + i,
        category: 'Uploaded File',
        subtitleText: subText,
        subtitleName: subName
      });
    }

    // Single instant React state update
    setVideos(prev => [...newVidItems, ...prev]);

    const firstVid = newVidItems[0];
    setActiveVideo(firstVid);
    await checkAndAutoLoadSubtitles(firstVid);
    await saveAppState('active_video_id', firstVid.id);

    // Non-blocking background persistence to IndexedDB — chunked to avoid blocking
    const saveChunked = async (items: VideoItem[]) => {
      const CHUNK = 5;
      for (let i = 0; i < items.length; i += CHUNK) {
        const batch = items.slice(i, i + CHUNK);
        await Promise.all(batch.map(vid =>
          saveVideoToDB({
            id: vid.id,
            title: vid.title,
            fileBlob: vid.file,
            addedAt: vid.addedAt,
            category: 'Uploaded File',
            subtitleText: vid.subtitleText,
            subtitleName: vid.subtitleName
          }).catch(e => console.error('Background IndexedDB save error:', e))
        ));
        // Yield to browser between chunks
        await new Promise(r => setTimeout(r, 50));
      }
    };
    setTimeout(() => saveChunked(newVidItems), 100);
  };

  const handleAddLocalVideo = async (file: File) => {
    await handleAddMultipleLocalFiles([file]);
  };

  const handleAddRemoteUrl = async (title: string, url: string, category: string) => {
    const id = `remote-${Date.now()}`;
    const poster = getVideoPoster(url);
    const newVid: VideoItem = {
      id,
      title,
      url,
      duration: 0,
      addedAt: Date.now(),
      category: category || 'Streaming Links',
      poster
    };

    try {
      await saveVideoToDB({
        id,
        title,
        url,
        addedAt: newVid.addedAt,
        category: newVid.category || 'Streaming Links'
      });
    } catch (e) {
      console.error('Error saving remote link with IndexedDB:', e);
    }

    const updated = [newVid, ...videos];
    setVideos(updated);
    setActiveVideo(newVid);
    await checkAndAutoLoadSubtitles(newVid);
    await saveAppState('active_video_id', id);
  };

  const handleSelectVideo = useCallback(async (video: VideoItem) => {
    setActiveVideo(video);
    await checkAndAutoLoadSubtitles(video);
    await saveAppState('active_video_id', video.id);
  }, [checkAndAutoLoadSubtitles]);

  const handleDeleteVideo = useCallback(async (id: string) => {
    try {
      await deleteVideoFromDB(id);
    } catch (e) {
      console.error('Error deleting video from DB:', e);
    }

    const updated = videos.filter(v => v.id !== id);
    const deletedVideo = videos.find(v => v.id === id);
    if (deletedVideo && deletedVideo.url.startsWith('blob:')) {
      URL.revokeObjectURL(deletedVideo.url);
    }

    setVideos(updated);
    
    // If we delete the currently playing movie, switch to another
    if (activeVideo?.id === id) {
      const nextActive = updated[0] || null;
      setActiveVideo(nextActive);
      await checkAndAutoLoadSubtitles(nextActive);
      await saveAppState('active_video_id', nextActive?.id || '');
    }
  }, [videos, activeVideo, checkAndAutoLoadSubtitles]);

  // PlaylistItem operations
  const handleAddPlaylist = useCallback((name: string) => {
    const newPl: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      videoIds: [],
      createdAt: Date.now()
    };
    setPlaylists(prev => {
      const updated = [...prev, newPl];
      localStorage.setItem('power_player_playlists', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleDeletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== id);
      localStorage.setItem('power_player_playlists', JSON.stringify(updated));
      return updated;
    });
    setActivePlaylistId(prev => (prev === id ? null : prev));
  }, []);

  const handleAddVideoToPlaylist = useCallback((playlistId: string, videoId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id === playlistId && !p.videoIds.includes(videoId)) {
          return { ...p, videoIds: [...p.videoIds, videoId] };
        }
        return p;
      });
      localStorage.setItem('power_player_playlists', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleRemoveVideoFromPlaylist = useCallback((playlistId: string, videoId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id === playlistId) {
          return { ...p, videoIds: p.videoIds.filter(id => id !== videoId) };
        }
        return p;
      });
      localStorage.setItem('power_player_playlists', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Bookmark operations
  const handleAddBookmark = useCallback((videoId: string, time: number, note: string) => {
    const newBookmark: Bookmark = {
      id: `bookmark-${Date.now()}`,
      videoId,
      time,
      note,
      createdAt: Date.now()
    };
    setBookmarks(prev => {
      const updated = [...prev, newBookmark];
      localStorage.setItem('power_player_bookmarks', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleRemoveBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const updated = prev.filter(b => b.id !== id);
      localStorage.setItem('power_player_bookmarks', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Seek current playing movie
  const handleSeekVideo = useCallback((time: number) => {
    if (userVideoRef.current) {
      userVideoRef.current.currentTime = time;
    }
  }, []);

  // Drag and drop files events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Check if ONLY subtitle files were dropped on an active video
    const allSubtitles = Array.from(files).every((f: File) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.srt') || name.endsWith('.vtt');
    });

    if (allSubtitles && files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const parsed = parseSubtitles(content);
        setCues(parsed);
        setActiveTab('subtitles'); // auto navigate to subtitle panel

        if (activeVideo) {
          activeVideo.subtitleText = content;
          activeVideo.subtitleName = file.name;

          try {
            const dbVideos = await getVideosFromDB();
            const existing = dbVideos.find(v => v.id === activeVideo.id);
            if (existing) {
              existing.subtitleText = content;
              existing.subtitleName = file.name;
              await saveVideoToDB(existing);
            }
          } catch (e) {
            console.error('Error saving dropped subtitles to IndexedDB:', e);
          }
        }
      };
      reader.readAsText(file);
    } else {
      // Process batch video files or dropped folders containing videos & matching subtitles
      handleAddMultipleLocalFiles(files);
      setActiveTab('catalogue');
    }
  };

  // Handles Sequential Playlist auto playing
  const playNextInQueue = useCallback(async () => {
    if (!activeVideo) return;
    
    // Build active queue based on catalog filters or active playlist content
    let queue = videos;
    if (activePlaylistId) {
      const activePl = playlists.find(p => p.id === activePlaylistId);
      if (activePl) {
        queue = videos.filter(v => activePl.videoIds.includes(v.id));
      }
    }

    const currentIndex = queue.findIndex(v => v.id === activeVideo.id);
    let nextVid: VideoItem | null = null;
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      nextVid = queue[currentIndex + 1];
    } else if (queue.length > 0) {
      nextVid = queue[0];
    }

    if (nextVid) {
      setActiveVideo(nextVid);
      await checkAndAutoLoadSubtitles(nextVid);
      await saveAppState('active_video_id', nextVid.id);
    }
  }, [activeVideo, videos, activePlaylistId, playlists, checkAndAutoLoadSubtitles]);

  const playPrevInQueue = useCallback(async () => {
    if (!activeVideo) return;
    
    let queue = videos;
    if (activePlaylistId) {
      const activePl = playlists.find(p => p.id === activePlaylistId);
      if (activePl) {
        queue = videos.filter(v => activePl.videoIds.includes(v.id));
      }
    }

    const currentIndex = queue.findIndex(v => v.id === activeVideo.id);
    let prevVid: VideoItem | null = null;
    if (currentIndex > 0) {
      prevVid = queue[currentIndex - 1];
    } else if (queue.length > 0) {
      prevVid = queue[queue.length - 1];
    }

    if (prevVid) {
      setActiveVideo(prevVid);
      await checkAndAutoLoadSubtitles(prevVid);
      await saveAppState('active_video_id', prevVid.id);
    }
  }, [activeVideo, videos, activePlaylistId, playlists, checkAndAutoLoadSubtitles]);

  // If a video hits custom end trigger, auto play next
  useEffect(() => {
    if (userVideoRef.current) {
      const handleEnded = () => {
        playNextInQueue();
      };
      
      const vNode = userVideoRef.current;
      vNode.addEventListener('ended', handleEnded);
      return () => {
        vNode.removeEventListener('ended', handleEnded);
      };
    }
  }, [playNextInQueue]);

  return (
    <div
      id="root-workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-[#050505] text-gray-100 overflow-hidden font-sans relative select-none"
    >
      {/* DRAG AND DROP HIGH OVERLAY INDICATOR */}
      {isDragging && (
        <div id="drag-overlay" className="absolute inset-0 bg-yellow-400/10 backdrop-blur-md border-[3px] border-dashed border-yellow-400 z-50 flex flex-col items-center justify-center animate-fade-in pointer-events-none">
          <div className="bg-black/95 p-5 rounded-2xl border border-yellow-400 max-w-xs text-center shadow-2xl flex flex-col items-center gap-2.5">
            <span className="p-2.5 bg-yellow-400/15 rounded-full text-yellow-400 animate-bounce">
              <HardDriveDownload size={28} />
            </span>
            <h3 className="text-yellow-400 font-bold text-sm tracking-wider uppercase">Mount Media</h3>
            <p className="text-xs text-white/80 font-medium">
              Drop your video files (MP4, MKV, WebM) or subtitles (SRT, VTT) here.
            </p>
          </div>
        </div>
      )}

      {/* TOP DECORATIVE WORKSPACE GLASS HEADER */}
      <header id="app-workspace-header" className="h-14 px-6 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-gradient-to-tr from-yellow-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-0.5"></div>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tighter uppercase italic text-white flex items-center gap-2">
              Nova Player <span className="text-yellow-400">Pro</span>
            </span>
          </div>
        </div>

        {/* Authentic, high-visibility real-time media & audio indicators */}
        <div className="hidden sm:flex items-center space-x-3 text-xs font-mono">
          {activeVideo ? (
            <>
              <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-md text-emerald-400 font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>Audio DSP Active</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-md text-white font-semibold shadow-sm">
                <span className="text-yellow-400 font-bold">{audioTracks.length} Audio</span>
                <span className="text-white/40">•</span>
                <span className="text-yellow-400 font-bold">{subtitleTracks.length} Subs</span>
              </div>
              <div className="hidden md:flex items-center bg-white/10 border border-white/20 px-3 py-1 rounded-md text-white font-semibold">
                <span>{activeVideo.file ? 'Local Media' : activeVideo.url.includes('.m3u8') ? 'HLS Live' : 'Web Stream'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-md text-emerald-400 font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>Player Engine Ready</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1 rounded-md text-white font-semibold shadow-sm">
                <span className="text-yellow-400 font-bold">{videos.length}</span>
                <span>Videos in Library</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* TWO-PANEL CINEMA DESK GRID */}
      <main id="cinema-desk-grid" className="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden bg-black/25">
        
        {/* LEFT / MAIN CELL: DEEP CONSOLE VIDEO MAIN SCREEN */}
        <section id="cinema-screens-main-cell" className="flex-1 min-w-0 bg-black flex items-center justify-center relative border-r border-white/10 h-[38vh] sm:h-[42vh] lg:h-full">
          <ErrorBoundary fallbackTitle="Cinema Player Engine Exception">
            <VideoPlayer
              userVideoRef={userVideoRef}
              activeVideo={activeVideo}
              cues={cues}
              audioTracks={audioTracks}
              activeAudioTrackId={activeAudioTrackId}
              onSelectAudioTrack={handleSelectAudioTrack}
              subtitleTracks={subtitleTracks}
              activeSubtitleTrackId={activeSubtitleTrackId}
              onSelectSubtitleTrack={handleSelectSubtitleTrack}
              bookmarks={bookmarks}
              onAddBookmark={handleAddBookmark}
              onRemoveBookmark={handleRemoveBookmark}
              onNextVideo={playNextInQueue}
              onPrevVideo={playPrevInQueue}
              subtitleSize={subtitleSize}
              subtitleDelay={subtitleDelay}
              setSubtitleDelay={setSubtitleDelay}
              subtitlePosition={subtitlePosition}
              audioDelay={audioDelay}
              setAudioDelay={setAudioDelay}
              volumeBoost={volumeBoost}
              setVolumeBoost={setVolumeBoost}
              activePreset={activePreset}
              setActivePreset={setActivePreset}
              dialogueBoost={dialogueBoost}
              setDialogueBoost={setDialogueBoost}
              brightness={brightness}
              setBrightness={setBrightness}
              contrast={contrast}
              setContrast={setContrast}
              saturation={saturation}
              setSaturation={setSaturation}
              playbackSpeed={playbackSpeed}
              setPlaybackSpeed={setPlaybackSpeed}
            />
          </ErrorBoundary>
        </section>

        {/* RIGHT / COMMAND SIDEBAR WORKSPACE DECK */}
        <section 
          id="sidebar-commands-dock" 
          className={`w-full ${
            sidebarWidth === 'wide' ? 'sidebar-dock-wide' : 'sidebar-dock-normal'
          } bg-black/25 flex flex-col border-t lg:border-t-0 border-white/10 flex-1 lg:flex-none lg:h-full transition-[width,min-width,max-width,flex] duration-200 overflow-hidden`}
        >
          
          {/* TAB SELECTION STRIP */}
          <nav id="sidebar-tab-strip" className="flex bg-black/40 border-b border-white/10 flex-shrink-0 text-xs">
            <button
              id="tab-selector-catalogue"
              onClick={() => setActiveTab('catalogue')}
              className={`flex-1 py-3 text-center uppercase tracking-wider font-bold transition border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'catalogue'
                  ? 'border-yellow-400 text-yellow-400 bg-white/5'
                  : 'border-transparent text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <Film size={14} />
              Catalogue ({videos.length})
            </button>
            <button
              id="tab-selector-subtitles"
              onClick={() => setActiveTab('subtitles')}
              className={`flex-1 py-3 text-center uppercase tracking-wider font-bold transition border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'subtitles'
                  ? 'border-yellow-400 text-yellow-400 bg-white/5'
                  : 'border-transparent text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <Subtitles size={14} />
              Yellow Subs ({cues.length})
            </button>
            <button
              id="tab-selector-bookmarks"
              onClick={() => setActiveTab('bookmarks')}
              className={`flex-1 py-3 text-center uppercase tracking-wider font-bold transition border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'bookmarks'
                  ? 'border-yellow-400 text-yellow-400 bg-white/5'
                  : 'border-transparent text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <BookmarkIcon size={14} />
              Scenes ({bookmarks.filter(b => b.videoId === activeVideo?.id).length})
            </button>
            <button
              id="sidebar-width-toggle-btn"
              onClick={() => setSidebarWidth(prev => prev === 'normal' ? 'wide' : 'normal')}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-2 transition border-l border-white/10 font-mono text-[11px] font-bold ${
                sidebarWidth === 'wide'
                  ? 'bg-yellow-400/20 text-yellow-400 border-b-2 border-b-yellow-400'
                  : 'text-white/70 hover:text-yellow-400 hover:bg-white/10'
              }`}
              title={sidebarWidth === 'wide' ? 'Compact sidebar width (440px)' : 'Expand sidebar width (660px)'}
            >
              {sidebarWidth === 'wide' ? (
                <>
                  <Minimize2 size={13} />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <Maximize2 size={13} />
                  <span>Expand</span>
                </>
              )}
            </button>
          </nav>

          {/* SIDEBAR VIEWPORTS INJECTORS */}
          <div className="flex-1 overflow-hidden bg-black/20">
            <ErrorBoundary fallbackTitle="Sidebar Workspace Exception">
              {activeTab === 'catalogue' && (
                <CatalogueList
                  videos={videos}
                  playlists={playlists}
                  activeVideo={activeVideo}
                  onSelectVideo={handleSelectVideo}
                  onAddLocalVideo={handleAddMultipleLocalFiles}
                  onAddRemoteUrl={handleAddRemoteUrl}
                  onAddPlaylist={handleAddPlaylist}
                  onAddVideoToPlaylist={handleAddVideoToPlaylist}
                  onRemoveVideoFromPlaylist={handleRemoveVideoFromPlaylist}
                  onDeletePlaylist={handleDeletePlaylist}
                  onDeleteVideo={handleDeleteVideo}
                  activePlaylistId={activePlaylistId}
                  setActivePlaylistId={setActivePlaylistId}
                />
              )}

              {activeTab === 'subtitles' && (
                <SubtitleManager
                  activeVideo={activeVideo}
                  cues={cues}
                  setCues={handleCuesChange}
                  onSubtitlesUploaded={handleSubtitlesUploaded}
                  subtitleTracks={subtitleTracks}
                  activeSubtitleTrackId={activeSubtitleTrackId}
                  onSelectSubtitleTrack={handleSelectSubtitleTrack}
                  subtitleDelay={subtitleDelay}
                  setSubtitleDelay={setSubtitleDelay}
                  subtitleSize={subtitleSize}
                  setSubtitleSize={setSubtitleSize}
                  subtitlePosition={subtitlePosition}
                  setSubtitlePosition={setSubtitlePosition}
                  onSeek={handleSeekVideo}
                  videoRef={userVideoRef}
                />
              )}

              {activeTab === 'bookmarks' && (
                <BookmarksTab
                  activeVideo={activeVideo}
                  bookmarks={bookmarks}
                  onRemoveBookmark={handleRemoveBookmark}
                  onSeek={handleSeekVideo}
                />
              )}
            </ErrorBoundary>
          </div>
        </section>

      </main>
    </div>
  );
}
