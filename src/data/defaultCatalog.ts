import { VideoItem } from '../types';

export const defaultVideos: VideoItem[] = [
  {
    id: 'sintel',
    title: 'Sintel (Blender CGI Open Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    duration: 888, // 14:48
    category: 'Animation / Fantasy',
    addedAt: Date.now() - 4000 * 3600,
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
  },
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny (Blender Comedy)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 596, // 9:56
    category: 'Animation / Comedy',
    addedAt: Date.now() - 3000 * 3600,
    poster: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&auto=format&fit=crop',
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel (Sci-Fi Trailer)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    duration: 734, // 12:14
    category: 'Sci-Fi / VFX',
    addedAt: Date.now() - 2000 * 3600,
    poster: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop',
  },
  {
    id: 'bigger-blazes',
    title: 'Chromecast Fire Demo',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 15,
    category: 'Demo Short',
    addedAt: Date.now() - 1000 * 3600,
    poster: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop',
  }
];

export const sampleSrtSubtitles = `1
00:00:01,000 --> 00:00:04,500
Welcome to Sintel! This is a custom subtitle track.

2
00:00:05,000 --> 00:00:08,000
Featuring beautiful CGI animation by the Blender Foundation.

3
00:00:09,000 --> 00:00:13,000
Our powerhouse video player renders custom high-contrast yellow text details.

4
00:00:14,000 --> 00:00:19,000
Try modifying, delay-shifting, or resizing these subtitles in the panels!

5
00:00:20,000 --> 00:00:25,000
You can also boost audio up to 200%, adjust speed, and loop sections.

6
00:00:26,000 --> 00:00:30,000
This project demonstrates browser-level Web Audio volume processing!
`;
