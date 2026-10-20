import type { ThreadsConfig } from '../config/threads.js';
import type { ContentPost } from '../domain/content-post.js';
import type { Publication, PublishedPublication } from '../domain/publication.js';
import { assertNotionSyncCompatible } from '../integrations/notion-publication.js';
import { readThreadsProfile } from '../integrations/threads.js';
import { readPostPermalink } from '../integrations/threads-publishing.js';
import type { PublicationRepository } from '../repositories/publications.js';

export class NotionSyncError extends Error {}

// Recovery has no container-creation or publication dependency: it cannot republish.
export async function syncNotionPublication(input: {
  publication: Publication;
  dryRun: boolean;
  repository?: PublicationRepository;
  config?: ThreadsConfig;
  readPost: () => Promise<ContentPost>;
  writeResult: (result: PublishedPublication) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  report: (message: string) => void;
  signal?: AbortSignal;
}, dependencies = { readThreadsProfile, readPostPermalink }): Promise<void> {
  let publication = input.publication;
  if (publication.state === 'notion_synced') {
    input.report('Publication is already synchronized. No writes sent.');
    return;
  }
  if (publication.state !== 'published') {
    throw new NotionSyncError(`Cannot synchronize state ${publication.state}. Reconcile the outcome manually; do not republish.`);
  }
  input.report(JSON.stringify({
    action: 'sync_notion_only', notionPageId: publication.notionPageId,
    threadsPostId: publication.threadsPostId, threadsUrl: publication.threadsUrl ?? null,
    publishedAt: publication.publishedAt, dryRun: input.dryRun,
  }, null, 2));
  if (input.dryRun) return;
  input.signal?.throwIfAborted();
  const repository = input.repository;
  if (!repository) throw new NotionSyncError('Publication repository is required.');
  if (!(await input.confirm('Save this existing Threads result to Notion? This will not publish another post.'))) return;

  const latest = await repository.find(publication.notionPageId);
  if (latest?.state === 'notion_synced') return;
  if (!latest || latest.state !== 'published' || latest.claimId !== publication.claimId) {
    throw new NotionSyncError('Saved publication state changed. Stopped without updating Notion.');
  }
  publication = latest;
  if (!publication.threadsUrl) {
    if (!input.config) throw new NotionSyncError('Threads configuration is required to recover the post URL.');
    const profile = await dependencies.readThreadsProfile(input.config);
    if (profile.userId !== publication.threadsUserId) {
      throw new NotionSyncError('Threads token belongs to a different account.');
    }
    const url = await dependencies.readPostPermalink(input.config, publication.threadsPostId);
    const saved = await repository.recordPermalink(publication, url);
    if (saved.state !== 'published') throw new NotionSyncError('Unexpected publication state.');
    publication = saved;
  }
  assertNotionSyncCompatible(await input.readPost(), publication);
  input.signal?.throwIfAborted();
  try {
    await input.writeResult(publication);
    await repository.markNotionSynced(publication);
  } catch {
    throw new NotionSyncError(`Threads post ${publication.threadsPostId} is already published. Notion synchronization is not confirmed; rerun --sync-only, never republish.`);
  }
  input.report('Notion result verified; ledger state is notion_synced.');
}
