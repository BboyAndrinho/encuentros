// Guarda la app en el teléfono para que funcione sin conexión.
// Cuando publiques una versión nueva, cambia el número de VERSION.
const VERSION = 'encuentros-v4';
const ARCHIVOS = [
  './', 'index.html', 'estilos.css', 'app.js', 'datos/srd.js', 'manifest.webmanifest',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(resp => {
      if (resp.ok && new URL(e.request.url).origin === location.origin) {
        const copia = resp.clone();
        caches.open(VERSION).then(c => c.put(e.request, copia));
      }
      return resp;
    }).catch(() => caches.match('index.html')))
  );
});
