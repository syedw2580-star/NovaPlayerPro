import React, { useState, useRef } from 'react';
import { VideoItem, Playlist } from '../types';
import { Search, Film, Plus, Play, Music, Trash2, ListMusic, PlusCircle, Check, HelpCircle } from 'lucide-react';

interface CatalogueListProps {
  videos: VideoItem[];
  playlists: Playlist[];
  activeVideo: VideoItem | null;
  onSelectVideo: (video: VideoItem) => void;
  onAddLocalVideo: (files: FileList | File[]) => void;
  onAddRemoteUrl: (title: string, url: string, category: string) => void;
  onAddPlaylist: (name: string) => void;
  onAddVideoToPlaylist: (playlistId: string, videoId: string) => void;
  onRemoveVideoFromPlaylist: (playlistId: string, videoId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onDeleteVideo: (videoId: string) => void;
  activePlaylistId: string | null;
  setActivePlaylistId: (id: string | null) => void;
}

function CatalogueList({
  videos,
  playlists,
  activeVideo,
  onSelectVideo,
  onAddLocalVideo,
  onAddRemoteUrl,
  onAddPlaylist,
  onAddVideoToPlaylist,
  onRemoveVideoFromPlaylist,
  onDeletePlaylist,
  onDeleteVideo,
  activePlaylistId,
  setActivePlaylistId,
}: CatalogueListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Modals / Dropdowns / Inputs states
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('My Uploads');

  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const [addingToPlaylistVideoId, setAddingToPlaylistVideoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter video list based on search and category
  const categories = ['All', ...Array.from(new Set(videos.map(v => v.category || 'Other')))];

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const displayedVideos = videos.filter(v => {
    // Playlist filter
    if (activePlaylistId && activePlaylist) {
      if (!activePlaylist.videoIds.includes(v.id)) return false;
    }
    // Category filter
    if (selectedCategory !== 'All' && v.category !== selectedCategory) return false;
    // Search query filter
    return v.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onAddLocalVideo(files);
    // Reset so the same file(s) can be re-selected if needed
    e.target.value = '';
  };

  const submitRemoteUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    onAddRemoteUrl(newTitle.trim(), newUrl.trim(), newCategory.trim());
    setNewTitle('');
    setNewUrl('');
    setShowAddUrl(false);
  };

  const submitPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    onAddPlaylist(playlistName.trim());
    setPlaylistName('');
    setShowAddPlaylist(false);
  };

  return (
    <div id="catalogue-and-playlists-workspace" className="flex flex-col h-full text-white/70 bg-transparent">
      
      {/* Upload controls, quick buttons */}
      <div className="p-4 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
            Media Library
          </h3>
          <div className="flex gap-2">
            <button
              id="add-url-modal-toggle-btn"
              onClick={() => setShowAddUrl(!showAddUrl)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-medium hover:bg-white/10 text-white transition"
            >
              Add Video URL
            </button>
            <button
              id="local-media-uploader-btn"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-yellow-400 text-black rounded text-xs font-bold hover:bg-yellow-300 transition flex items-center gap-1"
            >
              <Plus size={13} />
              + Add Video File
            </button>
          </div>
          <input
            id="hidden-local-video-input"
            type="file"
            ref={fileInputRef}
            onChange={handleLocalUpload}
            accept=".mp4,.mkv,.webm,.avi,.mov,.flv,.wmv,.m4v,.ts,.3gp,.ogv,.srt,.vtt"
            multiple
            className="hidden"
          />
        </div>

        {/* Add video URL panel */}
        {showAddUrl && (
          <form id="add-video-url-form" onSubmit={submitRemoteUrl} className="p-3 bg-black/90 border border-white/10 rounded space-y-2 text-xs">
            <div className="flex justify-between items-center pb-1">
              <span className="font-bold text-white/60 uppercase tracking-wider text-[10px]">Stream Remote / Live URL</span>
              <span className="text-[9px] font-mono text-yellow-400">HLS .m3u8 & MP4</span>
            </div>
            <div className="space-y-1.5">
              <input
                id="external-video-title-input"
                type="text"
                placeholder="Stream / Video Title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded p-1.5 focus:outline-none focus:border-yellow-400 text-xs font-mono"
                required
              />
              <input
                id="external-video-url-input"
                type="url"
                placeholder="Live stream URL (https://... .m3u8, .mp4, .webm)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded p-1.5 focus:outline-none focus:border-yellow-400 text-xs font-mono"
                required
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[9px] text-white/40 font-mono">Quick Live Test:</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewTitle('Big Buck Bunny (Live HLS Stream)');
                    setNewUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
                    setNewCategory('Live Streams');
                  }}
                  className="px-1.5 py-0.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded text-[9.5px] font-mono transition"
                >
                  📡 HLS Test Stream
                </button>
              </div>
              <input
                id="external-video-category-input"
                type="text"
                placeholder="Category tag (e.g. Live Streams, Movies)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded p-1.5 focus:outline-none focus:border-yellow-400 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddUrl(false)}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-yellow-400 text-black font-bold rounded hover:bg-yellow-300 text-xs"
              >
                Stream Now
              </button>
            </div>
          </form>
        )}

        {/* Playlists and Catalog selection */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Filter Source / Playlists</span>
            <button
              id="show-add-playlist-modal-btn"
              onClick={() => setShowAddPlaylist(!showAddPlaylist)}
              className="text-[10px] text-yellow-400 hover:text-yellow-300 font-bold uppercase tracking-wider flex items-center gap-0.5 transition"
            >
              <PlusCircle size={10} />
              New Playlist
            </button>
          </div>

          {showAddPlaylist && (
            <form id="create-playlist-form" onSubmit={submitPlaylist} className="p-3 bg-black/90 border border-white/10 rounded space-y-2 text-xs">
              <input
                id="playlist-name-input"
                type="text"
                placeholder="Playlist name..."
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded p-1.5 focus:outline-none focus:border-yellow-400"
                required
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPlaylist(false)}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-yellow-400 text-black font-bold rounded hover:bg-yellow-300 text-xs"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          {/* Source Tabs (Master Catalog / Playlists list picker) */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              id="show-all-videos-tab"
              onClick={() => setActivePlaylistId(null)}
              className={`px-3 py-1 rounded border transition whitespace-nowrap font-medium text-[11px] ${
                activePlaylistId === null
                  ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400'
                  : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60 hover:text-white'
              }`}
            >
              All Library
            </button>
            {playlists.map((pl) => (
              <div key={pl.id} className="flex gap-0.5 items-center bg-white/5 rounded border border-white/15 pr-1 hover:border-white/30 transition">
                <button
                  onClick={() => setActivePlaylistId(pl.id)}
                  className={`px-2.5 py-1 text-[11px] transition whitespace-nowrap font-semibold ${
                    activePlaylistId === pl.id
                      ? 'text-yellow-400 font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  📁 {pl.name} ({pl.videoIds.length})
                </button>
                <button
                  onClick={() => onDeletePlaylist(pl.id)}
                  className="text-white/40 hover:text-red-400 transition p-0.5 rounded-full"
                  title="Delete playlist"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Searching and Categorization */}
        <div className="flex gap-2">
          {/* Lookup Input */}
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-2.5 text-white/40" />
            <input
              id="library-search-input"
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 pl-8 pr-3 py-1.5 border border-white/10 rounded text-xs placeholder-white/20 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 text-white"
            />
          </div>

          {/* Category Filter */}
          <select
            id="category-filter-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white/5 border border-white/10 px-2 py-1.5 rounded text-xs font-mono text-white/60 hover:text-white focus:outline-none"
          >
            {categories.map(cat => (
              <option key={cat} value={cat} className="bg-black text-white">{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Video Content list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest block">
          Matching Media ({displayedVideos.length})
        </span>

        {displayedVideos.length === 0 ? (
          <div className="text-center py-10 text-white/40 space-y-2">
            <Film size={24} className="mx-auto text-white/10" />
            <p className="text-xs">No matching videos in library filter.</p>
            <p className="text-[10px] text-white/30">Drag files here, or link external direct MP4 clips.</p>
          </div>
        ) : (
          <div className="space-y-1" id="catalog-videos-grid">
            {displayedVideos.map((video) => {
              const isPlaying = activeVideo?.id === video.id;
              const isCustomFile = !!video.file;
              
              return (
                <div
                  key={video.id}
                  className={`group relative flex gap-3 p-2 border-r transition ${
                    isPlaying
                      ? 'bg-yellow-400/10 border-l-2 border-yellow-400 rounded-r'
                      : 'hover:bg-white/5 border border-transparent rounded'
                  }`}
                >
                  {/* Poster/Thumbnail Area */}
                  <div
                    onClick={() => onSelectVideo(video)}
                    className="w-12 h-12 bg-black/40 rounded border border-white/10 overflow-hidden relative flex-shrink-0 cursor-pointer flex items-center justify-center group-hover:opacity-95"
                  >
                    {video.poster ? (
                      <img src={video.poster} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Film size={14} className="text-white/30" />
                    )}
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play size={14} className="text-white fill-white" />
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="flex-1 min-w-0 pr-10">
                    <button
                      onClick={() => onSelectVideo(video)}
                      className={`block font-bold text-xs text-left w-full truncate cursor-pointer transition ${
                        isPlaying ? 'text-white' : 'text-white/80 hover:text-white'
                      }`}
                      title={video.title}
                    >
                      {video.title}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/40 font-medium">
                      <span className="bg-white/5 text-white/60 px-1 py-0.2 rounded font-mono">
                        {video.category || 'Standard'}
                      </span>
                      <span>•</span>
                      <span>
                        {video.duration ? `${Math.floor(video.duration / 60)}m ${Math.floor(video.duration % 60)}s` : 'Stream'}
                      </span>
                      {isCustomFile && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">Local</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="absolute right-2 top-2.5 flex items-center gap-1 text-white/30">
                    {/* Add to playlist controls */}
                    <div className="relative">
                      {addingToPlaylistVideoId === video.id ? (
                        <div className="absolute right-0 top-0 bg-black/95 border border-white/10 rounded p-2.5 shadow-2xl z-20 min-w-[140px] space-y-1.5 text-xs text-white">
                          <span className="block font-bold pb-1 text-white/60">Target Playlist:</span>
                          {playlists.length === 0 ? (
                            <span className="block text-[11px] text-white/40">Create a playlist first.</span>
                          ) : (
                            playlists.map((pl) => {
                              const alreadyIn = pl.videoIds.includes(video.id);
                              return (
                                <button
                                  key={pl.id}
                                  onClick={() => {
                                    if (alreadyIn) {
                                      onRemoveVideoFromPlaylist(pl.id, video.id);
                                    } else {
                                      onAddVideoToPlaylist(pl.id, video.id);
                                    }
                                    setAddingToPlaylistVideoId(null);
                                  }}
                                  className="w-full text-left p-1 rounded hover:bg-white/5 flex items-center justify-between text-[11px]"
                                >
                                  <span>{pl.name}</span>
                                  {alreadyIn ? <Check size={11} className="text-emerald-400" /> : <Plus size={11} className="text-white/40" />}
                                </button>
                              );
                            })
                          )}
                          <button
                            onClick={() => setAddingToPlaylistVideoId(null)}
                            className="w-full text-center py-0.5 bg-white/5 border border-white/10 text-[10px] rounded mt-1.5 hover:bg-white/10 font-bold"
                          >
                            Close
                          </button>
                        </div>
                      ) : null}
                      <button
                        onClick={() => setAddingToPlaylistVideoId(video.id)}
                        className="hover:text-yellow-400 p-1 rounded transition"
                        title="Add to a playlist"
                      >
                        <ListMusic size={13} />
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteVideo(video.id)}
                      className="hover:text-red-400 p-1 rounded transition"
                      title="Remove from Library"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(CatalogueList);
