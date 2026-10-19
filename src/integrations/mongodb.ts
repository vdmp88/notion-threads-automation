import { MongoClient } from 'mongodb';

import type { MongoConfig } from '../config/mongodb.js';

export class MongoConnectionError extends Error {}

export async function connectMongo(config: MongoConfig) {
  let client: MongoClient | undefined;
  try {
    client = new MongoClient(config.MONGODB_URI, {
      appName: 'notion-threads-automation',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
      timeoutMS: 10_000,
      retryWrites: false,
      writeConcern: { w: 'majority', journal: true },
    });
    await client.connect();
    const db = client.db(config.MONGODB_DATABASE);
    await db.command({ ping: 1 });
    const connectedClient = client;
    return {
      db,
      async close(): Promise<void> {
        try {
          await connectedClient.close();
        } catch {
          throw new MongoConnectionError('Could not close the MongoDB connection cleanly.');
        }
      },
    };
  } catch {
    await client?.close().catch(() => undefined);
    throw new MongoConnectionError('Could not connect to MongoDB. Check configuration and database availability.');
  }
}
