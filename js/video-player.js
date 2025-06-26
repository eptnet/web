/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN PARA MODAL
 * - Ya no controla la visibilidad del modal.
 * - Construye el HTML del reproductor y se lo envía a app.js.
 * - Limpia sus propios recursos cuando se lo ordenan.
 * =========================================================================
 */
document.addEventListener('mainReady', () => {

    console.log("video-player.js: Listo y esperando la señal de 'launch-stories'.");

    const ShortsPlayerManager = {
        YOUTUBE_API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw', // Reemplaza con tu clave de API
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',
        APP_ORIGIN: window.location.origin,
        CACHE_KEY: 'epistecnologia_shorts_cache',
        CACHE_DURATION_HOURS: 4,
        
        swiper: null,
        mainPlayer: null,
        videos: [],
        isApiReady: false,
        currentVideoIndex: 0,

        init() {
            this.loadYouTubeAPI();
            document.addEventListener('launch-stories', () => this.launch());
            document.addEventListener('close-shorts-player', () => this.destroy());
        },

        loadYouTubeAPI() {
            if (window.YT && window.YT.Player) { this.isApiReady = true; return; }
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = () => {
                this.isApiReady = true;
                if (document.getElementById('main-player-container')) {
                    this.initMainPlayer(this.videos[0]?.id);
                }
            };
        },

        async launch() {
            console.log("video-player.js: 'launch-stories' recibido. Preparando contenido.");
            const cachedData = this.getCache();
            if (cachedData.videos && cachedData.videos.length > 0) {
                this.videos = cachedData.videos;
                this.buildAndDispatchPlayer();
            } else {
                try {
                    const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
                    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=15&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) throw new Error(`Error de API de YouTube`);
                    const data = await response.json();
                    if (!data.items || data.items.length === 0) throw new Error('No se encontraron Shorts.');
                    
                    this.videos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                    this.setCache(this.videos, data.nextPageToken);
                    this.buildAndDispatchPlayer();
                } catch (error) {
                    alert(`Error al cargar las historias: ${error.message}`);
                }
            }
        },

        buildAndDispatchPlayer() {
            const playerHTML = `
                <div id="main-player-container"></div>
                <button id="player-mute-btn" title="Activar/desactivar sonido"><i class="fa-solid fa-volume-high"></i></button>
                <div id="thumbnail-carousel-container">
                    <button id="carousel-toggle-btn" title="Mostrar/ocultar miniaturas"><i class="fa-solid fa-chevron-down"></i></button>
                    <div class="swiper">
                        <div class="swiper-wrapper">
                            ${this.videos.map((video,index)=>`<div class="swiper-slide thumbnail-slide" data-video-id="${video.id}" data-index="${index}"><img src="${video.thumbUrl}" alt="miniatura"/></div>`).join('')}
                        </div>
                    </div>
                </div>`;

            document.dispatchEvent(new CustomEvent('stories-ready', {
                detail: { html: playerHTML }
            }));

            setTimeout(() => {
                if (this.isApiReady) {
                    this.initMainPlayer(this.videos[0].id);
                }
                this.initThumbnailSwiper();
                this.addEventListeners();
            }, 150);
        },
        
        initMainPlayer(videoId) {
            if (this.mainPlayer) { this.mainPlayer.destroy(); }
            if(!document.getElementById('main-player-container')) return;

            this.mainPlayer = new YT.Player('main-player-container', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 0, 'rel': 0, 'playsinline': 1, 'origin': this.APP_ORIGIN },
                events: {
                    'onReady': (e) => { this.updateActiveThumbnail(0); this.setupMuteToggle(); },
                    'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) this.playVideoByIndex(this.currentVideoIndex + 1); }
                }
            });
        },

        initThumbnailSwiper() {
            if(this.swiper) this.swiper.destroy(true, true);
            this.swiper = new Swiper('#thumbnail-carousel-container .swiper', {
                slidesPerView: 3.5, spaceBetween: 10, centeredSlides: true, loop: false,
            });
        },

        addEventListeners() {
            document.querySelector('#modal-container #carousel-toggle-btn')?.addEventListener('click', this.toggleCarousel.bind(this));
            document.querySelector('#modal-container #player-mute-btn')?.addEventListener('click', () => this.toggleMute());
            this.swiper?.on('click', (swiper) => { if (swiper.clickedSlide) this.playVideoByIndex(parseInt(swiper.clickedSlide.dataset.index, 10)); });
            this.swiper?.on('slideChange', (swiper) => { if (swiper.activeIndex >= this.videos.length - 3) this.loadMoreVideos(); });
        },

        playVideoByIndex(index) {
            const newIndex = index >= this.videos.length ? 0 : index;
            const video = this.videos[newIndex];
            if (!video || !this.mainPlayer) return;
            this.currentVideoIndex = newIndex;
            this.mainPlayer.loadVideoById(video.id);
            this.swiper.slideTo(newIndex);
            this.updateActiveThumbnail(newIndex);
        },

        updateActiveThumbnail(index) { 
            const slides = document.querySelectorAll('#thumbnail-carousel-container .swiper-slide');
            slides.forEach(slide => slide.classList.remove('thumbnail-active')); 
            slides[index]?.classList.add('thumbnail-active'); 
        },
        toggleCarousel(event) { const carouselContainer = document.getElementById('thumbnail-carousel-container'); const icon = event.currentTarget.querySelector('i'); carouselContainer.classList.toggle('is-collapsed'); icon.className = carouselContainer.classList.contains('is-collapsed') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'; },
        toggleMute() { if (!this.mainPlayer?.isMuted) return; const muteBtn = document.getElementById('player-mute-btn'); const icon = muteBtn?.querySelector('i'); if (this.mainPlayer.isMuted()) { this.mainPlayer.unMute(); if(icon) icon.className = 'fa-solid fa-volume-high'; } else { this.mainPlayer.mute(); if(icon) icon.className = 'fa-solid fa-volume-xmark'; } },
        
        async loadMoreVideos() { /* Tu lógica original sin cambios */ },
        setCache(videos, token) { const cache = { timestamp: new Date().getTime(), videos, nextPageToken: token }; localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache)); },
        getCache() { const cached = localStorage.getItem(this.CACHE_KEY); if (!cached) return { videos: null }; const cache = JSON.parse(cached); const isExpired = (new Date().getTime() - cache.timestamp) > this.CACHE_DURATION_HOURS * 60 * 60 * 1000; return isExpired ? { videos: null } : { videos: cache.videos, nextPageToken: cache.nextPageToken }; },

        destroy() {
            console.log("video-player.js: Destruyendo instancias.");
            if (this.mainPlayer && typeof this.mainPlayer.destroy === 'function') {
                this.mainPlayer.destroy();
                this.mainPlayer = null;
            }
            if (this.swiper) {
                this.swiper.destroy(true, true);
                this.swiper = null;
            }
            this.videos = [];
        },
    };
    
    ShortsPlayerManager.init();
});
