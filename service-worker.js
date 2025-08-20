// service-worker.js (Versión con Diagnóstico)

console.log('Service Worker: Archivo cargado.');

const EXTERNAL_IMAGE_HOSTS = [
  'i.ibb.co',
  'substack-cdn.com',
  'substack-post-media.s3.amazonaws.com',
  'placehold.co', // Añadido para imágenes de prueba
  'googleusercontent.com', // Añadido para avatares de Google
  'zenodo.org' // Añadido para los badges de DOI
];

const PROXY_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/image-proxy';

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  const isExternalImage = event.request.destination === 'image' && EXTERNAL_IMAGE_HOSTS.some(host => requestUrl.hostname.endsWith(host));

  if (isExternalImage) {
    console.log(`[Service Worker] INTERCEPTADO: ${requestUrl.href}`);
    
    const proxyRequestUrl = new URL(PROXY_URL);
    proxyRequestUrl.searchParams.set('url', requestUrl.href);
    
    console.log(`[Service Worker] REENVIANDO A: ${proxyRequestUrl.href}`);

    event.respondWith(fetch(proxyRequestUrl, {
      headers: event.request.headers
    }));
  }
});