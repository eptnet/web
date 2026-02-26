// =================================================================
// ARCHIVO: /live/js/sala-publica.js (Versión Inmersiva + Chat Nativo)
// =================================================================

const PublicRoomApp = {
    supabase: null,
    sessionId: null,
    sessionData: null,
    countdownTimer: null,
    realtimeChannel: null,
    currentUserProfile: null, // Perfil del usuario logueado

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const pathParts = window.location.pathname.split('/');
        const pathId = pathParts.includes('l') ? pathParts[pathParts.indexOf('l') + 1] : null;
        const urlParams = new URLSearchParams(window.location.search);
        
        this.sessionId = pathId || urlParams.get('id');

        if (!this.sessionId) {
            document.body.innerHTML = '<h1 style="color:white; text-align:center; margin-top:20vh;">Sala no encontrada. Regresa al Dashboard.</h1>';
            return;
        }

        await this.checkAuth();
        this.setupEventListeners();
        await this.loadSessionData();
    },

    // 1. VERIFICAMOS SI ESTÁ LOGUEADO PARA EL CHAT
    async checkAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            // Extraemos su perfil para usarlo en el chat
            const { data: profile } = await this.supabase.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).single();
            this.currentUserProfile = profile;
        }
    },

    setupEventListeners() {
        // Pestañas de Chat
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.chat-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            });
        });

        document.getElementById('btn-share').addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href);
            alert("¡Enlace de la sala copiado al portapapeles!");
        });

        // Enviar Chat con Enter
        const chatInput = document.getElementById('bsky-chat-input');
        const sendBtn = document.getElementById('btn-send-bsky');
        
        if (chatInput && sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage());
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }

        // Inicializar Selector de Emojis
        // --- NUEVO: Inicializar Selector de Emojis (Web Component) ---
        const btnEmoji = document.getElementById('btn-emoji');
        const pickerContainer = document.getElementById('emoji-picker-container');
        const picker = document.querySelector('emoji-picker');
        const chatInputText = document.getElementById('bsky-chat-input');

        if (btnEmoji && pickerContainer && picker && chatInputText) {
            // Mostrar/Ocultar con el botón
            btnEmoji.addEventListener('click', (e) => {
                e.stopPropagation(); // Evita que se cierre instantáneamente
                pickerContainer.classList.toggle('hidden');
            });

            // Insertar emoji al hacer clic en uno
            picker.addEventListener('emoji-click', event => {
                chatInputText.value += event.detail.unicode;
                chatInputText.focus(); // Devuelve el cursor al input
            });

            // Cerrar el panel automáticamente si haces clic fuera de él
            document.addEventListener('click', (e) => {
                if (!pickerContainer.contains(e.target) && e.target !== btnEmoji && !btnEmoji.contains(e.target)) {
                    pickerContainer.classList.add('hidden');
                }
            });
        }

        // --- LÓGICA MÓVIL: ABRIR/CERRAR CHAT DESLIZANTE ---
        const btnOpenChat = document.getElementById('btn-open-mobile-chat');
        const btnCloseChat = document.getElementById('btn-close-mobile-chat');
        const chatColumn = document.querySelector('.chat-column');
        const roomLayout = document.getElementById('room-layout');

        if (btnOpenChat && btnCloseChat && chatColumn) {
            // Abrir Chat
            btnOpenChat.addEventListener('click', () => {
                chatColumn.classList.add('mobile-open');
                // Bloqueamos el scroll del texto de atrás para que sea cómodo chatear
                if (roomLayout) roomLayout.style.overflow = 'hidden'; 
            });

            // Cerrar Chat
            btnCloseChat.addEventListener('click', () => {
                chatColumn.classList.remove('mobile-open');
                // Restauramos el scroll del texto
                if (roomLayout) roomLayout.style.overflow = 'auto';
            });
        }

        // Listeners delegados para avatares y botón de reporte
        document.body.addEventListener('click', (e) => {
            const avatar = e.target.closest('.avatar-modal-trigger');
            if (avatar) {
                this.openInvestigatorModal(avatar.dataset.userId);
            }

            const reportBtn = e.target.closest('#btn-report-session');
            if (reportBtn) {
                this.handleReportSession(this.sessionId);
            }
        });
    },

    async loadSessionData() {
        try {
            const { data, error } = await this.supabase
                .from('sessions')
                // AÑADIMOS organizer:profiles para traer al dueño de la sala
                .select(`
                    *, 
                    organizer:profiles(id, display_name, avatar_url, username),
                    event_participants ( profiles (id, display_name, avatar_url, username) )
                `)
                .eq('id', this.sessionId)
                .single();

            if (error || !data) throw error;
            this.sessionData = data;
            
            this.renderUI();
            this.handlePlayerAndCountdown();
            this.setupChats();
            
            // Iniciamos el canal en tiempo real para espectadores y chat
            if (this.sessionData.status === 'EN VIVO' || this.sessionData.status === 'PROGRAMADO') {
                this.setupRealtimeChannel();
            }

        } catch (error) {
            console.error("Error al cargar la sala:", error);
            document.getElementById('session-title').textContent = "Error al cargar los datos del evento.";
        }
    },

    renderUI() {
        const s = this.sessionData;
        
        // --- NUEVO: PERSONALIZAR EL NOMBRE DEL ÁGORA ---
        const brandingElement = document.querySelector('.room-branding');
        if (brandingElement && s.organizer && s.organizer.username) {
            brandingElement.innerHTML = `<img src="https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png" alt="Logo"> Ágora con<span style="color:var(--text-main); font-weight:800; margin-left:4px;">@${s.organizer.username}</span>`;
        }
        let effectiveStatus = s.status;
        const now = new Date().getTime();
        const scheduled = new Date(s.scheduled_at).getTime();
        
        if (effectiveStatus === 'PROGRAMADO' && now > scheduled && s.recording_url) {
            effectiveStatus = 'FINALIZADO';
        }

        document.getElementById('session-title').textContent = s.title || s.session_title;
        document.getElementById('session-desc').textContent = s.description || 'Únete a la conversación en esta sesión especial de Epistecnología.';
        document.getElementById('session-project').innerHTML = `<i class="fa-solid fa-folder-open"></i> ${s.project_title ? s.project_title.substring(0,25)+'...' : 'General'}`;
        document.getElementById('session-date').innerHTML = `<i class="fa-regular fa-clock"></i> ${new Date(s.scheduled_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}`;
        
        const badge = document.getElementById('status-badge');
        if (effectiveStatus === 'EN VIVO') { badge.className = 'badge live'; badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EN VIVO'; }
        else if (effectiveStatus === 'PROGRAMADO') { badge.className = 'badge upcoming'; badge.innerHTML = '<i class="fa-regular fa-calendar"></i> PROGRAMADO'; }
        else { badge.className = 'badge vod'; badge.innerHTML = '<i class="fa-solid fa-play-circle"></i> GRABACIÓN'; }

        // DOI (Ahora es cliqueable)
        if (s.project_doi) {
            const doiTag = document.getElementById('session-doi');
            doiTag.classList.remove('hidden');
            doiTag.innerHTML = `<i class="fa-solid fa-fingerprint"></i> <a href="https://doi.org/${s.project_doi}" target="_blank">${s.project_doi}</a>`;
        }
        if (s.more_info_url) {
            const btnMore = document.getElementById('btn-saber-mas');
            btnMore.classList.remove('hidden');
            btnMore.href = s.more_info_url;
        }

        // Ponentes (Avatar cliqueable para modal y @usuario hacia la nueva ruta limpia)
        const speakersContainer = document.getElementById('speakers-list');
        if (s.event_participants && s.event_participants.length > 0) {
            speakersContainer.innerHTML = s.event_participants.map(ep => {
                const p = ep.profiles;
                return `
                    <div class="speaker-item">
                        <img src="${p.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="avatar-modal-trigger" data-user-id="${p.id}">
                        <div class="speaker-info">
                            <strong>${p.display_name}</strong>
                            <a href="/@${p.username}" target="_blank" class="speaker-handle">@${p.username}</a>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            speakersContainer.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Ponentes no registrados en el sistema.</p>';
        }

        // --- RENDERIZAR BARRA DE COMPARTIR ---
        this.renderShareBar(s);
    },

    handlePlayerAndCountdown() {
        const s = this.sessionData;
        const playerContainer = document.getElementById('player-container');
        const overlay = document.getElementById('countdown-overlay');

        const now = new Date().getTime();
        const scheduled = new Date(s.scheduled_at).getTime();
        const isPast = now > scheduled;

        const getEmbedUrl = (url) => {
            if (!url) return '';
            if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
            if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
            return url;
        };

        const hostname = window.location.hostname || 'localhost';

        if (s.platform === 'youtube' || s.platform === 'twitch') {
            overlay.classList.add('hidden');
            let iframeSrc = s.platform === 'youtube' 
                ? `https://www.youtube.com/embed/${s.platform_id}?autoplay=1`
                : `https://player.twitch.tv/?channel=${s.platform_id}&parent=${hostname}`;
            playerContainer.innerHTML += `<iframe src="${iframeSrc}" allow="autoplay; fullscreen; microphone; camera" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`;
            return;
        }

        if (s.status === 'FINALIZADO' || (s.status === 'PROGRAMADO' && isPast && s.recording_url)) {
            overlay.classList.add('hidden');
            if (s.recording_url) {
                const embedUrl = getEmbedUrl(s.recording_url);
                playerContainer.innerHTML += `<iframe src="${embedUrl}" allow="autoplay; fullscreen" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`;
            } else {
                playerContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${s.thumbnail_url || ''})`;
                playerContainer.innerHTML += `
                    <div style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:2;">
                        <i class="fa-solid fa-film" style="font-size:3rem; color:var(--text-muted); margin-bottom:15px;"></i>
                        <h3 style="margin:0; color:white; font-size:1.5rem;">Transmisión Finalizada</h3>
                        <p style="color:var(--text-muted); margin-top:5px;">La grabación estará disponible próximamente.</p>
                    </div>`;
            }
            return;
        }

        if (s.platform === 'vdo_ninja') {
            if (s.status === 'PROGRAMADO') {
                overlay.classList.remove('hidden');
                playerContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${s.thumbnail_url || ''})`;
                playerContainer.style.backgroundSize = 'cover';
                playerContainer.style.backgroundPosition = 'center';

                if (s.viewer_url) {
                    playerContainer.innerHTML += `<iframe src="${s.viewer_url}&transparent=1&automute=1" allow="autoplay; fullscreen; microphone; camera" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`;
                }

                this.countdownTimer = setInterval(() => {
                    const distance = scheduled - new Date().getTime();
                    if (distance < 0) {
                        clearInterval(this.countdownTimer);
                        document.getElementById('timer-display').textContent = "00:00:00";
                        document.getElementById('countdown-date').textContent = "Conectando con el auditorio...";
                        setTimeout(() => overlay.classList.add('hidden'), 5000);
                        return;
                    }
                    const d = Math.floor(distance / (1000 * 60 * 60 * 24));
                    const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                    const sec = Math.floor((distance % (1000 * 60)) / 1000);
                    document.getElementById('timer-display').textContent = `${d > 0 ? d + 'd ' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                }, 1000);

            } else if (s.status === 'EN VIVO') {
                overlay.classList.add('hidden');
                if (s.viewer_url) {
                    playerContainer.innerHTML += `<iframe src="${s.viewer_url}&transparent=1" allow="autoplay; fullscreen; microphone; camera" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`;
                }
            }
        }
    },

    // --- 3. CONFIGURACIÓN DE CHATS (NATIVO EPT + PLATAFORMA) ---
    setupChats() {
        const s = this.sessionData;
        const hostname = window.location.hostname || 'localhost';
        
        // Chat Externo (Twitch/YouTube)
        if (s.platform === 'youtube' || s.platform === 'twitch') {
            const nativeTab = document.getElementById('native-chat-tab');
            const nativePanel = document.getElementById('native-chat');
            nativeTab.classList.remove('hidden');
            
            if (s.platform === 'youtube' && s.platform_id) {
                nativeTab.innerHTML = '<i class="fa-brands fa-youtube" style="color:#ef4444;"></i> Chat YouTube';
                nativePanel.innerHTML = `<iframe src="https://www.youtube.com/live_chat?v=${s.platform_id}&embed_domain=${hostname}" width="100%" height="100%" frameborder="0"></iframe>`;
            } else if (s.platform === 'twitch' && s.platform_id) {
                nativeTab.innerHTML = '<i class="fa-brands fa-twitch" style="color:#a855f7;"></i> Chat Twitch';
                // Corrección del BUG de Twitch: Aseguramos el parent correcto
                nativePanel.innerHTML = `<iframe src="https://www.twitch.tv/embed/${s.platform_id}/chat?parent=${hostname}&darkpopout" width="100%" height="100%" frameborder="0"></iframe>`;
            }
        }

        // Lógica Visual del Chat Nativo EPT
        const authOverlay = document.getElementById('bsky-auth-overlay');
        const chatInput = document.getElementById('bsky-chat-input');
        const chatFeed = document.getElementById('bsky-chat-feed');
        const sendBtn = document.getElementById('btn-send-bsky');

        chatFeed.innerHTML = ''; // Limpiar mensaje de carga

        if (this.currentUserProfile) {
            // Usuario logueado: Tiene permiso para chatear
            authOverlay.classList.add('hidden');
            chatInput.disabled = false;
            sendBtn.disabled = false;
            
            // ¡Habilitar botón de Emojis!
            const btnEmoji = document.getElementById('btn-emoji');
            if (btnEmoji) btnEmoji.disabled = false;
            
            chatInput.placeholder = "Escribe un mensaje...";
        } else {
            // No logueado: Muro de fricción mínimo
            authOverlay.classList.remove('hidden');
            authOverlay.innerHTML = `
                <i class="fa-solid fa-lock" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 15px;"></i>
                <h3 style="margin:0 0 10px 0;">Chat Exclusivo</h3>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:20px;">Inicia sesión en Epistecnología para unirte a la conversación.</p>
                <a href="/" class="btn-primary" style="text-decoration:none;">Iniciar Sesión</a>
            `;
        }
    },

    // --- 4. MAGIA EN TIEMPO REAL (ESPECTADORES Y CHAT EPT) ---
    async setupRealtimeChannel() {
        const viewersBadge = document.getElementById('viewers-badge');
        viewersBadge.classList.remove('hidden');

        // ID único por pestaña (para contar visitantes anónimos también)
        const trackingId = this.currentUserProfile ? this.currentUserProfile.display_name : `guest_${Math.random().toString(36).substr(2, 9)}`;

        this.realtimeChannel = this.supabase.channel(`room_${this.sessionId}`, {
            config: { 
                presence: { key: trackingId },
                broadcast: { self: true } // Permite recibir los propios mensajes
            }
        });

        // 4A. Contador de Espectadores
        this.realtimeChannel.on('presence', { event: 'sync' }, () => {
            const state = this.realtimeChannel.presenceState();
            const count = Object.keys(state).length;
            document.getElementById('viewer-count').textContent = count;
        });

        // 4B. Escuchar Mensajes del Chat Nativo
        this.realtimeChannel.on('broadcast', { event: 'chat_message' }, (payload) => {
            this.renderIncomingMessage(payload.payload);
        });

        // Suscripción final
        this.realtimeChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.realtimeChannel.track({ online_at: new Date().toISOString() });
            }
        });
    },

    // 5. ENVIAR Y RENDERIZAR MENSAJES
    sendChatMessage() {
        if (!this.currentUserProfile || !this.realtimeChannel) return;
        
        const input = document.getElementById('bsky-chat-input');
        const text = input.value.trim();
        if (!text) return;

        const messageData = {
            user: this.currentUserProfile.display_name,
            avatar: this.currentUserProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Emitir mensaje a todos los que estén en la sala (Supabase Broadcast)
        this.realtimeChannel.send({
            type: 'broadcast',
            event: 'chat_message',
            payload: messageData
        });

        input.value = ''; // Limpiar input
    },

    renderIncomingMessage(msg) {
        const feed = document.getElementById('bsky-chat-feed');
        
        const msgHtml = `
            <div style="display:flex; gap:10px; margin-bottom:15px; animation: fadeIn 0.3s ease;">
                <img src="${msg.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                <div>
                    <div style="display:flex; align-items:baseline; gap:8px;">
                        <span style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${msg.user}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${msg.timestamp}</span>
                    </div>
                    <p style="margin:5px 0 0 0; font-size:0.95rem; color:rgba(255,255,255,0.9); line-height:1.4; word-break:break-word;">
                        ${msg.text}
                    </p>
                </div>
            </div>
        `;

        feed.insertAdjacentHTML('beforeend', msgHtml);
        
        // Auto-scroll hacia abajo
        feed.scrollTop = feed.scrollHeight;
    },

    // --- NUEVAS FUNCIONES DE INTERACCIÓN ---

    renderShareBar(session) {
        const shareBar = document.getElementById('live-room-share-bar');
        if (!shareBar) return;

        // Ruta limpia configurada en Cloudflare
        const directLink = `${window.location.origin}/l/${session.id}`;
        
        shareBar.innerHTML = `
            <button class="share-btn" data-sharer="facebook" title="Compartir en Facebook"><i class="fa-brands fa-facebook-f"></i></button>
            <button class="share-btn" data-sharer="linkedin" title="Compartir en LinkedIn"><i class="fa-brands fa-linkedin-in"></i></button>
            <button class="share-btn" data-sharer="whatsapp" title="Compartir en WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
            <button class="share-btn" data-sharer="x" title="Compartir en X"><i class="fa-brands fa-x-twitter"></i></button>
            <button class="share-btn" data-sharer="bluesky" aria-label="Compartir en Bluesky"><i class="fa-brands fa-bluesky"></i></button>
            <button class="share-btn" id="copy-link-live" title="Copiar enlace"><i class="fa-solid fa-link"></i></button>
        `;

        shareBar.dataset.shareLink = directLink;
        shareBar.dataset.shareTitle = session.title || session.session_title;

        shareBar.addEventListener('click', (e) => {
            const shareButton = e.target.closest('.share-btn');
            if (!shareButton) return;

            const service = shareButton.dataset.sharer;
            const link = encodeURIComponent(shareBar.dataset.shareLink);
            const title = encodeURIComponent(shareBar.dataset.shareTitle);
            let url;

            switch (service) {
                case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${link}`; break;
                case 'linkedin': url = `https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`; break;
                case 'whatsapp': url = `https://api.whatsapp.com/send?text=${title}%20${link}`; break;
                case 'x': url = `https://twitter.com/intent/tweet?url=${link}&text=${title}`; break;
                case 'bluesky': url = `https://bsky.app/intent/compose?text=${title}%20${link}`; break;
            }

            if (url) window.open(url, '_blank', 'noopener,noreferrer');

            if (shareButton.id === 'copy-link-live') {
                navigator.clipboard.writeText(decodeURIComponent(link)).then(() => {
                    const originalIcon = shareButton.innerHTML;
                    shareButton.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i>`;
                    setTimeout(() => { shareButton.innerHTML = originalIcon; }, 1500);
                });
            }
        });
    },

    async openInvestigatorModal(userId) {
        if (!userId) return;
        this.closeInvestigatorModal(); // Limpiar previos

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'investigator-modal';
        modalOverlay.className = 'investigator-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="investigator-modal">
                <header class="investigator-modal-header">
                    <button class="investigator-modal-close-btn">&times;</button>
                </header>
                <main id="investigator-modal-content" class="investigator-modal-content"><p class="text-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando perfil...</p></main>
            </div>`;
        
        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';

        modalOverlay.querySelector('.investigator-modal-close-btn').addEventListener('click', () => this.closeInvestigatorModal());
        modalOverlay.addEventListener('click', (e) => { if (e.target.id === 'investigator-modal') this.closeInvestigatorModal(); });

        setTimeout(() => modalOverlay.classList.add('is-visible'), 10);

        try {
            const { data: user, error: userError } = await this.supabase.from('profiles').select('*').eq('id', userId).single();
            if (userError) throw userError;
            const { data: projects } = await this.supabase.from('projects').select('title').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
            
            const modalContent = document.getElementById('investigator-modal-content');
            if (!modalContent) return;

            const socialLinksHTML = `
                ${user.website_url ? `<a href="${user.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
                ${user.youtube_url ? `<a href="${user.youtube_url}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
                ${user.x_url ? `<a href="${user.x_url}" target="_blank" title="X"><i class="fab fa-x-twitter"></i></a>` : ''}
                ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
            `;
            const orcidHTML = user.orcid ? `<a href="${user.orcid}" target="_blank" style="color:#a3a3a3; text-decoration:none;"><i class="fa-brands fa-orcid" style="color:#a6ce39;"></i> ${user.orcid.replace('https://orcid.org/','')}</a>` : 'No disponible';
            let projectInfoHTML = projects && projects.length > 0 ? `<div class="project-info"><h4>Últimos proyectos:</h4><ul>${projects.map(p => `<li>${p.title}</li>`).join('')}</ul></div>` : `<div class="project-info"><p class="text-muted">No tiene proyectos públicos en la plataforma.</p></div>`;
            
            modalContent.innerHTML = `
                <img src="${user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${user.display_name}" class="avatar">
                <h3>${user.display_name}</h3>
                <p style="margin: 0 0 10px 0; font-size: 0.85rem;">${orcidHTML}</p>
                <a href="/@${user.username}" target="_blank" class="btn-primary" style="display:inline-block; margin-top:5px; padding: 5px 15px; font-size: 0.85rem;">Ver Perfil Completo</a>
                <div class="profile-card__socials">${socialLinksHTML}</div>
                <p class="investigator-bio">${user.bio || 'Investigador en Epistecnología.'}</p>
                ${projectInfoHTML}
            `;
        } catch (error) {
            const modalContent = document.getElementById('investigator-modal-content');
            if (modalContent) modalContent.innerHTML = "<p class='text-muted'>No se pudo cargar la información del investigador.</p>";
        }
    },

    closeInvestigatorModal() {
        const modal = document.getElementById('investigator-modal');
        if (modal) {
            modal.classList.remove('is-visible');
            setTimeout(() => {
                modal.remove();
                document.body.style.overflow = ''; // Restaurar scroll
            }, 300);
        }
    },

    async handleReportSession(sessionId) {
        // 1. Pedimos el motivo al usuario (opcional)
        const reason = prompt("¿Por qué deseas reportar esta sesión? (Opcional)");
        if (reason === null) return; // Si el usuario da a "Cancelar", detenemos todo

        // Cambiamos el estado del botón para que sepa que está cargando
        const reportBtn = document.getElementById('btn-report-session');
        if (reportBtn) {
            reportBtn.disabled = true;
            reportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
        }

        try {
            // 2. Verificamos si el usuario está logueado o es invitado
            const { data: { session } } = await this.supabase.auth.getSession();
            const reporterId = session ? session.user.id : 'invitado_anónimo';

            // 3. Invocamos la Edge Function de Supabase
            // NOTA: Asegúrate de que el nombre 'report-session' coincide con el nombre 
            // con el que desplegaste tu función en Supabase (ej: supabase functions deploy report-session)
            const { data, error } = await this.supabase.functions.invoke('report-session', {
                // Pasamos los datos exactamente como los espera tu index.ts en los headers
                headers: {
                    'x-session-id': sessionId,
                    'x-reporter-id': reporterId
                },
                // Mandamos la razón en el body por si en el futuro decides añadirla al correo de Resend
                body: { reason: reason } 
            });

            if (error) throw error;

            alert("Gracias. Tu reporte ha sido enviado y notificará al equipo de moderación.");
        } catch (error) {
            console.error("Error al reportar la sesión:", error);
            alert("Hubo un problema al enviar el reporte. Por favor, inténtalo más tarde.");
        } finally {
            // Restauramos el botón a su estado original
            if (reportBtn) {
                reportBtn.disabled = false;
                reportBtn.innerHTML = '<i class="fas fa-flag"></i> Reportar sesión';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => PublicRoomApp.init());