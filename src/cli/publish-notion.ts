import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { parseMongoEnv } from '../config/mongodb.js';
import { parseNotionEnv } from '../config/notion.js';
import { parseThreadsEnv } from '../config/threads.js';
import { notionPageIdSchema } from '../domain/publication.js';
import { ThreadsTextError } from '../domain/threads-text.js';
import { connectMongo, MongoConnectionError } from '../integrations/mongodb.js';
import { createNotionClient } from '../integrations/notion.js';
import {
  NotionPublicationDataError, readNotionPublicationPost, requireReadyPost,
  validateNotionPublicationSchema, writeNotionPublication,
} from '../integrations/notion-publication.js';
import { NotionSchemaError } from '../integrations/notion-schema.js';
import { ThreadsReadError } from '../integrations/threads.js';
import { ThreadsPublishingError } from '../integrations/threads-publishing.js';
import { createPublicationRepository, PublicationRepositoryError, readPublication } from '../repositories/publications.js';
import { NotionPublicationError, publishNotionPost } from '../services/publish-notion-post.js';
import { NotionSyncError, syncNotionPublication } from '../services/sync-notion-publication.js';

async function confirm(message: string, word: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(`${message}\nType ${word} to confirm: `) === word;
  } finally {
    terminal.close();
  }
}

async function main(): Promise<void> {
  let connection: Awaited<ReturnType<typeof connectMongo>> | undefined;
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    const args = process.argv.slice(2);
    const syncOnly = args.length === 3 && args[2] === '--sync-only';
    const id = notionPageIdSchema.safeParse(args[1]);
    if (args[0] !== '--page' || !id.success || (args.length !== 2 && !syncOnly)) {
      throw new NotionPublicationError('Usage: npm run notion:publish -- --page PAGE_ID [--sync-only]');
    }
    const dryRunValue = process.env.DRY_RUN ?? 'true';
    if (dryRunValue !== 'true' && dryRunValue !== 'false') {
      throw new NotionPublicationError('DRY_RUN must be true or false.');
    }
    const dryRun = dryRunValue === 'true';
    if (!dryRun && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      throw new NotionPublicationError('Live mode requires an interactive terminal.');
    }
    const config = parseNotionEnv(process.env);
    const client = createNotionClient(config);
    const sourceId = config.NOTION_DATA_SOURCE_ID;
    const readPost = () => readNotionPublicationPost(client, sourceId, id.data);
    await validateNotionPublicationSchema(client, sourceId);
    const post = await readPost();
    const report = (message: string) => console.log(message);

    // Publishing dry-run reads Notion only: no MongoDB or Threads configuration needed.
    if (dryRun && !syncOnly) {
      await publishNotionPost({
        post: requireReadyPost(post), dryRun: true,
        reloadPost: async () => requireReadyPost(await readPost()),
        confirm: async () => false, report,
      });
      report('Preview only. Ledger duplicate checks run in live mode; no writes or publication approval.');
      return;
    }
    connection = await connectMongo(parseMongoEnv(process.env));
    const existing = await readPublication(connection.db, id.data);
    if (syncOnly && !existing) throw new NotionSyncError('No saved publication exists for this page.');
    if (!syncOnly && existing) {
      report(`Saved state: ${existing.state}. No publication attempted. Use --sync-only for a confirmed published result; otherwise reconcile manually.`);
      return;
    }
    if (syncOnly && existing?.state === 'notion_synced') {
      report('Publication is already synchronized. No writes sent.');
      return;
    }
    if (syncOnly && existing && existing.state !== 'published') {
      throw new NotionSyncError(`Cannot synchronize state ${existing.state}. Reconcile manually; do not republish.`);
    }
    if (dryRun && existing) {
      await syncNotionPublication({
        publication: existing, dryRun: true, readPost,
        writeResult: async () => { throw new NotionSyncError('Dry-run cannot write.'); },
        confirm: async () => false, report,
      });
      return;
    }
    const threads = !syncOnly || (existing?.state === 'published' && !existing.threadsUrl)
      ? parseThreadsEnv(process.env) : undefined;
    if (!(await confirm('Initialize the local publication index for this live operation?', 'PREPARE'))) return;
    const repository = await createPublicationRepository(connection.db, { dryRun: false });
    if (!syncOnly) {
      await publishNotionPost({
        post: requireReadyPost(post), dryRun: false, repository,
        ...(threads ? { config: threads } : {}),
        reloadPost: async () => requireReadyPost(await readPost()),
        confirm: (message) => confirm(message, 'PUBLISH'), report,
      });
    }
    const result = await repository.find(id.data);
    if (!result) return; // User cancelled before claiming.
    if (!syncOnly && result.state !== 'published') {
      report(`Saved state: ${result.state}. No synchronization attempted.`);
      return;
    }
    await syncNotionPublication({
      publication: result, dryRun: false, repository,
      ...(threads ? { config: threads } : {}),
      readPost,
      writeResult: (publication) => writeNotionPublication(client, sourceId, publication, { dryRun: false }),
      confirm: (message) => confirm(message, 'SYNC'), report,
    });
  } catch (error: unknown) {
    const safe = error instanceof NotionPublicationError || error instanceof NotionSyncError ||
      error instanceof NotionPublicationDataError || error instanceof NotionSchemaError ||
      error instanceof PublicationRepositoryError || error instanceof MongoConnectionError ||
      error instanceof ThreadsTextError || error instanceof ThreadsReadError || error instanceof ThreadsPublishingError;
    console.error(safe ? error.message : 'Workflow stopped. Check configuration, Notion access, and network. If a write started, reconcile saved state before retrying.');
    process.exitCode = 1;
  } finally {
    try { await connection?.close(); } catch {
      console.error('Could not close MongoDB cleanly.');
      process.exitCode = 1;
    }
  }
}

void main();
