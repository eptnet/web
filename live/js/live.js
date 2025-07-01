/**
 * LIVE.JS - LÓGICA PARA LA PÁGINA DE TRANSMISIÓN
 *
 * FASE 1:
 * - Se conecta a Supabase.
 * - Busca sesiones programadas o en vivo.
 * - Muestra una cuenta regresiva para el próximo evento.
 * - Muestra el reproductor de video cuando el evento comienza.
 * - Lista los próximos eventos en la agenda.
 */

// =========================================================================
// CONFIGURACIÓN DE SUPABASE - ¡REEMPLAZA ESTOS VALORES!
// =========================================================================
const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co'; // <-- TU URL DE SUPABASE AQUÍ
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E'; // <-- TU CLAVE 'anon' DE SUPABASE AQUÍ

const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    currentSessionId: null,

    // --- Configuración de YouTube ---
    youtube: {
        API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw', // <-- TU API KEY AQUÍ
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',      // <-- TU CHANNEL ID AQUÍ
        uploadsPlaylistId: null 
    },
    
    init() {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        this.cacheDOMElements();
        this.run();
        this.timers.mainLoop = setInterval(() => this.run(), 60000); 
    },

    cacheDOMElements() {
        this.elements = {
            player: document.getElementById('video-player'),
            overlay: document.getElementById('event-overlay'),
            countdownTimer: document.getElementById('countdown-timer'),
            countdownClock: document.getElementById('countdown-clock'),
            countdownTitle: document.getElementById('countdown-title'),
            endedMessage: document.getElementById('event-ended-message'),
            scheduleList: document.getElementById('schedule-list'),
            liveTitle: document.getElementById('live-title'),
            liveProject: document.getElementById('live-project'),
            scheduleContainer: document.getElementById('schedule-container'),
        };
    },

    async run() {
        // Prioridad 1: Buscar sesión de VDO.Ninja
        const { activeSession, upcomingSessions } = await this.fetchVDONinjaSessions();
        this.renderSchedule(upcomingSessions);

        if (activeSession) {
            this.handleVDONinjaSession(activeSession);
        } else {
            // Prioridad 2: Si no hay VDO.Ninja, mostrar contenido de YouTube
            this.handleYouTubeContent();
        }
    },

    async fetchVDONinjaSessions() {
        const { data: liveData } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('status', 'EN VIVO')
            .limit(1);

        if (liveData && liveData.length > 0) {
            return { activeSession: liveData[0], upcomingSessions: [] };
        }

        const now = new Date().toISOString();
        const { data: upcomingData, error: upcomingError } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('status', 'PROGRAMADO')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true });

        if (upcomingError) {
            console.error("Error buscando sesiones programadas:", upcomingError);
            return { activeSession: null, upcomingSessions: [] };
        }
        
        return { 
            activeSession: upcomingData ? upcomingData[0] : null, 
            upcomingSessions: upcomingData ? upcomingData.slice(1) : [] 
        };
    },
    
    handleVDONinjaSession(session) {
        this.elements.scheduleContainer.querySelector('h2').innerHTML = '<i class="fa-solid fa-calendar-days"></i> Próximos Eventos';
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);

        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;

        if (session.status === 'EN VIVO' || (session.status === 'PROGRAMADO' && now >= scheduledAt)) {
            this.showVDONinjaPlayer(session);
        } else if (session.status === 'PROGRAMADO' && now < scheduledAt) {
            this.showCountdown(session);
        }
    },
    
    async handleYouTubeContent() {
        this.elements.scheduleList.innerHTML = '<p class="placeholder-text">Cargando videos...</p>';
        this.elements.liveTitle.textContent = "Canal Epistecnología";
        this.elements.liveProject.textContent = "Contenido On-Demand";
        
        const videos = await this.fetchYouTubeVideos();
        if (videos && videos.length > 0) {
            this.renderYouTubeList(videos);
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

            const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${this.youtube.uploadsPlaylistId}&maxResults=15&key=${this.youtube.API_KEY}`);
            const playlistData = await playlistResponse.json();
            return playlistData.items;

        } catch (error) {
            console.error("Error al obtener videos de YouTube:", error);
            return null;
        }
    },
    
    renderYouTubeList(videos) {
        this.elements.scheduleContainer.querySelector('h2').innerHTML = '<i class="fa-brands fa-youtube"></i> Videos Recientes';
        
        this.elements.scheduleList.innerHTML = videos.map(item => {
            const video = item.snippet;
            const title = video.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const videoData = encodeURIComponent(JSON.stringify({ videoId: video.resourceId.videoId, snippet: { title: title } }));

            return `
                <div class="schedule-item youtube-item" onclick="App.showYouTubePlayer(JSON.parse(decodeURIComponent('${videoData}')))">
                    <img src="${video.thumbnails.default.url}" alt="thumbnail" width="64" height="48" style="border-radius: 4px; object-fit: cover;"/>
                    <p style="font-size: 0.9em; font-weight: 500;">${video.title}</p>
                </div>
            `;
        }).join('');
    },
    
    showVDONinjaPlayer(session) {
        const streamUrl = session.viewer_url;
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src === streamUrl) {
            return;
        }
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        this.elements.player.innerHTML = `<iframe src="${streamUrl}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },
    
    showYouTubePlayer(video) {
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        
        const videoId = video.videoId || video.snippet.resourceId.videoId;
        // --- INICIO DE LA CORRECCIÓN ---
        // Usamos la URL correcta para insertar videos de YouTube
        const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        // --- FIN DE LA CORRECCIÓN ---
        
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "Canal de YouTube";

        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src.includes(videoId)) {
            return;
        }
        
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
                this.setSessionLive(session.id);
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

    showEndedMessage(message = "Gracias por acompañarnos. El video estará disponible pronto.") {
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'none';
        this.elements.endedMessage.style.display = 'block';
        this.elements.endedMessage.querySelector('p').textContent = message;
        this.elements.player.innerHTML = '';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());