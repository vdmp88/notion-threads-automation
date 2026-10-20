import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { parseMongoEnv } from '../config/mongodb.js';
import { parseNotionEnv } from '../config/notion.js';
import { parseThreadsEnv } from '../config/threads.js';
import { ThreadsTextError } from '../domain/threads-text.js';
import { connectMongo, MongoConnectionError } from '../integrations/mongodb.js';
import { createNotionClient } from '../integrations/notion.js';
import {
  listReadyPublicationPageIds, NotionPublicationDataError,
  readNotionPublicationPost, requireReadyPost, validateNotionPublicationSchema,
  writeNotionPublication,
} from '../integrations/notion-publication.js';
import { NotionSchemaError } from '../integrations/notion-schema.js';
import { ThreadsReadError } from '../integrations/threads.js';
import { ThreadsPublishingError } from '../integrations/threads-publishing.js';
import {
  createPublicationRepository, listPendingSynchronizationIds,
  PublicationRepositoryError, readPublication,
} from '../repositories/publications.js';
import { NotionPublicationError, publishNotionPost } from '../services/publish-notion-post.js';
import {
  PublicationBatchError, requireAutomaticMode, runPublicationBatch,
} from '../services/run-publication-batch.js';
import { NotionSyncError, syncNotionPublication } from '../services/sync-notion-publication.js';
import { acquirePublicationJobLock, PublicationJobLockError } from './publication-job-lock.js';

function report(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...event }));
}

async function main(): Promise<void> {
  let connection: Awaited<ReturnType<typeof connectMongo>> | undefined;
  let release: (() => Promise<void>) | undefined;
  const controller = new AbortController();
  const stop = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) return;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort();
    report({ event: 'stop_requested', signal });
  };
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    if (process.argv.length !== 2) throw new PublicationBatchError('Usage: npm run publication:run');
    const root = process.cwd();
    const envPath = resolve(root, '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    const dryRun = requireAutomaticMode(process.env);
    const notion = parseNotionEnv(process.env);
    const mongo = parseMongoEnv(process.env);
    // Validate all live credentials before index initialization or claiming.
    const threads = dryRun ? undefined : parseThreadsEnv(process.env);
    const lock = await acquirePublicationJobLock(root);
    if (!lock) {
      report({ event: 'overlap_or_stale_lock', writes: false });
      process.exitCode = 75;
      return;
    }
    release = lock;
    controller.signal.throwIfAborted();
    const client = createNotionClient(notion);
    const sourceId = notion.NOTION_DATA_SOURCE_ID;
    await validateNotionPublicationSchema(client, sourceId);
    connection = await connectMongo(mongo);
    const db = connection.db;
    const readPost = (id: string) => readNotionPublicationPost(client, sourceId, id);
    // Initialize lazily, only when live work actually needs a write.
    let repository: Awaited<ReturnType<typeof createPublicationRepository>> | undefined;
    const getRepository = async () => {
      controller.signal.throwIfAborted();
      if (!repository) repository = await createPublicationRepository(db, { dryRun });
      return repository;
    };
    // The explicit automatic-mode gate replaces interactive prompts in this CLI
    // only. Services still check readiness, metadata, claims and saved states.
    const confirm = async () => {
      controller.signal.throwIfAborted();
      return !dryRun;
    };
    report({ event: 'started', dryRun });
    await runPublicationBatch({
      dryRun,
      signal: controller.signal,
      listPageIds: async () => {
        const pending = await listPendingSynchronizationIds(db);
        controller.signal.throwIfAborted();
        const ready = await listReadyPublicationPageIds(client, sourceId);
        return [...new Set([...pending, ...ready])].slice(0, 10);
      },
      readPost,
      findPublication: (id) => readPublication(db, id),
      publish: async (post) => {
        await publishNotionPost({
          post: requireReadyPost(post), dryRun, repository: await getRepository(),
          ...(threads ? { config: threads } : {}),
          reloadPost: async () => requireReadyPost(await readPost(post.notionPageId)),
          confirm, signal: controller.signal,
          onPublished: (result) => report({
            event: 'threads_published', pageId: post.notionPageId, ...result,
          }),
          report: () => { /* Do not copy draft text/account previews into job logs. */ },
        });
      },
      synchronize: async (publication) => {
        await syncNotionPublication({
          publication, dryRun, repository: await getRepository(),
          ...(threads ? { config: threads } : {}),
          readPost: () => readPost(publication.notionPageId),
          writeResult: (result) => writeNotionPublication(client, sourceId, result, {
            dryRun, signal: controller.signal,
          }),
          confirm, signal: controller.signal,
          report: () => { /* The batch reports only page IDs and actions. */ },
        });
      },
      report: (event) => {
        report({ event: 'page', ...event });
        if (event.action === 'manual_review') process.exitCode = 1;
      },
    });
    controller.signal.throwIfAborted();
    report({ event: 'completed', dryRun });
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      report({ event: 'stopped', message: 'Saved claims retained. Inspect interrupted publications before retrying.' });
    } else {
      const safe = error instanceof PublicationBatchError || error instanceof PublicationJobLockError ||
        error instanceof MongoConnectionError || error instanceof PublicationRepositoryError ||
        error instanceof NotionPublicationError || error instanceof NotionSyncError ||
        error instanceof NotionPublicationDataError || error instanceof NotionSchemaError ||
        error instanceof ThreadsTextError || error instanceof ThreadsReadError ||
        error instanceof ThreadsPublishingError;
      report({ event: 'failed', message: safe ? error.message : 'Job stopped. Check configuration and API access; reconcile saved state before retrying.' });
      process.exitCode = 1;
    }
  } finally {
    try {
      await connection?.close();
    } catch {
      report({ event: 'cleanup_failed', message: 'Could not close MongoDB cleanly.' });
      process.exitCode = 1;
    }
    try {
      await release?.();
    } catch {
      report({ event: 'cleanup_failed', message: 'Could not release the job lock.' });
      process.exitCode = 1;
    }
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}

void main();
