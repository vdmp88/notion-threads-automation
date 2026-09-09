import { describe, expect, it } from 'vitest';

import { postTextSchema } from '../src/domain/post-text.js';

describe('post text validation', () => {
  it('rejects empty and whitespace-only text', () => {
    expect(postTextSchema.safeParse('').success).toBe(false);
    expect(postTextSchema.safeParse(' \n\t').success).toBe(false);
  });

  it('preserves the original spacing and line breaks of a nonempty post', () => {
    const text = '  First paragraph.\n\nSecond paragraph!  ';

    expect(postTextSchema.parse(text)).toBe(text);
  });
});
