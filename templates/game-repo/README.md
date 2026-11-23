# Game repo setup

Two things go into each game repo:

1. `.github/workflows/showcase.yml` (this folder).
2. A `showcase/` folder at the repo root: copy the game's seed bundle from the site repo
   (`content/games/<slug>/showcase.json` and `media/`). Do not add a `demo/` folder; CI builds that.

On every push to main the workflow builds the game, zips `showcase/` plus the build output as
`showcase-bundle.zip`, and publishes it on a release tagged `showcase`. The site picks it up within the hour.

The game's Vite config must work with a relative base (`--base=./`), because the demo is served from
`play/<slug>/` rather than from the site root.
