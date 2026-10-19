import { z } from 'zod';

// Normalize before indexing so different UUID spellings cannot bypass the claim.
export const notionPageIdSchema = z.string()
  .transform((value) => value.replaceAll('-', '').toLowerCase())
  .pipe(z.string().regex(/^[0-9a-f]{32}$/));

export const publicationClaimSchema = z.object({
  notionPageId: notionPageIdSchema,
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  threadsUserId: z.string().regex(/^\d+$/),
});

export const claimedPublicationSchema = publicationClaimSchema.extend({
  claimId: z.uuid(),
  state: z.literal('claimed'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PublicationClaimInput = z.infer<typeof publicationClaimSchema>;
export type ClaimedPublication = z.infer<typeof claimedPublicationSchema>;

const containerPublicationSchema = claimedPublicationSchema.extend({
  state: z.literal('container_created'),
  threadsContainerId: z.string().regex(/^\d+$/),
});
const startedPublicationSchema = containerPublicationSchema.extend({
  state: z.literal('publish_started'),
});
const publishedPublicationSchema = startedPublicationSchema.extend({
  state: z.literal('published'),
  threadsPostId: z.string().regex(/^\d+$/),
  publishedAt: z.date(),
  threadsUrl: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'].includes(url.hostname);
  }).optional(),
});

const syncedPublicationSchema = publishedPublicationSchema.extend({
  state: z.literal('notion_synced'),
  notionSyncedAt: z.date(),
});

export type PublishedPublication = z.infer<typeof publishedPublicationSchema>;

export const publicationSchema = z.discriminatedUnion('state', [
  claimedPublicationSchema,
  containerPublicationSchema,
  startedPublicationSchema,
  publishedPublicationSchema,
  syncedPublicationSchema,
]);

export type Publication = z.infer<typeof publicationSchema>;
