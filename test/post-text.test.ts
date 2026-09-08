import { describe, expect, it } from 'vitest';

import { postTextSchema } from '../src/domain/post-text.js';

describe('post text validation', () => {
  it.each(['', '   ', '\n\t\r', '\u00a0'])('rejects blank text %j', (text) => {
    expect(postTextSchema.safeParse(text).success).toBe(false);
  });

  it('preserves the original spacing and line breaks of a nonempty post', () => {
    const text = '  First paragraph.\n\nSecond paragraph!  ';

    expect(postTextSchema.parse(text)).toBe(text);
  });
});
