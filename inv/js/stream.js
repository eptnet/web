// inv/js/stream.js - VERSIÓN FINAL BASADA EN EL CICLO DE VIDA CORRECTO DEL SDK

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN Y ELEMENTOS DEL DOM ---
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    const USER_NAME = 'Productor-' + Math.floor(Math.random() * 1000);

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
    let localPreviewStream; // Stream del lobby (del navegador)
    let selectedCameraId = ''; // Guardaremos la cámara seleccionada

    // --- FASE 1: LOBBY (INDEPENDIENTE DEL SDK) ---
    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos de cámara...';
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            cameraSelect.innerHTML = ''; // Limpiar opciones previas
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Cámara ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            });
            
            selectedCameraId = cameraSelect.value; // Guardar la selección inicial
            statusDiv.textContent = 'Estado: ¡Listo para unirte!';
            joinButton.disabled = false;

        } catch (error) {
            console.error('Error en el lobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a la cámara.';
            joinButton.disabled = true;
        }
    }

    cameraSelect.addEventListener('change', async () => {
        selectedCameraId = cameraSelect.value;
        // Cambiar la vista previa del lobby al cambiar de cámara
        localPreviewStream.getTracks().forEach(track => track.stop());
        localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCameraId } } });
        videoPreview.srcObject = localPreviewStream;
    });

    // --- FASE 2: CONEXIÓN A ZOOM ---
    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';

        await client.init('en-US', 'Global');
        
        // Detenemos la vista previa del lobby para liberar la cámara
        localPreviewStream.getTracks().forEach(track => track.stop());

        statusDiv.textContent = 'Estado: Obteniendo firma...';
        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type: 1 }),
            });
            if (!response.ok) throw new Error(`Servidor respondió con: ${response.status}`);
            const { signature } = await response.json();
            if (!signature) throw new Error('Servidor no incluyó una firma.');
            
            statusDiv.textContent = 'Estado: Uniéndose a la sesión...';
            await client.join(SESSION_NAME, signature, USER_NAME);

        } catch (error) {
            console.error('Error al unirse a la sesión:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
            joinButton.disabled = false;
        }
    }

    // --- FASE 3: DENTRO DE LA SESIÓN (MANEJADO POR EL SDK) ---
    client.on('connection-change', async (payload) => {
        if (payload.state === 'Connected') {
            statusDiv.textContent = 'Estado: ¡Conectado!';
            
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';

            stream = client.getMediaStream();
            const currentUser = client.getCurrentUserInfo();

            try {
                // Iniciar el video, especificando la cámara que elegimos en el lobby
                await stream.startVideo({ cameraId: selectedCameraId });
                // Usamos attachVideo, que es el método más moderno y recomendado
                const videoElement = await stream.attachVideo(currentUser.userId, 3);
                videoMainContainer.innerHTML = '';
                videoMainContainer.appendChild(videoElement);
            } catch (error) {
                console.error("Error al iniciar el video dentro de la sesión:", error);
                videoMainContainer.innerHTML = '<p style="color:red;">No se pudo iniciar el video.</p>';
            }
        }
    });

    // --- INICIO DE LA APLICACIÓN ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});