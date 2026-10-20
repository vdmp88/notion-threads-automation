import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import type { ThreadsConfig } from '../config/threads.js';
import type { ReadyContentPost } from '../domain/content-post.js';
import { notionPageIdSchema } from '../domain/publication.js';
import { validateThreadsText } from '../domain/threads-text.js';
import { readThreadsProfile } from '../integrations/threads.js';
import {
  createTextContainer, readContainerStatus, publishContainer, readPostPermalink,
} from '../integrations/threads-publishing.js';
import type { PublicationRepository } from '../repositories/publications.js';

export class NotionPublicationError extends Error {}

// The CLI supplies a metadata-aware Notion reader; Stage 2 previews are not inputs.
export async function publishNotionPost(input: {
  post: ReadyContentPost;
  dryRun: boolean;
  config?: ThreadsConfig;
  repository?: PublicationRepository;
  // The caller must reload authoritative content and publication metadata.
  reloadPost: () => Promise<ReadyContentPost>;
  confirm: (message: string) => Promise<boolean>;
  report: (message: string) => void;
  signal?: AbortSignal;
  onPublished?: (result: { threadsPostId: string; containerId: string }) => void;
}, dependencies = {
  readThreadsProfile, createTextContainer, readContainerStatus, publishContainer,
  readPostPermalink, delay,
}): Promise<void> {
  // Snapshot primitive values before any awaits or interactive confirmation.
  const post = { ...input.post };
  const pageId = notionPageIdSchema.safeParse(post.notionPageId);
  if (!pageId.success || post.status !== 'ready') {
    throw new NotionPublicationError('A valid ready Notion page is required.');
  }
  if (post.threadsPostId || post.threadsUrl || post.publishedAt) {
    throw new NotionPublicationError('This Notion page already has publication metadata. Do not republish.');
  }
  const { countedLength } = validateThreadsText(post.text);
  const contentHash = createHash('sha256').update(post.text, 'utf8').digest('hex');
  input.report(JSON.stringify({ notionPageId: pageId.data, text: post.text, countedLength, dryRun: input.dryRun }, null, 2));
  if (input.dryRun) return; // No profile, repository, reload, or write calls.
  input.signal?.throwIfAborted();

  const { config, repository } = input;
  if (!config || !repository) throw new NotionPublicationError('Threads configuration and publication repository are required.');
  const existing = await repository.find(pageId.data);
  if (existing) {
    input.report(`Existing publication: ${existing.state}. No Threads write sent; reconcile the saved record.`);
    return;
  }
  const profile = await dependencies.readThreadsProfile(config);
  input.report(JSON.stringify({ account: profile }, null, 2));
  if (!(await input.confirm('Claim this Notion page and create a Threads container for the previewed text?'))) return;

  async function assertUnchanged(): Promise<void> {
    const current = await input.reloadPost();
    const id = notionPageIdSchema.safeParse(current.notionPageId);
    if (!id.success || id.data !== pageId.data || current.status !== 'ready' ||
      current.text !== post.text || current.threadsPostId || current.threadsUrl || current.publishedAt) {
      throw new NotionPublicationError('Notion content, eligibility, or publication metadata changed. Stopped without further Threads writes.');
    }
  }
  await assertUnchanged();
  input.signal?.throwIfAborted();
  const claim = await repository.claim({ notionPageId: pageId.data, contentHash, threadsUserId: profile.userId });
  if (!claim.claimed) {
    input.report('Another run already claimed this page. No Threads write sent.');
    return;
  }

  // Never release claims on exceptions: a remote write may already have succeeded.
  input.signal?.throwIfAborted();
  const containerId = await dependencies.createTextContainer(config, post.text);
  input.report(`Container created: ${containerId}. Not published yet.`);
  let publication = await repository.recordContainer(claim.publication, containerId);
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    input.signal?.throwIfAborted();
    const status = await dependencies.readContainerStatus(config, containerId);
    if (status === 'FINISHED') { ready = true; break; }
    if (status !== 'IN_PROGRESS') {
      throw new NotionPublicationError(`Container ${containerId}: ${status}. Manual review required.`);
    }
    if (attempt < 11) await dependencies.delay(5_000);
  }
  if (!ready) throw new NotionPublicationError('Container readiness timed out. Claim retained; no automatic retry.');
  if (!(await input.confirm(`Publish container ${containerId} publicly to ${profile.username} now?`))) return;
  await assertUnchanged();
  input.signal?.throwIfAborted();

  // Persist intent FIRST. Any crash or ambiguous response leaves a blocked record.
  publication = await repository.startPublishing(publication);
  input.signal?.throwIfAborted();
  const postId = await dependencies.publishContainer(config, containerId);
  input.onPublished?.({ threadsPostId: postId, containerId });
  input.report(JSON.stringify({ published: true, threadsPostId: postId, containerId }, null, 2));
  try {
    publication = await repository.recordPublished(publication, postId);
  } catch {
    throw new NotionPublicationError(`Threads published post ${postId}, but saving success could not be confirmed. Do not republish; reconcile the ledger.`);
  }
  try {
    const url = await dependencies.readPostPermalink(config, postId);
    await repository.recordPermalink(publication, url);
    input.report(JSON.stringify({ threadsUrl: url }, null, 2));
  } catch {
    input.report(`Post ${postId} is published and saved. URL lookup/storage needs recovery; do not republish.`);
  }
}
