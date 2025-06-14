/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN DE PRODUCCIÓN FINAL v11.0 (CON CACHÉ)
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const ShortsPlayerManager = {
        // --- Configuración ---
        YOUTUBE_API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw',
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',
        APP_ORIGIN: window.location.origin,
        CACHE_KEY: 'epistecnologia_shorts_cache',
        CACHE_DURATION_HOURS: 4, // Guardar resultados por 4 horas

        // --- Elementos del DOM y Estado ---
        sidePanelContent: document.getElementById('side-panel-content'),
        mainPlayer: null,
        swiper: null,
        isApiReady: false,

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
            window.onYouTubeIframeAPIReady = () => { this.isApiReady = true; };
        },

        async launch() {
            const sidePanel = document.getElementById('side-panel');
            if (sidePanel.classList.contains('is-open')) return;

            // Preparamos el panel
            this.sidePanelContent.innerHTML = `<div class="preloader-container"><img src="img/loading.svg" alt="Cargando..." /></div>`;
            this.sidePanelContent.classList.add('side-panel__content--video');
            sidePanel.classList.add('is-open');
            document.getElementById('overlay').classList.add('is-open');
            document.body.style.overflow = 'hidden';
            this.addCloseListeners();

            // --- LÓGICA DE CACHÉ ---
            const cachedData = this.getCache();
            if (cachedData) {
                console.log("Cargando videos desde la CACHÉ. Rápido y sin coste de API.");
                this.buildUI(cachedData);
            } else {
                console.log("Cargando videos desde la API de YouTube. (Coste: 100 unidades de cuota)");
                try {
                    const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
                    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=50&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) throw new Error(`Error de API: ${response.status}`);
                    const data = await response.json();
                    if (!data.items || data.items.length === 0) throw new Error('No se encontraron Shorts.');
                    
                    const videos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                    
                    this.setCache(videos); // Guardamos los resultados en la caché
                    this.buildUI(videos);
                } catch (error) {
                    this.sidePanelContent.innerHTML = `<p class="player-error-message">${error.message}</p>`;
                }
            }
        },

        buildUI(videos) {
            const uiHTML = `<div id="main-player-container"></div><div id="thumbnail-carousel-container"><div class="swiper"><div class="swiper-wrapper">${videos.map((video,index)=>`<div class="swiper-slide thumbnail-slide" data-video-id="${video.id}" data-index="${index}"><img src="${video.thumbUrl}" alt="miniatura"/></div>`).join('')}</div></div></div>`;
            this.sidePanelContent.innerHTML = uiHTML;

            // Esperamos a que la API esté lista para crear los reproductores
            const waitForApi = setInterval(() => {
                if (this.isApiReady) {
                    clearInterval(waitForApi);
                    this.initMainPlayer(videos[0].id);
                    this.initThumbnailSwiper(videos);
                }
            }, 100);
        },
        
        initMainPlayer(videoId) {
            if (!videoId) return;
            this.mainPlayer = new YT.Player('main-player-container', {
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 0, 'rel': 0, 'playsinline': 1, 'origin': this.APP_ORIGIN },
                events: { 'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) this.playNextVideo(); } }
            });
        },

        initThumbnailSwiper(videos) {
            this.swiper = new Swiper('#thumbnail-carousel-container .swiper', {
                slidesPerView: 3.5, spaceBetween: 10, centeredSlides: true, loop: false, slideToClickedSlide: true
            });
            this.swiper.on('click', (swiper) => {
                const slide = swiper.clickedSlide;
                if (slide) this.mainPlayer.loadVideoById(slide.dataset.videoId);
            });
            this.swiper.on('slideChange', (swiper) => this.updateActiveThumbnail(swiper.realIndex));
            this.updateActiveThumbnail(0); // Marcamos la primera como activa
        },
        
        playNextVideo() {
            const nextIndex = (this.swiper.realIndex + 1) % this.swiper.slides.length;
            this.swiper.slideTo(nextIndex);
            this.mainPlayer.loadVideoById(this.swiper.slides[nextIndex].dataset.videoId);
        },

        updateActiveThumbnail(activeIndex) {
            this.swiper.slides.forEach(slide => slide.classList.remove('thumbnail-active'));
            this.swiper.slides[activeIndex]?.classList.add('thumbnail-active');
        },

        // --- Funciones de Caché ---
        setCache(data) {
            const cache = {
                timestamp: new Date().getTime(),
                videos: data
            };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        },
        getCache() {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;
            const cache = JSON.parse(cached);
            const isExpired = (new Date().getTime() - cache.timestamp) > this.CACHE_DURATION_HOURS * 60 * 60 * 1000;
            return isExpired ? null : cache.videos;
        },

        destroy() {
            this.mainPlayer?.destroy();
            this.swiper?.destroy();
            this.sidePanelContent.innerHTML = '';
            this.sidePanelContent.classList.remove('side-panel__content--video');
            document.getElementById('side-panel').classList.remove('is-open');
            document.getElementById('overlay').classList.remove('is-open');
            document.body.style.overflow = '';
        },

        addCloseListeners() {
            document.getElementById('side-panel-close').addEventListener('click', () => this.destroy(), { once: true });
            document.getElementById('overlay').addEventListener('click', () => this.destroy(), { once: true });
        }
    };
    
    ShortsPlayerManager.init();
});