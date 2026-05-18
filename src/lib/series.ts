import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../content/series');

export interface SeriesData {
  id: string;
  name: string;
  tagline: string;
  color_accent: string;
  story: string;
}

const SERIES_IDS = ['massiq', 'workaholiq', 'keiliq'] as const;
export type SeriesId = (typeof SERIES_IDS)[number];

function loadSeries(id: string): SeriesData {
  const json = JSON.parse(
    readFileSync(join(CONTENT_DIR, id, 'series.json'), 'utf-8'),
  ) as Omit<SeriesData, 'story'>;
  let story = '';
  try { story = readFileSync(join(CONTENT_DIR, id, 'story.md'), 'utf-8'); } catch { /* ok */ }
  return { ...json, story };
}

export function getAllSeries(): SeriesData[] {
  return SERIES_IDS.map(loadSeries);
}

export function getSeries(id: string): SeriesData | undefined {
  if (!SERIES_IDS.includes(id as SeriesId)) return undefined;
  return loadSeries(id);
}
