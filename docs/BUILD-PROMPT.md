# BUILD PROMPT - 550-AU Interactive Simulation

The contract for the build session (model: Fable, plan mode first), run from the repo root of the build worktree. The full planning doc is at `docs/SIM-PLAN.md` in the same repo; read it before starting.

---

Build a high-detail, real-physics interactive WebGL visualisation of the **Solar Gravitational Lens Telescope (SGLT)** mission concept: NASA/JPL's plan (Turyshev et al, NIAC Phase III) to fly swarms of solar-sail smallsats to 650+ AU and use the Sun's gravity as a lens to take a megapixel image of an exoplanet's surface. This is a flagship-quality piece: the most impressive, expansive visualisation of this mission you can produce, with real space imagery where real imagery exists and live-computed physics everywhere else.

Read `docs/SIM-PLAN.md` first. It defines the act structure, scope tiers, build slices, and verification plan. This prompt is the contract; the plan is the roadmap. Work slice by slice (vertical slices, each ending in something visible and testable). Use plan mode to confirm your implementation plan before writing code.

## 1. Non-negotiable principles

1. **Real physics, computed live.** Deflection angles, focal-line geometry, Einstein ring shape, and the sundiver trajectory come from the equations in section 3, implemented in code with unit tests against the anchor values. No keyframed fakes for anything physical.
2. **Real imagery where it exists.** NASA/ESO public-domain and CC assets (manifest in section 6). Speculative content (the exoplanet surface) is procedural and visibly labeled "artist's impression / speculative".
3. **Honest scale.** You may compress the empty expanses (especially the 25 AU pearl spacing) for comprehension, but a persistent HUD scale ribbon always shows the true distance and the current compression factor, and key scenes offer a true-scale toggle.
4. **Every on-screen number is sourced.** All quantities come from `src/data/mission-facts.json`, which you create from the facts table in section 2. No invented statistics, no invented capability claims.
5. **Original copy only.** The mission narrative below is derived from public sources; write all captions and narration text yourself. Do not copy any YouTube script.

## 2. Ground truth - mission facts (build `mission-facts.json` from this)

Physics of the lens:
- Solar light deflection: alpha = 4GM/(c^2 b); 1.751 arcsec at the solar limb (b = R_sun = 696,000 km)
- Focal distance for impact parameter b: z(b) = b^2 c^2 / (4 G M_sun); minimum z(R_sun) = 547.8 AU (light grazing the limb)
- The focal line extends from ~548 AU to infinity; larger impact parameters focus farther out
- Useful imaging starts ~650 AU: rays passing closer than ~1.1 R_sun are corrupted by corona plasma (refraction, scattering, noise); the ring you image sits just outside the limb
- Einstein ring angular radius seen from distance z: theta_E = sqrt(4GM/(c^2 z)). At 650 AU: theta_E = 1.61 arcsec, solar angular radius 1.48 arcsec - the ring hugs the limb just outside the coronagraph edge
- Light amplification ~1e11 in visible light; equivalent to a ~90 km aperture; JWST is 6.5 m
- The lens projects the planet's image onto a cylinder ("image cylinder") centered on the focal line. Diameter = planet diameter x (z / d_source). For Proxima b: ~32 km at 650 AU, growing linearly to ~57 km at 1200 AU. One final-image pixel corresponds to ~31 m of cylinder at 650 AU
- Solar oblateness (J2 quadrupole) distorts the lens: off-axis, the ring breaks into bright arcs (four-cusp caustic structure)
- The SGL point-spread function is an Airy-like J0^2 Bessel pattern; the planet image is recovered by deconvolution

Sundiver trajectory (per spacecraft):
- Launch mass < 100 kg total; solar sail: 16 rectangular panels of 1000 m^2 each (16,000 m^2 total, "two and a half football fields") on a central truss, each panel independently steerable; sail mass ~32 kg; material: tin-coated carbon-nanotube film ~70x thinner than a human hair; rated to survive ~3200 C at perihelion
- Trajectory: launch inward, unfurl sail, perihelion pass at ~15 million km from the Sun (~0.1 AU), sail snaps to face the Sun at perihelion for maximum photon thrust
- Exit velocity ~125 km/s = ~26 AU/yr (chemical propulsion tops out ~5 AU/yr; Voyager 1 does 3.6 AU/yr and is at ~169 AU after 49 years)
- Sails jettisoned ~year 2 (sunlight too weak beyond); passes Voyager 1 distance ~year 7; reaches 650 AU ~year 20; then ~10 years of imaging operations while coasting outward along the focal line

String of pearls architecture:
- One launch per year along each target's focal line; at 26 AU/yr this spaces successive "pearls" ~25 AU apart (about a Sun-to-Neptune distance)
- Each launch carries 6 CubeSats with specialised roles: telescope mirror segments, coronagraph, laser communications, nuclear power (radioisotope source; sunlight is useless out there), plus assembly/spares; they self-assemble in flight into a mission-ready ~1 m telescope
- An operating pearl uses 5 one-metre telescopes: 4 image the Einstein ring while 1 sits outside the image cylinder measuring the bare corona for digital subtraction
- Imaging dance: the cylinder cross-section is a grid; each grid cell = one pixel of the final image; a telescope moves to a cell (position tolerance ~1 m), dwells 30-60 s on the ring, corona reference is subtracted, then it moves on; months of scanning + planet rotation + repeat visits average out clouds and build a full map
- Data: a complete image is ~6 MB; laser-relayed pearl to pearl back to Earth in ~13 h of transmit time (plus light travel time, which is ~3.2 days one-way from 550 AU)
- Later pearls carry newer technology; the chain is telescope fleet, comm relay, and redundancy in one
- Formation-flying heritage: NASA's MMS mission flew 4 spacecraft in tetrahedron (separations < 10 km) and string-of-pearls (200-400 km) formations in high-eccentricity Earth orbit - the proof that precision multi-spacecraft formations work
- Final product for Proxima b: ~1000x1000 px map, ~1 km per pixel on the surface - continents, oceans, ice caps, weather systems, and potentially city lights would be resolvable

Targets (real coordinates from the star catalogue):
- #1 Proxima Centauri b - 4.24 ly, closest potentially habitable world, best resolution
- #2 TRAPPIST-1 system - 40.7 ly, three rocky planets in/near the habitable zone from one focal line
- #3 GJ 273b (Luyten's Star b) - 12.4 ly, super-Earth around a quiet red dwarf
- Also shortlisted: Kepler-186f, LHS 1140 b
- Every target has its own focal line, directly opposite the target on the far side of the Sun

Programme:
- NIAC Phase I 2017 (feasibility), Phase II 2018 (imaging method, swarm architecture, sail trajectory - $500k), Phase III 2020 (full mission architecture - $2M; one of only three concepts ever to reach Phase III)
- Sundiver technology demonstrator privately funded, targeting launch ~2027
- Rough full-mission cost ~$40B over ~4 decades (~$1B/yr; compare ISS ~$150B)

Epilogue material (stretch act only):
- Gravitational lens comms: a receiver at another star's focal region + one at ours = error-free interstellar link with ~1e9 gain; Sun-to-Alpha-Centauri link closes at ~0.1 mW transmit power, ~10 MB/s optical
- Red dwarf focal regions start ~250 AU (closer than the Sun's)
- Sgr A* (4e6 solar masses) as the ultimate lens: no photosphere, no corona, no minimum focal distance; a telescope 1 ly out could resolve buildings on a planet across the galaxy - pure thought experiment, engineering impossible today

## 3. Physics to implement (with test anchors)

Implement in `src/sim/` as pure, unit-tested TypeScript (vitest):

1. `lensing.ts` - deflection alpha(b), focal distance z(b), ring radius theta_E(z), thin-lens inverse mapping for the shader: beta = theta - theta_E^2 * theta / |theta|^2, plus a J2 quadrupole term giving the off-axis arc breakup. Tests: z(R_sun) = 547.8 AU +/-1%; theta_E(650 AU) = 1.61 arcsec +/-1%; ring is circular on-axis and splits into two arcs off-axis.
2. `sundiver.ts` - RK4 two-body + solar radiation pressure with a sail attitude schedule (feathered inbound, face-on from perihelion). Tune sail loading to reproduce published performance; label as tuned. Tests: perihelion ~0.1 AU; exit speed 25-26 AU/yr; 650 AU reached in 19-21 yr.
3. `geometry.ts` - image cylinder diameter(z, target), pixel pitch, pearl positions along a focal line given launch cadence. Tests: 32 km at 650 AU and 57 km at 1200 AU +/-5% for Proxima b.
4. `orbits.ts` - Kepler propagation for inner-planet context scenes.
5. `starfield.ts` (data side) - load an HYG catalogue subset (RA/Dec/distance/magnitude/color index); target stars must sit at their real celestial positions so each focal line points anti-target correctly against the real sky.

The Einstein ring itself (Act 5) is a fullscreen fragment shader: for each screen pixel near the Sun, invert the lens mapping to the source plane and sample the exoplanet source texture; composite over the real corona backdrop with the coronagraph occulter disc. Bloom on top. This shader is the centerpiece - build it as an early standalone spike (slice 2 in the plan) before anything else depends on it.

Rendering precision: all world positions in AU as JS doubles on the CPU; camera-relative floating origin; only small relative float coordinates reach the GPU. This is mandatory from slice 1 - the scene spans 0.1 AU to 1200 AU.

## 4. Experience spec

Eight acts, chapter rail navigation, each act with Tour mode (scripted camera + short declarative captions) and Explore mode (free camera, clickable objects with data cards). Global time controls: pause, scrub, per-act time warp. Acts 0-7 all required; Act 7 is lean and timeboxed (first cut if slices overrun):

- **Act 0 - The Problem.** Earth orbit. JWST at true 6.5 m scale beside a ghosted 90 km aperture outline. Contrast-problem inset: star vs planet brightness, 1e10 ratio, coronagraph gets you 1e6.
- **Act 1 - Einstein's Lens.** Photon bundles ray-marched past the Sun with live deflection; opposite-limb rays converge; the focal line draws itself outward as impact parameter grows. Show alpha = 4GM/c^2 b and the 1.75 arcsec limb value on the HUD.
- **Act 2 - The Focal Line.** Continuous pull-back from the Sun to 650 AU along a log-compressed ruler with milestones: planets, Kuiper belt, heliopause, Voyager 1 at 169 AU, 547.8 AU minimum focus, 650 AU imaging start. Light-travel-time counter runs the whole way (3.2 days at 550 AU). This act teaches the scale honesty system.
- **Act 3 - The Sundiver.** Launch, sail deployment (truss + 16 independently tilting panels, animated), inward spiral, perihelion at 0.1 AU with sail temperature and thrust telemetry, slingshot exit. Speed-vs-distance race chart: sundiver vs Voyager 1 vs chemical. Sail jettison at year 2. All from the integrator, time-warped.
- **Act 4 - The String of Pearls.** Camera rides the focal line. Yearly launches produce pearls marching outward; on-screen spacing compressed (say 25 AU -> a few hundred metres of scene space) with the scale ribbon declaring the compression. Pearl inspector on click: exploded view of the 6 CubeSats with role labels, then the assembled 1 m telescope (mirror, coronagraph, laser terminal, radioisotope power). Laser relay: light pulses hopping pearl to pearl to Earth; annotate the 13 h transmit and multi-day light lag. Nod to MMS heritage in a caption.
- **Act 5 - Imaging the Ring.** The payoff. First-person from a telescope at 650 AU: real corona backdrop, occulter disc, and the live lensing shader rendering the Einstein ring at correct angular scale (ring at 1.61 arcsec hugging the 1.48 arcsec limb - zoom UI handles the tiny angles). Pull back to third person: the 32 km image cylinder as a translucent grid; 4 telescopes stepping cell to cell in a raster dance (1 m tolerance, 30-60 s dwells on a fast clock); the 5th telescope offset outside the cylinder sampling corona; before/after subtraction composite. As telescopes work outward, the shader shows the ring degrading to arcs (J2 + off-axis). A reconstruction panel fills in the planet map pixel by pixel following the scan, starting noisy and sharpening over simulated months; planet rotation sweeps longitudes into view. End card: the finished ~1 km/px map, watermarked speculative.
- **Act 6 - Many Worlds.** Pull out to the real 3D stellar neighborhood (HYG positions). Focal lines radiate anti-target for Proxima b, TRAPPIST-1, GJ 273b, each with its own pearl string. Target data cards with real parameters. TRAPPIST-1: one focal line, three imageable planets.
- **Act 7 - Epilogue (lean).** Lens-to-lens comm link Sun <-> Alpha Cen with the 0.1 mW / 10 MB/s figures; closing Sgr A* thought-experiment card, clearly flagged as beyond current engineering. Build it thin: reuse Act 4's laser-relay pulses and Act 6's starfield; two scenes plus closing cards, nothing new below the visual layer.

## 5. Design direction

Dark mission-control instrument aesthetic. Data-dense, compact spacing. Near-monochrome UI (one accent color for interactive elements); the scene supplies the color and spectacle. Tabular mono numerals for telemetry. Captions: one or two short sentences, declarative, no hype adjectives. Persistent HUD: mission elapsed time, heliocentric distance (AU and km), speed (km/s and AU/yr), one-way light time to Earth, scale compression factor. Desktop-first; tablet degrades gracefully; mobile gets Tour mode only. No em-dashes, no en-dashes, no ellipsis characters anywhere in UI copy.

Audio (in scope): a generative ambient bed built with WebAudio - a slow synth drone that shifts character per act - plus subtle UI ticks for chapter changes, telescope dwells, and laser-relay hops. No third-party audio files (keeps the repo license-clean). Mute toggle, state persisted; audio starts only after the first user gesture per browser autoplay policy.

## 6. Asset manifest (download into `public/assets/`, write `CREDITS.md`, add in-app credits overlay)

| Asset | Source | License |
|---|---|---|
| Celestial-aligned equirectangular star map | NASA SVS Deep Star Maps 2020, https://svs.gsfc.nasa.gov/4851 (use 8k or 16k exr/tif -> convert to ktx2/jpg) | Public domain |
| Star catalogue | HYG v3, https://github.com/astronexus/HYG-Database (bundle a trimmed CSV: mag < 6.5 plus all named targets) | CC BY-SA 4.0 |
| Sun photosphere texture | https://www.solarsystemscope.com/textures/ (2k_sun.jpg) or NASA SDO | CC BY 4.0 / PD |
| Corona imagery for Act 5 backdrop | SOHO LASCO C2/C3 or SDO composites (NASA) | Public domain |
| Earth (Blue Marble) | https://visibleearth.nasa.gov/collection/1484/blue-marble | Public domain |
| Voyager 1 + JWST models | NASA 3D resources https://science.nasa.gov/3d-resources/ (glTF) | Public domain |

Every asset needs a graceful procedural fallback so the app still runs offline or if a download fails. Verify each license note in CREDITS.md when downloading. The exoplanet surface is procedural - build a good one (continents, oceans, ice, clouds as a separate rotating layer) and watermark it speculative.

## 7. Tech stack and conventions

- Vite + TypeScript strict + Three.js (latest stable). Vitest for the physics tests. No UI framework; vanilla TS modules.
- Postprocessing: UnrealBloom (Sun, ring, laser pulses). Instanced rendering for stars and pearls. Target 60 fps, floor 45 fps on a mid-range GPU; stats overlay in dev builds.
- Max 400 lines per file; kebab-case filenames; the module layout in `docs/SIM-PLAN.md` section 7 is the starting structure.
- `src/data/mission-facts.json` holds every displayed number (from section 2). UI reads from it; nothing hardcoded in components.
- **Open source.** This ships as a public MIT-licensed repo `m4cd4r4/550-AU`. Add `LICENSE` (MIT, copyright Macdara O Murchu), a public-quality README (what it is, screenshots per act, run instructions, physics-model appendix, credits), and `CREDITS.md` covering every bundled asset license (HYG is CC BY-SA 4.0 - attribution is mandatory). No secrets, no personal data, no absolute local paths in committed files.
- Git: commit at the end of each slice with descriptive messages. If the GitHub repo does not exist yet, create it public with `gh repo create m4cd4r4/550-AU --public` and push; pushing to it is authorized. Include a GitHub Pages deploy workflow for the static Vite build in the repo, but do NOT enable Pages or trigger the first public deploy without asking Macdara first - first prod deploy is ask-first, always.

## 8. Build order and verification

Follow the six slices in `docs/SIM-PLAN.md` section 10. After each slice:
1. Run the vitest physics suite (anchors in section 3 must pass).
2. Launch the dev server and take chrome-devtools screenshots of the new act at 2560x1440 and 1920x1080; check rendering matches the act spec; console must be clean.
3. Fix before moving on. At the end, run a full design-review pass across all acts and a performance check (report fps per act).

Definition of done: Acts 0-7 complete in Tour and Explore modes, physics tests green, honest-scale system working with at least one true-scale toggle, ambient audio with mute, credits overlay present, 45+ fps everywhere, LICENSE + CREDITS.md in place, README with screenshots, run instructions, and a physics-model appendix documenting the equations and which visuals are dramatized. Pages deploy prepared but awaiting Macdara's go.

Before writing any code: enter plan mode, read `docs/SIM-PLAN.md`, present your implementation plan (including the Act 5 shader spike), and confirm.

---

## Clarifications (appended during the build; the sections above are unchanged)

**2026-07-06, slice 3 (sundiver anchors).** The three sundiver timeline figures in sections 2 and 3 are mutually inconsistent as strict physics: a craft with hyperbolic excess 25-26 AU/yr covers 650 AU in ~24-25 years, not 19-21 (that pace needs ~32.5 AU/yr average, and speed only falls after perihelion). The figures reconcile if "reaches 650 AU ~year 20" is read as reaching the ~550 AU minimum focus: at 26 AU/yr the 547.8 AU crossing lands at year ~21, and the "passes Voyager 1 ~year 7" figure checks out exactly (169 AU / 25 AU/yr average). The integrator therefore anchors its tests to: perihelion ~0.1 AU, exit 25-26 AU/yr, minimum focus (547.8 AU) in 19-22 yr, 650 AU in 23-27 yr, Voyager pass at year 6-8. The published figures stay in `mission-facts.json` as quoted claims. Separately, the sail lightness number needed for that exit speed from a 0.1 AU perihelion is beta ~0.95, well above what 100 kg / 16,000 m^2 gives physically (~0.25); per section 3 the sail loading is an effective tuned parameter, recorded as `sundiverModel.tunedLightnessBeta` in the facts file and labelled tuned in-app.
