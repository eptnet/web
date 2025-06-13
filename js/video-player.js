/**
 * =========================================================================
 * Lógica para el Reproductor de Historias Inmersivo con Swiper.js y YouTube API
 * VERSIÓN FINAL 2.0 (Búsqueda de Shorts mejorada)
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN ---
    const YOUTUBE_API_KEY = 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw'; 
    const CHANNEL_ID = 'UCg3ms3gecQ-2cjMhJwaPAig';
    
    // --- ELEMENTOS DEL DOM ---
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelCloseBtn = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

    // --- VARIABLES DE ESTADO ---
    let swiperInstance = null;
    let players = {}; 
    let isApiReady = false; 
    
    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) {
            isApiReady = true;
            return;
        }
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
    
    window.onYouTubeIframeAPIReady = () => {
        isApiReady = true;
        if (swiperInstance && swiperInstance.slides) {
            createYouTubePlayers(swiperInstance);
        }
    };

    async function launchStoriesPlayer() {
        sidePanelContent.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i></div>';
        sidePanelContent.classList.add('side-panel__content--video');
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        
        try {
            // --- INICIO DE LA MODIFICACIÓN: Búsqueda Mejorada ---
            // Buscamos videos con "#Shorts" O "#Short" Y que duren menos de 4 minutos.
            // El símbolo | funciona como un "OR" en la búsqueda de YouTube.
            // El parámetro videoDuration=short es un filtro adicional muy eficaz.
            const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=15&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${YOUTUBE_API_KEY}`;
            // --- FIN DE LA MODIFICACIÓN ---

            const response = await fetch(apiUrl);
            if (!response.ok) {
                 const errorData = await response.json();
                 console.error('Error detallado de la API de YouTube:', errorData);
                 throw new Error(`Error de API de YouTube: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                 throw new Error('No se encontraron videos que cumplan con el criterio de Shorts.');
            }
            
            const videoIds = data.items.map(item => item.id.videoId);
            
            buildSwiper(videoIds);

            // --- INICIO DE MODIFICACIÓN: API de Historial ---
            // Justo después de que el try...catch termine y antes de que cierre la función
            // empujamos un estado al historial.
            history.pushState({ epistecnologia_shorts_panel: 'open' }, 'Historias');
            // --- FIN DE MODIFICACIÓN ---

        } catch (error) {
            console.error('Error al lanzar el reproductor de historias:', error);
            sidePanelContent.innerHTML = `<p style="color:white;text-align:center;padding:2rem;">No se pudieron cargar las historias.<br><small>${error.message}</small></p>`;
        }
    }

    // Reemplaza esta función en video-player.js
    function buildSwiper(videoIds) {
        const slidesHTML = videoIds.map(id => `
            <div class="swiper-slide">
                <div id="player-${id}" class="player-wrapper"></div>
            </div>
        `).join('');

        // --- INICIO DE LA MODIFICACIÓN: Preloader ---
        // Añadimos un contenedor para el preloader y ocultamos el swiper inicialmente.
        // Puedes cambiar la URL del GIF por uno que te guste.
        sidePanelContent.innerHTML = `
            <div id="shorts-preloader" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
                <img src="https://i.imgur.com/dWSya2H.gif" alt="Cargando historias..." style="width: 50px; height: 50px;" />
            </div>
            <div class="swiper swiper-container-vertical" style="display: none;">
                <div class="swiper-wrapper">${slidesHTML}</div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>
        `;
        // --- FIN DE LA MODIFICACIÓN ---

        swiperInstance = new Swiper('.swiper-container-vertical', {
            direction: 'vertical',
            loop: videoIds.length > 1,
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            mousewheel: true,
            on: {
                init: function (swiper) {
                    if (isApiReady) {
                        createYouTubePlayers(swiper);
                    }
                },
                slideChangeTransitionEnd: function (swiper) {
                    const activeIndex = swiper.realIndex;
                    const previousIndex = swiper.previousRealIndex;

                    const previousPlayer = players[previousIndex];
                    if (previousPlayer && typeof previousPlayer.pauseVideo === 'function') {
                        previousPlayer.pauseVideo();
                    }
                    const currentPlayer = players[activeIndex];
                    if (currentPlayer && typeof currentPlayer.playVideo === 'function') {
                        currentPlayer.playVideo();
                    }
                },
            },
        });
    }

    function createYouTubePlayers(currentSwiper) {
    currentSwiper.slides.forEach((slide, index) => {
        const playerElement = slide.querySelector('.player-wrapper');
        const videoId = playerElement.id.split('-')[1];

        if (playerElement && !players[videoId]) {
            players[videoId] = new YT.Player(playerElement.id, {
                videoId: videoId,
                playerVars: {
                    'autoplay': 0, 'controls': 0, 'mute': 0, // Iniciar con audio
                    'rel': 0, 'iv_load_policy': 3, 'modestbranding': 1, 'playsinline': 1
                },
                events: {
                    'onReady': (event) => {
                        // --- INICIO DE LA MODIFICACIÓN: Ocultar Preloader ---
                        // Si este es el primer video, al estar listo, ocultamos el preloader y mostramos el reproductor.
                        if (index === currentSwiper.realIndex) {
                            const preloader = document.getElementById('shorts-preloader');
                            const swiperContainer = document.querySelector('.swiper-container-vertical');
                            if (preloader) preloader.style.display = 'none';
                            if (swiperContainer) swiperContainer.style.display = 'block';
                            
                            event.target.playVideo();
                        }
                        // --- FIN DE LA MODIFICACIÓN ---
                    },
                        'onStateChange': (event) => {
                            if (event.data === YT.PlayerState.ENDED) {
                                currentSwiper.slideNext();
                            }
                        }
                    }
                });
            }
        });
        const firstPlayer = players[currentSwiper.realIndex];
        if (firstPlayer && typeof firstPlayer.playVideo === 'function') {
            firstPlayer.playVideo();
        }
    }

        function destroyStoriesPlayer() {
        if (swiperInstance) {
            swiperInstance.destroy(true, true);
            swiperInstance = null;
        }
        for (const videoId in players) {
            if (players[videoId] && typeof players[videoId].destroy === 'function') {
                players[videoId].destroy();
            }
        }
        players = {};
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.remove('side-panel__content--video');
        
        // --- NUEVO: Cerramos el panel sin manipular el historial directamente ---
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

        document.addEventListener('launch-stories', launchStoriesPlayer);
        sidePanelCloseBtn.addEventListener('click', destroyStoriesPlayer);
        overlay.addEventListener('click', destroyStoriesPlayer);
        
        loadYouTubeAPI();

        window.addEventListener('popstate', (event) => {
        // Si el usuario presiona "atrás" y el panel está abierto, lo cerramos.
        if (sidePanel.classList.contains('is-open')) {
            // El event.state será null porque ya hemos retrocedido.
            // La simple presencia de la clase 'is-open' es suficiente para saber que debemos cerrar.
            destroyStoriesPlayer();
        }
    });
});