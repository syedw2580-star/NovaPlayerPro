/**
 * Utilities for extracting video stream IDs, YouTube IDs, and posters
 */

export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : null;
}

export function getVimeoVideoId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:vimeo)\.com.*(?:videos\/|video\/|channels\/|channels\/\w+\/|groups\/[^\/]*\/videos\/|(?:.*\/)?)([0-9]+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export function getVideoPoster(url: string, fallbackPoster?: string): string {
  const ytId = getYouTubeVideoId(url);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }
  return fallbackPoster || 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&auto=format&fit=crop';
}
