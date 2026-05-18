import { readFileSync, readdirSync, statSync } from 'node:fs';
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

function listSeriesIds(): string[] {
  return readdirSync(CONTENT_DIR)
    .filter((entry: string) => statSync(join(CONTENT_DIR, entry)).isDirectory())
    .sort();
}

function loadSeries(id: string): SeriesData {
  const json = JSON.parse(
    readFileSync(join(CONTENT_DIR, id, 'series.json'), 'utf-8'),
  ) as Omit<SeriesData, 'story'>;
  let story = '';
  try { story = readFileSync(join(CONTENT_DIR, id, 'story.md'), 'utf-8'); } catch { /* ok */ }
  return { ...json, story };
}

export function getAllSeries(): SeriesData[] {
  return listSeriesIds().map(loadSeries);
}

export function getSeries(id: string): SeriesData | undefined {
  if (!listSeriesIds().includes(id)) return undefined;
  return loadSeries(id);
}
