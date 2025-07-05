const ControlRoom = {
    supabase: null,
    sessionId: null,
    sessionData: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const params = new URLSearchParams(window.location.search);
        this.sessionId = params.get('id');

        if (!this.sessionId) {
            document.body.innerHTML = '<h1>Error: No se encontró el ID de la sesión.</h1>';
            return;
        }

        this.fetchAndRenderSession();
    },

    async fetchAndRenderSession() {
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('id', this.sessionId)
            .single();

        if (error || !data) {
            document.body.innerHTML = '<h1>Error: No se pudo cargar la sesión.</h1>';
            return;
        }

        this.sessionData = data;
        document.getElementById('session-title-header').textContent = this.sessionData.session_title;
        document.getElementById('mixer-iframe').src = this.sessionData.director_url;
        
        this.renderControls();
    },

    renderControls() {
        const container = document.getElementById('session-controls');
        const { status, platform, platform_id } = this.sessionData;
        let controlsHTML = '';

        if (status === 'EN VIVO') {
            controlsHTML = `<button class="btn-primary is-live" onclick="ControlRoom.endLiveStream()"><i class="fa-solid fa-stop-circle"></i> Terminar Directo</button>`;
        } else { // PROGRAMADO
            const isExternal = platform === 'youtube' || platform === 'substack';
            const canGoLive = !isExternal || (isExternal && platform_id);
            if (canGoLive) {
                controlsHTML = `<button class="btn-primary" onclick="ControlRoom.goLive()"><i class="fa-solid fa-tower-broadcast"></i> Iniciar Directo</button>`;
            } else {
                controlsHTML = `<button class="btn-primary" disabled title="Añade el ID de la plataforma en el dashboard para activar">Iniciar Directo</button>`;
            }
        }
        container.innerHTML = controlsHTML;
    },

    async goLive() {
        const { error } = await this.supabase
            .from('sessions')
            .update({ status: 'EN VIVO', scheduled_at: new Date().toISOString() })
            .eq('id', this.sessionId);
        
        if (error) {
            alert('Hubo un error al iniciar la transmisión.');
        } else {
            alert('¡Transmisión iniciada!');
            this.fetchAndRenderSession(); // Refresca los controles
        }
    },

    async endLiveStream() {
        if (!confirm("¿Estás seguro de que quieres finalizar la transmisión pública?")) return;

        const { error } = await this.supabase
            .from('sessions')
            .update({ status: 'FINALIZADO', end_at: new Date().toISOString() })
            .eq('id', this.sessionId);

        if (error) {
            alert('Hubo un error al finalizar la transmisión.');
            console.error(error); // Mostramos el error real en consola
        } else {
            alert('La transmisión pública ha finalizado.');
            this.fetchAndRenderSession(); // Refresca los controles
        }
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());