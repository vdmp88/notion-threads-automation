import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { parseMongoEnv } from '../config/mongodb.js';
import { connectMongo } from '../integrations/mongodb.js';

async function main(): Promise<void> {
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (existsSync(envPath)) loadEnvFile(envPath);
    const connection = await connectMongo(parseMongoEnv(process.env));
    try {
      console.log(JSON.stringify({ connected: true, writes: false }, null, 2));
    } finally {
      // A finite CLI must release the driver's connection pool before exiting.
      await connection.close();
    }
  } catch {
    console.error('Could not inspect MongoDB. Check local .env settings and database availability.');
    process.exitCode = 1;
  }
}

void main();
