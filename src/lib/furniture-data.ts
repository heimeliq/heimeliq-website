import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncFurniture, type FurnitureItem } from './furniture-sync.js';

export type { FurnitureItem };

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let _cache: FurnitureItem[] | null = null;

export async function getFurnitureItems(): Promise<FurnitureItem[]> {
  if (!_cache) {
    _cache = await syncFurniture(PROJECT_ROOT);
  }
  return _cache;
}

export async function getPublishedFurniture(): Promise<FurnitureItem[]> {
  return (await getFurnitureItems()).filter(i => i.published);
}

/** Copy media/ and cad/ from each published repo into public/moebel/<slug>/. */
export function copyFurnitureMedia(items: FurnitureItem[]): void {
  for (const item of items.filter(i => i.published)) {
    const destBase = join(PROJECT_ROOT, 'public', 'moebel', item.slug);
    for (const subdir of ['media', 'cad']) {
      const src = join(item.repoPath, subdir);
      if (existsSync(src)) {
        mkdirSync(join(destBase, subdir), { recursive: true });
        cpSync(src, join(destBase, subdir), { recursive: true });
      }
    }
  }
}
