// =================================================================
// ARCHIVO ACTUALIZADO: /live/js/sala-publica.js (Green Room Activo)
// =================================================================

const PublicRoomApp = {
    supabase: null,
    sessionId: null,
    sessionData: null,
    countdownTimer: null,
    realtimeChannel: null,
    currentUserProfile: null,

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

    async checkAuth() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            const { data: profile } = await this.supabase.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).single();
            this.currentUserProfile = profile;
        }
    },

    setupEventListeners() {
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.closest('.chat-tab');
                if (!targetTab) return;
                document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.chat-panel').forEach(p => p.classList.remove('active'));
                targetTab.classList.add('active');
                const targetPanel = document.getElementById(targetTab.dataset.target);
                if (targetPanel) targetPanel.classList.add('active');
            });
        });

        document.getElementById('btn-share').addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href);
            alert("¡Enlace de la sala copiado al portapapeles!");
        });

        const chatInput = document.getElementById('bsky-chat-input');
        const sendBtn = document.getElementById('btn-send-bsky');
        
        if (chatInput && sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage());
            chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendChatMessage(); });
        }

        const btnEmoji = document.getElementById('btn-emoji');
        const pickerContainer = document.getElementById('emoji-picker-container');
        const picker = document.querySelector('emoji-picker');

        if (btnEmoji && pickerContainer && picker && chatInput) {
            btnEmoji.addEventListener('click', (e) => {
                e.stopPropagation(); 
                pickerContainer.classList.toggle('hidden');
            });

            picker.addEventListener('emoji-click', event => {
                chatInput.value += event.detail.unicode;
                chatInput.focus(); 
            });

            document.addEventListener('click', (e) => {
                if (!pickerContainer.contains(e.target) && e.target !== btnEmoji && !btnEmoji.contains(e.target)) {
                    pickerContainer.classList.add('hidden');
                }
            });
        }

        const btnOpenChat = document.getElementById('btn-open-mobile-chat');
        const btnCloseChat = document.getElementById('btn-close-mobile-chat');
        const chatColumn = document.querySelector('.chat-column');
        const roomLayout = document.getElementById('room-layout');

        if (btnOpenChat && btnCloseChat && chatColumn) {
            btnOpenChat.addEventListener('click', () => {
                chatColumn.classList.add('mobile-open');
                if (roomLayout) roomLayout.style.overflow = 'hidden'; 
            });
            btnCloseChat.addEventListener('click', () => {
                chatColumn.classList.remove('mobile-open');
                if (roomLayout) roomLayout.style.overflow = 'auto';
            });
        }

        document.body.addEventListener('click', (e) => {
            const avatar = e.target.closest('.avatar-modal-trigger');
            if (avatar) this.openInvestigatorModal(avatar.dataset.userId);

            const reportBtn = e.target.closest('#btn-report-session');
            if (reportBtn) this.handleReportSession(this.sessionId);
        });
    },

    async loadSessionData() {
        try {
            const { data, error } = await this.supabase.from('sessions')
                .select(`*, organizer:profiles(id, display_name, avatar_url, username), event_participants ( profiles (id, display_name, avatar_url, username) )`)
                .eq('id', this.sessionId)
                .single();

            if (error || !data) throw error;
            this.sessionData = data;

            this.updateMetaTags();

            // Inicializar la sección de comentarios en la parte inferior
            this.setupCommentsSection(this.sessionData);

            // Inicializar contadores de la encuesta en vivo
            this.pollCounts = {};
            await this.loadInitialPollData();
            
            this.renderUI();
            this.handlePlayerAndCountdown();
            this.setupChats();
            
            if (this.sessionData.status === 'EN VIVO' || this.sessionData.status === 'PROGRAMADO') {
                this.setupRealtimeChannel();
            }
        } catch (error) {
            console.error("Error al cargar la sala:", error);
            document.getElementById('session-title').textContent = "Error al cargar los datos del evento.";
        }
    },

    // ==========================================
    // ACTUALIZAR ETIQUETAS PARA COMPARTIR EN REDES
    // ==========================================
    updateMetaTags() {
        if (!this.sessionData) return;
        
        const title = `${this.sessionData.session_title} | EPT Live`;
        const desc = this.sessionData.description || 'Únete a la conversación en este evento en vivo de Epistecnología.';
        const image = this.sessionData.thumbnail_url || 'https://i.ibb.co/ZRmgqZ6h/eptlive-rrss.jpg';
        const url = window.location.href;

        // Actualiza el título de la pestaña del navegador
        document.title = title;

        // Actualiza las etiquetas ocultas Open Graph (og:) para WhatsApp, Facebook, etc.
        const ogTitle = document.getElementById('meta-og-title');
        const ogDesc = document.getElementById('meta-og-desc');
        const ogImg = document.getElementById('meta-og-image');
        const ogUrl = document.getElementById('meta-og-url');

        if (ogTitle) ogTitle.setAttribute('content', title);
        if (ogDesc) ogDesc.setAttribute('content', desc);
        if (ogImg) ogImg.setAttribute('content', image);
        if (ogUrl) ogUrl.setAttribute('content', url);
    },

    renderUI() {
        const s = this.sessionData;
        const brandingElement = document.querySelector('.room-branding');
        if (brandingElement && s.organizer && s.organizer.username) {
            brandingElement.innerHTML = `<img src="https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png" alt="Logo"> Ágora con<span style="color:var(--text-main); font-weight:800; margin-left:4px;">@${s.organizer.username}</span>`;
        }
        
        let effectiveStatus = s.status;
        const now = new Date().getTime();
        const scheduled = new Date(s.scheduled_at).getTime();
        if (effectiveStatus === 'PROGRAMADO' && now > scheduled && s.recording_url) effectiveStatus = 'FINALIZADO';

        document.getElementById('session-title').textContent = s.title || s.session_title;
        document.getElementById('session-desc').textContent = s.description || 'Únete a la conversación en esta sesión especial de Epistecnología.';
        
        // --- LÓGICA DE MOSTRAR MÁS / MENOS (Tipo YouTube) ---
        setTimeout(() => {
            const descP = document.getElementById('session-desc');
            const toggleBtn = document.getElementById('btn-toggle-desc');
            
            if (descP && toggleBtn) {
                // Comprobamos si el texto real (scrollHeight) es mayor que la caja colapsada de 4 líneas (clientHeight)
                if (descP.scrollHeight > descP.clientHeight) {
                    toggleBtn.classList.remove('hidden'); // Mostramos el botón
                    
                    toggleBtn.addEventListener('click', () => {
                        const isCollapsed = descP.classList.contains('desc-collapsed');
                        if (isCollapsed) {
                            descP.classList.remove('desc-collapsed');
                            toggleBtn.textContent = 'Mostrar menos';
                        } else {
                            descP.classList.add('desc-collapsed');
                            toggleBtn.textContent = 'Mostrar más';
                        }
                    });
                }
            }
        }, 100); // Pequeño retraso para permitir que el navegador dibuje el texto primero

        document.getElementById('session-project').innerHTML = `<i class="fa-solid fa-folder-open"></i> ${s.project_title ? s.project_title.substring(0,25)+'...' : 'General'}`;
        document.getElementById('session-date').innerHTML = `<i class="fa-regular fa-clock"></i> ${new Date(s.scheduled_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}`;
        
        const badge = document.getElementById('status-badge');
        if (effectiveStatus === 'EN VIVO') { badge.className = 'badge live'; badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EN VIVO'; }
        else if (effectiveStatus === 'PROGRAMADO') { badge.className = 'badge upcoming'; badge.innerHTML = '<i class="fa-regular fa-calendar"></i> PROGRAMADO'; }
        else { badge.className = 'badge vod'; badge.innerHTML = '<i class="fa-solid fa-play-circle"></i> GRABACIÓN'; }

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

        const speakersContainer = document.getElementById('speakers-list');
        if (s.event_participants && s.event_participants.length > 0) {
            speakersContainer.innerHTML = s.event_participants.map(ep => {
                const p = ep.profiles;
                return `<div class="speaker-item"><img src="${p.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="avatar-modal-trigger" data-user-id="${p.id}"><div class="speaker-info"><strong>${p.display_name}</strong><a href="/@${p.username}" target="_blank" class="speaker-handle">@${p.username}</a></div></div>`;
            }).join('');
        } else {
            speakersContainer.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Ponentes no registrados en el sistema.</p>';
        }

        this.renderShareBar(s);
        
        const pageTitle = s.title || s.session_title;
        document.title = `${pageTitle} - Epistecnología`;
        document.getElementById('meta-og-title')?.setAttribute('content', pageTitle);
        document.getElementById('meta-og-desc')?.setAttribute('content', s.description || '');
        document.getElementById('meta-og-image')?.setAttribute('content', s.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png');
        document.getElementById('meta-og-url')?.setAttribute('content', window.location.href);
    },

    // --- MAGIA: TRANSICIONES SIN RECARGA DE PÁGINA ---
    handlePlayerAndCountdown() {
        const s = this.sessionData;
        const playerContainer = document.getElementById('player-container');
        const overlay = document.getElementById('countdown-overlay');
        const hostname = window.location.hostname || 'localhost';
        
        const now = new Date().getTime();
        const scheduled = new Date(s.scheduled_at).getTime();
        const isPast = now > scheduled;

        const getEmbedUrl = (url) => {
            if (!url) return '';
            if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
            if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
            return url;
        };

        // 1. ESTADO: FINALIZADO O GRABACIÓN
        if (s.status === 'FINALIZADO' || (s.status === 'PROGRAMADO' && isPast && s.recording_url)) {
            overlay.classList.add('hidden');
            clearInterval(this.countdownTimer);
            
            // Limpiamos iframes en vivo si existían
            const existingIframe = playerContainer.querySelector('iframe');
            if (existingIframe) existingIframe.remove();

            if (s.recording_url) {
                const embedUrl = getEmbedUrl(s.recording_url);
                playerContainer.insertAdjacentHTML('beforeend', `<iframe src="${embedUrl}" allow="autoplay; fullscreen" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`);
            } else {
                playerContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${s.thumbnail_url || ''})`;
                playerContainer.innerHTML += `
                    <div id="vod-notice" style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:2;">
                        <i class="fa-solid fa-film" style="font-size:3rem; color:var(--text-muted); margin-bottom:15px;"></i>
                        <h3 style="margin:0; color:white; font-size:1.5rem;">Transmisión Finalizada</h3>
                        <p style="color:var(--text-muted); margin-top:5px;">La grabación estará disponible próximamente.</p>
                    </div>`;
            }
            return;
        }

        // 2. ESTADO: PROGRAMADO (GREEN ROOM GLOBAL)
        if (s.status === 'PROGRAMADO') {
            overlay.classList.remove('hidden');
            playerContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${s.thumbnail_url || ''})`;
            playerContainer.style.backgroundSize = 'cover';
            playerContainer.style.backgroundPosition = 'center';
            
            // Bloqueamos cualquier reproductor rebelde
            const existingIframe = playerContainer.querySelector('iframe');
            if (existingIframe) existingIframe.remove();

            clearInterval(this.countdownTimer);
            this.countdownTimer = setInterval(() => {
                const distance = scheduled - new Date().getTime();
                if (distance < 0) {
                    document.getElementById('timer-display').textContent = "00:00:00";
                    document.getElementById('countdown-date').textContent = "El evento está por comenzar. Esperando señal del director...";
                    return;
                }
                const d = Math.floor(distance / (1000 * 60 * 60 * 24));
                const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const sec = Math.floor((distance % (1000 * 60)) / 1000);
                document.getElementById('timer-display').textContent = `${d > 0 ? d + 'd ' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
            }, 1000);
            return;
        }

        // 3. ESTADO: EN VIVO (ABRIR TELÓN)
        if (s.status === 'EN VIVO' || s.status === 'EN_VIVO') { // <-- Agrega el || s.status === 'EN_VIVO'
            overlay.classList.add('hidden');
            clearInterval(this.countdownTimer);

            const existingIframe = playerContainer.querySelector('iframe');
            if (!existingIframe) {
                let iframeSrc = '';
                if (s.platform === 'youtube') iframeSrc = `https://www.youtube.com/embed/${s.platform_id}?autoplay=1`;
                else if (s.platform === 'twitch') iframeSrc = `https://player.twitch.tv/?channel=${s.platform_id}&parent=${hostname}&autoplay=true`;
                else if (s.platform === 'vdo_ninja') iframeSrc = `${s.viewer_url}&transparent=1&autoplay=1`;

                if (iframeSrc) {
                    // Inyectamos por debajo de los controles (z-index: 1)
                    playerContainer.insertAdjacentHTML('beforeend', `<iframe src="${iframeSrc}" allow="autoplay; fullscreen; microphone; camera" style="position:absolute; top:0; left:0; width:100%; height:100%; border:none; z-index:1;"></iframe>`);
                }
            }
        }
    },

    setupChats() {
        const s = this.sessionData;
        const nativeTab = document.getElementById('native-chat-tab');
        const nativePanel = document.getElementById('native-chat');
        const eptTab = document.querySelector('.chat-tab[data-target="ept-chat"]');
        const bskyPanel = document.getElementById('ept-chat');
        const isLive = s.status === 'EN VIVO';

        // Nos aseguramos de ocultar cualquier rastro del chat nativo de otras plataformas
        if (nativeTab) nativeTab.classList.add('hidden');
        if (nativePanel) nativePanel.innerHTML = '';
        
        // Activamos por defecto y como única opción nuestro Chat EPT
        if (eptTab) eptTab.classList.add('active');
        if (bskyPanel) bskyPanel.classList.add('active');

        const authOverlay = document.getElementById('bsky-auth-overlay');
        const chatInput = document.getElementById('bsky-chat-input');
        const chatFeed = document.getElementById('bsky-chat-feed');
        const sendBtn = document.getElementById('btn-send-bsky');

        if (chatFeed) chatFeed.innerHTML = ''; 

        // Lógica de finalización de evento
        if (!isLive && s.status !== 'PROGRAMADO') {
            if (authOverlay) {
                authOverlay.classList.remove('hidden');
                authOverlay.innerHTML = `<i class="fa-solid fa-comment-slash" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 15px;"></i><h3 style="margin:0 0 10px 0;">Chat Desactivado</h3><p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:0;">El evento ha finalizado.</p>`;
            }
            return;
        }

        // Lógica de validación de usuario
        if (this.currentUserProfile) {
            if (authOverlay) authOverlay.classList.add('hidden');
            
            // Verificamos si el chat fue apagado por el director
            if (s.is_chat_active === false) {
                if (chatInput) { chatInput.disabled = true; chatInput.placeholder = "🔒 El moderador ha pausado el chat."; }
                if (sendBtn) sendBtn.disabled = true;
            } else {
                if (chatInput) { chatInput.disabled = false; chatInput.placeholder = "Escribe un mensaje..."; }
                if (sendBtn) sendBtn.disabled = false;
            }
            
            const btnEmoji = document.getElementById('btn-emoji');
            if (btnEmoji) btnEmoji.disabled = false;
        } else {
            if (authOverlay) {
                authOverlay.classList.remove('hidden');
                authOverlay.innerHTML = `<i class="fa-solid fa-lock" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 15px;"></i><h3 style="margin:0 0 10px 0;">Chat Exclusivo</h3><p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:20px;">Inicia sesión en Epistecnología para interactuar.</p><a href="/" class="btn-primary" style="text-decoration:none;">Iniciar Sesión</a>`;
            }
        }
    },

    async setupRealtimeChannel() {
        const viewersBadge = document.getElementById('viewers-badge');
        if (viewersBadge) viewersBadge.classList.remove('hidden');

        // 1. CARGAMOS LOS MENSAJES ANTERIORES
        const { data: pastMessages } = await this.supabase
            .from('live_chat_messages')
            .select('*')
            .eq('session_id', this.sessionId)
            .order('created_at', { ascending: true })
            .limit(100);
        
        if (pastMessages) {
            pastMessages.forEach(msg => this.renderIncomingMessage(msg));
        }

        const trackingId = this.currentUserProfile ? this.currentUserProfile.display_name : `guest_${Math.random().toString(36).substr(2, 9)}`;

        // 2. UNIFICAMOS TODO EN EL CANAL PRINCIPAL
        this.realtimeChannel = this.supabase.channel(`room_${this.sessionId}`, {
            config: { presence: { key: trackingId }, broadcast: { self: true } }
        });

        this.realtimeChannel
            .on('presence', { event: 'sync' }, () => {
                const state = this.realtimeChannel.presenceState();
                const counter = document.getElementById('viewer-count');
                if (counter) counter.textContent = Object.keys(state).length;
            })
            // Mensajes nuevos (SIN FILTRO en la base de datos)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages' }, (payload) => {
                // Filtro infalible en JavaScript
                if (payload.new.session_id == this.sessionId) {
                    this.renderIncomingMessage(payload.new);
                }
            })
            // Borrados
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat_messages' }, (payload) => {
                const msgEl = document.getElementById(`msg-${payload.old.id}`);
                if (msgEl) msgEl.remove();
            })
            // Comentarios de Bsky
            .on('broadcast', { event: 'new_chat_message' }, (payload) => {
                this.appendCommentMessage(payload.payload, false);
            })
            // Cambio de estado de la sesión
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${this.sessionId}` }, (payload) => {
                const newStatus = payload.new.status;
                const isNowLive = (newStatus === 'EN VIVO' || newStatus === 'EN_VIVO');
                const wasNotLive = (this.sessionData.status !== 'EN VIVO' && this.sessionData.status !== 'EN_VIVO');

                if (isNowLive && wasNotLive) {
                    this.sessionData.status = 'EN VIVO';
                    const badge = document.getElementById('status-badge');
                    if(badge) { badge.className = 'badge live'; badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EN VIVO'; }
                    this.handlePlayerAndCountdown(); 
                } else if (payload.new.status === 'FINALIZADO' && this.sessionData.status !== 'FINALIZADO') {
                    this.sessionData.status = 'FINALIZADO';
                    const badge = document.getElementById('status-badge');
                    if(badge) { badge.className = 'badge vod'; badge.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> FINALIZADO'; }
                    this.handlePlayerAndCountdown(); 
                    this.setupChats(); 
                }
                
                // Activar/Desactivar Chat en Vivo
                if (payload.new.is_chat_active !== this.sessionData.is_chat_active) {
                    this.sessionData.is_chat_active = payload.new.is_chat_active;
                    const chatInput = document.getElementById('bsky-chat-input');
                    const sendBtn = document.getElementById('btn-send-bsky');
                    
                    if (this.sessionData.is_chat_active === false) {
                        if(chatInput) { chatInput.disabled = true; chatInput.placeholder = "🔒 El moderador ha pausado el chat."; }
                        if(sendBtn) { sendBtn.disabled = true; }
                    } else {
                        if (this.currentUserProfile) { // Solo si está logueado
                            if(chatInput) { chatInput.disabled = false; chatInput.placeholder = "Escribe un mensaje..."; }
                            if(sendBtn) { sendBtn.disabled = false; }
                        }
                    }
                }
    
                // Cambios en la Encuesta Rápida
                if (payload.new.poll_status !== this.sessionData.poll_status || 
                    payload.new.poll_question !== this.sessionData.poll_question ||
                    JSON.stringify(payload.new.active_emojis) !== JSON.stringify(this.sessionData.active_emojis)) {
                    
                    this.sessionData.poll_status = payload.new.poll_status;
                    this.sessionData.active_emojis = payload.new.active_emojis;
                    this.sessionData.poll_question = payload.new.poll_question;
                    this.renderLivePoll();
                }
            })
            // Votos de la encuesta
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `session_id=eq.${this.sessionId}` }, (payload) => {
                const emoji = payload.new.emoji;
                this.pollCounts[emoji] = (this.pollCounts[emoji] || 0) + 1;
                this.updatePollCountersUI();
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') await this.realtimeChannel.track({ online_at: new Date().toISOString() });
            });
    },

    async sendChatMessage() {
        if (!this.currentUserProfile) return;
        const input = document.getElementById('bsky-chat-input');
        const text = input.value.trim();
        if (!text) return;

        // Limpiamos el input para que se sienta rápido (Optimistic UI)
        input.value = ''; 

        // CALCULAMOS EL CÓDIGO DE TIEMPO (Tiempo transcurrido del evento)
        let videoTime = null;
        if (this.sessionData.status === 'EN VIVO' || this.sessionData.status === 'EN_VIVO') {
            const start = new Date(this.sessionData.scheduled_at).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, Math.floor((now - start) / 1000));
            const h = Math.floor(diff / 3600).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            const s = (diff % 60).toString().padStart(2, '0');
            videoTime = `${h}:${m}:${s}`;
        }

        // GUARDAMOS EN LA BASE DE DATOS
        await this.supabase.from('live_chat_messages').insert([{
            session_id: this.sessionId,
            user_name: this.currentUserProfile.display_name,
            user_avatar: this.currentUserProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            message: text,
            is_director: false,
            video_timestamp: videoTime
        }]);
    },

    renderIncomingMessage(msg) {
        const feed = document.getElementById('bsky-chat-feed');
        if (!feed) return;

        // Comprobamos si el usuario actual es el Director de esta sesión
        const isDirector = this.currentUserProfile && this.sessionData.user_id === this.currentUserProfile.id;
        
        let modControls = '';
        if (isDirector) {
            // Botones mágicos de moderación y Bluesky solo visibles para el dueño
            modControls = `
                <div style="margin-left: auto; display:flex; gap: 8px;">
                    <button onclick="PublicRoomApp.promoteToBluesky('${msg.id}', '${msg.user_name}', \`${msg.message.replace(/'/g, "\\'")}\`, '${msg.video_timestamp || 'En Vivo'}')" title="Enviar como aporte destacado a Bluesky" style="background:transparent; border:none; color:#38bdf8; cursor:pointer; font-size:1rem; transition:0.2s;"><i class="fa-brands fa-bluesky"></i></button>
                    <button onclick="PublicRoomApp.deleteChatMessage('${msg.id}')" title="Borrar mensaje" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:1rem; transition:0.2s;"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
        }

        const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const directorCrown = msg.is_director ? '<i class="fa-solid fa-crown" style="font-size:0.75rem; margin-left:4px; color:#b72a1e;"></i>' : '';
        const nameColor = msg.is_director ? '#b72a1e' : 'var(--text-main)';

        const msgHtml = `
            <div id="msg-${msg.id}" style="display:flex; gap:10px; margin-bottom:15px; animation: fadeIn 0.3s ease; width: 100%;">
                <img src="${msg.user_avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                <div style="flex-grow: 1;">
                    <div style="display:flex; align-items:baseline; gap:8px;">
                        <span style="font-weight:700; font-size:0.9rem; color:${nameColor};">${msg.user_name} ${directorCrown}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${timeStr}</span>
                        ${modControls}
                    </div>
                    <p style="margin:5px 0 0 0; font-size:0.95rem; color:rgba(255,255,255,0.9); line-height:1.4; word-break:break-word;">
                        ${msg.message}
                    </p>
                </div>
            </div>`;
        feed.insertAdjacentHTML('beforeend', msgHtml);
        feed.scrollTop = feed.scrollHeight;
    },

    // --- NUEVAS FUNCIONES DE MODERACIÓN Y BLUESKY ---
    async deleteChatMessage(messageId) {
        if (!confirm("¿Borrar este mensaje para todos?")) return;
        try {
            await this.supabase.from('live_chat_messages').delete().eq('id', messageId);
        } catch (e) {
            console.error("Error borrando:", e);
        }
    },

    async promoteToBluesky(messageId, authorName, text, timestamp) {
        if (!confirm(`¿Enviar el comentario al hilo de Bluesky?`)) return;
        
        const btn = document.querySelector(`#msg-${messageId} .fa-bluesky`);
        if(btn) { btn.className = 'fa-solid fa-spinner fa-spin'; }

        try {
            // Limpiador automático
            let cleanName = authorName.replace('👑', '').replace('(Organizador)', '').trim();
            let shortName = cleanName.split(' ')[0];
            if (shortName.length > 10) shortName = shortName.substring(0, 10);

            // FORMATO ULTRA CORTO
            const timeBadge = (timestamp && timestamp !== 'En Vivo') ? ` [${timestamp}]` : '';
            const formattedText = `🎙️: "${text}"\n— ${shortName}${timeBadge}`;
            
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: {
                    replyText: formattedText,
                    parentPost: { uri: this.sessionData.bsky_chat_thread_uri, cid: this.sessionData.bsky_chat_thread_cid }
                }
            });
            if (error) throw error;
            
            if(btn) { btn.className = 'fa-solid fa-check'; btn.style.color = '#10b981'; }
            alert("¡Enviado a Bluesky!");
        } catch (error) {
            if(btn) { btn.className = 'fa-brands fa-bluesky'; }
            alert("Error al enviar a Bluesky.");
        }
    },

    renderShareBar(session) {
        const shareBar = document.getElementById('live-room-share-bar');
        if (!shareBar) return;
        const directLink = `${window.location.origin}/l/${session.id}`;
        shareBar.innerHTML = `
            <button class="share-btn" data-sharer="facebook"><i class="fa-brands fa-facebook-f"></i></button>
            <button class="share-btn" data-sharer="linkedin"><i class="fa-brands fa-linkedin-in"></i></button>
            <button class="share-btn" data-sharer="whatsapp"><i class="fa-brands fa-whatsapp"></i></button>
            <button class="share-btn" data-sharer="x"><i class="fa-brands fa-x-twitter"></i></button>
            <button class="share-btn" id="copy-link-live"><i class="fa-solid fa-link"></i></button>
        `;
        shareBar.dataset.shareLink = directLink;
        shareBar.dataset.shareTitle = session.title || session.session_title;

        shareBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.share-btn');
            if (!btn) return;
            const srv = btn.dataset.sharer;
            const lnk = encodeURIComponent(shareBar.dataset.shareLink);
            const tit = encodeURIComponent(shareBar.dataset.shareTitle);
            let url;
            if (srv==='facebook') url=`https://www.facebook.com/sharer/sharer.php?u=${lnk}`;
            if (srv==='linkedin') url=`https://www.linkedin.com/shareArticle?mini=true&url=${lnk}&title=${tit}`;
            if (srv==='whatsapp') url=`https://api.whatsapp.com/send?text=${tit}%20${lnk}`;
            if (srv==='x') url=`https://twitter.com/intent/tweet?url=${lnk}&text=${tit}`;
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            if (btn.id==='copy-link-live') {
                navigator.clipboard.writeText(decodeURIComponent(lnk)).then(() => {
                    const original = btn.innerHTML;
                    btn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i>`;
                    setTimeout(() => { btn.innerHTML = original; }, 1500);
                });
            }
        });
    },

    async openInvestigatorModal(userId) {
        if (!userId) return;
        this.closeInvestigatorModal(); 
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'investigator-modal';
        modalOverlay.className = 'investigator-modal-overlay';
        modalOverlay.innerHTML = `<div class="investigator-modal"><header class="investigator-modal-header"><button class="investigator-modal-close-btn">&times;</button></header><main id="investigator-modal-content" class="investigator-modal-content"><p class="text-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando perfil...</p></main></div>`;
        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';
        modalOverlay.querySelector('.investigator-modal-close-btn').addEventListener('click', () => this.closeInvestigatorModal());
        setTimeout(() => modalOverlay.classList.add('is-visible'), 10);
        try {
            const { data: user } = await this.supabase.from('profiles').select('*').eq('id', userId).single();
            const modalContent = document.getElementById('investigator-modal-content');
            modalContent.innerHTML = `
                <img src="${user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" class="avatar">
                <h3>${user.display_name}</h3>
                <a href="/@${user.username}" target="_blank" class="btn-primary" style="display:inline-block; margin-top:10px; padding: 5px 15px; font-size: 0.85rem;">Ver Perfil Completo</a>
                <p class="investigator-bio" style="margin-top: 15px;">${user.bio || 'Investigador en Epistecnología.'}</p>
            `;
        } catch (error) {}
    },

    closeInvestigatorModal() {
        const modal = document.getElementById('investigator-modal');
        if (modal) {
            modal.classList.remove('is-visible');
            setTimeout(() => { modal.remove(); document.body.style.overflow = ''; }, 300);
        }
    },

    async handleReportSession(sessionId) {
        const reason = prompt("¿Por qué deseas reportar esta sesión? (Opcional)");
        if (reason === null) return;
        const reportBtn = document.getElementById('btn-report-session');
        if (reportBtn) { reportBtn.disabled = true; reportBtn.innerHTML = 'Enviando...'; }
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            await this.supabase.functions.invoke('report-session', {
                headers: { 'x-session-id': sessionId, 'x-reporter-id': session ? session.user.id : 'invitado_anónimo' },
                body: { reason: reason } 
            });
            alert("Tu reporte ha sido enviado y notificará al equipo de moderación.");
        } catch (error) {
            alert("Hubo un problema al enviar el reporte.");
        } finally {
            if (reportBtn) { reportBtn.disabled = false; reportBtn.innerHTML = '<i class="fas fa-flag"></i> Reportar sesión'; }
        }
    },

    // ==========================================
    // MÓDULO DE COMENTARIOS (ÁGORA INFERIOR)
    // ==========================================
    async setupCommentsSection(session) {
        const authPrompt = document.getElementById('comments-auth-prompt');
        const commentsForm = document.getElementById('comments-form');
        const commentInput = document.getElementById('comment-input');
        const submitBtn = document.getElementById('btn-submit-comment');
        const charCounter = document.getElementById('comment-char-counter');
        const userAvatar = document.getElementById('comment-user-avatar');

        // 1. Verificación de Autenticación
        const { data: { session: authSession } } = await this.supabase.auth.getSession();
        let hasBskyCreds = false;
        let bskyHandle = '';

        if (authSession) {
            const { data: bskyCreds } = await this.supabase.from('bsky_credentials').select('handle').eq('user_id', authSession.user.id).single();
            if (bskyCreds) {
                hasBskyCreds = true;
                bskyHandle = bskyCreds.handle;
            }
        }

        // 2. Control de UI según estado del usuario
        if (!authSession || !hasBskyCreds) {
            if (authPrompt) authPrompt.classList.remove('hidden');
            if (commentsForm) commentsForm.classList.add('hidden');
        } else {
            if (authPrompt) authPrompt.classList.add('hidden');
            if (commentsForm) commentsForm.classList.remove('hidden');

            // Cargar avatar del usuario
            if (this.currentUserProfile && this.currentUserProfile.avatar_url) {
                userAvatar.src = this.currentUserProfile.avatar_url;
            } else if (bskyHandle) {
                userAvatar.src = `https://api.dicebear.com/9.x/shapes/svg?seed=${bskyHandle}`;
            }

            // Lógica del input auto-expandible
            commentInput.addEventListener('input', () => {
                const remaining = 300 - commentInput.value.length;
                charCounter.textContent = remaining;
                submitBtn.disabled = commentInput.value.trim().length === 0;
                
                commentInput.style.height = 'auto';
                commentInput.style.height = (commentInput.scrollHeight) + 'px';
            });

            // Enviar el comentario
            commentsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCommentSubmit(session.bsky_chat_thread_uri, session.bsky_chat_thread_cid, bskyHandle);
            });
        }

        // 3. Cargar el Hilo de Bluesky
        if (session.bsky_chat_thread_uri) {
            this.loadCommentsThread(session.bsky_chat_thread_uri);
        } else {
            document.getElementById('comments-feed').innerHTML = '<p class="text-muted text-center">Aún no hay comentarios.</p>';
        }
    },

    async loadCommentsThread(postUri) {
        const commentsFeed = document.getElementById('comments-feed');
        if (!commentsFeed) return;

        try {
            // Usamos tu Edge Function nativa que trae todo el hilo
            const { data: chatData, error } = await this.supabase.functions.invoke('bsky-get-post-thread', { body: { postUri } });
            if (error) throw error;
            
            commentsFeed.innerHTML = '';
            
            // 1. Mostrar SIEMPRE el mensaje original (El post Ancla del evento) al tope
            if (chatData.anchorPost) {
                this.appendCommentMessage(chatData.anchorPost, false, true); // El 'true' activa el diseño de Ancla
            }

            if (!chatData.messages || chatData.messages.length === 0) {
                commentsFeed.insertAdjacentHTML('beforeend', '<p class="text-muted text-center empty-msg" style="margin-top:20px;">Sé el primero en iniciar la conversación.</p>');
                return;
            }

            // 2. Invertimos el arreglo para que los comentarios MÁS RECIENTES salgan arriba
            const sortedMessages = chatData.messages.reverse();
            sortedMessages.forEach(msg => {
                this.appendCommentMessage(msg, false);
            });

        } catch (error) {
            console.error("Error al cargar comentarios:", error);
            commentsFeed.innerHTML = '<p class="text-muted text-center">No se pudieron cargar los comentarios.</p>';
        }
    },

    appendCommentMessage(message, prepend = false, isAnchor = false) {
        const feed = document.getElementById('comments-feed');
        if (!feed || !message || !message.author || !message.record) return;

        // ¡ELIMINADA LA REGLA QUE OCULTABA EL ANUNCIO! Ahora lo renderizamos a propósito.

        const div = document.createElement('div');
        div.className = `comment-item ${isAnchor ? 'anchor-comment' : ''}`;
        
        let dateStr = '';
        if (message.record.createdAt || message.indexedAt) {
            const d = new Date(message.record.createdAt || message.indexedAt);
            dateStr = `<span style="font-size:0.75rem; color:var(--text-muted); margin-left: 8px;">${d.toLocaleDateString()}</span>`;
        }

        // Si es el post original, le inyectamos una etiqueta dorada/azul
        const anchorBadge = isAnchor ? `<span class="anchor-badge">Comentario <i class="fa-solid fa-thumbtack"></i></span>` : '';

        div.innerHTML = `
            <div class="comment-item-avatar">
                <img src="${message.author.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar">
            </div>
            <div class="comment-item-content">
                <div class="comment-item-header">
                    <span class="comment-author-name">${message.author.displayName || message.author.handle}</span>
                    <span class="comment-author-handle">@${message.author.handle}</span>
                    ${anchorBadge}
                    ${dateStr}
                </div>
                <p class="comment-text">${message.record.text.replace(/\n/g, '<br>')}</p>
            </div>
        `;

        // Lógica inteligente de inserción: Si agregamos un comentario nuevo (prepend), 
        // lo colocamos DEBAJO del Ancla, pero ENCIMA de los demás comentarios.
        if (prepend) {
            const firstChild = feed.firstElementChild;
            if (firstChild && firstChild.classList.contains('anchor-comment')) {
                if (firstChild.nextSibling) {
                    feed.insertBefore(div, firstChild.nextSibling);
                } else {
                    feed.appendChild(div);
                }
            } else {
                feed.insertBefore(div, feed.firstChild);
            }
        } else {
            feed.appendChild(div);
        }
    },

    async handleCommentSubmit(threadUri, threadCid, bskyHandle) {
        const input = document.getElementById('comment-input');
        const submitBtn = document.getElementById('btn-submit-comment');
        const text = input.value.trim();
        if (!text) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // 1. Actualización Optimista UI
        const optimisticMsg = {
            author: {
                avatar: this.currentUserProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${bskyHandle}`,
                displayName: this.currentUserProfile?.display_name || 'Tú',
                handle: bskyHandle
            },
            record: { text: text, createdAt: new Date().toISOString() }
        };
        
        const emptyMsg = document.querySelector('#comments-feed .text-center');
        if (emptyMsg) emptyMsg.remove();

        // Agregamos el comentario arriba (como los más recientes de YT)
        this.appendCommentMessage(optimisticMsg, true);

        // Limpiar el campo
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('comment-char-counter').textContent = '300';

        try {
            // 2. Disparar a Bluesky (Tu Edge Function se encarga de subirlo y emitir el Broadcast)
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: {
                    replyText: text,
                    parentPost: { uri: threadUri, cid: threadCid }
                }
            });
            if (error) throw error;
        } catch (error) {
            alert("Tu sesión de Bluesky expiró o hubo un error de conexión.");
            console.error(error);
        } finally {
            submitBtn.disabled = true; 
            submitBtn.innerHTML = 'Comentar';
        }
    },

    // ==========================================
    // SISTEMA DE VOTACIÓN (ÁGORA PÚBLICA)
    // ==========================================
    async loadInitialPollData() {
        // Traemos todos los clics que hayan ocurrido (aún si la sesión ya terminó)
        const { data: votes } = await this.supabase.from('poll_votes').select('emoji').eq('session_id', this.sessionId);
        if (votes) {
            votes.forEach(v => { this.pollCounts[v.emoji] = (this.pollCounts[v.emoji] || 0) + 1; });
        }
        this.renderLivePoll();
    },

    renderLivePoll() {
        const container = document.getElementById('live-poll-container');
        if (!container) return;

        const isActive = this.sessionData.poll_status === 'abierto';
        const emojis = this.sessionData.active_emojis || [];
        const question = this.sessionData.poll_question;

        if (isActive && emojis.length > 0) {
            let html = '';
            
            // Si hay pregunta, cambiamos el formato a columna para que quede arriba
            if (question) {
                html += `<div style="width: 100%; text-align: center; margin-bottom: 10px; font-weight: 600; color: white; font-size: 0.95rem;">${question}</div>`;
                container.style.flexDirection = 'column';
            } else {
                container.style.flexDirection = 'row';
            }

            html += `<div style="display: flex; gap: 12px; justify-content: center; width: 100%;">`;
            html += emojis.map(emj => `
                <button class="poll-btn" data-emoji="${emj}" title="Votar ${emj}">
                    ${emj} <span class="poll-count" id="count-${encodeURIComponent(emj)}">${this.pollCounts[emj] || 0}</span>
                </button>
            `).join('');
            html += `</div>`;

            container.innerHTML = html;
            container.classList.remove('hidden');

            container.querySelectorAll('.poll-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.submitVote(e.currentTarget));
            });
        } else {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
    },

    updatePollCountersUI() {
        const emojis = this.sessionData.active_emojis || [];
        emojis.forEach(emj => {
            const countSpan = document.getElementById(`count-${encodeURIComponent(emj)}`);
            if (countSpan) countSpan.textContent = this.pollCounts[emj] || 0;
        });
    },

    async submitVote(button) {
        const emoji = button.dataset.emoji;
        
        // Pequeña animación de Feedback al hacer clic
        button.style.transform = 'scale(1.2)';
        setTimeout(() => button.style.transform = '', 150);

        // Disparamos la inserción a la base de datos (El Realtime se encarga de subir el número)
        try {
            const userId = this.currentUserProfile?.id || null; // Si no está logueado, queda null (Anónimo)
            await this.supabase.from('poll_votes').insert([{
                session_id: this.sessionId,
                user_id: userId,
                emoji: emoji
            }]);
        } catch (error) {
            console.error("Error al registrar el voto:", error);
        }
    }
};

// Exponemos la app para que funcionen los botones HTML
window.PublicRoomApp = PublicRoomApp;
document.addEventListener('DOMContentLoaded', () => PublicRoomApp.init());