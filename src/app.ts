import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config/env.js';
import { registerHealthRoute } from './routes/health.js';

export interface BuildAppOptions {
  logger?: boolean;
  logLevel?: AppConfig['LOG_LEVEL'];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const fastifyOptions: FastifyServerOptions =
    options.logger === true ? { logger: { level: options.logLevel ?? 'info' } } : { logger: false };

  const app = Fastify(fastifyOptions);
  app.register(registerHealthRoute);

  return app;
}
