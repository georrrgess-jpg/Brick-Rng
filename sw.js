/* Pop Rush service worker: caches the whole game so it opens instantly and works offline.
   Bump VERSION whenever a file changes. Classic scripts only, no build step, so the file list is the build. */
const VERSION = 'poprush-v2.0.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/base.css', 'css/screens.css', 'css/run.css', 'css/chest.css', 'css/skins.css', 'css/s3-skins.css', 'css/s3-scenes.css', 'css/badges.css',
  'js/rng.js', 'js/board.js', 'js/config.js', 'js/boosters.js', 'js/items.js', 'js/chests.js', 'js/engine.js', 'js/storage.js', 'js/pass.js',
  'js/progress.js', 'js/missions.js', 'js/audio.js', 'js/music.js', 'js/fx.js', 'js/skins.js', 'js/s3-skins.js', 'js/s3-pops.js', 'js/s3-scenes.js', 'js/badges.js', 'js/view.js', 'js/ui.js', 'js/chestart.js',
  'js/spin.js', 'js/openings.js', 'js/screens.js', 'js/run.js', 'js/main.js',
  'fonts/fredoka.woff2', 'fonts/nunito.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // cache first, then refresh in the background so the next launch has the newest files
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
