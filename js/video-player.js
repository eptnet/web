/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN FINAL REESCRITA Y ROBUSTA v13.0
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

        // 1. INICIALIZACIÓN
        init() {
            this.loadYouTubeAPI();
            document.addEventListener('launch-stories', () => this.launch());
        },

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

            this.setupPanel();
            
            const cachedData = this.getCache();
            if (cachedData.videos) {
                this.videos = cachedData.videos;
                this.nextPageToken = cachedData.nextPageToken;
                this.buildUI();
            } else {
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

        setupPanel() {
            const sidePanel = document.getElementById('side-panel');
            document.querySelector('.side-panel__share').style.display = 'none';
            this.sidePanelContent.innerHTML = `<div class="preloader-container"><img src="img/loading.svg" alt="Cargando..." /></div>`;
            this.sidePanelContent.classList.add('side-panel__content--video');
            sidePanel.classList.add('is-open');
            document.getElementById('overlay').classList.add('is-open');
            document.body.style.overflow = 'hidden';

            // --- NUEVO: Añadimos una entrada al historial ---
            history.pushState({ panelOpen: 'shorts' }, '');
            
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
            this.addEventListeners();
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
                slideToClickedSlide: false, // El clic lo manejamos nosotros
            });
        },

        // 4. LÓGICA DE REPRODUCCIÓN Y EVENTOS
        addEventListeners() {
            document.getElementById('carousel-toggle-btn')?.addEventListener('click', this.toggleCarousel);
            document.getElementById('player-mute-btn')?.addEventListener('click', () => this.toggleMute());
            this.swiper?.on('click', (swiper) => {
                if (swiper.clickedSlide) {
                    this.playVideoByIndex(parseInt(swiper.clickedSlide.dataset.index, 10));
                }
            });
            this.swiper?.on('slideChange', (swiper) => {
                if (swiper.activeIndex >= this.videos.length - 3) this.loadMoreVideos();
            });
            document.getElementById('side-panel-close').addEventListener('click', () => this.destroy(), { once: true });
            document.getElementById('overlay').addEventListener('click', () => this.destroy(), { once: true });
        },

        playVideoByIndex(index) {
            // Normalizamos el índice para el bucle
            const newIndex = index >= this.videos.length ? 0 : index;
            const video = this.videos[newIndex];
            
            if (!video || !this.mainPlayer) return;

            this.currentVideoIndex = newIndex;
            this.mainPlayer.loadVideoById(video.id);
            this.updateActiveThumbnail(newIndex);
            this.swiper.slideTo(newIndex);
        },

        updateActiveThumbnail(index) {
            this.swiper?.slides.forEach(slide => slide.classList.remove('thumbnail-active'));
            this.swiper?.slides[index]?.classList.add('thumbnail-active');
        },

        toggleCarousel() {
            const container = document.getElementById('thumbnail-carousel-container');
            const icon = this.querySelector('i');
            container.classList.toggle('is-collapsed');
            icon.className = container.classList.contains('is-collapsed') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
        },

        toggleMute() {
            if (!this.mainPlayer?.isMuted) return;
            const muteBtn = document.getElementById('player-mute-btn');
            const icon = muteBtn?.querySelector('i');
            if (this.mainPlayer.isMuted()) {
                this.mainPlayer.unMute();
                if(icon) icon.className = 'fa-solid fa-volume-high';
            } else {
                this.mainPlayer.mute();
                if(icon) icon.className = 'fa-solid fa-volume-xmark';
            }
        },

        async loadMoreVideos() {
            if (!this.nextPageToken || this.isLoadingMore) return;
            this.isLoadingMore = true;
            try {
                const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
                const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=15&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}&pageToken=${this.nextPageToken}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error('No se pudo cargar más.');
                const data = await response.json();
                
                this.nextPageToken = data.nextPageToken;
                const newVideos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                const newSlidesHTML = newVideos.map((video, index) => `<div class="swiper-slide thumbnail-slide" data-video-id="${video.id}" data-index="${this.videos.length + index}"><img src="${video.thumbUrl}" alt="miniatura"/></div>`).join('');
                
                this.swiper.appendSlide(newSlidesHTML);
                this.videos.push(...newVideos);
                this.setCache(this.videos, this.nextPageToken);
            } catch (error) {
                console.error("Error cargando más videos:", error);
            } finally {
                this.isLoadingMore = false;
            }
        },

        // 5. LÓGICA DE CACHÉ Y DESTRUCCIÓN
        setCache(videos, token) {
            const cache = { timestamp: new Date().getTime(), videos, nextPageToken: token };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        },
        getCache() {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return { videos: null, nextPageToken: null };
            const cache = JSON.parse(cached);
            const isExpired = (new Date().getTime() - cache.timestamp) > this.CACHE_DURATION_HOURS * 60 * 60 * 1000;
            return isExpired ? { videos: null, nextPageToken: null } : { videos: cache.videos, nextPageToken: cache.nextPageToken };
        },
        destroy() {
            document.querySelector('.side-panel__share').style.display = 'flex';
            this.mainPlayer?.destroy();
            this.swiper?.destroy();
            this.mainPlayer = null; this.swiper = null; this.videos = []; this.nextPageToken = null;
            this.sidePanelContent.innerHTML = '';
            this.sidePanelContent.classList.remove('side-panel__content--video');
            document.getElementById('side-panel').classList.remove('is-open');
            document.getElementById('overlay').classList.remove('is-open');
            document.body.style.overflow = '';
        }
    };
    
    ShortsPlayerManager.init();
});