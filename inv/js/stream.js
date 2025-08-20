// inv/js/stream.js - VERSIÓN FINAL DE PRODUCCIÓN

document.addEventListener('DOMContentLoaded', () => {
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 

    // Elementos del DOM
    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('mic-select'); // Nuevo
    const statusDiv = document.getElementById('status');
    const videoMainContainer = document.getElementById('video-main-container');
    const muteBtn = document.getElementById('mute-btn'); // Nuevo

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = ''; // Nuevo
    let isMuted = false; // Nuevo

    // FASE 1: LOBBY
    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos...';
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            
            populateSelect(cameraSelect, videoDevices);
            populateSelect(micSelect, audioDevices);
            
            selectedCameraId = cameraSelect.value;
            selectedMicId = micSelect.value;
            
            statusDiv.textContent = 'Estado: ¡Listo para unirte!';
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en el lobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a los dispositivos.';
        }
    }
    
    function populateSelect(selectElement, devices) {
        selectElement.innerHTML = '';
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${selectElement.id === 'camera-select' ? 'Cámara' : 'Micrófono'} ${selectElement.length + 1}`;
            selectElement.appendChild(option);
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

    micSelect.addEventListener('change', () => {
        selectedMicId = micSelect.value;
    });

    // FASE 2: CONEXIÓN
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
            
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

    // FASE 3: DENTRO DE LA SESIÓN
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
            stream = client.getMediaStream();
        }
    });
    
    client.on('user-added', async (payload) => {
        const currentUser = payload.find(user => user.isSelf);
        if (currentUser) {
            try {
                // Iniciar audio y video con los dispositivos seleccionados
                await stream.startAudio({ audioId: selectedMicId });
                await stream.startVideo({ cameraId: selectedCameraId });
            } catch (error) {
                console.error("Error al iniciar medios locales:", error);
            }
        }
    });
    
    client.on('peer-video-state-change', async (payload) => {
        const { action, userId } = payload;
        const existingTile = document.getElementById(`video-tile-${userId}`);

        if (action === 'Start' && !existingTile) {
            const videoTile = document.createElement('div');
            videoTile.className = 'video-tile';
            videoTile.id = `video-tile-${userId}`;
            
            const nameTag = document.createElement('p');
            // 'user' puede no estar inmediatamente disponible, así que lo buscamos
            const user = client.getUser(userId);
            nameTag.textContent = user ? user.displayName : `Usuario ${userId}`;
            nameTag.className = 'participant-name';
            
            videoMainContainer.appendChild(videoTile);
            const videoElement = await stream.attachVideo(userId, 3);
            videoTile.appendChild(videoElement);
        } else if (action === 'Stop' && existingTile) {
            existingTile.remove();
            await stream.detachVideo(userId);
        }
    });
    
    client.on('user-removed', (payload) => {
        payload.forEach(user => {
            const videoTile = document.getElementById(`video-tile-${user.userId}`);
            if (videoTile) videoTile.remove();
        });
    });

    // --- LÓGICA DEL BOTÓN DE MUTE ---
    muteBtn.addEventListener('click', async () => {
        if (isMuted) {
            await stream.unmuteAudio();
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            muteBtn.classList.remove('is-muted');
        } else {
            await stream.muteAudio();
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            muteBtn.classList.add('is-muted');
        }
        isMuted = !isMuted;
    });

    // --- INICIO ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});