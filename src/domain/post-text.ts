import { z } from 'zod';

// Check for meaningful text without changing the author's spaces or line breaks.
export const postTextSchema = z.string().refine((text) => text.trim().length > 0, {
  message: 'Post text must not be empty or whitespace-only.',
});
