import { Buffer } from 'node:buffer';

export class ThreadsTextError extends Error {}

const segments = new Intl.Segmenter('und', { granularity: 'grapheme' });
const emoji = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;

export function validateThreadsText(text: string): { text: string; countedLength: number } {
  if (!text.trim()) throw new ThreadsTextError('Text must not be empty.');
  if (!text.isWellFormed()) throw new ThreadsTextError('Text contains invalid Unicode.');

  // Meta documents a 500-character limit with UTF-8 byte weighting for emoji.
  // Count non-emoji code points; weight whole emoji clusters (including ZWJ/modifiers).
  // This is a conservative preflight, not a claim of parity with Meta's private counter.
  let countedLength = 0;
  for (const { segment } of segments.segment(text)) {
    countedLength += emoji.test(segment) ? Buffer.byteLength(segment, 'utf8') : [...segment].length;
  }
  if (countedLength > 500) {
    throw new ThreadsTextError(`Text exceeds the local Threads length limit (${countedLength}/500).`);
  }
  return { text, countedLength };
}
