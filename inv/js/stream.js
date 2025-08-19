const StreamTest = {
    client: null,
    stream: null,

    async init() {
        console.log("--- Iniciando Prueba de EPTstream ---");
        const statusEl = document.getElementById('status');

        try {
            // 1. Obtener parámetros de la URL
            statusEl.textContent = "Obteniendo parámetros de la URL...";
            const params = new URLSearchParams(window.location.search);
            const sessionName = params.get('session');
            const role = params.get('role');
            if (!sessionName || !role) throw new Error("Faltan 'session' o 'role' en la URL.");
            console.log(`Sesión: ${sessionName}, Rol: ${role}`);

            // 2. Cargar el SDK
            statusEl.textContent = "Cargando SDK de Zoom...";
            const ZoomVideo = window.WebVideoSDK.default;
            if (!ZoomVideo) throw new Error("El SDK de Zoom no se ha podido cargar.");
            console.log("SDK de Zoom cargado.");

            // 3. Inicializar el cliente
            statusEl.textContent = "Inicializando cliente...";
            this.client = ZoomVideo.createClient();
            await this.client.init('en-US', 'Global');
            console.log("Cliente inicializado.");

            // 4. Obtener la firma JWT desde nuestra Edge Function
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
            this.stream = this.client.join(sessionName, signature, userName, '');
            console.log("Llamada a join() completada. Esperando conexión...");

            // 6. Escuchar el evento de conexión
            this.client.on('connection-change', async (payload) => {
                console.log(`Estado de la conexión: ${payload.state}`);
                statusEl.textContent = `Estado de la conexión: ${payload.state}`;

                if (payload.state === 'Connected') {
                    try {
                        statusEl.textContent = "Conectado. Pidiendo acceso a la cámara...";

                        // 7. Iniciar el video (esto pide permiso al navegador)
                        await this.stream.startVideo();
                        console.log("Permiso de cámara concedido y video iniciado.");

                        // 8. Adjuntar el video al DOM
                        statusEl.textContent = "Adjuntando video...";
                        const videoContainer = document.getElementById('video-container');
                        const videoElement = await this.stream.attachVideo(this.client.getCurrentUserInfo().userId, 3);
                        videoContainer.appendChild(videoElement);
                        console.log("¡Video adjuntado con éxito!");
                        statusEl.textContent = "¡Video funcionando!";

                    } catch (videoError) {
                        console.error("--- ERROR AL INICIAR/ADJUNTAR VIDEO ---", videoError);
                        statusEl.textContent = `Error de video: ${videoError.message}`;
                    }
                }
            });

            this.client.on('error', (error) => {
                console.error("--- ERROR DEL SDK ---", error);
                statusEl.textContent = `Error del SDK: ${error.reason}`;
            });

        } catch (error) {
            console.error("--- ERROR EN LA INICIALIZACIÓN ---", error);
            statusEl.textContent = `Error: ${error.message}`;
        }
    }
};

// Iniciar la prueba
StreamTest.init();