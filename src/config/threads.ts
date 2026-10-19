import { z } from 'zod';

const threadsEnvSchema = z.object({
  THREADS_ACCESS_TOKEN: z.string().trim().min(1).regex(/^\S+$/),
});

export type ThreadsConfig = Readonly<z.infer<typeof threadsEnvSchema>>;

export function parseThreadsEnv(input: NodeJS.ProcessEnv): ThreadsConfig {
  const result = threadsEnvSchema.safeParse(input);

  if (!result.success) {
    // Never include configuration values or raw Zod errors containing secrets.
    throw new Error('Missing or invalid Threads configuration: THREADS_ACCESS_TOKEN');
  }

  return Object.freeze(result.data);
}
