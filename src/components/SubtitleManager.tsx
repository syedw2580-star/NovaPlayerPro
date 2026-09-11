import React, { useState, useRef, useEffect } from 'react';
import { SubtitleCue, VideoItem, MediaSubtitleTrack } from '../types';
import { parseSubtitles } from '../utils/subtitleParser';
import { Upload, Plus, Trash2, Clock, Edit3, HelpCircle, Save, MessageSquare } from 'lucide-react';
import { sampleSrtSubtitles } from '../data/defaultCatalog';

interface SubtitleManagerProps {
  activeVideo: VideoItem | null;
  cues: SubtitleCue[];
  setCues: (cues: SubtitleCue[]) => void;
  onSubtitlesUploaded?: (text: string, name: string) => void;
  subtitleTracks?: MediaSubtitleTrack[];
  activeSubtitleTrackId?: string;
  onSelectSubtitleTrack?: (trackId: string) => void;
  subtitleDelay: number;
  setSubtitleDelay: (delay: number) => void;
  subtitleSize: number;
  setSubtitleSize: (size: number) => void;
  subtitlePosition: number; // in percentage from bottom (e.g. 10%)
  setSubtitlePosition: (pos: number) => void;
  onSeek: (time: number) => void;
  currentTime?: number;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

function SubtitleManager({
  activeVideo,
  cues,
  setCues,
  onSubtitlesUploaded,
  subtitleTracks = [],
  activeSubtitleTrackId = '',
  onSelectSubtitleTrack,
  subtitleDelay,
  setSubtitleDelay,
  subtitleSize,
  setSubtitleSize,
  subtitlePosition,
  setSubtitlePosition,
  onSeek,
  currentTime: propCurrentTime,
  videoRef,
}: SubtitleManagerProps) {
  const [localTime, setLocalTime] = useState<number>(propCurrentTime ?? 0);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;
    const handleTime = () => setLocalTime(video.currentTime);
    video.addEventListener('timeupdate', handleTime);
    return () => video.removeEventListener('timeupdate', handleTime);
  }, [videoRef]);

  const activeTime = propCurrentTime !== undefined ? propCurrentTime : localTime;
  const [rawText, setRawText] = useState<string>('');
  const [showRawEditor, setShowRawEditor] = useState<boolean>(false);
  
  // States for adding a new cue
  const [newStart, setNewStart] = useState<string>('00:00:00');
  const [newEnd, setNewEnd] = useState<string>('00:00:04');
  const [newText, setNewText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseSubtitles(text);
      if (onSubtitlesUploaded) {
        onSubtitlesUploaded(text, file.name);
      } else {
        setCues(parsed);
      }
      setRawText(text);
    };
    reader.readAsText(file);
  };

  const handleApplyRaw = () => {
    const parsed = parseSubtitles(rawText);
    setCues(parsed);
  };

  const handleLoadSample = () => {
    setCues(parseSubtitles(sampleSrtSubtitles));
    setRawText(sampleSrtSubtitles);
  };

  const handleAddCue = () => {
    if (!newText.trim()) return;

    const convertToSeconds = (timestr: string): number => {
      const parts = timestr.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      return Number(timestr) || 0;
    };

    const startSec = convertToSeconds(newStart);
    const endSec = convertToSeconds(newEnd);

    const newCue: SubtitleCue = {
      id: `cue-custom-${Date.now()}`,
      startTime: startSec,
      endTime: endSec,
      text: newText.trim()
    };

    const updatedCues = [...cues, newCue].sort((a, b) => a.startTime - b.startTime);
    setCues(updatedCues);
    setNewText('');
  };

  const handleDeleteCue = (id: string | undefined) => {
    if (!id) return;
    setCues(cues.filter(c => c.id !== id));
  };

  const handleEditCueText = (id: string | undefined, newStr: string) => {
    if (!id) return;
    setCues(cues.map(c => c.id === id ? { ...c, text: newStr } : c));
  };

  // Convert time to helper HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCues = searchQuery.trim()
    ? cues.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : cues;

  return (
    <div id="subtitle-manager-root" className="flex flex-col h-full text-white/70 bg-transparent min-h-0">
      {/* Upload and quick tools header (compact, non-overflowing) */}
      <div className="p-3 border-b border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-1.5">
            <MessageSquare size={13} />
            Subtitle Workspace
          </h3>
          <div className="flex gap-1.5">
            <button
              id="load-sample-sub-btn"
              onClick={handleLoadSample}
              className="px-2.5 py-1 bg-white/5 border border-white/10 rounded text-[11px] font-medium hover:bg-white/10 text-white transition"
            >
              Demo Subs
            </button>
            <button
              id="upload-sub-file-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-yellow-400 text-black rounded text-[11px] font-bold hover:bg-yellow-300 transition flex items-center gap-1 shadow"
            >
              <Upload size={12} />
              Upload SRT/VTT
            </button>
          </div>
          <input
            id="hidden-sub-file-input"
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".srt,.vtt,text/vtt"
            className="hidden"
          />
        </div>

        {/* VLC-Style Subtitle Tracks Dropdown Switcher */}
        {subtitleTracks.length > 0 && (
          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-2 space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="font-bold text-yellow-400 flex items-center gap-1">
                Media Tracks ({subtitleTracks.length} available):
              </span>
              <span className="text-white/80 text-[10px] font-mono font-semibold bg-white/10 px-1.5 py-0.5 rounded">Multi-Track</span>
            </div>

            {/* Dropdown Track Selector */}
            <div className="flex items-center gap-1.5 min-w-0 w-full">
              <select
                id="sidebar-subtitle-track-dropdown"
                value={activeSubtitleTrackId || 'off'}
                onChange={(e) => onSelectSubtitleTrack && onSelectSubtitleTrack(e.target.value)}
                className="flex-1 min-w-0 w-0 bg-black/60 border border-yellow-400/40 text-yellow-300 rounded px-2 py-1 text-xs font-mono font-semibold focus:outline-none focus:border-yellow-400 cursor-pointer truncate"
              >
                <option value="off" className="bg-zinc-900 text-red-400">🚫 Subtitles: Disabled</option>
                {subtitleTracks.map((trk) => (
                  <option key={trk.id} value={trk.id} className="bg-zinc-900 text-white">
                    {trk.label} {trk.isExternal ? '(Custom File)' : ''}
                  </option>
                ))}
              </select>

              {/* Quick Toggle Button */}
              <button
                type="button"
                onClick={() => onSelectSubtitleTrack && onSelectSubtitleTrack(activeSubtitleTrackId === 'off' ? (subtitleTracks[0]?.id || '') : 'off')}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs font-mono font-bold border transition ${
                  activeSubtitleTrackId === 'off' || cues.length === 0
                    ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                    : 'bg-yellow-400 text-black border-yellow-300 hover:bg-yellow-300'
                }`}
                title={activeSubtitleTrackId === 'off' ? 'Enable Subtitles' : 'Disable Subtitles'}
              >
                {activeSubtitleTrackId === 'off' || cues.length === 0 ? 'OFF' : 'ACTIVE'}
              </button>
            </div>
          </div>
        )}

        {/* Configurations sliders & Quick Offset Stepper */}
        <div className="bg-white/5 p-2 rounded-lg border border-white/10 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] text-white/60 font-medium font-mono">Font Size:</span>
                <span className="text-yellow-400 font-bold text-[10px] font-mono">{subtitleSize}px</span>
              </div>
              <input
                id="subtitle-size-range"
                type="range"
                min="14"
                max="40"
                value={subtitleSize}
                onChange={(e) => setSubtitleSize(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] text-white/60 font-medium font-mono">Y-Position:</span>
                <span className="text-yellow-400 font-bold text-[10px] font-mono">{subtitlePosition}%</span>
              </div>
              <input
                id="subtitle-position-range"
                type="range"
                min="2"
                max="40"
                value={subtitlePosition}
                onChange={(e) => setSubtitlePosition(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>
          </div>

          {/* Subtitle Offset Stepper (-1s, -0.1s, +0.1s, +1s, Reset) */}
          <div className="pt-1 border-t border-white/5 space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-white/60 font-bold">Sync Timing Offset:</span>
              <span className={subtitleDelay !== 0 ? "text-yellow-400 font-bold" : "text-white/40"}>
                {subtitleDelay > 0 ? `+${subtitleDelay.toFixed(1)}s` : `${subtitleDelay.toFixed(1)}s`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSubtitleDelay(Math.max(-60.0, Math.round((subtitleDelay - 1.0) * 10) / 10))}
                className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9.5px] font-mono text-white transition"
                title="Hotkey: Z or ["
              >
                -1.0s
              </button>
              <button
                type="button"
                onClick={() => setSubtitleDelay(Math.max(-60.0, Math.round((subtitleDelay - 0.1) * 10) / 10))}
                className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9.5px] font-mono text-white transition"
                title="Hotkey: Shift + ["
              >
                -0.1s
              </button>
              <input
                id="subtitle-delay-range"
                type="range"
                min="-60.0"
                max="60.0"
                step="0.1"
                value={subtitleDelay}
                onChange={(e) => setSubtitleDelay(Number(e.target.value))}
                className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400 min-w-[60px]"
                title={`Subtitle Offset: ${subtitleDelay > 0 ? `+${subtitleDelay.toFixed(1)}` : subtitleDelay.toFixed(1)}s`}
              />
              <button
                type="button"
                onClick={() => setSubtitleDelay(Math.min(60.0, Math.round((subtitleDelay + 0.1) * 10) / 10))}
                className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9.5px] font-mono text-white transition"
                title="Hotkey: Shift + ]"
              >
                +0.1s
              </button>
              <button
                type="button"
                onClick={() => setSubtitleDelay(Math.min(60.0, Math.round((subtitleDelay + 1.0) * 10) / 10))}
                className="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9.5px] font-mono text-white transition"
                title="Hotkey: X or ]"
              >
                +1.0s
              </button>
              <button
                type="button"
                onClick={() => setSubtitleDelay(0)}
                className="px-1.5 py-0.5 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded text-[9.5px] font-mono text-white/60 hover:text-white transition"
                title="Hotkey: R (Reset to 0.0s)"
              >
                0.0s
              </button>
            </div>
          </div>
        </div>

        {/* Editor switcher */}
        <div className="flex gap-2">
          <button
            id="toggle-cues-view-btn"
            onClick={() => setShowRawEditor(false)}
            className={`flex-1 py-1 text-xs rounded border transition ${
              !showRawEditor 
                ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400 font-bold' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white'
            }`}
          >
            Cues List ({cues.length})
          </button>
          <button
            id="toggle-raw-editor-btn"
            onClick={() => {
              setShowRawEditor(true);
              if (!rawText && cues.length > 0) {
                const lines = cues.map((c, idx) => `${idx + 1}\n${formatTime(c.startTime)} --> ${formatTime(c.endTime)}\n${c.text}\n`).join('\n');
                setRawText(lines);
              }
            }}
            className={`flex-1 py-1 text-xs rounded border transition ${
              showRawEditor 
                ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400 font-bold' 
                : 'bg-transparent border-transparent text-white/40 hover:text-white'
            }`}
          >
            Raw SRT Editor
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showRawEditor ? (
          <div id="raw-sub-editor" className="flex flex-col h-full min-h-[180px] space-y-2">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
              Write or paste SRT subtitles code format:
            </span>
            <textarea
              id="raw-sub-textarea"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="1&#10;00:00:01,000 --> 00:00:05,000&#10;My yellow subtitle goes here."
              className="w-full flex-1 min-h-[140px] bg-black/40 text-white font-mono text-xs p-3 rounded border border-white/10 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-y"
            />
            <button
              id="apply-raw-sub-btn"
              onClick={handleApplyRaw}
              className="py-2 bg-white/5 hover:bg-white/10 text-yellow-500 border border-white/10 text-xs font-bold rounded transition flex items-center justify-center gap-1.5"
            >
              <Save size={13} />
              Compile & Inject
            </button>
          </div>
        ) : (
          <div id="cues-list-viewer" className="space-y-3">
            {/* Quick Add Cue Row */}
            <div className="bg-white/5 p-3 rounded border border-white/10 space-y-2.5">
              <span className="text-[10px] text-yellow-400 font-bold tracking-wider uppercase block">Inject Custom Cue</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/80 uppercase font-bold tracking-wider block mb-1">Start (Seconds or S:MS)</label>
                  <input
                    id="new-sub-start"
                    type="text"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/80 uppercase font-bold tracking-wider block mb-1">End (Seconds or S:MS)</label>
                  <input
                    id="new-sub-end"
                    type="text"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
              <div className="flex gap-1.5">
                <input
                  id="new-sub-text"
                  type="text"
                  placeholder="Subtitle content text..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCue();
                  }}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white placeholder-white/20 focus:outline-none focus:border-yellow-400"
                />
                <button
                  id="add-sub-cue-btn"
                  onClick={handleAddCue}
                  className="bg-yellow-400 text-black px-2.5 rounded text-xs font-bold hover:bg-yellow-300 transition flex items-center justify-center"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

            {/* Search Filter for Cues */}
            {cues.length > 0 && (
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs">
                <span className="text-white/40 text-[10px] font-mono">🔍</span>
                <input
                  type="text"
                  placeholder={`Search ${cues.length} subtitles...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-white/25 text-xs focus:outline-none flex-1 font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-white/40 hover:text-white text-[11px]"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Cue Cards */}
            <div className="space-y-1">
              {filteredCues.length === 0 ? (
                <div className="text-center py-8 text-white/40 space-y-2">
                  <p className="text-xs">{searchQuery ? `No subtitles matching "${searchQuery}"` : 'No subtitles loaded for this video.'}</p>
                  <p className="text-[10px] text-white/30">
                    {searchQuery ? 'Try clearing your search query above.' : 'Upload an SRT, toggle the raw editor, or trigger "Load Demo Subs" above.'}
                  </p>
                </div>
              ) : (
                filteredCues.map((cue, index) => {
                  const shiftStart = cue.startTime + subtitleDelay;
                  const shiftEnd = cue.endTime + subtitleDelay;
                  const isActive = activeTime >= shiftStart && activeTime <= shiftEnd;

                  return (
                    <div
                      key={cue.id || index}
                      className={`p-2.5 border-r transition text-xs flex flex-col gap-1.5 ${
                        isActive
                          ? 'bg-yellow-400/10 border-l-2 border-yellow-400 rounded-r'
                          : 'hover:bg-white/5 border border-transparent rounded'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onSeek(shiftStart)}
                          className="flex items-center gap-1 font-mono text-[10px] text-white/60 hover:text-yellow-400 transition"
                          title="Seek to timing"
                        >
                          <Clock size={11} className="text-yellow-400/80" />
                          <span>{formatTime(shiftStart).split(',')[0]}</span>
                          <span className="text-white/20">→</span>
                          <span>{formatTime(shiftEnd).split(',')[0]}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCue(cue.id)}
                          className="text-white/30 hover:text-red-400 transition p-0.5"
                          title="Delete cue"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <input
                        type="text"
                        value={cue.text}
                        onChange={(e) => handleEditCueText(cue.id, e.target.value)}
                        className="bg-transparent text-white border-b border-transparent hover:border-white/10 focus:border-yellow-400 focus:outline-none w-full pb-0.5"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SubtitleManager);
