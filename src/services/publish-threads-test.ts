import { setTimeout as delay } from 'node:timers/promises';

import type { ThreadsConfig } from '../config/threads.js';
import { validateThreadsText } from '../domain/threads-text.js';
import { readThreadsProfile } from '../integrations/threads.js';
import {
  createTextContainer,
  publishContainer,
  readContainerStatus,
  readPostPermalink,
} from '../integrations/threads-publishing.js';

export class TestPublicationError extends Error {}

export async function publishThreadsTest(input: {
  text: string;
  dryRun: boolean;
  config?: ThreadsConfig;
  confirm: (message: string) => Promise<boolean>;
  report: (message: string) => void;
}, dependencies = {
  readThreadsProfile, createTextContainer, readContainerStatus, publishContainer,
  readPostPermalink, delay,
}): Promise<void> {
  const { countedLength } = validateThreadsText(input.text);

  if (input.dryRun) {
    input.report(JSON.stringify({ dryRun: true, text: input.text, countedLength, writes: false }, null, 2));
    return;
  }

  if (!input.config) throw new TestPublicationError('Threads configuration is required.');
  const config = input.config;
  const profile = await dependencies.readThreadsProfile(config);
  input.report(JSON.stringify({ account: profile, text: input.text, countedLength }, null, 2));

  if (!(await input.confirm('Create a real Threads container for this text and account?'))) {
    input.report('Cancelled. No container created.');
    return;
  }

  const containerId = await dependencies.createTextContainer(config, input.text);
  input.report(`Container created: ${containerId}. Not published yet.`);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await dependencies.readContainerStatus(config, containerId);
    if (status === 'FINISHED') {
      if (!(await input.confirm(`Publish container ${containerId} publicly now?`))) {
        input.report('Cancelled. Container was not published by this command.');
        return;
      }
      const threadsPostId = await dependencies.publishContainer(config, containerId);
      // Report success before the optional lookup: a failed GET must not hide publication.
      input.report(JSON.stringify({ published: true, threadsPostId, containerId }, null, 2));
      try {
        const threadsUrl = await dependencies.readPostPermalink(config, threadsPostId);
        input.report(JSON.stringify({ threadsUrl }, null, 2));
      } catch {
        input.report(`Published successfully (${threadsPostId}), but URL lookup failed. Do not republish; use threads:status -- --post ${threadsPostId}.`);
      }
      return;
    }
    if (status !== 'IN_PROGRESS') {
      throw new TestPublicationError(`Container ${containerId}: ${status}. Stopped; no publish request sent.`);
    }
    if (attempt < 11) await dependencies.delay(5_000);
  }

  throw new TestPublicationError(`Container ${containerId} is not ready. Stopped without publishing.`);
}
