// Hand-written HTML templates (template literals + esc()).
import { esc, renderMarkdown, STATUS_LABELS, STATUS_MEANINGS, STAGES, IMAGE_EXT, VIDEO_EXT } from './lib.mjs';

export const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "frame-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const ICON = {
  play: '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  expand: '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external: '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function layout({ site, base, title, description, path: pagePath = '', body, bodyClass = '', gameSlug = '' }) {
  const u = (p) => base + p;
  const fullTitle = title ? `${title} | ${site.name}` : site.name;
  const nav = [
    `<a href="${u('')}#games">Games</a>`,
    `<a href="${u('about/')}">About</a>`,
    site.support?.enabled ? `<a href="${u('')}#support">Support</a>` : '',
    site.shop?.enabled ? `<a href="${u('')}#shop">Shop</a>` : '',
  ].join('');
  const canonical = site.url ? `<link rel="canonical" href="${esc(site.url.replace(/\/?$/, '/') + pagePath)}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description.split('\n')[0])}">
<meta name="color-scheme" content="dark light">
<link rel="icon" href="${u('favicon.svg')}" type="image/svg+xml">
${canonical}
<link rel="stylesheet" href="${u('assets/site.css')}">
<link rel="stylesheet" href="${u('assets/accents.css')}">
<script src="${u('assets/site.js')}" defer></script>
</head>
<body class="${esc(bodyClass)}"${gameSlug ? ` data-game="${esc(gameSlug)}"` : ''}>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${u('')}">${esc(site.name)}</a>
    <nav aria-label="Main">${nav}</nav>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-row">
    <p>${esc(site.name)}.</p>
    <ul class="footer-links">
      <li><a href="${u('')}#games">Games</a></li>
      <li><a href="${u('about/')}">About</a></li>
      ${site.support?.enabled ? `<li><a href="${u('')}#support">${esc(site.support.heading)}</a></li>` : ''}
      ${site.shop?.enabled ? `<li><a href="${u('')}#shop">${esc(site.shop.heading)}</a></li>` : ''}
    </ul>
  </div>
</footer>
</body>
</html>
`;
}

const chips = (arr, cls = 'chip') => `<ul class="chips" role="list">${arr.map((x) => `<li class="${cls}">${esc(x)}</li>`).join('')}</ul>`;
const badge = (status) => `<span class="badge badge-${esc(status)}"${STATUS_MEANINGS[status] ? ` title="${esc(STATUS_MEANINGS[status])}"` : ''}>${esc(STATUS_LABELS[status])}</span>`;

export function homePage({ site, base, games }) {
  const u = (p) => base + p;
  const cards = games
    .map(({ slug, data, hasDemo }, i) => `
<li class="card" data-game="${esc(slug)}">
  <a class="card-cover" href="${u(`games/${slug}/`)}" tabindex="-1" aria-hidden="true">
    <img src="${u(`games/${slug}/${data.media.cover}`)}" alt="" ${i === 0 ? '' : 'loading="lazy" '}decoding="async">
  </a>
  <div class="card-body">
    <div class="card-meta">${badge(data.status)}${chips(data.genre)}</div>
    <h3 class="card-title"><a href="${u(`games/${slug}/`)}">${esc(data.title)}</a></h3>
    <p class="card-summary">${esc(data.summary)}</p>
    <div class="card-actions">
      ${hasDemo ? `<a class="btn btn-primary" href="${u(`games/${slug}/#play`)}">${ICON.play}Play demo</a>` : ''}
      <a class="btn" href="${u(`games/${slug}/`)}">Details${ICON.arrow}</a>
    </div>
  </div>
</li>`)
    .join('\n');
  const support = site.support?.enabled
    ? `<section class="section" id="support" aria-labelledby="support-h">
  <h2 id="support-h">${esc(site.support.heading)}</h2>
  <p class="lede">${esc(site.support.blurb)}</p>
  <ul class="link-list">${site.support.links.map((l) => `<li><a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}${ICON.external}</a></li>`).join('')}</ul>
</section>`
    : '';
  const shop = site.shop?.enabled
    ? `<section class="section" id="shop" aria-labelledby="shop-h">
  <h2 id="shop-h">${esc(site.shop.heading)}</h2>
  <p class="lede">${esc(site.shop.blurb)}</p>
  <p><a class="btn btn-primary" href="${esc(site.shop.url)}" target="_blank" rel="noopener noreferrer">Visit the shop${ICON.external}</a></p>
</section>`
    : '';
  return layout({
    site,
    base,
    title: '',
    description: site.tagline,
    bodyClass: 'home',
    body: `<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Game showcase</p>
    <h1>${esc(site.tagline)}</h1>
    <p class="lede">Play the demos that run in your browser, or read how each game is coming along.</p>
  </div>
</section>
<div class="wrap">
<section class="section" id="games" aria-labelledby="games-h">
  <h2 id="games-h">The games</h2>
  <ul class="card-grid" role="list">${cards}</ul>
</section>
${support}
${shop}
</div>`,
  });
}

function player({ slug, data, hasDemo, base }) {
  const u = (p) => base + p;
  const d = data.demo;
  const playUrl = u(`play/${slug}/index.html`);
  if (hasDemo && d.mode === 'embed') {
    return `<section class="section player" id="play" aria-labelledby="play-h">
  <h2 id="play-h">Play the demo</h2>
  <div class="player-frame" data-player data-src="${playUrl}" data-title="${esc(data.title)} demo">
    <img src="${u(`games/${slug}/${data.media.cover}`)}" alt="" loading="lazy" decoding="async">
    <a class="play-btn" href="${playUrl}" target="_blank" rel="noopener" data-play aria-label="Load and play the ${esc(data.title)} demo">${ICON.play}<span>Play</span></a>
  </div>
  <div class="player-bar">
    <button type="button" class="btn" data-fullscreen hidden>${ICON.expand}Fullscreen</button>
    <a class="btn" href="${playUrl}" target="_blank" rel="noopener">Open in new tab${ICON.external}</a>
    ${d.notes ? `<p class="muted">${esc(d.notes)}</p>` : ''}
    ${d.requires ? `<p class="muted">${esc(d.requires)}</p>` : ''}
  </div>
</section>`;
  }
  if (hasDemo && d.mode === 'link') {
    return `<section class="section player player-link" id="play" aria-labelledby="play-h">
  <h2 id="play-h">Play the demo</h2>
  <div class="panel">
    <p><a class="btn btn-primary btn-large" href="${u(`play/${slug}/`)}" target="_blank" rel="noopener">${ICON.play}Open the demo${ICON.external}</a></p>
    ${d.requires ? `<p><strong>${esc(d.requires)}</strong></p>` : ''}
    ${d.notes ? `<p class="muted">${esc(d.notes)}</p>` : ''}
  </div>
</section>`;
  }
  return `<section class="section player player-soon" id="play" aria-labelledby="play-h">
  <h2 id="play-h">Demo</h2>
  <div class="panel">
    <p class="panel-title">${d.notes ? '' : 'Demo coming soon'}</p>
    ${d.notes ? `<p>${esc(d.notes)}</p>` : '<p class="muted">There is no playable demo on this site yet.</p>'}
    ${d.requires ? `<p class="muted">${esc(d.requires)}</p>` : ''}
  </div>
</section>`;
}

export function gamePage({ site, base, slug, data, hasDemo }) {
  const u = (p) => base + p;
  const media = (p) => u(`games/${slug}/${p}`);
  const controls = data.controls.length
    ? `<section class="section" aria-labelledby="controls-h">
  <h2 id="controls-h">Controls</h2>
  <div class="table-wrap"><table>
    <thead><tr><th scope="col">Input</th><th scope="col">Action</th></tr></thead>
    <tbody>${data.controls.map((c) => `<tr><th scope="row">${esc(c.input)}</th><td>${esc(c.action)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>`
    : '';
  const features = data.features.length
    ? `<section class="section" aria-labelledby="features-h"><h2 id="features-h">Features</h2><ul class="feature-list">${data.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>`
    : '';
  const gallery = data.media.gallery.length
    ? `<section class="section" aria-labelledby="gallery-h">
  <h2 id="gallery-h">Gallery</h2>
  <ul class="gallery" role="list">${data.media.gallery
    .map((g) =>
      g.type === 'video'
        ? `<li><figure><video controls preload="none" playsinline aria-label="${esc(g.alt)}"><source src="${media(g.src)}"></video><figcaption>${esc(g.alt)}</figcaption></figure></li>`
        : `<li><figure><a href="${media(g.src)}" target="_blank" rel="noopener"><img src="${media(g.src)}" alt="${esc(g.alt)}" loading="lazy" decoding="async"></a><figcaption>${esc(g.alt)}</figcaption></figure></li>`,
    )
    .join('')}</ul>
</section>`
    : '';
  const links = data.links.length
    ? `<section class="section" aria-labelledby="links-h"><h2 id="links-h">Links</h2><ul class="link-list">${data.links.map((l) => `<li><a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}${ICON.external}</a></li>`).join('')}</ul></section>`
    : '';
  const meta = [];
  if (data.updated) meta.push(`Last updated <time datetime="${esc(data.updated)}">${esc(fmtDate(data.updated))}</time>`);
  if (data.version) meta.push(`Build <code>${esc(data.version)}</code>`);
  return layout({
    site,
    base,
    title: data.title,
    description: data.summary,
    path: `games/${slug}/`,
    gameSlug: slug,
    bodyClass: 'game',
    body: `<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${u('')}#games">All games</a></nav>
<section class="game-hero">
  <div class="game-hero-text">
    <div class="card-meta">${badge(data.status)}</div>
    <h1>${esc(data.title)}</h1>
    <p class="lede">${esc(data.tagline)}</p>
    <p class="meta-label">Platforms</p>
    ${chips(data.platforms)}
    <p class="meta-label">Genre</p>
    ${chips(data.genre)}
  </div>
  <div class="game-hero-cover"><img src="${media(data.media.cover)}" alt="Cover art for ${esc(data.title)}"></div>
</section>
${player({ slug, data, hasDemo, base })}
<section class="section prose" aria-labelledby="about-h">
  <h2 id="about-h">About the game</h2>
  ${renderMarkdown(data.description)}
</section>
${features}
${controls}
${gallery}
${links}
${meta.length ? `<p class="updated muted">${meta.join(' &middot; ')}</p>` : ''}
</div>`,
  });
}

export function aboutPage({ site, base }) {
  return layout({
    site,
    base,
    title: 'About',
    description: site.tagline,
    path: 'about/',
    bodyClass: 'about',
    body: `<div class="wrap narrow">
<section class="section prose">
  <h1>About</h1>
  ${renderMarkdown(site.description)}
  <h2>What the stage labels mean</h2>
  <dl class="stages">
${STAGES.map(([, label, meaning]) => `    <dt>${esc(label)}</dt><dd>${esc(meaning)}</dd>`).join(' ')}
  </dl>
  <p><a class="btn" href="${base}#games">See the games${ICON.arrow}</a></p>
</section>
</div>`,
  });
}

export function notFoundPage({ site, base }) {
  return layout({
    site,
    base,
    title: 'Page not found',
    description: 'Page not found',
    bodyClass: 'notfound',
    body: `<div class="wrap narrow">
<section class="section">
  <p class="eyebrow">404</p>
  <h1>That page isn't here</h1>
  <p class="lede">The link may be old, or the game may have moved.</p>
  <p><a class="btn btn-primary" href="${base}">Back to the games</a></p>
</section>
</div>`,
  });
}
