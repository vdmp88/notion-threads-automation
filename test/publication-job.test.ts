import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { acquirePublicationJobLock } from '../src/cli/publication-job-lock.js';
import type { ContentPost } from '../src/domain/content-post.js';
import type { PublishedPublication } from '../src/domain/publication.js';
import { requireAutomaticMode, runPublicationBatch } from '../src/services/run-publication-batch.js';

const post: ContentPost = {
  notionPageId: '11111111111141118111111111111111',
  title: 'Example', text: 'Hello', topic: null, status: 'ready',
  threadsPostId: null, threadsUrl: null, publishedAt: null,
};
const saved: PublishedPublication = {
  notionPageId: post.notionPageId, contentHash: 'a'.repeat(64),
  threadsUserId: '123', claimId: '22222222-2222-4222-8222-222222222222',
  state: 'published', threadsContainerId: '456', threadsPostId: '789',
  createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date(),
};

function fixture() {
  return {
    dryRun: false, signal: new AbortController().signal,
    listPageIds: vi.fn().mockResolvedValue([post.notionPageId]),
    readPost: vi.fn().mockResolvedValue(post),
    findPublication: vi.fn().mockResolvedValue(null),
    publish: vi.fn(), synchronize: vi.fn(), report: vi.fn(),
  };
}

describe('finite publication job', () => {
  it('defaults to dry-run and requires explicit opt-in for automatic writes', () => {
    expect(requireAutomaticMode({})).toBe(true);
    expect(() => requireAutomaticMode({ DRY_RUN: 'false' })).toThrow('AUTO_PUBLISH_ENABLED');
    expect(requireAutomaticMode({ DRY_RUN: 'false', AUTO_PUBLISH_ENABLED: 'true' })).toBe(false);
  });

  it('dry-run validates fresh pages and discovers recovery without calling either writer', async () => {
    const input = fixture();
    input.dryRun = true;
    input.listPageIds.mockResolvedValue([post.notionPageId, 'saved-page']);
    input.findPublication.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    await runPublicationBatch(input);
    expect(input.readPost).toHaveBeenCalledOnce();
    expect(input.publish).not.toHaveBeenCalled();
    expect(input.synchronize).not.toHaveBeenCalled();
  });

  it('synchronizes the persisted result after publication and deduplicates candidates', async () => {
    const input = fixture();
    input.listPageIds.mockResolvedValue([post.notionPageId, post.notionPageId]);
    input.findPublication.mockResolvedValueOnce(null).mockResolvedValueOnce(saved);
    await runPublicationBatch(input);
    expect(input.publish).toHaveBeenCalledExactlyOnceWith(post);
    expect(input.synchronize).toHaveBeenCalledExactlyOnceWith(saved);
  });

  it('never republishes saved results or ambiguous intent', async () => {
    const input = fixture();
    input.listPageIds.mockResolvedValue(['pending', 'ambiguous']);
    input.findPublication.mockResolvedValueOnce(saved)
      .mockResolvedValueOnce({ ...saved, state: 'publish_started' });
    await runPublicationBatch(input);
    expect(input.publish).not.toHaveBeenCalled();
    expect(input.synchronize).toHaveBeenCalledExactlyOnceWith(saved);
    expect(input.report).toHaveBeenCalledWith({ pageId: 'ambiguous', action: 'manual_review' });
  });

  it('stops after a failed write without retrying or starting another page', async () => {
    const input = fixture();
    input.listPageIds.mockResolvedValue([post.notionPageId, 'next-page']);
    input.publish.mockRejectedValue(new Error('uncertain'));
    await expect(runPublicationBatch(input)).rejects.toThrow('uncertain');
    expect(input.publish).toHaveBeenCalledOnce();
    expect(input.readPost).toHaveBeenCalledOnce();
    expect(input.synchronize).not.toHaveBeenCalled();
  });

  it('honors a stop requested during a read before starting a write', async () => {
    const input = fixture();
    const controller = new AbortController();
    input.signal = controller.signal;
    input.readPost.mockImplementation(async () => {
      controller.abort();
      return post;
    });
    await expect(runPublicationBatch(input)).rejects.toThrow();
    expect(input.publish).not.toHaveBeenCalled();
  });

  it('allows one local lock owner and permits another run after release', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publication-job-'));
    try {
      const release = await acquirePublicationJobLock(root);
      expect(release).not.toBeNull();
      expect(await acquirePublicationJobLock(root)).toBeNull();
      await release?.();
      const nextRelease = await acquirePublicationJobLock(root);
      expect(nextRelease).not.toBeNull();
      await nextRelease?.();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
