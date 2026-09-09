import { Client } from '@notionhq/client';
import type { PageObjectResponse, RichTextItemResponse } from '@notionhq/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import * as notion from '../src/integrations/notion.js';
import { NotionPostDataError, readReadyNotionPosts } from '../src/integrations/notion-posts.js';

type QueryResponse = Awaited<ReturnType<Client['dataSources']['query']>>;

function richText(text: string): RichTextItemResponse {
  return {
    type: 'text',
    text: { content: text, link: null },
    plain_text: text,
    href: null,
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
    },
  };
}

function readyPage(id = 'test-page'): PageObjectResponse {
  return {
    object: 'page',
    id,
    created_time: '2026-09-08T00:00:00.000Z',
    last_edited_time: '2026-09-08T00:00:00.000Z',
    archived: false,
    in_trash: false,
    is_archived: false,
    is_locked: false,
    url: 'https://www.notion.so/test-page',
    public_url: null,
    parent: { type: 'page_id', page_id: 'parent-page' },
    icon: null,
    cover: null,
    created_by: { object: 'user', id: 'test-user' },
    last_edited_by: { object: 'user', id: 'test-user' },
    properties: {
      Name: { id: 'title', type: 'title', title: [richText('First text')] },
      Text: { id: 'text', type: 'rich_text', rich_text: [richText('Hello!')] },
      Topic: {
        id: 'topic',
        type: 'select',
        select: { id: 'general', name: 'general', color: 'default' },
      },
      Status: {
        id: 'status',
        type: 'status',
        status: { id: 'ready', name: 'ready', color: 'default' },
      },
    },
  };
}

function queryResult(
  results: QueryResponse['results'],
  nextCursor: string | null = null,
): QueryResponse {
  return {
    object: 'list',
    type: 'page_or_data_source',
    page_or_data_source: {},
    results,
    has_more: nextCursor !== null,
    next_cursor: nextCursor,
  };
}

function setup(results: QueryResponse['results'] = [readyPage()]): {
  client: Client;
  query: MockInstance<Client['dataSources']['query']>;
} {
  const client = new Client({
    auth: 'test-token',
    fetch: vi.fn(async () => {
      throw new Error('Network is disabled in this test.');
    }),
    retry: false,
    logger: () => {
      // Suppress SDK logging in tests.
    },
  });

  vi.spyOn(notion, 'readNotionSchema').mockResolvedValue({
    dataSourceId: 'test-source',
    title: 'Test posts',
    properties: [
      { name: 'Name', type: 'title', options: [] },
      { name: 'Text', type: 'rich_text', options: [] },
      { name: 'Topic', type: 'select', options: [] },
      { name: 'Status', type: 'status', options: ['draft', 'ready', 'published'] },
    ],
  });

  const query = vi.spyOn(client.dataSources, 'query').mockResolvedValue(queryResult(results));

  return { client, query };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Notion to ContentPost mapping', () => {
  it('returns the domain fields without mutating or exposing the raw page', async () => {
    const page = readyPage();
    const original = structuredClone(page);
    const { client } = setup([page]);

    await expect(readReadyNotionPosts(client, 'test-source')).resolves.toEqual([
      {
        notionPageId: 'test-page',
        title: 'First text',
        text: 'Hello!',
        topic: 'general',
        status: 'ready',
        xPostId: null,
        xUrl: null,
        publishedAt: null,
      },
    ]);
    expect(page).toEqual(original);
  });

  it.each(['draft'])(
    'rejects a returned non-ready status %j',
    async (status) => {
      const page = readyPage();

      page.properties.Status = {
        id: 'status',
        type: 'status',
        status: status === null ? null : { id: status, name: status, color: 'default' },
      };
      const { client } = setup([page]);

      await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
        'A returned post is no longer ready. Run the query again.',
      );
    },
  );

  it('rejects an empty rich-text array without returning an earlier valid post', async () => {
    const invalid = readyPage('empty-post');

    invalid.properties.Text = { id: 'text', type: 'rich_text', rich_text: [] };
    const { client } = setup([readyPage(), invalid]);

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
      'Ready post empty-post: Text must not be empty or whitespace-only.',
    );
  });
});

describe('Notion query results and pagination', () => {
  it('returns an empty list when there are no ready pages', async () => {
    const { client } = setup([]);

    await expect(readReadyNotionPosts(client, 'test-source')).resolves.toEqual([]);
  });

  it.each(['in_trash'] as const)('skips %s pages', async (flag) => {
    const ignored = readyPage('ignored-page');

    ignored[flag] = true;
    ignored.properties = {};
    const { client } = setup([ignored, readyPage()]);

    const posts = await readReadyNotionPosts(client, 'test-source');

    expect(posts.map((post) => post.notionPageId)).toEqual(['test-page']);
  });

  it('rejects partial pages', async () => {
    const { client } = setup([{ object: 'page', id: 'partial-page' }]);

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
      'Notion returned an entry without full page properties.',
    );
  });

  it('reads subsequent pages using the cursor and reads the schema only once', async () => {
    const { client, query } = setup();

    query
      .mockResolvedValueOnce(queryResult([readyPage('first')], 'next-page'))
      .mockResolvedValueOnce(queryResult([readyPage('second')]));

    const posts = await readReadyNotionPosts(client, 'test-source');

    expect(posts.map((post) => post.notionPageId)).toEqual(['first', 'second']);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(2, {
      data_source_id: 'test-source',
      filter: { property: 'Status', status: { equals: 'ready' } },
      page_size: 100,
      start_cursor: 'next-page',
    });
    expect(notion.readNotionSchema).toHaveBeenCalledExactlyOnceWith(client, 'test-source');
  });

  it('rejects incomplete query results', async () => {
    const { client, query } = setup();

    query.mockResolvedValue({
      ...queryResult([readyPage()]),
      request_status: { type: 'incomplete', incomplete_reason: 'query_result_limit_reached' },
    });

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
      'Notion returned an incomplete query result.',
    );
  });

  it('rejects a missing cursor when more results are announced', async () => {
    const { client, query } = setup();

    query.mockResolvedValue({ ...queryResult([]), has_more: true });

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
      'Notion returned an incomplete pagination response.',
    );
  });

  it('rejects a repeated cursor instead of looping indefinitely', async () => {
    const { client, query } = setup();

    query.mockResolvedValue(queryResult([], 'same-cursor'));

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(
      'Notion returned a repeated pagination cursor.',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a failed later query without returning a partial list', async () => {
    const { client, query } = setup();
    const error = new Error('Second query failed.');

    query
      .mockResolvedValueOnce(queryResult([readyPage()], 'next-page'))
      .mockRejectedValueOnce(error);

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toBe(error);
  });
});
