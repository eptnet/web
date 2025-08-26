// inv/js/stream.js - VERSIÓN FINAL CON RENDERIZADO ROBUSTO

document.addEventListener('DOMContentLoaded', () => {
    // --- NUEVO: Lógica para la Vista de Invitado ---
    const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
    if (isGuest) {
        document.body.classList.add('guest-view');
    }
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
    
    const videoContainer = document.getElementById('video-container');
    const participantsGrid = document.getElementById('participants-grid');
    const sceneButtonsContainer = document.getElementById('scene-buttons');

    let isLive = false; 
    const goLiveButton = document.getElementById('go-live-button');
    const liveIndicator = document.getElementById('live-indicator');
    const outputsPanel = document.getElementById('outputs-panel');

    // --- CLIENTE DEL SDK Y ESTADO DE LA APLICACIÓN ---
    const ZoomVideo = window.WebVideoSDK.default; 
    const VideoQuality = ZoomVideo.VideoQuality; 
    const client = ZoomVideo.createClient();
    let stream;
    let localPreviewStream;
    let selectedCameraId = '';
    let selectedMicId = '';

    let estadoProduccion = {
        escenaActiva: 'solo', // La escena 'solo' está activa por defecto
        participantesEnEscena: [], // Quién está EN VIVO ahora mismo
        participantesSeleccionados: [], // Buffer temporal para escenas de varios slots
        anclado: null // Para anclar un participante en un slot
    };

    // =============================================================
    // --- LÓGICA DEL LOBBY Y CONEXIÓN ---
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
    
    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global', { enforceMultipleVideos: true });
        if (localPreviewStream) localPreviewStream.getTracks().forEach(track => track.stop());

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        const userName = isGuest ? `Invitado-${Math.floor(Math.random() * 1000)}` : 'Productor';
        const role_type = isGuest ? 0 : 1;

        try {
            const response = await fetch(SIGNATURE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName: SESSION_NAME, role_type })
            });
            const { signature } = await response.json();
            await client.join(SESSION_NAME, signature, userName);
            
            // 1. Se crea el stream
            stream = client.getMediaStream();

            // 2. AHORA SÍ: Activamos el "oído" para la comunicación
            stream.on('data-received', (payload) => {
                try {
                    const command = JSON.parse(payload.data);
                    const isGuestUser = new URLSearchParams(window.location.search).get('role') === 'guest';

                    if (!isGuestUser && command.type === 'guest-request-scene') {
                        console.log('Petición de escena recibida de un invitado. Respondiendo...');
                        stream.sendData(JSON.stringify({
                            type: 'scene-change',
                            scene: estadoProduccion.escenaActiva,
                            participants: estadoProduccion.participantesEnEscena
                        }));
                    }

                    if (isGuestUser && command.type === 'scene-change') {
                        console.log('Respuesta de escena recibida:', command);
                        estadoProduccion.escenaActiva = command.scene;
                        estadoProduccion.participantesEnEscena = command.participants;
                        renderizarEscena();
                    }
                } catch (error) {
                    console.error('Error al procesar datos recibidos:', error);
                }
            });

            // 3. Continuamos con el resto de la lógica
            await stream.startAudio({ audioId: micSelect.value });
            await stream.startVideo({ cameraId: cameraSelect.value });
            createParticipantCard(client.getCurrentUserInfo().userId);

            if (isGuest) {
                console.log("Soy un invitado, pidiendo la escena actual...");
                setTimeout(() => {
                    stream.sendData(JSON.stringify({ type: 'guest-request-scene' }));
                }, 1000);
            }

        } catch (error) {
            console.error('Error al unirse o iniciar medios:', error);
        }
    }
    
    // =================================================================
    // --- LÓGICA DE RENDERIZADO Y MANEJO DE EVENTOS ---
    // =================================================================
    
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'grid';
            createAddSourceButton();
        }
    });

    async function createParticipantCard(userId) {
        if (document.getElementById(`participant-card-${userId}`)) return;
        const user = client.getUser(userId);
        
        const card = document.createElement('div');
        card.className = 'participant-card';
        card.id = `participant-card-${userId}`;
        card.dataset.userId = userId;

        const videoElement = await stream.attachVideo(userId, VideoQuality.Video_180P);
        
        const nameTag = document.createElement('span');
        nameTag.className = 'participant-name-thumb';
        nameTag.textContent = user.displayName;

        // --- LÓGICA DEL BOTÓN DE SILENCIO MEJORADA ---
        const muteBtn = document.createElement('button');
        muteBtn.className = 'participant-mute-btn';
        muteBtn.id = `mute-btn-${userId}`;
        muteBtn.title = 'Silenciar / Activar audio';
        
        // Establecemos el ícono inicial CORRECTO al crear la tarjeta
        if (user.audio === 'muted') {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        } else {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        }
        
        // La lógica de clic ahora solo ENVÍA la orden
        muteBtn.onclick = (e) => {
            e.stopPropagation();
            const participant = client.getUser(userId);
            if (participant.audio === 'muted') {
                stream.unmuteAudio(userId);
            } else {
                stream.muteAudio(userId);
            }
        };

        card.appendChild(videoElement);
        card.appendChild(nameTag);
        card.appendChild(muteBtn);
        
        participantsGrid.appendChild(card);
    }

    function createAddSourceButton() {
        if (document.getElementById('add-source-card')) return;
        const card = document.createElement('div');
        card.className = 'participant-card add-card';
        card.id = 'add-source-card';
        card.innerHTML = '<i class="fa-solid fa-plus"></i>';
        card.title = 'Añadir Fuente (Copiar Enlace de Invitación)';
        // CORRECCIÓN: Asignamos el clic aquí, de forma segura.
        card.onclick = getInviteLink; 
        participantsGrid.appendChild(card);
    }

    client.on('user-audio-status-changed', (payload) => {
        payload.forEach(user => {
            const muteBtn = document.getElementById(`mute-btn-${user.userId}`);
            if (muteBtn) {
                if (user.audio === 'muted') {
                    muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
                } else {
                    muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
                }
            }
        });
    });

    // --- NUEVO: Función para generar el enlace de invitación ---
    function getInviteLink() {
        const inviteURL = window.location.origin + window.location.pathname + '?role=guest';
        navigator.clipboard.writeText(inviteURL).then(() => {
            alert('¡Enlace de invitación copiado al portapapeles!');
        }).catch(err => {
            console.error('Error al copiar el enlace: ', err);
            prompt('Copia manualmente este enlace:', inviteURL);
        });
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

    // --- NUEVO: Lógica del Sidebar ---
    // Hacemos que el panel se abra/cierre al hacer clic en un botón de ícono
    outputsPanel.querySelector('.icon-bar').addEventListener('click', (e) => {
        if (e.target.closest('.panel-button')) {
            outputsPanel.classList.toggle('open');
        }
    });

    // --- NUEVO: Lógica de "Go Live" ---
    function toggleLiveStream() {
        isLive = !isLive; // Invierte el estado

        if (isLive) {
            // --- INICIAR STREAM ---
            goLiveButton.querySelector('span').textContent = 'FINALIZAR';
            goLiveButton.classList.add('streaming');
            liveIndicator.style.display = 'block';

            console.log("STREAM INICIADO");
            // Aquí iría la lógica para conectar a un servicio de streaming (RTMP)

        } else {
            // --- FINALIZAR STREAM ---
            goLiveButton.querySelector('span').textContent = 'GO LIVE';
            goLiveButton.classList.remove('streaming');
            liveIndicator.style.display = 'none';

            console.log("STREAM FINALIZADO");
        }
    }

    // =================================================================
    // --- LÓGICA DEL CONMUTADOR DE ESCENAS ---
    // =================================================================

    function handleSceneSelection(layoutId) {
        if (!SCENE_LAYOUTS[layoutId]) return;

        // --- NUEVA LÓGICA: LIMPIAR ESCENARIO ---
        // Si hacemos clic en la escena que ya está activa, la vaciamos.
        if (layoutId === estadoProduccion.escenaActiva && estadoProduccion.participantesEnEscena.length > 0) {
            estadoProduccion.participantesEnEscena = [];
            renderizarEscena();
            return; // Salimos de la función aquí.
        }
        
        console.log(`Escena activa cambiada a: ${layoutId}`);
        estadoProduccion.escenaActiva = layoutId;
        
        // Actualiza visualmente el botón activo
        document.querySelectorAll('.scene-button.active').forEach(b => b.classList.remove('active'));
        sceneButtonsContainer.querySelector(`[data-layout="${layoutId}"]`).classList.add('active');
        
        // Limpiamos la selección temporal al cambiar de escena
        estadoProduccion.participantesSeleccionados = [];
        document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        
        // Al seleccionar una nueva escena, podemos intentar renderizar con lo que ya había, si cabe
        renderizarEscena();
    }

    function handleParticipantSelection(userId) {
        if (!estadoProduccion.escenaActiva) return;

        const layout = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
        
        // Lógica para escenas de 1 participante (cambio instantáneo)
        if (layout.participantCount === 1) {
            estadoProduccion.participantesEnEscena = [userId];
            renderizarEscena();
            return;
        }

        // Lógica para escenas de más de 1 participante
        const seleccionados = estadoProduccion.participantesSeleccionados;
        const card = document.getElementById(`participant-card-${userId}`);
        
        if (seleccionados.includes(userId)) {
            // Deseleccionar
            estadoProduccion.participantesSeleccionados = seleccionados.filter(id => id !== userId);
            card.classList.remove('selected');
        } else {
            // Seleccionar, si hay espacio
            if (seleccionados.length < layout.participantCount) {
                estadoProduccion.participantesSeleccionados.push(userId);
                card.classList.add('selected');
            }
        }
        
        // Si hemos llenado todos los slots, renderizamos la escena
        if (estadoProduccion.participantesSeleccionados.length === layout.participantCount) {
            estadoProduccion.participantesEnEscena = [...estadoProduccion.participantesSeleccionados];
            renderizarEscena();
            
            // Limpiamos la selección temporal para la próxima conmutación
            estadoProduccion.participantesSeleccionados = [];
            document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        }
    }

    // --- FUNCIÓN DE RENDERIZADO (REESCRITA Y ROBUSTA) ---
    async function renderizarEscena() {
        if (!estadoProduccion.escenaActiva) {
            videoContainer.innerHTML = '';
            return;
        }
        const layout = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
        const participantes = estadoProduccion.participantesEnEscena;
        videoContainer.innerHTML = '';

        const tilesPromises = participantes.map(async (userId, index) => {
            if (!layout.grid[index]) return null;
            const user = client.getUser(userId);
            const tile = document.createElement('div');
            tile.className = 'video-tile';
            tile.style.gridColumn = layout.grid[index].column;
            tile.style.gridRow = layout.grid[index].row;
            const videoElement = await stream.attachVideo(userId, VideoQuality.Video_720P); 
            const nameTag = document.createElement('span');
            nameTag.className = 'participant-name-thumb';
            nameTag.textContent = user.displayName;
            tile.appendChild(videoElement);
            tile.appendChild(nameTag);
            return tile;
        });

        const tiles = (await Promise.all(tilesPromises)).filter(Boolean);
        tiles.forEach(tile => videoContainer.appendChild(tile));

        const isGuest = new URLSearchParams(window.location.search).get('role') === 'guest';
        // Si soy el productor, envío una actualización a todos.
        if (!isGuest) {
            stream.sendData(JSON.stringify({
                type: 'scene-change',
                scene: estadoProduccion.escenaActiva,
                participants: estadoProduccion.participantesEnEscena
            }));
        }
    }

    // =================================================================
    // --- INICIO DE LA APLICACIÓN Y EVENT LISTENERS GLOBALES ---
    // =================================================================
        
    setupLobby();
    joinButton.addEventListener('click', joinSession);

    sceneButtonsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.scene-button');
        if (button && button.dataset.layout) {
            handleSceneSelection(button.dataset.layout);
        }
    });

    participantsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.participant-card');
        // Aseguramos que no se active al hacer clic en el botón de añadir
        if (card && card.dataset.userId) {
            handleParticipantSelection(parseInt(card.dataset.userId, 10));
        }
    });

    goLiveButton.addEventListener('click', toggleLiveStream);
    // CORRECCIÓN: La siguiente línea ha sido eliminada para evitar el crash.
    // document.getElementById('add-source-button').addEventListener('click', getInviteLink);
});