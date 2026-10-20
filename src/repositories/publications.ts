import { randomUUID } from 'node:crypto';

import { MongoServerError, type Db } from 'mongodb';

import {
  publicationClaimSchema,
  publicationSchema,
  notionPageIdSchema,
  type Publication,
  type ClaimedPublication,
  type PublicationClaimInput,
} from '../domain/publication.js';

export class PublicationRepositoryError extends Error {}

export type ClaimResult =
  | { claimed: true; publication: ClaimedPublication }
  | { claimed: false; reason: 'already_claimed' };

// Includes published pages even when Notion already says published after a lost
// PATCH/readback response. Read-only: no index initialization or ledger writes.
export async function listPendingSynchronizationIds(db: Db): Promise<string[]> {
  try {
    const records = await db.collection<Publication>('publications')
      .find({ state: 'published' }).sort({ createdAt: 1 }).limit(10).toArray();
    return records.map((record) => publicationSchema.parse(record).notionPageId);
  } catch {
    throw new PublicationRepositoryError('Could not read pending synchronization records.');
  }
}

// Does not initialize indexes or create records; safe for diagnostics and dry-run.
export async function readPublication(db: Db, notionPageId: string): Promise<Publication | null> {
  const id = notionPageIdSchema.safeParse(notionPageId);
  if (!id.success) throw new PublicationRepositoryError('Invalid Notion page ID.');
  try {
    const record = await db.collection<Publication>('publications').findOne({ notionPageId: id.data });
    if (!record) return null;
    const parsed = publicationSchema.safeParse(record);
    if (!parsed.success) throw new PublicationRepositoryError('Invalid stored publication. Manual review required.');
    return parsed.data;
  } catch (error: unknown) {
    if (error instanceof PublicationRepositoryError) throw error;
    throw new PublicationRepositoryError('Could not read publication state.');
  }
}

// Construct only on the future live path. Dry-run must not even create indexes.
export async function createPublicationRepository(db: Db, options: { dryRun: boolean }) {
  if (options.dryRun !== false) {
    throw new PublicationRepositoryError('Publication writes are disabled in dry-run mode.');
  }

  const collection = db.collection<Publication>('publications');
  try {
    // Await index creation before exposing claim(): never run without uniqueness.
    await collection.createIndex({ notionPageId: 1 }, {
      unique: true,
      name: 'unique_notion_page',
    });
  } catch {
    throw new PublicationRepositoryError('Could not initialize the publication index. No publication is permitted.');
  }

  async function transition(previous: Publication, next: Publication): Promise<Publication> {
    const parsed = publicationSchema.safeParse(next);
    if (!parsed.success) throw new PublicationRepositoryError('Invalid publication transition data.');
    try {
      const result = await collection.updateOne({
        notionPageId: previous.notionPageId,
        claimId: previous.claimId,
        state: previous.state,
      }, { $set: parsed.data });
      if (result.matchedCount !== 1) {
        throw new PublicationRepositoryError('Publication state changed or ownership was lost. Stop without publishing.');
      }
      return parsed.data;
    } catch (error: unknown) {
      if (error instanceof PublicationRepositoryError) throw error;
      throw new PublicationRepositoryError('Could not confirm persisted publication progress. Stop and reconcile; do not republish.');
    }
  }

  return {
    async find(notionPageId: string): Promise<Publication | null> {
      return readPublication(db, notionPageId);
    },
    async markNotionSynced(previous: Publication): Promise<Publication> {
      if (previous.state !== 'published' || !previous.threadsUrl) {
        throw new PublicationRepositoryError('Expected a published post with a saved URL.');
      }
      const now = new Date();
      return transition(previous, { ...previous, state: 'notion_synced', notionSyncedAt: now, updatedAt: now });
    },
    async recordContainer(previous: ClaimedPublication, containerId: string): Promise<Publication> {
      if (previous.state !== 'claimed') throw new PublicationRepositoryError('Expected a claimed publication.');
      return transition(previous, { ...previous, state: 'container_created', threadsContainerId: containerId, updatedAt: new Date() });
    },
    async startPublishing(previous: Publication): Promise<Publication> {
      if (previous.state !== 'container_created') throw new PublicationRepositoryError('Expected a saved container.');
      return transition(previous, { ...previous, state: 'publish_started', updatedAt: new Date() });
    },
    async recordPublished(previous: Publication, postId: string): Promise<Publication> {
      if (previous.state !== 'publish_started') throw new PublicationRepositoryError('Expected publication intent.');
      const now = new Date();
      return transition(previous, { ...previous, state: 'published', threadsPostId: postId, publishedAt: now, updatedAt: now });
    },
    async recordPermalink(previous: Publication, url: string): Promise<Publication> {
      if (previous.state !== 'published') throw new PublicationRepositoryError('Expected a published post.');
      return transition(previous, { ...previous, threadsUrl: url, updatedAt: new Date() });
    },
    async claim(input: PublicationClaimInput): Promise<ClaimResult> {
      const parsed = publicationClaimSchema.safeParse(input);
      if (!parsed.success) {
        throw new PublicationRepositoryError('Invalid publication claim.');
      }
      const now = new Date();
      const publication: ClaimedPublication = {
        ...parsed.data,
        claimId: randomUUID(),
        state: 'claimed',
        createdAt: now,
        updatedAt: now,
      };
      try {
        // No read-before-write race: MongoDB chooses one winner atomically.
        await collection.insertOne({ ...publication });
        return { claimed: true, publication };
      } catch (error: unknown) {
        if (error instanceof MongoServerError && error.code === 11000) {
          return { claimed: false, reason: 'already_claimed' };
        }
        // A lost response may still mean the insert committed. Never assume ownership.
        throw new PublicationRepositoryError('Publication claim could not be confirmed. Stop; do not publish or automatically reclaim.');
      }
    },
  };
}

export type PublicationRepository = Awaited<ReturnType<typeof createPublicationRepository>>;
