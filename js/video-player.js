/**
 * =========================================================================
 * Lógica para Reproductores de Video
 * - Inicializa el reproductor destacado.
 * - Maneja el lanzamiento del carrusel de historias en el panel lateral.
 * Versión Final Definitiva: Añade playsinline a las opciones de YouTube.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // Contenedor principal de la página para encontrar los módulos
    const mainContainer = document.querySelector('main.container');
    // Elementos del panel lateral que ya existen en el HTML
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelCloseBtn = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

    let storiesPlayerInstance = null; // Guardaremos la instancia del reproductor aquí

    function initializeFeaturedPlayer() {
        const featuredWrapper = document.getElementById('video-featured-player');
        if (!featuredWrapper) {
            setTimeout(initializeFeaturedPlayer, 100);
            return;
        }

        try {
            new Plyr(featuredWrapper, {
                youtube: {
                    playerVars: { origin: window.location.origin }
                }
            });
        } catch (e) {
            console.error("Error inicializando el reproductor destacado (Plyr):", e);
        }
    }

    function launchStoriesPlayer() {
        // 1. Limpiar y preparar el panel lateral
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.add('side-panel__content--video');
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        // 2. Crear la estructura del reproductor y los controles
        sidePanelContent.innerHTML = `
            <div id="panel-player-container">
                <div id="panel-player"></div>
                <div class="story-controls">
                    <button class="story-button" id="panel-volume-btn" aria-label="Activar sonido"><i class="fa-solid fa-volume-xmark"></i></button>
                    <button class="story-button" id="panel-next-btn" aria-label="Siguiente historia"><i class="fa-solid fa-angle-right"></i></button>
                </div>
            </div>
        `;

        // 3. Definir la lista de reproducción
        const storiesPlaylist = [
            { provider: 'youtube', embedId: 'MlJYzpXrlq8' },
            { provider: 'youtube', embedId: '2E0mxIYMGAM' },
            { provider: 'youtube', embedId: 'ldeQjvd6x5U' }
        ];
        let currentVideoIndex = 0;

        // 4. Inicializar Plyr con la configuración COMPLETA para YouTube
        storiesPlayerInstance = new Plyr('#panel-player', {
            controls: [],
            autoplay: true,
            muted: true,
            clickToPlay: false,
            // --- LA CORRECCIÓN CLAVE ESTÁ AQUÍ ---
            youtube: {
                playerVars: {
                    origin: window.location.origin,
                    playsinline: 1,      // Permite la reproducción automática en todos los entornos
                    iv_load_policy: 3,   // Sin anotaciones
                    modestbranding: 1,   // Logo de YouTube mínimo
                    rel: 0               // Sin videos relacionados
                }
            }
        });
        
        // 5. Lógica para manejar la lista de reproducción
        const playVideo = (index) => {
            if (storiesPlayerInstance) {
                const video = storiesPlaylist[index];
                storiesPlayerInstance.source = {
                    type: 'video',
                    sources: [{ src: video.embedId, provider: video.provider }]
                };
            }
        };

        const nextStory = () => {
            currentVideoIndex = (currentVideoIndex + 1) % storiesPlaylist.length;
            playVideo(currentVideoIndex);
        };
        
        storiesPlayerInstance.on('ready', event => event.detail.plyr.play());
        storiesPlayerInstance.on('ended', nextStory);

        // 6. Conectar los botones a las funciones
        document.getElementById('panel-next-btn').addEventListener('click', nextStory);
        document.getElementById('panel-volume-btn').addEventListener('click', () => {
            if (storiesPlayerInstance) {
                storiesPlayerInstance.muted = !storiesPlayerInstance.muted;
                document.getElementById('panel-volume-btn').innerHTML = storiesPlayerInstance.muted 
                    ? '<i class="fa-solid fa-volume-xmark"></i>' 
                    : '<i class="fa-solid fa-volume-high"></i>';
            }
        });

        // Iniciar con el primer video
        playVideo(currentVideoIndex);
    }

    function destroyStoriesPlayer() {
        if (storiesPlayerInstance) {
            storiesPlayerInstance.destroy();
            storiesPlayerInstance = null;
        }
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.remove('side-panel__content--video');
    }

    // --- INICIALIZACIÓN Y MANEJADORES DE EVENTOS ---
    initializeFeaturedPlayer();

    mainContainer.addEventListener('click', (event) => {
        const storiesCard = event.target.closest('[data-id="static-launch-stories"]');
        if (storiesCard) {
            launchStoriesPlayer();
        }
    });

    sidePanelCloseBtn.addEventListener('click', destroyStoriesPlayer);
    overlay.addEventListener('click', destroyStoriesPlayer);
});