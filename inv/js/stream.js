// inv/js/stream.js - VERSIÓN COMPLETA Y FINAL

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
    const canvas = document.getElementById('composition-canvas');
    const ctx = canvas.getContext('2d');

    // --- CLIENTE DEL SDK Y ESTADO DE LA APLICACIÓN ---
    const ZoomVideo = window.WebVideoSDK.default; 
    const client = ZoomVideo.createClient();
    let stream;
    let chatClient;
    let liveStreamClient;
    let localPreviewStream;
    let isLive = false; 

    // --- ESTADO PARA LA COMPOSICIÓN POR CANVAS ---
    let compositionStream = null;
    let renderers = {};
    let drawLoopId = null;

    // --- CREDENCIALES RTMP (Reemplazar con las tuyas) ---
    const RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";
    const STREAM_KEY = "553a-09z3-de02-ms67-3pvj";

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
        await client.init('en-US', 'Global', { enforceMultipleVideos: true, rawData: { video: true } });
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
            if (!isGuest) {
                liveStreamClient = client.getLiveStreamClient();
            }

            await stream.startAudio({ audioId: micSelect.value });
            await stream.startVideo({ cameraId: cameraSelect.value });
            
            const selfId = client.getCurrentUserInfo().userId;
            createParticipantCard(selfId);
            if (!isGuest) {
                 const renderer = await stream.getVideoRenderer(selfId);
                 renderers[selfId] = renderer;
                 console.log(`Renderer creado para el productor (selfId: ${selfId})`);
            }

        } catch (error) {
            console.error('Error al unirse o iniciar medios:', error);
            joinButton.disabled = false;
        }
    }
    
    // =============================================================
    // --- LÓGICA DE EVENTOS Y COMUNICACIÓN ---
    // =============================================================
    
    client.on('connection-change', (payload) => {
        if (payload.state === 'Connected') {
            lobbyView.style.display = 'none';
            productionView.style.display = 'grid';
            if (!isGuest) {
                createAddSourceButton();
                handleSceneSelection('solo');
            }
        }
    });

    client.on('chat-new-message', (payload) => {
        if (!isGuest) return;
        try {
            const command = JSON.parse(payload.message);
            if (command.type === 'scene-change' || command.type === 'initial-state') {
                estadoProduccion.escenaActiva = command.scene;
                estadoProduccion.participantesEnEscena = command.participants;
                if (isLive || command.type === 'initial-state') {
                    renderizarEscena();
                }
            } else if (command.type === 'live-state-change') {
                isLive = command.status;
                if (!isLive) videoContainer.innerHTML = '';
            }
        } catch (error) { /* Ignora mensajes no JSON */ }
    });
    
    client.on('peer-video-state-change', async ({ action, userId }) => {
        if (action === 'Start') {
            createParticipantCard(userId);
            if (!isGuest && !renderers[userId]) {
                const renderer = await stream.getVideoRenderer(userId);
                renderers[userId] = renderer;
                console.log(`Renderer creado para el usuario ${userId}`);
            }
        } else if (action === 'Stop') {
            if (!isGuest && renderers[userId]) {
                await stream.destroyVideoRenderer(renderers[userId]);
                delete renderers[userId];
                console.log(`Renderer destruido para el usuario ${userId}`);
            }
        }
    });
    
    client.on('user-audio-status-changed', (payload) => {
        payload.forEach(user => {
            const muteBtn = document.getElementById(`mute-btn-${user.userId}`);
            if (muteBtn) {
                muteBtn.innerHTML = user.audio === 'muted' ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
            }
        });
    });

    client.on('user-removed', (payload) => {
        payload.forEach(u => {
            document.getElementById(`participant-card-${u.userId}`)?.remove();
            document.getElementById(`video-tile-${u.userId}`)?.remove();
            if(!isGuest && renderers[u.userId]) {
                stream.destroyVideoRenderer(renderers[u.userId]);
                delete renderers[u.userId];
            }
        });
    });

    client.on('live-stream-status', (payload) => console.log(`Estado de la transmisión: ${payload.status}`));

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

    // =================================================================
    // --- LÓGICA DE COMPOSICIÓN Y "GO LIVE" ---
    // =================================================================

    function startComposition() {
        if (drawLoopId) return; 
        console.log("Iniciando bucle de composición en canvas...");
        async function drawLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const layout = SCENE_LAYOUTS[estadoProduccion.escenaActiva];
            const participantes = estadoProduccion.participantesEnEscena;
            if (layout && participantes.length > 0) {
                for (let i = 0; i < participantes.length; i++) {
                    const userId = participantes[i];
                    const renderer = renderers[userId];
                    const position = layout.grid[i];
                    if (renderer && renderer.videoFrame && position) {
                        const colStart = parseInt(position.column.split(' / ')[0]) - 1;
                        const colEnd = parseInt(position.column.split(' / ')[1]) - 1;
                        const rowStart = parseInt(position.row.split(' / ')[0]) - 1;
                        const rowEnd = parseInt(position.row.split(' / ')[1]) - 1;
                        const x = (canvas.width / 4) * colStart;
                        const y = (canvas.height / 4) * rowStart;
                        const width = (canvas.width / 4) * (colEnd - colStart);
                        const height = (canvas.height / 4) * (rowEnd - rowStart);
                        ctx.drawImage(renderer.videoFrame, x, y, width, height);
                    }
                }
            }
            drawLoopId = requestAnimationFrame(drawLoop);
        }
        drawLoop();
        if (!compositionStream) {
            compositionStream = canvas.captureStream(30);
        }
    }

    async function toggleLiveStream() {
        isLive = !isLive;
        const liveButtonSpan = goLiveButton.querySelector('span');
        try {
            if (isLive) {
                if(liveButtonSpan) liveButtonSpan.textContent = 'FINALIZAR';
                goLiveButton.classList.add('streaming');
                liveIndicator.style.display = 'block';
                startComposition();
                await new Promise(resolve => setTimeout(resolve, 500));
                await stream.stopVideo(); 
                await stream.startVideo({ videoSource: compositionStream.getVideoTracks()[0] });
                await liveStreamClient.startLiveStream(RTMP_URL, STREAM_KEY, 'https://youtube.com');
                console.log("TRANSMISIÓN COMPUESTA EN VIVO INICIADA");
            } else {
                if(liveButtonSpan) liveButtonSpan.textContent = 'GO LIVE';
                goLiveButton.classList.remove('streaming');
                liveIndicator.style.display = 'none';
                await liveStreamClient.stopLiveStream();
                await stream.stopVideo();
                await stream.startVideo({ cameraId: cameraSelect.value });
                if (drawLoopId) {
                    cancelAnimationFrame(drawLoopId);
                    drawLoopId = null;
                }
                console.log("TRANSMISIÓN FINALIZADA");
            }
            if (chatClient) {
                chatClient.send(JSON.stringify({ type: 'live-state-change', status: isLive }));
            }
        } catch (error) {
            console.error("Error al gestionar la transmisión compuesta:", error);
            isLive = !isLive;
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
    cameraSelect.addEventListener('change', updateLobbyPreview);
    micSelect.addEventListener('change', updateLobbyPreview);
    joinButton.addEventListener('click', joinSession);
    
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