import type { ContentPost } from '../domain/content-post.js';
import type { Publication } from '../domain/publication.js';
import { validateThreadsText } from '../domain/threads-text.js';

export class PublicationBatchError extends Error {}

export function requireAutomaticMode(input: Record<string, string | undefined>): boolean {
  const value = input.DRY_RUN ?? 'true';
  if (value !== 'true' && value !== 'false') {
    throw new PublicationBatchError('DRY_RUN must be true or false.');
  }
  if (value === 'false' && input.AUTO_PUBLISH_ENABLED !== 'true') {
    throw new PublicationBatchError('Automatic writes require AUTO_PUBLISH_ENABLED=true and DRY_RUN=false.');
  }
  return value === 'true';
}

// One bounded pass, no retries and no timers. The scheduler owns repetition.
export async function runPublicationBatch(input: {
  dryRun: boolean;
  signal: AbortSignal;
  listPageIds: () => Promise<string[]>;
  readPost: (id: string) => Promise<ContentPost>;
  findPublication: (id: string) => Promise<Publication | null>;
  publish: (post: ContentPost) => Promise<void>;
  synchronize: (publication: Publication) => Promise<void>;
  report: (event: { pageId: string; action: string }) => void;
}): Promise<void> {
  input.signal.throwIfAborted();
  const ids = await input.listPageIds();
  for (const pageId of new Set(ids)) {
    input.signal.throwIfAborted();
    const existing = await input.findPublication(pageId);
    input.signal.throwIfAborted();
    if (existing) {
      if (existing.state === 'published') {
        input.report({ pageId, action: input.dryRun ? 'would_sync' : 'sync' });
        if (!input.dryRun) await input.synchronize(existing);
      } else {
        input.report({
          pageId,
          action: existing.state === 'notion_synced' ? 'already_synced' : 'manual_review',
        });
      }
      continue;
    }
    const post = await input.readPost(pageId);
    input.signal.throwIfAborted();
    // A page may leave ready between query and read. Never claim it in that case.
    if (post.status !== 'ready') {
      input.report({ pageId, action: 'no_longer_ready' });
      continue;
    }
    if (post.threadsPostId || post.threadsUrl || post.publishedAt) {
      throw new PublicationBatchError('Notion publication metadata exists without a ledger record. Manual review required.');
    }
    validateThreadsText(post.text);
    input.report({ pageId, action: input.dryRun ? 'would_publish' : 'publish' });
    if (input.dryRun) continue;
    await input.publish(post);
    input.signal.throwIfAborted();
    const result = await input.findPublication(pageId);
    if (result?.state === 'published') await input.synchronize(result);
  }
}
