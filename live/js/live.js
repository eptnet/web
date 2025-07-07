const LiveApp = {
    supabase: null,
    elements: {},
    onDemandPlaylist: [],
    livePlayer: null,
    isApiReady: false,

    init() {
        // Inicialización de Supabase
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        
        // La API de YouTube se carga de forma asíncrona. Esperamos a que esté lista.
        if (window.YT && window.YT.Player) {
            this.isApiReady = true;
            this.run();
        } else {
            window.onYouTubeIframeAPIReady = () => {
                console.log("YouTube IFrame API está lista.");
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
            youtubeChatContainer: document.getElementById('youtube-chat-container'),
            ondemandListContainer: document.getElementById('ondemand-list-container')
        };
    },

    async run() {
        console.log("Buscando estado actual...");
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*, profiles(*)')
            .eq('status', 'EN VIVO')
            .eq('is_archived', false)
            .limit(1)
            .single();

        if (error || !data) {
            this.handleOnDemandContent();
        } else {
            this.handleLiveSession(data);
        }
    },

    handleLiveSession(session) {
        this.destroyOnDemandPlayer(); // Destruye el reproductor de loop si existe
        this.elements.infoContainer.style.display = 'block';
        this.renderInfo(session);
        
        if (session.platform === 'youtube') {
            this.showYouTubePlayer(session);
            this.showYouTubeChat(session.platform_id);
        } else if (session.platform === 'vdo_ninja') {
            this.showVDONinjaPlayer(session);
            this.elements.youtubeChatContainer.innerHTML = '';
        }
    },

    async handleOnDemandContent() {
        this.elements.infoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = "Contenido On-Demand";
        this.elements.liveProject.textContent = "Nuestro archivo de divulgación.";
        this.elements.youtubeChatContainer.innerHTML = '';
        
        const { data: videos } = await this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        if (videos && videos.length > 0) {
            this.onDemandPlaylist = videos;
            this.renderOnDemandList(videos);
            if(this.isApiReady) this.initOnDemandPlayer();
        }
    },
    
    // ... (El resto de tus funciones como renderInfo, renderOnDemandList, etc., se mantienen igual)
    // He incluido aquí las versiones completas para evitar confusiones.

    renderInfo(session) {
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        if (session.profiles) {
            this.elements.researcherInfoContainer.innerHTML = `<img src="${session.profiles.avatar_url || ''}" alt="${session.profiles.display_name || ''}"><div><h4>${session.profiles.display_name || ''}</h4><p>ORCID: ${session.profiles.orcid || ''}</p></div>`;
        }
        const project = session.profiles?.projects?.find(p => p.title === session.project_title);
        if (project) {
            this.elements.projectInfoContainer.innerHTML = `<h4>Sobre el Proyecto</h4><p><strong>Autores:</strong> ${project.authors.slice(0, 2).join(', ')}...</p><a href="https://doi.org/${project.doi}" target="_blank">Ver en DOI</a>`;
        }
    },

    renderOnDemandList(videos) {
        this.elements.ondemandListContainer.innerHTML = videos.map(video => `<div class="video-card" onclick="LiveApp.playOnDemandById('${video.youtube_video_id}')"><img src="https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="${video.title}"><p>${video.title}</p></div>`).join('');
    },
    
    showYouTubePlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1&rel=0&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    },

    showVDONinjaPlayer(session) {
        this.elements.playerContainer.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },

    showYouTubeChat(videoId) {
        this.elements.youtubeChatContainer.innerHTML = `<iframe src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}" frameborder="0"></iframe>`;
    },

    initOnDemandPlayer() {
        if (this.livePlayer || this.onDemandPlaylist.length === 0) return;
        let currentIndex = 0;
        this.elements.playerContainer.innerHTML = '<div id="yt-player-on-demand"></div>'; // Contenedor para el reproductor de la API
        this.livePlayer = new YT.Player('yt-player-on-demand', {
            height: '100%', width: '100%',
            videoId: this.onDemandPlaylist[currentIndex].youtube_video_id,
            playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0, 'loop': 0 },
            events: {
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
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
        if (this.livePlayer && typeof this.livePlayer.loadVideoById === 'function') {
            this.livePlayer.loadVideoById(videoId);
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

// Se llama a init() a través de la API de YouTube para asegurar que esté lista.
// Si la API de YouTube no se carga, la aplicación no se iniciará.
// Esto es un punto a considerar si la API de Google falla.
document.addEventListener('DOMContentLoaded', () => {
    // Si la API de YT ya está lista por casualidad, iniciamos.
    if (window.YT && window.YT.Player) {
        LiveApp.init();
    } 
    // Si no, onYouTubeIframeAPIReady (que es una función global de la API) llamará a LiveApp.init()
});