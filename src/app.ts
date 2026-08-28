import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config/env.js';
import { registerHealthRoute } from './routes/health.js';
import { registerPostsRoute } from './routes/posts.js';

export interface BuildAppOptions {
  logger?: boolean;
  logLevel?: AppConfig['LOG_LEVEL'];
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const fastifyOptions: FastifyServerOptions =
    options.logger === true ? { logger: { level: options.logLevel ?? 'info' } } : { logger: false };

  const app = Fastify(fastifyOptions);
  app.register(registerHealthRoute);
  app.register(registerPostsRoute);

  return app;
}
