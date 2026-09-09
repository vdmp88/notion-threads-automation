import { Client, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client';

import type { ReadyContentPost } from '../domain/content-post.js';
import { postTextSchema } from '../domain/post-text.js';
import { readNotionSchema } from './notion.js';
import { validateNotionPostSchema } from './notion-schema.js';

export class NotionPostDataError extends Error {}

function mapReadyPost(page: PageObjectResponse): ReadyContentPost {
  const { Name: name, Text: text, Topic: topic, Status: status } = page.properties;

  if (
    name?.type !== 'title' ||
    text?.type !== 'rich_text' ||
    topic?.type !== 'select' ||
    status?.type !== 'status'
  ) {
    throw new NotionPostDataError(
      'A post has missing or incorrectly typed Name, Text, Topic, or Status.',
    );
  }

  if (status.status?.name !== 'ready') {
    throw new NotionPostDataError('A returned post is no longer ready. Run the query again.');
  }

  const parsedText = postTextSchema.safeParse(
    text.rich_text.map((part) => part.plain_text).join(''),
  );

  if (!parsedText.success) {
    throw new NotionPostDataError(
      `Ready post ${page.id}: Text must not be empty or whitespace-only.`,
    );
  }

  return {
    notionPageId: page.id,
    title: name.title.map((part) => part.plain_text).join(''),
    text: parsedText.data,
    topic: topic.select?.name ?? null,
    status: 'ready',
    // Publication metadata is not loaded yet; null is not proof of no prior publication.
    xPostId: null,
    xUrl: null,
    publishedAt: null,
  };
}

export async function readReadyNotionPosts(
  client: Client,
  dataSourceId: string,
): Promise<ReadyContentPost[]> {
  const schema = await readNotionSchema(client, dataSourceId);

  validateNotionPostSchema(schema);

  const posts: ReadyContentPost[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const response = await client.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: 'Status', status: { equals: 'ready' } },
      page_size: 100,
      start_cursor: cursor,
    });

    if (response.request_status?.type === 'incomplete') {
      throw new NotionPostDataError('Notion returned an incomplete query result.');
    }

    for (const page of response.results) {
      if (!isFullPage(page)) {
        throw new NotionPostDataError('Notion returned an entry without full page properties.');
      }

      if (!page.archived && !page.in_trash && !page.is_archived) {
        posts.push(mapReadyPost(page));
      }
    }

    if (response.has_more && !response.next_cursor) {
      throw new NotionPostDataError('Notion returned an incomplete pagination response.');
    }

    cursor = response.has_more ? response.next_cursor : null;

    if (cursor !== null) {
      if (seenCursors.has(cursor)) {
        throw new NotionPostDataError('Notion returned a repeated pagination cursor.');
      }

      seenCursors.add(cursor);
    }
  } while (cursor !== null);

  return posts;
}
