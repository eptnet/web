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

        this.listenToVDONinja();
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
        
        // Añadimos un parámetro a la URL del director para que la API se active
        const directorUrl = new URL(this.sessionData.director_url);
        directorUrl.searchParams.set('api', '1');
        this.iframe.src = directorUrl.toString();
    },

    // Escuchamos los mensajes que nos envía el iframe de VDO.Ninja
    listenToVDONinja() {
        window.addEventListener('message', (e) => {
            // Asegurarnos que el mensaje viene del iframe
            if (e.source !== this.iframe.contentWindow) return;
            
            // Cuando el director empieza a grabar o transmitir, VDO.Ninja nos avisa
            if (e.data.action === 'recording-state') {
                const isRecording = e.data.value;
                const currentStatus = this.sessionData.status;

                if (isRecording && currentStatus !== 'EN VIVO') {
                    // Si empieza a grabar y no estábamos EN VIVO, actualizamos el estado
                    console.log("VDO.Ninja ha empezado a grabar/transmitir. Actualizando estado a EN VIVO.");
                    this.updateStatus('EN VIVO');
                }
            }
        });
    },
    
    // Función para actualizar nuestro estado en Supabase
    async updateStatus(newStatus) {
        if (this.sessionData.status === newStatus) return; // Evita actualizaciones innecesarias

        const updateData = { status: newStatus };
        if (newStatus === 'FINALIZADO') {
            updateData.end_at = new Date().toISOString();
            updateData.is_archived = true;
        }
        
        const { error } = await this.supabase.from('sessions').update(updateData).eq('id', this.sessionId);
        if (error) {
            console.error("Error al actualizar el estado:", error);
        } else {
            console.log(`Estado actualizado a ${newStatus}`);
            this.sessionData.status = newStatus; // Actualizamos estado local
            this.renderEndButton();
        }
    },

    // Dibuja el botón de terminar solo si estamos EN VIVO
    renderEndButton() {
        const container = document.getElementById('end-stream-button-container');
        if (!container) return;

        if (this.sessionData.status === 'EN VIVO') {
            container.innerHTML = `<button class="btn-primary is-live" onclick="ControlRoom.endLiveStream()"><i class="fa-solid fa-stop-circle"></i> Terminar Transmisión Pública</button>`;
        } else {
            container.innerHTML = '';
        }
    },

    // El botón de terminar ahora envía una orden al iframe y LUEGO actualiza el estado
    endLiveStream() {
        if (!confirm("Esto finalizará la transmisión pública. ¿Estás seguro?")) return;
        
        console.log("Enviando comando para detener la transmisión al iframe...");
        this.iframe.contentWindow.postMessage({ 'record': false }, "*"); // Detiene la grabación
        this.iframe.contentWindow.postMessage({ 'close': true }, "*"); // Cuelga las conexiones
        
        // Después de enviar los comandos, actualizamos nuestro estado
        this.updateStatus('FINALIZADO');
    }
};

document.addEventListener('DOMContentLoaded', () => ControlRoom.init());