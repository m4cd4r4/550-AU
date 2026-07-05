# Credits and Asset Licences

Every bundled asset, its source, and its licence. The app also has a
procedural fallback for each asset so it runs fully offline.

## Data

| Asset | File | Source | Licence |
|---|---|---|---|
| HYG star database v4.1 (trimmed subset: mag <= 6.5 plus mission targets) | `src/data/hyg-subset.csv` | [astronexus/HYG-Database](https://github.com/astronexus/HYG-Database) by David Nash | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) - attribution required, share-alike applies to the data file |
| Planetary orbital elements | `src/sim/orbits.ts` | JPL approximate elements (E M Standish, JPL Solar System Dynamics) | Public domain (US Government work) |
| Mission facts | `src/data/mission-facts.json` | Turyshev et al, NIAC Phase III report ([arXiv:2002.11871](https://arxiv.org/abs/2002.11871)); Turyshev and Andersson 2002 ([arXiv:gr-qc/0205126](https://arxiv.org/abs/gr-qc/0205126)) | Facts are not copyrightable; all prose in this repo is original |

## Imagery

| Asset | File | Source | Licence |
|---|---|---|---|
| Sun photosphere texture (2k) | `public/assets/textures/2k-sun.jpg` | [Solar System Scope textures](https://www.solarsystemscope.com/textures/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

## Planned for later slices (per docs/BUILD-PROMPT.md section 6)

- NASA SVS Deep Star Maps 2020 sky texture (public domain)
- SOHO LASCO / SDO corona imagery (public domain)
- NASA Blue Marble Earth (public domain)
- NASA 3D resources: Voyager 1 and JWST models (public domain)

## Software

Three.js (MIT), Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0).
See `package.json` for versions.

## Original content

All UI copy, captions, and the procedural exoplanet surface (watermarked
"speculative" in-app) are original work, MIT licensed with the repo.
