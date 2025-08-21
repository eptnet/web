// inv/js/stream.js - VERSIÓN DEFINITIVA Y ESTABLE

document.addEventListener('DOMContentLoaded', () => {
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 

    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('mic-select');
    const videoContainer = document.getElementById('video-container');
    const participantsGrid = document.getElementById('participants-grid'); // Nuestro nuevo contenedor

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = '';
    let selfId; // Guardaremos nuestro propio ID aquí

    // --- LOBBY (COMPLETO Y FUNCIONAL) ---
    async function setupLobby() {
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;

            const devices = await navigator.mediaDevices.enumerateDevices();
            populateSelect(cameraSelect, devices.filter(d => d.kind === 'videoinput'));
            populateSelect(micSelect, devices.filter(d => d.kind === 'audioinput'));
            
            selectedCameraId = cameraSelect.value;
            selectedMicId = micSelect.value;
            joinButton.disabled = false;
        } catch (error) { console.error('Error en el lobby:', error); }
    }
    
    function populateSelect(select, devices) {
        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `${select.id.includes('camera') ? 'Cámara' : 'Micrófono'} ${select.children.length + 1}`;
            select.appendChild(opt);
        });
    }

    async function updateLobbyPreview() {
        if (localPreviewStream) {
            localPreviewStream.getTracks().forEach(track => track.stop());
        }
        localPreviewStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedCameraId } },
            audio: { deviceId: { exact: selectedMicId } }
        });
        videoPreview.srcObject = localPreviewStream;
    }

    cameraSelect.addEventListener('change', () => {
        selectedCameraId = cameraSelect.value;
        updateLobbyPreview();
    });

    micSelect.addEventListener('change', () => {
        selectedMicId = micSelect.value;
        updateLobbyPreview();
    });

    // --- CONEXIÓN E INICIO DE MEDIOS (FLUJO CORRECTO) ---
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global', { enforceMultipleVideos: true });
        localPreviewStream.getTracks().forEach(track => track.stop());

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionName: SESSION_NAME, role_type }) });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
            stream = client.getMediaStream();
            
            // Inicia audio y video con los dispositivos seleccionados
            await stream.startAudio({ audioId: selectedMicId });
            await stream.startVideo({ cameraId: selectedCameraId });

            // --- INICIO DE LA SOLUCIÓN DEFINITIVA PARA VISTA PROPIA ---
            selfId = client.getCurrentUserInfo().userId;
            createParticipantCard(selfId); // Creamos nuestra propia tarjeta en la Green Room
            // --- FIN DE LA SOLUCIÓN ---

        } catch (error) { console.error('Error al unirse o iniciar medios:', error); }
    }
    
    // --- RENDERIZADO Y MANEJO DE EVENTOS ---
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
        }
    });
    
    async function renderParticipant(userId) {
        const existingTile = document.getElementById(`video-tile-${userId}`);
        if (existingTile) return;

        const videoTile = document.createElement('div');
        videoTile.className = 'video-tile';
        videoTile.id = `video-tile-${userId}`;
        
        const nameTag = document.createElement('span');
        nameTag.className = 'participant-name';
        nameTag.textContent = client.getUser(userId).displayName;
        
        const videoElement = await stream.attachVideo(userId, 3);
        
        videoTile.appendChild(videoElement);
        videoTile.appendChild(nameTag);
        videoContainer.appendChild(videoTile);
        updateLayout();
    }

    // --- NUEVA FUNCIÓN PARA LA GREEN ROOM ---
    async function createParticipantCard(userId) {
        // Evitamos duplicados si la tarjeta ya existe
        if (document.getElementById(`participant-card-${userId}`)) return;

        const user = client.getUser(userId);

        // 1. Creamos el contenedor principal de la tarjeta
        const card = document.createElement('div');
        card.className = 'participant-card';
        card.id = `participant-card-${userId}`;

        // 2. Creamos el área para la miniatura de video
        const videoThumb = document.createElement('div');
        videoThumb.className = 'video-thumbnail';
        // Adjuntamos el video en BAJA resolución (calidad 3 = 360p), ideal para miniaturas
        const videoElement = await stream.attachVideo(userId, 3);
        videoThumb.appendChild(videoElement);
        
        // 3. Creamos la etiqueta con el nombre
        const nameTag = document.createElement('span');
        nameTag.className = 'participant-name-thumb';
        nameTag.textContent = user.displayName;

        // 4. Creamos los controles (por ahora, solo el icono de micro)
        const controls = document.createElement('div');
        controls.className = 'participant-controls';
        const micIcon = document.createElement('i');
        micIcon.className = 'fa-solid fa-microphone'; // Lo iniciaremos como "activo"
        micIcon.id = `mic-icon-${userId}`;
        controls.appendChild(micIcon);

        // 5. Ensamblamos la tarjeta y la añadimos al grid
        card.appendChild(videoThumb);
        card.appendChild(nameTag);
        card.appendChild(controls);
        participantsGrid.appendChild(card);
    }
    
    // Este evento ahora solo se encarga de los INVITADOS
    client.on('peer-video-state-change', (payload) => {
        const { action, userId } = payload;
        if (userId === selfId) return; // Ignoramos nuestro propio evento

        if (action === 'Start') {
            createParticipantCard(userId);
        } else if (action === 'Stop') {
            const videoTile = document.getElementById(`video-tile-${userId}`);
            if (videoTile) videoTile.remove();
            updateLayout();
        }
    });

    client.on('user-removed', (payload) => {
        payload.forEach(u => {
            // Eliminar del escenario (si estuviera)
            const videoTile = document.getElementById(`video-tile-${u.userId}`);
            if (videoTile) videoTile.remove();
            
            // Eliminar de la Green Room
            const participantCard = document.getElementById(`participant-card-${u.userId}`);
            if (participantCard) participantCard.remove();
        });
        updateLayout();
    });

    function updateLayout() {
        const participantCount = client.getAllUser().length;
        videoContainer.className = participantCount > 1 ? 'participant-2' : 'participant-1';
    }

    // --- INICIO ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});