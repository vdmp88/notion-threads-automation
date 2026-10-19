import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { parseThreadsEnv } from '../config/threads.js';
import { ThreadsTextError } from '../domain/threads-text.js';
import { ThreadsReadError } from '../integrations/threads.js';
import { ThreadsPublishingError } from '../integrations/threads-publishing.js';
import { publishThreadsTest, TestPublicationError } from '../services/publish-threads-test.js';

async function main(): Promise<void> {
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
  } catch {
    console.error('Could not load local .env.');
    process.exitCode = 1;
    return;
  }

  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--text' || args[1] === undefined) {
      throw new TestPublicationError('Usage: npm run threads:publish-test -- --text "Your text"');
    }
    const dryRunValue = process.env.DRY_RUN ?? 'true';
    if (dryRunValue !== 'true' && dryRunValue !== 'false') {
      throw new TestPublicationError('DRY_RUN must be true or false.');
    }
    const dryRun = dryRunValue === 'true';
    if (!dryRun && (!process.stdin.isTTY || !process.stdout.isTTY)) {
      throw new TestPublicationError('Live publication requires an interactive terminal.');
    }

    let config;
    if (!dryRun) {
      try {
        config = parseThreadsEnv(process.env);
      } catch {
        throw new TestPublicationError('Missing or invalid THREADS_ACCESS_TOKEN.');
      }
    }

    await publishThreadsTest({
      text: args[1],
      dryRun,
      ...(config ? { config } : {}),
      report: (message) => console.log(message),
      confirm: async (message) => {
        const terminal = createInterface({ input: process.stdin, output: process.stdout });
        try {
          const answer = await terminal.question(`${message}\nType PUBLISH to confirm: `);
          return answer === 'PUBLISH';
        } finally {
          terminal.close();
        }
      },
    });
  } catch (error: unknown) {
    const safe = error instanceof TestPublicationError || error instanceof ThreadsReadError ||
      error instanceof ThreadsTextError ||
      error instanceof ThreadsPublishingError;
    console.error(safe ? error.message : 'Test publication stopped. Check Threads before repeating a live run.');
    process.exitCode = 1;
  }
}

void main();
