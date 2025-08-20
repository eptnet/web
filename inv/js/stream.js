// Espera a que todo el contenido del DOM esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURACIÓN ---
    // Reemplaza esto con la URL de tu Supabase Edge Function
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    // Los detalles de la sesión pueden ser dinámicos en una aplicación real
    const SESSION_NAME = 'eptstream-production-room'; 
    const USER_NAME = 'Productor-' + Math.floor(Math.random() * 1000);
    const SESSION_PASSWORD = ''; // Opcional, si lo configuras en tu JWT

    // --- ELEMENTOS DEL DOM ---
    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const statusDiv = document.getElementById('status');
    const videoMainContainer = document.getElementById('video-main-container');

    // --- VARIABLES DEL SDK DE ZOOM ---
    // Referencia al objeto global del SDK cargado desde el CDN
    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localStream; // Para la vista previa del lobby

    // --- FASE 1: INICIALIZACIÓN Y LÓGICA DEL LOBBY ---

    async function setupLobby() {
        statusDiv.textContent = 'Estado: Inicializando SDK...';
        
        // 1a. Inicializar el cliente del SDK (según el manual)
        await client.init('en-US', 'Global', { patchJsMedia: true });
        statusDiv.textContent = 'Estado: SDK Inicializado. Pidiendo permisos...';

        try {
            // 1b. Pedir permisos de cámara/micrófono usando las APIs del navegador
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            // 1c. Mostrar la vista previa en el Lobby
            videoPreview.srcObject = localStream;
            videoPreview.play();

            statusDiv.textContent = 'Estado: Permisos concedidos. ¡Listo para unirte!';
            
            // 1d. Poblar el <select> con las cámaras disponibles
            // Usamos la función del SDK que ahora está disponible después de init()
            const mediaStream = client.getMediaStream();
            const cameras = mediaStream.getCameraList();
            cameras.forEach(camera => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.label;
                cameraSelect.appendChild(option);
            });

            // Habilitar el botón para unirse
            joinButton.disabled = false;
        } catch (error) {
            console.error('Error al obtener permisos o dispositivos:', error);
            statusDiv.textContent = 'Error: No se pudo acceder a la cámara. Revisa los permisos.';
            joinButton.disabled = true;
        }
    }

    // --- FASE 2: CONEXIÓN A LA SESIÓN DE ZOOM ---

    async function joinSession() {
        joinButton.disabled = true;
        statusDiv.textContent = 'Estado: Obteniendo firma del servidor...';

        try {
            // 2a. Obtener la firma JWT de nuestra Edge Function
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionName: SESSION_NAME,
                    role: 1 // Rol 1 para el anfitrión (host)
                }),
            });
            if (!response.ok) {
                throw new Error('La respuesta del servidor de firmas no fue exitosa.');
            }
            const { signature } = await response.json();

            statusDiv.textContent = 'Estado: Firma obtenida. Uniéndose a la sesión...';

            // 2b. Unirse a la sesión de Zoom
            await client.join(SESSION_NAME, signature, USER_NAME, SESSION_PASSWORD);
            
            // Si la conexión es exitosa, el listener 'connection-change' se encargará del resto
            
        } catch (error) {
            console.error('Error al unirse a la sesión:', error);
            statusDiv.textContent = 'Error: No se pudo unir a la sesión. Revisa la consola.';
            joinButton.disabled = false;
        }
    }

    // --- MANEJO DE EVENTOS DEL SDK ---

    // Este evento es CRUCIAL. Nos dice el estado de la conexión.
    client.on('connection-change', async (payload) => {
        console.log('Cambio de conexión:', payload);

        if (payload.state === 'Connected') {
            statusDiv.textContent = 'Estado: ¡Conectado!';
            
            // 3. Transición de Lobby a Sala de Producción
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';

            // Detener la vista previa del lobby para liberar la cámara
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            stream = client.getMediaStream();
            
            // 4. Iniciar y renderizar el video a través del SDK de Zoom
            // Inicia el video, pero no lo renderiza aún
            await stream.startVideo(); 
            
            // Renderiza el video del usuario actual en el contenedor principal
            const userVideo = await stream.attachVideo(client.getCurrentUserInfo().userId, 3); // 3 es una resolución media (ej. 360p)
            videoMainContainer.appendChild(userVideo);

        } else if (payload.state === 'Fail') {
            statusDiv.textContent = `Estado: Fallo en la conexión. Razón: ${payload.reason}`;
            console.error('Fallo en la conexión:', payload);
            joinButton.disabled = false;
        }
    });

    // --- INICIO DE LA APLICACIÓN ---
    setupLobby();
    joinButton.addEventListener('click', joinSession);

});