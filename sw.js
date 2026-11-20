// Guarda la app en el teléfono para que funcione sin conexión.
// Cuando publiques una versión nueva, cambia el número de VERSION.
const VERSION = 'encuentros-v6';
const ARCHIVOS = [
  './', 'index.html', 'estilos.css', 'app.js', 'datos/srd.js', 'manifest.webmanifest',
  'iconos/icono.svg', 'iconos/icono-192.png', 'iconos/icono-512.png'
];

self.addEventListener('install', e => {
  // 'reload': pedir siempre los archivos al servidor, nunca copias viejas del navegador
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Se responde al instante con la copia guardada (funciona sin conexión) y, si hay internet,
// se descarga a la vez la última versión del archivo para la próxima vez. Así, si alguna copia
// quedó vieja, se arregla sola al volver a abrir la app.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  url.search = '';
  const clave = url.href;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const guardada = await cache.match(clave);
    const red = fetch(clave, { cache: 'no-cache' })
      .then(resp => { if (resp.ok) cache.put(clave, resp.clone()); return resp; })
      .catch(() => null);
    if (guardada) { e.waitUntil(red); return guardada; }
    return (await red) || (await cache.match(new URL('index.html', location.href).href)) || Response.error();
  }));
});
