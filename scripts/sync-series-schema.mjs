#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERIES_DIR = join(ROOT, 'content/series');
const SCHEMA_PATH = join(ROOT, 'src/lib/schemas/heimeliq.schema.json');

const ids = readdirSync(SERIES_DIR)
  .filter((entry) => statSync(join(SERIES_DIR, entry)).isDirectory())
  .sort();

const enumLine = `      "enum": [${ids.map((id) => `"${id}"`).join(', ')}]`;
const original = readFileSync(SCHEMA_PATH, 'utf-8');

// Match the "series" property block and replace its enum line only.
// Anchors on the `"series":` key, then its `"enum":` line within the same block.
const pattern = /("series":\s*\{[^}]*?"enum":\s*\[)[^\]]*(\])/s;
if (!pattern.test(original)) {
  console.error('error: could not locate series.enum in schema');
  process.exit(1);
}

const replacement = `$1${ids.map((id) => `"${id}"`).join(', ')}$2`;
const next = original.replace(pattern, replacement);

if (next === original) {
  console.log(`series enum already in sync (${ids.length} series)`);
  process.exit(0);
}

writeFileSync(SCHEMA_PATH, next);
console.log(`series enum updated: [${ids.join(', ')}]`);
