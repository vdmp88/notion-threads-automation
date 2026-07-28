import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

import { buildApp } from './app.js';
import { parseEnv } from './config/env.js';

function loadLocalEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env');

  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

function writeStartupError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  process.stderr.write(`${JSON.stringify({ level: 'error', message })}\n`);
}

async function startServer(): Promise<void> {
  loadLocalEnvFile();

  let config;

  try {
    config = parseEnv(process.env);
  } catch (error: unknown) {
    writeStartupError(error);
    process.exitCode = 1;
    return;
  }

  const app = buildApp({ logger: true, logLevel: config.LOG_LEVEL });

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    app.log.info({ dryRun: config.DRY_RUN }, 'Application started');
  } catch (error: unknown) {
    app.log.error({ err: error }, 'Application failed to start');
    await app.close();
    process.exitCode = 1;
    return;
  }

  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.log.info({ signal }, 'Shutdown signal received');

    try {
      await app.close();
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Graceful shutdown failed');
      process.exitCode = 1;
    }
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

void startServer();
