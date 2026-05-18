import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseTOML } from 'smol-toml';
import Ajv, { type ErrorObject } from 'ajv';
import simpleGit from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OkhPart {
  name: string;
  source?: string | string[];
  export?: string | string[];
  mass?: number;
  'heimeliq-part-id'?: string;
  tsdc?: string | string[];
  'outer-dimensions'?: { width: number; depth: number; height: number };
}

export interface OkhImage {
  location: string;
  slots?: string[];
  tags?: string[];
  depicts?: string;
}

export interface OkhManifest {
  okhv: string;
  name: string;
  repo: string;
  license: string;
  licensor: string | string[];
  function: string;
  'documentation-language'?: string;
  'documentation-readiness-level'?: string;
  tsdc?: string | string[];
  organization?: Array<{ name: string; url?: string }>;
  'outer-dimensions'?: { width: number; depth: number; height: number };
  mass?: number;
  image?: OkhImage | OkhImage[];
  'manufacturing-instructions'?: string;
  bom?: string;
  readme?: string;
  part?: OkhPart[];
  [key: string]: unknown;
}

export interface ExternalPart {
  'heimeliq-part-id': string;
  name: string;
  standard?: string;
  material?: string;
  dimensions?: string;
  quantity: number;
  suppliers?: string[];
}

export interface WoodOption {
  species: string;
  origin?: string;
  recommended?: boolean;
}

export interface HeimeliQManifest {
  'heimeliq-template-version': string;
  version: string;
  slug: string;
  series: 'massiq' | 'workaholiq' | 'keiliq';
  type: string;
  status: 'draft' | 'published' | 'archived';
  external_parts?: ExternalPart[];
  wood_options?: WoodOption[];
  care?: { surface_treatment?: string; recommended_products?: string[] };
  sustainability?: { wood_source?: string; co2_documented?: boolean };
  [key: string]: unknown;
}

export interface FurnitureItem {
  slug: string;
  name: string;
  series: string;
  version: string;
  repoPath: string;
  published: boolean;
  okh: OkhManifest;
  heimeliq: HeimeliQManifest;
}

interface RepoEntry {
  url: string;
  version: string;
  published: boolean;
}

// ─── Validators ──────────────────────────────────────────────────────────────

// strict:false + logger:false silences unknown-format noise from the OKH schema
// (uri, email, date). Structural validation still catches real errors.
const ajv = new Ajv({ strict: false, allErrors: true, logger: false });

const heimeliqSchema = JSON.parse(
  readFileSync(join(PROJECT_ROOT, 'src/lib/schemas/heimeliq.schema.json'), 'utf-8'),
) as object;
const okhSchema = JSON.parse(
  readFileSync(join(PROJECT_ROOT, 'src/lib/schemas/okh.schema.json'), 'utf-8'),
) as object;

const validateHeimeliQ = ajv.compile(heimeliqSchema);
const validateOkh = ajv.compile(okhSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * smol-toml may return BigInt for large integers and Date objects for datetimes.
 * JSON Schema validators expect plain numbers/strings, so we normalize here.
 */
function normalizeTOML(val: unknown): unknown {
  if (typeof val === 'bigint') return Number(val);
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(normalizeTOML);
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, normalizeTOML(v)]),
    );
  }
  return val;
}

function fmtErrors(errors: ErrorObject[]): string {
  return errors
    .map(e => `  • ${e.instancePath || '(root)'} ${e.message ?? ''}`)
    .join('\n');
}

function deriveCacheName(url: string): string {
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const last = segments.at(-1) ?? '';
  return last.replace(/\.git$/, '');
}

function validateEntry(entry: unknown, idx: number): RepoEntry {
  if (typeof entry !== 'object' || entry === null)
    throw new Error(`furniture-repos.json: repos[${idx}] ist kein Objekt`);

  const e = entry as Record<string, unknown>;

  // Accept https://, http://, and file:// for local testing
  if (typeof e.url !== 'string') {
    throw new Error(`furniture-repos.json: repos[${idx}].url muss ein String sein`);
  }
  try { new URL(e.url); } catch {
    throw new Error(`furniture-repos.json: repos[${idx}].url ist keine gültige URL ("${e.url}")`);
  }

  if (typeof e.version !== 'string' || !e.version)
    throw new Error(`furniture-repos.json: repos[${idx}].version muss ein nicht-leerer String sein`);

  if (typeof e.published !== 'boolean')
    throw new Error(`furniture-repos.json: repos[${idx}].published muss true oder false sein`);

  return e as unknown as RepoEntry;
}

// ─── Git Sync ────────────────────────────────────────────────────────────────

async function syncRepo(entry: RepoEntry, repoPath: string): Promise<void> {
  const hasGitDir = existsSync(join(repoPath, '.git'));

  if (hasGitDir) {
    const git = simpleGit(repoPath);
    await git.fetch(['--tags', '--force']);
    if (entry.version === 'main') {
      await git.checkout('main');
      await git.pull('origin', 'main', ['--ff-only']);
    } else {
      await git.checkout(`v${entry.version}`);
    }
  } else {
    mkdirSync(repoPath, { recursive: true });
    await simpleGit().clone(entry.url, repoPath);
    if (entry.version !== 'main') {
      await simpleGit(repoPath).checkout(`v${entry.version}`);
    }
  }
}

// ─── Parse & Validate ────────────────────────────────────────────────────────

function parseAndValidate(
  repoPath: string,
  repoUrl: string,
): { okh: OkhManifest; heimeliq: HeimeliQManifest } {
  for (const file of ['okh.toml', 'heimeliq.toml', 'README.md']) {
    if (!existsSync(join(repoPath, file))) {
      throw new Error(`[${repoUrl}] Pflichtdatei fehlt: ${file}`);
    }
  }

  const okhRaw = normalizeTOML(
    parseTOML(readFileSync(join(repoPath, 'okh.toml'), 'utf-8')),
  );
  const heimeliqRaw = normalizeTOML(
    parseTOML(readFileSync(join(repoPath, 'heimeliq.toml'), 'utf-8')),
  );

  if (!validateOkh(okhRaw)) {
    throw new Error(
      `[${repoUrl}] okh.toml Validierungsfehler:\n${fmtErrors(validateOkh.errors ?? [])}`,
    );
  }

  if (!validateHeimeliQ(heimeliqRaw)) {
    throw new Error(
      `[${repoUrl}] heimeliq.toml Validierungsfehler:\n${fmtErrors(validateHeimeliQ.errors ?? [])}`,
    );
  }

  return {
    okh: okhRaw as unknown as OkhManifest,
    heimeliq: heimeliqRaw as unknown as HeimeliQManifest,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sync all furniture repos from furniture-repos.json and return parsed items.
 * Items with published:false are included in the list but excluded from builds
 * by the Astro pages (filter on item.published).
 */
export async function syncFurniture(projectRoot = PROJECT_ROOT): Promise<FurnitureItem[]> {
  const reposFile = join(projectRoot, 'furniture-repos.json');
  const cacheDir = join(projectRoot, '.furniture-cache');

  const config = JSON.parse(readFileSync(reposFile, 'utf-8')) as { repos: unknown[] };
  if (!Array.isArray(config.repos))
    throw new Error('furniture-repos.json: "repos" muss ein Array sein');

  const entries = config.repos.map((e, i) => validateEntry(e, i));
  mkdirSync(cacheDir, { recursive: true });

  const items: FurnitureItem[] = [];

  for (const entry of entries) {
    const cacheName = deriveCacheName(entry.url);
    if (!cacheName) throw new Error(`Kann keinen Cache-Namen aus URL ableiten: ${entry.url}`);
    const repoPath = join(cacheDir, cacheName);

    console.log(`→ Sync  ${cacheName}  (${entry.version})`);
    await syncRepo(entry, repoPath);

    console.log(`  Validiere ${cacheName}…`);
    const { okh, heimeliq } = parseAndValidate(repoPath, entry.url);

    items.push({
      slug: heimeliq.slug,
      name: okh.name,
      series: heimeliq.series,
      version: heimeliq.version,
      repoPath,
      published: entry.published,
      okh,
      heimeliq,
    });

    console.log(`  ✓ ${heimeliq.slug}  series=${heimeliq.series}  published=${entry.published}`);
  }

  return items;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (process.argv[1] === __filename) {
  syncFurniture()
    .then(items => {
      console.log(`\n✓ ${items.length} Möbel synchronisiert`);
      for (const item of items)
        console.log(`  ${item.slug}  (${item.series}, v${item.version}, published=${item.published})`);
    })
    .catch((err: Error) => {
      console.error(`\n✗ Sync fehlgeschlagen: ${err.message}`);
      process.exit(1);
    });
}
