const ControlRoomV2 = {
    supabase: null, sessionId: null, sessionData: null, userProfile: null, realtimeChannel: null, pollCounts: {},

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        this.sessionId = new URLSearchParams(window.location.search).get('id');

        if (!this.sessionId) return;
        this.buildSlotsUI(); 
        this.setupNavigation();
        this.loadClassicRoom();
        this.fetchSessionData();
    },

    buildSlotsUI() {
        const container = document.getElementById('slots-container');
        let html = '';
        for (let i = 1; i <= 10; i++) {
            const isMedia = i === 10;
            const title = isMedia ? 'Caja 10 (Media/PPT)' : `Caja ${i}`;
            const icon = isMedia ? 'fa-desktop' : 'fa-video';
            const color = isMedia ? '#38bdf8' : '#94a3b8';
            const border = isMedia ? 'border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.05);' : '';
            
            html += `
            <div class="talent-slot-card" style="${border}">
                <div class="slot-card-header">
                    <h5 style="color:${color}; margin:0; font-size:0.8rem;"><i class="fa-solid ${icon}"></i> ${title}</h5>
                    <button class="toggle-visibility btn-visibility" data-slot="${i}" title="Al Aire / Standby"><i class="fa-solid fa-eye-slash"></i></button>
                </div>
                <input type="text" class="input-slot-url" data-slot="${i}" placeholder="URL (VDO/YouTube)">
                <input type="text" class="input-slot-label" data-slot="${i}" placeholder="Rótulo / Nombre">
                <div style="display: flex; gap: 4px; margin-top: 2px;">
                    <button class="toggle-fit active btn-slot-setting" data-slot="${i}" data-fit="cover" title="Rellenar sin bordes">Cover</button>
                    <button class="toggle-fit btn-slot-setting" data-slot="${i}" data-fit="contain" title="Mostrar video original">Orig</button>
                    <button class="toggle-label active btn-slot-setting" data-slot="${i}" title="Mostrar Rótulo"><i class="fa-solid fa-tag"></i></button>
                </div>
            </div>`;
        }
        container.innerHTML = html;
    },

    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-icon-btn');
        const pages = document.querySelectorAll('.v2-tab-page');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                pages.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });
    },

    loadClassicRoom() {
        document.getElementById('classic-room-iframe').src = `/inv/sala-de-control.html?id=${this.sessionId}`;
        const monitorUrl = `${window.location.protocol}//${window.location.host}/escenario.html?id=${this.sessionId}`;
        document.getElementById('studio-monitor-iframe').src = monitorUrl;
        
        document.getElementById('btn-copy-obs-link').addEventListener('click', (e) => {
            navigator.clipboard.writeText(monitorUrl);
            e.currentTarget.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
            setTimeout(() => e.currentTarget.innerHTML = '<i class="fa-solid fa-link"></i> Link OBS', 2000);
        });
    },

    async fetchSessionData() {
        const { data } = await this.supabase.from('sessions').select('*').eq('id', this.sessionId).single();
        if (!data) return;
        this.sessionData = data;
        
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', user.id).single();
            this.userProfile = profile;
        }

        if (data.director_url) document.getElementById('vdo-director-iframe').src = data.director_url.replace('/mixer', '/');
        
        const mw = document.getElementById('monitor-wrapper');
        const mi = document.getElementById('monitor-iframe');
        if (data.platform === 'youtube' && data.platform_id && !data.platform_id.includes('http')) {
            mw.style.display = 'block'; mi.src = `https://www.youtube.com/embed/${data.platform_id}?autoplay=1&mute=1`;
        } else if (data.platform === 'twitch' && data.platform_id) {
            mw.style.display = 'block'; mi.src = `https://player.twitch.tv/?channel=${data.platform_id}&parent=${window.location.hostname}&muted=true`;
        }

        this.syncUIWithData();
        this.setupStudioControls();
        this.setupRealtimeChat();
        this.setupPollSystem();
    },

    syncUIWithData() {
        // Restaurar Layout visual en la botonera
        const savedLayout = this.sessionData.active_layout || 'mosaico';
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.layout === savedLayout);
        });

        // Restaurar 10 Slots
        const slotsData = this.sessionData.mixer_slots || [];
        for (let i = 1; i <= 10; i++) {
            const config = slotsData.find(s => s.id === i);
            if (config) {
                document.querySelector(`.input-slot-url[data-slot="${i}"]`).value = config.url || '';
                document.querySelector(`.input-slot-label[data-slot="${i}"]`).value = config.label || '';
                document.querySelector(`.toggle-label[data-slot="${i}"]`).classList.toggle('active', config.showLabel);
                
                const visBtn = document.querySelector(`.toggle-visibility[data-slot="${i}"]`);
                const isVis = config.isVisible !== false; 
                visBtn.classList.toggle('active', isVis);
                visBtn.innerHTML = isVis ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';

                if (config.fit) {
                    document.querySelectorAll(`.toggle-fit[data-slot="${i}"]`).forEach(b => b.classList.remove('active'));
                    document.querySelector(`.toggle-fit[data-slot="${i}"][data-fit="${config.fit}"]`)?.classList.add('active');
                }
            }
        }
    },

    setupStudioControls() {
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await this.supabase.from('sessions').update({ active_layout: btn.dataset.layout }).eq('id', this.sessionId);
            });
        });

        document.querySelectorAll('.input-slot-url, .input-slot-label').forEach(input => {
            input.addEventListener('change', () => this.saveAllSlotsToDB());
        });

        document.querySelectorAll('.toggle-label').forEach(btn => {
            btn.addEventListener('click', () => { btn.classList.toggle('active'); this.saveAllSlotsToDB(); });
        });

        document.querySelectorAll('.toggle-visibility').forEach(btn => {
            btn.addEventListener('click', () => { 
                const isActive = btn.classList.toggle('active');
                btn.innerHTML = isActive ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
                this.saveAllSlotsToDB(); 
            });
        });

        document.querySelectorAll('.toggle-fit').forEach(btn => {
            btn.addEventListener('click', () => {
                const slot = btn.dataset.slot;
                document.querySelectorAll(`.toggle-fit[data-slot="${slot}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active'); 
                this.saveAllSlotsToDB();
            });
        });
    },

    async saveAllSlotsToDB() {
        const slotsArray = [];
        for (let i = 1; i <= 10; i++) {
            let urlValue = document.querySelector(`.input-slot-url[data-slot="${i}"]`).value.trim();
            
            // CONVERTIDOR AUTOMÁTICO DE YOUTUBE (Con Mute y Autoplay requerido)
            if (urlValue !== '') {
                if (urlValue.includes('youtube.com/watch?v=')) {
                    const vidId = new URL(urlValue).searchParams.get('v');
                    urlValue = `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&controls=1`;
                } else if (urlValue.includes('youtu.be/')) {
                    const vidId = urlValue.split('youtu.be/')[1].split('?')[0];
                    urlValue = `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&controls=1`;
                }

                slotsArray.push({ 
                    id: i, url: urlValue, 
                    label: document.querySelector(`.input-slot-label[data-slot="${i}"]`).value.trim(), 
                    showLabel: document.querySelector(`.toggle-label[data-slot="${i}"]`).classList.contains('active'), 
                    fit: document.querySelector(`.toggle-fit.active[data-slot="${i}"]`)?.dataset.fit || 'cover',
                    isVisible: document.querySelector(`.toggle-visibility[data-slot="${i}"]`).classList.contains('active')
                });
            }
        }
        await this.supabase.from('sessions').update({ mixer_slots: slotsArray }).eq('id', this.sessionId);
    },

    // --- CHAT Y ENCUESTAS ---
    async setupRealtimeChat() {
        const { data } = await this.supabase.from('live_chat_messages').select('*').eq('session_id', this.sessionId).order('created_at', { ascending: true }).limit(100);
        if (data) data.forEach(msg => this.renderIncomingMessage(msg));

        this.realtimeChannel = this.supabase.channel(`room_${this.sessionId}`);
        this.realtimeChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `session_id=eq.${this.sessionId}` }, (payload) => this.renderIncomingMessage(payload.new))
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat_messages' }, (payload) => document.getElementById(`ctrl-msg-${payload.old.id}`)?.remove())
            .subscribe();

        document.getElementById('btn-send-control-chat').addEventListener('click', () => this.sendMessage());
        document.getElementById('control-chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendMessage(); });
    },

    async sendMessage() {
        const input = document.getElementById('control-chat-input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        await this.supabase.from('live_chat_messages').insert([{ session_id: this.sessionId, user_name: `👑 ${this.userProfile?.display_name || 'Director'}`, user_avatar: this.userProfile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png', message: text, is_director: true }]);
    },

    renderIncomingMessage(msg) {
        const feed = document.getElementById('control-chat-feed');
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const msgHtml = `<div id="ctrl-msg-${msg.id}" style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #334155;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span style="color:#10b981; font-weight:bold; font-size:0.85rem;">${msg.user_name}</span> <span style="color:#64748b; font-size:0.75rem;">${timeStr}</span></div>
                <p style="margin:0; font-size:0.9rem; color: #f8fafc; word-break: break-word;">${msg.message}</p>
            </div>`;
        feed.insertAdjacentHTML('beforeend', msgHtml);
        feed.scrollTop = feed.scrollHeight; 
    },

    async setupPollSystem() {
        document.getElementById('poll-toggle-btn').addEventListener('click', () => {
            const content = document.getElementById('poll-collapsible-content');
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
        });
        const { data: votes } = await this.supabase.from('poll_votes').select('emoji').eq('session_id', this.sessionId);
        if (votes) votes.forEach(v => { this.pollCounts[v.emoji] = (this.pollCounts[v.emoji] || 0) + 1; });

        this.renderPollControlUI(this.sessionData.poll_status, this.sessionData.active_emojis);

        document.getElementById('btn-launch-poll')?.addEventListener('click', async () => {
            const emojis = document.getElementById('poll-emojis-input').value.split(',').map(e => e.trim()).filter(e => e).slice(0, 4);
            if (emojis.length === 0) return alert("Ingresa emojis.");
            await this.supabase.from('sessions').update({ poll_status: 'abierto', active_emojis: emojis, poll_question: document.getElementById('poll-question-input')?.value.trim() }).eq('id', this.sessionId);
            this.renderPollControlUI('abierto', emojis);
        });

        document.getElementById('btn-close-poll')?.addEventListener('click', async () => {
            await this.supabase.from('sessions').update({ poll_status: 'cerrado' }).eq('id', this.sessionId);
            this.renderPollControlUI('cerrado', []);
        });

        this.supabase.channel('control-poll-votes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `session_id=eq.${this.sessionId}` }, (payload) => {
            const emoji = payload.new.emoji; this.pollCounts[emoji] = (this.pollCounts[emoji] || 0) + 1;
            this.updatePollCountersUI(this.sessionData.active_emojis);
        }).subscribe();
    },

    renderPollControlUI(status, emojis) {
        this.sessionData.poll_status = status; this.sessionData.active_emojis = emojis || [];
        if (status === 'abierto') {
            document.getElementById('poll-setup-area').style.display = 'none'; document.getElementById('poll-results-area').classList.remove('hidden');
            document.getElementById('poll-status-indicator').innerHTML = 'Activa'; document.getElementById('poll-status-indicator').style.color = '#ef4444';
            this.updatePollCountersUI(emojis);
        } else {
            document.getElementById('poll-setup-area').style.display = 'block'; document.getElementById('poll-results-area').classList.add('hidden');
            document.getElementById('poll-status-indicator').innerHTML = 'Cerrada'; document.getElementById('poll-status-indicator').style.color = '#94a3b8';
        }
    },

    updatePollCountersUI(activeEmojis) {
        const container = document.getElementById('poll-counters');
        if (!container) return;
        container.style.display = 'flex'; container.style.gap = '10px';
        container.innerHTML = activeEmojis.map(emj => `<div style="background:#0f172a; padding:10px; border-radius:8px; text-align:center; flex:1;"><span style="font-size:1.5rem; display:block;">${emj}</span><span style="font-size:1.2rem; font-weight:bold; color:#38bdf8;">${this.pollCounts[emj] || 0}</span></div>`).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoomV2.init());