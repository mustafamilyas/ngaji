/**
 * In-process keyed mutex. Valid because the app is a single long-running
 * Node process (DESIGN.md §8). Multiple keys are acquired in sorted order so
 * two callers passing the same keys in different orders cannot deadlock.
 */
const tails = new Map<string, Promise<void>>();

async function acquire(key: string): Promise<() => void> {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(key, tail);
  await previous;
  return () => {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  };
}

export async function withKeyedLock<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(keys)].sort();
  const releases: Array<() => void> = [];
  try {
    for (const key of sorted) releases.push(await acquire(key));
    return await fn();
  } finally {
    for (const release of releases.reverse()) release();
  }
}
