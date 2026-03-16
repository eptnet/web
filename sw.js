const CACHE_NAME = 'ept-pwa-v1';

// 1. Instalación del Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Obliga al SW a activarse inmediatamente
    console.log('[Service Worker] Instalado');
});

// 2. Activación y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('[Service Worker] Activado');
});

// 3. Estrategia "Network First" (Primero red, luego caché si falla)
self.addEventListener('fetch', (event) => {
    // Solo cacheamos peticiones GET de nuestro propio dominio (ignoramos base de datos, extensiones, etc.)
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la red funciona, guardamos una copia en el caché para la próxima
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Si no hay internet, buscamos el archivo en el caché
                console.log('[Service Worker] Sin conexión, sirviendo desde caché:', event.request.url);
                return caches.match(event.request);
            })
    );
});