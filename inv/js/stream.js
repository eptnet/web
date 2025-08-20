// inv/js/stream.js - VERSIÓN FINAL CON RELEVO DIRECTO

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
    let localPreviewStream; // Este stream del lobby se lo pasaremos al SDK
    let isMuted = false;

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Pidiendo permisos...';
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;
            const devices = await navigator.mediaDevices.enumerateDevices();
            populateSelect(cameraSelect, devices.filter(d => d.kind === 'videoinput'));
            populateSelect(micSelect, devices.filter(d => d.kind === 'audioinput'));
            statusDiv.textContent = 'Estado: ¡Listo para unirte!';
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en el lobby:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a los dispositivos.';
        }
    }
    
    function populateSelect(select, devices) {
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${select.id === 'camera-select' ? 'Cámara' : 'Micrófono'} ${select.length + 1}`;
            select.appendChild(option);
        });
    }

    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global');

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
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

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
                // --- INICIO DEL RELEVO DIRECTO ---
                // 1. Obtenemos las pistas de audio y video del stream del lobby
                const audioTrack = localPreviewStream.getAudioTracks()[0];
                const videoTrack = localPreviewStream.getVideoTracks()[0];

                // 2. Le pasamos las pistas directamente al SDK
                await stream.startAudio({ mediaStreamTrack: audioTrack });
                await stream.startVideo({ mediaStreamTrack: videoTrack });
                // --- FIN DEL RELEVO DIRECTO ---
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
            videoMainContainer.appendChild(videoTile);
            const videoElement = await stream.attachVideo(userId, 3);
            videoTile.appendChild(videoElement);
        } else if (action === 'Stop' && existingTile) {
            existingTile.remove();
        }
    });
    
    client.on('user-removed', (payload) => {
        payload.forEach(user => {
            const videoTile = document.getElementById(`video-tile-${user.userId}`);
            if (videoTile) videoTile.remove();
        });
    });

    muteBtn.addEventListener('click', async () => {
        const icon = muteBtn.querySelector('i');
        const text = muteBtn.querySelector('span');
        if (isMuted) {
            await stream.unmuteAudio();
            icon.className = 'fa-solid fa-microphone';
            text.textContent = 'Silenciar';
            muteBtn.classList.remove('is-muted');
        } else {
            await stream.muteAudio();
            icon.className = 'fa-solid fa-microphone-slash';
            text.textContent = 'Reactivar';
            muteBtn.classList.add('is-muted');
        }
        isMuted = !isMuted;
    });

    setupLobby();
    joinButton.addEventListener('click', joinSession);
});