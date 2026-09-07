import { SubtitleCue, MediaAudioTrack, MediaSubtitleTrack } from '../types';
import { parseSubtitles } from './subtitleParser';

export interface ExtractedSubtitleResult {
  cues: SubtitleCue[];
  srtText: string;
  language: string;
  trackName: string;
}

export interface MediaTracksDiscoveryResult {
  audioTracks: MediaAudioTrack[];
  subtitleTracks: MediaSubtitleTrack[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English', en: 'English',
  hin: 'Hindi', hi: 'Hindi',
  spa: 'Spanish', es: 'Spanish',
  fre: 'French', fra: 'French', fr: 'French',
  ger: 'German', deu: 'German', de: 'German',
  ita: 'Italian', it: 'Italian',
  jpn: 'Japanese', ja: 'Japanese',
  kor: 'Korean', ko: 'Korean',
  chi: 'Chinese', zho: 'Chinese', zh: 'Chinese',
  rus: 'Russian', ru: 'Russian',
  ara: 'Arabic', ar: 'Arabic',
  por: 'Portuguese', pt: 'Portuguese',
  dan: 'Danish', da: 'Danish',
  dut: 'Dutch', nl: 'Dutch',
  nor: 'Norwegian', no: 'Norwegian',
  fin: 'Finnish', fi: 'Finnish',
  swe: 'Swedish', sv: 'Swedish',
  pol: 'Polish', pl: 'Polish',
  tur: 'Turkish', tr: 'Turkish',
  und: 'Undetermined'
};

function formatLanguage(code: string): string {
  if (!code) return 'Undetermined';
  const clean = code.toLowerCase().trim();
  return LANGUAGE_NAMES[clean] || code.toUpperCase();
}

/**
 * Clean ASS/SSA formatting and control codes from raw subtitle strings
 */
function cleanSubtitleText(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  // Strip SSA/ASS Dialogue header if present
  if (text.startsWith('Dialogue:')) {
    let commaCount = 0;
    let idx = 0;
    while (idx < text.length && commaCount < 9) {
      if (text[idx] === ',') commaCount++;
      idx++;
    }
    if (commaCount >= 9) {
      text = text.substring(idx);
    }
  }
  // Remove ASS style override tags like {\an8}, {\pos(...)}, {\i1}
  text = text.replace(/\{[^}]+\}/g, '');
  // Convert ASS line break escapes to standard newlines
  text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n');
  return text.trim();
}

/* ========================================================================= */
/*                   EBML / MATROSKA (MKV / WEBM) PARSER                     */
/* ========================================================================= */

function readVint(buffer: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  if (firstByte === 0) return null;

  let length = 1;
  let mask = 0x80;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }
  if (length > 8 || offset + length > buffer.length) return null;

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    value = (value * 256) + buffer[offset + i];
  }
  return { value, length };
}

function readElementId(buffer: Uint8Array, offset: number): { id: number; length: number } | null {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  if (firstByte === 0) return null;

  let length = 1;
  let mask = 0x80;
  while ((firstByte & mask) === 0 && length <= 4) {
    mask >>= 1;
    length++;
  }
  if (length > 4 || offset + length > buffer.length) return null;

  let id = 0;
  for (let i = 0; i < length; i++) {
    id = (id << 8) | buffer[offset + i];
  }
  return { id, length };
}

interface RawEBMLTrack {
  number: number;
  type: number; // 1 = Video, 2 = Audio, 17 = Subtitle
  codecId: string;
  language: string;
  name: string;
  channels?: number;
  samplingFrequency?: number;
  isDefault?: boolean;
}

async function parseMKVTracks(file: File): Promise<RawEBMLTrack[]> {
  try {
    const headerChunkSize = Math.min(file.size, 16 * 1024 * 1024);
    const headerBuffer = new Uint8Array(await file.slice(0, headerChunkSize).arrayBuffer());

    let offset = 0;
    const tracks: RawEBMLTrack[] = [];
    const decoder = new TextDecoder('utf-8');

    while (offset < headerBuffer.length - 8) {
      const elId = readElementId(headerBuffer, offset);
      if (!elId) break;
      offset += elId.length;

      const size = readVint(headerBuffer, offset);
      if (!size) break;
      offset += size.length;

      const elementDataEnd = offset + size.value;

      // 0x1654AE6B = Tracks
      if (elId.id === 0x1654AE6B) {
        let trackOffset = offset;
        while (trackOffset < Math.min(elementDataEnd, headerBuffer.length)) {
          const tId = readElementId(headerBuffer, trackOffset);
          if (!tId) break;
          trackOffset += tId.length;

          const tSize = readVint(headerBuffer, trackOffset);
          if (!tSize) break;
          trackOffset += tSize.length;

          const tEnd = trackOffset + tSize.value;

          // 0xAE = TrackEntry
          if (tId.id === 0xAE) {
            let entryOffset = trackOffset;
            let trackNum = 0;
            let trackType = 0;
            let codecId = '';
            let language = 'und';
            let name = '';
            let channels: number | undefined;
            let samplingFrequency: number | undefined;
            let isDefault = false;

            while (entryOffset < Math.min(tEnd, headerBuffer.length)) {
              const subId = readElementId(headerBuffer, entryOffset);
              if (!subId) break;
              entryOffset += subId.length;

              const subSize = readVint(headerBuffer, entryOffset);
              if (!subSize) break;
              entryOffset += subSize.length;

              // 0xD7 = TrackNumber
              if (subId.id === 0xD7 && subSize.value <= 4) {
                trackNum = 0;
                for (let i = 0; i < subSize.value; i++) {
                  trackNum = (trackNum << 8) | headerBuffer[entryOffset + i];
                }
              }
              // 0x83 = TrackType (1=Video, 2=Audio, 17=Subtitle)
              else if (subId.id === 0x83 && subSize.value <= 4) {
                trackType = 0;
                for (let i = 0; i < subSize.value; i++) {
                  trackType = (trackType << 8) | headerBuffer[entryOffset + i];
                }
              }
              // 0x86 = CodecID
              else if (subId.id === 0x86) {
                codecId = decoder.decode(headerBuffer.subarray(entryOffset, entryOffset + subSize.value));
              }
              // 0x22B59C = Language
              else if (subId.id === 0x22B59C) {
                language = decoder.decode(headerBuffer.subarray(entryOffset, entryOffset + subSize.value));
              }
              // 0x536E = Name
              else if (subId.id === 0x536E) {
                name = decoder.decode(headerBuffer.subarray(entryOffset, entryOffset + subSize.value));
              }
              // 0x88 = FlagDefault
              else if (subId.id === 0x88 && subSize.value >= 1) {
                isDefault = headerBuffer[entryOffset] === 1;
              }
              // 0xE1 = Audio sub-container
              else if (subId.id === 0xE1) {
                let audioOffset = entryOffset;
                const audioEnd = entryOffset + subSize.value;
                while (audioOffset < Math.min(audioEnd, headerBuffer.length)) {
                  const aId = readElementId(headerBuffer, audioOffset);
                  if (!aId) break;
                  audioOffset += aId.length;
                  const aSize = readVint(headerBuffer, audioOffset);
                  if (!aSize) break;
                  audioOffset += aSize.length;

                  // 0x9F = Channels
                  if (aId.id === 0x9F && aSize.value <= 2) {
                    channels = 0;
                    for (let i = 0; i < aSize.value; i++) {
                      channels = (channels * 256) + headerBuffer[audioOffset + i];
                    }
                  }
                  // 0xB5 = SamplingFrequency (IEEE 754 float: 4 bytes = float32, 8 bytes = float64)
                  else if (aId.id === 0xB5 && aSize.value <= 8) {
                    if (audioOffset + aSize.value <= headerBuffer.length) {
                      const dv = new DataView(headerBuffer.buffer, headerBuffer.byteOffset + audioOffset, aSize.value);
                      if (aSize.value === 4) {
                        samplingFrequency = Math.round(dv.getFloat32(0, false));
                      } else if (aSize.value === 8) {
                        samplingFrequency = Math.round(dv.getFloat64(0, false));
                      } else {
                        samplingFrequency = 48000;
                      }
                    }
                  }
                  audioOffset += aSize.value;
                }
              }

              entryOffset += subSize.value;
            }

            if (trackNum > 0 && trackType > 0) {
              tracks.push({
                number: trackNum,
                type: trackType,
                codecId,
                language,
                name,
                channels,
                samplingFrequency,
                isDefault
              });
            }
          }
          trackOffset = tEnd;
        }
      }

      if (elId.id !== 0x18538067 && elId.id !== 0x1654AE6B) {
        offset = elementDataEnd;
      }
    }

    return tracks;
  } catch (e) {
    console.error('Error parsing MKV EBML tracks:', e);
    return [];
  }
}

/**
 * Ultra-Fast Streaming Matroska (MKV/WebM) Subtitle Track Extractor.
 * Parses Clusters and extracts BlockGroup / SimpleBlock packets with millisecond precision.
 */
export async function extractMKVSubtitleTrack(file: File, targetTrackNumber: number, signal?: AbortSignal): Promise<ExtractedSubtitleResult | null> {
  try {
    const fileSize = file.size;
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB sliding buffer
    const buffer = new Uint8Array(CHUNK_SIZE);

    let clusterTime = 0;
    const cuesList: { start: number; end: number; text: string }[] = [];
    const decoder = new TextDecoder('utf-8');

    let bytesInBuffer = 0;
    let bufferStartFilePos = 0;
    let offset = 0;
    let loopIterations = 0;

    const ensureBytes = async (needed: number): Promise<boolean> => {
      if (offset + needed <= bytesInBuffer) return true;
      const remaining = Math.max(0, bytesInBuffer - offset);
      if (remaining > 0) {
        buffer.copyWithin(0, offset, bytesInBuffer);
      }
      bufferStartFilePos += offset;
      offset = 0;

      const bytesToRead = Math.min(CHUNK_SIZE - remaining, fileSize - (bufferStartFilePos + remaining));
      if (bytesToRead <= 0) {
        bytesInBuffer = remaining;
        return bytesInBuffer >= needed;
      }

      const sliceBuf = await file.slice(bufferStartFilePos + remaining, bufferStartFilePos + remaining + bytesToRead).arrayBuffer();
      buffer.set(new Uint8Array(sliceBuf), remaining);
      bytesInBuffer = remaining + sliceBuf.byteLength;
      return bytesInBuffer >= needed;
    };

    // Initial read
    const initSize = Math.min(CHUNK_SIZE, fileSize);
    const initBuf = await file.slice(0, initSize).arrayBuffer();
    buffer.set(new Uint8Array(initBuf), 0);
    bytesInBuffer = initBuf.byteLength;

    while (bufferStartFilePos + offset < fileSize) {
      if (signal?.aborted) return null;
      loopIterations++;
      if (loopIterations % 80 === 0) {
        // Cooperative yield to keep browser UI responsive during large file scans
        await new Promise(r => setTimeout(r, 0));
        if (signal?.aborted) return null;
      }

      if (!(await ensureBytes(16))) break;

      const el = readElementId(buffer, offset);
      if (!el) { offset++; continue; }

      const sz = readVint(buffer, offset + el.length);
      if (!sz) { offset++; continue; }

      const dataOffset = offset + el.length + sz.length;

      // Container elements to enter: Segment (0x18538067) and Cluster (0x1F43B675)
      if (el.id === 0x18538067 || el.id === 0x1F43B675) {
        offset = dataOffset;
        continue;
      }

      // 0xE7 = Cluster Timecode
      if (el.id === 0xE7) {
        if (!(await ensureBytes(sz.value + (dataOffset - offset)))) break;
        let tc = 0;
        for (let i = 0; i < Math.min(sz.value, 8); i++) {
          tc = (tc << 8) | buffer[dataOffset + i];
        }
        clusterTime = tc;
        offset = dataOffset + sz.value;
        continue;
      }

      // 0xA0 = BlockGroup (Subtitles with explicit duration)
      if (el.id === 0xA0) {
        if (!(await ensureBytes(sz.value + (dataOffset - offset)))) {
          offset = dataOffset + sz.value;
          continue;
        }
        const bgEnd = dataOffset + sz.value;
        let bgPos = dataOffset;
        let blockTime: number | null = null;
        let blockText: string | null = null;
        let duration = 2500;

        while (bgPos < bgEnd - 4) {
          const subEl = readElementId(buffer, bgPos);
          if (!subEl) break;
          const subSz = readVint(buffer, bgPos + subEl.length);
          if (!subSz) break;
          const subData = bgPos + subEl.length + subSz.length;

          if (subEl.id === 0xA1 && subData < bytesInBuffer) {
            const tNum = readVint(buffer, subData);
            if (tNum && tNum.value === targetTrackNumber) {
              const p = subData + tNum.length;
              if (p + 3 <= bytesInBuffer) {
                const dv = new DataView(buffer.buffer, buffer.byteOffset + p, 2);
                const relTc = dv.getInt16(0, false);
                const textBytes = buffer.subarray(p + 3, subData + subSz.value);
                const rawText = decoder.decode(textBytes).trim();
                blockText = cleanSubtitleText(rawText);
                blockTime = clusterTime + relTc;
              }
            }
          } else if (subEl.id === 0x9B) {
            let dur = 0;
            for (let i = 0; i < Math.min(subSz.value, 4); i++) {
              dur = (dur << 8) | buffer[subData + i];
            }
            duration = dur;
          }
          bgPos = subData + subSz.value;
        }

        if (blockTime !== null && blockText) {
          cuesList.push({
            start: Math.max(0, blockTime / 1000),
            end: Math.max(0, (blockTime + duration) / 1000),
            text: blockText
          });
        }

        offset = dataOffset + sz.value;
        continue;
      }

      // 0xA3 = SimpleBlock (Standard subtitles)
      if (el.id === 0xA3) {
        if (await ensureBytes(Math.min(sz.value, 16) + (dataOffset - offset))) {
          const tNum = readVint(buffer, dataOffset);
          if (tNum && tNum.value === targetTrackNumber) {
            if (await ensureBytes(sz.value + (dataOffset - offset))) {
              const p = dataOffset + tNum.length;
              const dv = new DataView(buffer.buffer, buffer.byteOffset + p, 2);
              const relTc = dv.getInt16(0, false);
              const textBytes = buffer.subarray(p + 3, dataOffset + sz.value);
              const rawText = decoder.decode(textBytes).trim();
              const text = cleanSubtitleText(rawText);
              if (text) {
                const start = Math.max(0, (clusterTime + relTc) / 1000);
                cuesList.push({
                  start,
                  end: start + 2.8,
                  text
                });
              }
            }
          }
        }
        offset = dataOffset + sz.value;
        continue;
      }

      // Skip non-subtitle blocks (video/audio payload)
      offset = dataOffset + sz.value;
    }

    if (cuesList.length === 0) return null;

    // Sort by start time and fix overlapping end times
    cuesList.sort((a, b) => a.start - b.start);
    for (let i = 0; i < cuesList.length - 1; i++) {
      const cur = cuesList[i];
      const next = cuesList[i + 1];
      if (next.start > cur.start && cur.end > next.start) {
        cur.end = Math.max(cur.start + 0.5, next.start);
      }
    }

    const srtLines: string[] = [];
    cuesList.forEach((entry, idx) => {
      const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };
      srtLines.push(`${idx + 1}\n${formatTime(entry.start)} --> ${formatTime(entry.end)}\n${entry.text}\n`);
    });

    const srtText = srtLines.join('\n');
    const cues = parseSubtitles(srtText);

    return {
      cues,
      srtText,
      language: 'und',
      trackName: `Track ${targetTrackNumber}`
    };
  } catch (e) {
    console.error('Error extracting MKV subtitle track:', e);
    return null;
  }
}

/* ========================================================================= */
/*                   ISOBMFF / MP4 / MOV / M4V BOX PARSER                    */
/* ========================================================================= */

interface MP4Box {
  type: string;
  pos: number;
  size: number;
  dataPos: number;
  dataEnd: number;
}

function parseMP4Boxes(view: DataView, start = 0, end = view.byteLength): MP4Box[] {
  const boxes: MP4Box[] = [];
  let pos = start;

  while (pos + 8 <= end) {
    let size = view.getUint32(pos, false);
    const type = String.fromCharCode(
      view.getUint8(pos + 4),
      view.getUint8(pos + 5),
      view.getUint8(pos + 6),
      view.getUint8(pos + 7)
    );

    let headerSize = 8;
    if (size === 1 && pos + 16 <= end) {
      const high = view.getUint32(pos + 8, false);
      const low = view.getUint32(pos + 12, false);
      size = (high * 4294967296) + low;
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }

    if (size < headerSize || pos + size > end) break;
    boxes.push({
      type,
      pos,
      size,
      dataPos: pos + headerSize,
      dataEnd: pos + size
    });
    pos += size;
  }

  return boxes;
}

function decodeIso639_2(val: number): string {
  const c1 = String.fromCharCode(((val >> 10) & 0x1F) + 0x60);
  const c2 = String.fromCharCode(((val >> 5) & 0x1F) + 0x60);
  const c3 = String.fromCharCode((val & 0x1F) + 0x60);
  return (c1 + c2 + c3).toLowerCase();
}

async function getMP4MoovData(file: File): Promise<{ buffer: ArrayBuffer; view: DataView; fileOffset: number } | null> {
  try {
    const initialSize = Math.min(file.size, 16 * 1024 * 1024);
    const initialBuf = await file.slice(0, initialSize).arrayBuffer();
    const initialView = new DataView(initialBuf);
    const topBoxes = parseMP4Boxes(initialView, 0, initialView.byteLength);

    const moovBox = topBoxes.find(b => b.type === 'moov');
    if (moovBox) {
      const moovBuf = await file.slice(moovBox.pos, moovBox.pos + moovBox.size).arrayBuffer();
      return { buffer: moovBuf, view: new DataView(moovBuf), fileOffset: moovBox.pos };
    }

    let offset = 0;
    while (offset + 16 <= file.size) {
      const headerBuf = await file.slice(offset, offset + 16).arrayBuffer();
      if (headerBuf.byteLength < 8) break;
      const hView = new DataView(headerBuf);
      let size = hView.getUint32(0, false);
      const type = String.fromCharCode(hView.getUint8(4), hView.getUint8(5), hView.getUint8(6), hView.getUint8(7));
      if (size === 1) {
        const high = hView.getUint32(8, false);
        const low = hView.getUint32(12, false);
        size = (high * 4294967296) + low;
      }
      if (type === 'moov') {
        const moovBuf = await file.slice(offset, offset + size).arrayBuffer();
        return { buffer: moovBuf, view: new DataView(moovBuf), fileOffset: offset };
      }
      if (size < 8) break;
      offset += size;
    }

    return null;
  } catch (e) {
    console.error('Error finding MP4 moov box:', e);
    return null;
  }
}

interface RawMP4Track {
  trackId: number;
  trackIndex: number;
  type: 'video' | 'audio' | 'subtitle';
  handlerType: string;
  handlerName: string;
  language: string;
  timescale: number;
  codec: string;
}

async function parseMP4Tracks(file: File): Promise<RawMP4Track[]> {
  try {
    const moovData = await getMP4MoovData(file);
    if (!moovData) return [];

    const { view } = moovData;
    const topBoxes = parseMP4Boxes(view, 0, view.byteLength);
    const moov = topBoxes.find(b => b.type === 'moov') || { dataPos: 8, dataEnd: view.byteLength, pos: 0, size: view.byteLength, type: 'moov' };

    const moovBoxes = parseMP4Boxes(view, moov.dataPos, moov.dataEnd);
    const trakBoxes = moovBoxes.filter(b => b.type === 'trak');

    const tracks: RawMP4Track[] = [];
    const decoder = new TextDecoder('utf-8');

    trakBoxes.forEach((trak, idx) => {
      const tb = parseMP4Boxes(view, trak.dataPos, trak.dataEnd);
      const tkhd = tb.find(b => b.type === 'tkhd');
      let trackId = idx + 1;
      if (tkhd && tkhd.dataPos + 16 <= view.byteLength) {
        const version = view.getUint8(tkhd.dataPos);
        trackId = version === 1 ? view.getUint32(tkhd.dataPos + 20, false) : view.getUint32(tkhd.dataPos + 12, false);
      }

      const mdia = tb.find(b => b.type === 'mdia');
      if (!mdia) return;
      const mb = parseMP4Boxes(view, mdia.dataPos, mdia.dataEnd);

      const hdlr = mb.find(b => b.type === 'hdlr');
      const mdhd = mb.find(b => b.type === 'mdhd');

      let handlerType = '';
      let handlerName = '';
      if (hdlr && hdlr.dataPos + 12 <= view.byteLength) {
        handlerType = String.fromCharCode(
          view.getUint8(hdlr.dataPos + 8),
          view.getUint8(hdlr.dataPos + 9),
          view.getUint8(hdlr.dataPos + 10),
          view.getUint8(hdlr.dataPos + 11)
        );
        if (hdlr.dataPos + 24 <= hdlr.dataEnd) {
          const rawNameBytes = new Uint8Array(view.buffer, hdlr.dataPos + 24, hdlr.dataEnd - (hdlr.dataPos + 24));
          handlerName = decoder.decode(rawNameBytes).replace(/[\x00-\x1F]/g, ' ').trim();
        }
      }

      let language = 'und';
      let timescale = 1000;
      if (mdhd && mdhd.dataPos + 24 <= view.byteLength) {
        const version = view.getUint8(mdhd.dataPos);
        timescale = version === 1 ? view.getUint32(mdhd.dataPos + 20, false) : view.getUint32(mdhd.dataPos + 12, false);
        const langVal = version === 1 ? view.getUint16(mdhd.dataPos + 32, false) : view.getUint16(mdhd.dataPos + 20, false);
        language = decodeIso639_2(langVal);
      }

      let codec = '';
      const minf = mb.find(b => b.type === 'minf');
      if (minf) {
        const minfBoxes = parseMP4Boxes(view, minf.dataPos, minf.dataEnd);
        const stbl = minfBoxes.find(b => b.type === 'stbl');
        if (stbl) {
          const stblBoxes = parseMP4Boxes(view, stbl.dataPos, stbl.dataEnd);
          const stsd = stblBoxes.find(b => b.type === 'stsd');
          if (stsd && stsd.dataPos + 12 <= view.byteLength) {
            const entryBoxes = parseMP4Boxes(view, stsd.dataPos + 8, stsd.dataEnd);
            if (entryBoxes.length > 0) {
              codec = entryBoxes[0].type;
            }
          }
        }
      }

      let trackType: 'video' | 'audio' | 'subtitle' = 'video';
      if (handlerType === 'soun') {
        trackType = 'audio';
      } else if (['sbtl', 'text', 'subt', 'clcp'].includes(handlerType) || ['tx3g', 'text', 'c608', 'c708', 'wvtt'].includes(codec)) {
        trackType = 'subtitle';
      }

      tracks.push({
        trackId,
        trackIndex: idx,
        type: trackType,
        handlerType,
        handlerName,
        language,
        timescale,
        codec
      });
    });

    return tracks;
  } catch (e) {
    console.error('Error parsing MP4 tracks:', e);
    return [];
  }
}

/**
 * Ultra-Fast Batched MP4 Subtitle Track Extractor.
 * Reads sample headers from moov and streams non-empty subtitle text in fast parallel batches.
 */
export async function extractMP4SubtitleTrack(file: File, targetTrackId: number, signal?: AbortSignal): Promise<ExtractedSubtitleResult | null> {
  try {
    if (signal?.aborted) return null;
    const moovData = await getMP4MoovData(file);
    if (!moovData) return null;

    const { view } = moovData;
    const topBoxes = parseMP4Boxes(view, 0, view.byteLength);
    const moov = topBoxes.find(b => b.type === 'moov') || { dataPos: 8, dataEnd: view.byteLength, pos: 0, size: view.byteLength, type: 'moov' };

    const moovBoxes = parseMP4Boxes(view, moov.dataPos, moov.dataEnd);
    const trakBoxes = moovBoxes.filter(b => b.type === 'trak');

    let targetTrak = trakBoxes.find((trak, idx) => {
      const tb = parseMP4Boxes(view, trak.dataPos, trak.dataEnd);
      const tkhd = tb.find(b => b.type === 'tkhd');
      if (tkhd && tkhd.dataPos + 16 <= view.byteLength) {
        const version = view.getUint8(tkhd.dataPos);
        const tId = version === 1 ? view.getUint32(tkhd.dataPos + 20, false) : view.getUint32(tkhd.dataPos + 12, false);
        return tId === targetTrackId;
      }
      return (idx + 1) === targetTrackId;
    });

    if (!targetTrak && trakBoxes.length > 0) {
      targetTrak = trakBoxes.find(trak => {
        const tb = parseMP4Boxes(view, trak.dataPos, trak.dataEnd);
        const mdia = tb.find(b => b.type === 'mdia');
        if (!mdia) return false;
        const mb = parseMP4Boxes(view, mdia.dataPos, mdia.dataEnd);
        const hdlr = mb.find(b => b.type === 'hdlr');
        if (hdlr && hdlr.dataPos + 12 <= view.byteLength) {
          const hType = String.fromCharCode(view.getUint8(hdlr.dataPos + 8), view.getUint8(hdlr.dataPos + 9), view.getUint8(hdlr.dataPos + 10), view.getUint8(hdlr.dataPos + 11));
          return ['sbtl', 'text', 'subt', 'clcp'].includes(hType);
        }
        return false;
      }) || trakBoxes[0];
    }
    if (!targetTrak) return null;

    const trakBoxesInner = parseMP4Boxes(view, targetTrak.dataPos, targetTrak.dataEnd);
    const mdia = trakBoxesInner.find(b => b.type === 'mdia');
    if (!mdia) return null;

    const mdiaBoxes = parseMP4Boxes(view, mdia.dataPos, mdia.dataEnd);
    const mdhd = mdiaBoxes.find(b => b.type === 'mdhd');
    if (!mdhd) return null;

    const version = view.getUint8(mdhd.dataPos);
    const timescale = (version === 1 ? view.getUint32(mdhd.dataPos + 20, false) : view.getUint32(mdhd.dataPos + 12, false)) || 1000;

    const minf = mdiaBoxes.find(b => b.type === 'minf');
    if (!minf) return null;

    const minfBoxes = parseMP4Boxes(view, minf.dataPos, minf.dataEnd);
    const stbl = minfBoxes.find(b => b.type === 'stbl');
    if (!stbl) return null;

    const stblBoxes = parseMP4Boxes(view, stbl.dataPos, stbl.dataEnd);
    const stts = stblBoxes.find(b => b.type === 'stts');
    const stsz = stblBoxes.find(b => b.type === 'stsz');
    const stsc = stblBoxes.find(b => b.type === 'stsc');
    const stco = stblBoxes.find(b => b.type === 'stco');
    const co64 = stblBoxes.find(b => b.type === 'co64');

    if (!stts || !stsz || !stsc || (!stco && !co64)) return null;

    const sttsEntriesCount = view.getUint32(stts.dataPos + 4, false);
    const sttsList: { count: number; delta: number }[] = [];
    let p = stts.dataPos + 8;
    for (let i = 0; i < sttsEntriesCount; i++) {
      sttsList.push({
        count: view.getUint32(p, false),
        delta: view.getUint32(p + 4, false)
      });
      p += 8;
    }

    const defaultSampleSize = view.getUint32(stsz.dataPos + 4, false);
    const sampleCount = view.getUint32(stsz.dataPos + 8, false);
    const sampleSizes: number[] = [];
    if (defaultSampleSize === 0) {
      p = stsz.dataPos + 12;
      for (let i = 0; i < sampleCount; i++) {
        sampleSizes.push(view.getUint32(p, false));
        p += 4;
      }
    } else {
      for (let i = 0; i < sampleCount; i++) sampleSizes.push(defaultSampleSize);
    }

    const chunkOffsets: number[] = [];
    if (stco) {
      const count = view.getUint32(stco.dataPos + 4, false);
      p = stco.dataPos + 8;
      for (let i = 0; i < count; i++) {
        chunkOffsets.push(view.getUint32(p, false));
        p += 4;
      }
    } else if (co64) {
      const count = view.getUint32(co64.dataPos + 4, false);
      p = co64.dataPos + 8;
      for (let i = 0; i < count; i++) {
        const high = view.getUint32(p, false);
        const low = view.getUint32(p + 4, false);
        chunkOffsets.push((high * 4294967296) + low);
        p += 8;
      }
    }

    const stscCount = view.getUint32(stsc.dataPos + 4, false);
    const stscEntries: { firstChunk: number; samplesPerChunk: number }[] = [];
    p = stsc.dataPos + 8;
    for (let i = 0; i < stscCount; i++) {
      stscEntries.push({
        firstChunk: view.getUint32(p, false),
        samplesPerChunk: view.getUint32(p + 4, false)
      });
      p += 12;
    }

    const sampleOffsets: number[] = [];
    let currentChunkIdx = 0;
    let stscIdx = 0;
    let sampleInCurrentChunk = 0;

    for (let s = 0; s < sampleCount; s++) {
      const chunkNumber = currentChunkIdx + 1;
      while (stscIdx + 1 < stscEntries.length && chunkNumber >= stscEntries[stscIdx + 1].firstChunk) {
        stscIdx++;
      }
      const samplesInThisChunk = stscEntries[stscIdx].samplesPerChunk;

      if (sampleInCurrentChunk === 0) {
        sampleOffsets.push(chunkOffsets[currentChunkIdx]);
      } else {
        sampleOffsets.push(sampleOffsets[s - 1] + sampleSizes[s - 1]);
      }

      sampleInCurrentChunk++;
      if (sampleInCurrentChunk >= samplesInThisChunk) {
        sampleInCurrentChunk = 0;
        currentChunkIdx++;
      }
    }

    // Collect valid non-empty samples with calculated timestamps
    const validSamples: { startSec: number; endSec: number; offset: number; size: number }[] = [];
    let currentSec = 0;
    let sttsIdx = 0;
    let sampleInStts = 0;

    for (let s = 0; s < sampleCount; s++) {
      const delta = sttsList[sttsIdx] ? sttsList[sttsIdx].delta : 1000;
      const durSec = delta / timescale;
      const startSec = currentSec;
      const endSec = currentSec + durSec;
      currentSec += durSec;

      sampleInStts++;
      if (sttsList[sttsIdx] && sampleInStts >= sttsList[sttsIdx].count) {
        sampleInStts = 0;
        sttsIdx++;
      }

      const size = sampleSizes[s];
      const offset = sampleOffsets[s];
      if (size > 2 && offset !== undefined) {
        validSamples.push({ startSec, endSec, offset, size });
      }
    }

    if (validSamples.length === 0) return null;

    const extractedEntries: { startTime: number; endTime: number; text: string }[] = [];
    const decoder = new TextDecoder('utf-8');

    // Read in fast parallel batches of 50 samples
    const BATCH_SIZE = 50;
    for (let b = 0; b < validSamples.length; b += BATCH_SIZE) {
      if (signal?.aborted) return null;
      if (b > 0 && b % (BATCH_SIZE * 2) === 0) {
        await new Promise(r => setTimeout(r, 0));
        if (signal?.aborted) return null;
      }
      const batch = validSamples.slice(b, b + BATCH_SIZE);
      const buffers = await Promise.all(batch.map(item => file.slice(item.offset, item.offset + item.size).arrayBuffer()));

      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const sBuf = buffers[i];
        if (sBuf.byteLength >= 2) {
          const sView = new DataView(sBuf);
          const textLen = sView.getUint16(0, false);
          if (textLen > 0 && textLen <= sBuf.byteLength - 2) {
            const rawTextBytes = new Uint8Array(sBuf, 2, textLen);
            const text = cleanSubtitleText(decoder.decode(rawTextBytes).replace(/\r\n/g, '\n'));
            if (text) {
              extractedEntries.push({
                startTime: Math.max(0, item.startSec),
                endTime: Math.max(item.startSec + 0.5, item.endSec),
                text
              });
            }
          }
        }
      }
    }

    if (extractedEntries.length === 0) return null;

    for (let i = 0; i < extractedEntries.length - 1; i++) {
      const cur = extractedEntries[i];
      const next = extractedEntries[i + 1];
      if (next.startTime > cur.startTime && next.startTime < cur.startTime + 6) {
        cur.endTime = Math.min(cur.endTime, next.startTime);
      }
    }

    const srtLines: string[] = [];
    extractedEntries.forEach((entry, idx) => {
      const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };
      srtLines.push(`${idx + 1}\n${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n${entry.text}\n`);
    });

    const srtText = srtLines.join('\n');
    const cues = parseSubtitles(srtText);

    return {
      cues,
      srtText,
      language: 'und',
      trackName: `Track ${targetTrackId}`
    };
  } catch (e) {
    console.error('Error extracting MP4 subtitle track:', e);
    return null;
  }
}

/* ========================================================================= */
/*                    UNIVERSAL MULTI-TRACK DISCOVERY                        */
/* ========================================================================= */

/**
 * Universal Multi-Track Discovery across MKV, WebM, MP4, MOV, M4V.
 */
export async function extractAllMediaTracks(file: File): Promise<MediaTracksDiscoveryResult> {
  const name = file.name.toLowerCase();
  const audioTracks: MediaAudioTrack[] = [];
  const subtitleTracks: MediaSubtitleTrack[] = [];

  const isMKV = name.endsWith('.mkv') || name.endsWith('.webm');

  if (isMKV) {
    const rawTracks = await parseMKVTracks(file);
    let audioIdx = 1;
    let subIdx = 1;

    for (const t of rawTracks) {
      if (t.type === 2) {
        const langName = formatLanguage(t.language);
        const channelStr = t.channels === 6 ? '5.1 Surround' : t.channels === 8 ? '7.1 Surround' : t.channels === 2 ? 'Stereo' : t.channels ? `${t.channels}ch` : '';
        const codecShort = t.codecId.replace('A_', '').replace('AUDIO/', '');
        
        let label = t.name ? t.name : `Track ${audioIdx}: ${langName}`;
        if (channelStr && !label.includes(channelStr)) label += ` (${channelStr})`;
        if (codecShort && !label.includes(codecShort)) label += ` [${codecShort}]`;

        audioTracks.push({
          id: `audio-mkv-${t.number}`,
          index: audioIdx - 1,
          label,
          language: t.language || 'und',
          channels: t.channels,
          codec: codecShort,
          enabled: audioIdx === 1
        });
        audioIdx++;
      } else if (t.type === 17 || t.type === 0x11) {
        const langName = formatLanguage(t.language);
        const codecShort = t.codecId.replace('S_TEXT/', '').replace('S_', '');
        let label = t.name ? t.name : `Track ${subIdx}: ${langName}`;
        if (codecShort && !label.includes(codecShort)) label += ` [${codecShort}]`;

        subtitleTracks.push({
          id: `sub-mkv-${t.number}`,
          index: subIdx - 1,
          number: t.number,
          label,
          language: t.language || 'und',
          codec: codecShort,
          mode: subIdx === 1 ? 'showing' : 'disabled'
        });
        subIdx++;
      }
    }
  } else {
    const rawTracks = await parseMP4Tracks(file);
    let audioIdx = 1;
    let subIdx = 1;

    for (const t of rawTracks) {
      if (t.type === 'audio') {
        const langName = formatLanguage(t.language);
        let label = t.handlerName ? t.handlerName : `Track ${audioIdx}: ${langName}`;
        if (t.codec && !label.includes(t.codec)) label += ` [${t.codec.toUpperCase()}]`;

        audioTracks.push({
          id: `audio-mp4-${t.trackId}`,
          index: audioIdx - 1,
          label,
          language: t.language || 'und',
          codec: t.codec,
          enabled: audioIdx === 1
        });
        audioIdx++;
      } else if (t.type === 'subtitle') {
        const langName = formatLanguage(t.language);
        let label = t.handlerName ? t.handlerName : `Track ${subIdx}: ${langName}`;
        if (t.codec && !label.includes(t.codec)) label += ` [${t.codec}]`;

        subtitleTracks.push({
          id: `sub-mp4-${t.trackId}`,
          index: subIdx - 1,
          number: t.trackId,
          label,
          language: t.language || 'und',
          codec: t.codec || 'mov_text',
          mode: subIdx === 1 ? 'showing' : 'disabled'
        });
        subIdx++;
      }
    }
  }

  if (audioTracks.length === 0) {
    audioTracks.push({
      id: 'audio-track-default',
      index: 0,
      label: 'Track 1: Stereo Audio (Default)',
      language: 'und',
      enabled: true
    });
  }

  return { audioTracks, subtitleTracks };
}

/**
 * Universal Subtitle Extractor for a specific Track by number/ID.
 */
export async function extractEmbeddedSubtitleTrack(file: File, trackNumber: number, trackId?: string, signal?: AbortSignal): Promise<ExtractedSubtitleResult | null> {
  const name = file.name.toLowerCase();
  const isMKV = name.endsWith('.mkv') || name.endsWith('.webm') || (trackId && trackId.includes('mkv'));

  if (isMKV) {
    return extractMKVSubtitleTrack(file, trackNumber, signal);
  } else {
    return extractMP4SubtitleTrack(file, trackNumber, signal);
  }
}

/**
 * Universal Embedded Subtitle Extractor Entry Point (Extracts default/English track on upload)
 */
export async function extractEmbeddedSubtitles(file: File): Promise<ExtractedSubtitleResult | null> {
  const { subtitleTracks } = await extractAllMediaTracks(file);
  if (subtitleTracks.length === 0) return null;

  // Prioritize English tracks if available, otherwise first track
  const target = subtitleTracks.find(t => t.language.toLowerCase().startsWith('en') || t.label.toLowerCase().includes('english')) || subtitleTracks[0];
  if (target.number !== undefined) {
    const result = await extractEmbeddedSubtitleTrack(file, target.number, target.id);
    if (result) {
      result.language = target.language || 'und';
      result.trackName = target.label;
      return result;
    }
  }

  return null;
}
