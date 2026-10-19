import { z } from 'zod';

import type { ThreadsConfig } from '../config/threads.js';

const idSchema = z.object({ id: z.string().regex(/^\d+$/) });
const statusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED']),
});
const permalinkSchema = z.object({
  id: z.string().regex(/^\d+$/),
  permalink: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      ['www.threads.net', 'threads.net', 'www.threads.com', 'threads.com'].includes(url.hostname);
  }),
});

export class ThreadsPublishingError extends Error {}

async function request(
  config: ThreadsConfig,
  path: string,
  body?: URLSearchParams,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  try {
    const response = await fetcher(`https://graph.threads.net/v1.0/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${config.THREADS_ACCESS_TOKEN}` },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });

    if (!response.ok) {
      throw new ThreadsPublishingError(`Threads request failed (HTTP ${response.status}).`);
    }

    return await response.json();
  } catch (error: unknown) {
    if (error instanceof ThreadsPublishingError) throw error;
    throw new ThreadsPublishingError('Threads request failed or returned unreadable JSON.');
  }
}

export async function createTextContainer(
  config: ThreadsConfig,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const body = await request(config, 'me/threads', new URLSearchParams({
    media_type: 'TEXT', text, auto_publish_text: 'false',
  }), fetcher);
  const result = idSchema.safeParse(body);
  if (!result.success) throw new ThreadsPublishingError('Invalid container response.');
  return result.data.id;
}

export async function readContainerStatus(
  config: ThreadsConfig,
  containerId: string,
  fetcher: typeof fetch = fetch,
): Promise<z.infer<typeof statusSchema>['status']> {
  if (!/^\d+$/.test(containerId)) throw new ThreadsPublishingError('Invalid container ID.');
  const result = statusSchema.safeParse(
    await request(config, `${containerId}?fields=status`, undefined, fetcher),
  );
  if (!result.success) throw new ThreadsPublishingError('Invalid container status response.');
  return result.data.status;
}

export async function publishContainer(
  config: ThreadsConfig,
  containerId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!/^\d+$/.test(containerId)) throw new ThreadsPublishingError('Invalid container ID.');
  try {
    const result = idSchema.safeParse(await request(config, 'me/threads_publish',
      new URLSearchParams({ creation_id: containerId }),
      fetcher,
    ));
    if (!result.success) throw new ThreadsPublishingError('Invalid publication response.');
    return result.data.id;
  } catch {
    // Any failed publish response is treated conservatively: never resend automatically.
    throw new ThreadsPublishingError(
      `Publication outcome is uncertain. Do not rerun. Check Threads and container ${containerId} before any further attempt.`,
    );
  }
}

export async function readPostPermalink(
  config: ThreadsConfig,
  postId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  if (!/^\d+$/.test(postId)) throw new ThreadsPublishingError('Invalid post ID.');
  const result = permalinkSchema.safeParse(
    await request(config, `${postId}?fields=id,permalink`, undefined, fetcher),
  );
  if (!result.success || result.data.id !== postId) {
    throw new ThreadsPublishingError('Invalid post permalink response.');
  }
  return result.data.permalink;
}
