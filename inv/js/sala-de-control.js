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

    async goLive() {
        if (this.sessionData.status !== 'PROGRAMADO') return;
        console.log('Iniciando transmisión...');
        
        if (this.iframe && this.iframe.contentWindow) {
            console.log("Enviando comando {record: true} a VDO.Ninja...");
            this.iframe.contentWindow.postMessage({ 'record': true }, "*");
        } else {
            console.error("No se pudo encontrar el iframe de VDO.Ninja para enviar el comando.");
            alert("Error de comunicación con la ventana de VDO.Ninja.");
            return;
        }
        
        await this.updateStatus('EN VIVO');
    },

    async endSession() {
        if (this.sessionData.status !== 'EN VIVO') return;
        if (!confirm("Esto finalizará la transmisión pública y la archivará. ¿Estás seguro?")) return;
        
        console.log("Iniciando secuencia para finalizar la transmisión...");
        
        if (this.iframe && this.iframe.contentWindow) {
            console.log("Enviando comando {'close': 'estop'} a VDO.Ninja...");
            this.iframe.contentWindow.postMessage({ 'close': 'estop' }, "*");
        } else {
            console.error("No se pudo encontrar el iframe de VDO.Ninja para enviar el comando.");
            alert("Error de comunicación con la ventana de VDO.Ninja.");
            return;
        }
        
        // Damos un pequeño margen para que el comando se procese
        setTimeout(async () => {
            console.log("Procediendo a actualizar el estado en la base de datos a FINALIZADO.");
            await this.updateStatus('FINALIZADO');
        }, 500);
    },
    
    async updateStatus(newStatus) {
        console.log(`Intentando actualizar estado a: ${newStatus} para la sesión ID: ${this.sessionId}`);
        if (this.sessionData.status === newStatus) {
            console.warn(`El estado ya es ${newStatus}. No se necesita actualización.`);
            return;
        }

        const updateData = { status: newStatus };
        if (newStatus === 'FINALIZADO') {
            updateData.is_archived = true; 
        }
        
        const { data, error } = await this.supabase
            .from('sessions')
            .update(updateData)
            .eq('id', this.sessionId)
            .select(); // Añadimos .select() para obtener una respuesta más detallada
            
        if (error) {
            console.error("--- FALLO AL ACTUALIZAR EL ESTADO EN SUPABASE ---");
            console.error("Mensaje de error:", error.message);
            console.error("Detalles completos del error:", error);
            alert(`Error: No se pudo actualizar el estado a ${newStatus}. Revisa la consola para más detalles.`);
        } else {
            console.log("--- ÉXITO AL ACTUALIZAR EL ESTADO ---");
            console.log("Respuesta de Supabase:", data);
            this.sessionData.status = newStatus; 
            this.renderActionButtons();
            alert(`¡La sesión ahora está ${newStatus}!`);
        }
    },

    renderActionButtons() {
        // ... (esta función no necesita cambios)
        const container = document.getElementById('action-buttons-container');
        if (!container) return;

        let buttonHTML = '';
        switch (this.sessionData.status) {
            case 'PROGRAMADO':
                buttonHTML = `<button class="btn-primary go-live" onclick="ControlRoom.goLive()"><i class="fa-solid fa-play-circle"></i> Iniciar Transmisión Pública</button>`;
                break;
            case 'EN VIVO':
                buttonHTML = `<button class="btn-primary is-live" onclick="ControlRoom.endSession()"><i class="fa-solid fa-stop-circle"></i> Terminar Transmisión Pública</button>`;
                break;
            case 'FINALIZADO':
                buttonHTML = `<p class="session-ended-message"><i class="fa-solid fa-check-circle"></i> Esta transmisión ha finalizado.</p>`;
                break;
        }
        container.innerHTML = buttonHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());