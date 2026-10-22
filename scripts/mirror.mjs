// Mirror https://undp-ges-2026.vercel.app/ into an output folder (raw, unmodified).
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://undp-ges-2026.vercel.app';
const OUT = process.argv[2];
const seen = new Set();
const queue = ['/'];

const refRe = [
  /["'`(](\/_next\/static\/[^"'`)\s\\?#]+)/g,
  /["'`(](\/[A-Za-z0-9_.\-\/]+\.(?:svg|png|jpe?g|webp|ico|gif|woff2?|ttf|otf|mp4|webm|json|txt|xml|webmanifest|pdf))/g,
];

function localPath(p) {
  if (p === '/') return 'index.html';
  return decodeURIComponent(p.replace(/^\//, ''));
}

async function fetchOne(p) {
  const res = await fetch(ORIGIN + p, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) { console.log('MISS', res.status, p); return null; }
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(OUT, localPath(p));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buf);
  console.log('OK  ', p, buf.length);
  return { buf, type: res.headers.get('content-type') || '' };
}

function resolveRel(base, rel) {
  return new URL(rel, ORIGIN + base).pathname;
}

for (const extra of ['/favicon.ico', '/robots.txt', '/manifest.webmanifest', '/sitemap.xml']) queue.push(extra);

while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const r = await fetchOne(p);
  if (!r) continue;
  if (!/text|javascript|css|json|svg|html/.test(r.type) && !/\.(js|css|html)$/.test(p) && p !== '/') continue;
  const text = r.buf.toString('utf8');
  for (const re of refRe) for (const m of text.matchAll(re)) queue.push(m[1]);
  if (p.endsWith('.css')) {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const u = m[1];
      if (/^(data:|https?:|#)/.test(u)) continue;
      queue.push(resolveRel(p, u));
    }
  }
}
