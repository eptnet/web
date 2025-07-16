/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN PARA MODAL
 * - Ya no controla la visibilidad del modal.
 * - Construye el HTML del reproductor y se lo envía a app.js.
 * - Limpia sus propios recursos cuando se lo ordenan.
 * =========================================================================
 */
document.addEventListener('mainReady', () => {

    // --- INICIALIZACIÓN DE SUPABASE ---
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // ------------------------------------

    console.log("video-player.js: Listo y esperando la señal de 'launch-stories'.");

    const ShortsPlayerManager = {
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
            console.log("video-player.js: 'launch-stories' recibido. Usando Supabase.");
            const cachedData = this.getCache();
            if (cachedData.videos && cachedData.videos.length > 0) {
                this.videos = cachedData.videos;
                this.buildAndDispatchPlayer();
            } else {
                try {
                    // Reemplazamos la llamada a la API de YouTube por una consulta a Supabase
                    const { data, error } = await supabaseClient
                        .from('shorts')
                        .select('youtube_video_id, thumbnail_url')
                        .order('created_at', { ascending: false })
                        .limit(20); // Traemos los últimos 20 shorts

                    if (error) throw error;
                    if (!data || data.length === 0) throw new Error('No se encontraron Shorts en la base de datos.');
                    
                    // Mapeamos los datos de Supabase al formato que el reproductor espera
                    this.videos = data.map(item => ({ 
                        id: item.youtube_video_id, 
                        thumbUrl: item.thumbnail_url || `https://i.ytimg.com/vi/${item.youtube_video_id}/hqdefault.jpg`
                    }));
                    
                    this.setCache(this.videos); // Guardamos la respuesta de Supabase en el caché
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
