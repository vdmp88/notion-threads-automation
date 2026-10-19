import { describe, expect, it, vi } from 'vitest';

import { parseThreadsEnv } from '../src/config/threads.js';
import { readThreadsProfile } from '../src/integrations/threads.js';

describe('Threads read-only integration', () => {
  it('parses the token without retaining unrelated configuration', () => {
    expect(parseThreadsEnv({ THREADS_ACCESS_TOKEN: ' test-token ', OTHER: 'unused' })).toEqual({
      THREADS_ACCESS_TOKEN: 'test-token',
    });
  });

  it('rejects missing configuration before a request can be made', () => {
    expect(() => parseThreadsEnv({})).toThrow('THREADS_ACCESS_TOKEN');
  });

  it('sends one authenticated GET and maps only the requested profile fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: '123', username: 'example', extra: 'ignored' })),
    );

    await expect(
      readThreadsProfile({ THREADS_ACCESS_TOKEN: 'test-token' }, fetcher),
    ).resolves.toEqual({ userId: '123', username: 'example' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://graph.threads.net/v1.0/me?fields=id,username',
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer test-token', Accept: 'application/json' },
        redirect: 'error',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('does not expose a rejected response body or retry the request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('sensitive remote error details', { status: 401 }),
    );

    await expect(
      readThreadsProfile({ THREADS_ACCESS_TOKEN: 'test-token' }, fetcher),
    ).rejects.toThrow('Threads profile request failed (HTTP 401).');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects an incomplete profile', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"123"}'));

    await expect(
      readThreadsProfile({ THREADS_ACCESS_TOKEN: 'test-token' }, fetcher),
    ).rejects.toThrow('Threads returned an invalid profile response.');
  });

  it('replaces raw transport errors with a safe message', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret transport details'));

    await expect(
      readThreadsProfile({ THREADS_ACCESS_TOKEN: 'test-token' }, fetcher),
    ).rejects.toThrow('Could not read Threads profile. Check the network and try again.');
  });
});
