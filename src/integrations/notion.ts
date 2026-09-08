import { Client, isFullDataSource } from '@notionhq/client';

import type { NotionConfig } from '../config/notion.js';

export interface NotionSchemaSummary {
  dataSourceId: string;
  title: string;
  properties: Array<{ name: string; type: string; options: string[] }>;
}

export function createNotionClient(config: NotionConfig): Client {
  return new Client({
    auth: config.NOTION_ACCESS_TOKEN,
    notionVersion: '2026-03-11',
    timeoutMs: 15_000,
    retry: false,
    logger: () => {
      // The caller will handle errors without logging raw SDK responses.
    },
  });
}

export async function readNotionSchema(
  client: Client,
  dataSourceId: string,
): Promise<NotionSchemaSummary> {
  const source = await client.dataSources.retrieve({ data_source_id: dataSourceId });

  if (!isFullDataSource(source)) {
    throw new Error('Notion returned an incomplete data source.');
  }

  return {
    dataSourceId: source.id,
    title: source.title.map((part) => part.plain_text).join(''),
    properties: Object.entries(source.properties).map(([name, property]) => ({
      name,
      type: property.type,
      options:
        property.type === 'status'
          ? property.status.options.map((option) => option.name)
          : property.type === 'select'
            ? property.select.options.map((option) => option.name)
            : [],
    })),
  };
}
