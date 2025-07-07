const LiveApp = {
    supabase: null,
    elements: {},
    livePlayer: null,
    onDemandPlaylist: [],
    allEvents: [], // Única fuente de verdad para todos los eventos
    allSessionsMap: {},
    isApiReady: false,
    currentSessionId: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        this.addEventListeners();
        
        if (window.YT && typeof window.YT.Player === 'function') {
            this.isApiReady = true;
            this.run();
        } else {
            window.onYouTubeIframeAPIReady = () => {
                this.isApiReady = true;
                this.run();
            };
        }
        this.listenForChanges();

        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
        }
    },

    cacheDOMElements() {
        this.elements = {
            playerContainer: document.getElementById('player-container'),
            infoContainer: document.getElementById('info-container'),
            researcherInfoContainer: document.getElementById('researcher-info-container'),
            projectInfoContainer: document.getElementById('project-info-container'),
            liveTitle: document.getElementById('live-title'),
            liveProject: document.getElementById('live-project'),
            youtubeChatContainer: document.getElementById('chat-container'),
            ondemandListContainer: document.getElementById('ondemand-list-container'),
            scheduleList: document.getElementById('schedule-list'),
            tabs: document.querySelectorAll('.tab-link'),
            tabContents: document.querySelectorAll('.tab-content'),
            modalOverlay: document.getElementById('event-modal-overlay'),
            modalTitle: document.getElementById('event-modal-title'),
            modalThumbnail: document.getElementById('event-modal-thumbnail'),
            modalOrganizer: document.getElementById('event-modal-organizer'),
            modalSchedule: document.getElementById('event-modal-schedule'),
            modalDescription: document.getElementById('event-modal-description'),
            modalMoreInfo: document.getElementById('event-modal-more-info'),
            modalCloseBtn: document.getElementById('event-modal-close'),
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
        };
    },

    addEventListeners() {
        this.elements.tabs.forEach(button => {
            button.addEventListener('click', () => {
                this.elements.tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.dataset.tab;
                this.elements.tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            });
        });

        if (this.elements.modalOverlay) {
            this.elements.modalCloseBtn.addEventListener('click', () => this.closeEventModal());
            this.elements.modalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.modalOverlay) this.closeEventModal();
            });
        }
        if (this.elements.scheduleList) {
            this.elements.scheduleList.addEventListener('click', (e) => {
                const card = e.target.closest('.event-card[data-session-id]');
                if (card) this.openEventModal(card.dataset.sessionId);
            });
        }
        
        const filterContainer = document.querySelector('.agenda-filters');
        if (filterContainer) {
            filterContainer.addEventListener('click', (e) => {
                const filterButton = e.target.closest('.filter-btn');
                if (filterButton) {
                    filterContainer.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                    filterButton.classList.add('active');
                    this.renderFilteredSchedule(filterButton.dataset.filter);
                }
            });
        }

        this.elements.themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        });
    },

    async run() {
        console.log("Buscando estado actual con la consulta final...");

        // --- PASO 1: OBTENER TODAS LAS SESIONES RELEVANTES ---
        const { data: sessions, error: sessionsError } = await this.supabase
            .from('sessions')
            .select('*') // Primero solo las sesiones
            .in('status', ['PROGRAMADO', 'EN VIVO', 'FINALIZADO']) // Incluimos finalizados para el historial
            .eq('is_archived', false)
            .order('scheduled_at', { ascending: false });

        if (sessionsError) {
            console.error("Error al buscar sesiones:", sessionsError);
            this.renderSchedule([]); // Dibuja la agenda vacía si hay error
            return;
        }

        // Si no hay sesiones, vamos a On-Demand
        if (!sessions || sessions.length === 0) {
            this.handleOnDemandContent();
            this.renderSchedule([]);
            return;
        }
        
        // --- PASO 2: OBTENER LOS PERFILES PARA ESAS SESIONES ---
        const userIds = [...new Set(sessions.map(s => s.user_id).filter(id => id))];
        let profilesMap = new Map();
        if (userIds.length > 0) {
            const { data: profiles } = await this.supabase.from('profiles').select('*').in('id', userIds);
            if (profiles) {
                profiles.forEach(p => profilesMap.set(p.id, p));
            }
        }

        // --- PASO 3: UNIR LOS DATOS Y GUARDARLOS ---
        const fullSessionData = sessions.map(session => ({
            ...session,
            profiles: profilesMap.get(session.user_id)
        }));
        this.allEvents = fullSessionData;

        // --- PASO 4: DETERMINAR QUÉ MOSTRAR ---
        const liveSession = this.allEvents.find(s => s.status === 'EN VIVO');

        if (liveSession) {
            this.handleLiveSession(liveSession);
        } else {
            this.handleOnDemandContent();
        }
        
        // Mostramos la agenda con el filtro por defecto
        this.renderFilteredSchedule('all');
    },

    renderFilteredSchedule(filter) {
        let eventsToRender = [];
        const now = new Date();
        // Obtenemos el inicio del día para comparaciones precisas
        const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));

        if (filter === 'week') {
            const oneWeekFromNow = new Date(new Date().setDate(startOfDay.getDate() + 7));
            eventsToRender = this.allEvents
                .filter(event => {
                    const eventDate = new Date(event.scheduled_at);
                    // Muestra solo eventos futuros dentro de la próxima semana
                    return eventDate >= startOfDay && eventDate < oneWeekFromNow;
                })
                // Ordena los resultados de más próximo a más lejano
                .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        } else if (filter === 'month') {
            eventsToRender = this.allEvents
                .filter(event => {
                    const eventDate = new Date(event.scheduled_at);
                    // Muestra solo eventos futuros dentro del mes actual
                    return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear() && eventDate >= startOfDay;
                })
                // Ordena los resultados de más próximo a más lejano
                .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
        } else { // 'all'
            // Para "Todos", mostramos la lista completa tal como viene de la base de datos (pasados y futuros)
            eventsToRender = this.allEvents;
        }
        
        this.renderSchedule(eventsToRender);
    },

    handleLiveSession(session) {
        this.currentSessionId = session.id;
        this.destroyOnDemandPlayer();
        this.elements.infoContainer.style.display = 'flex';
        this.renderInfo(session);
        if (session.platform === 'youtube') {
            this.showYouTubePlayer(session);
            this.showYouTubeChat(session.platform_id);
        } else if (session.platform === 'vdo_ninja') {
            this.showVDONinjaPlayer(session);
            this.showYouTubeChat(null);
        }
    },

    async handleOnDemandContent() {
        this.currentSessionId = null;
        this.elements.infoContainer.style.display = 'none';
        const { data: videos } = await this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        if (videos && videos.length > 0) {
            this.onDemandPlaylist = videos;
            this.renderOnDemandList(videos);
            if(this.isApiReady && !this.livePlayer) this.initOnDemandPlayer();
        } else {
            this.elements.playerContainer.innerHTML = '<div class="player-placeholder"><h2>Contenido On-Demand</h2><p>Mientras no haya un evento en vivo, disfruta de nuestro archivo.</p></div>';
        }
    },

    renderInfo(session) {
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        this.elements.researcherInfoContainer.innerHTML = session.profiles ? `<img src="${session.profiles.avatar_url || ''}" alt=""><div><h4>${session.profiles.display_name || ''}</h4><p>ORCID: ${session.profiles.orcid || ''}</p></div>` : '';
        const project = session.profiles?.projects?.find(p => p.title === session.project_title);
        this.elements.projectInfoContainer.innerHTML = project ? `<h4>Sobre el Proyecto</h4><p>${project.authors.slice(0, 2).join(', ')}...</p><a href="https://doi.org/${project.doi}" target="_blank">Ver DOI</a>` : '';
    },

    renderSchedule(schedule) {
        const scheduleContainer = this.elements.scheduleList;
        if (!scheduleContainer) return;
        this.allSessionsMap = {};
        if(schedule) schedule.forEach(item => this.allSessionsMap[item.id] = item);
        if (!schedule || schedule.length === 0) {
            scheduleContainer.innerHTML = '<p class="placeholder-text">No hay eventos programados para esta vista.</p>';
            return;
        }
        scheduleContainer.innerHTML = schedule.map(item => {
            const thumbnailUrl = item.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
            const eventDate = new Date(item.scheduled_at);
            const day = eventDate.toLocaleDateString('es-ES', { day: '2-digit' });
            const month = eventDate.toLocaleDateString('es-ES', { month: 'short' });
            return `<div class="event-card" data-session-id="${item.id}"><div class="event-card-background" style="background-image: url('${thumbnailUrl}')"></div><div class="event-card-date">${day} ${month}</div><div class="card-info"><h5>${item.session_title}</h5><p>${item.profiles?.display_name || 'Epistecnología'}</p></div></div>`;
        }).join('');
    },

    renderOnDemandList(videos) {
        const ondemandContainer = this.elements.ondemandListContainer;
        if (!ondemandContainer) return;
        ondemandContainer.innerHTML = videos.map(video => `<div class="video-card" onclick="LiveApp.playOnDemandById('${video.youtube_video_id}')"><img src="https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="${video.title}"><p>${video.title}</p></div>`).join('');
    },

    openEventModal(sessionId) {
        const session = this.allSessionsMap[sessionId];
        if (!session) return;
        this.elements.modalTitle.textContent = session.session_title;
        this.elements.modalDescription.textContent = session.description || 'No hay descripción disponible.';
        this.elements.modalSchedule.innerHTML = `<i class="fas fa-clock"></i> ${new Date(session.scheduled_at).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}`;
        this.elements.modalThumbnail.style.backgroundImage = `url('${session.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}')`;
        if (session.profiles) this.elements.modalOrganizer.innerHTML = `<img src="${session.profiles.avatar_url || ''}" alt=""><div><strong>${session.profiles.display_name}</strong><p>${session.profiles.orcid}</p></div>`;
        this.elements.modalMoreInfo.style.display = session.more_info_url ? 'inline-block' : 'none';
        if(session.more_info_url) this.elements.modalMoreInfo.href = session.more_info_url;
        this.elements.modalOverlay.classList.add('is-visible');
    },

    closeEventModal() {
        this.elements.modalOverlay.classList.remove('is-visible');
    },
    
    showYouTubePlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1&enablejsapi=1&rel=0" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    },

    showVDONinjaPlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },

    showYouTubeChat(videoId) {
        this.elements.youtubeChatContainer.innerHTML = videoId ? `<iframe src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}" frameborder="0"></iframe>` : '<p class="placeholder-text">El chat se activa durante los directos.</p>';
    },

    initOnDemandPlayer() {
        if (this.livePlayer || this.onDemandPlaylist.length === 0 || !this.isApiReady) return;
        this.elements.playerContainer.innerHTML = '<div id="yt-player-on-demand"></div>';
        let currentIndex = 0;
        this.livePlayer = new YT.Player('yt-player-on-demand', {
            height: '100%', width: '100%',
            videoId: this.onDemandPlaylist[currentIndex].youtube_video_id,
            playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0, 'loop': 0 },
            events: {
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.ENDED) {
                        currentIndex = (currentIndex + 1) % this.onDemandPlaylist.length;
                        this.livePlayer.loadVideoById(this.onDemandPlaylist[currentIndex].youtube_video_id);
                    }
                }
            }
        });
    },
    
    destroyOnDemandPlayer() {
        if (this.livePlayer && typeof this.livePlayer.destroy === 'function') {
            this.livePlayer.destroy();
            this.livePlayer = null;
        }
    },

    playOnDemandById(videoId) {
        if (!this.livePlayer) this.initOnDemandPlayer();
        if (this.livePlayer) this.livePlayer.loadVideoById(videoId);
    },

    listenForChanges() {
        this.supabase.channel('sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
                this.run();
            })
            .subscribe();
    }
};

window.onYouTubeIframeAPIReady = () => {
    LiveApp.init();
};