// Shared helpers for the build, fetch and check scripts. Zero dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');
export const CACHE = path.join(ROOT, '.cache');

/** Normalised base path: always starts and ends with a slash. */
export function getBase() {
  let b = process.env.SITE_BASE || '/';
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b += '/';
  return b;
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------- markdown-lite
// Paragraphs, **bold**, *italic*, "- " lists, [text](https://...) links.
// Everything is HTML-escaped first, so source text can never inject markup.
function inline(src) {
  const stash = [];
  let s = esc(src);
  s = s.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_, text, url) => {
    stash.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    return `\u0000${stash.length - 1}\u0000`;
  });
  s = s.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

export function renderMarkdown(src) {
  const blocks = String(src ?? '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push('<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('') + '</ul>');
    } else {
      out.push(`<p>${inline(lines.map((l) => l.trim()).join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- validation
export const STATUSES = ['prototype', 'in-development', 'playable', 'released'];
export const STATUS_LABELS = {
  prototype: 'Prototype',
  'in-development': 'In development',
  playable: 'Playable',
  released: 'Released',
};
const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|svg|webm|mp4|ogv)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const VIDEO_EXT = /\.(webm|mp4|ogv)$/i;
export { IMAGE_EXT, VIDEO_EXT };

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isStrArr = (v) => Array.isArray(v) && v.every((x) => isStr(x));
const isUrl = (v) => typeof v === 'string' && /^https?:\/\/[^\s]+$/i.test(v);

function safeRel(p) {
  return typeof p === 'string' && !p.includes('\\') && !p.startsWith('/') && !p.split('/').includes('..') && !/^[a-z]+:/i.test(p);
}

/** Returns an array of error strings (empty when valid). `dir` is the bundle folder. */
export function validateShowcase(d, dir) {
  const e = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['showcase.json must be a JSON object'];
  for (const k of ['title', 'tagline', 'summary', 'description']) if (!isStr(d[k])) e.push(`"${k}" must be a non-empty string`);
  if (!STATUSES.includes(d.status)) e.push(`"status" must be one of ${STATUSES.join(', ')}`);
  if (!isStrArr(d.genre)) e.push('"genre" must be an array of strings');
  if (!isStrArr(d.platforms)) e.push('"platforms" must be an array of strings');
  if (typeof d.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(d.accent)) e.push('"accent" must be a #rrggbb colour');
  if (!isStrArr(d.features)) e.push('"features" must be an array of strings');
  if (!Array.isArray(d.controls) || !d.controls.every((c) => c && isStr(c.input) && isStr(c.action))) {
    e.push('"controls" must be an array of {input, action} strings');
  }
  const fileOk = (rel) => safeRel(rel) && MEDIA_EXT.test(rel) && fs.existsSync(path.join(dir, rel)) && fs.statSync(path.join(dir, rel)).isFile();
  const m = d.media;
  if (!m || typeof m !== 'object') e.push('"media" must be an object');
  else {
    if (!isStr(m.cover) || !IMAGE_EXT.test(m.cover)) e.push('"media.cover" must be an image path');
    else if (!fileOk(m.cover)) e.push(`"media.cover" file not found or unsafe: ${m.cover}`);
    if (!Array.isArray(m.gallery)) e.push('"media.gallery" must be an array');
    else
      m.gallery.forEach((g, i) => {
        if (!g || typeof g !== 'object') return e.push(`media.gallery[${i}] must be an object`);
        if (!isStr(g.src)) e.push(`media.gallery[${i}].src is required`);
        else if (!fileOk(g.src)) e.push(`media.gallery[${i}].src file not found or unsafe: ${g.src}`);
        if (!isStr(g.alt)) e.push(`media.gallery[${i}].alt is required (accessibility)`);
        if (g.type !== 'image' && g.type !== 'video') e.push(`media.gallery[${i}].type must be "image" or "video"`);
        else if (isStr(g.src) && (g.type === 'image' ? !IMAGE_EXT.test(g.src) : !VIDEO_EXT.test(g.src))) e.push(`media.gallery[${i}] type "${g.type}" does not match file extension`);
      });
  }
  const demo = d.demo;
  if (!demo || typeof demo !== 'object') e.push('"demo" must be an object');
  else {
    if (typeof demo.available !== 'boolean') e.push('"demo.available" must be true or false');
    if (demo.mode !== 'embed' && demo.mode !== 'link') e.push('"demo.mode" must be "embed" or "link"');
    if (typeof demo.aspect !== 'string' || !/^\d{1,3}\/\d{1,3}$/.test(demo.aspect)) e.push('"demo.aspect" must look like "16/9"');
    for (const k of ['notes', 'requires']) if (typeof demo[k] !== 'string') e.push(`"demo.${k}" must be a string (may be empty)`);
    if (demo.available === true && !fs.existsSync(path.join(dir, 'demo', 'index.html'))) e.push('"demo.available" is true but demo/index.html is missing');
  }
  if (!Array.isArray(d.links) || !d.links.every((l) => l && isStr(l.label) && isUrl(l.url))) e.push('"links" must be an array of {label, url (http/https)}');
  if (typeof d.updated !== 'string' || (d.updated !== '' && Number.isNaN(Date.parse(d.updated)))) e.push('"updated" must be an ISO date string or empty');
  if (typeof d.version !== 'string') e.push('"version" must be a string');
  return e;
}

export function validateSite(s) {
  const e = [];
  if (!isStr(s.name)) e.push('name is required');
  if (!isStr(s.tagline)) e.push('tagline is required');
  if (!isStr(s.description)) e.push('description is required');
  if (!Array.isArray(s.games) || !s.games.length) e.push('games must be a non-empty array');
  else s.games.forEach((g, i) => {
    if (!g || !/^[a-z0-9][a-z0-9-]*$/.test(g.slug || '')) e.push(`games[${i}].slug must be lowercase letters, digits and dashes`);
    if (!g || !/^[\w.-]+\/[\w.-]+$/.test(g.repo || '')) e.push(`games[${i}].repo must look like owner/repo`);
  });
  for (const k of ['support', 'shop']) if (!s[k] || typeof s[k].enabled !== 'boolean') e.push(`${k}.enabled must be a boolean`);
  if (s.support?.enabled) {
    if (!isStr(s.support.heading)) e.push('support.heading is required when enabled');
    if (!Array.isArray(s.support.links) || !s.support.links.every((l) => isStr(l.label) && isUrl(l.url))) e.push('support.links must be {label,url} with http(s) urls');
  }
  if (s.shop?.enabled) {
    if (!isStr(s.shop.heading)) e.push('shop.heading is required when enabled');
    if (!isUrl(s.shop.url)) e.push('shop.url must be an http(s) url when enabled');
  }
  return e;
}

// ---------------------------------------------------------------- colour helpers
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r) {
  return '#' + r.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Text colour (near-black or white) with the best contrast on `bg`. */
export function inkFor(bg) {
  return contrast(bg, '#0d0f14') >= contrast(bg, '#ffffff') ? '#0d0f14' : '#ffffff';
}
/** Darken `hex` until it has at least `min` contrast against `bg` (for the light theme). */
export function darkenFor(hex, bg, min = 3.2) {
  let rgb = hexToRgb(hex);
  for (let i = 0; i < 40 && contrast(rgbToHex(rgb), bg) < min; i++) rgb = rgb.map((v) => v * 0.93);
  return rgbToHex(rgb);
}

export function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
export function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}
