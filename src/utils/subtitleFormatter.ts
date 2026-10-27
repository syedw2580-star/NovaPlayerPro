/**
 * Strips SSA/ASS headers, including standalone "Dialogue:" headers and
 * Matroska (MKV) embedded SSA/ASS packet headers (ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text).
 * Example: "43,0,Default,,0,0,0,,Dites-moi que c'était..." -> "Dites-moi que c'était..."
 */
export function stripAssHeader(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // 1. Strip standard SSA/ASS Dialogue header line (e.g. Dialogue: 0,0:00:30.00,0:00:33.00,Default,,0,0,0,,Text)
  if (/^Dialogue:\s*/i.test(text)) {
    text = text.replace(/^Dialogue:\s*/i, '');
    let commaCount = 0;
    let idx = 0;
    while (idx < text.length && commaCount < 9) {
      if (text[idx] === ',') commaCount++;
      idx++;
    }
    if (commaCount >= 9) {
      text = text.substring(idx);
    }
    return text.trim();
  }

  // 2. Strip Matroska/EBML embedded SSA/ASS packet header with ReadOrder (8 commas before text)
  // Format: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
  // Example: "43,0,Default,,0,0,0,,Dites-moi..." or "0,0,Default,,0,0,0,,Un médecin, vite !"
  if (/^\d+,\d+,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,/.test(text)) {
    let commaCount = 0;
    let idx = 0;
    while (idx < text.length && commaCount < 8) {
      if (text[idx] === ',') commaCount++;
      idx++;
    }
    if (commaCount >= 8) {
      text = text.substring(idx);
    }
    return text.trim();
  }

  // 3. Strip Matroska/EBML embedded SSA/ASS packet header without ReadOrder (7 commas before text)
  // Format: Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
  // Example: "0,Default,,0,0,0,,Un médecin, vite !"
  if (/^\d+,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,/.test(text)) {
    let commaCount = 0;
    let idx = 0;
    while (idx < text.length && commaCount < 7) {
      if (text[idx] === ',') commaCount++;
      idx++;
    }
    if (commaCount >= 7) {
      text = text.substring(idx);
    }
    return text.trim();
  }

  return text;
}

/**
 * Universal ASS/SSA & SRT/VTT subtitle text cleaner.
 * Strips packet headers, drawing commands, ASS override tags, and normalizes line breaks and formatting.
 */
export function cleanSubtitleText(raw: string): string {
  if (!raw) return '';
  let text = stripAssHeader(raw);

  // Remove ASS drawing commands {\p1}..{\p0}
  text = text.replace(/\{\\p[1-9]\}.*?(\{\\p0\}|$)/gis, '');

  // Convert ASS style override tags like {\i1}..{\i0} to standard HTML tags
  text = text.replace(/\{\\i1\}(.*?)\{\\i0\}/gi, '<i>$1</i>');
  text = text.replace(/\{\\b1\}(.*?)\{\\b0\}/gi, '<b>$1</b>');
  text = text.replace(/\{\\u1\}(.*?)\{\\u0\}/gi, '<u>$1</u>');
  text = text.replace(/\{\\s1\}(.*?)\{\\s0\}/gi, '<s>$1</s>');

  // Strip remaining ASS style override tags like {\an8}, {\pos(..)}, {\c&H...&}
  text = text.replace(/\{[^}]+\}/g, '');

  // Convert ASS line break escapes and hard spaces (\h)
  text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');

  // Strip any non-formatting HTML/XML tags (keep safe i, em, b, strong, u, s, font, br)
  text = text.replace(/<(?=[a-z/!])(?!\/?(i|em|b|strong|u|s|font|br)\b)[^>]*>/gi, '');

  return text.trim();
}

/**
 * Subtitle markup sanitizer and HTML formatter.
 * Safely parses subtitle markup:
 * - <i>, <em> -> italics
 * - <b>, <strong> -> bold
 * - <u> -> underline
 * - <s> -> strikethrough
 * - <font color="..."> -> colored text
 * - \n, \N -> <br/>
 * Strips ASS packet headers, drawing commands, and unsafe attributes.
 */
export function sanitizeSubtitleHtml(raw: string): string {
  if (!raw) return '';

  // 1. Strip ASS packet headers if present
  let text = stripAssHeader(raw);

  // 2. Remove ASS drawing commands
  text = text.replace(/\{\\p[1-9]\}.*?(\{\\p0\}|$)/gis, '');

  // 3. Convert ASS style overrides
  text = text.replace(/\{\\i1\}(.*?)\{\\i0\}/gi, '<i>$1</i>');
  text = text.replace(/\{\\b1\}(.*?)\{\\b0\}/gi, '<b>$1</b>');
  text = text.replace(/\{\\u1\}(.*?)\{\\u0\}/gi, '<u>$1</u>');
  text = text.replace(/\{\\s1\}(.*?)\{\\s0\}/gi, '<s>$1</s>');

  // 4. Strip all ASS/SSA override codes enclosed in curly braces (e.g. {\an8}, {\pos(100,200)}, etc.)
  text = text.replace(/\{[^}]+\}/g, '');

  // 5. Convert ASS line breaks (\N) and standard newlines to HTML breaks, and hard space (\h)
  text = text.replace(/\\N/g, '<br/>').replace(/\r\n|\r|\n/g, '<br/>').replace(/\\h/g, ' ');

  // 6. Allow only standard subtitle formatting tags: <i>, <em>, <b>, <strong>, <u>, <s>, <font>, <br>
  text = text.replace(/<(?=[a-z/!])(?!\/?(i|em|b|strong|u|s|font|br)\b)[^>]*>/gi, '');

  // 7. Strip any potential event handlers or unsafe attributes inside allowed tags
  text = text.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  text = text.replace(/href\s*=\s*["'][^"']*["']/gi, '');

  return text.trim();
}

/**
 * Detects subtitle alignment from ASS/SSA tags if present (e.g. {\an8} = top center).
 */
export function extractSubtitleAlignment(raw: string): 'top' | 'middle' | 'bottom' {
  if (!raw) return 'bottom';
  if (/\{(\\an[789]|\\a[567])\}/i.test(raw)) {
    return 'top';
  }
  if (/\{(\\an[456]|\\a[9]|\\a1[01])\}/i.test(raw)) {
    return 'middle';
  }
  return 'bottom';
}

/**
 * Strips all HTML/XML tags and ASS/SSA tags from subtitle text, returning clean plain text.
 */
export function stripSubtitleHtml(raw: string): string {
  if (!raw) return '';
  let text = stripAssHeader(raw);
  text = text.replace(/\{\\p[1-9]\}.*?(\{\\p0\}|$)/gis, '');
  text = text.replace(/\{[^}]+\}/g, '');
  text = text.replace(/\\N/g, ' ').replace(/\\n/g, ' ').replace(/\\h/g, ' ');
  return text.replace(/<[^>]*>/g, '').trim();
}
