const ControlRoom = {
    supabase: null,
    sessionId: null,
    sessionData: null,
    iframe: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const params = new URLSearchParams(window.location.search);
        this.sessionId = params.get('id');
        this.iframe = document.getElementById('mixer-iframe');

        if (!this.sessionId) {
            document.body.innerHTML = '<h1>Error: No se ha proporcionado un ID de sesión.</h1>';
            return;
        }
        
        this.fetchAndLoadSession();
    },

    async fetchAndLoadSession() {
        const { data, error } = await this.supabase.from('sessions').select('*').eq('id', this.sessionId).single();
        if (error || !data) {
            document.body.innerHTML = `<h1>Error: No se pudo cargar la sesión.</h1>`;
            return;
        }
        this.sessionData = data;
        document.title = `${this.sessionData.session_title} - Sala de Control`;
        document.getElementById('session-title-header').textContent = this.sessionData.session_title;
        
        const directorUrl = new URL(this.sessionData.director_url);
        directorUrl.searchParams.set('api', '1');
        this.iframe.src = directorUrl.toString();

        this.renderActionButtons();
    },

    // --- CAMBIO: NUEVA FUNCIÓN PARA ABRIR EL MODAL DE GRABACIÓN ---
    openRecordModal() {
        const modalContainer = document.getElementById('modal-overlay-container');
        modalContainer.innerHTML = `
            <div id="record-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header">
                        <h3>Opciones de Grabación</h3>
                        <button class="modal-close-btn">&times;</button>
                    </header>
                    <main class="modal-content">
                        <p>Elige cómo quieres grabar tu sesión. La grabación local ofrece la máxima calidad y se guarda directamente en tu computadora.</p>
                        </main>
                    <footer class="modal-footer">
                        <button id="record-local-btn" class="btn-primary btn-full-width"><i class="fas fa-desktop"></i> Grabar en mi PC</button>
                        <button class="btn-secondary btn-full-width" disabled><i class="fas fa-cloud"></i> Grabar en la Nube (Próximamente)</button>
                    </footer>
                </div>
            </div>`;

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        modalContainer.querySelector('#record-local-btn').addEventListener('click', () => this.startLocalRecording());
    },

    // --- CAMBIO: NUEVA FUNCIÓN PARA CERRAR CUALQUIER MODAL ---
    closeModal() {
        const modalContainer = document.getElementById('modal-overlay-container');
        if(modalContainer) modalContainer.innerHTML = '';
    },

    // --- CAMBIO: NUEVA FUNCIÓN PARA INICIAR LA GRABACIÓN LOCAL ---
    // La nueva versión que usa la URL correcta
    startLocalRecording() {
        // Verificamos que la nueva URL específica para grabar exista
        if (!this.sessionData.recording_source_url) {
            alert("Error: La URL de grabación local no fue encontrada para esta sesión.");
            return;
        }
        
        console.log("Abriendo sala de grabación local:", this.sessionData.recording_source_url);
        
        // Abrimos la URL guardada en la base de datos
        window.open(this.sessionData.recording_source_url, '_blank');
        
        this.closeModal();
    },

    async goLive() {
        // ... esta función permanece igual
        if (this.sessionData.status !== 'PROGRAMADO') return;
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage({ 'record': true }, "*");
        } else {
            alert("Error de comunicación con la ventana de VDO.Ninja.");
            return;
        }
        await this.updateStatus('EN VIVO');
    },

    async goLiveOnTwitch() {
        const button = document.querySelector('.go-live');
        button.textContent = 'Generando enlace...';
        button.disabled = true;

        try {
            // Llamamos a nuestra Edge Function segura
            const { data, error } = await this.supabase.functions.invoke('crear-enlace-twitch', {
                body: { session_id: this.sessionId },
            });

            if (error) throw error;

            // Abrimos la URL que nos devuelve la Edge Function
            window.open(data.twitch_url, '_blank');
            
            // Marcamos la sesión como 'EN VIVO' en nuestra base de datos
            await this.updateStatus('EN VIVO');

        } catch (error) {
            alert("Error al generar el enlace de Twitch: " + error.message);
            this.renderActionButtons(); // Restaura el botón original
        }
    },

    async endSession() {
        // ... esta función permanece igual
        if (this.sessionData.status !== 'EN VIVO') return;
        if (!confirm("Esto finalizará la transmisión pública y la archivará. ¿Estás seguro?")) return;
        if (this.iframe && this.iframe.contentWindow) {
            this.iframe.contentWindow.postMessage({ 'close': 'estop' }, "*");
        }
        setTimeout(async () => { await this.updateStatus('FINALIZADO'); }, 500);
    },
    
    async updateStatus(newStatus) {
        if (this.sessionData.status === newStatus) return;

        // --- INICIO DEL CAMBIO ---
        // Ya no asignamos 'is_archived' automáticamente al finalizar.
        // Esto lo hará el usuario manualmente desde el dashboard.
        const updateData = { status: newStatus };
        // --- FIN DEL CAMBIO ---
        
        const { error } = await this.supabase
            .from('sessions')
            .update(updateData)
            .eq('id', this.sessionId);
            
        if (error) {
            console.error("Error al actualizar estado:", error);
            alert(`Error: No se pudo actualizar el estado a ${newStatus}.`);
        } else {
            this.sessionData.status = newStatus; 
            this.renderActionButtons();
            alert(`¡La sesión ahora está ${newStatus}!`);
        }
    },

    renderActionButtons() {
        const container = document.getElementById('action-buttons-container');
        if (!container) return;

        let buttonHTML = '';
        switch (this.sessionData.status) {
            case 'PROGRAMADO':
                // --- INICIO DEL CAMBIO ---
                // Mostramos un botón diferente si la plataforma es Twitch
                if (this.sessionData.platform === 'twitch') {
                    buttonHTML = `
                        <button class="btn-primary go-live" onclick="ControlRoom.goLiveOnTwitch()">
                            <i class="fab fa-twitch"></i> Iniciar Transmisión en Twitch
                        </button>
                    `;
                } else {
                    // Mantenemos la lógica anterior para las otras plataformas
                    buttonHTML = `
                        <button class="btn-secondary" onclick="ControlRoom.openRecordModal()">
                            <i class="fa-solid fa-video"></i> Solo Grabar
                        </button>
                        <button class="btn-primary go-live" onclick="ControlRoom.goLive()">
                            <i class="fa-solid fa-tower-broadcast"></i> Iniciar Transmisión Pública
                        </button>
                    `;
                }
                // --- FIN DEL CAMBIO ---
                break;
            case 'EN VIVO':
                buttonHTML = `<button class="btn-primary is-live" onclick="ControlRoom.endSession()"><i class="fa-solid fa-stop-circle"></i> Terminar Transmisión</button>`;
                break;
            case 'FINALIZADO':
                buttonHTML = `<p class="session-ended-message"><i class="fa-solid fa-check-circle"></i> Transmisión finalizada.</p>`;
                break;
        }
        container.innerHTML = buttonHTML;
    },
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());