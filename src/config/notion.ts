import { z } from 'zod';

const notionEnvSchema = z.object({
  NOTION_ACCESS_TOKEN: z.string().trim().min(1),
  NOTION_DATA_SOURCE_ID: z.uuid(),
});

export type NotionConfig = Readonly<z.infer<typeof notionEnvSchema>>;

export function parseNotionEnv(input: NodeJS.ProcessEnv): NotionConfig {
  const result = notionEnvSchema.safeParse(input);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');

    // Report field names only: configuration values may contain secrets.
    throw new Error(`Missing or invalid Notion configuration: ${fields}`);
  }

  return Object.freeze(result.data);
}
