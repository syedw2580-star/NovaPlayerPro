/**
 * Subtitle markup sanitizer and HTML formatter.
 * Safely parses subtitle markup:
 * - <i>, <em> -> italics (for lyrics, off-screen dialogue, whispers)
 * - <b>, <strong> -> bold
 * - <u> -> underline
 * - <font color="..."> -> colored text
 * - \n -> <br/>
 * Strips any unsafe or invalid tags so raw markup tags never leak as visible text on the player.
 */
export function sanitizeSubtitleHtml(raw: string): string {
  if (!raw) return '';

  // 1. Convert standard line breaks to HTML breaks
  let text = raw.replace(/\r\n|\r|\n/g, '<br/>');

  // 2. Allow only standard subtitle formatting tags: <i>, <em>, <b>, <strong>, <u>, <font>, <br>
  text = text.replace(/<(?=[a-z/!])(?!\/?(i|em|b|strong|u|font|br)\b)[^>]*>/gi, '');

  // 3. Strip any potential event handlers or unsafe attributes inside allowed tags
  text = text.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  text = text.replace(/href\s*=\s*["'][^"']*["']/gi, '');

  return text;
}

/**
 * Strips all HTML/XML tags from subtitle text, returning clean plain text.
 */
export function stripSubtitleHtml(raw: string): string {
  if (!raw) return '';
  return raw.replace(/<[^>]*>/g, '').trim();
}
