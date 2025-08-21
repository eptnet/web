// inv/js/stream.js - VERSIÓN CON LOBBY CORREGIDO Y ESTABLE

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURACIÓN Y ELEMENTOS DEL DOM ---
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

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream; // Este stream lo recrearemos al cambiar de dispositivo
    let selectedCameraId = '';
    let selectedMicId = '';

    // --- LÓGICA DEL LOBBY (CON CORRECCIONES) ---

    // Función para actualizar la vista previa del lobby
    async function updateLobbyPreview() {
        // Detiene el stream anterior para liberar los dispositivos
        if (localPreviewStream) {
            localPreviewStream.getTracks().forEach(track => track.stop());
        }
        
        // Pide un nuevo stream con los dispositivos seleccionados
        localPreviewStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedCameraId } },
            audio: { deviceId: { exact: selectedMicId } }
        });
        videoPreview.srcObject = localPreviewStream;
    }

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos...';
        try {
            // Petición inicial para obtener la lista de dispositivos
            await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            populateSelect(cameraSelect, devices.filter(d => d.kind === 'videoinput'));
            populateSelect(micSelect, devices.filter(d => d.kind === 'audioinput'));
            
            selectedCameraId = cameraSelect.value;
            selectedMicId = micSelect.value;

            // Inicia la primera vista previa
            await updateLobbyPreview();
            
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
    
    // --- LISTENERS CORREGIDOS ---
    cameraSelect.addEventListener('change', () => {
        selectedCameraId = cameraSelect.value;
        updateLobbyPreview(); // Llama a la función centralizada
    });

    micSelect.addEventListener('change', () => {
        selectedMicId = micSelect.value;
        updateLobbyPreview(); // También actualiza al cambiar el micro
    });


    // --- LÓGICA DE CONEXIÓN (Estable) ---
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global', { enforceMultipleVideos: true });
        
        if (localPreviewStream) {
            localPreviewStream.getTracks().forEach(track => track.stop());
        }

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionName: SESSION_NAME, role_type }) });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
            stream = client.getMediaStream();
            // Inicia los medios con los dispositivos que seleccionamos en el lobby
            await stream.startAudio({ audioId: selectedMicId });
            await stream.startVideo({ cameraId: selectedCameraId });
        } catch (error) { 
            console.error('Error al unirse:', error);
        }
    }
    
    // --- RENDERIZADO (Estable) ---
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
        }
    });

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
            const videoElement = await stream.attachVideo(userId, 3);
            videoTile.appendChild(videoElement);
            videoTile.appendChild(nameTag);
            videoMainContainer.appendChild(videoTile);
            updateLayout();
        } else if (action === 'Stop' && existingTile) {
            existingTile.remove();
            updateLayout();
        }
    });
    
    client.on('user-removed', (payload) => {
        payload.forEach(u => document.getElementById(`video-tile-${u.userId}`)?.remove());
        updateLayout();
    });

    function updateLayout() {
        const participantCount = client.getAllUser().length;
        // La clase se aplica al contenedor de video, no al body
        videoMainContainer.className = `participant-${participantCount}`;
    }

    // --- INICIO ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});