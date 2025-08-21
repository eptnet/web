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

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = '';

    // LOBBY: Pide permisos y lista dispositivos
    async function setupLobby() {
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;
            const devices = await navigator.mediaDevices.enumerateDevices();
            devices.filter(d => d.kind === 'videoinput').forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Cámara ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(opt);
            });
            devices.filter(d => d.kind === 'audioinput').forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Micrófono ${micSelect.length + 1}`;
                micSelect.appendChild(opt);
            });
            selectedCameraId = cameraSelect.value;
            selectedMicId = micSelect.value;
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error en el lobby:', error);
        }
    }

    // CONEXIÓN: Se une a la sesión e inicia los medios
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global');
        localPreviewStream.getTracks().forEach(track => track.stop());

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionName: SESSION_NAME, role_type }) });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
            stream = client.getMediaStream();
            await stream.startAudio({ audioId: selectedMicId });
            await stream.startVideo({ cameraId: selectedCameraId });
        } catch (error) {
            console.error('Error al unirse:', error);
        }
    }
    
    // RENDERIZADO: Dibuja/quita los videos cuando el SDK lo indica
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
            videoContainer.appendChild(videoTile);
        } else if (action === 'Stop' && existingTile) {
            existingTile.remove();
        }
    });

    client.on('user-removed', (payload) => {
        payload.forEach(u => document.getElementById(`video-tile-${u.userId}`)?.remove());
    });

    // INICIO
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});