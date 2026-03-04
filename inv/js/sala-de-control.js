// /inv/js/sala-de-control.js
const ControlRoom = {
    supabase: null,
    sessionId: null,
    sessionData: null,
    iframe: null,
    realtimeChannel: null,
    userProfile: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const params = new URLSearchParams(window.location.search);
        this.sessionId = params.get('id');
        this.iframe = document.getElementById('mixer-iframe');

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

        // 1. Cargar SIEMPRE el VDO Mixer en el panel izquierdo (El lienzo de trabajo)
        if (session.director_url) {
            this.iframe.src = session.director_url;
        } else {
            this.iframe.src = 'about:blank';
            this.iframe.style.background = '#000 url("https://placehold.co/1280x720/000000/38bdf8?text=Esperando+Señal...") center / contain no-repeat';
        }

        // 2. Cargar el Monitor de YouTube en la columna derecha (Arriba del chat)
        const monitorContainer = document.getElementById('monitor-container');
        const monitorIframe = document.getElementById('monitor-iframe');
        
        if (session.platform === 'youtube' && session.platform_id && !session.platform_id.includes('http')) {
            monitorContainer.style.display = 'block';
            monitorIframe.src = `https://www.youtube.com/embed/${session.platform_id}?autoplay=1&mute=1`;
        } else {
            monitorContainer.style.display = 'none';
        }

        // Actualizar la interfaz (Green Room)
        this.updateStreamControlsUI(session.status);

        // Cargar perfil y chat
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', user.id).single();
            this.userProfile = profile;
        }

        this.setupRealtimeChat();
        this.setupEventListeners();
    },

    updateStreamControlsUI(status) {
        const btnAction = document.getElementById('btn-stream-action');
        const badge = document.getElementById('live-status-badge');

        // Limpiamos clases previas
        btnAction.className = ''; badge.className = 'status-badge';

        if (status === 'PROGRAMADO' || !status) {
            badge.classList.add('status-waiting');
            badge.innerHTML = '<i class="fa-solid fa-clock"></i> En Espera';
            btnAction.className = 'btn-start-stream';
            btnAction.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Transmisión Pública';
            btnAction.disabled = false;
            btnAction.onclick = () => this.startBroadcast();
        } else if (status === 'EN_VIVO') {
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
        if (!confirm("¿Seguro que deseas INICIAR la transmisión pública? Esto abrirá el telón en el Ágora para que los espectadores comiencen a ver el evento.")) return;

        const btn = document.getElementById('btn-stream-action');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        btn.disabled = true;

        const { error } = await this.supabase.from('sessions').update({ status: 'EN_VIVO' }).eq('id', this.sessionId);
        
        if (error) {
            alert("Error al iniciar: " + error.message);
            this.updateStreamControlsUI('PROGRAMADO');
            return;
        }

        this.sessionData.status = 'EN_VIVO';
        this.updateStreamControlsUI('EN_VIVO');

        // Avisar a todas las salas públicas que el evento empezó
        if (this.realtimeChannel) {
            this.realtimeChannel.send({ type: 'broadcast', event: 'stream_status_changed', payload: { status: 'EN_VIVO' } });
        }
    },

    async stopBroadcast() {
        if (!confirm("🚨 PELIGRO: ¿Seguro que deseas FINALIZAR la transmisión? Esto cortará la señal permanentemente y cerrará el evento para todos los espectadores.")) return;

        const btn = document.getElementById('btn-stream-action');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finalizando Evento...';
        btn.disabled = true;

        try {
            // 1. Cambiamos estado en Base de Datos
            const { error } = await this.supabase.from('sessions').update({ status: 'FINALIZADO' }).eq('id', this.sessionId);
            if (error) throw error;

            // 2. Si es de YouTube API, enviamos el misil para cortarlo de raíz
            if (this.sessionData.platform === 'youtube' && this.sessionData.platform_id && !this.sessionData.platform_id.includes('http')) {
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cortando señal en YouTube...';
                
                const { error: fnError } = await this.supabase.functions.invoke('stop-youtube-live', {
                    body: { broadcastId: this.sessionData.platform_id }
                });
                
                if (fnError) console.error("Aviso: Error al intentar detener YouTube remotamente.", fnError);
            }

            this.sessionData.status = 'FINALIZADO';
            this.updateStreamControlsUI('FINALIZADO');

            // 3. Avisar a las salas públicas que se acabó la fiesta
            if (this.realtimeChannel) {
                this.realtimeChannel.send({ type: 'broadcast', event: 'stream_status_changed', payload: { status: 'FINALIZADO' } });
            }

            alert("El evento ha sido finalizado con éxito.");

        } catch (err) {
            alert("Error al finalizar: " + err.message);
            this.updateStreamControlsUI('EN_VIVO');
        }
    },

    setupRealtimeChat() {
        this.realtimeChannel = this.supabase.channel(`room_${this.sessionId}`, {
            config: { presence: { key: this.userProfile?.id || 'director' } }
        });

        this.realtimeChannel
            .on('broadcast', { event: 'chat_message' }, (payload) => this.renderIncomingMessage(payload.payload))
            .on('presence', { event: 'sync' }, () => {
                const state = this.realtimeChannel.presenceState();
                const count = Object.keys(state).length;
                document.getElementById('viewers-count').innerHTML = `<i class="fa-solid fa-users"></i> ${count}`;
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    document.getElementById('control-chat-feed').innerHTML = '<p class="chat-system-msg"><i class="fa-solid fa-link"></i> Conectado al Ágora Pública.</p>';
                    this.realtimeChannel.track({ user: 'Director', online_at: new Date().toISOString() });
                }
            });
    },

    setupEventListeners() {
        const sendBtn = document.getElementById('btn-send-control-chat');
        const chatInput = document.getElementById('control-chat-input');
        const emojiBtn = document.getElementById('btn-emoji-control');
        const emojiPickerContainer = document.getElementById('emoji-picker-container-control');

        sendBtn.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });

        emojiBtn.addEventListener('click', () => {
            const isHidden = emojiPickerContainer.style.display === 'none';
            emojiPickerContainer.style.display = isHidden ? 'block' : 'none';
        });

        document.querySelector('emoji-picker').addEventListener('emoji-click', event => {
            chatInput.value += event.detail.unicode;
            emojiPickerContainer.style.display = 'none';
            chatInput.focus();
        });
    },

    sendMessage() {
        const input = document.getElementById('control-chat-input');
        const text = input.value.trim();
        if (!text) return;

        const displayName = `👑 ${this.userProfile?.display_name || 'Director'} (Organizador)`;

        const messageData = {
            user: displayName,
            avatar: this.userProfile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isDirector: true
        };

        this.realtimeChannel.send({ type: 'broadcast', event: 'chat_message', payload: messageData });
        this.renderIncomingMessage(messageData);
        input.value = '';
    },

    renderIncomingMessage(msg) {
        const feed = document.getElementById('control-chat-feed');
        const isDir = msg.isDirector ? 'is-director' : '';
        const msgHtml = `
            <div class="chat-msg">
                <div class="chat-msg-header">
                    <span class="chat-msg-author ${isDir}">${msg.user}</span>
                    <span class="chat-msg-time">${msg.timestamp}</span>
                </div>
                <p class="chat-msg-text">${msg.text}</p>
            </div>
        `;
        feed.insertAdjacentHTML('beforeend', msgHtml);
        feed.scrollTop = feed.scrollHeight; 
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());