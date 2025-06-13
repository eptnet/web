/**
 * =========================================================================
 * ShortsPlayerManager - VERSIÓN DE PRODUCCIÓN v10.1 (COMPLETA Y PULIDA)
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const ShortsPlayerManager = {
        YOUTUBE_API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw',
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',
        APP_ORIGIN: window.location.origin,
        sidePanelContent: document.getElementById('side-panel-content'),
        mainPlayer: null,
        thumbnailSwiper: null,
        videos: [],
        isApiReady: false,
        nextPageToken: null,
        isLoadingMore: false,

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
                if (this.videos.length > 0) this.initMainPlayer();
            };
        },

        async launch() {
            const sidePanel = document.getElementById('side-panel');
            if (sidePanel.classList.contains('is-open')) return;
            document.querySelector('.side-panel__share').style.display = 'none';
            this.sidePanelContent.innerHTML = `<div class="preloader-container"><img src="img/loading.svg" alt="Cargando..." /></div>`;
            this.sidePanelContent.classList.add('side-panel__content--video');
            sidePanel.classList.add('is-open');
            document.getElementById('overlay').classList.add('is-open');
            document.body.style.overflow = 'hidden';

            try {
                const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
                const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=10&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}`;
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Error de API: ${response.status}`);
                const data = await response.json();
                if (!data.items || data.items.length === 0) throw new Error('No se encontraron Shorts.');
                this.nextPageToken = data.nextPageToken;
                this.videos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                this.buildUI();
            } catch (error) {
                this.sidePanelContent.innerHTML = `<p class="player-error-message">${error.message}</p>`;
            }
        },

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
            if (this.isApiReady) this.initMainPlayer();
            this.initThumbnailSwiper();
            this.setupCarouselToggle();
            this.setupMuteToggle();
            this.addCloseListeners();
        },
        
        initMainPlayer() {
            if (!this.videos.length > 0) return;
            this.mainPlayer = new YT.Player('main-player-container', {
                videoId: this.videos[0].id,
                playerVars: { 'autoplay': 1, 'controls': 0, 'mute': 0, 'rel': 0, 'playsinline': 1, 'origin': this.APP_ORIGIN },
                events: {
                    'onReady': () => {
                        this.updateActiveThumbnail(0);
                        this.setupMuteToggle(); // Sincroniza el icono de mute al estar listo
                    },
                    'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED) this.playNextVideo(); }
                }
            });
        },

        initThumbnailSwiper() {
            this.thumbnailSwiper = new Swiper('#thumbnail-carousel-container .swiper', {
                slidesPerView: 3.5,
                spaceBetween: 10,
                centeredSlides: true,
                loop: false,
                slideToClickedSlide: true,
            });
            this.thumbnailSwiper.on('click', (swiper) => {
                const clickedSlide = swiper.clickedSlide;
                if (clickedSlide) {
                    this.mainPlayer.loadVideoById(clickedSlide.dataset.videoId);
                    this.updateActiveThumbnail(parseInt(clickedSlide.dataset.index, 10));
                }
            });
            this.thumbnailSwiper.on('reachEnd', () => { this.loadMoreVideos(); });
        },

        async loadMoreVideos() {
            if (!this.nextPageToken || this.isLoadingMore) return;
            this.isLoadingMore = true;
            const searchQuery = encodeURIComponent('"#Shorts" | "#Short"');
            const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.CHANNEL_ID}&maxResults=10&q=${searchQuery}&type=video&order=date&videoDuration=short&key=${this.YOUTUBE_API_KEY}&pageToken=${this.nextPageToken}`;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error('No se pudieron cargar más videos.');
                const data = await response.json();
                this.nextPageToken = data.nextPageToken;
                const newVideos = data.items.map(item => ({ id: item.id.videoId, thumbUrl: item.snippet.thumbnails.high.url }));
                const newSlidesHTML = newVideos.map((video, index) => `<div class="swiper-slide thumbnail-slide" data-video-id="${video.id}" data-index="${this.videos.length + index}"><img src="${video.thumbUrl}" alt="miniatura de video"/></div>`).join('');
                this.thumbnailSwiper.appendSlide(newSlidesHTML);
                this.videos.push(...newVideos);
            } catch (error) {
                console.error(error);
            } finally {
                this.isLoadingMore = false;
            }
        },

        setupCarouselToggle() {
            const toggleBtn = document.getElementById('carousel-toggle-btn');
            const carouselContainer = document.getElementById('thumbnail-carousel-container');
            const icon = toggleBtn?.querySelector('i');
            if (toggleBtn && carouselContainer && icon) {
                toggleBtn.addEventListener('click', () => {
                    carouselContainer.classList.toggle('is-collapsed');
                    icon.className = carouselContainer.classList.contains('is-collapsed') ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
                });
            }
        },

        setupMuteToggle() {
            const muteBtn = document.getElementById('player-mute-btn');
            const icon = muteBtn?.querySelector('i');
            if (!muteBtn || !icon || !this.mainPlayer || typeof this.mainPlayer.isMuted !== 'function') return;

            const syncIcon = () => {
                icon.className = this.mainPlayer.isMuted() ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
            };
            syncIcon(); // Sincronizar al inicio
            muteBtn.addEventListener('click', () => {
                this.mainPlayer.isMuted() ? this.mainPlayer.unMute() : this.mainPlayer.mute();
                setTimeout(syncIcon, 100); // Pequeño delay para asegurar que el estado del player se actualice
            });
        },

        playNextVideo() {
            const currentIndex = this.videos.findIndex(v => v.id === this.mainPlayer.getVideoData().video_id);
            const nextIndex = (currentIndex + 1) % this.videos.length;
            const nextVideo = this.videos[nextIndex];
            this.mainPlayer.loadVideoById(nextVideo.id);
            this.updateActiveThumbnail(nextIndex);
            this.thumbnailSwiper.slideTo(nextIndex);
        },

        updateActiveThumbnail(activeIndex) {
            this.thumbnailSwiper.slides.forEach(slide => slide.classList.remove('thumbnail-active'));
            const activeSlide = this.thumbnailSwiper.slides[activeIndex];
            if (activeSlide) activeSlide.classList.add('thumbnail-active');
        },

        destroy() {
            document.getElementById('side-panel-close').removeEventListener('click', this.destroy.bind(this));
            document.getElementById('overlay').removeEventListener('click', this.destroy.bind(this));
            document.querySelector('.side-panel__share').style.display = 'flex';
            this.mainPlayer?.destroy();
            this.thumbnailSwiper?.destroy();
            this.mainPlayer = null;
            this.thumbnailSwiper = null;
            this.videos = [];
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