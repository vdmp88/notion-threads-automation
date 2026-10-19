import { setTimeout as delay } from 'node:timers/promises';

import { describe, expect, it, vi } from 'vitest';

import { validateThreadsText } from '../src/domain/threads-text.js';
import { refreshThreadsToken } from '../src/integrations/threads-auth.js';
import { publishContainer } from '../src/integrations/threads-publishing.js';
import { publishThreadsTest } from '../src/services/publish-threads-test.js';

const config = { THREADS_ACCESS_TOKEN: 'test-token' };

function setup() {
  return {
    readThreadsProfile: vi.fn().mockResolvedValue({ userId: '123', username: 'example' }),
    createTextContainer: vi.fn().mockResolvedValue('456'),
    readContainerStatus: vi.fn<() => Promise<'FINISHED' | 'ERROR'>>().mockResolvedValue('FINISHED'),
    publishContainer: vi.fn().mockResolvedValue('789'),
    readPostPermalink: vi.fn().mockResolvedValue('https://www.threads.com/@example/post/abc'),
    delay,
  };
}

describe('Threads publication safety', () => {
  it('validates Unicode without treating Cyrillic letters as multiple characters', () => {
    expect(validateThreadsText('я'.repeat(500)).countedLength).toBe(500);
    expect(validateThreadsText('😀').countedLength).toBe(4);
    expect(() => validateThreadsText('a'.repeat(501))).toThrow('length limit');
    expect(() => validateThreadsText(' ')).toThrow('empty');
  });

  it('dry-run needs no token, confirmation, or API calls', async () => {
    const dependencies = setup();
    const confirm = vi.fn();
    const report = vi.fn();
    await publishThreadsTest({ text: 'Hello', dryRun: true, confirm, report }, dependencies);
    expect(dependencies.readThreadsProfile).not.toHaveBeenCalled();
    expect(dependencies.createTextContainer).not.toHaveBeenCalled();
    expect(dependencies.publishContainer).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(JSON.parse(report.mock.calls[0]?.[0] as string)).toMatchObject({ dryRun: true, writes: false });
  });

  it('requires both confirmations and preserves success if permalink lookup fails', async () => {
    const dependencies = setup();
    dependencies.readPostPermalink.mockRejectedValue(new Error('lookup failed'));
    const confirm = vi.fn().mockResolvedValue(true);
    const report = vi.fn();
    await publishThreadsTest({ text: 'Hello', dryRun: false, config, confirm, report }, dependencies);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(dependencies.createTextContainer).toHaveBeenCalledExactlyOnceWith(config, 'Hello');
    expect(dependencies.readContainerStatus).toHaveBeenCalledExactlyOnceWith(config, '456');
    expect(dependencies.publishContainer).toHaveBeenCalledExactlyOnceWith(config, '456');
    expect(report).toHaveBeenCalledWith(expect.stringContaining('"published": true'));
    expect(report).toHaveBeenCalledWith(expect.stringContaining('Do not republish'));
  });

  it('does not publish a ready container when the final confirmation is declined', async () => {
    const dependencies = setup();
    const confirm = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await publishThreadsTest({ text: 'Hello', dryRun: false, config, confirm, report: vi.fn() }, dependencies);
    expect(dependencies.publishContainer).not.toHaveBeenCalled();
  });

  it('does not publish a failed container', async () => {
    const dependencies = setup();
    dependencies.readContainerStatus.mockResolvedValue('ERROR');
    await expect(publishThreadsTest({
      text: 'Hello', dryRun: false, config, confirm: vi.fn().mockResolvedValue(true), report: vi.fn(),
    }, dependencies)).rejects.toThrow('no publish request sent');
    expect(dependencies.publishContainer).not.toHaveBeenCalled();
  });

  it('does not retry or expose transport details after an uncertain publish', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret transport detail'));
    await expect(publishContainer(config, '456', fetcher)).rejects.toThrow(
      'Publication outcome is uncertain. Do not rerun.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refreshes with a header credential and returns expiry without logging the token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'replacement-token', token_type: 'bearer', expires_in: 3600,
    })));
    const result = await refreshThreadsToken(config, fetcher);
    expect(result.accessToken).toBe('replacement-token');
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      'https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' }, redirect: 'error' }),
    );
  });
});
