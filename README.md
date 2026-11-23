# Syntcht Games site

A static showcase for the Syntcht Games titles: cards, game pages with click-to-load browser demos, and an about page.
Plain Node ESM scripts, hand-written templates and one CSS file. **No npm dependencies.** Output goes to `dist/`
and is hosted on GitHub Pages.

## How it works

```
 game repo (private or public)                   this repo (public)                     visitors
 ---------------------------------               ---------------------------------      ---------
 push to main
   -> showcase.yml calls  ----------------->     publish-demo.yml (reusable)
      publish-demo.yml                             builds the game, zips
                                                   showcase.json + media/ + demo/
                                                   -> release tag "showcase"
                                                      asset showcase-bundle.zip
                                                              |
                         hourly / push / manual / repository_dispatch
                                                              v
                                                 deploy.yml: scripts/fetch.mjs
                                                   -> .cache/games/<slug>/
                                                 scripts/build.mjs  -> dist/
                                                 scripts/check-links.mjs
                                                 GitHub Pages  ------------------->   site + demos
```

Each game has a *showcase bundle*: `showcase.json` + `media/` + optional `demo/` (a built static game).
Sources, in priority order:

1. `.cache/games/<slug>/` fetched by CI from the game repo's `showcase` release (gitignored).
2. `content/games/<slug>/` the committed seed, used until the game publishes its first release.

A fetched bundle replaces the seed completely. A fetched bundle that fails validation is ignored with a
warning and the seed is used. An invalid seed fails the build. The hourly run skips the deploy when the
fetched assets are unchanged (fingerprint of asset id and update time).

## Local development

```
npm run dev          # build, then serve at http://localhost:4321
npm run build        # dist/
npm run check        # build + verify every internal link in dist/ (play/ excluded)
npm run fetch        # download bundles from GitHub (SHOWCASE_TOKEN for private repos)
```

Environment: `SITE_BASE` (default `/`; use `/repo-name/` to test a project-page deploy), `PORT` (default 4321).

Try a real demo without waiting for CI:

```
node scripts/local-demo.mjs beast-clash D:/dev/beast-clash
npm run build        # dist/play/beast-clash/ now exists
```

This runs `vite build` with the game repo as cwd but writes only into `.cache/`. `npm run fetch` (or deleting
`.cache/`) goes back to seeds.

## Adding a game

1. Add `{ "slug": "my-game", "repo": "owner/repo" }` to `games` in `site.json` (the order is the display order).
2. Create `content/games/my-game/showcase.json` and `media/` (see the schema below). Do not add `demo/` to seeds.
3. In the game repo, copy `templates/game-repo/.github/workflows/showcase.yml` and put a copy of
   the seed bundle in a `showcase/` folder. Its Vite config must work with `--base=./`.

`showcase.json` fields: `title`, `tagline`, `status` (`prototype | in-development | playable | released`),
`genre[]`, `platforms[]`, `accent` (`#rrggbb`), `summary`, `description`, `features[]`, `controls[{input,action}]`,
`media{cover, gallery[{src,alt,type}]}`, `demo{available, mode: embed|link, aspect: "16/9", notes, requires}`,
`links[{label,url}]`, `updated`, `version`. `updated` and `version` are filled in by CI. The build validates all of
it and prints clear errors.

## Editing copy

Edit `content/games/<slug>/showcase.json` (seed) and the copy in the game repo's `showcase/` folder; the game repo's
copy wins once it has published a release. `description` supports paragraphs, `**bold**`, `*italic*`, `- ` lists and
`[links](https://...)`. HTML is escaped. Site-wide text lives in `site.json`.

## Support and shop (off by default)

In `site.json` set `support.enabled` or `shop.enabled` to `true` and fill in the heading, blurb and links. A section
appears on the home page and a link in the nav and footer. These are link-outs only; there is no payment code.

## The one secret

Most game repos are private, so the deploy workflow needs read access to them. Create a **fine-grained personal
access token** with *Repository access* to the private game repos and only **Contents: Read-only**, then store it in
this repo as the Actions secret `SHOWCASE_TOKEN`. Public repos work without it. Rotate it before it expires.

Also: set Pages source to "GitHub Actions" (Settings > Pages), and leave this repo public.

## Custom domain

Add the domain under Settings > Pages and set `url` in `site.json` to the final address with a trailing slash
(for example `https://games.example.com/`), which enables `sitemap.xml` and canonical links. With a custom domain
at the root, `SITE_BASE` resolves to `/` automatically. Do not add a `CNAME` file to `dist/` by hand; the Pages
setting handles it.

## Notes

- Every site page carries a strict CSP meta tag (no inline scripts or styles). Per-game accents are generated into
  `assets/accents.css`. Demos under `play/` are copied untouched.
- Optional instant refresh: a game repo can send `repository_dispatch` of type `showcase-updated` to this repo
  after publishing (needs a token with access to this repo). Without it, the hourly schedule picks up changes.
