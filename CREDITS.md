# Credits and Asset Licences

Every bundled asset, its source, and its licence. The app also has a
procedural fallback for each asset so it runs fully offline.

## Narrative inspiration

AstroKobi's video ["NASA's $40 BILLION Plan To Image Alien Worlds"](https://www.youtube.com/watch?v=go-50Dpzs20)
first surfaced this mission concept and shaped which facts and story beats
to research further. It is a starting point, not a source: no narration is
reproduced anywhere in the app, and every fact was independently verified
against the primary sources below before use.

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
| Corona backdrop (LASCO C2 coronagraph frame, 2026-07-05) | `public/assets/textures/corona-lasco-c2.jpg` | [SOHO LASCO](https://soho.nascom.nasa.gov/) - courtesy of SOHO/LASCO consortium. SOHO is a project of international cooperation between ESA and NASA | Free for educational and personal use with credit ([SOHO image use policy](https://soho.nascom.nasa.gov/data/data.html)); not copyrighted. The app blends it with an original procedural inner corona below the LASCO occulter edge |
| JWST primary mirror render (Act 0 loupe) | `public/assets/renders/jwst.jpg` | ["JWST's Golden Mirror Revealed"](https://images.nasa.gov/details/GSFC_20171208_Archive_e000368), NASA/Chris Gunn (NASA Goddard) | Public domain (NASA imagery). The 3D JWST in the scene is original procedural geometry; this render is a reference loupe |
| Voyager spacecraft render (Act 4 loupe) | `public/assets/renders/voyager.jpg` | ["Voyager in Space Artist Concept" PIA17049](https://images.nasa.gov/details/PIA17049), NASA/JPL-Caltech | Public domain (NASA/JPL imagery). Shown for both Voyager 1 and 2, which are identical craft |

## Planned for later slices (per docs/BUILD-PROMPT.md section 6)

- NASA SVS Deep Star Maps 2020 sky texture (public domain)
- NASA Blue Marble Earth (public domain)

## Software

Three.js (MIT), Vite (MIT), Vitest (MIT), TypeScript (Apache-2.0).
See `package.json` for versions.

## Original content

All UI copy, captions, and the procedural exoplanet surface (watermarked
"speculative" in-app) are original work, MIT licensed with the repo.
