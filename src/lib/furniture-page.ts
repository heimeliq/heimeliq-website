import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { FurnitureItem } from './furniture-sync.js';

export interface DownloadLink { label: string; href: string; ext: string }
export interface PartRow { id: string; name: string; dim: string; mass: string }
export interface ExtPartRow { id: string; name: string; spec: string; qty: number }

export interface FurniturePage {
  readmeContent: string;
  galleryImages: string[];
  downloads: DownloadLink[];
  ownParts: PartRow[];
  extParts: ExtPartRow[];
  dim: { width: number; depth: number; height: number } | undefined;
  massKg: string | null;
}

function getPartExports(part: FurnitureItem['okh']['part'] extends Array<infer T> ? T : never): string[] {
  // Use bracket notation to avoid `export` keyword parsing issues
  const raw = part['export'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
}

export function buildFurniturePage(item: FurnitureItem): FurniturePage {
  // README
  const readmePath = join(item.repoPath, 'README.md');
  const readmeContent = existsSync(readmePath) ? readFileSync(readmePath, 'utf-8') : '';

  // Galerie
  const galleryDir = join(item.repoPath, 'media', 'gallery');
  const galleryImages: string[] = existsSync(galleryDir)
    ? readdirSync(galleryDir)
        .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
        .map(f => `/moebel/${item.slug}/media/gallery/${f}`)
    : [];

  // Download-Links
  const downloads: DownloadLink[] = (item.okh.part ?? []).flatMap(part => {
    return getPartExports(part as never).map(exp => {
      const filename = exp.split('/').pop() ?? exp;
      const ext = filename.split('.').pop()?.toUpperCase() ?? '?';
      return { label: `${part.name} – ${ext}`, href: `/moebel/${item.slug}/${exp}`, ext };
    });
  });

  // Eigene Bauteile
  const ownParts: PartRow[] = (item.okh.part ?? []).map(part => {
    const d = part['outer-dimensions'];
    return {
      id: part['heimeliq-part-id'] ?? '–',
      name: part.name,
      dim: d ? `${d.width}×${d.depth}×${d.height}` : '–',
      mass: part.mass ? `${(Number(part.mass) / 1000).toFixed(2)} kg` : '–',
    };
  });

  // Externe Teile
  const extParts: ExtPartRow[] = (item.heimeliq.external_parts ?? []).map(p => ({
    id: p['heimeliq-part-id'],
    name: p.name,
    spec: [p.standard, p.dimensions].filter(Boolean).join(' · ') || '–',
    qty: p.quantity,
  }));

  const dim = item.okh['outer-dimensions'];
  const massKg = item.okh.mass ? (Number(item.okh.mass) / 1000).toFixed(1) : null;

  return { readmeContent, galleryImages, downloads, ownParts, extParts, dim, massKg };
}
