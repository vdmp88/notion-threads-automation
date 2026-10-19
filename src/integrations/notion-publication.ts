import { createHash } from 'node:crypto';

import { isFullPage, type Client } from '@notionhq/client';

import type { ContentPost, ReadyContentPost } from '../domain/content-post.js';
import { notionPageIdSchema, type PublishedPublication } from '../domain/publication.js';
import { readNotionSchema } from './notion.js';
import { NotionSchemaError, validateNotionPostSchema } from './notion-schema.js';

export class NotionPublicationDataError extends Error {}

export async function validateNotionPublicationSchema(client: Client, dataSourceId: string): Promise<void> {
  const schema = await readNotionSchema(client, dataSourceId);
  validateNotionPostSchema(schema);
  for (const [name, type] of [
    ['Threads Post ID', 'rich_text'], ['Threads URL', 'url'], ['Published At', 'date'],
  ] as const) {
    if (schema.properties.find((property) => property.name === name)?.type !== type) {
      throw new NotionSchemaError(`Notion publication schema: "${name}" must exist with type "${type}".`);
    }
  }
}

// Separate from the Stage 2 preview: publishing must never consume null placeholders.
export async function readNotionPublicationPost(
  client: Client, dataSourceId: string, pageId: string,
): Promise<ContentPost> {
  const id = notionPageIdSchema.safeParse(pageId);
  if (!id.success) throw new NotionPublicationDataError('Invalid Notion page ID.');
  const page = await client.pages.retrieve({ page_id: id.data });
  if (!isFullPage(page) || page.archived || page.in_trash || page.is_archived ||
    page.parent.type !== 'data_source_id' ||
    notionPageIdSchema.parse(page.parent.data_source_id) !== notionPageIdSchema.parse(dataSourceId) ||
    notionPageIdSchema.parse(page.id) !== id.data) {
    throw new NotionPublicationDataError('Page is unavailable or outside the configured Notion data source.');
  }
  const p = page.properties;
  const name = p.Name;
  const text = p.Text;
  const topic = p.Topic;
  const status = p.Status;
  const postId = p['Threads Post ID'];
  const url = p['Threads URL'];
  const date = p['Published At'];
  if (name?.type !== 'title' || text?.type !== 'rich_text' || topic?.type !== 'select' ||
    status?.type !== 'status' || postId?.type !== 'rich_text' || url?.type !== 'url' || date?.type !== 'date') {
    throw new NotionPublicationDataError('Page is missing editorial or publication properties. Run publication schema preflight.');
  }
  const state = status.status?.name;
  if (state !== 'draft' && state !== 'ready' && state !== 'published') {
    throw new NotionPublicationDataError('Unsupported Notion editorial status.');
  }
  // Retrieve-page rich text can be incomplete for complex properties. Fail closed;
  // the initial text-only publisher supports plain text with fewer than 25 spans.
  if (text.rich_text.length >= 25 || text.rich_text.some((part) => part.type !== 'text') ||
    postId.rich_text.length >= 25 || postId.rich_text.some((part) => part.type !== 'text')) {
    throw new NotionPublicationDataError('Text and Threads Post ID must use plain text with fewer than 25 formatting spans.');
  }
  const storedId = postId.rich_text.map((part) => part.plain_text).join('');
  if (storedId && !/^\d+$/.test(storedId)) {
    throw new NotionPublicationDataError('Threads Post ID is not a numeric identifier. Manual review required.');
  }
  const publishedAt = date.date ? new Date(date.date.start) : null;
  if (publishedAt && (Number.isNaN(publishedAt.getTime()) || date.date?.end)) {
    throw new NotionPublicationDataError('Published At must contain one valid date, not a range.');
  }
  return {
    notionPageId: id.data,
    title: name.title.map((part) => part.plain_text).join(''),
    text: text.rich_text.map((part) => part.plain_text).join(''),
    topic: topic.select?.name ?? null,
    status: state,
    threadsPostId: storedId || null,
    threadsUrl: url.url,
    publishedAt,
  };
}

export function requireReadyPost(post: ContentPost): ReadyContentPost {
  if (post.status !== 'ready') throw new NotionPublicationDataError('Notion page must have Status=ready.');
  return { ...post, status: 'ready' };
}

function samePublicationMinute(actual: Date | null, expected: Date): boolean {
  // Observed Notion readback drops seconds and milliseconds. Compare UTC minute
  // buckets, not a sliding 60-second tolerance; keep the ledger timestamp intact.
  return actual !== null &&
    Math.floor(actual.getTime() / 60_000) === Math.floor(expected.getTime() / 60_000);
}

export function assertNotionSyncCompatible(post: ContentPost, result: PublishedPublication): void {
  if (notionPageIdSchema.parse(post.notionPageId) !== result.notionPageId ||
    createHash('sha256').update(post.text, 'utf8').digest('hex') !== result.contentHash ||
    (post.status !== 'ready' && post.status !== 'published') ||
    (post.threadsPostId !== null && post.threadsPostId !== result.threadsPostId) ||
    (post.threadsUrl !== null && post.threadsUrl !== result.threadsUrl) ||
    (post.publishedAt !== null && !samePublicationMinute(post.publishedAt, result.publishedAt)) ||
    (post.status === 'published' && post.threadsPostId !== result.threadsPostId)) {
    throw new NotionPublicationDataError('Notion content or publication metadata conflicts with the saved result. Manual review required; no overwrite.');
  }
}

export async function writeNotionPublication(
  client: Client, dataSourceId: string, result: PublishedPublication,
  options: { dryRun: boolean },
): Promise<void> {
  if (options.dryRun !== false || !result.threadsUrl) {
    throw new NotionPublicationDataError('Notion writes require live mode and a saved post URL.');
  }
  await validateNotionPublicationSchema(client, dataSourceId);
  const current = await readNotionPublicationPost(client, dataSourceId, result.notionPageId);
  assertNotionSyncCompatible(current, result);
  // Only result fields change; never write title, text, or topic. No SDK retries.
  await client.pages.update({
    page_id: result.notionPageId,
    properties: {
      'Threads Post ID': { rich_text: [{ type: 'text', text: { content: result.threadsPostId } }] },
      'Threads URL': { url: result.threadsUrl },
      'Published At': { date: { start: result.publishedAt.toISOString() } },
      Status: { status: { name: 'published' } },
    },
  });
  const saved = await readNotionPublicationPost(client, dataSourceId, result.notionPageId);
  assertNotionSyncCompatible(saved, result);
  if (saved.status !== 'published' || saved.threadsPostId !== result.threadsPostId ||
    saved.threadsUrl !== result.threadsUrl || !samePublicationMinute(saved.publishedAt, result.publishedAt)) {
    throw new NotionPublicationDataError('Notion result could not be verified. Retry synchronization only, never publication.');
  }
}
