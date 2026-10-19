import { z } from 'zod';

const mongoEnvSchema = z.object({
  MONGODB_URI: z.string().trim().regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  MONGODB_DATABASE: z.string().regex(/^[a-zA-Z0-9_-]{1,63}$/),
});

export type MongoConfig = Readonly<z.infer<typeof mongoEnvSchema>>;

export function parseMongoEnv(input: NodeJS.ProcessEnv): MongoConfig {
  const result = mongoEnvSchema.safeParse(input);
  if (!result.success) {
    // Never include the URI: a hosted connection string can contain a password.
    throw new Error('Missing or invalid MongoDB configuration: MONGODB_URI, MONGODB_DATABASE.');
  }
  return Object.freeze(result.data);
}
