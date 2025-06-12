/**
 * =========================================================================
 * Lógica para el Reproductor de Historias Inmersivo con Swiper.js y YouTube API
 * VERSIÓN FINAL (Filtrando solo por #Shorts)
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
            // --- INICIO DE LA MODIFICACIÓN ---
            // Cambiamos a la API de 'search' para poder filtrar por el texto '#Short'.
            // q=%23Shorts busca el hashtag, y order=date nos da los más recientes primero.
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=15&q=%23Short&type=video&order=date&key=${YOUTUBE_API_KEY}`;
            // --- FIN DE LA MODIFICACIÓN ---

            const response = await fetch(apiUrl);
            if (!response.ok) {
                 const errorData = await response.json();
                 console.error('Error detallado de la API de YouTube:', errorData);
                 throw new Error(`Error de API de YouTube: ${response.status}`);
            }
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                 throw new Error('No se encontraron videos con la etiqueta #Shorts.');
            }
            
            // --- INICIO DE LA MODIFICACIÓN ---
            // La estructura de la respuesta de la API de 'search' es diferente. El ID está en 'item.id.videoId'.
            const videoIds = data.items.map(item => item.id.videoId);
            // --- FIN DE LA MODIFICACIÓN ---
            
            buildSwiper(videoIds);

        } catch (error) {
            console.error('Error al lanzar el reproductor de historias:', error);
            sidePanelContent.innerHTML = `<p style="color:white;text-align:center;padding:2rem;">No se pudieron cargar las historias.<br><small>${error.message}</small></p>`;
        }
    }

    function buildSwiper(videoIds) {
        const slidesHTML = videoIds.map(id => `
            <div class="swiper-slide">
                <div id="player-${id}" class="player-wrapper"></div>
            </div>
        `).join('');

        sidePanelContent.innerHTML = `
            <div class="swiper swiper-container-vertical">
                <div class="swiper-wrapper">${slidesHTML}</div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>
        `;

        swiperInstance = new Swiper('.swiper-container-vertical', {
            direction: 'vertical',
            loop: videoIds.length > 1, // El bucle solo tiene sentido si hay más de un video
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
                        'autoplay': 0, 
                        'controls': 0, 'mute': 1, 'rel': 0,
                        'iv_load_policy': 3, 'modestbranding': 1, 'playsinline': 1
                    },
                    events: {
                        'onReady': (event) => {
                             // Comprobamos el slide activo usando el índice REAL de Swiper.
                            if (index === currentSwiper.realIndex) {
                                event.target.playVideo();
                            }
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
         // Aseguramos que el primer video se reproduzca si la API tardó en cargar
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
    }

    document.addEventListener('launch-stories', launchStoriesPlayer);
    sidePanelCloseBtn.addEventListener('click', destroyStoriesPlayer);
    overlay.addEventListener('click', destroyStoriesPlayer);
    
    loadYouTubeAPI();
});