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

        // CAMBIO: Ya no escuchamos pasivamente. Ahora actuamos.
        // this.listenToVDONinja(); 
        
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
        directorUrl.searchParams.set('api', '1'); // Activa la API
        this.iframe.src = directorUrl.toString();

        // CAMBIO: Dibujamos el botón correcto tan pronto cargamos los datos.
        this.renderActionButtons();
    },

    // CAMBIO: Nueva función para iniciar la transmisión. Es el equivalente a 'endLiveStream'.
    async goLive() {
        if (this.sessionData.status !== 'PROGRAMADO') return;

        console.log('Enviando comando para INICIAR transmisión al iframe...');
        
        // 1. Ordena a VDO.Ninja que empiece a grabar.
        this.iframe.contentWindow.postMessage({ 'record': true }, "*");

        // 2. Actualiza nuestro estado en la base de datos.
        await this.updateStatus('EN VIVO');
        
        alert('¡La transmisión ahora está EN VIVO!');
    },

    // CAMBIO: 'endLiveStream' ahora se llama 'endSession' para más claridad.
    async endSession() {
        if (this.sessionData.status !== 'EN VIVO') return;
        if (!confirm("Esto finalizará la transmisión pública y la archivará. ¿Estás seguro?")) return;
        
        console.log("Enviando comando para DETENER la transmisión al iframe...");

        // 1. Ordena a VDO.Ninja que pare de grabar y cuelgue.
        this.iframe.contentWindow.postMessage({ 'record': false }, "*");
        this.iframe.contentWindow.postMessage({ 'close': true }, "*");
        
        // 2. Actualiza nuestro estado.
        await this.updateStatus('FINALIZADO');

        alert('¡La transmisión ha FINALIZADO!');
    },
    
    async updateStatus(newStatus) {
        if (this.sessionData.status === newStatus) return;

        const updateData = { status: newStatus };
        
        // CAMBIO: Movimos la lógica de archivar aquí para más consistencia.
        if (newStatus === 'FINALIZADO') {
            updateData.is_archived = true; 
        }
        
        const { error } = await this.supabase.from('sessions').update(updateData).eq('id', this.sessionId);
        if (error) {
            console.error("Error al actualizar el estado:", error);
        } else {
            console.log(`Estado actualizado a ${newStatus}`);
            this.sessionData.status = newStatus; // Actualizamos estado local
            this.renderActionButtons(); // CAMBIO: Volvemos a dibujar el botón correcto.
        }
    },

    // CAMBIO: Esta función ahora maneja todos los estados, no solo el de terminar.
    renderActionButtons() {
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