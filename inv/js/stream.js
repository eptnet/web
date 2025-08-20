// inv/js/stream.js - VERSIÓN CON INICIALIZACIÓN DE STREAM CORREGIDA

document.addEventListener('DOMContentLoaded', () => {

    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    const USER_NAME = 'Productor-' + Math.floor(Math.random() * 1000);
    const SESSION_PASSWORD = '';

    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const statusDiv = document.getElementById('status');
    const videoMainContainer = document.getElementById('video-main-container');

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream; // La declaramos aquí para que sea accesible en todas las funciones

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global', { patchJsMedia: true });
        
        // --- INICIO DE LA CORRECCIÓN ---
        // Obtenemos el objeto 'stream' inmediatamente después de 'init'.
        // Esto le da al SDK acceso temprano a los dispositivos de medios.
        stream = client.getMediaStream();
        // --- FIN DE LA CORRECCIÓN ---

        statusDiv.textContent = 'Estado: SDK Inicializado. Pidiendo permisos...';
        try {
            // Usamos el 'stream' del SDK para la vista previa, en lugar de 'navigator'
            await stream.startVideo({ videoElement: videoPreview });
            
            statusDiv.textContent = 'Estado: Permisos concedidos. ¡Listo para unirte!';
            
            const cameras = stream.getCameraList();
            cameras.forEach(camera => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.label;
                cameraSelect.appendChild(option);
            });

            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en setupLobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a la cámara.';
            joinButton.disabled = true;
        }
    }

    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Obteniendo firma...';

        // Detenemos el video del lobby ANTES de unirnos para liberar la cámara
        await stream.stopVideo();

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionName: SESSION_NAME,
                    role_type: 1 
                }),
            });
            if (!response.ok) throw new Error(`Servidor respondió con: ${response.status}`);
            const { signature } = await response.json();
            if (!signature) throw new Error('Servidor no incluyó una firma.');
            
            statusDiv.textContent = 'Estado: Uniéndose a la sesión...';
            await client.join(SESSION_NAME, signature, USER_NAME, SESSION_PASSWORD);
            
        } catch (error) {
            console.error('Error al unirse a la sesión:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
            joinButton.disabled = false;
            // Si falla, intentamos reiniciar la vista previa del lobby
            await stream.startVideo({ videoElement: videoPreview });
        }
    }

    client.on('connection-change', async (payload) => {
        if (payload.state === 'Connected') {
            statusDiv.textContent = 'Estado: ¡Conectado!';
            
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';

            // Ya que el 'stream' es el mismo, solo necesitamos renderizarlo de nuevo
            // en el nuevo contenedor. startVideo ya fue llamado en el lobby.
            const currentUser = client.getCurrentUserInfo();
            if (currentUser) {
                await stream.renderVideo(videoMainContainer, currentUser.userId, 1920, 1080, 0, 0, 3);
            } else {
                 // Como fallback, si getCurrentUserInfo falla, intentamos con el primer usuario
                const participants = client.getAllUser();
                if (participants.length > 0) {
                   await stream.renderVideo(videoMainContainer, participants[0].userId, 1920, 1080, 0, 0, 3);
                }
            }
        } else if (payload.state === 'Fail') {
            console.error('Fallo en la conexión:', payload);
            statusDiv.textContent = `Error: ${payload.reason || 'Desconocido'}`;
        }
    });

    setupLobby();
    joinButton.addEventListener('click', joinSession);
});