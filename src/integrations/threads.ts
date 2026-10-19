import { z } from 'zod';

import type { ThreadsConfig } from '../config/threads.js';

const profileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
});

export interface ThreadsProfile {
  userId: string;
  username: string;
}

export class ThreadsReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThreadsReadError';
  }
}

export async function readThreadsProfile(
  config: ThreadsConfig,
  fetcher: typeof fetch = fetch,
): Promise<ThreadsProfile> {
  try {
    const response = await fetcher('https://graph.threads.net/v1.0/me?fields=id,username', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.THREADS_ACCESS_TOKEN}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });

    if (!response.ok) {
      // Remote error bodies may contain sensitive data; do not surface them.
      throw new ThreadsReadError(`Threads profile request failed (HTTP ${response.status}).`);
    }

    const body: unknown = await response.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      throw new ThreadsReadError('Threads returned an invalid profile response.');
    }

    return { userId: result.data.id, username: result.data.username };
  } catch (error: unknown) {
    if (error instanceof ThreadsReadError) {
      throw error;
    }

    // Do not attach the raw fetch/JSON error, request headers, or response body.
    throw new ThreadsReadError('Could not read Threads profile. Check the network and try again.');
  }
}
