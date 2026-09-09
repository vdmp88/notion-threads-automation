import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { isNotionClientError } from '@notionhq/client';

import { parseNotionEnv } from '../config/notion.js';
import { createNotionClient } from '../integrations/notion.js';
import { NotionPostDataError, readReadyNotionPosts } from '../integrations/notion-posts.js';
import { NotionSchemaError } from '../integrations/notion-schema.js';

async function main(): Promise<void> {
  try {
    const envPath = resolve(process.cwd(), '.env');

    if (existsSync(envPath)) {
      loadEnvFile(envPath);
    }
  } catch {
    console.error('Could not load local .env. Run this command from the project root.');
    process.exitCode = 1;
    return;
  }

  let config;

  try {
    config = parseNotionEnv(process.env);
  } catch (error: unknown) {
    // Our configuration parser reports only field names, never their values.
    console.error(error instanceof Error ? error.message : 'Invalid Notion configuration.');
    process.exitCode = 1;
    return;
  }

  try {
    const client = createNotionClient(config);
    const posts = await readReadyNotionPosts(client, config.NOTION_DATA_SOURCE_ID);

    console.log(JSON.stringify({ count: posts.length, posts }, null, 2));
  } catch (error: unknown) {
    if (error instanceof NotionPostDataError || error instanceof NotionSchemaError) {
      console.error(error.message);
    } else {
      const code = isNotionClientError(error) ? error.code : 'request_failed';

      console.error(
        `Could not read Notion posts (${code}). Check the connection token, data-source access, and network.`,
      );
    }

    process.exitCode = 1;
  }
}

void main();
