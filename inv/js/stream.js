// inv/js/stream.js - VERSIÓN FINAL Y DEFINITIVA

document.addEventListener('DOMContentLoaded', () => {
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 

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
    let localPreviewStream;
    let selectedCameraId = '';

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos...';
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            cameraSelect.innerHTML = '';
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Cámara ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            });
            selectedCameraId = cameraSelect.value;
            statusDiv.textContent = 'Estado: ¡Listo para unirte!';
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en el lobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a la cámara.';
        }
    }

    cameraSelect.addEventListener('change', async () => {
        selectedCameraId = cameraSelect.value;
        localPreviewStream.getTracks().forEach(track => track.stop());
        localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCameraId } } });
        videoPreview.srcObject = localPreviewStream;
    });

    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global');
        localPreviewStream.getTracks().forEach(track => track.stop());

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            statusDiv.textContent = 'Estado: Obteniendo firma...';
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type }),
            });
            if (!response.ok) throw new Error(`Servidor respondió con: ${response.status}`);
            const { signature } = await response.json();
            
            statusDiv.textContent = 'Estado: Uniéndose a la sesión...';
            await client.join(SESSION_NAME, signature, userName);
            
            // --- INICIO DE LA CORRECCIÓN DEFINITIVA ---
            // Movemos el inicio de medios aquí, DESPUÉS de que 'join' se complete.
            stream = client.getMediaStream();
            await stream.startAudio();
            await stream.startVideo({ cameraId: selectedCameraId });
            // --- FIN DE LA CORRECCIÓN DEFINITIVA ---

        } catch (error) {
            console.error('Error al unirse a la sesión:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
        }
    });

    client.on('peer-video-state-change', async (payload) => {
        const { action, userId } = payload;
        if (action === 'Start') {
            const videoTile = document.createElement('div');
            videoTile.className = 'video-tile';
            videoTile.id = `video-tile-${userId}`;
            videoMainContainer.appendChild(videoTile);
            
            const videoElement = await stream.attachVideo(userId, 3);
            videoTile.appendChild(videoElement);
        } else if (action === 'Stop') {
            const videoTile = document.getElementById(`video-tile-${userId}`);
            if(videoTile) videoTile.remove();
            await stream.detachVideo(userId);
        }
    });
    
    // Añadimos un listener para cuando un usuario abandona la sesión
    client.on('user-removed', (payload) => {
        payload.forEach(user => {
            const videoTile = document.getElementById(`video-tile-${user.userId}`);
            if(videoTile) videoTile.remove();
        });
    });

    setupLobby();
    joinButton.addEventListener('click', joinSession);
});