import type { NotionSchemaSummary } from './notion.js';

const requiredProperties = [
  { name: 'Name', type: 'title' },
  { name: 'Text', type: 'rich_text' },
  { name: 'Topic', type: 'select' },
  { name: 'Status', type: 'status' },
] as const;

const requiredStatuses = ['draft', 'ready', 'published'] as const;

export class NotionSchemaError extends Error {}

export function validateNotionPostSchema(schema: NotionSchemaSummary): void {
  for (const expected of requiredProperties) {
    const property = schema.properties.find((item) => item.name === expected.name);

    if (!property) {
      throw new NotionSchemaError(`Notion schema: missing required property "${expected.name}".`);
    }

    if (property.type !== expected.type) {
      throw new NotionSchemaError(
        `Notion schema: property "${expected.name}" must have type "${expected.type}".`,
      );
    }

    if (expected.name === 'Status') {
      for (const status of requiredStatuses) {
        if (!property.options.includes(status)) {
          throw new NotionSchemaError(
            `Notion schema: property "Status" must include option "${status}".`,
          );
        }
      }
    }
  }
}
