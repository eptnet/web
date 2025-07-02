const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    
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
        this.timers.mainLoop = setInterval(() => this.run(), 30000);
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
    },

    async run() {
        const youtubeLiveVideo = await this.fetchYouTubeLive();
        if (youtubeLiveVideo) {
            this.handleYouTubeLive(youtubeLiveVideo);
            this.renderSchedule([]);
            return; 
        }

        const { activeSession, upcomingSessions } = await this.fetchScheduledSessions();
        this.renderSchedule(upcomingSessions);

        if (activeSession) {
            if (activeSession.platform === 'vdo_ninja') { this.handleVDONinjaSession(activeSession); } 
            else if (activeSession.platform === 'youtube') { this.handleYouTubeSession(activeSession); }
        } else {
            if (!this.youtube.isLoaded) { this.handleYouTubeOnDemand(); }
        }
    },
    
    async fetchYouTubeLive() {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.youtube.CHANNEL_ID}&eventType=live&type=video&key=${this.youtube.API_KEY}`);
            const data = await response.json();
            return (data.items && data.items.length > 0) ? data.items[0] : null;
        } catch (error) { console.error("Error al buscar directos de YouTube:", error); return null; }
    },

    async fetchScheduledSessions() {
        const now = new Date().toISOString();
        const { data, error } = await this.supabase.from('sessions').select('*').in('status', ['PROGRAMADO', 'EN VIVO']).gte('scheduled_at', now).order('scheduled_at', { ascending: true });
        if (error) { console.error("Error buscando sesiones:", error); return { activeSession: null, upcomingSessions: [] }; }
        return { activeSession: data ? data[0] : null, upcomingSessions: data ? data.slice(1) : [] };
    },
    
    handleVDONinjaSession(session) {
        this.renderResearcherInfo(session.user_id);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);
        if (session.status === 'EN VIVO' || (now >= scheduledAt)) { this.showVDONinjaPlayer(session); } 
        else { this.showCountdown(session); }
    },
    
    handleYouTubeSession(session) {
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);
        if (now >= scheduledAt) {
            this.showYouTubePlayer({ id: { videoId: session.platform_id }, snippet: { title: session.session_title } });
        } else {
            this.showCountdown(session);
        }
    },

    handleYouTubeLive(video) {
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "🔴 Transmitiendo en vivo desde YouTube";
        this.showYouTubePlayer(video);
    },

    async handleYouTubeOnDemand() {
        this.youtube.isLoaded = true;
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.youtubeList.innerHTML = '<p class="placeholder-text">Cargando videos...</p>';
        this.elements.liveTitle.textContent = "Canal Epistecnología";
        this.elements.liveProject.textContent = "Contenido On-Demand";
        const videos = await this.fetchYouTubeVideos();
        if (videos && videos.length > 0) {
            this.youtube.videos = videos;
            this.renderYouTubeList(this.youtube.videos);
            this.showYouTubePlayer(videos[0]); 
        } else {
            this.showEndedMessage("No se pudieron cargar los videos de YouTube.");
        }
    },
    
    async fetchYouTubeVideos() {
        try {
            if (!this.youtube.uploadsPlaylistId) {
                const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${this.youtube.CHANNEL_ID}&key=${this.youtube.API_KEY}`);
                const channelData = await channelResponse.json();
                if (!channelData.items || channelData.items.length === 0) throw new Error("Canal de YouTube no encontrado o sin acceso.");
                this.youtube.uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;
            }
            const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${this.youtube.uploadsPlaylistId}&maxResults=50&key=${this.youtube.API_KEY}`);
            const playlistData = await playlistResponse.json();
            
            const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');
            
            const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=${videoIds}&key=${this.youtube.API_KEY}`);
            const detailsData = await detailsResponse.json();
            
            const videoDetails = {};
            detailsData.items.forEach(item => {
                const duration = item.contentDetails.duration.match(/(\d+)M|(\d+)S/g) || [];
                const totalSeconds = duration.reduce((acc, time) => (time.includes('M') ? acc + parseInt(time) * 60 : acc + parseInt(time)), 0);
                videoDetails[item.id] = {
                    duration: totalSeconds,
                    isPublic: item.status.privacyStatus === 'public'
                };
            });
            
            return playlistData.items.filter(item => {
                const details = videoDetails[item.snippet.resourceId.videoId];
                return details && details.isPublic && details.duration > 70;
            });
        } catch (error) { console.error("Error al obtener videos de YouTube:", error); return null; }
    },

    async renderResearcherInfo(userId) {
        if (!userId) { this.elements.researcherInfoContainer.style.display = 'none'; return; }
        const { data: profile } = await this.supabase.from('profiles').select('full_name, avatar_url, orcid').eq('id', userId).single();
        if (profile) {
            this.elements.researcherInfoContainer.style.display = 'flex';
            this.elements.researcherAvatar.src = profile.avatar_url || 'https://placehold.co/64x64/2c2c2c/aaaaaa?text=EPT';
            this.elements.researcherName.textContent = profile.full_name || 'Investigador';
            this.elements.researcherOrcid.textContent = profile.orcid ? `ORCID: ${profile.orcid}` : '';
        }
    },

    renderSchedule(sessions) {
        if (!this.elements.scheduleList) return;
        this.elements.scheduleList.innerHTML = (!sessions || sessions.length === 0) 
            ? '<p class="placeholder-text">No hay eventos programados.</p>'
            : sessions.map(session => {
                const date = new Date(session.scheduled_at);
                const day = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const platformIcon = session.platform === 'youtube' ? 'fa-youtube' : 'fa-podcast';
                return `<div class="event-card">
                            <div class="card-info">
                                <h5>${session.session_title}</h5>
                                <p><i class="fa-brands ${platformIcon}"></i> ${session.platform === 'youtube' ? 'YouTube' : 'EPT Live'}</p>
                                <p>${day} - ${time}</p>
                            </div>
                        </div>`;
            }).join('');
    },
    
    renderYouTubeList(videos) {
        this.elements.youtubeList.innerHTML = videos.map(item => {
            const video = item.snippet;
            const videoData = encodeURIComponent(JSON.stringify({ id: { videoId: video.resourceId.videoId }, snippet: { title: video.title } }));
            return `<div class="video-card" onclick="App.showYouTubePlayer(JSON.parse(decodeURIComponent('${videoData}')))">
                        <img src="${video.thumbnails.medium.url}" alt="${video.title}" loading="lazy">
                        <div class="card-info"><h5>${video.title}</h5></div>
                    </div>`;
        }).join('');
    },
    
    showVDONinjaPlayer(session) {
        const streamUrl = session.viewer_url;
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src === streamUrl) return;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.player.innerHTML = `<iframe src="${streamUrl}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },
    
    showYouTubePlayer(video) {
        const videoId = video.id.videoId;
        const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src.includes(videoId)) return;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "Canal de YouTube";
        this.elements.player.innerHTML = `<iframe src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
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
        const { error } = await this.supabase.from('sessions').update({ status: 'EN VIVO' }).eq('id', sessionId);
        if(error) console.error("Error al actualizar la sesión a EN VIVO:", error);
    },

    showEndedMessage(message = "No hay transmisiones en este momento.") {
        this.elements.researcherInfoContainer.style.display = 'none';
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'none';
        this.elements.endedMessage.style.display = 'block';
        this.elements.endedMessage.querySelector('p').textContent = message;
        this.elements.player.innerHTML = '';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());