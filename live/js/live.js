const LiveApp = {
    supabase: null,
    elements: {},
    livePlayer: null,
    onDemandPlaylist: [],
    isApiReady: false,
    currentSessionId: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        this.addEventListeners();
        
        // La API de YT se carga de forma asíncrona. Esperamos a que esté lista.
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
            tabs: document.querySelectorAll('.tab-link'),
            tabContents: document.querySelectorAll('.tab-content'),
        };
    },

    addEventListeners() {
        this.elements.tabs.forEach(button => {
            button.addEventListener('click', () => {
                this.elements.tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.dataset.tab;
                this.elements.tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === tabId);
                });
            });
        });
    },

    async run() {
        console.log("Buscando estado actual...");

        // --- LÓGICA DE CARGA A PRUEBA DE ERRORES ---

        // 1. Buscamos todas las sesiones relevantes (EN VIVO y PROGRAMADO)
        const { data: sessions, error: sessionsError } = await this.supabase
            .from('sessions')
            .select('*')
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            .eq('is_archived', false)
            .order('scheduled_at', { asc: true });

        if (sessionsError || !sessions || sessions.length === 0) {
            // Si no hay sesiones o hay un error, vamos directo a On-Demand
            this.handleOnDemandContent();
            this.renderSchedule([]); // Dibuja la agenda vacía
            return;
        }

        // 2. Buscamos los perfiles de los organizadores
        const userIds = [...new Set(sessions.map(s => s.user_id).filter(id => id))];
        let profilesMap = new Map();
        if (userIds.length > 0) {
            const { data: profiles } = await this.supabase.from('profiles').select('*').in('id', userIds);
            if (profiles) {
                profiles.forEach(p => profilesMap.set(p.id, p));
            }
        }

        // 3. Unimos los datos
        const fullSessionData = sessions.map(session => ({
            ...session,
            profiles: profilesMap.get(session.user_id)
        }));

        // 4. Determinamos el estado y renderizamos
        const liveSession = fullSessionData.find(s => s.status === 'EN VIVO');

        if (liveSession) {
            this.handleLiveSession(liveSession);
        } else {
            this.handleOnDemandContent();
        }
        
        // Renderizamos la agenda con los datos completos
        this.renderSchedule(fullSessionData);
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
        this.elements.liveTitle.textContent = "Contenido On-Demand";
        this.elements.liveProject.textContent = "Nuestro archivo de divulgación.";
        this.showYouTubeChat(null);
        
        const { data: videos } = await this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        if (videos && videos.length > 0) {
            this.onDemandPlaylist = videos;
            this.renderOnDemandList(videos);
            if(this.isApiReady && !this.livePlayer) this.initOnDemandPlayer();
        }
    },

    renderInfo(session) {
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        if (session.profiles) {
            this.elements.researcherInfoContainer.innerHTML = `<img src="${session.profiles.avatar_url || ''}" alt=""><div><h4>${session.profiles.display_name || ''}</h4><p>ORCID: ${session.profiles.orcid || ''}</p></div>`;
        }
        const project = session.profiles?.projects?.find(p => p.title === session.project_title);
        this.elements.projectInfoContainer.innerHTML = project ? `<h4>Sobre el Proyecto</h4><p>${project.authors.slice(0, 2).join(', ')}</p><a href="https://doi.org/${project.doi}" target="_blank">Ver DOI</a>` : '';
    },

    renderSchedule(schedule) {
        if (!this.elements.scheduleList || !schedule) return;
        this.elements.scheduleList.innerHTML = schedule.map(item => `
            <div class="event-card">
                <div class="card-info">
                    <h5>${item.session_title}</h5>
                    <p>${new Date(item.scheduled_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
            </div>`).join('');
    },

    renderOnDemandList(videos) {
        this.elements.ondemandListContainer.innerHTML = videos.map(video => `<div class="video-card" onclick="LiveApp.playOnDemandById('${video.youtube_video_id}')"><img src="https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="${video.title}"><p>${video.title}</p></div>`).join('');
    },
    
    showYouTubePlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1&enablejsapi=1&rel=0" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    },

    showVDONinjaPlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },

    showYouTubeChat(videoId) {
        if(videoId) {
            this.elements.youtubeChatContainer.innerHTML = `<iframe src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}" frameborder="0"></iframe>`;
        } else {
            this.elements.youtubeChatContainer.innerHTML = '<p class="placeholder-text">El chat se activa durante los directos.</p>';
        }
    },

    initOnDemandPlayer() {
        if (this.livePlayer || this.onDemandPlaylist.length === 0 || !this.isApiReady) return;
        this.elements.playerContainer.innerHTML = '<div id="yt-player-on-demand"></div>';
        let currentIndex = 0;
        this.livePlayer = new YT.Player('yt-player-on-demand', {
            height: '100%', width: '100%',
            videoId: this.onDemandPlaylist[currentIndex].youtube_video_id,
            playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
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
        if (this.livePlayer && typeof this.livePlayer.loadVideoById === 'function') {
            const index = this.onDemandPlaylist.findIndex(v => v.youtube_video_id === videoId);
            if (index !== -1) {
                this.livePlayer.loadVideoById(videoId);
            }
        }
    },

    listenForChanges() {
        this.supabase.channel('sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
                console.log('Cambio detectado en las sesiones, re-evaluando estado...');
                this.run();
            })
            .subscribe();
    }
};

// Se asegura de que la API de YouTube esté lista antes de inicializar la aplicación
// para que el reproductor en loop funcione correctamente.
window.onYouTubeIframeAPIReady = () => {
    LiveApp.init();
};