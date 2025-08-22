// inv/js/stream.js - VERSIÓN CON CONMUTADOR DE ESCENAS FUNCIONAL

document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y CONFIGURACIÓN ---
    const SIGNATURE_ENDPOINT = 'https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature'; 
    const SESSION_NAME = 'eptstream-production-room'; 

    // --- SELECCIÓN DE ELEMENTOS DEL DOM ---
    const lobbyView = document.getElementById('lobby');
    const productionView = document.getElementById('production-room');
    const joinButton = document.getElementById('join-button');
    const videoPreview = document.getElementById('video-preview');
    const cameraSelect = document.getElementById('camera-select');
    const micSelect = document.getElementById('mic-select');
    
    // Contenedores de la sala de producción
    const videoContainer = document.getElementById('video-container'); // El escenario principal
    const participantsGrid = document.getElementById('participants-grid'); // La "Green Room"
    const sceneButtonsContainer = document.getElementById('scene-buttons');

    // --- CLIENTE DEL SDK Y ESTADO DE LA APLICACIÓN ---
    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = '';

    // El "cerebro" que controla el estado de nuestra producción
    let estadoProduccion = {
        escenaActiva: null,            // ID del layout activo, ej: 'duo-horizontal'
        participantesEnEscena: [],     // Array de userIds que están EN el escenario
        participantesSeleccionados: [] // Array de userIds seleccionados en la Green Room para la próxima escena
    };

    // =============================================================
    // --- LÓGICA DEL LOBBY Y CONEXIÓN (Estable, sin cambios) ---
    // =============================================================
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
    
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global', { enforceMultipleVideos: true });
        if(localPreviewStream) localPreviewStream.getTracks().forEach(track => track.stop());

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
        } catch (error) { console.error('Error al unirse o iniciar medios:', error); }
    }
    
    // =================================================================
    // --- LÓGICA DE RENDERIZADO Y MANEJO DE EVENTOS (Actualizada) ---
    // =================================================================
    
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'block';
        }
    });

    // --- FUNCIÓN PARA POBLAR LA GREEN ROOM ---
    async function createParticipantCard(userId) {
        if (document.getElementById(`participant-card-${userId}`)) return;

        const user = client.getUser(userId);
        const card = document.createElement('div');
        card.className = 'participant-card';
        card.id = `participant-card-${userId}`;
        card.dataset.userId = userId; // Guardamos el ID para fácil acceso

        const videoElement = await stream.attachVideo(userId, 3); // Video en baja calidad para la miniatura
        
        const nameTag = document.createElement('span');
        nameTag.className = 'participant-name-thumb';
        nameTag.textContent = user.displayName;

        card.appendChild(videoElement);
        card.appendChild(nameTag);
        
        participantsGrid.appendChild(card);
    }

    client.on('peer-video-state-change', (payload) => {
        const { action, userId } = payload;
        if (action === 'Start') {
            createParticipantCard(userId);
        }
    });

    client.on('user-removed', (payload) => {
        payload.forEach(u => {
            document.getElementById(`participant-card-${u.userId}`)?.remove();
            document.getElementById(`video-tile-${u.userId}`)?.remove();
        });
    });

    // =================================================================
    // --- NUEVO: LÓGICA DEL CONMUTADOR DE ESCENAS ---
    // =================================================================

    // 1. Manejador para la selección de una ESCENA
    function handleSceneSelection(layoutId) {
        if (!SCENE_LAYOUTS[layoutId]) return;

        // Reseteamos selecciones anteriores
        estadoProduccion.participantesSeleccionados = [];
        document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        
        estadoProduccion.escenaActiva = layoutId;

        // Actualizamos la UI de los botones
        document.querySelectorAll('.scene-button.active').forEach(b => b.classList.remove('active'));
        sceneButtonsContainer.querySelector(`[data-layout="${layoutId}"]`).classList.add('active');

        // Si la escena no necesita participantes (ej. un layout vacío), la renderizamos ya
        if (SCENE_LAYOUTS[layoutId].participantCount === 0) {
            renderizarEscena();
        }
    }

    // 2. Manejador para la selección de un PARTICIPANTE
    function handleParticipantSelection(userId) {
        if (!estadoProduccion.escenaActiva) return; // No hacer nada si no hay una escena activa

        const { participantCount } = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
        const seleccionados = estadoProduccion.participantesSeleccionados;
        const card = document.getElementById(`participant-card-${userId}`);

        // Alternar selección
        if (seleccionados.includes(userId)) {
            // Deseleccionar
            estadoProduccion.participantesSeleccionados = seleccionados.filter(id => id !== userId);
            card.classList.remove('selected');
        } else {
            // Seleccionar, si aún hay espacio
            if (seleccionados.length < participantCount) {
                estadoProduccion.participantesSeleccionados.push(userId);
                card.classList.add('selected');
            }
        }

        // Si ya tenemos los participantes necesarios, renderizar la escena
        if (estadoProduccion.participantesSeleccionados.length === participantCount) {
            renderizarEscena();
        }
    }

    // 3. La función MÁGICA que renderiza la escena en el escenario principal
    async function renderizarEscena() {
        if (!estadoProduccion.escenaActiva) return;

        const layout = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
        const participantes = estadoProduccion.participantesSeleccionados;

        videoContainer.innerHTML = ''; // Limpiamos el escenario

        for (let i = 0; i < participantes.length; i++) {
            const userId = participantes[i];
            const gridPosition = layout.grid[i];

            const tile = document.createElement('div');
            tile.className = 'video-tile';
            tile.id = `video-tile-${userId}`;
            
            // Asignamos las coordenadas de la cuadrícula desde nuestro "plano"
            tile.style.gridColumn = gridPosition.column;
            tile.style.gridRow = gridPosition.row;

            // ¡Pedimos el video en ALTA CALIDAD para el escenario! (Calidad 1 = 720p)
            const videoElement = await stream.attachVideo(userId, 1);
            
            tile.appendChild(videoElement);
            videoContainer.appendChild(tile);
        }
        
        // Limpiamos el estado para la próxima selección
        estadoProduccion.escenaActiva = null;
        estadoProduccion.participantesSeleccionados = [];
        document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.scene-button.active').forEach(b => b.classList.remove('active'));
    }

    // =================================================================
    // --- INICIO DE LA APLICACIÓN Y EVENT LISTENERS GLOBALES ---
    // =================================================================
    
    setupLobby();
    joinButton.addEventListener('click', joinSession);

    // Usamos delegación de eventos para manejar los clics eficientemente
    sceneButtonsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.scene-button');
        if (button && button.dataset.layout) {
            handleSceneSelection(button.dataset.layout);
        }
    });

    participantsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.participant-card');
        if (card && card.dataset.userId) {
            handleParticipantSelection(parseInt(card.dataset.userId, 10));
        }
    });
});