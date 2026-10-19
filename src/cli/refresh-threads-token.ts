import { constants, existsSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { parseThreadsEnv } from '../config/threads.js';
import { refreshThreadsToken, ThreadsAuthError } from '../integrations/threads-auth.js';

async function main(): Promise<void> {
  try {
    if (process.argv.length !== 2) throw new ThreadsAuthError('Usage: npm run threads:refresh');
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    const dryRun = process.env.DRY_RUN ?? 'true';
    if (dryRun !== 'true' && dryRun !== 'false') {
      throw new ThreadsAuthError('DRY_RUN must be true or false.');
    }
    if (dryRun === 'true') {
      console.log('Dry-run: would refresh the long-lived token and save .env.threads-refreshed. No request or file write made.');
      return;
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new ThreadsAuthError('Token refresh requires an interactive terminal.');
    }
    let config;
    try { config = parseThreadsEnv(process.env); }
    catch { throw new ThreadsAuthError('Missing or invalid THREADS_ACCESS_TOKEN.'); }

    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    let approved;
    try {
      approved = await terminal.question('Refresh this token at Meta and save it locally? Type REFRESH: ');
    } finally { terminal.close(); }
    if (approved !== 'REFRESH') {
      console.log('Cancelled.');
      return;
    }

    // Reserve a private, new file BEFORE the external request. Never replace .env or follow a symlink.
    const outputPath = resolve(process.cwd(), '.env.threads-refreshed');
    let file;
    try {
      file = await open(outputPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    } catch {
      throw new ThreadsAuthError('Cannot create .env.threads-refreshed. If it exists, review it before moving it aside. No refresh request sent.');
    }
    try {
      const refreshed = await refreshThreadsToken(config);
      await file.writeFile(`# Refreshed token expires at ${refreshed.expiresAt}\nTHREADS_ACCESS_TOKEN=${refreshed.accessToken}\n`);
      await file.sync();
      console.log(`Refreshed token saved privately to .env.threads-refreshed; expires at ${refreshed.expiresAt}. Copy its value into your local .env. Do not share it. Existing process environment variables may override .env.`);
    } finally { await file.close(); }
  } catch (error: unknown) {
    console.error(error instanceof ThreadsAuthError ? error.message :
      'Token refresh or local save failed. No secrets were printed. Review .env.threads-refreshed before retrying.');
    process.exitCode = 1;
  }
}

void main();
