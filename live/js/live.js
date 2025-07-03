const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    
    youtube: {
        API_KEY: 'AIzaSyCwh_RLVd7AQ-6FdMEugrA7phNwN0dN9pw', // Reemplaza con tu API Key
        CHANNEL_ID: 'UCg3ms3gecQ-2cjMhJwaPAig',      // Reemplaza con tu Channel ID
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
            // CÓDIGO CORREGIDO
            chatContainer: document.getElementById('chat-container'), // Contenedor para el chat
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
        // 1. Buscamos si hay un live PÚBLICO en YouTube (máxima prioridad)
        const youtubeLiveVideo = await this.fetchYouTubeLive();
        
        // 2. Siempre obtenemos los datos de nuestra BD
        const { dbLiveSession, dbUpcomingSessions } = await this.fetchScheduledSessions();

        // 3. Renderizamos la agenda
        this.renderSchedule(dbUpcomingSessions, dbLiveSession);
        
        // --- 4. NUEVA LÓGICA DE DECISIÓN ---
        if (youtubeLiveVideo) {
            // Prioridad MÁXIMA: un directo público en YouTube lo interrumpe todo.
            console.log("Manejando directo PÚBLICO de YouTube.");
            this.handleYouTubeLive(youtubeLiveVideo);

        } else if (dbLiveSession) {
            // Hay una sesión activa o programada en nuestra base de datos.
            if (dbLiveSession.platform === 'youtube') {
                // Si es de YouTube, verificamos si REALMENTE sigue en vivo.
                const isStillLive = await this.isYouTubeVideoLive(dbLiveSession.platform_id);
                
                if (isStillLive) {
                    // Si sigue en vivo, lo mostramos, ignorando la hora de finalización.
                    console.log("Manejando sesión de YouTube (verificada como EN VIVO).");
                    this.handleYouTubeSession(dbLiveSession);
                } else {
                    // Si la API dice que ya no está en vivo, vamos a on-demand.
                    console.log("La sesión de YouTube ha finalizado. Cambiando a On-Demand.");
                    this.updateSessionStatus(dbLiveSession.id, 'FINALIZADO'); // Opcional: limpiar la BD
                    this.handleOnDemandContent();
                }

            } else if (dbLiveSession.platform === 'vdo_ninja') {
                // Para VDO.Ninja, no tenemos API externa, así que dependemos del horario.
                const now = new Date();
                if (dbLiveSession.end_at && now > new Date(dbLiveSession.end_at)) {
                    console.log("La sesión de VDO.Ninja ha finalizado por horario. Cambiando a On-Demand.");
                    this.handleOnDemandContent(); // Si ya terminó, vamos a on-demand
                } else {
                    console.log("Manejando sesión de VDO.Ninja.");
                    this.handleVDONinjaSession(dbLiveSession);
                }
            }

        } else {
            // Prioridad BAJA: no hay nada en vivo ni agendado, mostramos contenido On-Demand.
            console.log("No hay eventos activos. Mostrando On-Demand.");
            this.handleOnDemandContent();
        }
    },

    async fetchYouTubeLive() {
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${this.youtube.CHANNEL_ID}&eventType=live&type=video&key=${this.youtube.API_KEY}`);
            const data = await response.json();
            return (data.items && data.items.length > 0) ? data.items[0] : null;
        } catch (error) { console.error("Error al buscar directos de YouTube:", error); return null; }
    },

    // En /live/js/live.js, dentro del objeto App

    async fetchScheduledSessions() {
        const now = new Date();
        // Le damos un margen para que los eventos finalizados no aparezcan inmediatamente
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            // Buscamos sesiones que no estén ya finalizadas
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            // Y que su hora de inicio sea relativamente reciente
            .gte('scheduled_at', fourHoursAgo)
            .order('scheduled_at', { ascending: true });

        if (error) { 
            console.error("Error buscando sesiones:", error); 
            return { dbLiveSession: null, dbUpcomingSessions: [] }; 
        }
        
        let liveSession = null;
        let upcoming = [];
        const now_time = now.getTime();

        // --- LÓGICA DE SEPARACIÓN MEJORADA ---
        
        // Primero, buscamos si hay una sesión explícitamente marcada como 'EN VIVO'.
        // Esta siempre tendrá la máxima prioridad.
        liveSession = data.find(session => session.status === 'EN VIVO');

        // Si no encontramos ninguna 'EN VIVO', buscamos una 'PROGRAMADO' cuya hora ya haya pasado.
        if (!liveSession) {
            liveSession = data.find(session => 
                session.status === 'PROGRAMADO' && 
                new Date(session.scheduled_at).getTime() <= now_time
            );
        }

        // Todas las demás sesiones cuya hora de inicio es futura, son 'próximas'.
        upcoming = data.filter(session => new Date(session.scheduled_at).getTime() > now_time);
        
        // IMPORTANTE: Ya no promovemos una sesión 'próxima' a 'liveSession'.
        // Esto evita que una sesión futura interrumpa la página si no hay nada activo.
        // La página simplemente mostrará contenido On-Demand si 'liveSession' es null.

        return { dbLiveSession: liveSession, dbUpcomingSessions: upcoming };
    },

    handleVDONinjaSession(session) {
        this.renderResearcherInfo(session.user_id, session.project_doi);
        this.elements.liveTitle.textContent = session.session_title;
        this.elements.liveProject.textContent = `Proyecto: ${session.project_title}`;
        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">El chat solo está disponible en transmisiones de YouTube.</p>';
        
        const now = new Date();
        const scheduledAt = new Date(session.scheduled_at);

        if (session.status === 'EN VIVO' || now >= scheduledAt) { this.showVDONinjaPlayer(session); } 
        else { this.showCountdown(session); }
    },

    handleYouTubeSession(session) {
        this.renderResearcherInfo(session.user_id, session.project_doi);
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
        this.elements.researcherInfoContainer.style.display = 'none';
        this.elements.liveTitle.textContent = video.snippet.title;
        this.elements.liveProject.textContent = "🔴 Transmitiendo en vivo desde YouTube";
        this.showYouTubePlayer(video);
        this.showYouTubeChat(video.id.videoId);
    },

    async handleOnDemandContent() {
        if (this.youtube.isLoaded) return; // Evita recargar si ya está visible
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
                if (!channelData.items || channelData.items.length === 0) throw new Error("Canal de YouTube no encontrado.");
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
        } catch (error) {
            console.error("Error al obtener videos de YouTube:", error);
            return null;
        }
    },

    /**
     * Verifica si un video específico de YouTube está actualmente en vivo.
     * @param {string} videoId El ID del video de YouTube a verificar.
     * @returns {Promise<boolean>} Devuelve true si el video está en vivo, de lo contrario false.
     */
    async isYouTubeVideoLive(videoId) {
        if (!videoId) return false;
        try {
            // Usamos el endpoint 'videos' que nos da detalles de un video específico por su ID.
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${this.youtube.API_KEY}`);
            const data = await response.json();
            
            // La propiedad 'liveBroadcastContent' nos dice el estado. Si es 'live', está transmitiendo.
            if (data.items && data.items.length > 0) {
                return data.items[0].snippet.liveBroadcastContent === 'live';
            }
            return false;
        } catch (error) {
            console.error("Error al verificar el estado del video de YouTube:", error);
            return false;
        }
    },

    /**
     * Helper para actualizar el estado de una sesión en la base de datos.
     * @param {string} sessionId El ID de la sesión a actualizar.
     * @param {string} status El nuevo estado (ej. 'FINALIZADO').
     */
    async updateSessionStatus(sessionId, status) {
        const { error } = await this.supabase
            .from('sessions')
            .update({ status: status })
            .eq('id', sessionId);
        if (error) {
            console.error(`Error al actualizar la sesión ${sessionId} a ${status}:`, error);
        }
    },

    // ... el resto de las funciones en la Parte 3 y 4

    async renderResearcherInfo(userId) {
        if (!userId) {
            this.elements.researcherInfoContainer.style.display = 'none';
            return;
        }
        const { data: profile } = await this.supabase.from('profiles').select('full_name, avatar_url, orcid').eq('id', userId).single();
        if (profile) {
            this.elements.researcherInfoContainer.style.display = 'flex';
            this.elements.researcherAvatar.src = profile.avatar_url || 'https://placehold.co/64x64/2c2c2c/aaaaaa?text=EPT';
            this.elements.researcherName.textContent = profile.full_name || 'Investigador';
            this.elements.researcherOrcid.textContent = profile.orcid ? `ORCID: ${profile.orcid}` : '';
        }
    },
    
    renderSchedule(upcoming, current) {
        if (!this.elements.scheduleList) return;
        let html = '';

        if (current) {
            const date = new Date(current.scheduled_at);
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const platformIcon = current.platform === 'youtube' ? 'fa-youtube' : 'fa-podcast';
            html += `<div class="event-card is-live">
                        <div class="card-info">
                            <h5><i class="fa-solid fa-tower-broadcast"></i> AHORA: ${current.session_title}</h5>
                             <p><i class="fa-brands ${platformIcon}"></i> ${current.platform === 'youtube' ? 'YouTube' : 'EPT Live'} a las ${time}</p>
                        </div>
                     </div>`;
        }

        if (!upcoming || upcoming.length === 0) {
            if (!current) html += '<p class="placeholder-text">No hay más eventos programados.</p>';
        } else {
            html += upcoming.map(session => {
                const date = new Date(session.scheduled_at);
                const day = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const platformIcon = session.platform === 'youtube' ? 'fa-youtube' : 'fa-podcast';
                return `<div class="event-card">
                            <div class="card-info">
                                <h5>${session.session_title}</h5>
                                <p><i class="fa-brands ${platformIcon}"></i> ${session.platform === 'youtube' ? 'YouTube' : 'EPT Live'}</p>
                                <p>Próximo: ${day} - ${time}</p>
                            </div>
                        </div>`;
            }).join('');
        }
        this.elements.scheduleList.innerHTML = html;
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
        const videoId = video.id?.videoId || video.snippet?.resourceId?.videoId;
        if (!videoId) { console.error("No se pudo encontrar el ID del video", video); return; }

        const videoUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src.includes(videoId)) return;
        
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        
        this.elements.liveTitle.textContent = video.snippet.title;
        // No sobreescribimos el proyecto si es un video on-demand
        if(this.youtube.isLoaded) {
           this.elements.liveProject.textContent = "Canal de YouTube";
        }

        this.elements.player.innerHTML = `<iframe src="${videoUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    },

    /**
     * Muestra el iframe del chat de YouTube para un video en vivo.
     * @param {string} videoId - El ID del video de YouTube.
     */
    showYouTubeChat(videoId) {
        const chatContainer = this.elements.chatContainer;
        // Si no hay videoId, muestra un mensaje y termina la función.
        if (!videoId) {
            chatContainer.innerHTML = '<p class="placeholder-text">El chat solo está disponible para transmisiones de YouTube.</p>';
            return;
        }

        // Construye la URL del chat embebido. Es crucial incluir tu dominio.
        const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;
        
        // Busca si ya existe un iframe de chat para no recargarlo innecesariamente.
        const existingIframe = chatContainer.querySelector('iframe');
        if (existingIframe && existingIframe.src === chatUrl) {
            return; // Si el chat correcto ya está cargado, no hacemos nada.
        }

        // Limpia el contenedor y crea el nuevo iframe para el chat.
        chatContainer.innerHTML = `<iframe src="${chatUrl}" frameborder="0"></iframe>`;
    },

    showCountdown(session) {
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'block';
        this.elements.endedMessage.style.display = 'none';
        this.elements.player.innerHTML = ''; // Limpiamos el reproductor
        this.elements.countdownTitle.textContent = session.session_title;
        
        if (this.timers.countdown) clearInterval(this.timers.countdown);

        const endTime = new Date(session.scheduled_at).getTime();
        this.timers.countdown = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 1000) {
                clearInterval(this.timers.countdown);
                this.elements.countdownClock.textContent = "¡EMPEZANDO!";
                // Solo VDO.Ninja necesita que le cambiemos el estado manualmente para que el director lo vea
                if (session.platform === 'vdo_ninja') {
                    this.setSessionLive(session.id);
                }
                setTimeout(() => this.run(), 1500); // Re-ejecutamos para que cargue el player
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            this.elements.countdownClock.textContent = 
                `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    },
    
    async setSessionLive(sessionId) {
        const { error } = await this.supabase
            .from('sessions')
            .update({ status: 'EN VIVO' })
            .eq('id', sessionId);
        
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
        this.elements.chatContainer.innerHTML = '<p class="placeholder-text">No hay chat activo.</p>';
    }
};

// =======================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN
// =======================================================
document.addEventListener('DOMContentLoaded', () => App.init());

// ------ BORRAR