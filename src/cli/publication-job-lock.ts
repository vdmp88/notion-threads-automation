import { mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

export class PublicationJobLockError extends Error {}

// Local overlap protection for one checkout. MongoDB claims remain the
// cross-process/cross-host publication guard. Never reclaim a stale lock by age.
export async function acquirePublicationJobLock(root: string): Promise<(() => Promise<void>) | null> {
  const directory = join(root, '.data');
  const lock = join(directory, 'publication-job.lock');
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  } catch {
    throw new PublicationJobLockError('Could not create the local runtime directory.');
  }
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return null;
    throw new PublicationJobLockError('Could not acquire the local publication job lock.');
  }
  return async () => {
    try {
      await rmdir(lock);
    } catch {
      throw new PublicationJobLockError('Could not release the local publication job lock. Inspect it before the next run.');
    }
  };
}
