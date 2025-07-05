const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    currentSessionId: null,
    allSessions: {},

    // --- AÑADE LAS NUEVAS PROPIEDADES AQUÍ ---
    onDemandPlaylist: [],
    livePagePlayer: null,
    // -----------------------------------------

    youtube: {
        API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw',
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',
        videos: [],
        isLoaded: false
    },

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        this.addEventListeners();
        
        // Ejecutamos la lógica una vez al cargar la página
        this.run();
        
        // Activamos la escucha en tiempo real, que se encargará de todas las actualizaciones futuras
        this.listenForRealtimeChanges();

        // Eliminamos el setInterval por completo
        if (this.timers.mainLoop) {
            clearInterval(this.timers.mainLoop);
            this.timers.mainLoop = null;
        }
    },

    cacheDOMElements() {
        this.elements = {
            playerContainer: document.getElementById('player-container'),
            player: document.getElementById('video-player'),
            overlay: document.getElementById('event-overlay'),
            countdownTimer: document.getElementById('countdown-timer'),
            countdownClock: document.getElementById('countdown-clock'),
            countdownTitle: document.getElementById('countdown-title'),
            endedMessage: document.getElementById('event-ended-message'),
            liveTitle: document.getElementById('live-title'),
            liveProject: document.getElementById('live-project'),
            researcherInfoContainer: document.getElementById('researcher-info-container'),
            researcherAvatar: document.getElementById('researcher-avatar'),
            researcherName: document.getElementById('researcher-name'),
            researcherOrcid: document.getElementById('researcher-orcid'),
            tabs: document.querySelectorAll('.tab-link'),
            tabContents: document.querySelectorAll('.tab-content'),
            scheduleList: document.getElementById('schedule-list'),
            youtubeList: document.getElementById('youtube-list'),
            chatContainer: document.getElementById('chat-container'),

            // --- SECCIÓN DEL MODAL (SINTAXIS CORREGIDA) ---
            modalOverlay: document.getElementById('event-modal-overlay'),
            modalTitle: document.getElementById('event-modal-title'),
            modalThumbnail: document.getElementById('event-modal-thumbnail'),
            modalOrganizer: document.getElementById('event-modal-organizer'),
            modalOrganizerAvatar: document.getElementById('event-modal-organizer-avatar'),
            modalOrganizerName: document.getElementById('event-modal-organizer-name'),
            modalOrganizerOrcid: document.getElementById('event-modal-organizer-orcid'),
            modalSchedule: document.getElementById('event-modal-schedule'),
            modalDescription: document.getElementById('event-modal-description'),
            modalMoreInfo: document.getElementById('event-modal-more-info'),
            modalCloseBtn: document.getElementById('event-modal-close')
        };
    },

    addEventListeners() {
        // Lógica para las pestañas de 'Videos' y 'Agenda'
        this.elements.tabs.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                this.elements.tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.elements.tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === tabId);
                });
            });
        });

        // Eventos para el modal de detalles del evento
        this.elements.modalCloseBtn.addEventListener('click', () => this.closeEventModal());
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.closeEventModal();
            }
        });

        // Delegación de eventos para las tarjetas de la agenda
        this.elements.scheduleList.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card[data-session-id]');
            if (card) {
                this.openEventModal(card.dataset.sessionId);
            }
        });
    },

    async run() {
        // DESACTIVAMOS la búsqueda automática de vivos en YouTube
        // const youtubeLiveVideo = await this.fetchYouTubeLive(); 
        
        const { dbLiveSession, dbUpcomingSessions } = await this.fetchScheduledSessions();
        this.renderSchedule(dbUpcomingSessions, dbLiveSession);

        // Simplificamos la lógica para que solo dependa de las sesiones de nuestra base de datos
        if (dbLiveSession) {
            this.handleScheduledSession(dbLiveSession);
        } else {
            this.handleOnDemandContent();
        }
    },

    async fetchYouTubeLive() {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.youtube.CHANNEL_ID}&eventType=live&type=video&key=${this.youtube.API_KEY}`);
            if (!response.ok) return null;
            const data = await response.json();
            return (data.items && data.items.length > 0) ? data.items[0] : null;
        } catch (error) { return null; }
    },

    // En /live/js/live.js, reemplaza esta función completa

    // En /live/js/live.js, reemplaza esta función completa. Esta es la versión final.

    async fetchScheduledSessions() {
        // --- PASO 1: OBTENER LAS SESIONES ---
        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

        const { data: sessions, error: sessionsError } = await this.supabase
            .from('sessions')
            .select('*') // Primero pedimos solo las sesiones
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            .gte('scheduled_at', fourHoursAgo)
            .order('scheduled_at', { ascending: true });

        if (sessionsError) {
            console.error("Error buscando sesiones:", sessionsError);
            return { dbLiveSession: null, dbUpcomingSessions: [] };
        }

        if (!sessions || sessions.length === 0) {
            return { dbLiveSession: null, dbUpcomingSessions: [] };
        }

        // --- PASO 2: OBTENER LOS PERFILES PARA ESAS SESIONES ---
        // Recolectamos los IDs de los usuarios de las sesiones encontradas
        const userIds = [...new Set(sessions.map(s => s.user_id).filter(id => id))];
        
        let profilesMap = new Map();
        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await this.supabase
                .from('profiles')
                .select('*')
                .in('id', userIds);

            if (profilesError) {
                console.error("Error buscando perfiles:", profilesError);
            } else {
                // Creamos un mapa para buscar perfiles fácilmente: ID -> Perfil completo
                profiles.forEach(p => profilesMap.set(p.id, p));
            }
        }

        // --- PASO 3: UNIR LOS DATOS MANUALMENTE ---
        const fullSessionData = sessions.map(session => ({
            ...session,
            profiles: profilesMap.get(session.user_id) // Adjuntamos el perfil a cada sesión
        }));

        // --- PASO 4: SEPARAR SESIÓN EN VIVO Y PRÓXIMAS (Lógica anterior) ---
        let liveSession = null;
        let upcoming = [];
        const now_time = now.getTime();
        
        liveSession = fullSessionData.find(s => s.status === 'EN VIVO');
        if (!liveSession) {
            liveSession = fullSessionData.find(s => 
                s.status === 'PROGRAMADO' && new Date(s.scheduled_at).getTime() <= now_time
            );
        }
        
        if (liveSession) {
            upcoming = fullSessionData.filter(s => s.id !== liveSession.id && new Date(s.scheduled_at).getTime() > now_time);
        } else {
            upcoming = fullSessionData.filter(s => new Date(s.scheduled_at).getTime() > now_time);
        }
        
        return { dbLiveSession: liveSession, dbUpcomingSessions: upcoming };
    },

    async handleScheduledSession(session) {
        // NUEVA LÓGICA DE MANEJO
        // Si la sesión está EN VIVO, la mostramos.
        if (session.status === 'EN VIVO') {
            if (session.platform === 'youtube') this.handleYouTubeSession(session);
            else if (session.platform === 'vdo_ninja') this.handleVDONinjaSession(session);
            else if (session.platform === 'substack') this.handleSubstackSession(session);
        } 
        // Si está PROGRAMADO y en horario, mostramos la sala de espera.
        else if (session.status === 'PROGRAMADO') {
            this.showWaitingForOrganizer(session);
        }
    },

    showWaitingForOrganizer(session) {
        if (this.currentSessionId === session.id && this.timers.countdown) return; // Ya hay un contador
        
        this.currentSessionId = session.id;
        this.elements.overlay.style.display = 'flex';
        this.elements.endedMessage.style.display = 'none';
        this.elements.countdownTimer.style.display = 'block';
        this.elements.player.innerHTML = '';
        
        this.elements.countdownTitle.innerHTML = `Iniciamos en breve.<br>Esperando al organizador...`;

        // Cuenta regresiva de 5 minutos
        let duration = 5 * 60; 
        if (this.timers.countdown) clearInterval(this.timers.countdown);

        this.timers.countdown = setInterval(() => {
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            this.elements.countdownClock.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            if (--duration < 0) {
                clearInterval(this.timers.countdown);
                this.handleOnDemandContent(); // Si se acaba el tiempo, muestra on-demand
            }
        }, 1000);
    },

    handleVDONinjaSession(session) {
        this.currentSessionId = session.id;
        this.renderResearcherInfo(session.profiles);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">Chat no disponible para EPT Live.</p>';
        
        const scheduledAt = new Date(session.scheduled_at);
        if (session.status === 'EN VIVO' || Date.now() >= scheduledAt) {
            this.showVDONinjaPlayer(session);
        } else {
            this.showCountdown(session);
        }
    },

    handleYouTubeSession(session) {
        this.currentSessionId = session.id;
        this.renderResearcherInfo(session.profiles);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        
        const scheduledAt = new Date(session.scheduled_at);
        if (Date.now() >= scheduledAt) {
            this.showYouTubePlayer({ id: { videoId: session.platform_id }, snippet: { title: session.session_title } });
            this.showYouTubeChat(session.platform_id);
        } else {
            this.showCountdown(session);
        }
    },

    handleSubstackSession(session) {
        this.currentSessionId = session.id;
        this.renderResearcherInfo(session.profiles);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;

        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';

        // --- LÓGICA PARA MOSTRAR EL BOTÓN DE SUBSTACK ---
        const substackUrl = `https://open.substack.com/live-stream/${session.platform_id}`;
        this.elements.player.innerHTML = `
            <div class="external-live-placeholder">
                <h3>Esta transmisión es en Substack</h3>
                <p>Para unirte a la conversación y ver el directo, haz clic en el botón.</p>
                <a href="${substackUrl}" class="btn-primary" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Ir a la Transmisión
                </a>
                <small>Recuerda suscribirte para poder ingresar.</small>
            </div>
        `;

        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">El chat está en la página de Substack.</p>';
    },

    // En /live/js/live.js
    showCountdown(session) {
        // --- LÍNEAS DE DEPURACIÓN ---
        console.log("ShowCountdown: Iniciando cuenta regresiva para la sesión:", session.session_title);
        console.log("ShowCountdown: Hora de inicio programada:", new Date(session.scheduled_at));
        // ---------------------------------

        this.elements.overlay.style.display = 'flex';
        // ... (resto de la función de countdown sin cambios) ...
    },

    handleYouTubeLive(video) {
        this.currentSessionId = video.id.videoId;
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "🔴 Transmitiendo en vivo desde YouTube";
        this.showYouTubePlayer(video);
        this.showYouTubeChat(video.id.videoId);
    },

    // En /live/js/live.js, reemplaza esta función
    async handleOnDemandContent() {
        if (this.youtube.isLoaded) return;
        this.youtube.isLoaded = true;
        
        // Ocultamos los elementos de un vivo
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.projectInfoContainer.style.display = 'none';
        this.elements.overlay.style.display = 'none';

        this.elements.liveTitle.textContent = "Canal Epistecnología";
        this.elements.liveProject.textContent = "Contenido On-Demand";
        
        const videos = await this.fetchOnDemandVideosFromSupabase();
        
        if (videos && videos.length > 0) {
            // En lugar de llamar a showYouTubePlayer, llamamos a nuestro nuevo inicializador
            this.initOnDemandPlayer(videos);
            // La lista de videos de la pestaña se sigue mostrando igual
            this.renderOnDemandList(videos);
        } else {
            this.showEndedMessage("No hay videos disponibles.");
        }
    },

    // En /live/js/live.js, dentro del objeto App
    initOnDemandPlayer(videos) {
        if (!videos || videos.length === 0) return;

        this.onDemandPlaylist = videos; // Guardamos la lista de videos
        let currentVideoIndex = 0;

        // Si ya existe un reproductor, lo destruimos para crear el nuevo
        if (this.livePagePlayer && typeof this.livePagePlayer.destroy === 'function') {
            this.livePagePlayer.destroy();
        }

        this.livePagePlayer = new YT.Player('video-player', { // Usamos el ID de tu div de reproductor
            height: '100%',
            width: '100%',
            videoId: this.onDemandPlaylist[currentVideoIndex].youtube_video_id,
            playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
            events: {
                'onStateChange': (event) => {
                    // Si el video actual termina (estado 0)
                    if (event.data === YT.PlayerState.ENDED) {
                        console.log("Video terminado, cargando el siguiente...");
                        // Calculamos el índice del siguiente video, volviendo al inicio si es el último
                        currentVideoIndex = (currentVideoIndex + 1) % this.onDemandPlaylist.length;
                        const nextVideoId = this.onDemandPlaylist[currentVideoIndex].youtube_video_id;
                        this.livePagePlayer.loadVideoById(nextVideoId);
                    }
                }
            }
        });
    },
    
    async fetchOnDemandVideosFromSupabase() {
        const { data, error } = await this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        if (error) console.error("Error en fetchOnDemandVideosFromSupabase:", error);
        return data;
    },

    async isYouTubeVideoLive(videoId) {
        if (!videoId) return false;
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${this.youtube.API_KEY}`);
        const data = await response.json();
        return data.items?.[0]?.snippet?.liveBroadcastContent === 'live';
    },

    async updateSessionStatus(sessionId, status) {
        await this.supabase.from('sessions').update({ status }).eq('id', sessionId);
    },

    listenForRealtimeChanges() {
        this.supabase.channel('sessions-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, payload => {
            
            // Si la sesión actual CAMBIA A 'EN VIVO' o a 'FINALIZADO', recargamos la página.
            if (payload.new.id === this.currentSessionId && 
            (payload.new.status === 'FINALIZADO' || payload.old.status === 'PROGRAMADO' && payload.new.status === 'EN VIVO')) 
            {
                window.location.reload();
            } else {
                // Para otros cambios menores, solo re-ejecutamos la lógica.
                this.run();
            }
        }).subscribe();
    },

    renderResearcherInfo(profile) {
        const container = this.elements.researcherInfoContainer;
        if (!profile) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'flex';
        this.elements.researcherAvatar.src = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        this.elements.researcherName.textContent = profile.display_name || 'Investigador';
        this.elements.researcherOrcid.textContent = profile.orcid ? `ORCID: ${profile.orcid}` : '';
    },
    
    renderSchedule(upcoming, current) {
        if (!this.elements.scheduleList) return;
        this.allSessions = {};
        const allEvents = (current ? [current] : []).concat(upcoming || []);

        if (allEvents.length === 0) {
            this.elements.scheduleList.innerHTML = '<p class="placeholder-text">No hay eventos programados.</p>';
        } else {
            this.elements.scheduleList.innerHTML = allEvents.map(session => {
                this.allSessions[session.id] = session;
                const isLiveNow = session.id === current?.id;
                const time = new Date(session.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const platformIcon = session.platform === 'youtube' ? 'fab fa-youtube' : 'fas fa-satellite-dish';
                const thumbnail = session.thumbnail_url ? `<img src="${session.thumbnail_url}" alt="${session.session_title}" class="event-card-thumbnail" loading="lazy">` : '<div class="event-card-thumbnail-placeholder"></div>';

                return `
                <div class="event-card ${isLiveNow ? 'is-live' : ''}" data-session-id="${session.id}">
                    ${thumbnail}
                    <div class="card-info">
                        <h5>${isLiveNow ? '<i class="fas fa-tower-broadcast"></i> AHORA: ' : ''}${session.session_title}</h5>
                        <p><i class="${platformIcon}"></i> ${session.platform === 'youtube' ? 'YouTube' : 'EPT Live'} a las ${time}</p>
                    </div>
                </div>`;
            }).join('');
        }
    },
    
    renderOnDemandList(videos) {
        this.elements.youtubeList.innerHTML = videos.map(video => {
            const videoData = encodeURIComponent(JSON.stringify({ id: { videoId: video.youtube_video_id }, snippet: { title: video.title } }));
            return `<div class="video-card" onclick="App.showYouTubePlayer(JSON.parse(decodeURIComponent('${videoData}')))">
                        <img src="${video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_video_id}/hqdefault.jpg`}" alt="${video.title}" loading="lazy">
                        <div class="card-info"><h5>${video.title}</h5></div>
                    </div>`;
        }).join('');
    },
    
    showVDONinjaPlayer(session) {
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.player.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },
    
    showYouTubePlayer(video) {
        const videoId = video.id?.videoId;
        if (!videoId) return;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        if (this.youtube.isLoaded) this.elements.liveProject.textContent = "Canal de YouTube";
        this.elements.player.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    },

    showYouTubeChat(videoId) {
        if (!videoId) {
            this.elements.chatContainer.innerHTML = '<p class="placeholder-text">Chat no disponible.</p>';
        } else {
            this.elements.chatContainer.innerHTML = `<iframe src="https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}" frameborder="0"></iframe>`;
        }
    },

    
    async setSessionLive(sessionId) {
        await this.supabase.from('sessions').update({ status: 'EN VIVO' }).eq('id', sessionId);
    },

    showEndedMessage(message = "No hay transmisiones en este momento.") {
        // ... (Tu función de showEndedMessage se mantiene igual)
    },

    openEventModal(sessionId) {
        const session = this.allSessions[sessionId];
        if (!session) return;
        this.elements.modalTitle.textContent = session.session_title;
        this.elements.modalDescription.textContent = session.description || 'No hay descripción disponible.';
        
        const startTime = new Date(session.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const endTime = session.end_at ? new Date(session.end_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
        this.elements.modalSchedule.textContent = `Horario: ${startTime} ${endTime ? '- ' + endTime : ''}`;
        
        this.elements.modalThumbnail.style.backgroundImage = session.thumbnail_url ? `url('${session.thumbnail_url}')` : '';
        this.elements.modalThumbnail.style.display = session.thumbnail_url ? 'block' : 'none';

        if (session.profiles) {
            this.elements.modalOrganizer.style.display = 'flex';
            this.elements.modalOrganizerAvatar.src = session.profiles.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            this.elements.modalOrganizerName.textContent = session.profiles.display_name || 'Anfitrión';
            this.elements.modalOrganizerOrcid.textContent = session.profiles.orcid ? `ORCID: ${session.profiles.orcid}` : '';
        } else {
            this.elements.modalOrganizer.style.display = 'none';
        }

        this.elements.modalMoreInfo.style.display = session.more_info_url ? 'inline-block' : 'none';
        if (session.more_info_url) this.elements.modalMoreInfo.href = session.more_info_url;

        this.elements.modalOverlay.classList.add('is-visible');
    },

    closeEventModal() {
        this.elements.modalOverlay.classList.remove('is-visible');
    }
    
};

document.addEventListener('DOMContentLoaded', () => App.init());