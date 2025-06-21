/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN FINAL ESTABLE
 * Lógica autocontenida para el reproductor de Shorts.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const ShortsPlayerManager = {
        // --- Configuración ---
        YOUTUBE_API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw',
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',
        APP_ORIGIN: window.location.origin,
        CACHE_KEY: 'epistecnologia_shorts_cache',
        CACHE_DURATION_HOURS: 4,

        // --- Elementos del DOM y Estado ---
        sidePanelContent: document.getElementById('side-panel-content'),
        mainPlayer: null,
        thumbnailSwiper: null,
        videos: [],
        isApiReady: false,
        nextPageToken: null,
        isLoadingMore: false,
        currentVideoIndex: 0,

        // 1. INICIALIZACIÓN: Escucha las órdenes de app.js
        init() {
            this.loadYouTubeAPI();
            document.addEventListener('launch-stories', () => this.launch());
            document.addEventListener('close-shorts-player', () => this.destroy());
        },

        // Carga la API de IFrame de YouTube
        loadYouTubeAPI() {
            if (window.YT) { this.isApiReady = true; return; }
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => {
                this.isApiReady = true;
                if (document.getElementById('main-player-container')) {
                    this.initMainPlayer();
                }
            };
        },

        // 2. LANZAMIENTO Y CARGA DE DATOS
        async launch() {
            const sidePanel = document.getElementById('side-panel');
            if (sidePanel.classList.contains('is-open')) return;
            
            document.querySelector('.side-panel__share').style.display = 'none';
            this.sidePanelContent.innerHTML = `<div class="preloader-container"><img src="/img/loading.svg" alt="Cargando..." /></div>`;
            this.sidePanelContent.classList.add('side-panel__content--video');

            // La apertura del panel ahora se gestiona en app.js para consistencia,
            // pero mantenemos el resto de la preparación aquí.
            
            const cachedData = this.getCache();
            if (cachedData.videos) {
                console.log("Cargando videos desde la CACHÉ.");
                this.videos = cachedData.videos;
                this.nextPageToken = cachedData.nextPageToken;
                this.buildUI();
            } else {
                console.log("Cargando videos desde la API de YouTube.");
                try {
                    const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
                    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=15&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) throw new Error(`Error de API: ${response.status}`);
                    const data = await response.json();
                    if (!data.items || data.items.length === 0) throw new Error('No se encontraron Shorts.');
                    
                    this.nextPageToken = data.nextPageToken;
                    this.videos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                    
                    this.setCache(this.videos, this.nextPageToken);
                    this.buildUI();
                } catch (error) {
                    this.sidePanelContent.innerHTML = `<p class="player-error-message">${error.message}</p>`;
                }
            }
        },
        
        // 3. CONSTRUCCIÓN DE LA INTERFAZ
        buildUI() {
            const uiHTML = `
                <div id="main-player-container"></div>
                <button id="player-mute-btn" title="Activar/desactivar sonido"><i class="fa-solid fa-volume-high"></i></button>
                <div id="thumbnail-carousel-container">
                    <button id="carousel-toggle-btn" title="Mostrar/ocultar miniaturas"><i class="fa-solid fa-chevron-down"></i></button>
                    <div class="swiper">
                        <div class="swiper-wrapper">
                            ${this.videos.map((video, index) => `
                                <div class="swiper-slide thumbnail-slide" data-video-id="${video.id}" data-index="${index}">
                                    <img src="${video.thumbUrl}" alt="miniatura de video"/>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>`;
            this.sidePanelContent.innerHTML = uiHTML;

            if (this.isApiReady) {
                this.initMainPlayer();
            }
            this.initThumbnailSwiper();
            this.setupCarouselToggle();
            this.setupMuteToggle();
        },
        
        initMainPlayer() {
            if (!this.videos.length > 0) return;
            this.mainPlayer = new YT.Player('main-player-container', {
                videoId: this.videos[0].id,
                playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 0, 'rel': 0, 'playsinline': 1, 'origin': this.APP_ORIGIN },
                events: {
                    'onReady': () => this.updateActiveThumbnail(0),
                    'onStateChange': (e) => {
                        if (e.data === YT.PlayerState.ENDED) this.playVideoByIndex(this.currentVideoIndex + 1);
                    }
                }
            });
        },

        initThumbnailSwiper() {
            this.swiper = new Swiper('#thumbnail-carousel-container .swiper', {
                slidesPerView: 3.5,
                spaceBetween: 10,
                centeredSlides: true,
                loop: false,
                slideToClickedSlide: true,
            });

            this.swiper.on('click', (swiper) => {
                const clickedSlide = swiper.clickedSlide;
                if (clickedSlide) {
                    this.playVideoByIndex(parseInt(clickedSlide.dataset.index, 10));
                }
            });

            this.swiper.on('slideChange', (swiper) => {
                this.updateActiveThumbnail(swiper.realIndex);
                if (swiper.activeIndex >= this.videos.length - 3) {
                    this.loadMoreVideos();
                }
            });
        },
        
        playVideoByIndex(index) {
            const newIndex = index >= this.videos.length ? 0 : index;
            const video = this.videos[newIndex];
            if (!video || !this.mainPlayer) return;
            this.currentVideoIndex = newIndex;
            this.mainPlayer.loadVideoById(video.id);
            this.swiper.slideTo(newIndex);
        },

        // --- El resto de las funciones auxiliares ---
        setupCarouselToggle() { /* ...código sin cambios... */ },
        setupMuteToggle() { /* ...código sin cambios... */ },
        updateActiveThumbnail(index) { this.swiper?.slides.forEach(slide => slide.classList.remove('thumbnail-active')); this.swiper?.slides[index]?.classList.add('thumbnail-active'); },
        async loadMoreVideos() { /* ...código sin cambios... */ },
        setCache(videos, token) { /* ...código sin cambios... */ },
        getCache() { /* ...código sin cambios... */ },

        // 4. DESTRUCCIÓN Y LIMPIEZA
        destroy() {
            console.log("Recibida orden de destruir el reproductor de Shorts.");
            document.querySelector('.side-panel__share').style.display = 'flex';
            this.mainPlayer?.destroy();
            this.swiper?.destroy();
            this.mainPlayer = null; this.swiper = null; this.videos = []; this.nextPageToken = null; this.isLoadingMore = false;
            this.sidePanelContent.innerHTML = '';
            this.sidePanelContent.classList.remove('side-panel__content--video');
        }
    };
    
    ShortsPlayerManager.init();
});