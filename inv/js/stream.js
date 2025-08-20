// inv/js/stream.js - VERSIÓN DE DIAGNÓSTICO FINAL

document.addEventListener('DOMContentLoaded', () => {
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    
    // Elementos del DOM
    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const statusDiv = document.getElementById('status');
    const videoMainContainer = document.getElementById('video-main-container');
    
    // Nuevos elementos de control
    const startVideoBtn = document.getElementById('start-video-btn');
    const stopVideoBtn = document.getElementById('stop-video-btn');
    const startAudioBtn = document.getElementById('start-audio-btn');
    const stopAudioBtn = document.getElementById('stop-audio-btn');
    const guestLinkInput = document.getElementById('guest-link');
    const productionStatus = document.getElementById('production-status');

    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;

    // --- LOBBY (Sin cambios) ---
    async function setupLobby() {
        try {
            localPreviewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = localPreviewStream;
            joinButton.disabled = false;
        } catch (error) {
            statusDiv.textContent = 'Error: No se pudo acceder a la cámara.';
        }
    }

    // --- UNIRSE A LA SESIÓN (Lógica de roles añadida) ---
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global');
        localPreviewStream.getTracks().forEach(track => track.stop());

        // Verificamos si la URL indica que somos un invitado
        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = urlParams.get('role') === 'guest';
        
        const userName = isGuest ? 'Invitado-' + Math.floor(Math.random() * 1000) : 'Productor';
        const role_type = isGuest ? 0 : 1; // 0 para invitado, 1 para anfitrión

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type: role_type }),
            });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
        }
    }

    // --- MANEJO DE EVENTOS ---

    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
            stream = client.getMediaStream();

            // Generar y mostrar el enlace de invitado
            const guestUrl = `${window.location.origin}${window.location.pathname}?role=guest`;
            guestLinkInput.value = guestUrl;
        }
    });

    // Evento para renderizar a CUALQUIER usuario que se une (incluidos nosotros)
    client.on('user-added', async (payload) => {
        // Esta es una mejor manera de manejar múltiples usuarios
    });

    // --- LÓGICA DE LOS BOTONES DE DIAGNÓSTICO ---

    startVideoBtn.addEventListener('click', async () => {
        try {
            await stream.startVideo();
            const self = client.getCurrentUserInfo();
            const videoElement = await stream.attachVideo(self.userId, 3);
            videoMainContainer.innerHTML = '';
            videoMainContainer.appendChild(videoElement);
            productionStatus.textContent = "Tu video debería estar visible.";
        } catch (error) {
            console.error("Error al INICIAR VIDEO:", error);
            productionStatus.textContent = "Error al iniciar video. Revisa la consola.";
        }
    });

    stopVideoBtn.addEventListener('click', async () => {
        try {
            await stream.stopVideo();
            const self = client.getCurrentUserInfo();
            await stream.detachVideo(self.userId);
            videoMainContainer.innerHTML = ''; // Limpia el contenedor
            productionStatus.textContent = "Video detenido.";
        } catch (error) {
            console.error("Error al DETENER VIDEO:", error);
            productionStatus.textContent = "Error al detener video.";
        }
    });

    startAudioBtn.addEventListener('click', async () => {
        try {
            await stream.startAudio();
            productionStatus.textContent = "Audio iniciado. Deberías ver el permiso del micrófono.";
        } catch (error) {
            console.error("Error al INICIAR AUDIO:", error);
            productionStatus.textContent = "Error al iniciar audio.";
        }
    });

    stopAudioBtn.addEventListener('click', async () => {
        try {
            await stream.stopAudio();
            productionStatus.textContent = "Audio detenido.";
        } catch (error) {
            console.error("Error al DETENER AUDIO:", error);
            productionStatus.textContent = "Error al detener audio.";
        }
    });

    // --- INICIO ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});