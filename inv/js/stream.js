// inv/js/stream.js - VERSIÓN FINAL Y SIMPLIFICADA

document.addEventListener('DOMContentLoaded', () => {

    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    let userName = 'Productor-' + Math.floor(Math.random() * 1000);

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
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `${select.id.includes('camera') ? 'Cámara' : 'Micrófono'} ${select.length + 1}`;
            select.appendChild(option);
        });
    }

    // FASE 2: CONEXIÓN (Limpia y Directa)
    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        await client.init('en-US', 'Global');
        
        // ¡Importante! No detenemos el stream aquí, se lo pasaremos al SDK
        
        statusDiv.textContent = 'Estado: Obteniendo firma...';
        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type: 1 }),
            });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

    // FASE 3: DENTRO DE LA SESIÓN (Lógica Centralizada)
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
            // Este es el único lugar donde iniciamos y mostramos el video
            try {
                // Obtenemos las pistas de audio y video del stream del lobby
                const audioTrack = localPreviewStream.getAudioTracks()[0];
                const videoTrack = localPreviewStream.getVideoTracks()[0];
                
                // Le pasamos las pistas directamente al SDK para un relevo perfecto
                await stream.startAudio({ mediaStreamTrack: audioTrack });
                await stream.startVideo({ mediaStreamTrack: videoTrack });

                // Y renderizamos el video inmediatamente
                const videoElement = await stream.attachVideo(currentUser.userId, 3);
                videoMainContainer.innerHTML = '';
                videoMainContainer.appendChild(videoElement);
            } catch (error) {
                console.error("Error al iniciar y renderizar medios locales:", error);
            }
        }
    });

    // --- MANEJO DE CONTROLES (Sin cambios) ---
    cameraSelect.addEventListener('change', async () => {
        selectedCameraId = cameraSelect.value;
        const audioTrack = localPreviewStream.getAudioTracks()[0];
        localPreviewStream.getVideoTracks().forEach(track => track.stop());
        const newVideoStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selectedCameraId } } });
        localPreviewStream = new MediaStream([ ...newVideoStream.getVideoTracks(), audioTrack ]);
        videoPreview.srcObject = localPreviewStream;
    });

    micSelect.addEventListener('change', () => { selectedMicId = micSelect.value; });

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

    // --- INICIO ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});