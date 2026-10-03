# SCRIPT acceptance checks — Hideout v2
Drafted by Gemini API (non-builder seat), CORRECTED on Max's review
2026-10-03. Corrections: z-index tokens are CSS custom properties (not
Tailwind z-10); storage prefix is hideout:v1: (not rog_h2_); Tetris scoring
is 100/300/500/800 × level (not 100*2^(n-1)); S7 origin check is the page's
own origin (not rog-games.com); S1 image check is the byte budget (not
150KB/file).

## S1 — cleanup + asset pipeline
1. Static scan (grep src, srcset, link href, @import, url(), form action,
   excluding <a>): zero off-origin references.
2. Byte budget: home page transferred bytes at 390px and 1440px, empty
   cache: <1.5MB first view; total <4MB. Hero WebP <250KB.
3. Every referenced file exists with exact case (Linux/Pages).
4. z-index lint: only values from tokens (--z-base 0, --z-content 10,
   --z-header 100, --z-menu 200, --z-modal 300, --z-toast 400).
5. No dead particles reference; no @import of external fonts.

## S2 — frame contract + Snake
1. Logic harness: LEFT then immediate RIGHT → direction unchanged (no 180°).
2. food_spawn ×1000: never on snake body cells.
3. Wall collision → game over (walls kill).
4. Scoring: +10 per food; speedup every 5 foods.
5. Seeded RNG: deterministic food sequence across runs.
6. destroy(): frame listener/loop registry empty afterward.
7. Storage: keys prefixed hideout:v1:snake:best; garbage/throwing storage →
   RAM fallback, no crash.
8. Zero console errors during a scripted session.

## S3 — Pong
1. No tunnelling: ball at max speed never skips paddle bounds (swept collision).
2. AI beatable: sim series, AI win rate <90%.
3. Frame registry empty after destroy; zero console errors.

## S4a+4b — recommender engine + DB + quiz UI
1. Brute force all 1,024 combos: every game top-3 at least once; no game #1
   in >15% of combos; no combo returns empty.
2. Every DB row: poster file exists, values in range.
3. Widen path: forced-empty filter set → lowest-priority filter dropped and
   reported.
4. Tie-break deterministic with fixed test date.
5. Result shows reason line + two runners-up; re-roll excludes shown picks.

## S5 — events + flip login + modal
1. Fake clock: 1min before start → Upcoming + correct countdown; at start →
   Live; during → Live; 1min after end → Ended; 12h after → rolled to next.
2. Countdown = target − now recomputed per tick (not decrementing).
3. Form: no action/name attributes; submit → zero requests, zero stored.
4. Hidden flip face: inert (no state change on interaction).
5. "sample data" badge present on every event card.

## S6 — Tetris
1. Rotation at walls/floor: never overlaps or leaves the 10x20 board
   (kicks 0/−1/+1/−2/+2 for I).
2. Clears of 1–4 lines score 100/300/500/800 × level.
3. 7-bag: every 7 pieces contain exactly one of each tetromino.
4. Spawn collision → game over.
5. Level up every 10 lines; soft + hard drop work.

## S7 — Playwright smoke + live URL
1. Runtime: zero requests leaving the page's own origin — local AND live.
2. Zero console errors/pageerrors across: load, each game start+over,
   quiz run, modal open/close.
3. Live URL: zero 404s on all assets/routes.
