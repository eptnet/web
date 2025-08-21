// inv/js/stream.js - VERSIÓN FINAL Y DEFINITIVA ("Liberar y Volver a Pedir")

document.addEventListener('DOMContentLoaded', () => {
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 

    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('mic-select');
    const statusDiv = document.getElementById('status');
    const videoMainContainer = document.getElementById('video-main-container');
    const muteBtn = document.getElementById('mute-btn');

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = '';
    let isMuted = false;

    // FASE 1: LOBBY (Estable)
    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos...';
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;
            const devices = await navigator.mediaDevices.enumerateDevices();
            populateSelect(cameraSelect, devices.filter(d => d.kind === 'videoinput'));
            populateSelect(micSelect, devices.filter(d => d.kind === 'audioinput'));
            selectedCameraId = cameraSelect.value;
            selectedMicId = micSelect.value;
            statusDiv.textContent = 'Estado: ¡Listo para unirte!';
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en el lobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a los dispositivos.';
        }
    }
    
    function populateSelect(select, devices) {
        devices.forEach(d => {
            const option = document.createElement('option');
            option.value = d.deviceId;
            option.textContent = d.label || `${select.id.includes('camera') ? 'Cámara' : 'Micrófono'} ${select.children.length + 1}`;
            select.appendChild(option);
        });
    }
    
    cameraSelect.addEventListener('change', async () => {
        selectedCameraId = cameraSelect.value;
        const audioTrack = localPreviewStream.getAudioTracks()[0];
        localPreviewStream.getVideoTracks().forEach(track => track.stop());
        const newVideoStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCameraId } } });
        localPreviewStream = new MediaStream([ ...newVideoStream.getVideoTracks(), audioTrack ]);
        videoPreview.srcObject = localPreviewStream;
    });

    micSelect.addEventListener('change', () => { selectedMicId = micSelect.value; });

    // FASE 2: CONEXIÓN
    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global');
        
        // ¡PASO CLAVE! Detenemos y liberamos la cámara del lobby.
        localPreviewStream.getTracks().forEach(track => track.stop());

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            statusDiv.textContent = 'Estado: Obteniendo firma...';
            const response = await fetch(SIGNATURE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionName: SESSION_NAME, role_type }) });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir.';
        }
    }

    // FASE 3: DENTRO DE LA SESIÓN
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
            stream = client.getMediaStream();

            // Una vez conectados, iniciamos los medios desde cero usando el SDK.
            // Esta es la forma más segura.
            startLocalMedia();
        }
    });

    async function startLocalMedia() {
        try {
            // El SDK ahora pide la cámara y el micrófono que seleccionamos.
            await stream.startAudio({ audioId: selectedMicId });
            await stream.startVideo({ cameraId: selectedCameraId });
        } catch (error) {
            console.error("Error al iniciar medios locales:", error);
        }
    }
    
    client.on('peer-video-state-change', async (payload) => {
        const { action, userId } = payload;
        const existingTile = document.getElementById(`video-tile-${userId}`);

        if (action === 'Start' && !existingTile) {
            const videoTile = document.createElement('div');
            videoTile.className = 'video-tile';
            videoTile.id = `video-tile-${userId}`;
            
            const nameTag = document.createElement('span');
            nameTag.className = 'participant-name';
            nameTag.textContent = client.getUser(userId).displayName;
            
            videoMainContainer.appendChild(videoTile);
            const videoElement = await stream.attachVideo(userId, 3);
            videoTile.appendChild(videoElement);
            videoTile.appendChild(nameTag); // Añadimos el nombre después
        } else if (action === 'Stop' && existingTile) {
            existingTile.remove();
        }
    });
    
    client.on('user-removed', (payload) => payload.forEach(u => document.getElementById(`video-tile-${u.userId}`)?.remove()));

    muteBtn.addEventListener('click', async () => {
        const icon = muteBtn.querySelector('i');
        if (isMuted) {
            await stream.unmuteAudio();
            icon.className = 'fa-solid fa-microphone';
            muteBtn.title = 'Silenciar';
        } else {
            await stream.muteAudio();
            icon.className = 'fa-solid fa-microphone-slash';
            muteBtn.title = 'Reactivar Audio';
        }
        isMuted = !isMuted;
        muteBtn.classList.toggle('is-muted', isMuted);
    });

    setupLobby();
    joinButton.addEventListener('click', joinSession);
});