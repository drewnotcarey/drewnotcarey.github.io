/* EV Gym service worker - offline app shell cache */
const CACHE = 'evgym-v4';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/rounds-guess.js',
               'js/rounds-dice.js', 'js/stats.js',
               'manifest.webmanifest', 'icon.svg', 'docs/BUILD_PLAN.md'];
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
