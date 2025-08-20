// Lista de dominios externos de donde provienen tus imágenes
const EXTERNAL_IMAGE_HOSTS = [
  'i.ibb.co',
  'substack-cdn.com',
  'substack-post-media.s3.amazonaws.com'
  // Puedes añadir más dominios aquí en el futuro si es necesario
];

// La URL completa de tu función de proxy en Supabase
const PROXY_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/image-proxy';

// El "guardia de tráfico" se activa cuando hay una petición de red
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Verificamos si la petición es para una imagen y si su dominio está en nuestra lista
  const isExternalImage = event.request.destination === 'image' && EXTERNAL_IMAGE_HOSTS.includes(requestUrl.hostname);

  if (isExternalImage) {
    // Si es una imagen externa, interceptamos y la pasamos por el proxy
    const proxyUrl = new URL(PROXY_URL);
    proxyUrl.searchParams.set('url', requestUrl.href);

    // Respondemos a la página con el resultado del proxy en lugar de la petición original
    event.respondWith(fetch(proxyUrl, {
      headers: event.request.headers
    }));
  }
  // Si no es una imagen de nuestra lista, la dejamos pasar sin modificarla
});