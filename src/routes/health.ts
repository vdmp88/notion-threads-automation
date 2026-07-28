import type { FastifyInstance } from 'fastify';

interface HealthResponse {
  status: 'ok';
}

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async function healthHandler(): Promise<HealthResponse> {
    return { status: 'ok' };
  });
}
