/**
 * =========================================================================
 * Lógica para el Reproductor de Historias Inmersivo con Swiper.js y YouTube API
 * VERSIÓN ESTABLE 4.0
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const YOUTUBE_API_KEY = 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw';
    const CHANNEL_ID = 'UCg3ms3gecQ-2cjMhJwaPAig';
    
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelCloseBtn = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

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
        if (swiperInstance) createYouTubePlayers(swiperInstance);
    };

    async function launchStoriesPlayer() {
        sidePanelContent.innerHTML = '<div id="shorts-preloader" style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;"><img src="https://i.imgur.com/dWSya2H.gif" alt="Cargando..." style="width: 50px;" /></div>';
        sidePanelContent.classList.add('side-panel__content--video');
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        try {
            const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=15&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error de API: ${response.status}`);
            const data = await response.json();
            if (!data.items || data.items.length === 0) throw new Error('No se encontraron Shorts.');
            const videoIds = data.items.map(item => item.id.videoId);
            buildSwiper(videoIds);
        } catch (error) {
            console.error('Error al lanzar el reproductor:', error);
            sidePanelContent.innerHTML = `<p style="color:white;padding:2rem;text-align:center;">${error.message}</p>`;
        }
    }

    function buildSwiper(videoIds) {
        const slidesHTML = videoIds.map(id => `<div class="swiper-slide"><div id="player-${id}" class="player-wrapper"></div></div>`).join('');
        sidePanelContent.innerHTML = `
            <div id="shorts-preloader" style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;"><img src="https://i.imgur.com/dWSya2H.gif" alt="Cargando..." style="width:50px;" /></div>
            <div class="swiper swiper-container-vertical" style="display:none;">
                <div class="swiper-wrapper">${slidesHTML}</div>
                <div class="swiper-button-next"></div>
                <div class="swiper-button-prev"></div>
            </div>`;

        swiperInstance = new Swiper('.swiper-container-vertical', {
            direction: 'vertical',
            loop: videoIds.length > 1,
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            mousewheel: { forceToAxis: true },
            on: {
                init: (swiper) => { if (isApiReady) createYouTubePlayers(swiper); },
                slideChangeTransitionEnd: (swiper) => {
                    const previousPlayer = players[swiper.previousRealIndex];
                    if (previousPlayer?.pauseVideo) previousPlayer.pauseVideo();
                    const currentPlayer = players[swiper.realIndex];
                    if (currentPlayer?.playVideo) currentPlayer.playVideo();
                },
            },
        });

        const swiperContainer = document.querySelector('.swiper-container-vertical');
        if (swiperContainer) {
            let controlsTimeout;
            const showControls = () => {
                swiperContainer.classList.add('show-controls');
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => { swiperContainer.classList.remove('show-controls'); }, 3000);
            };
            swiperContainer.addEventListener('mousemove', showControls);
            swiperContainer.addEventListener('touchstart', showControls, { passive: true });
            showControls();
        }
    }

    function createYouTubePlayers(swiper) {
        swiper.slides.forEach((slide, index) => {
            const playerElement = slide.querySelector('.player-wrapper');
            const videoId = playerElement.id.split('-')[1];
            if (playerElement && !players[index]) {
                players[index] = new YT.Player(playerElement.id, {
                    videoId: videoId,
                    playerVars: { 'autoplay': 0, 'controls': 0, 'mute': 0, 'rel': 0, 'iv_load_policy': 3, 'modestbranding': 1, 'playsinline': 1 },
                    events: {
                        'onReady': (e) => {
                            if (index === swiper.realIndex) {
                                document.getElementById('shorts-preloader').style.display = 'none';
                                document.querySelector('.swiper-container-vertical').style.display = 'block';
                                e.target.playVideo();
                            }
                        },
                        'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) swiper.slideNext(); }
                    }
                });
            }
        });
    }

    function destroyStoriesPlayer() {
        if (swiperInstance) {
            swiperInstance.destroy(true, true);
            swiperInstance = null;
        }
        Object.values(players).forEach(player => {
            if (player?.stopVideo) player.stopVideo();
            if (player?.destroy) player.destroy();
        });
        players = {};
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.remove('side-panel__content--video');
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    document.addEventListener('launch-stories', launchStoriesPlayer);
    sidePanelCloseBtn.addEventListener('click', destroyStoriesPlayer);
    overlay.addEventListener('click', destroyStoriesPlayer);
    
    loadYouTubeAPI();
});