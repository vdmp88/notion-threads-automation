import { Client, isFullPage } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client';

import { postTextSchema } from '../domain/post-text.js';

export interface ReadyPostPreview {
  notionPageId: string;
  title: string;
  text: string;
  topic: string | null;
  status: 'ready';
}

export class NotionPostDataError extends Error {}

function mapReadyPost(page: PageObjectResponse): ReadyPostPreview {
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

  const parsedText = postTextSchema.safeParse(text.rich_text.map((part) => part.plain_text).join(''));

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
  };
}

export async function readReadyNotionPosts(
  client: Client,
  dataSourceId: string,
): Promise<ReadyPostPreview[]> {
  const posts: ReadyPostPreview[] = [];
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
  } while (cursor !== null);

  return posts;
}
