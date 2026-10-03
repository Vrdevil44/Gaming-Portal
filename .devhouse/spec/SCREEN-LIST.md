# Screen list — Hideout v2 (stage 4 stand-in, written by stage 3 per E1)
Filed 2026-10-03. Replaced by Claude Design when it lands.

## Mounting decision
Games mount in an overlay panel at --z-modal (one at a time, destroyed on
close). Quiz runs in a <dialog> overlay. Flip card lives inside the Join
modal's stacking context.

## Game panel
- idle: poster art, title, "Play" button, personal best (or "no scores yet")
- playing: canvas, score, pause button, mute (if sound), touch controls
  contextual per game
- paused: resume / restart / quit to portal
- game over: final score, personal best (updated?), play again / quit
- storage-fallback note: "scores not saved on this device" (when storage throws)

## Quiz ("What should I play tonight?")
- question n of 5: progress dots, one question, 4 options (one is "no preference" on ordinal questions)
- result: recommended game + one-line reason, two runners-up, re-roll button
  (excludes shown picks), widened-filter note (if a filter was relaxed, say which)

## Event card
- Upcoming: poster, title, date/time (visitor-local), countdown ticking
- Live: "LIVE" badge, ends-in timer
- Ended: shown 12h after occurrence, then card rolls to next occurrence
- "sample data" badge on every card, always

## Flip card (Join modal)
- front: login (demo label: "Demo only — no real account")
- back: signup (demo label)
- 3D flip on toggle; reduced-motion → crossfade; hidden face inert
- "Skip — just let me in" bypass link, always visible
