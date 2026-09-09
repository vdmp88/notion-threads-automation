import { Client } from '@notionhq/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import * as notion from '../src/integrations/notion.js';
import type { NotionSchemaSummary } from '../src/integrations/notion.js';
import { readReadyNotionPosts } from '../src/integrations/notion-posts.js';
import { NotionSchemaError, validateNotionPostSchema } from '../src/integrations/notion-schema.js';

function validSchema(): NotionSchemaSummary {
  return {
    dataSourceId: 'test-source',
    title: 'Test posts',
    properties: [
      { name: 'Name', type: 'title', options: [] },
      { name: 'Text', type: 'rich_text', options: [] },
      { name: 'Topic', type: 'select', options: [] },
      { name: 'Status', type: 'status', options: ['draft', 'ready', 'published'] },
    ],
  };
}

describe('Notion post schema validation', () => {
  it('accepts the required schema without changing it', () => {
    const schema = validSchema();
    const original = structuredClone(schema);

    expect(() => validateNotionPostSchema(schema)).not.toThrow();
    expect(schema).toEqual(original);
  });

  it.each(['Text'])('rejects missing %s', (name) => {
    const schema = validSchema();

    schema.properties = schema.properties.filter((property) => property.name !== name);

    expect(() => validateNotionPostSchema(schema)).toThrow(NotionSchemaError);
    expect(() => validateNotionPostSchema(schema)).toThrow(
      `Notion schema: missing required property "${name}".`,
    );
  });

  it.each([['Status', 'status']])('rejects the wrong type for %s', (name, expectedType) => {
    const schema = validSchema();

    schema.properties = schema.properties.map((property) =>
      property.name === name ? { ...property, type: 'number' } : property,
    );

    expect(() => validateNotionPostSchema(schema)).toThrow(
      `Notion schema: property "${name}" must have type "${expectedType}".`,
    );
  });

  it.each(['ready'])('requires the exact %s status option', (status) => {
    const schema = validSchema();

    schema.properties = schema.properties.map((property) => ({
      ...property,
      options: property.options.map((option) =>
        option === status ? option.toUpperCase() : option,
      ),
    }));

    expect(() => validateNotionPostSchema(schema)).toThrow(
      `Notion schema: property "Status" must include option "${status}".`,
    );
  });
});

describe('schema validation before reading ready posts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(): {
    client: Client;
    readSchema: MockInstance<typeof notion.readNotionSchema>;
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
    const readSchema = vi.spyOn(notion, 'readNotionSchema').mockResolvedValue(validSchema());
    const query = vi.spyOn(client.dataSources, 'query').mockResolvedValue({
      object: 'list',
      type: 'page_or_data_source',
      page_or_data_source: {},
      results: [],
      has_more: false,
      next_cursor: null,
    });

    return { client, readSchema, query };
  }

  it('does not query posts when the schema is invalid', async () => {
    const { client, readSchema, query } = setup();

    readSchema.mockResolvedValue({ ...validSchema(), properties: [] });

    await expect(readReadyNotionPosts(client, 'test-source')).rejects.toThrow(NotionSchemaError);
    expect(query).not.toHaveBeenCalled();
  });

});
