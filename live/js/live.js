const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    currentSessionId: null,
    allSessions: {}, // Propiedad añadida para guardar datos de la agenda

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
        this.run();
        this.listenForRealtimeChanges();

        if (this.timers.mainLoop) clearInterval(this.timers.mainLoop);
        this.timers.mainLoop = setInterval(() => this.run(), 120000);
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

            // --- SECCIÓN DEL MODAL CORREGIDA ---
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
        this.elements.tabs.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                this.elements.tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.elements.tabContents.forEach(content => {
                    content.id === tabId ? content.classList.add('active') : content.classList.remove('active');
                });
            });
        });

        this.elements.modalCloseBtn.addEventListener('click', () => this.closeEventModal());
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) this.closeEventModal();
        });

        this.elements.scheduleList.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card[data-session-id]');
            if (card) this.openEventModal(card.dataset.sessionId);
        });
    },

    async run() {
        const youtubeLiveVideo = await this.fetchYouTubeLive();
        const { dbLiveSession, dbUpcomingSessions } = await this.fetchScheduledSessions();

        this.renderSchedule(dbUpcomingSessions, dbLiveSession);

        if (youtubeLiveVideo) {
            this.handleYouTubeLive(youtubeLiveVideo);
        } else if (dbLiveSession) {
            if (dbLiveSession.platform === 'youtube') {
                const isStillLive = await this.isYouTubeVideoLive(dbLiveSession.platform_id);
                if (isStillLive) {
                    this.handleYouTubeSession(dbLiveSession);
                } else {
                    this.updateSessionStatus(dbLiveSession.id, 'FINALIZADO');
                    this.handleOnDemandContent();
                }
            } else if (dbLiveSession.platform === 'vdo_ninja') {
                const now = new Date();
                if (dbLiveSession.end_at && now > new Date(dbLiveSession.end_at)) {
                    this.handleOnDemandContent();
                } else {
                    this.handleVDONinjaSession(dbLiveSession);
                }
            }
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
        } catch (error) { console.error("Error al buscar directos de YouTube:", error); return null; }
    },

    async fetchScheduledSessions() {
        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*, profiles(*)')
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            .gte('scheduled_at', fourHoursAgo)
            .order('scheduled_at', { ascending: true });

        if (error) {
            console.error("Error buscando sesiones y perfiles:", error);
            return { dbLiveSession: null, dbUpcomingSessions: [] };
        }

        let liveSession = data.find(s => s.status === 'EN VIVO') || data.find(s => s.status === 'PROGRAMADO' && new Date(s.scheduled_at).getTime() <= now.getTime());
        let upcoming = data.filter(s => new Date(s.scheduled_at).getTime() > now.getTime());

        if (liveSession) {
            upcoming = upcoming.filter(s => s.id !== liveSession.id);
        }

        return { dbLiveSession: liveSession, dbUpcomingSessions: upcoming };
    },

    handleVDONinjaSession(session) {
        this.currentSessionId = session.id;
        this.renderResearcherInfo(session.profiles);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">El chat solo está disponible en transmisiones de YouTube.</p>';
        
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);
        if (session.status === 'EN VIVO' || now >= scheduledAt) {
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
        
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);
        if (now >= scheduledAt) {
            this.showYouTubePlayer({ id: { videoId: session.platform_id }, snippet: { title: session.session_title } });
            this.showYouTubeChat(session.platform_id);
        } else {
            this.showCountdown(session);
        }
    },

    handleYouTubeLive(video) {
        this.currentSessionId = video.id.videoId; // Usamos el ID del video como identificador
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "🔴 Transmitiendo en vivo desde YouTube";
        this.showYouTubePlayer(video);
        this.showYouTubeChat(video.id.videoId);
    },

    async handleOnDemandContent() {
        if (this.youtube.isLoaded) return;
        this.youtube.isLoaded = true;
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.youtubeList.innerHTML = '<p class="placeholder-text">Cargando videos...</p>';
        this.elements.liveTitle.textContent = "Canal Epistecnología";
        this.elements.liveProject.textContent = "Contenido On-Demand";
        
        const videos = await this.fetchOnDemandVideosFromSupabase();
        if (videos && videos.length > 0) {
            this.renderOnDemandList(videos);
            this.showYouTubePlayer({ id: { videoId: videos[0].youtube_video_id }, snippet: { title: videos[0].title } });
        } else {
            this.showEndedMessage("No hay videos disponibles en este momento.");
        }
    },
    
    async fetchOnDemandVideosFromSupabase() {
        try {
            const { data, error } = await this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error("Error al obtener videos desde Supabase:", error);
            return null;
        }
    },

    async isYouTubeVideoLive(videoId) {
        if (!videoId) return false;
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${this.youtube.API_KEY}`);
            const data = await response.json();
            return data.items?.[0]?.snippet?.liveBroadcastContent === 'live';
        } catch (error) {
            console.error("Error al verificar el estado del video de YouTube:", error);
            return false;
        }
    },

    async updateSessionStatus(sessionId, status) {
        await this.supabase.from('sessions').update({ status }).eq('id', sessionId);
    },

    listenForRealtimeChanges() {
        this.supabase.channel('sessions-channel').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload) => {
            if (payload.new.id === this.currentSessionId && payload.new.status === 'FINALIZADO') {
                window.location.reload();
            } else {
                this.run();
            }
        }).subscribe();
    },

    async renderResearcherInfo(profile) {
        if (!profile) {
            this.elements.researcherInfoContainer.style.display = 'none';
            return;
        }
        this.elements.researcherInfoContainer.style.display = 'flex';
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
                const cardClass = isLiveNow ? 'event-card is-live' : 'event-card';
                const time = new Date(session.scheduled_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const platformIcon = session.platform === 'youtube' ? 'fa-youtube' : 'fa-headset';
                const thumbnail = session.thumbnail_url ? `<img src="${session.thumbnail_url}" alt="${session.session_title}" class="event-card-thumbnail" loading="lazy">` : '<div class="event-card-thumbnail-placeholder"></div>';

                return `
                <div class="${cardClass}" data-session-id="${session.id}">
                    ${thumbnail}
                    <div class="card-info">
                        <h5>${isLiveNow ? '<i class="fa-solid fa-tower-broadcast"></i> AHORA: ' : ''}${session.session_title}</h5>
                        <p><i class="fa-brands ${platformIcon}"></i> ${session.platform === 'youtube' ? 'YouTube' : 'EPT Live'} a las ${time}</p>
                    </div>
                </div>`;
            }).join('');
        }
    },
    
    renderOnDemandList(videos) {
        this.elements.youtubeList.innerHTML = videos.map(video => {
            const videoId = video.youtube_video_id;
            const title = video.title;
            const thumbnailUrl = video.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            const videoPlayerData = encodeURIComponent(JSON.stringify({ id: { videoId }, snippet: { title } }));
            return `<div class="video-card" onclick="App.showYouTubePlayer(JSON.parse(decodeURIComponent('${videoPlayerData}')))">
                        <img src="${thumbnailUrl}" alt="${title}" loading="lazy">
                        <div class="card-info"><h5>${title}</h5></div>
                    </div>`;
        }).join('');
    },
    
    showVDONinjaPlayer(session) {
        const streamUrl = session.viewer_url;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.player.innerHTML = `<iframe src="${streamUrl}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },
    
    showYouTubePlayer(video) {
        const videoId = video.id?.videoId || video.snippet?.resourceId?.videoId;
        if (!videoId) return;
        const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        if (this.youtube.isLoaded) this.elements.liveProject.textContent = "Canal de YouTube";
        this.elements.player.innerHTML = `<iframe src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    },

    showYouTubeChat(videoId) {
        if (!videoId) {
            this.elements.chatContainer.innerHTML = '<p class="placeholder-text">El chat solo está disponible para transmisiones de YouTube.</p>';
            return;
        }
        const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;
        this.elements.chatContainer.innerHTML = `<iframe src="${chatUrl}" frameborder="0"></iframe>`;
    },

    showCountdown(session) {
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'block';
        this.elements.endedMessage.style.display = 'none';
        this.elements.player.innerHTML = '';
        this.elements.countdownTitle.textContent = session.session_title;
        
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        const endTime = new Date(session.scheduled_at).getTime();
        this.timers.countdown = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;
            if (distance < 1000) {
                clearInterval(this.timers.countdown);
                this.elements.countdownClock.textContent = "¡EMPEZANDO!";
                if (session.platform === 'vdo_ninja') this.setSessionLive(session.id);
                setTimeout(() => this.run(), 1500);
                return;
            }
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            this.elements.countdownClock.textContent = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    },
    
    async setSessionLive(sessionId) {
        await this.supabase.from('sessions').update({ status: 'EN VIVO' }).eq('id', sessionId);
    },

    showEndedMessage(message = "No hay transmisiones en este momento.") {
        this.elements.researcherInfoContainer.style.display = 'none';
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'none';
        this.elements.endedMessage.style.display = 'block';
        this.elements.endedMessage.querySelector('p').textContent = message;
        this.elements.player.innerHTML = '';
        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">No hay chat activo.</p>';
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
            this.elements.modalOrganizerAvatar.src = session.profiles.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            this.elements.modalOrganizerName.textContent = session.profiles.display_name || 'Anfitrión';
            this.elements.modalOrganizerOrcid.textContent = session.profiles.orcid ? `ORCID: ${session.profiles.orcid}` : '';
            this.elements.modalOrganizer.style.display = 'flex';
        } else {
            this.elements.modalOrganizer.style.display = 'none';
        }

        if (session.more_info_url) {
            this.elements.modalMoreInfo.href = session.more_info_url;
            this.elements.modalMoreInfo.style.display = 'inline-block';
        } else {
            this.elements.modalMoreInfo.style.display = 'none';
        }

        this.elements.modalOverlay.classList.add('is-visible');
    },

    closeEventModal() {
        this.elements.modalOverlay.classList.remove('is-visible');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());