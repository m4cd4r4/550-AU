# Tour Pacing and Legibility Brief

Open this in a **fresh Claude Code session** in this worktree. Do not carry context from another session.

## First action: rebase before doing anything else

```bash
git fetch origin main --quiet
git rebase origin/main
```

## The problem

Macdara: the demo is "pretty cool, but a bit boring at times". A visual audit on 2026-11-12 (44 frames of the live build at 1440 wide, two at 390) found one main cause: for long stretches the subject is a few pixels wide on a black screen and nothing enters or leaves the frame. He approved the fixes below, in this order.

The audit frames are at `F:/Temp/claude/a3351201c6cbf640/dc5670e5-c4bb-4f18-b8f0-326174631089/scratchpad/audit550/` if that folder still exists. Retake your own "before" frames either way.

## Source of truth (read these BEFORE designing or coding)

1. `README.md` - the honest-scale rules and the "simulated vs dramatised" appendix. Every change here must keep them true.
2. `src/acts/act0-problem.ts` - the cubic pullback in `placeTourCamera` and the ring opacity rule in `update`.
3. `src/acts/act3-sundiver.ts` with `act3-tour.ts`, `src/acts/act4-pearls.ts` with `act4-tour.ts`, `src/acts/act5-imaging.ts` with `act5-tour.ts`.
4. `src/ui/styles.css` - panel, label, caption and race-chart rules and the three media queries.
5. `src/data/mission-facts.json` - every on-screen number comes from here or from `src/sim/`.
6. `docs/SIM-PLAN.md` and `docs/BUILD-PROMPT.md` - the build contract.

If this brief contradicts those files, **the files win**.

## What to build, in this order

### 1. Act 0: make the wait for the ring worth watching

Measured: JWST shrinks to a dot by about 9 s. The ring's edges enter the frame at about 46 s and the whole ring at about 56 s of 60. The cause is `dist = 3.2 + p^3 * RING_RADIUS * 2.6`, with nothing between 6.5 m and 90 km.

- Constant zoom rate: each tenfold step in scale takes equal time.
- A scale ladder: labelled reference rings arrive every few seconds on the way out, so the 90 km ring lands as the last of a series. Use real, sourced sizes (for example the ISS at 109 m) and add them to `mission-facts.json` with their sources.
- A live readout of the frame width counting up toward 90 km, visible from the first second.
- Draw the 90 km aperture as something worth arriving at. Today it is a 1 px line at half opacity.
- Shorten the act to about 35 s and re-time its three captions.

### 2. Global legibility and the clipped chart

- Panel and HUD labels are 9 to 10 px and captions 14 px. Target 12 px minimum for panels and 18 to 20 px for captions. Check nothing overflows at 1440, 1080p and 390.
- Act 3's "Speed vs distance" chart runs off the right edge at 1440 x 810.
- Act 2 label collisions: "Heliopause" over "Voyager 1", "Minimum focus" over "Imaging begins". Act 6 labels sit on their lines.
- At 390 wide the act heading truncates to "ACT 0 /..." and no chapter navigation was visible. Confirm, then give phones a way to change chapter.

### 3. Act 3 perihelion and Act 4 relay

- Act 3: the craft is a 4 px speck during the dive, and at perihelion the sail is a blown-out white bar. Make perihelion a close-up: the sail snapping face-on, heating, a sense of speed. Show Voyager 1 being overtaken, since the caption says it is. The last 35 s is one unchanging frame; cut or fill it.
- Act 4: nearly all black. Make the laser relay visible as pulses hopping pearl to pearl, and keep a close-up of one pearl on screen during the wide view. Check what already exists first: main has recent Act 4 close-up and docking work that the audited live build may predate.

### 4. Act 5 finale

The reconstructed planet is the payoff and it sits in a panel about 130 px wide. End on a full-screen reveal of the map beside "JWST's view: one pixel", calling back to Act 0. The "speculative" watermark stays.

### 5. Motion and length

- The starfield follows the camera, so long pullbacks look static. Add a motion cue during fast travel that respects `prefers-reduced-motion`.
- The eight tours total 11 min 19 s before the 5.5 s holds. Trim where a frame does not change.

Smaller items if time allows: Act 1 opens on an empty frame, its rays are cut by the left rail and it never shows the source planet; in Act 7 stars show through the black hole image.

## Out of scope (do NOT modify)

- The physics in `src/sim/` and its tests, except adding sourced facts.
- The cosmos-collective repo. The live site serves a vendored build; refreshing it is a separate step described in that repo's `public/embeds/gravitational-lens/README.md`, and any production deploy needs Macdara's approval.
- Explore mode behaviour, apart from fixes that fall out of the shared styles.

## What "good" looks like

- In Act 0 something new enters the frame at least every five seconds, and a first-time viewer knows from the start that a 90 km ring is coming.
- No frame in any tour holds unchanged for more than about eight seconds.
- Every label and caption is readable at 1440 without leaning in, and nothing is clipped at 1440, 1080p or 390.
- The honest-scale ribbon and the dramatised labels are still accurate for every changed shot.
- `npm test` and `npm run build` pass.

## Required deliverables

1. Before and after frames for every changed act at 1440 and 390, read by you, not just captured.
2. The changes, as one commit per numbered item.
3. README screenshots and the "dramatised" appendix updated where a shot changed.
4. A note in the PR on anything from the list you chose not to do, and why.

## Suggested workflow

1. Rebase. Read the source-of-truth files. Run the app through PortPilot and watch one full tour in real time at 1x before changing anything; the audit scrubbed to fixed points and did not hear the audio.
2. Item 1 first, verified, then item 2. Open a PR for those two if the rest will take long.
3. Items 3 to 5, then `/design-review`.

## Constraints

- Branch `feat/tour-pacing`. One PR for the theme, or two if split as above.
- No new runtime dependencies. No new external requests at runtime; the embed is fully offline.
- British English. No em-dashes, en-dashes or ellipsis characters in app copy.
- The primary checkout `I:/Scratch/550-AU` had a leftover `.git/index.lock` on 2026-11-12 and was 13 commits behind. Do not clear the lock without checking that no git process holds it.

## Out-of-scope follow-ups (capture, don't build)

Create a task in Vikunja project 31 (cosmos-collective). Do not fix inline.

## Why this brief is structured this way

The order is Macdara's approved order: the Act 0 wait he named first, then the cheap global fixes, then the per-act spectacle. The measurements are included so the new session can confirm each problem before fixing it, and tell when it is fixed.