import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function resolveDataDir(configuredDir: string | undefined, fallbackDir: string): string {
  return configuredDir?.trim() || fallbackDir;
}

export function createPlayStore(dataDir: string) {
  const filePath = path.join(dataDir, 'plays.json');
  return {
    filePath,
    async read<T>(): Promise<T[]> {
      try { return JSON.parse(await readFile(filePath, 'utf8')) as T[]; }
      catch { return []; }
    },
    async write<T>(plays: T[]): Promise<void> {
      await mkdir(dataDir, { recursive: true });
      await writeFile(filePath, `${JSON.stringify(plays, null, 2)}\n`, 'utf8');
    },
  };
}
