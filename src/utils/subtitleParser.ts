import { SubtitleCue } from '../types';

/**
 * Converts a subtitle timestamp string (HH:MM:SS.mmm or MM:SS.mmm) to seconds.
 */
function parseTimestamp(timestamp: string): number {
  const cleaned = timestamp.trim().replace(',', '.'); // Handle SRT comma decimals
  const parts = cleaned.split(':');
  
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else {
    const seconds = parseFloat(cleaned);
    return isNaN(seconds) ? 0 : seconds;
  }
}

/**
 * Parses WebVTT or SRT text content into SubtitleCue items.
 */
export function parseSubtitles(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let idCounter = 1;

  // Check if content is ASS/SSA format
  if (normalized.includes('[Events]') || normalized.includes('Dialogue:')) {
    const lines = normalized.split('\n');
    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const dialogContent = line.substring(9).trim();
        const parts = dialogContent.split(',');
        if (parts.length >= 10) {
          const startStr = parts[1];
          const endStr = parts[2];
          const textPart = parts.slice(9).join(',');
          
          const startTime = parseTimestamp(startStr);
          const endTime = parseTimestamp(endStr);
          
          const cleanText = textPart
            .replace(/\{[^}]+\}/g, '')
            .replace(/\\N/g, '\n')
            .replace(/\\n/g, '\n')
            .trim();
            
          if (cleanText && !isNaN(startTime) && !isNaN(endTime)) {
            cues.push({
              id: `cue-${idCounter++}`,
              startTime,
              endTime,
              text: cleanText
            });
          }
        }
      }
    }
    if (cues.length > 0) return cues;
  }

  // Split block by double newlines or single blocks
  const blocks = normalized.split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    
    // Find the timing line. It always contains '-->'
    let timingIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timingIndex = i;
        break;
      }
    }
    
    if (timingIndex === -1) continue;
    
    const timingLine = lines[timingIndex];
    const [startStr, endStr] = timingLine.split('-->');
    
    if (!startStr || !endStr) continue;
    
    // Strip any VTT styling settings from end timestamp, e.g. "00:01:20.000 align:middle line:90%"
    const startStrClean = startStr.trim();
    const endStrClean = endStr.trim().split(/\s+/)[0];
    
    try {
      const startTime = parseTimestamp(startStrClean);
      const endTime = parseTimestamp(endStrClean);
      
      // The text is anything after the timing line
      const textLines = lines.slice(timingIndex + 1);
      const subtitleText = textLines.join('\n');
      
      // Clean tags out if they obstruct styling, but keep simple line breaks
      const cleanText = subtitleText
        .replace(/<[^>]+>/g, '') // strip HTML/XML tags
        .trim();
        
      if (startTime !== undefined && endTime !== undefined) {
        cues.push({
          id: `cue-${idCounter++}`,
          startTime,
          endTime,
          text: cleanText
        });
      }
    } catch (e) {
      console.error('Failed to parse subtitle cue:', block, e);
    }
  }
  
  return cues;
}
