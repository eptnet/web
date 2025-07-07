/**
 * sala-de-control.js
 * Lógica para la página dedicada a la sala de control de una sesión.
 */
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
        this.listenForChanges();
    },

    async fetchAndRenderSession() {
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('id', this.sessionId)
            .single();

        if (error || !data) {
            document.body.innerHTML = `<h1>Error: No se pudo cargar la sesión con ID ${this.sessionId}.</h1>`;
            return;
        }

        this.sessionData = data;
        
        document.title = `${this.sessionData.session_title} - Sala de Control`;
        document.getElementById('session-title-header').textContent = this.sessionData.session_title;
        
        const iframe = document.getElementById('mixer-iframe');
        if (iframe && iframe.src !== this.sessionData.director_url) {
            iframe.src = this.sessionData.director_url;
        }
        
        this.renderControls();
    },

    renderControls() {
        const container = document.getElementById('session-controls');
        if (!container) return;
        
        const { status, platform, platform_id, guest_url } = this.sessionData;
        let controlsHTML = '';

        switch (status) {
            case 'PROGRAMADO':
                controlsHTML = `<button class="btn-secondary" onclick="ControlRoom.updateStatus('SALA ABIERTA')"><i class="fa-solid fa-door-open"></i> Abrir Sala</button>`;
                break;
            case 'SALA ABIERTA':
                const canGoLive = platform === 'vdo_ninja' || platform_id;
                if (canGoLive) {
                    controlsHTML = `<button class="btn-primary" onclick="ControlRoom.updateStatus('EN VIVO')"><i class="fa-solid fa-tower-broadcast"></i> Iniciar Directo</button>`;
                } else {
                    controlsHTML = `<button class="btn-primary" disabled title="Añade el ID en el dashboard para activar">Iniciar Directo</button>`;
                }
                break;
            case 'EN VIVO':
                controlsHTML = `<button class="btn-primary is-live" onclick="ControlRoom.updateStatus('FINALIZADO')"><i class="fa-solid fa-stop-circle"></i> Terminar Directo</button>`;
                break;
            case 'FINALIZADO':
                controlsHTML = `<span class="session-ended-text">Sesión Finalizada</span>`;
                break;
        }

        if(guest_url) {
            controlsHTML += `<button class="btn-secondary" onclick="navigator.clipboard.writeText('${guest_url}')" title="Copiar enlace de invitado"><i class="fa-solid fa-copy"></i></button>`;
        }
        
        container.innerHTML = controlsHTML;
    },

    async updateStatus(newStatus) {
        const buttonContainer = document.getElementById('session-controls');
        buttonContainer.innerHTML = `<span class="session-ended-text">Actualizando...</span>`;

        const updateData = { status: newStatus };

        if (newStatus === 'EN VIVO') {
            updateData.scheduled_at = new Date().toISOString();
        } else if (newStatus === 'FINALIZADO') {
            if (!confirm("¿Estás seguro de que quieres finalizar la transmisión pública? La sala de control permanecerá activa.")) {
                this.renderControls(); // Restaura los botones si el usuario cancela
                return;
            }
            updateData.end_at = new Date().toISOString();
            updateData.is_archived = true;
        }

        const { error } = await this.supabase
            .from('sessions')
            .update(updateData)
            .eq('id', this.sessionId);

        if (error) {
            alert(`Hubo un error al cambiar el estado a ${newStatus}. Revisa la consola.`);
            console.error(error);
            this.renderControls(); // Restaura los botones si hay un error
        }
        // No es necesario hacer nada más aquí, el listener en tiempo real se encargará de refrescar
    },

    listenForChanges() {
        this.supabase.channel(`session-room-${this.sessionId}`)
          .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'sessions',
                filter: `id=eq.${this.sessionId}`
            }, payload => {
                this.sessionData = payload.new;
                this.renderControls();
            })
          .subscribe();
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());