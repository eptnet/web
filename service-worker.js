// service-worker.js (Versión Definitiva y Global)

console.log('Service Worker: Archivo cargado (v2 - Global)');

const EXTERNAL_HOSTS_TO_PROXY = [
  'i.ibb.co',
  'substackcdn.com',
  'substack-post-media.s3.amazonaws.com',
  'placehold.co',
  'googleusercontent.com',
  'zenodo.org'
];

const PROXY_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/image-proxy';

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // --- LA NUEVA REGLA, MÁS SIMPLE Y EFECTIVA ---
  // Verificamos únicamente si el dominio de la petición está en nuestra lista.
  const needsProxy = EXTERNAL_HOSTS_TO_PROXY.some(host => requestUrl.hostname.endsWith(host));

  if (needsProxy) {
    // Si necesita el proxy, hacemos el mismo reenvío que antes.
    console.log(`[SW] Interceptado: ${requestUrl.href}`);
    
    const proxyRequestUrl = new URL(PROXY_URL);
    proxyRequestUrl.searchParams.set('url', requestUrl.href);
    
    console.log(`[SW] Reenviando a: ${proxyRequestUrl.href}`);

    event.respondWith(fetch(proxyRequestUrl));
  }
  // Si no está en la lista, la petición continúa normalmente.
});