import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { parseMongoEnv } from '../config/mongodb.js';
import { notionPageIdSchema } from '../domain/publication.js';
import { connectMongo } from '../integrations/mongodb.js';
import { readPublication } from '../repositories/publications.js';

async function main(): Promise<void> {
  let connection: Awaited<ReturnType<typeof connectMongo>> | undefined;
  try {
    const args = process.argv.slice(2);
    const pageId = notionPageIdSchema.safeParse(args[1]);
    if (args.length !== 2 || args[0] !== '--page' || !pageId.success) {
      console.error('Usage: npm run publication:status -- --page PAGE_ID');
      process.exitCode = 1;
      return;
    }
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    connection = await connectMongo(parseMongoEnv(process.env));
    const publication = await readPublication(connection.db, pageId.data);
    console.log(JSON.stringify({
      notionPageId: pageId.data,
      found: publication !== null,
      writes: false,
      publication,
    }, null, 2));
    if (!publication) {
      console.log('No ledger record. This is not proof that the content was never published outside this workflow.');
    } else if (publication.state === 'published') {
      console.log('Already published. Use notion:publish -- --page PAGE_ID --sync-only to recover Notion synchronization.');
    } else if (publication.state !== 'notion_synced') {
      console.log('Incomplete or uncertain attempt. Do not delete/reclaim this record or republish. Reconcile the saved container and Threads profile manually.');
    }
  } catch {
    console.error('Could not inspect the publication ledger. Check configuration and MongoDB availability; do not infer absence from this error.');
    process.exitCode = 1;
  } finally {
    try { await connection?.close(); } catch {
      console.error('Could not close MongoDB cleanly.');
      process.exitCode = 1;
    }
  }
}

void main();
