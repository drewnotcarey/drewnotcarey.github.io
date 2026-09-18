/* School of Thought service worker - offline app shell cache */
const CACHE = 'evgym-v25';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/race-core.js',
               'js/rounds-guess.js', 'js/rounds-dice.js', 'js/stats.js', 'js/ranks.js',
               'manifest.webmanifest', 'docs/BUILD_PLAN.md',
               'img/logo.png', 'img/rank-minnow.png', 'img/rank-shark.png',
               'img/rank-whale.png', 'img/icon-64.png', 'img/icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
