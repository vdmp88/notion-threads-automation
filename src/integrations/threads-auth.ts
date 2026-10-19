import { z } from 'zod';

import type { ThreadsConfig } from '../config/threads.js';

const refreshSchema = z.object({
  access_token: z.string().regex(/^\S+$/),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().int().positive().max(60 * 24 * 60 * 60),
});

export class ThreadsAuthError extends Error {}

export async function refreshThreadsToken(
  config: ThreadsConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresAt: string }> {
  try {
    // Meta's official Postman collection supports OAuth Bearer auth for this endpoint.
    // Keep the credential out of the URL, logs, and errors.
    const response = await fetcher(
      'https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token',
      {
        headers: { Authorization: `Bearer ${config.THREADS_ACCESS_TOKEN}` },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      },
    );
    if (!response.ok) {
      throw new ThreadsAuthError(
        `Token refresh failed (HTTP ${response.status}). It requires an unexpired long-lived token at least 24 hours old.`,
      );
    }
    const body: unknown = await response.json();
    const result = refreshSchema.safeParse(body);
    if (!result.success) throw new ThreadsAuthError('Invalid token refresh response.');
    return {
      accessToken: result.data.access_token,
      expiresAt: new Date(Date.now() + result.data.expires_in * 1000).toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof ThreadsAuthError) throw error;
    throw new ThreadsAuthError('Token refresh failed. No automatic retry was made.');
  }
}
