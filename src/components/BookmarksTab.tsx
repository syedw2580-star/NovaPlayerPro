import React from 'react';
import { Bookmark, VideoItem } from '../types';
import { Bookmark as BookmarkIcon, Clock, Trash2, Keyboard, Play, Sparkles } from 'lucide-react';

interface BookmarksTabProps {
  activeVideo: VideoItem | null;
  bookmarks: Bookmark[];
  onRemoveBookmark: (id: string) => void;
  onSeek: (time: number) => void;
}

function BookmarksTab({
  activeVideo,
  bookmarks,
  onRemoveBookmark,
  onSeek
}: BookmarksTabProps) {
  const activeVideoBookmarks = bookmarks.filter(b => b.videoId === activeVideo?.id);

  // Time formatter helper: MM:SS
  const formatSeconds = (sec: number) => {
    if (isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const shortcuts = [
    { key: "Shift + ← / →", action: "Seek back/forward 60s (1 min)" },
    { key: "Shift + J / L", action: "🔊 Audio Delay Offset (-0.1s / +0.1s)" },
    { key: "Shift + U", action: "Reset Audio Sync Offset to 0.0s" },
    { key: "Arrow Left/Right", action: "Seek back/forward 5s" },
    { key: "V", action: "⚡ Smart Audio Booster (300%)" },
    { key: "Arrow Up/Down", action: "Adjust volume (0% - 300%)" },
    { key: "Space / K", action: "Play / Pause video" },
    { key: "F", action: "Toggle Fullscreen mode" },
    { key: "M", action: "Mute / Unmute instantly" },
    { key: "A", action: "Mark looping range START (A)" },
    { key: "B", action: "Mark looping range END (B)" },
    { key: "C", action: "Clear looping markers" }
  ];

  return (
    <div id="bookmarks-tab-root" className="flex flex-col h-full text-white/70 bg-transparent">
      {/* Tab Header banner */}
      <div className="p-4 border-b border-white/10 bg-black/40 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
        <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
          Bookmarks & Controls
        </h3>
        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
          HOTKEYS ACTIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Bookmarks Section */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-white/80">
            <BookmarkIcon size={13} className="text-yellow-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Saved Scenes ({activeVideoBookmarks.length})
            </span>
          </div>

          {activeVideoBookmarks.length === 0 ? (
            <div className="bg-white/5 p-4 rounded border border-white/10 text-center text-white/60 text-xs shadow-inner">
              <p className="font-medium">No bookmarked scenes for this video.</p>
              <p className="text-[10px] mt-1 text-white/40">Tap the Bookmark flag on the player controls to pin current timestamp with note.</p>
            </div>
          ) : (
            <div className="space-y-1" id="saved-bookmarks-container">
              {activeVideoBookmarks.map((bk) => (
                <div 
                  key={bk.id}
                  className="flex items-center justify-between p-2.5 border border-white/5 rounded hover:bg-white/5 transition text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <button
                      onClick={() => onSeek(bk.time)}
                      className="flex items-center gap-1 font-mono text-[10px] bg-yellow-400/10 border border-yellow-400 text-yellow-500 px-1.5 py-0.5 rounded font-bold hover:bg-yellow-400 hover:text-black transition flex-shrink-0"
                    >
                      <Clock size={10} className="text-yellow-500" />
                      <span>{formatSeconds(bk.time)}</span>
                    </button>
                    <span 
                      onClick={() => onSeek(bk.time)}
                      className="text-white hover:text-yellow-400 font-bold truncate cursor-pointer transition"
                      title={bk.note}
                    >
                      {bk.note}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveBookmark(bk.id)}
                    className="text-white/30 hover:text-red-400 transition opacity-80 hover:opacity-100 p-1"
                    title="Delete bookmark"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Keyboard Shortcuts cheat sheet card */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-white/80">
            <Keyboard size={13} className="text-yellow-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Keyboard Pro-Shortcuts
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded border border-white/10 space-y-2 text-xs">
            <div className="grid grid-cols-12 gap-y-2 pb-1 text-[9px] border-b border-white/10 font-bold uppercase tracking-wider text-white/80 font-mono">
              <span className="col-span-5">Hot Key</span>
              <span className="col-span-7">Action outcome</span>
            </div>
            
            {shortcuts.map((sc, i) => (
              <div key={i} className="grid grid-cols-12 items-center text-[11px] py-1">
                <span className="col-span-5 font-mono text-yellow-450 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit text-[10px]">
                  {sc.key}
                </span>
                <span className="col-span-7 text-white/90 font-medium">
                  {sc.action}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom video-player pro tip */}
        <div className="bg-yellow-400/5 border border-yellow-400/20 p-3 rounded space-y-1.5 text-[11px] text-white/50">
          <span className="font-bold text-yellow-400 flex items-center gap-1 uppercase tracking-widest text-[9px]">
            <Sparkles size={11} />
            Feature-Rich Design Tip
          </span>
          <p className="leading-relaxed">
            Unleash 300% Smart Audio Boosting: Turn on Smart Booster (⚡) or press 'V' to activate the dynamic range compressor and Math.tanh soft-clipping limiter. Adjust volume up to 300% without distortion or crackle — perfect for quiet files!
          </p>
        </div>

      </div>
    </div>
  );
}

export default React.memo(BookmarksTab);
