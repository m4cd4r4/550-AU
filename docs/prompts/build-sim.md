# 550-AU Build Brief

Open this in a **fresh Claude Code session** (model: Fable) in the `550-AU-build-sim` worktree. Don't carry context from the planning session.

## First action: rebase before doing anything else

This worktree was created from `origin/main` at scaffold time. Before reading anything else or writing any code, run:

```bash
git fetch origin main --quiet
git rebase origin/main
```

If it fast-forwards, you're done. Don't skip this; a fresh worktree's snapshot goes stale fast.

## The problem

The 550-AU simulation is fully planned but nothing is built. The plan defines a real-physics interactive WebGL visualisation of the Solar Gravitational Lens Telescope mission (Turyshev NIAC Phase III): eight acts from "why JWST can't do this" to the Einstein-ring imaging dance at 650 AU. Your job is to build it, slice by slice.

## Source of truth (read these BEFORE designing/coding)

1. [docs/BUILD-PROMPT.md](docs/BUILD-PROMPT.md) - the contract. Mission facts table, physics equations with test anchors, act-by-act spec, asset manifest, design direction, open-source requirements, definition of done.
2. [docs/SIM-PLAN.md](docs/SIM-PLAN.md) - the roadmap. Design pillars, scale strategy, module layout, scope tiers, the six build slices, verification plan, risks.
3. [README.md](README.md) - project identity and sources.

If anything in this brief contradicts those files, **the source files win**. Do not duplicate their content into new planning docs; append clarifications to them if needed.

## What's in scope

Everything. This is a greenfield build in an empty repo: Vite + TypeScript strict + Three.js scaffold, `src/sim` physics modules with vitest suites, `src/render`, `src/acts`, `src/ui`, asset download into `public/assets/`, LICENSE (MIT), CREDITS.md, public README with screenshots, GitHub Pages workflow (prepared, not activated).

## Out of scope (do NOT do)

- Do not enable GitHub Pages or trigger any public deploy. Prepare the workflow; activation is Macdara's call.
- Do not rewrite `docs/BUILD-PROMPT.md` or `docs/SIM-PLAN.md`.
- Do not add third-party audio files; audio is generative WebAudio only.
- Do not copy any narration text from source videos; all copy is original.

## What "good" looks like

The definition of done in BUILD-PROMPT.md section 8. Headlines:

- Acts 0-7 working in Tour and Explore modes; Act 7 lean.
- Physics tests green on the anchors: z(R_sun) = 547.8 AU, theta_E(650 AU) = 1.61 arcsec, cylinder 32 km at 650 AU / 57 km at 1200 AU, sundiver exit 25-26 AU/yr.
- Honest-scale system live: HUD scale ribbon plus at least one true-scale toggle.
- Real imagery credited; speculative surfaces watermarked; 45+ fps floor.

## Required deliverables

1. Implementation plan (plan mode) before any code, confirming slice order and the Act 5 shader spike.
2. The six slices from SIM-PLAN section 10, each ending in something visible and testable.
3. Verification per slice: vitest suite green, dev server screenshots via chrome-devtools at 2560x1440 and 1920x1080, clean console.
4. Open-source hygiene: LICENSE, CREDITS.md with per-asset licences (HYG is CC BY-SA 4.0), README with screenshots and a physics appendix, no secrets, no absolute local paths in committed app files.

## Suggested workflow

1. Rebase (above). Read the three source-of-truth files fully.
2. Enter plan mode; present the implementation plan; confirm before scaffolding.
3. Slice 1 on this branch (`feat/build-sim`); PR to main when its ship criterion passes.
4. Each later slice: fresh branch off updated main (`feat/slice-2-lensing-spike` etc), one PR per slice, merge before starting the next. Never reuse a merged branch.
5. Run /design-review after slices with new visuals; full pass at slice 6.
6. Commit at natural checkpoints within a slice, not one giant commit at the end.

## Constraints

- One PR per slice. First branch: `feat/build-sim`.
- Vite + TypeScript strict + Three.js + vitest. No UI framework. Max 400 lines per file, kebab-case filenames.
- Every displayed number comes from `src/data/mission-facts.json`.
- Camera-relative floating origin from slice 1; the scene spans 0.1 to 1200 AU.
- British English in UI copy. No em-dashes, no en-dashes, no ellipsis characters.

## Out-of-scope follow-ups (capture, don't build)

If you spot ideas beyond the plan (WebXR, extra targets, narration audio), append them to `docs/BACKLOG.md` in the repo. Do not build inline.

## Why this brief is structured this way

The planning session already made the decisions; this brief exists so the build session executes against the committed contract instead of re-deriving scope. The two docs carry all detail; this file is deliberately thin so there is exactly one source of truth.