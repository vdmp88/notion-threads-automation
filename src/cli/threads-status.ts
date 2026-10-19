import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { parseThreadsEnv } from '../config/threads.js';
import {
  readContainerStatus, readPostPermalink, ThreadsPublishingError,
} from '../integrations/threads-publishing.js';

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    const [kind, id] = args;
    if (args.length !== 2 || !['--container', '--post'].includes(kind ?? '') || !/^\d+$/.test(id ?? '')) {
      throw new ThreadsPublishingError('Usage: npm run threads:status -- --container ID (or --post ID)');
    }
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    let config;
    try { config = parseThreadsEnv(process.env); }
    catch { throw new ThreadsPublishingError('Missing or invalid THREADS_ACCESS_TOKEN.'); }
    // id is validated above; the fallback only satisfies noUncheckedIndexedAccess.
    const result = kind === '--container'
      ? { containerId: id, status: await readContainerStatus(config, id ?? '') }
      : { threadsPostId: id, threadsUrl: await readPostPermalink(config, id ?? '') };
    console.log(JSON.stringify(result, null, 2));
  } catch (error: unknown) {
    console.error(error instanceof ThreadsPublishingError ? error.message : 'Could not read Threads status.');
    process.exitCode = 1;
  }
}

void main();
