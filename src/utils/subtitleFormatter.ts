/**
 * Subtitle markup sanitizer and HTML formatter.
 * Safely parses subtitle markup:
 * - <i>, <em> -> italics (for lyrics, off-screen dialogue, whispers)
 * - <b>, <strong> -> bold
 * - <u> -> underline
 * - <font color="..."> -> colored text
 * - \n, \N -> <br/>
 * - Strips all ASS/SSA curly-brace override tags ({\an8}, {\pos(..)}, {\blur..}, etc.)
 * Strips any unsafe or invalid tags so raw markup tags never leak as visible text on the player.
 */
export function sanitizeSubtitleHtml(raw: string): string {
  if (!raw) return '';

  // 1. Strip all ASS/SSA override codes enclosed in curly braces (e.g. {\an8}, {\pos(100,200)}, etc.)
  let text = raw.replace(/\{[^}]+\}/g, '');

  // 2. Convert ASS line breaks (\N) and standard newlines to HTML breaks
  text = text.replace(/\\N/g, '<br/>').replace(/\r\n|\r|\n/g, '<br/>');

  // 3. Allow only standard subtitle formatting tags: <i>, <em>, <b>, <strong>, <u>, <font>, <br>
  text = text.replace(/<(?=[a-z/!])(?!\/?(i|em|b|strong|u|font|br)\b)[^>]*>/gi, '');

  // 4. Strip any potential event handlers or unsafe attributes inside allowed tags
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
  return raw.replace(/\{[^}]+\}/g, '').replace(/<[^>]*>/g, '').trim();
}
