// =================================================================
// ARCHIVO: /inv/js/sala-de-control.js (Dashboard Vertical 100%)
// =================================================================

const ControlRoom = {
    supabase: null,
    sessionId: null,
    sessionData: null,
    realtimeChannel: null,
    userProfile: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const params = new URLSearchParams(window.location.search);
        this.sessionId = params.get('id');

        if (!this.sessionId) {
            document.body.innerHTML = '<h1 style="text-align:center; margin-top:50px;">Error: No se ha proporcionado un ID de sesión.</h1>';
            return;
        }
        
        document.getElementById('btn-edit-session').href = `/inv/configurar-sesion.html?edit=${this.sessionId}`;
        this.fetchAndLoadSession();
    },

    async fetchAndLoadSession() {
        const { data: session, error } = await this.supabase.from('sessions').select('*').eq('id', this.sessionId).single();
        if (error || !session) { alert('Error al cargar la sesión'); return; }

        this.sessionData = session;
        document.getElementById('control-session-title').textContent = session.session_title;
        document.title = `🔴 Control - ${session.session_title}`;

        // 1. Configurar Links: Extracción Automática y Segura
        const btnMixer = document.getElementById('btn-open-mixer');
        const directorUrl = session.director_url || '';
        
        // CORRECCIÓN: Extraemos el Room ID para forzar el enlace correcto y evadir errores de la BD
        let roomMatch = directorUrl.match(/room=([^&]+)/);
        let roomId = roomMatch ? roomMatch[1] : '';
        
        // Construimos las URLs perfectas según la documentación de VDO Ninja
        const guestUrl = roomId ? `https://vdo.ninja/alpha/?room=${roomId}` : (session.viewer_url || '');
        const obsUrl = roomId ? `https://vdo.ninja/alpha/?scene=0&showlabels=0&room=${roomId}&layout&whepshare=https://use1.meshcast.io/whep/${roomId}&cleanoutput` : (session.scene_url || '');

        if (directorUrl) {
            btnMixer.disabled = false;
            btnMixer.onclick = () => window.open(directorUrl, '_blank');
        }

        this.setupCopyButton('btn-copy-director', directorUrl, "URL de Director no disponible");
        this.setupCopyButton('btn-copy-guest', guestUrl, "URL de Invitado no disponible");
        this.setupCopyButton('btn-copy-obs', obsUrl, "URL de Escena no disponible");

        // Lógica del Iframe IRL (Cámara integrada independiente)
        const btnActivateCamera = document.getElementById('btn-activate-camera');
        const selfCameraWrapper = document.getElementById('self-camera-wrapper');
        const selfCameraIframe = document.getElementById('self-camera-iframe');

        if (btnActivateCamera) {
            btnActivateCamera.onclick = () => {
                if (selfCameraWrapper.classList.contains('hidden')) {
                    if (guestUrl) {
                        selfCameraIframe.src = guestUrl;
                        selfCameraWrapper.classList.remove('hidden');
                        btnActivateCamera.innerHTML = '<i class="fa-solid fa-video-slash"></i> Apagar mi cámara';
                        btnActivateCamera.className = 'btn-action btn-red';
                    } else {
                        alert('El enlace de invitado no está disponible en esta sesión.');
                    }
                } else {
                    selfCameraIframe.src = '';
                    selfCameraWrapper.classList.add('hidden');
                    btnActivateCamera.innerHTML = '<i class="fa-solid fa-video"></i> Entrar a la transmisión';
                    btnActivateCamera.className = 'btn-action btn-green';
                }
            };
        }

        // 2. Cargar el Monitor de Retorno (Solo visual)
        const monitorWrapper = document.getElementById('monitor-wrapper');
        const monitorIframe = document.getElementById('monitor-iframe');
        
        if (session.platform === 'youtube' && session.platform_id && !session.platform_id.includes('http')) {
            monitorWrapper.style.display = 'flex';
            monitorIframe.src = `https://www.youtube.com/embed/${session.platform_id}?autoplay=1&mute=1`;
        } else if (session.platform === 'twitch' && session.platform_id) {
            monitorWrapper.style.display = 'flex';
            monitorIframe.src = `https://player.twitch.tv/?channel=${session.platform_id}&parent=${window.location.hostname || 'localhost'}&muted=true`;
        }

        // 3. Inicializar resto de sistemas
        this.updateStreamControlsUI(session.status);

        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', user.id).single();
            this.userProfile = profile;
        }

        this.setupRealtimeChat();
        
        this.pollCounts = {};
        await this.setupPollSystem();

        // Control On/Off Chat
        this.sessionData.is_chat_active = session.is_chat_active !== false;
        const btnToggleChat = document.getElementById('btn-toggle-chat');
        if (btnToggleChat) {
            btnToggleChat.innerHTML = this.sessionData.is_chat_active ? '<i class="fa-solid fa-toggle-on"></i>' : '<i class="fa-solid fa-toggle-off"></i>';
            btnToggleChat.style.color = this.sessionData.is_chat_active ? '#10b981' : '#ef4444';
            
            btnToggleChat.onclick = async () => {
                const newState = !this.sessionData.is_chat_active;
                btnToggleChat.disabled = true;
                await this.supabase.from('sessions').update({ is_chat_active: newState }).eq('id', this.sessionId);
                this.sessionData.is_chat_active = newState;
                btnToggleChat.innerHTML = newState ? '<i class="fa-solid fa-toggle-on"></i>' : '<i class="fa-solid fa-toggle-off"></i>';
                btnToggleChat.style.color = newState ? '#10b981' : '#ef4444';
                btnToggleChat.disabled = false;
            };
        }

        // Cargar Ágora
        this.loadBlueskyComments();
        document.getElementById('btn-refresh-bsky').onclick = () => this.loadBlueskyComments();

        this.setupEventListeners();
    },

    setupCopyButton(btnId, valueToCopy, errorMsg) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.onclick = () => {
            if (!valueToCopy) { alert(errorMsg); return; }
            navigator.clipboard.writeText(valueToCopy);
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            btn.style.color = '#10b981';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
                btn.style.color = '';
            }, 2000);
        };
    },

    updateStreamControlsUI(status) {
        const btnAction = document.getElementById('btn-stream-action');
        const badge = document.getElementById('live-status-badge');

        btnAction.className = ''; badge.className = 'status-badge';

        if (status === 'PROGRAMADO' || !status) {
            badge.classList.add('status-waiting');
            badge.innerHTML = '<i class="fa-solid fa-clock"></i> En Espera';
            btnAction.className = 'btn-start-stream';
            btnAction.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Transmisión Pública';
            btnAction.disabled = false;
            btnAction.onclick = () => this.startBroadcast();
        } else if (status === 'EN VIVO' || status === 'EN_VIVO') {
            badge.classList.add('status-live');
            badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EN VIVO';
            btnAction.className = 'btn-stop-stream';
            btnAction.innerHTML = '<i class="fa-solid fa-stop"></i> Finalizar Transmisión';
            btnAction.disabled = false;
            btnAction.onclick = () => this.stopBroadcast();
        } else if (status === 'FINALIZADO') {
            badge.classList.add('status-ended');
            badge.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Evento Finalizado';
            btnAction.className = 'btn-ended';
            btnAction.innerHTML = '<i class="fa-solid fa-lock"></i> Transmisión Cerrada';
            btnAction.disabled = true;
            btnAction.onclick = null;
        }
    },

    async startBroadcast() {
        if (!confirm("¿Seguro que deseas INICIAR la transmisión pública?")) return;
        const btn = document.getElementById('btn-stream-action');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        btn.disabled = true;

        const { error } = await this.supabase.from('sessions').update({ status: 'EN VIVO' }).eq('id', this.sessionId);
        if (error) { alert("Error al iniciar: " + error.message); this.updateStreamControlsUI('PROGRAMADO'); return; }

        this.sessionData.status = 'EN VIVO';
        this.updateStreamControlsUI('EN VIVO');
        if (this.realtimeChannel) this.realtimeChannel.send({ type: 'broadcast', event: 'stream_status_changed', payload: { status: 'EN VIVO' } });
    },

    async stopBroadcast() {
        if (!confirm("🚨 PELIGRO: ¿Seguro que deseas FINALIZAR la transmisión de forma permanente?")) return;
        const btn = document.getElementById('btn-stream-action');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finalizando...';
        btn.disabled = true;

        try {
            const { error } = await this.supabase.from('sessions').update({ status: 'FINALIZADO' }).eq('id', this.sessionId);
            if (error) throw error;

            if (this.sessionData.platform === 'youtube' && this.sessionData.platform_id && !this.sessionData.platform_id.includes('http')) {
                await this.supabase.functions.invoke('stop-youtube-live', { body: { broadcastId: this.sessionData.platform_id } });
            }

            this.sessionData.status = 'FINALIZADO';
            this.updateStreamControlsUI('FINALIZADO');
            if (this.realtimeChannel) this.realtimeChannel.send({ type: 'broadcast', event: 'stream_status_changed', payload: { status: 'FINALIZADO' } });
        } catch (err) {
            alert("Error al finalizar: " + err.message);
            this.updateStreamControlsUI('EN VIVO');
        }
    },

    async setupRealtimeChat() {
        const { data: pastMessages } = await this.supabase
            .from('live_chat_messages').select('*').eq('session_id', this.sessionId).order('created_at', { ascending: true }).limit(100);
        if (pastMessages) pastMessages.forEach(msg => this.renderIncomingMessage(msg));

        this.realtimeChannel = this.supabase.channel(`room_${this.sessionId}`, {
            config: { presence: { key: this.userProfile?.id || 'director' } }
        });

        this.realtimeChannel
            .on('presence', { event: 'sync' }, () => {
                const state = this.realtimeChannel.presenceState();
                const counterEl = document.getElementById('control-viewer-count');
                if (counterEl) counterEl.innerHTML = `<i class="fa-solid fa-eye"></i> ${Object.keys(state).length}`;
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages' }, (payload) => {
                if (payload.new.session_id == this.sessionId) this.renderIncomingMessage(payload.new);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat_messages' }, (payload) => {
                const msgEl = document.getElementById(`ctrl-msg-${payload.old.id}`);
                if (msgEl) msgEl.remove();
            })
            // NUEVO: Escuchar nuevos comentarios de Bluesky y auto-actualizar
            .on('broadcast', { event: 'new_chat_message' }, () => {
                this.loadBlueskyComments(); // Refresca silenciosamente
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const loaderMsg = document.querySelector('.chat-system-msg');
                    if (loaderMsg) loaderMsg.remove();
                    await this.realtimeChannel.track({ user: 'Director', online_at: new Date().toISOString() });
                }
            });
    },

    async sendMessage() {
        const input = document.getElementById('control-chat-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        const displayName = `👑 ${this.userProfile?.display_name || 'Director'}`;
        let videoTime = null;
        if (this.sessionData.status === 'EN VIVO' || this.sessionData.status === 'EN_VIVO') {
            const diff = Math.max(0, Math.floor((new Date().getTime() - new Date(this.sessionData.scheduled_at).getTime()) / 1000));
            videoTime = `${Math.floor(diff / 3600).toString().padStart(2, '0')}:${Math.floor((diff % 3600) / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
        }

        await this.supabase.from('live_chat_messages').insert([{
            session_id: this.sessionId, user_name: displayName, user_avatar: this.userProfile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            message: text, is_director: true, video_timestamp: videoTime
        }]);
    },

    renderIncomingMessage(msg) {
        const feed = document.getElementById('control-chat-feed');
        if (!feed) return;

        const isDir = msg.is_director ? 'is-director' : '';
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const modControls = `
            <div style="margin-left: auto; display:flex; gap: 10px;">
                <button onclick="ControlRoom.promoteToBluesky('${msg.id}', '${msg.user_name}', \`${msg.message.replace(/'/g, "\\'")}\`, '${msg.video_timestamp || 'En Vivo'}')" title="Enviar a Bluesky" style="background:transparent; border:none; color:#38bdf8; cursor:pointer; font-size:0.95rem; transition:0.2s;"><i class="fa-brands fa-bluesky"></i></button>
                <button onclick="ControlRoom.deleteChatMessage('${msg.id}')" title="Borrar mensaje" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:0.95rem; transition:0.2s;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        const msgHtml = `
            <div id="ctrl-msg-${msg.id}" class="chat-msg" style="display:flex; flex-direction:column;">
                <div class="chat-msg-header" style="display:flex; width:100%; align-items:center;">
                    <span class="chat-msg-author ${isDir}">${msg.user_name}</span>
                    <span class="chat-msg-time">${timeStr}</span>
                    ${modControls}
                </div>
                <p class="chat-msg-text" style="margin-top:5px;">${msg.message}</p>
            </div>
        `;
        feed.insertAdjacentHTML('beforeend', msgHtml);
        feed.scrollTop = feed.scrollHeight; 
    },

    async deleteChatMessage(messageId) {
        if (!confirm("🚨 ¿Borrar este mensaje de todas las pantallas?")) return;
        try { await this.supabase.from('live_chat_messages').delete().eq('id', messageId); } catch (e) { console.error("Error borrando:", e); }
    },

    async promoteToBluesky(messageId, authorName, text, timestamp) {
        if (!confirm(`¿Enviar el aporte a Bluesky?`)) return;
        const btn = document.querySelector(`#ctrl-msg-${messageId} .fa-bluesky`);
        if(btn) { btn.className = 'fa-solid fa-spinner fa-spin'; }

        try {
            let shortName = authorName.replace('👑', '').replace('(Organizador)', '').trim().split(' ')[0];
            if (shortName.length > 10) shortName = shortName.substring(0, 10);

            const timeBadge = (timestamp && timestamp !== 'En Vivo') ? ` [${timestamp}]` : '';
            const formattedText = `🎙️: "${text}"\n— ${shortName}${timeBadge}`;
            
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: { replyText: formattedText, parentPost: { uri: this.sessionData.bsky_chat_thread_uri, cid: this.sessionData.bsky_chat_thread_cid } }
            });
            if (error) throw error;
            if(btn) { btn.className = 'fa-solid fa-check'; btn.style.color = '#10b981'; }
        } catch (error) {
            if(btn) { btn.className = 'fa-brands fa-bluesky'; }
            alert("Error al enviar a Bluesky."); 
        }
    },

    // --- NUEVO: MONITOR DEL ÁGORA BLUESKY ---
    async loadBlueskyComments() {
        const feed = document.getElementById('bsky-monitor-feed');
        if (!feed || !this.sessionData.bsky_chat_thread_uri) {
            if(feed) feed.innerHTML = '<p class="text-muted text-center" style="font-size:0.85rem; margin-top:20px;">No hay hilo vinculado.</p>';
            return;
        }

        try {
            const { data: chatData, error } = await this.supabase.functions.invoke('bsky-get-post-thread', { 
                body: { postUri: this.sessionData.bsky_chat_thread_uri } 
            });
            if (error) throw error;
            
            feed.innerHTML = '';

            // Función renderizadora con escudos anti-errores
            const renderMsg = (msg, isAnchor) => {
                if(!msg || !msg.author) return;
                
                const record = msg.record || {};
                const text = record.text || ''; // Escudo por si el post no tiene texto
                const dateVal = record.createdAt || msg.indexedAt;
                const dateStr = dateVal ? new Date(dateVal).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
                
                const anchorStyle = isAnchor ? 'border-left: 3px solid #38bdf8; background: rgba(56, 189, 248, 0.05);' : '';
                const anchorBadge = isAnchor ? '<span style="background:#38bdf8; color:#0f172a; font-size:0.6rem; padding:2px 4px; border-radius:4px; margin-left:5px;"><i class="fa-solid fa-thumbtack"></i></span>' : '';
                
                feed.insertAdjacentHTML('beforeend', `
                    <div class="bsky-comment" style="${anchorStyle}">
                        <img src="${msg.author.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}">
                        <div class="bsky-comment-body">
                            <span class="bsky-author">${msg.author.displayName || msg.author.handle} ${anchorBadge} <span style="font-weight:normal; font-size:0.75rem; color:#94a3b8; margin-left:5px;">${dateStr}</span></span>
                            <p class="bsky-text" style="margin-top: 5px; font-size: 0.9rem;">${text.replace(/\n/g, '<br>')}</p>
                        </div>
                    </div>
                `);
            };

            // Dibujamos el primer post
            if (chatData.anchorPost) {
                renderMsg(chatData.anchorPost, true);
            }

            if (!chatData.messages || chatData.messages.length === 0) {
                feed.insertAdjacentHTML('beforeend', '<p class="text-muted text-center" style="font-size:0.85rem; margin-top:20px;">Sin respuestas aún.</p>');
                return;
            }

            // Dibujamos los comentarios
            const sortedMessages = [...chatData.messages].reverse();
            sortedMessages.forEach(msg => renderMsg(msg, false));

        } catch (error) {
            console.error("Error cargando Bsky:", error);
            feed.innerHTML = '<p class="text-muted text-center" style="color:#ef4444; font-size:0.85rem;">Error al cargar comentarios.</p>';
        }
    },

    setupEventListeners() {
        const sendBtn = document.getElementById('btn-send-control-chat');
        const chatInput = document.getElementById('control-chat-input');
        const emojiBtn = document.getElementById('btn-emoji-control');
        const emojiPickerContainer = document.getElementById('emoji-picker-container-control');

        sendBtn.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });

        emojiBtn.addEventListener('click', () => { emojiPickerContainer.classList.toggle('hidden'); });
        document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
            chatInput.value += event.detail.unicode;
            emojiPickerContainer.classList.add('hidden');
            chatInput.focus();
        });
    },

    async setupPollSystem() {
        const pollToggleBtn = document.getElementById('poll-toggle-btn');
        const pollContent = document.getElementById('poll-collapsible-content');
        const pollChevron = document.getElementById('poll-chevron');

        pollToggleBtn.addEventListener('click', () => {
            pollContent.classList.toggle('hidden');
            pollChevron.style.transform = pollContent.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        });
        
        const btnLaunch = document.getElementById('btn-launch-poll');
        const btnClose = document.getElementById('btn-close-poll');
        
        const { data: votes } = await this.supabase.from('poll_votes').select('emoji').eq('session_id', this.sessionId);
        if (votes) votes.forEach(v => { this.pollCounts[v.emoji] = (this.pollCounts[v.emoji] || 0) + 1; });

        this.renderPollControlUI(this.sessionData.poll_status, this.sessionData.active_emojis);

        btnLaunch.addEventListener('click', async () => {
            const rawInput = document.getElementById('poll-emojis-input').value;
            const questionInput = document.getElementById('poll-question-input')?.value.trim() || ''; 
            const emojis = rawInput.split(',').map(e => e.trim()).filter(e => e).slice(0, 4);
            if (emojis.length === 0) { alert("Ingresa al menos 1 emoji."); return; }

            btnLaunch.disabled = true; btnLaunch.innerHTML = "Iniciando...";
            await this.supabase.from('sessions').update({ poll_status: 'abierto', active_emojis: emojis, poll_question: questionInput }).eq('id', this.sessionId);
            this.renderPollControlUI('abierto', emojis);
        });

        btnClose.addEventListener('click', async () => {
            btnClose.disabled = true;
            await this.supabase.from('sessions').update({ poll_status: 'cerrado' }).eq('id', this.sessionId);
            this.renderPollControlUI('cerrado', []);
        });

        this.supabase.channel('control-poll-votes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `session_id=eq.${this.sessionId}` }, (payload) => {
                const emoji = payload.new.emoji;
                this.pollCounts[emoji] = (this.pollCounts[emoji] || 0) + 1;
                this.updatePollCountersUI(this.sessionData.active_emojis);
            }).subscribe();
    },

    renderPollControlUI(status, emojis) {
        this.sessionData.poll_status = status;
        this.sessionData.active_emojis = emojis || [];
        
        const setupArea = document.getElementById('poll-setup-area');
        const resultsArea = document.getElementById('poll-results-area');
        const indicator = document.getElementById('poll-status-indicator');
        const btnLaunch = document.getElementById('btn-launch-poll');
        const btnClose = document.getElementById('btn-close-poll');

        if (status === 'abierto') {
            setupArea.classList.add('hidden'); resultsArea.classList.remove('hidden');
            indicator.className = 'badge-mini status-live'; indicator.innerHTML = 'Activa';
            this.updatePollCountersUI(emojis);
        } else {
            setupArea.classList.remove('hidden'); resultsArea.classList.add('hidden');
            indicator.className = 'badge-mini status-waiting'; indicator.innerHTML = 'Cerrada';
            btnLaunch.disabled = false; btnLaunch.innerHTML = '<i class="fa-solid fa-bolt"></i> Iniciar Encuesta';
        }
        btnClose.disabled = false;
    },

    updatePollCountersUI(activeEmojis) {
        const container = document.getElementById('poll-counters');
        if (!container) return;
        container.innerHTML = activeEmojis.map(emj => `
            <div class="poll-counter-item"><span class="poll-counter-emoji">${emj}</span><span class="poll-counter-value">${this.pollCounts[emj] || 0}</span></div>
        `).join('');
    }
};

window.ControlRoom = ControlRoom;
document.addEventListener('DOMContentLoaded', () => ControlRoom.init());