// inv/js/stream.js - VERSIÓN FINAL Y DEFINITIVA

document.addEventListener('DOMContentLoaded', () => {

    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    
    // Elementos del DOM
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

    // --- FASE 1: LOBBY (COMPLETAMENTE RESTAURADO) ---
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

    // --- FASE 2: CONEXIÓN ---
    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        
        await client.init('en-US', 'Global');
        
        localPreviewStream.getTracks().forEach(track => track.stop());

        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = urlParams.get('role') === 'guest';
        const userName = isGuest ? 'Invitado-' + Math.floor(Math.random() * 1000) : 'Productor';
        const role_type = isGuest ? 0 : 1;

        statusDiv.textContent = 'Estado: Obteniendo firma...';
        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type: role_type }),
            });
            if (!response.ok) throw new Error(`Servidor respondió con: ${response.status}`);
            const { signature } = await response.json();
            
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

    // --- FASE 3: DENTRO DE LA SESIÓN ---
    client.on('connection-change', async (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
            stream = client.getMediaStream();
            
            // Iniciaremos el audio primero, ya que sabemos que funciona.
            try {
                await stream.startAudio();
            } catch (error) {
                console.error("Error al iniciar el audio", error);
            }
            // Ahora que estamos conectados y con audio, iniciamos el video.
            try {
                await stream.startVideo({ cameraId: selectedCameraId });
            } catch (error) {
                console.error("Error al iniciar el video", error);
            }
        }
    });

    // --- EL NUEVO RENDERIZADOR DE VIDEO ---
    client.on('peer-video-state-change', async (payload) => {
        const { action, userId } = payload;
        if (action === 'Start') {
            // Si el video de un usuario (incluido el nuestro) comienza, lo renderizamos.
            const videoElement = await stream.attachVideo(userId, 3);
            videoMainContainer.innerHTML = ''; // Reemplaza el video anterior
            videoMainContainer.appendChild(videoElement);
        } else if (action === 'Stop') {
            // Si el video de un usuario se detiene, lo quitamos.
            await stream.detachVideo(userId);
        }
    });

    // --- INICIO DE LA APLICACIÓN ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});