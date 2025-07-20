// /live/js/live.js - VERSIÓN FINAL Y ESTABLE CON NUEVO DISEÑO

const LiveApp = {
    supabase: null,
    swiper: null,
    ytPlayer: null,
    allSessionsMap: new Map(),

    init() {
        // Inicializa el cliente de Supabase
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.addEventListeners();
        this.run();
    },

    async run() {
        this.applyTheme();
        
        // Obtenemos todos los datos necesarios en paralelo para mayor velocidad
        const [sessionRes, videoRes] = await Promise.all([
            this.supabase.from('sessions').select(`*, organizer: profiles (*)`).eq('is_archived', false).order('scheduled_at', { ascending: true }),
            this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false })
        ]);

        if (sessionRes.error || videoRes.error) {
            console.error("Error al cargar datos:", sessionRes.error || videoRes.error);
            return;
        }
        
        const sessions = sessionRes.data || [];
        const videos = videoRes.data || [];

        // Guardamos las sesiones en un mapa para fácil acceso posterior
        sessions.forEach(s => this.allSessionsMap.set(s.id, s));
        
        // Iniciamos y poblamos todos los componentes de la página
        this.initPlayerCarousel(sessions, videos);
        this.renderSchedule(sessions);
        this.renderOnDemandList(videos);
    },

    addEventListeners() {
        document.getElementById('theme-toggle-btn')?.addEventListener('click', () => this.toggleTheme());
        
        // Usamos un único listener en el body para manejar todos los clics importantes
        document.body.addEventListener('click', (e) => {
            const slide = e.target.closest('.swiper-slide');
            const card = e.target.closest('.content-card');
            const tab = e.target.closest('.tab-link');

            // Si se hace clic en un slide o tarjeta de evento (sesión)
            if (slide?.dataset.sessionId || card?.dataset.sessionId) {
                const sessionId = slide?.dataset.sessionId || card?.dataset.sessionId;
                this.openEventModal(sessionId);
            }
            // Si se hace clic en un slide o tarjeta de video on-demand
            else if (slide?.dataset.videoId || card?.dataset.videoId) {
                const videoId = slide?.dataset.videoId || card?.dataset.videoId;
                this.playOnDemandInCarousel(videoId);
            }
            // Si se hace clic en una pestaña
            else if (tab?.dataset.tab) {
                this.handleTabClick(tab);
            }
        });
    },

    initPlayerCarousel(sessions, videos) {
        const liveSessions = sessions.filter(s => s.status === 'EN VIVO');
        
        // Prioridad: En Vivo > On-Demand
        const carouselItems = [...liveSessions, ...videos];
        const wrapper = document.getElementById('hero-swiper-wrapper');
        if (!wrapper) return;

        if (carouselItems.length === 0) {
            wrapper.innerHTML = '<div class="player-placeholder"><h3>No hay contenido destacado</h3></div>';
            return;
        }

        wrapper.innerHTML = carouselItems.map(item => {
            const isSession = !!item.session_title;
            const title = isSession ? item.session_title : item.title;
            const id = isSession ? item.id : item.youtube_video_id;
            const thumbnailUrl = isSession ? item.thumbnail_url : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
            const liveBadge = item.status === 'EN VIVO' ? '<span class="live-badge">EN VIVO</span>' : '';
            const dataType = isSession ? `data-session-id="${id}"` : `data-video-id="${id}"`;

            return `
                <div class="swiper-slide" ${dataType} style="background-image: url('${thumbnailUrl || ''}')">
                    <div class="slide-info">
                        ${liveBadge}
                        <h3>${title}</h3>
                    </div>
                </div>`;
        }).join('');

        // Inicializamos Swiper.js
        this.swiper = new Swiper('.swiper', {
            effect: 'coverflow', grabCursor: true, centeredSlides: true,
            slidesPerView: 'auto', loop: carouselItems.length > 2,
            coverflowEffect: { rotate: 30, stretch: 0, depth: 100, modifier: 1, slideShadows: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        });
    },

    renderSchedule(sessions) {
        const container = document.getElementById('schedule-list');
        if (!container) return;
        
        const upcomingEvents = sessions.filter(s => s.status === 'PROGRAMADO');
        if (upcomingEvents.length === 0) {
            container.innerHTML = '<p>No hay próximos eventos programados.</p>';
            return;
        }
        container.innerHTML = upcomingEvents.map(item => `
            <div class="content-card" data-session-id="${item.id}">
                <div class="card-thumbnail" style="background-image: url('${item.thumbnail_url || ''}')"></div>
                <div class="card-info">
                    <h5>${item.session_title}</h5>
                    <p>${item.organizer?.display_name || 'Epistecnología'}</p>
                </div>
            </div>`).join('');
    },

    renderOnDemandList(videos) {
        const container = document.getElementById('ondemand-list-container');
        if (!container) return;
        if (!videos || videos.length === 0) {
            container.innerHTML = '<p>No hay videos disponibles.</p>';
            return;
        }
        container.innerHTML = videos.map(video => `
            <div class="content-card" data-video-id="${video.youtube_video_id}">
                <div class="card-thumbnail" style="background-image: url('https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg')"></div>
                <div class="card-info">
                    <h5>${video.title}</h5>
                </div>
            </div>`).join('');
    },

    openEventModal(sessionId) {
        const session = this.allSessionsMap.get(sessionId);
        if (!session) return;
        
        const modalOverlay = document.getElementById('event-modal-overlay');
        const modal = modalOverlay.querySelector('.event-modal');
        if (!modalOverlay || !modal) return;
        
        let playerHTML = '';
        if (session.platform === 'twitch') playerHTML = `<div id="modal-twitch-player"></div>`;
        else if (session.platform === 'youtube' && session.platform_id) playerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1" allow="autoplay; fullscreen"></iframe>`;
        else if (session.viewer_url) playerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen"></iframe>`;
        
        let chatHTML = '';
        if (session.platform === 'twitch') chatHTML = `<iframe src="https://www.twitch.tv/embed/epistecnologia/chat?parent=${window.location.hostname}&darkpopout"></iframe>`;
        
        modal.innerHTML = `
            <button class="event-modal-close-btn" aria-label="Cerrar">×</button>
            <div class="modal-main-content">
                <div class="modal-player-wrapper">${playerHTML}</div>
                <div class="modal-info-box"><h3>${session.session_title}</h3></div>
            </div>
            <aside class="modal-sidebar">
                <div class="modal-organizer-info"><h4>Organizador</h4><div><img src="${session.organizer?.avatar_url}" alt=""><strong>${session.organizer?.display_name}</strong></div></div>
                <div class="modal-chat-container"><h4>Chat</h4>${chatHTML}</div>
            </aside>`;

        if (session.platform === 'twitch') {
            new Twitch.Player("modal-twitch-player", { width: "100%", height: "100%", channel: "epistecnologia", parent: ["epistecnologia.com", "www.epistecnologia.com", "localhost"] });
        }
        
        modal.querySelector('.event-modal-close-btn').addEventListener('click', () => this.closeEventModal());
        modalOverlay.classList.add('is-visible');
    },

    closeEventModal() {
        const modalOverlay = document.getElementById('event-modal-overlay');
        modalOverlay.classList.remove('is-visible');
        modalOverlay.querySelector('.event-modal').innerHTML = '';
    },

    playOnDemandInCarousel(videoId) {
        if (!this.swiper || this.swiper.destroyed) return;
        
        // Destruimos el player anterior si existe
        if (this.ytPlayer && typeof this.ytPlayer.destroy === 'function') this.ytPlayer.destroy();

        const playerSlideHTML = `
            <div class="swiper-slide" data-is-player="true">
                <div id="yt-player-carousel"></div>
            </div>`;
        
        this.swiper.prependSlide(playerSlideHTML);
        this.swiper.slideTo(0);

        this.ytPlayer = new YT.Player('yt-player-carousel', {
            height: '100%', width: '100%', videoId: videoId,
            playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
            events: {
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.ENDED) {
                        this.swiper.removeSlide(0);
                    }
                }
            }
        });
    },

    handleTabClick(tab) {
        document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === tabId));
    },

    toggleTheme() {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        this.applyTheme();
    },

    applyTheme() {
        const theme = localStorage.getItem('theme') || 'dark';
        document.body.classList.toggle('light-theme', theme === 'light');
        const themeIcon = document.querySelector('#theme-toggle-btn i');
        if(themeIcon) themeIcon.className = `fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // La API de YouTube es necesaria para el reproductor on-demand
    if (window.YT && window.YT.Player) {
        LiveApp.init();
    } else {
        window.onYouTubeIframeAPIReady = () => LiveApp.init();
    }
});