export interface MediaAudioTrack {
  id: string;
  index: number;
  label: string;
  language: string;
  channels?: number;
  codec?: string;
  bitrate?: string;
  enabled: boolean;
}

export interface MediaSubtitleTrack {
  id: string;
  index: number;
  number?: number;
  label: string;
  language: string;
  codec?: string;
  isExternal?: boolean;
  cues?: SubtitleCue[];
  srtText?: string;
  mode: 'showing' | 'disabled';
}

export interface VideoItem {
  id: string;
  title: string;
  url: string; // Object URL for local files or direct URL for remote streams
  file?: File | Blob; // Reference to local file if uploaded
  subtitleUrl?: string; // Subtitle file Object URL
  subtitleFile?: File | Blob; // Subtitle file reference
  subtitleText?: string;
  subtitleName?: string;
  audioTracks?: MediaAudioTrack[];
  subtitleTracks?: MediaSubtitleTrack[];
  duration: number; // in seconds
  addedAt: number;
  category?: string;
  poster?: string;
}

export interface Playlist {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: number;
}

export interface SubtitleCue {
  id?: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface Bookmark {
  id: string;
  videoId: string;
  time: number; // in seconds
  note: string;
  createdAt: number;
}

export interface VideoStats {
  resolution: string;
  buffered: number; // in seconds
  volumeBoost: number; // gain factor
  frameRate?: number;
  videoWidth?: number;
  videoHeight?: number;
}
