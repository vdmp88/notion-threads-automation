import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { ContentPost } from '../src/domain/content-post.js';
import type { PublishedPublication } from '../src/domain/publication.js';
import { assertNotionSyncCompatible } from '../src/integrations/notion-publication.js';
import type { PublicationRepository } from '../src/repositories/publications.js';
import { syncNotionPublication } from '../src/services/sync-notion-publication.js';

const result: PublishedPublication = {
  notionPageId: '11111111111141118111111111111111',
  contentHash: createHash('sha256').update('Hello').digest('hex'),
  threadsUserId: '123', claimId: '22222222-2222-4222-8222-222222222222',
  state: 'published', threadsContainerId: '456', threadsPostId: '789',
  threadsUrl: 'https://www.threads.com/@example/post/abc',
  createdAt: new Date('2026-10-20T10:00:00.000Z'),
  updatedAt: new Date('2026-10-20T10:00:00.000Z'),
  publishedAt: new Date('2026-10-20T10:00:00.000Z'),
};
const post: ContentPost = {
  notionPageId: result.notionPageId, title: 'Example', text: 'Hello', topic: null,
  status: 'ready', threadsPostId: null, threadsUrl: null, publishedAt: null,
};

describe('Notion publication synchronization', () => {
  it('accepts Notion minute precision without accepting a different minute or mutating the ledger date', () => {
    const precise = { ...result, publishedAt: new Date('2026-10-19T23:24:59.033Z') };
    const saved = {
      ...post, status: 'published' as const, threadsPostId: result.threadsPostId,
      threadsUrl: result.threadsUrl ?? null,
      publishedAt: new Date('2026-10-20T01:24:00.000+02:00'),
    };
    expect(() => assertNotionSyncCompatible(saved, precise)).not.toThrow();
    expect(() => assertNotionSyncCompatible({
      ...saved, publishedAt: new Date('2026-10-19T23:25:00.000Z'),
    }, precise)).toThrow('conflicts');
    expect(precise.publishedAt.toISOString()).toBe('2026-10-19T23:24:59.033Z');
  });

  it('accepts an identical prior write but rejects changed content or another post ID', () => {
    expect(() => assertNotionSyncCompatible({
      ...post, status: 'published', threadsPostId: result.threadsPostId,
      threadsUrl: result.threadsUrl ?? null, publishedAt: result.publishedAt,
    }, result)).not.toThrow();
    expect(() => assertNotionSyncCompatible({ ...post, text: 'Changed' }, result)).toThrow('conflicts');
    expect(() => assertNotionSyncCompatible({ ...post, threadsPostId: '999' }, result)).toThrow('conflicts');
  });

  it('dry-run does not confirm, fetch, or write', async () => {
    const readPost = vi.fn();
    const writeResult = vi.fn();
    const confirm = vi.fn();
    const dependencies = { readThreadsProfile: vi.fn(), readPostPermalink: vi.fn() };
    await syncNotionPublication({ publication: result, dryRun: true, readPost, writeResult, confirm, report: vi.fn() }, dependencies);
    expect(confirm).not.toHaveBeenCalled();
    expect(readPost).not.toHaveBeenCalled();
    expect(writeResult).not.toHaveBeenCalled();
    expect(dependencies.readPostPermalink).not.toHaveBeenCalled();
  });

  it('refuses ambiguous publication intent without updating Notion', async () => {
    const writeResult = vi.fn();
    await expect(syncNotionPublication({
      publication: { ...result, state: 'publish_started' }, dryRun: false,
      readPost: vi.fn(), writeResult, confirm: vi.fn(), report: vi.fn(),
    })).rejects.toThrow('Reconcile');
    expect(writeResult).not.toHaveBeenCalled();
  });

  it('does not mark the ledger synchronized when Notion update fails', async () => {
    const repository: PublicationRepository = {
      find: vi.fn().mockResolvedValue(result), claim: vi.fn(), recordContainer: vi.fn(),
      startPublishing: vi.fn(), recordPublished: vi.fn(), recordPermalink: vi.fn(),
      markNotionSynced: vi.fn(),
    };
    await expect(syncNotionPublication({
      publication: result, dryRun: false, repository,
      readPost: vi.fn().mockResolvedValue(post),
      writeResult: vi.fn().mockRejectedValue(new Error('remote failure')),
      confirm: vi.fn().mockResolvedValue(true), report: vi.fn(),
    })).rejects.toThrow('rerun --sync-only');
    expect(repository.markNotionSynced).not.toHaveBeenCalled();
    expect(repository.startPublishing).not.toHaveBeenCalled();
  });
});
