import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { parseThreadsEnv } from '../config/threads.js';
import { readThreadsProfile, ThreadsReadError } from '../integrations/threads.js';

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
    config = parseThreadsEnv(process.env);
  } catch {
    console.error('Missing or invalid Threads configuration: THREADS_ACCESS_TOKEN');
    process.exitCode = 1;
    return;
  }

  try {
    const profile = await readThreadsProfile(config);

    console.log(JSON.stringify(profile, null, 2));
  } catch (error: unknown) {
    console.error(
      error instanceof ThreadsReadError ? error.message : 'Could not read Threads profile.',
    );
    process.exitCode = 1;
  }
}

void main();
