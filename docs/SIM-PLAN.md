# 550-AU - Simulation Plan

Planning document for a high-detail, real-physics interactive visualisation of the Solar Gravitational Lens Telescope (SGLT) mission concept: turning the Sun into a telescope to image an exoplanet's surface. Project name: **550-AU**, after the minimum solar gravitational focal distance.

- Date: 2026-07-05 (decisions resolved 2026-07-06)
- Status: PLAN (nothing built yet)
- Build brief for the implementing session: `docs/BUILD-PROMPT.md` (self-contained; the contract for the build worktree session)

## 1. Sources

| Source | What it provides |
|---|---|
| AstroKobi transcript `I:/Scratch/youtube-transcripts/AstroKobi/NASA Alien Worlds Imaging/NASA's $40 BILLION Plan To Image Alien Worlds [go-50Dpzs20].txt` | Mission narrative + all headline numbers (sundiver, pearls, imaging dance) |
| Turyshev & Andersson 2002, arXiv:gr-qc/0205126 ("The 550 AU Mission: A Critical Discussion") | Why the useful focus is beyond 550 AU: solar plasma refraction/scattering, corona noise |
| Turyshev et al 2020, arXiv:2002.11871 (NIAC Phase II/III report) | Definitive mission architecture reference (91 pp); cite, don't need full ingest |
| Wikipedia: FOCAL (spacecraft) | Maccone/Eshleman heritage, amplification figures, plasma limits |
| NASA NTRS: MMS formation flight dynamics (tetrahedron + string of pearls) | Real flight heritage of the "string of pearls" formation name: 4 spacecraft, 200-400 km separations |

Facts table with all numbers lives in BUILD-PROMPT.md section 2 and is the single source of truth for the app.

**IP note:** the transcript is source material for facts and structure. Do not reproduce AstroKobi's narration verbatim in the app. All on-screen copy must be original.

## 2. Design pillars

1. **Real physics, computed live.** Light deflection, focal line geometry, Einstein ring shape, sundiver trajectory, and orbital motion come from the actual equations, not keyframed animation. If a number appears on screen, it must fall out of the model or come from the facts table with attribution.
2. **Real imagery where real imagery exists.** NASA/ESO public-domain and CC assets for the Sun, sky, Earth. Anything speculative (Proxima b's surface) is procedural and labeled "artist's impression".
3. **Honest scale.** Distances are compressed for comprehension (per Macdara's explicit allowance for pearl spacing), but a persistent scale readout always shows the true numbers, and key scenes offer a true-scale toggle so the compression is a choice, never a lie.
4. **Comprehension first.** Every act answers one question. A viewer with no physics background should leave understanding why 550 AU, why a string, and how a ring becomes a map.
5. **Cinematic but interruptible.** Guided chapter flow with camera choreography, but the user can pause, grab the camera, and inspect anything at any time.

## 3. Experience architecture

Single-page WebGL app. Chapter rail down one side (data-dense, compact). Two modes per act: **Tour** (scripted camera + captions) and **Explore** (free orbit/fly, clickable objects). Global time controls: pause, scrub, time-warp (1 s = X days/years, per act defaults).

### Act structure

| # | Act | One question it answers | Core visual |
|---|---|---|---|
| 0 | The Problem | Why can't JWST do this? | Earth orbit; JWST 6.5 m mirror vs the 90 km mirror required, to scale; contrast-problem inset (firefly beside floodlight, 1e10 ratio) |
| 1 | Einstein's Lens | How does gravity bend light? | Photon rays ray-marched past the Sun; deflection angle live as impact parameter changes; rays from opposite limbs converging on the focal line |
| 2 | The Focal Line | Why 550 AU, and how far is that? | Pull-back from Sun to 650 AU on a log-compressed ruler; planet orbits, Kuiper belt, heliopause, Voyager 1 at 169 AU as milestones; light-travel-time counter |
| 3 | The Sundiver | How do you get there in 20 years? | Full trajectory sim: launch, sail unfurl (16 x 1000 m2 panels on truss), perihelion pass at 0.1 AU, speed graph racing Voyager, sail jettison at year 2 |
| 4 | The String of Pearls | Why hundreds of spacecraft? | Yearly launches marching out along the focal line, pearls at 25 AU spacing (compressed on screen, true spacing on HUD); pearl inspector: exploded view of the 6-CubeSat cluster and assembled 1 m telescope; laser-comm relay pulses hopping pearl to pearl back to Earth |
| 5 | Imaging the Ring | How does a ring become a map? | The money shot. View from a telescope at 650 AU: coronagraph occults the Sun, Einstein ring rendered by a true lensing shader; the 32 km image cylinder as a grid; telescopes stepping pixel to pixel (30-60 s dwells); ring degrading to arcs off-axis; progressive reconstruction of the planet map |
| 6 | Many Worlds | Why stop at one planet? | Real 3D starfield with focal lines radiating opposite Proxima Cen b, TRAPPIST-1, GJ 273b; per-target focal line + pearl string |
| 7 | Epilogue (lean) | What else does this unlock? | Galactic internet: Sun-to-Alpha-Cen lensed comm link; Sgr A* thought experiment as a closing card |

Acts 0-7 are the product. Act 7 is deliberately lean: it reuses Act 4's laser-relay pulses and Act 6's starfield, adds two scenes plus closing cards, ships in slice 6, and is the first thing cut if slices overrun.

## 4. Physics model (what is simulated vs illustrated)

**Simulated (equations in code, unit-tested):**
- Deflection angle: alpha = 4GM/(c^2 b) = 1.75 arcsec x (R_sun/b)
- Focal distance: z(b) = b^2 c^2 / 4GM; z(R_sun) = 547.8 AU (test anchor)
- Einstein ring angular radius from heliocentric distance z: theta_E = sqrt(4GM/(c^2 z)); at 650 AU theta_E = 1.61 arcsec vs solar limb 1.48 arcsec, so the ring hugs the limb just outside the coronagraph edge - render this correctly
- Lensing shader: thin-lens inverse mapping beta = theta - theta_E^2/theta (vector form), monopole plus J2 quadrupole term for solar oblateness; produces ring on-axis, splitting into arcs off-axis, exactly as the mission describes
- Sundiver trajectory: RK4 integration of two-body gravity + solar radiation pressure with sail attitude schedule; parameters tuned to reproduce the published performance (perihelion 0.1 AU, exit 25-26 AU/yr), labeled as such
- Image cylinder geometry: diameter = planet diameter x (z / d_source); 32 km at 650 AU, 57 km at 1200 AU for Proxima b (test anchors); pixel pitch 31 m at 650 AU
- Planetary orbits (inner solar system context scenes): Kepler propagation
- Star positions: real RA/Dec/distance from the HYG catalogue, so Proxima's focal line points the right way against the real sky

**Illustrated (physically motivated, visually dramatized, labeled):**
- The SGL point-spread function: show the J0^2 Bessel PSF cross-section as a diagram; the deconvolution itself is dramatized as progressive per-pixel reveal following the raster scan
- Corona subtraction: reference telescope shown outside the cylinder; subtraction shown as a before/after composite
- CubeSat self-assembly: choreographed animation (no docking dynamics)
- Proxima b surface: procedural continents/oceans/clouds, watermarked "speculative"

## 5. Scale strategy

- All positions computed in doubles (JS numbers) in AU; camera-relative rendering (floating origin) so GPU floats never see large magnitudes. Doubles give sub-mm precision at 1200 AU; fine.
- Between-object expanses compressed with a per-act log or piecewise mapping. The HUD scale ribbon shows: displayed compression factor + true distance. Act 2's ruler is the explicit teaching moment for scale.
- True-scale toggle in Explore mode for Acts 2, 4, 6 (pearls vanish into points at true scale - that is itself the lesson).

## 6. Visual assets (real imagery)

| Asset | Source | License | Fallback |
|---|---|---|---|
| Sky (star map, equirectangular, celestial-aligned) | NASA SVS Deep Star Maps 2020 (svs.gsfc.nasa.gov/4851) | Public domain | Procedural starfield from HYG |
| Star catalogue (positions, magnitudes, color) | HYG database (github.com/astronexus/HYG-Database) | CC BY-SA 4.0 | Bundled subset CSV |
| Sun photosphere | Solar System Scope 2k_sun (CC BY 4.0) or NASA SDO imagery | CC BY 4.0 / PD | Procedural granulation shader |
| Corona (Act 5 backdrop) | SOHO LASCO / SDO composites | Public domain | Procedural corona shader |
| Earth | NASA Blue Marble | Public domain | Procedural |
| Voyager 1, JWST scale props | NASA 3D resources glTF | Public domain | Simple procedural models |
| Proxima b | Procedural (labeled speculative) | n/a | n/a |

All assets downloaded at build time into `public/assets/` with a `CREDITS.md` and an in-app credits overlay. No hotlinking.

## 7. Tech stack and architecture

- Vite + TypeScript (strict) + Three.js. Postprocessing: UnrealBloom for the Sun/ring. No framework needed; vanilla TS with small modules.
- The Einstein ring (Act 5) is a fullscreen fragment-shader pass (inverse lens mapping sampling the source texture), not scene-graph raytracing.
- Module layout (max 400 lines/file per coding rules):

```
src/
  main.ts            app boot, act router
  sim/               units.ts, constants.ts, lensing.ts, sundiver.ts,
                     orbits.ts, pearls.ts, timeline.ts
  render/            starfield.ts, sun.ts, corona.ts, sail.ts,
                     pearl-models.ts, focal-line.ts, bloom.ts
  acts/              act0-problem.ts ... act7-epilogue.ts (one controller each)
  ui/                hud.ts, chapter-rail.ts, scale-ribbon.ts,
                     captions.ts, inspector.ts, credits.ts
  data/              targets.json, mission-facts.json, hyg-subset.csv
tests/               lensing.test.ts, sundiver.test.ts, geometry.test.ts (vitest)
public/assets/       textures + CREDITS.md
```

- `mission-facts.json` is the single source of truth for every number shown on screen; the facts table in BUILD-PROMPT.md is its content.

## 8. UI / design direction

Dark mission-control instrument aesthetic. Data-dense, compact spacing (Macdara standard). High-contrast monochrome UI with one accent for interactive elements; the scene provides the color. Technical numerals in a tabular mono font. Captions short and declarative. Every quantitative HUD element shows units. Desktop-first; degrade gracefully to tablet; mobile gets tour mode only.

HUD telemetry (persistent): mission elapsed time, heliocentric distance (AU + km), speed (km/s + AU/yr), one-way light time to Earth, scale compression factor. Act-specific panels: sail temperature and thrust near perihelion (Act 3), pixel counter and dwell timer (Act 5).

Audio (in scope): generative ambient bed via WebAudio (slow synth drone that shifts per act, no external audio files, no licensing burden) plus subtle UI ticks for chapter changes, telescope dwells, and laser-relay hops. Mute toggle persisted; audio starts only after first user gesture (browser policy).

## 9. Scope tiers

- **MVP (vertical slice)**: app shell + chapter rail + starfield + Sun + Act 2 (focal line) working end to end, with HUD and scale ribbon. Proves scale handling, floating origin, and the act framework.
- **Core**: Acts 1, 3, 4, 5. Act 5 is the highest-value, highest-risk scene; build its lensing shader early as a standalone spike.
- **Full**: Acts 0 and 6, Act 7 lean epilogue, ambient audio (generative WebAudio, section 8), pearl inspector, credits, polish pass.
- **Stretch**: true-scale toggles everywhere, WebXR.

## 10. Build phases (vertical slices)

1. **Slice 1 - skeleton with one real act**: Vite scaffold, sim units/constants + tests, starfield from HYG, Sun, Act 2 with camera choreography + HUD. Ship criterion: focal-line pullback teaches 550 AU with true numbers.
2. **Slice 2 - lensing spike**: standalone Act 5 shader page: ring from lens equation, arcs off-axis, coronagraph disc. Ship criterion: ring radius matches theta_E within 1% at 650 AU (assert in test).
3. **Slice 3 - sundiver**: trajectory integrator + tests, sail model, Act 3 complete with speed race graph.
4. **Slice 4 - pearls**: pearl string layout, cluster models, inspector, laser relay animation, Act 4 complete.
5. **Slice 5 - imaging dance**: integrate the lensing spike into Act 5 proper: cylinder grid, telescope choreography, progressive reconstruction.
6. **Slice 6 - bookends + polish**: Acts 0, 1, 6; Act 7 lean epilogue (timeboxed; cut first if overrunning); ambient audio; credits; design-review loop (screenshots at 4 breakpoints); performance pass.

## 11. Verification plan

- Physics: vitest asserts the anchors - z(R_sun) = 547.8 AU (+/-1%), theta_E(650 AU) = 1.61 arcsec (+/-1%), cylinder 32 km at 650 AU and 57 km at 1200 AU (+/-5%), sundiver exit speed 25-26 AU/yr.
- Visual: chrome-devtools MCP screenshots of every act at 1440p + 1080p; console must be clean; compare against act intent.
- Performance: 60 fps target, 45 fps floor on a mid GPU; stats overlay in dev; instanced starfield; no per-frame allocations in hot loops.
- Honesty audit: every on-screen number traceable to mission-facts.json; speculative imagery watermarked; credits present.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Act 5 shader is hard to get both correct and beautiful | Build as slice 2 spike before investing in the rest; fall back to precomputed ring sprites only if the shader fails (unlikely) |
| Scale precision artifacts (jitter at 650 AU) | Floating origin from day one; slice 1 proves it |
| Asset downloads fail / license confusion | Manifest with fallbacks; procedural stand-ins keep the app self-contained |
| Scope explosion (8 acts) | Tiered scope; acts 0/6/7 are cuttable without breaking the story |
| Narration IP | Original copy only; transcript used for facts |

## 13. Decisions (resolved 2026-07-06)

1. **Project name/dir**: `550-AU`, at `I:/Scratch/550-AU`.
2. **Deploy target**: open source on GitHub as `m4cd4r4/550-AU`, MIT license. The build session prepares a GitHub Pages deploy workflow (static Vite build) but does not enable Pages or push the workflow live without asking Macdara first - first public deploy is ask-first per the global deploy rules. Repo creation and pushes are authorized.
3. **Audio**: yes, in scope (generative WebAudio, section 8). No third-party audio assets.
4. **Act 7**: keep as a lean epilogue in slice 6, timeboxed, first thing cut if the build overruns.

Open-source hygiene this implies: MIT `LICENSE`, `CREDITS.md` with per-asset licenses (HYG is CC BY-SA 4.0 - attribution required), README with screenshots and run instructions, no secrets or personal data in the repo.
