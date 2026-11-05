import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayStore, resolveDataDir } from './storage.js';

let temporaryDirectory = '';
afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = '';
});

describe('persistent play storage', () => {
  it('uses DATA_DIR when configured and keeps the local fallback otherwise', () => {
    expect(resolveDataDir('/data', 'server/data')).toBe('/data');
    expect(resolveDataDir(undefined, 'server/data')).toBe('server/data');
    expect(resolveDataDir('   ', 'server/data')).toBe('server/data');
  });

  it('reads saved plays from a new store instance after a restart', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'snake-quiz-store-'));
    const plays = [{ id: 'play-1', playerId: 'laptop-1', status: 'finished' }];
    await createPlayStore(temporaryDirectory).write(plays);

    const restartedStore = createPlayStore(temporaryDirectory);
    expect(await restartedStore.read()).toEqual(plays);
    expect(restartedStore.filePath).toBe(path.join(temporaryDirectory, 'plays.json'));
  });
});
