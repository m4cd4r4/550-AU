// Downloads open-licence assets into public/assets and builds the bundled
// HYG star-catalogue subset (src/data/hyg-subset.csv). Run: npm run fetch-assets
// Raw downloads are cached in .cache/ (gitignored); outputs are committed.

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, '.cache');

const HYG_URLS = [
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv',
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v37.csv',
  'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hygdata_v3.csv'
];

const SUN_TEXTURE_URL = 'https://www.solarsystemscope.com/textures/download/2k_sun.jpg';

// SOHO LASCO C2 coronagraph image, Act 5 backdrop. Realtime endpoints serve
// the latest frame; whichever responds is cached and committed for reproducibility.
const CORONA_URLS = [
  'https://soho.nascom.nasa.gov/data/realtime/c2/1024/latest.jpg',
  'https://sohowww.nascom.nasa.gov/data/realtime/c2/1024/latest.jpg',
  'https://soho.esac.esa.int/data/realtime/c2/1024/latest.jpg'
];

// NASA public-domain spacecraft renders for the Act 0 and Act 4 loupes.
const JWST_RENDER_URL =
  'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000368/GSFC_20171208_Archive_e000368~small.jpg';
const VOYAGER_RENDER_URL =
  'https://images-assets.nasa.gov/image/PIA17049/PIA17049~small.jpg';

const MAG_LIMIT = 6.5;
// Catalogue designations of mission targets fainter than the magnitude cut.
const KEEP_GLIESE = new Set(['Gl 551', 'GJ 551', 'Gl 273', 'GJ 273']);
const KEEP_PROPER = new Set(['Proxima Centauri', "Luyten's Star"]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadFirst(urls, cachePath, label) {
  if (await exists(cachePath)) {
    console.log(`[cache] ${label}: ${cachePath}`);
    return readFile(cachePath);
  }
  for (const url of urls) {
    try {
      console.log(`[fetch] ${label}: ${url}`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        console.warn(`  -> HTTP ${res.status}, trying next`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, buf);
      return buf;
    } catch (err) {
      console.warn(`  -> ${err.message}, trying next`);
    }
  }
  throw new Error(`all sources failed for ${label}`);
}

// Minimal CSV line splitter that honours double-quoted fields.
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function buildHygSubset(csvText) {
  const lines = csvText.split('\n');
  const header = lines[0].replace(/^﻿/, '').trim().split(',').map((h) => h.replace(/"/g, ''));
  const col = Object.fromEntries(header.map((name, i) => [name.trim().toLowerCase(), i]));
  for (const required of ['ra', 'dec', 'dist', 'mag', 'ci']) {
    if (!(required in col)) {
      throw new Error(
        `HYG header missing column: ${required}. Header was: ${lines[0].slice(0, 300)}`
      );
    }
  }
  const properCol = col.proper;
  const glCol = col.gl;

  const out = ['proper,ra,dec,dist,mag,ci'];
  let kept = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const f = splitCsvLine(line.trim());
    const mag = parseFloat(f[col.mag]);
    if (!Number.isFinite(mag)) continue;
    const proper = properCol !== undefined ? (f[properCol] ?? '').trim() : '';
    const gl = glCol !== undefined ? (f[glCol] ?? '').trim() : '';
    const isTarget = KEEP_PROPER.has(proper) || KEEP_GLIESE.has(gl);
    if (mag > MAG_LIMIT && !isTarget) continue;
    const ra = parseFloat(f[col.ra]);
    const dec = parseFloat(f[col.dec]);
    const dist = parseFloat(f[col.dist]);
    const ci = parseFloat(f[col.ci]);
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(dist)) continue;
    // Sun appears in HYG at dist 0; skip it, the scene renders its own Sun.
    if (dist === 0) continue;
    const name = proper.includes(',') ? '' : proper;
    out.push(
      `${name},${ra.toFixed(6)},${dec.toFixed(6)},${dist.toFixed(2)},${mag.toFixed(2)},${Number.isFinite(ci) ? ci.toFixed(3) : ''}`
    );
    kept++;
  }
  console.log(`[hyg] kept ${kept} stars (mag <= ${MAG_LIMIT} plus targets)`);
  return out.join('\n') + '\n';
}

async function main() {
  const hygRaw = await downloadFirst(HYG_URLS, join(cacheDir, 'hyg-full.csv'), 'HYG catalogue');
  const subset = buildHygSubset(hygRaw.toString('utf8'));
  const subsetPath = join(root, 'src', 'data', 'hyg-subset.csv');
  await writeFile(subsetPath, subset);
  console.log(`[write] ${subsetPath}`);

  const sun = await downloadFirst(
    [SUN_TEXTURE_URL],
    join(cacheDir, '2k-sun.jpg'),
    'Sun photosphere texture'
  );
  const sunPath = join(root, 'public', 'assets', 'textures', '2k-sun.jpg');
  await mkdir(dirname(sunPath), { recursive: true });
  await writeFile(sunPath, sun);
  console.log(`[write] ${sunPath}`);

  const corona = await downloadFirst(
    CORONA_URLS,
    join(cacheDir, 'corona-lasco-c2.jpg'),
    'SOHO LASCO C2 corona image'
  );
  const coronaPath = join(root, 'public', 'assets', 'textures', 'corona-lasco-c2.jpg');
  await writeFile(coronaPath, corona);
  console.log(`[write] ${coronaPath}`);

  const jwst = await downloadFirst([JWST_RENDER_URL], join(cacheDir, 'jwst.jpg'), 'JWST mirror render');
  const jwstPath = join(root, 'public', 'assets', 'renders', 'jwst.jpg');
  await mkdir(dirname(jwstPath), { recursive: true });
  await writeFile(jwstPath, jwst);
  console.log(`[write] ${jwstPath}`);

  const voyager = await downloadFirst(
    [VOYAGER_RENDER_URL],
    join(cacheDir, 'voyager.jpg'),
    'Voyager spacecraft render'
  );
  const voyagerPath = join(root, 'public', 'assets', 'renders', 'voyager.jpg');
  await writeFile(voyagerPath, voyager);
  console.log(`[write] ${voyagerPath}`);

  console.log('done. Update CREDITS.md if sources changed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
