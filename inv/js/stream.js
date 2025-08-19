const StreamTest = {
    client: null,
    stream: null,

    async init() {
        console.log("--- Iniciando Conexión Definitiva ---");
        const statusEl = document.getElementById('status');

        try {
            // 1. Obtener parámetros (sin cambios)
            statusEl.textContent = "Obteniendo parámetros...";
            const params = new URLSearchParams(window.location.search);
            const sessionName = params.get('session');
            const role = params.get('role');
            if (!sessionName || !role) throw new Error("Faltan 'session' o 'role' en la URL.");

            // 2. Cargar SDK (sin cambios)
            statusEl.textContent = "Cargando SDK...";
            const ZoomVideo = window.WebVideoSDK.default;
            if (!ZoomVideo) throw new Error("El SDK de Zoom no se ha podido cargar.");

            // 3. Inicializar cliente (Añadimos la opción recomendada 'patchJsMedia')
            statusEl.textContent = "Inicializando cliente...";
            this.client = ZoomVideo.createClient();
            await this.client.init('en-US', 'Global', { patchJsMedia: true });
            console.log("Cliente inicializado con éxito.");

            // 4. Obtener firma (sin cambios)
            statusEl.textContent = "Obteniendo firma de seguridad...";
            const functionUrl = `https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature`;
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName, role }),
            });
            if (!response.ok) throw new Error('No se pudo obtener la firma desde Supabase.');
            const { signature } = await response.json();
            console.log("Firma obtenida con éxito.");

            // 5. Unirse a la sesión
            statusEl.textContent = "Uniéndose a la sesión...";
            const userName = `User-${Math.floor(Math.random() * 1000)}`;
            await this.client.join(sessionName, signature, userName, '');
            console.log("Llamada a join() completada.");

            // ==========================================================
            // ===               LA CORRECCIÓN CLAVE                  ===
            // ==========================================================
            // 6. OBTENER EL STREAM DE MEDIOS
            statusEl.textContent = "Obteniendo control de medios (cámara/mic)...";
            this.stream = this.client.getMediaStream();
            console.log("¡Objeto 'stream' obtenido con éxito!");
            // ==========================================================

            // 7. Iniciar y adjuntar el video
            statusEl.textContent = "Pidiendo permiso de cámara...";
            await this.stream.startVideo();
            console.log("Permiso de cámara concedido.");

            statusEl.textContent = "Adjuntando video...";
            const videoContainer = document.getElementById('video-container');
            const videoElement = await this.stream.attachVideo(this.client.getCurrentUserInfo().userId, 3);
            videoContainer.appendChild(videoElement);
            
            console.log("¡TODO CORRECTO! Video funcionando.");
            statusEl.textContent = "¡Video funcionando!";

        } catch (error) {
            console.error("--- ERROR EN EL PROCESO ---", error);
            statusEl.textContent = `Error: ${error.message}`;
        }
    }
};

// Iniciar
StreamTest.init();