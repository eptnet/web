// inv/js/stream.js - VERSIÓN DEFINITIVA CON AJUSTE DE TIMING

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
    let stream;
    let localStream;

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global', { patchJsMedia: true });
        statusDiv.textContent = 'Estado: SDK Inicializado. Pidiendo permisos...';
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localStream;
            videoPreview.play();
            statusDiv.textContent = 'Estado: Permisos concedidos. ¡Listo para unirte!';
            const mediaStream = client.getMediaStream();
            const cameras = mediaStream.getCameraList();
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
        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionName: SESSION_NAME,
                    role_type: 1 
                }),
            });
            if (!response.ok) {
                throw new Error(`Servidor de firmas respondió con: ${response.status}`);
            }
            const { signature } = await response.json();
            if (!signature) {
                 throw new Error('Servidor no incluyó una firma.');
            }
            statusDiv.textContent = 'Estado: Uniéndose a la sesión...';
            await client.join(SESSION_NAME, signature, USER_NAME, SESSION_PASSWORD);
        } catch (error) {
            console.error('Error al unirse a la sesión:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
            joinButton.disabled = false;
        }
    }

    client.on('connection-change', async (payload) => {
        console.log('Cambio de conexión:', payload);
        if (payload.state === 'Connected') {
            statusDiv.textContent = 'Estado: ¡Conectado!';
            
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';

            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            // --- INICIO DE LA CORRECCIÓN PARA LA PANTALLA NEGRA ---
            setTimeout(async () => {
                try {
                    stream = client.getMediaStream();
                    await stream.startVideo(); 
                    const userVideo = await stream.attachVideo(client.getCurrentUserInfo().userId, 3);
                    videoMainContainer.innerHTML = ''; 
                    videoMainContainer.appendChild(userVideo);
                } catch (error) {
                    console.error('Error al renderizar el video:', error);
                }
            }, 150); // Un pequeño retraso para asegurar que el DOM esté listo
            // --- FIN DE LA CORRECCIÓN ---

        } else if (payload.state === 'Fail') {
            console.error('Fallo en la conexión (payload):', payload);
            statusDiv.textContent = `Error: Fallo en la conexión. Razón: ${payload.reason || 'Desconocida'}`;
            joinButton.disabled = false;
        }
    });

    setupLobby();
    joinButton.addEventListener('click', joinSession);
});