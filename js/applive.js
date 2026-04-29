/**
 * LIVE BAR MANAGER - Epistecnología
 * Detecta sesiones en vivo y muestra una notificación persistente.
 */
const LiveBarManager = {
    bar: null,
    titleEl: null,
    linkEl: null,
    playerEl: null,
    closeBtn: null,
    supabase: null,

    init() {
        // Obtenemos el cliente de Supabase ya inicializado en main.js
        this.supabase = window.supabaseClient;
        if (!this.supabase) return;

        this.bar = document.getElementById('live-announcement-bar');
        this.titleEl = document.getElementById('live-bar-title');
        this.linkEl = document.getElementById('live-bar-link');
        this.playerEl = document.getElementById('live-mini-player');
        this.closeBtn = document.getElementById('close-live-bar');

        this.closeBtn.addEventListener('click', () => this.hideBar());

        // 1. Verificar si hay algo en vivo al cargar
        this.checkCurrentLive();

        // 2. Suscribirse a cambios en tiempo real
        this.setupRealtimeSubscription();
    },

    async checkCurrentLive() {
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('status', 'EN VIVO')
            .eq('is_archived', false)
            .limit(1)
            .single();

        if (data && !error) {
            this.showBar(data);
        }
    },

    setupRealtimeSubscription() {
        this.supabase
            .channel('public:sessions_live_bar')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'sessions' 
            }, (payload) => {
                const session = payload.new;
                
                // Si una sesión pasa a EN VIVO, mostramos la barra
                if (session.status === 'EN VIVO' && !session.is_archived) {
                    this.showBar(session);
                } 
                // Si la sesión que estaba en vivo cambia de estado, la ocultamos
                else if (session.status !== 'EN VIVO') {
                    this.hideBar();
                }
            })
            .subscribe();
    },

    showBar(session) {
        if (!this.bar) return;

        this.titleEl.textContent = session.session_title;
        this.linkEl.href = `/l/${session.id}`;

        // Configurar mini reproductor silencioso
        let embedUrl = "";
        if (session.platform === 'youtube') {
            embedUrl = `https://www.youtube.com/embed/${session.platform_id}?autoplay=1&mute=1&controls=0&modestbranding=1`;
        } else if (session.platform === 'vdo_ninja') {
            embedUrl = `${session.viewer_url}&autoplay=1&mute=1`;
        }

        if (embedUrl) {
            this.playerEl.innerHTML = `<iframe src="${embedUrl}" allow="autoplay"></iframe>`;
        }

        this.bar.classList.remove('hidden');
        // Ajustamos el margen del body o el nav para que no se solapen
        document.body.style.paddingTop = '50px';
    },

    hideBar() {
        if (!this.bar) return;
        this.bar.classList.add('hidden');
        this.playerEl.innerHTML = '';
        document.body.style.paddingTop = '0';
    }
};

// Esperamos a que Supabase esté listo (evento disparado por main.js)
document.addEventListener('mainReady', () => LiveBarManager.init());