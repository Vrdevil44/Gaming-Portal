# ROG//GAMES — Gaming Portal

A static, single-page gaming portal ("Hideout"): hero, games showcase, tournament
cards, about section and a demo join modal. Plain HTML/CSS/JS, no build step,
and no request leaves the page's own origin.

## Structure

```
index.html      page markup
style.css       site styles; z-index tokens and font stack live on :root
Formstyle.css   join-modal flip-card styles
app.js          menu + modal behaviour
*.webp          images: <name>-480 / <name>-960 posters, 33-1920 / 33-767 hero
LICENSE
```

Original image masters are not kept in the repo (they are not served);
only the optimised WebP files ship.

### Conventions
- Z-index: only the `--z-*` tokens in `style.css` (`base 0`, `content 10`,
  `header 100`, `menu 200`, `modal 300`, `toast 400`).
- Fonts: system font stack (`--font-main`), no external font files.
- Images: WebP at 480/960px widths (hero 767/1920); reference with relative paths.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ (use a local server, not `file://`).

## Dev House pipeline note

This repo is rebuilt as "Hideout v2" in scenes by the Dev House pipeline
(spec-frozen, budgeted per scene). Scene 1 = cleanup + asset pipeline (this
state). Later scenes add games, quiz and events under `js/`; they are not
part of Scene 1. Changes are reviewed and pushed by Max.
