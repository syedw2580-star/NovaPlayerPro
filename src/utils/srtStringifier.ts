import { SubtitleCue } from '../types';

/**
 * Utility to convert raw cues array back to SRT string format
 */
export function stringifySRT(cues: SubtitleCue[]): string {
  const pad = (num: number, size: number) => num.toString().padStart(size, '0');
  
  const formatSrtTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  };

  return cues.map((cue, index) => {
    return `${index + 1}\n${formatSrtTime(cue.startTime)} --> ${formatSrtTime(cue.endTime)}\n${cue.text}`;
  }).join('\n\n');
}
