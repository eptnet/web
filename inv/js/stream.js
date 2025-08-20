// inv/js/stream.js - VERSIÓN FINAL CON MANEJO DE EVENTO 'user-added'

document.addEventListener('DOMContentLoaded', () => {

    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 
    
    // Dejaremos que el usuario ingrese su nombre en el futuro, por ahora uno aleatorio
    let userName = 'Productor-' + Math.floor(Math.random() * 1000);

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

        statusDiv.textContent = 'Estado: Obteniendo firma...';
        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type: 1 }),
            });
            if (!response.ok) throw new Error(`Servidor respondió con: ${response.status}`);
            const { signature } = await response.json();
            if (!signature) throw new Error('Servidor no incluyó una firma.');
            
            statusDiv.textContent = 'Estado: Uniéndose a la sesión...';
            // Pasamos el nombre de usuario que definimos al inicio
            await client.join(SESSION_NAME, signature, userName);

        } catch (error) {
            console.error('Error al unirse:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión.';
            joinButton.disabled = false;
        }
    }

    // --- MANEJO DE EVENTOS DEL SDK REESTRUCTURADO ---

    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            statusDiv.textContent = 'Estado: ¡Conectado! Esperando usuario...';
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
            stream = client.getMediaStream();
        } else if (payload.state === 'Closed') {
            console.log("Sesión cerrada.");
            // Aquí podrías redirigir al lobby o mostrar un mensaje
        }
    });

    client.on('user-added', async (payload) => {
        // Este evento se dispara para CADA usuario que se une, incluyéndonos.
        // 'self' es una propiedad especial que nos dice si el usuario añadido somos nosotros.
        const currentUser = payload.find(user => user.isSelf);
        
        if (currentUser) {
            statusDiv.textContent = '¡Estás en vivo!';
            try {
                // Ahora que sabemos con certeza quiénes somos, iniciamos el video.
                await stream.startVideo({ cameraId: selectedCameraId });
                const videoElement = await stream.attachVideo(currentUser.userId, 3);
                videoMainContainer.innerHTML = '';
                videoMainContainer.appendChild(videoElement);
            } catch (error) {
                console.error("Error al iniciar el video:", error);
                videoMainContainer.innerHTML = '<p style="color:red;">No se pudo iniciar el video.</p>';
            }
        }
    });

    // --- INICIO DE LA APLICACIÓN ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);
});