// inv/js/stream.js - VERSIÓN COMPLETA Y VERIFICADA

document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA PARA LA VISTA DE INVITADO ---
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
    const goLiveButton = document.getElementById('go-live-button');
    const liveIndicator = document.getElementById('live-indicator');
    const outputsPanel = document.getElementById('outputs-panel');

    // --- CLIENTE DEL SDK Y ESTADO DE LA APLICACIÓN ---
    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let chatClient; // Para la comunicación
    let localPreviewStream;
    let isLive = false; 

    let estadoProduccion = {
        escenaActiva: 'solo',
        participantesEnEscena: [],
        participantesSeleccionados: [],
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
            video: { deviceId: { exact: cameraSelect.value } },
            audio: { deviceId: { exact: micSelect.value } }
        });
        videoPreview.srcObject = localPreviewStream;
    }

    async function joinSession() {
        joinButton.disabled = true;
        await client.init('en-US', 'Global', { enforceMultipleVideos: true });
        if (localPreviewStream) localPreviewStream.getTracks().forEach(track => track.stop());

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
            
            stream = client.getMediaStream();
            chatClient = client.getChatClient();

            await stream.startAudio({ audioId: micSelect.value });
            await stream.startVideo({ cameraId: cameraSelect.value });
            
            createParticipantCard(client.getCurrentUserInfo().userId);

            if (isGuest) {
                console.log("Soy un invitado, pidiendo la escena actual...");
                setTimeout(() => {
                    chatClient.send(JSON.stringify({ type: 'guest-request-scene' }));
                }, 1500); // Aumentado ligeramente para más estabilidad
            }

        } catch (error) {
            console.error('Error al unirse o iniciar medios:', error);
            joinButton.disabled = false; // Permite reintentar si falla
        }
    }
    
    // =================================================================
    // --- LÓGICA DE RENDERIZADO Y MANEJO DE EVENTOS ---
    // =================================================================
    
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'grid';
            if (!isGuest) {
                createAddSourceButton();
                handleSceneSelection('solo'); // Selecciona una escena por defecto para el productor
            }
        }
    });

    client.on('chat-new-message', (payload) => {
        try {
            const command = JSON.parse(payload.message);
            
            // Lógica para el PRODUCTOR: si recibe una petición, responde.
            if (!isGuest && command.type === 'guest-request-scene') {
                console.log('Petición de escena recibida. Respondiendo...');
                // Envía el estado actual del stream (si está en vivo) y la escena.
                chatClient.send(JSON.stringify({
                    type: 'initial-state',
                    isLive: isLive,
                    scene: estadoProduccion.escenaActiva,
                    participants: estadoProduccion.participantesEnEscena
                }));
                return;
            }

            // Lógica para el INVITADO
            if (isGuest) {
                if(command.type === 'scene-change' || command.type === 'initial-state') {
                    console.log('Comando de escena recibido:', command);
                    estadoProduccion.escenaActiva = command.scene;
                    estadoProduccion.participantesEnEscena = command.participants;
                    if (isLive || command.type === 'initial-state') {
                        renderizarEscena();
                    }
                }
                if(command.type === 'live-state-change') {
                    console.log('Comando de estado EN VIVO recibido:', command);
                    isLive = command.status;
                    if (isLive) {
                        renderizarEscena();
                    } else {
                        videoContainer.innerHTML = '';
                    }
                }
            }
        } catch (error) { /* Ignora mensajes que no son JSON */ }
    });

    async function createParticipantCard(userId) {
        if (document.getElementById(`participant-card-${userId}`)) return;
        const user = client.getUser(userId);
        const card = document.createElement('div');
        card.className = 'participant-card';
        card.id = `participant-card-${userId}`;
        card.dataset.userId = userId;

        const videoElement = await stream.attachVideo(userId, 3);
        const nameTag = document.createElement('span');
        nameTag.className = 'participant-name-thumb';
        nameTag.textContent = user.displayName;

        const muteBtn = document.createElement('button');
        muteBtn.className = 'participant-mute-btn';
        muteBtn.id = `mute-btn-${userId}`;
        muteBtn.title = 'Silenciar / Activar audio';
        
        if (user.audio === 'muted') {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        } else {
            muteBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        }
        
        muteBtn.onclick = (e) => {
            e.stopPropagation();
            const participant = client.getUser(userId);
            (participant.audio === 'muted') ? stream.unmuteAudio(userId) : stream.muteAudio(userId);
        };

        card.appendChild(videoElement);
        card.appendChild(nameTag);
        card.appendChild(muteBtn);
        participantsGrid.appendChild(card);
    }

    client.on('user-audio-status-changed', (payload) => {
        payload.forEach(user => {
            const muteBtn = document.getElementById(`mute-btn-${user.userId}`);
            if (muteBtn) {
                muteBtn.innerHTML = user.audio === 'muted' ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
            }
        });
    });

    function createAddSourceButton() {
        if (document.getElementById('add-source-card')) return;
        const card = document.createElement('div');
        card.className = 'participant-card add-card';
        card.id = 'add-source-card';
        card.innerHTML = '<i class="fa-solid fa-plus"></i>';
        card.title = 'Añadir Fuente (Copiar Enlace)';
        card.onclick = getInviteLink; 
        participantsGrid.appendChild(card);
    }

    function getInviteLink() {
        const inviteURL = window.location.href.split('?')[0] + '?role=guest';
        navigator.clipboard.writeText(inviteURL).then(() => {
            alert('¡Enlace de invitación copiado al portapapeles!');
        });
    }

    client.on('peer-video-state-change', ({ action, userId }) => {
        if (action === 'Start') createParticipantCard(userId);
    });

    client.on('user-removed', (payload) => {
        payload.forEach(u => {
            document.getElementById(`participant-card-${u.userId}`)?.remove();
            document.getElementById(`video-tile-${u.userId}`)?.remove();
        });
    });

    function toggleLiveStream() {
        isLive = !isLive;
        const liveButtonSpan = goLiveButton.querySelector('span');

        if (isLive) {
            if(liveButtonSpan) liveButtonSpan.textContent = 'FINALIZAR';
            goLiveButton.classList.add('streaming');
            liveIndicator.style.display = 'block';
            renderizarEscena();
        } else {
            if(liveButtonSpan) liveButtonSpan.textContent = 'GO LIVE';
            goLiveButton.classList.remove('streaming');
            liveIndicator.style.display = 'none';
        }
        
        if (chatClient) {
            chatClient.send(JSON.stringify({ type: 'live-state-change', status: isLive }));
        }
    }

    // =================================================================
    // --- LÓGICA DEL CONMUTADOR DE ESCENAS ---
    // =================================================================

    function handleSceneSelection(layoutId) {
        if (!SCENE_LAYOUTS[layoutId]) return;

        if (layoutId === estadoProduccion.escenaActiva && estadoProduccion.participantesEnEscena.length > 0) {
            estadoProduccion.participantesEnEscena = [];
            renderizarEscena();
            return;
        }
        
        estadoProduccion.escenaActiva = layoutId;
        document.querySelectorAll('.scene-button.active').forEach(b => b.classList.remove('active'));
        sceneButtonsContainer.querySelector(`[data-layout="${layoutId}"]`).classList.add('active');
        
        estadoProduccion.participantesSeleccionados = [];
        document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        renderizarEscena();
    }

    function handleParticipantSelection(userId) {
        if (!estadoProduccion.escenaActiva) return;
        const layout = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
        
        if (layout.participantCount === 1) {
            estadoProduccion.participantesEnEscena = [userId];
            renderizarEscena();
            return;
        }

        const seleccionados = estadoProduccion.participantesSeleccionados;
        const card = document.getElementById(`participant-card-${userId}`);
        
        if (seleccionados.includes(userId)) {
            estadoProduccion.participantesSeleccionados = seleccionados.filter(id => id !== userId);
            card.classList.remove('selected');
        } else {
            if (seleccionados.length < layout.participantCount) {
                estadoProduccion.participantesSeleccionados.push(userId);
                card.classList.add('selected');
            }
        }
        
        if (seleccionados.length === layout.participantCount) {
            estadoProduccion.participantesEnEscena = [...estadoProduccion.participantesSeleccionados];
            renderizarEscena();
            estadoProduccion.participantesSeleccionados = [];
            document.querySelectorAll('.participant-card.selected').forEach(c => c.classList.remove('selected'));
        }
    }

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
            const videoElement = await stream.attachVideo(userId, 1);
            const nameTag = document.createElement('span');
            nameTag.className = 'participant-name-thumb';
            nameTag.textContent = user.displayName;
            tile.appendChild(videoElement);
            tile.appendChild(nameTag);
            return tile;
        });

        const tiles = (await Promise.all(tilesPromises)).filter(Boolean);
        tiles.forEach(tile => videoContainer.appendChild(tile));

        if (!isGuest && chatClient) {
            try {
                chatClient.send(JSON.stringify({
                    type: 'scene-change',
                    scene: estadoProduccion.escenaActiva,
                    participants: estadoProduccion.participantesEnEscena
                }));
            } catch (error) {
                console.error("Error al enviar comando por chat:", error);
            }
        }
    }

    // =================================================================
    // --- INICIO DE LA APLICACIÓN Y EVENT LISTENERS GLOBALES ---
    // =================================================================
        
    setupLobby();

    // LISTENERS DEL LOBBY
    cameraSelect.addEventListener('change', updateLobbyPreview);
    micSelect.addEventListener('change', updateLobbyPreview);
    joinButton.addEventListener('click', joinSession);
    
    // LISTENERS DE LA SALA DE PRODUCCIÓN (SOLO PARA EL PRODUCTOR)
    if (!isGuest) {
        sceneButtonsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.scene-button');
            if (button?.dataset.layout) handleSceneSelection(button.dataset.layout);
        });

        participantsGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.participant-card');
            if (card?.dataset.userId) {
                handleParticipantSelection(parseInt(card.dataset.userId, 10));
            }
        });

        goLiveButton.addEventListener('click', toggleLiveStream);
        
        outputsPanel.querySelector('.icon-bar').addEventListener('click', e => {
            if (e.target.closest('.panel-button')) outputsPanel.classList.toggle('open');
        });
    }
});