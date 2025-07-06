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

    // En /inv/js/sala-de-control.js
    renderControls() {
        const container = document.getElementById('session-controls');
        const { status, platform, platform_id, guest_url } = this.sessionData;
        // URL corregida para apuntar al archivo .html
        const publicLiveUrl = 'https://epistecnologia.com/live/live.html'; 
        let controlsHTML = '';

        if (status === 'EN VIVO') {
            controlsHTML += `<button class="btn-primary is-live" onclick="ControlRoom.endLiveStream()"><i class="fa-solid fa-stop-circle"></i> Terminar Directo</button>`;
        } else { // PROGRAMADO
            const canGoLive = platform === 'vdo_ninja' || platform_id;
            if (canGoLive) {
                controlsHTML += `<button class="btn-primary" onclick="ControlRoom.goLive()"><i class="fa-solid fa-tower-broadcast"></i> Iniciar Directo</button>`;
            } else {
                controlsHTML += `<button class="btn-primary" disabled title="Añade el ID en el dashboard para activar">Iniciar Directo</button>`;
            }
        }
        
        if(guest_url) {
            controlsHTML += `<button class="btn-secondary" onclick="navigator.clipboard.writeText('${guest_url}')"><i class="fa-solid fa-copy"></i> Copiar Invitado</button>`;
        }
        controlsHTML += `<button class="btn-secondary" onclick="navigator.clipboard.writeText('${publicLiveUrl}')"><i class="fa-solid fa-share-nodes"></i> Compartir</button>`;

        container.innerHTML = controlsHTML;
    },

    async goLive() {
        // Actualizamos el estado en la base de datos
        const { data: updatedSession, error } = await this.supabase
            .from('sessions')
            .update({ status: 'EN VIVO', scheduled_at: new Date().toISOString() })
            .eq('id', this.sessionId)
            .select() // Usamos .select() para obtener la fila actualizada
            .single();

        if (error) {
            alert('Hubo un error al iniciar la transmisión.');
        } else {
            alert('¡Transmisión iniciada!');
            // Actualizamos nuestros datos locales con la nueva información
            this.sessionData = updatedSession;
            // Volvemos a dibujar solo los controles, sin recargar todo
            this.renderControls(); 
        }
    },  

    async endLiveStream() {
        if (!confirm("¿Estás seguro de que quieres finalizar la transmisión pública?")) return;

        // --- NUEVA LÓGICA DE ARCHIVADO ---
        const { error } = await this.supabase
            .from('sessions')
            .update({ 
                status: 'FINALIZADO', 
                end_at: new Date().toISOString(),
                is_archived: true // Marcamos la sesión como archivada
            })
            .eq('id', this.sessionId);

        if (error) {
            alert('Hubo un error al finalizar la transmisión.');
            console.error(error);
        } else {
            alert('La transmisión pública ha finalizado.');
            this.fetchAndRenderSession(); 
        }
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());