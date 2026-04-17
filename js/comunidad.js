// =================================================================
// ARCHIVO INICIAL: /inv/js/comunidad.js
// PROPÓSITO: Gestionar la nueva página de la comunidad interactiva.
// =================================================================

const ComunidadApp = {
    supabase: null,
    user: null,
    userProfile: null,
    bskyCreds: null,
    selectedImageFile: null,

    // --- INICIALIZACIÓN DE LA APLICACIÓN ---
    async init() {
        this.supabase = window.supabaseClient;
        await this.handleUserSession();
        
        // Atrapamos la redirección si el usuario se autenticó desde la página de comunidad
        this.checkForBlueskyCallback(); 
        
        this.subscribeToLiveBroadcasts();
        this.addEventListeners();
    },

    // --- GESTIÓN DE LA SESIÓN DEL USUARIO ---
    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();

        // MODO INVITADO: Si no hay sesión, dejamos pasar pero sin perfil
        if (!session) { 
            this.user = null; this.userProfile = null; this.bskyCreds = null;
            this.renderUserPanel(); 
            this.toggleCreatePostBox(); 
            this.renderFeed(); 
            this.renderFeaturedMembers(); 
            this.renderLatestPublications(); 
            this.renderSidebarEvents(); 
            this.fetchLatestPodcast();
            return; 
        }

        this.user = session.user;
        const [profileResponse, credsResponse] = await Promise.all([
            this.supabase.from('profiles').select('*').eq('id', this.user.id).single(),
            this.supabase.from('bsky_credentials').select('*').eq('user_id', this.user.id).single()
        ]);

        this.userProfile = profileResponse.data;
        this.bskyCreds = credsResponse.data;

        this.renderUserPanel();
        this.renderBskyStatus();
        this.toggleCreatePostBox();
        this.renderFeed();
        this.renderFeaturedMembers();
        this.renderLatestPublications();
        this.renderSidebarEvents();
        this.fetchLatestPodcast();
    },

    subscribeToLiveBroadcasts() {
        console.log("📡 Suscribiendo a directos activos en Supabase...");
        this.supabase.channel('public:active_broadcasts')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'active_broadcasts' 
            }, payload => {
                console.log('⚡ Cambio en directos detectado:', payload);
                this.handleLiveStatusChange(payload);
            })
            .subscribe();
    },

    async handleLiveStatusChange(payload) {
        await this.renderFeaturedMembers();
    },

    // ==========================================
    // MOTOR DE STREAMING DIRECTO V2 (SETUP + LIVE)
    // ==========================================
    localMediaStream: null,
    peerConnection: null,
    isMicMuted: false,
    isCameraOff: false,
    currentFacingMode: "user",
    audioContext: null,
    visualizerAnimationId: null,

    openGoLiveModal() {
        const studio = document.getElementById('golive-fullscreen-studio');
        if (!studio) return;
        
        studio.classList.remove('hidden');
        
        // Fase 1: Mostrar Setup, ocultar Live UI
        document.getElementById('golive-setup-panel').classList.remove('hidden');
        document.getElementById('golive-live-ui').classList.add('hidden');
        
        // Cargar foto de perfil en el avatar por si acaso
        const avatarImg = document.getElementById('golive-audio-avatar');
        if (avatarImg && this.userProfile) avatarImg.src = this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';

        // Listeners Fase 1
        document.getElementById('btn-close-setup').onclick = () => this.closeGoLiveModal();
        document.getElementById('btn-ready-to-live').onclick = () => this.startBroadcastToStreamplace();
        document.getElementById('btn-switch-lens').onclick = () => this.switchLens(); // <-- NUEVO
        document.getElementById('btn-toggle-camera').onclick = () => this.toggleCamera();
        document.getElementById('golive-video-select').onchange = () => this.startCameraPreview(true);
        document.getElementById('golive-audio-select').onchange = () => this.startCameraPreview(true);

        // Arrancar cámara por defecto y leer dispositivos
        this.startCameraPreview(false);
    },

    closeGoLiveModal() {
        if (this.peerConnection) {
            alert("Detén la transmisión en el botón cuadrado antes de salir.");
            return;
        }

        this.stopLocalMedia();
        document.getElementById('golive-fullscreen-studio').classList.add('hidden');
    },

    stopLocalMedia() {
        if (this.localMediaStream) {
            this.localMediaStream.getTracks().forEach(track => track.stop());
            this.localMediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            cancelAnimationFrame(this.visualizerAnimationId);
        }
    },

    async startCameraPreview(isDeviceChange = false) {
        try {
            if (this.localMediaStream) {
                this.localMediaStream.getTracks().forEach(track => track.stop());
            }

            const videoSelect = document.getElementById('golive-video-select');
            const audioSelect = document.getElementById('golive-audio-select');

            const constraints = {
                video: videoSelect?.value ? { deviceId: { exact: videoSelect.value }, width: {ideal:1280}, height: {ideal:720} } : { width: {ideal:1280}, height: {ideal:720}, facingMode: "user" },
                audio: audioSelect?.value ? { deviceId: { exact: audioSelect.value }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localMediaStream = stream;
            
            const previewVideo = document.getElementById('golive-local-video');
            if (previewVideo) {
                previewVideo.srcObject = stream;
                // Espejo solo si no se seleccionó cámara específica (asumiendo frontal de móvil)
                previewVideo.style.transform = !videoSelect?.value ? "scaleX(-1)" : "scaleX(1)";
            }

            // Llenar listas la primera vez
            if (!isDeviceChange) await this.populateDeviceSelectors();

        } catch (error) {
            console.error("Error cámara:", error);
        }
    },

    async switchLens() {
        // Si estamos en modo "Radio/Audio", no giramos la cámara
        if (this.isCameraOff) return;

        try {
            // 1. Obtener TODAS las cámaras conectadas
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            if (videoDevices.length < 2) {
                window.showToast ? window.showToast("No se encontraron cámaras adicionales.") : alert("No se encontraron cámaras adicionales.");
                return;
            }

            // 2. Identificar la cámara actual y cuál es la siguiente
            const currentTrack = this.localMediaStream.getVideoTracks()[0];
            const currentDeviceId = currentTrack.getSettings().deviceId;

            let currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
            let nextIndex = (currentIndex + 1) % videoDevices.length; 
            let nextDevice = videoDevices[nextIndex];

            // 🛑 EL FIX PARA MÓVILES: Liberar el hardware ANTES de pedir la nueva cámara
            if (currentTrack) {
                currentTrack.stop(); // Apagamos el sensor físicamente
                this.localMediaStream.removeTrack(currentTrack);
            }

            // 3. Ahora sí, con el hardware libre, pedimos la nueva cámara
            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: { exact: nextDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            
            const newVideoTrack = newStream.getVideoTracks()[0];
            const videoEl = document.getElementById('golive-local-video');
            
            // 4. Lógica de Efecto Espejo
            const label = nextDevice.label.toLowerCase();
            const isFront = label.includes('front') || label.includes('user') || label.includes('frontal') || (nextIndex === 0 && !label.includes('back') && !label.includes('environment'));
            videoEl.style.transform = isFront ? "scaleX(-1)" : "scaleX(1)";
            
            // 5. Inyectamos el nuevo track a nuestro stream local
            this.localMediaStream.addTrack(newVideoTrack);
            
            // 6. Magia WebRTC: Reemplazamos la señal que va a Streamplace (Sin cortar el directo)
            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                }
            }

            // 7. Sincronizamos la UI
            const videoSelect = document.getElementById('golive-video-select');
            if (videoSelect) videoSelect.value = nextDevice.deviceId;
            
        } catch (err) {
            console.error("Error al cambiar de cámara:", err);
            alert("No se pudo acceder a la cámara. El dispositivo puede estar bloqueado.");
            // Recuperación de emergencia: reiniciamos el sensor para no quedarnos en negro
            this.startCameraPreview();
        }
    },

    async populateDeviceSelectors() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoSelect = document.getElementById('golive-video-select');
            const audioSelect = document.getElementById('golive-audio-select');
            if (!videoSelect || !audioSelect) return;

            videoSelect.innerHTML = ''; audioSelect.innerHTML = '';
            let vCount = 1, aCount = 1;

            devices.forEach(device => {
                if (device.kind === 'videoinput') {
                    const opt = document.createElement('option');
                    opt.value = device.deviceId; opt.text = device.label || `Cámara ${vCount++}`;
                    if (this.localMediaStream && this.localMediaStream.getVideoTracks()[0]?.getSettings().deviceId === device.deviceId) opt.selected = true;
                    videoSelect.appendChild(opt);
                } else if (device.kind === 'audioinput') {
                    const opt = document.createElement('option');
                    opt.value = device.deviceId; opt.text = device.label || `Micrófono ${aCount++}`;
                    if (this.localMediaStream && this.localMediaStream.getAudioTracks()[0]?.getSettings().deviceId === device.deviceId) opt.selected = true;
                    audioSelect.appendChild(opt);
                }
            });
        } catch (err) { console.error("Error dispositivos:", err); }
    },

    // --- ACCIONES EN VIVO ---

    async toggleCamera() {
        if (!this.localMediaStream) return;
        const videoTrack = this.localMediaStream.getVideoTracks()[0];
        if (!videoTrack) return;

        this.isCameraOff = !this.isCameraOff;
        
        const videoEl = document.getElementById('golive-local-video');
        const audioModeEl = document.getElementById('golive-audio-mode');
        const btnCam = document.getElementById('btn-toggle-camera');
        
        // Buscamos si ya estamos transmitiendo a Streamplace
        const sender = this.peerConnection ? this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video') : null;

        if (this.isCameraOff) {
            // 1. Ocultar video local, mostrar Canvas
            videoEl.classList.add('hidden');
            audioModeEl.classList.remove('hidden');
            btnCam.innerHTML = '<i class="fa-solid fa-video-slash" style="color: #ef4444;"></i>';
            
            // 2. Apagar la cámara web para que se apague la luz de tu PC
            videoTrack.enabled = false; 

            // 3. Iniciar el dibujado del Canvas
            this.startAudioVisualizer();
            
            // 4. EL TRUCO: Capturar el canvas a 30 FPS y enviarlo a Streamplace
            if (sender) {
                const canvas = document.getElementById('golive-visualizer');
                const canvasStream = canvas.captureStream(30); 
                await sender.replaceTrack(canvasStream.getVideoTracks()[0]);
            }
        } else {
            // 1. Mostrar video local, ocultar Canvas
            videoEl.classList.remove('hidden');
            audioModeEl.classList.add('hidden');
            btnCam.innerHTML = '<i class="fa-solid fa-video"></i>';
            
            // 2. Detener la animación del Canvas para ahorrar batería
            if (this.visualizerAnimationId) cancelAnimationFrame(this.visualizerAnimationId);
            
            // 3. Encender la cámara web de nuevo
            videoTrack.enabled = true;
            
            // 4. Devolver la señal de la cámara a Streamplace
            if (sender) {
                await sender.replaceTrack(videoTrack);
            }
        }
    },

    toggleMic() {
        if (!this.localMediaStream) return;
        const audioTrack = this.localMediaStream.getAudioTracks()[0];
        if (!audioTrack) return;

        this.isMicMuted = !this.isMicMuted;
        audioTrack.enabled = !this.isMicMuted; // Mutea el envío
        
        const btnMic = document.getElementById('btn-toggle-mic');
        btnMic.innerHTML = this.isMicMuted ? '<i class="fa-solid fa-microphone-slash" style="color: #ef4444;"></i>' : '<i class="fa-solid fa-microphone"></i>';
    },

    startAudioVisualizer() {
        const canvas = document.getElementById('golive-visualizer');
        const container = document.getElementById('golive-audio-mode');
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        
        // CRÍTICO: Tomar la resolución real del contenedor para evitar el estiramiento
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const avatarImg = new Image();
        avatarImg.crossOrigin = "anonymous"; 
        avatarImg.src = this.userProfile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.localMediaStream);
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            this.analyser = analyser;
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            this.visualizerAnimationId = requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            // Radio dinámico: 15% del lado más pequeño de la pantalla (siempre será redondo)
            const radius = Math.min(canvas.width, canvas.height) * 0.15; 

            ctx.lineWidth = 4;
            for(let i = 0; i < bufferLength; i++) {
                // Ajustamos la altura de la onda basándonos en el tamaño de la pantalla
                const barHeight = (dataArray[i] / 255) * (radius * 0.8); 
                const rads = (Math.PI * 2) / bufferLength;
                const angle = rads * i;
                
                const xStart = centerX + Math.cos(angle) * radius;
                const yStart = centerY + Math.sin(angle) * radius;
                const xEnd = centerX + Math.cos(angle) * (radius + barHeight);
                const yEnd = centerY + Math.sin(angle) * (radius + barHeight);

                ctx.strokeStyle = `rgba(239, 68, 68, ${dataArray[i]/255 + 0.2})`; 
                ctx.beginPath();
                ctx.moveTo(xStart, yStart);
                ctx.lineTo(xEnd, yEnd);
                ctx.stroke();
            }

            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            
            if (avatarImg.complete && avatarImg.naturalHeight !== 0) {
                ctx.drawImage(avatarImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
            } else {
                ctx.fillStyle = '#1e293b';
                ctx.fill();
            }
            ctx.restore();
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2, true);
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#b72a1e';
            ctx.stroke();
        };
        
        if (avatarImg.complete) { draw(); } 
        else { avatarImg.onload = draw; }
    },

    // --- CONEXIÓN AL SERVIDOR (FASE 2: AT PROTOCOL) ---
    async startBroadcastToStreamplace() {
        const btnReady = document.getElementById('btn-ready-to-live');
        if (btnReady) {
            btnReady.disabled = true;
            btnReady.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
        }
        
        try {
            // Protección por si bskyCreds es null (Usuario recién registrado)
            if (!this.bskyCreds) this.bskyCreds = {};
            
            const streamKey = this.bskyCreds.stream_key;
            if (!streamKey) {
                if (btnReady) {
                    btnReady.disabled = false;
                    btnReady.innerHTML = '<i class="fa-solid fa-bolt"></i> Iniciar Transmisión';
                }
                this.openStreamKeyModal();
                return;
            }

            const { data, error } = await this.supabase.functions.invoke('start-broadcast', {
                body: { streamKey: streamKey }
            });

            if (error) throw error;
            if (!data || !data.ingestUrl) throw new Error("La Edge Function no devolvió una URL válida.");

            const whipUrl = data.ingestUrl;
            
            this.peerConnection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
            
            if (this.isCameraOff) {
                const canvas = document.getElementById('golive-visualizer');
                const canvasStream = canvas.captureStream(30);
                this.peerConnection.addTrack(canvasStream.getVideoTracks()[0], this.localMediaStream); 
                this.peerConnection.addTrack(this.localMediaStream.getAudioTracks()[0], this.localMediaStream); 
            } else {
                this.localMediaStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localMediaStream));
            }

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // POST de WHIP (Aquí viaja la llave, esto ya lo tienes perfecto)
            const response = await fetch(whipUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/sdp',
                    'Authorization': `Bearer ${streamKey}`
                },
                body: offer.sdp
            });

            if (!response.ok) throw new Error("Fallo en servidor WHIP: " + response.statusText);

            const answerSdp = await response.text();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

            // TRANSICIÓN DE FASE
            document.getElementById('golive-setup-panel').classList.add('hidden');
            document.getElementById('golive-live-ui').classList.remove('hidden');
            
            document.getElementById('btn-switch-lens').onclick = () => this.switchLens();
            document.getElementById('btn-toggle-camera').onclick = () => this.toggleCamera();
            document.getElementById('btn-toggle-mic').onclick = () => this.toggleMic();
            document.getElementById('btn-stop-broadcast').onclick = () => this.stopBroadcast();
            
            document.getElementById('btn-toggle-studio-chat').onclick = () => {
                const chatOverlay = document.getElementById('studio-chat-overlay');
                chatOverlay.classList.toggle('hidden');
                this.wakeUpChatOverlay();
            };

            // FIX CRÍTICO BLINDADO V2
            let broadcastId = null;
            if (data && (data.id || data.broadcast_id || data.broadcastId)) {
                broadcastId = data.id || data.broadcast_id || data.broadcastId;
            } else {
                for(let i=0; i<4; i++) {
                    const { data: dbData, error: dbError } = await this.supabase.from('active_broadcasts')
                        .select('id').eq('user_id', this.user.id).eq('status', 'live').limit(1); 
                    
                    if (dbData && dbData.length > 0) { 
                        broadcastId = dbData[0].id; 
                        break; 
                    }
                    if (dbError) console.error("Error buscando ID:", dbError);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (broadcastId) {
                this.currentBroadcastId = broadcastId;
                document.getElementById('studio-chat-overlay').classList.remove('hidden');
                this.setupRobustChatInput('studio-chat-input', 'btn-send-studio-chat');
                this.initUnifiedChat(broadcastId, 'studio-chat-messages');
                this.setupBroadcasterFadeOut();
            } else {
                console.error("No se pudo obtener el ID del directo.");
            }
        } catch (err) {
            console.error("Error al transmitir:", err);
            const btnReady = document.getElementById('btn-ready-to-live');
            if (btnReady) {
                btnReady.disabled = false;
                btnReady.innerHTML = '<i class="fa-solid fa-bolt"></i> Reintentar Transmisión';
            }
            
            if (this.supabase && this.user) {
                try {
                    // ELIMINADO EL 'ended_at' PARA EVITAR QUE SE CONGELE LA APP
                    await this.supabase.from('active_broadcasts')
                        .update({ status: 'ended' }) 
                        .eq('user_id', this.user.id).eq('status', 'live');
                } catch(e) {
                    console.error("Error al limpiar estado live:", e);
                }
            }
        }
    },

    async stopBroadcast() {
        if (!confirm("¿Seguro que deseas terminar la transmisión?")) return;
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.studioChatChannel) {
            this.supabase.removeChannel(this.studioChatChannel);
            this.studioChatChannel = null;
        }
        
        try {
            await this.supabase.from('active_broadcasts')
                .update({ status: 'ended' }) // ¡SIN ended_at!
                .eq('user_id', this.user.id).eq('status', 'live');
        } catch(e) { console.error(e); }

        this.closeGoLiveModal();
        if (window.showToast) window.showToast("Transmisión finalizada.");
    },

    // --- CHAT DEL BROADCASTER (ESTUDIO EXPRESS) ---
    studioChatChannel: null,

    // Función auxiliar para asegurar que el teclado móvil envíe el mensaje
    setupChatListeners(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        
        const triggerSend = () => {
            const val = input.value.trim();
            if (val) {
                this.sendLiveChatMessage(val);
                input.value = '';
                input.focus();
            }
        };

        btn.onclick = (e) => { e.preventDefault(); triggerSend(); };
        input.onkeydown = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                triggerSend();
            }
        };
    },

   

    // --- RENDERIZADO DE COMPONENTES DE LA UI ---

    /**
     * Muestra la información del usuario en el panel izquierdo.
     */
    async renderUserPanel() {
        const loadingPanel = document.getElementById('user-panel-loading');
        const contentPanel = document.getElementById('user-panel-content');
        
        if (this.userProfile) {
            const userName = this.userProfile.display_name || 'Sin nombre';
            const fallbackAvatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(userName)}`;
            document.getElementById('user-panel-avatar').src = this.userProfile.avatar_url || fallbackAvatar;

            // --- NUEVO: Cargar Slogan y Bio ---
            const sloganEl = document.getElementById('user-panel-slogan');
            const bioEl = document.getElementById('user-panel-bio');

            if (this.userProfile.bio_short) {
                sloganEl.textContent = `"${this.userProfile.bio_short}"`;
                sloganEl.style.display = 'block';
            } else {
                sloganEl.style.display = 'none';
            }

            if (bioEl) {
                bioEl.textContent = this.userProfile.bio || 'Divulgador en Epistecnología';
            }
            
            // --- LÓGICA DE GAMIFICACIÓN ---
            const hasOrcid = this.userProfile.orcid && this.userProfile.orcid !== '0000';
            const hasBsky = !!this.bskyCreds;
            
            // 1. Nombre y Check PRO
            document.getElementById('user-panel-name').innerHTML = `${userName} ${hasOrcid && hasBsky ? '<i class="fa-solid fa-circle-check verified-check" title="Divulgador Verificado"></i>' : ''}`;
            
            // 2. Mostrar contenedor e iluminar insignias básicas
            const badgesContainer = document.getElementById('community-user-badges');
            if (badgesContainer) badgesContainer.style.display = 'flex';

            document.getElementById('badge-citizen')?.classList.add('active-citizen');
            if (hasBsky) document.getElementById('badge-social')?.classList.add('active-social');
            if (hasOrcid) document.getElementById('badge-academic')?.classList.add('active-academic');
            
            // 3. Insignia Fundador (Tu fecha límite oficial)
            if (new Date(this.userProfile.created_at) < new Date('2026-12-31')) {
                document.getElementById('badge-founder')?.classList.add('active-founder');
            }
            
            // 4. Insignia Miembro Honorario
            if (this.userProfile.membership_tier && this.userProfile.membership_tier !== 'free') {
                document.getElementById('badge-member')?.classList.add('active-member');
            }

            // 5. Consultar proyectos para insignia de Divulgador
            try {
                const { count } = await this.supabase.from('projects')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', this.user.id);
                if (count >= 5) document.getElementById('badge-divulgador')?.classList.add('active-divulgador');
            } catch (e) { console.error("Error contando proyectos:", e); }
            // ------------------------------
            
        } else {
            // MODO INVITADO
            const randomSeed = Math.floor(Math.random() * 10000);
            document.getElementById('user-panel-avatar').src = `https://api.dicebear.com/9.x/shapes/svg?seed=invitado_${randomSeed}`;
            document.getElementById('user-panel-name').textContent = 'Invitado Explorador';
            
            const badgesContainer = document.getElementById('community-user-badges');
            if (badgesContainer) badgesContainer.style.display = 'none';
            
            const actionArea = document.getElementById('user-panel-bsky-status');
            if (actionArea) {
                actionArea.innerHTML = `
                    <p style="font-size: 0.85rem; color: var(--color-secondary-text);">Inicia sesión para poder publicar e interactuar.</p>
                    <button class="btn-primary" style="width: 100%; margin-top: 10px;" onclick="window.location.href='/?auth=open';">Iniciar Sesión</button>
                `;
            }
            const profileBtn = contentPanel.querySelector('.btn-secondary');
            if(profileBtn) profileBtn.style.display = 'none';
        }

        loadingPanel.style.display = 'none';
        contentPanel.style.display = 'block';
    },

    /**
     * Carga y muestra el feed principal de la comunidad.
     * Por ahora, usa la misma función de solo lectura que el perfil.
     */
    async renderFeed() {
        const container = document.getElementById('feed-container');
        if (!container) return;

        try {
            const { data: feed, error } = await this.supabase.functions.invoke('bsky-get-community-feed');
            if (error) throw error;
            if (!feed || feed.length === 0) {
                container.innerHTML = '<p class="bento-box">No hay publicaciones recientes.</p>';
                return;
            }

            // Mapeamos los posts a HTML (estructura similar a profile.js pero preparada para más interacción)
            container.innerHTML = feed.map(item => this.createPostHtml(item.post)).join('');

        } catch (error) {
            container.innerHTML = '<p class="bento-box" style="color: var(--color-accent);">Error al cargar el feed.</p>';
            console.error("Error en renderFeed:", error);
        }
    },

    // --- MANEJADORES DE EVENTOS (Versión Unificada Definitiva) ---
    addEventListeners() {
        // 1. Listener para FORMULARIOS (Submits)
        document.body.addEventListener('submit', (e) => {
            if (e.target.id === 'create-post-form' || e.target.id === 'create-post-form-modal') {
                e.preventDefault();
                this.handleCreatePost(e.target);
            }
            if (e.target.id === 'bsky-connect-form') {
                e.preventDefault();
                this.handleBlueskyConnect(e);
            }
        });

        // 2. Listener para CLICS (Navegación, Modales, Zapping)
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button');

            // --- ABRIR MODAL DE INVESTIGADOR (Stories o Listas) ---
            const investigatorItem = target.closest('.featured-investigator-item, .story-item');
            if (investigatorItem) {
                e.preventDefault();
                e.stopPropagation();
                const username = investigatorItem.dataset.username;
                if (username) this.openProfileModal(username);
            }

            // --- INICIAR DIRECTO RÁPIDO (GoLive) ---
            const directoBtn = target.closest('a');
            if (directoBtn && directoBtn.innerHTML.includes('fa-bolt')) {
                e.preventDefault();
                // Verificamos que sea un investigador con cuenta conectada
                if (this.bskyCreds && (this.userProfile?.role === 'researcher' || this.userProfile?.role === 'admin')) {
                    this.openGoLiveModal();
                } else {
                    alert("Solo los investigadores verificados pueden iniciar transmisiones en vivo.");
                }
                return;
            }

            // --- TABS MÓVILES (NAVEGACIÓN APP) ---
            const tabBtn = target.closest('.community-tab-btn');
            if (tabBtn) {
                // Quitar 'active' de todos los botones
                document.querySelectorAll('.community-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active'); // Activar el presionado
                
                // Ocultar todas las columnas
                document.getElementById('feed-tab').classList.remove('is-active-tab');
                document.getElementById('profile-tab').classList.remove('is-active-tab');
                document.getElementById('explore-tab').classList.remove('is-active-tab');
                
                // Mostrar solo la columna seleccionada
                const targetId = tabBtn.getAttribute('data-target');
                const activeColumn = document.getElementById(targetId);
                if (activeColumn) activeColumn.classList.add('is-active-tab');
                
                // Subir suavemente al inicio de la pestaña
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // --- ABRIR IMAGEN EN PANTALLA COMPLETA (Solución definitiva) ---
            const embedImg = target.closest('.post-embed-image img');
            if (embedImg) {
                e.preventDefault();
                this.openImageLightbox(embedImg.src);
                return;
            }

            // --- MENÚ LATERAL (Reglas, Notificaciones, etc.) ---
            const navLink = target.closest('.community-nav-link');
            if (navLink) {
                if(navLink.getAttribute('href') === '#') e.preventDefault();

                if (navLink.innerHTML.includes('Reglas')) {
                    const rulesModal = document.getElementById('rules-modal-overlay');
                    if (rulesModal) {
                        rulesModal.style.display = 'flex';
                        setTimeout(() => rulesModal.classList.add('is-visible'), 10);
                    }
                }
                else if (navLink.id === 'notifications-bell-icon') {
                    if (this.bskyCreds) window.open('https://bsky.app/notifications', '_blank');
                    else alert("Únete a Epistecnología para recibir notificaciones.");
                }
                else if (navLink.innerHTML.includes('Guardados')) {
                    alert("🚀 Próximamente: Podrás guardar tus artículos y debates favoritos.");
                }
            }

            // --- CERRAR MODAL DE REGLAS ---
            if (target.id === 'rules-close-btn' || target.id === 'rules-accept-btn' || target.id === 'rules-modal-overlay') {
                const rulesModal = document.getElementById('rules-modal-overlay');
                if (rulesModal) {
                    rulesModal.classList.remove('is-visible');
                    setTimeout(() => rulesModal.style.display = 'none', 300);
                }
            }

            // --- MODALES BSKY Y PUBLICAR ---
            if (button && (button.id === 'connect-bsky-btn' || button.id === 'connect-bsky-in-creator-btn')) {
                this.openBskyConnectModal();
            }

            // --- LÓGICA DEL NUEVO SPEED DIAL FAB ---
            const fabToggle = target.closest('#fab-main-toggle');
            const fabContainer = document.getElementById('fab-container');

            // 1. Abrir/Cerrar al tocar el botón (+)
            if (fabToggle) {
                fabContainer.classList.toggle('is-open');
                return;
            }
            
            // 2. Cerrar el menú si tocamos en cualquier otra parte de la pantalla
            if (fabContainer && fabContainer.classList.contains('is-open') && !target.closest('.fab-container')) {
                fabContainer.classList.remove('is-open');
            }

            // 3. Acción: Escribir Post
            if (button && button.id === 'fab-post') {
                fabContainer.classList.remove('is-open'); // Lo cerramos
                this.openPostModal();
            }

            // 4. Acción: GoLive Móvil
            if (button && button.id === 'fab-golive') {
                fabContainer.classList.remove('is-open'); // Lo cerramos
                if (this.bskyCreds && (this.userProfile?.role === 'researcher' || this.userProfile?.role === 'admin')) {
                    this.openGoLiveModal();
                } else {
                    alert("Solo los investigadores verificados pueden iniciar transmisiones en vivo.");
                }
            }

            // --- ZAPPING (REPRODUCTOR 24/7 MULTICANAL) ---
            const channelBtn = target.closest('.channel-btn');
            if (channelBtn) {
                document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
                channelBtn.classList.add('active');
                
                const type = channelBtn.dataset.type;
                const iframeContainer = document.getElementById('ept-tv-iframe');
                const podcastContainer = document.getElementById('native-podcast-player');

                if (type === 'video') {
                    podcastContainer.style.display = 'none';
                    iframeContainer.style.display = 'block';
                    iframeContainer.src = channelBtn.dataset.src;
                } else if (type === 'podcast') {
                    iframeContainer.style.display = 'none';
                    iframeContainer.src = ''; 
                    podcastContainer.style.display = 'flex'; 
                }
            }
        });

        // 3. Listener para el FEED (Likes, Reply, Share)
        document.getElementById('feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const replyButton = e.target.closest('.reply-btn');
            const shareButton = e.target.closest('.share-btn');

            if (likeButton) this.handleLike(likeButton);
            if (replyButton) this.handleReply(replyButton);
            if (shareButton) this.handleShare(shareButton);
        });
    },

    addFormEventListeners(container) {
        // Enlaza el texto para los links y contadores
        container.querySelector('textarea')?.addEventListener('input', (e) => {
            this.updateCharCounter(e);
            this.detectLinkInText(e.target.value); 
        });

        // Enlaza la subida de imágenes usando CLASES relativas al contenedor actual
        const imageUploadBtn = container.querySelector('.image-upload-btn') || container.querySelector('#image-upload-btn');
        const imageUploadInput = container.querySelector('.image-upload-input') || container.querySelector('#image-upload-input');
        const removeImageBtn = container.querySelector('.remove-image-btn');

        if (imageUploadBtn && imageUploadInput) {
            imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
            imageUploadInput.addEventListener('change', (e) => this.handleImageSelection(e, container));
        }
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => this.removeSelectedImage(container));
        }
    },

    toggleCreatePostBox() {
        const container = document.querySelector('.create-post-box');
        if (!container) return;

        if (this.bskyCreds && (this.userProfile.role === 'researcher' || this.userProfile.role === 'admin')) {
            // Generamos la URL del avatar correctamente
            const avatarUrl = this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${this.userProfile.username || 'user'}`;

            // Inyectamos la estructura limpia estilo Bluesky
            container.innerHTML = `
                <form id="create-post-form" class="clean-post-form">
                    <div class="textarea-container">
                        <img id="inline-user-avatar" src="${avatarUrl}" class="post-avatar">
                        <div class="post-input-wrapper">
                            <textarea id="post-text" name="post-text" placeholder="¿Qué hay de nuevo, investigador?" maxlength="300" required></textarea>
                            
                            <div id="link-preview-loader" style="display:none; font-size: 0.8rem; margin: 10px 0; color: var(--color-accent);">
                                <i class="fa-solid fa-spinner fa-spin"></i> Generando vista previa...
                            </div>
                            <div id="link-preview-editor" class="link-preview-card" style="display:none; margin-bottom: 15px; position: relative;"></div>
                            
                            <div id="image-preview-container" class="image-preview-container" style="display: none;">
                                <button type="button" class="remove-image-btn">&times;</button>
                                <img id="image-preview" src="#" alt="Vista previa de la imagen">
                            </div>
                        </div>
                    </div>

                    <div class="create-post-actions">
                        <div class="action-icons">
                            <input type="file" id="image-upload-input" accept="image/jpeg, image/png" style="display: none;">
                            <button type="button" id="image-upload-btn" class="post-action-icon" title="Añadir imagen">
                                <i class="fa-regular fa-image"></i>
                            </button>
                            <button type="button" class="post-action-icon disabled-icon" title="GIF (Próximamente)"><i class="fa-solid fa-square-poll-vertical"></i></button>
                            <button type="button" class="post-action-icon disabled-icon" title="Emojis (Próximamente)"><i class="fa-regular fa-face-smile"></i></button>
                        </div>
                        <div class="form-submit-area">
                            <span class="char-counter">300</span>
                            <button type="submit" id="submit-post-btn" class="btn btn-primary btn-pill">Publicar</button>
                        </div>
                    </div>
                </form>
            `;
            this.addFormEventListeners(container);
            
        } else if (this.bskyCreds) {
            // Usuario normal conectado
            container.innerHTML = `<h4>¡Ya eres parte de la conversación!</h4><p class="form-hint">Tu cuenta está conectada. Ahora puedes interactuar. La creación de posts está reservada para investigadores.</p>`;
        } else {
            // Usuario no conectado a Bsky
            container.innerHTML = `<h4>Participa en la Conversación</h4><p class="form-hint">Para interactuar, necesitas conectar tu cuenta de Bluesky ¡es gratis y fácil de crear!</p><button id="connect-bsky-in-creator-btn" class="btn btn-primary" style="width:100%;"><i class="fa-solid fa-link"></i> Conectar Cuenta de Bluesky</button>`;
        }
    },

    handleImageSelection(event, container) {
        const file = event.target.files[0];
        const previewContainer = container.querySelector('.image-preview-container') || document.getElementById('image-preview-container');
        const previewImage = container.querySelector('.image-preview') || document.getElementById('image-preview');

        if (!file) {
            this.removeSelectedImage(container);
            return;
        }
        if (file.size > 1000000) { 
            alert("La imagen es demasiado pesada para Bluesky (máximo 1MB).");
            event.target.value = ''; 
            return;
        }

        this.selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if(previewImage) previewImage.src = e.target.result;
            if(previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    removeSelectedImage(container) {
        this.selectedImageFile = null;
        const input = container ? container.querySelector('input[type="file"]') : document.getElementById('image-upload-input');
        const previewContainer = container ? container.querySelector('.image-preview-container') : document.getElementById('image-preview-container');
        
        if (input) input.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
    },

    // --- LÓGICA DE INTERACCIÓN (Versión Actualizada) ---

    /**
     * Maneja la creación de un nuevo post, extrayendo URLs y validando límites de Bluesky.
     */
    async handleCreatePost(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const textArea = form.querySelector('textarea[name="post-text"]');
        const postText = textArea.value.trim();

        // 1. DETECCIÓN AUTOMÁTICA DE URL (Regex)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = postText.match(urlRegex);
        const postLink = match ? match[0] : null;

        if (!postText && !this.selectedImageFile) {
            alert("El post debe contener texto o una imagen.");
            return;
        }

        // 2. VALIDACIÓN DE LÍMITE DE 1MB
        if (this.selectedImageFile && this.selectedImageFile.size > 1048576) {
            alert("La imagen es demasiado pesada para Bluesky (máximo 1MB).");
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        // Capturamos los datos de la vista previa generada por Microlink si existen
        const previewImg = document.querySelector('#link-preview-editor img');
        const previewTitle = document.querySelector('#link-preview-editor strong');
        const previewDesc = document.querySelector('#link-preview-editor p');

        let body = { 
            postText: postText,
            postLink: postLink,
            linkTitle: previewTitle ? previewTitle.textContent : null,
            linkDescription: previewDesc ? previewDesc.textContent : null,
            linkThumb: previewImg ? previewImg.src : null
        };

        if (this.selectedImageFile) {
            try {
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(this.selectedImageFile);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
                body.base64Image = base64Image;
                body.imageMimeType = this.selectedImageFile.type;
            } catch (error) {
                console.error("Error al leer la imagen:", error);
                alert("No se pudo procesar la imagen.");
                submitButton.disabled = false;
                submitButton.textContent = 'Publicar';
                return;
            }
        }

        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-post', {
                body: body,
            });
            if (error) throw error;

            this.prependNewPost(postText, this.selectedImageFile);
            textArea.value = '';
            this.removeSelectedImage();
            this.updateCharCounter({ target: textArea });
            this.closePostModal();

        } catch (error) {
            console.error("Error al publicar:", error);
            const errMsg = error.message || "";
            if (errMsg.includes('non-2xx') || errMsg.includes('revoked') || errMsg.includes('Expired')) {
                alert("Tu clave de Bluesky ha caducado. Por favor, reconecta tu cuenta.");
                this.closePostModal();
                this.openBskyConnectModal();
            } else {
                alert(`No se pudo publicar. Revisa tu conexión.`);
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Publicar';
            }
        }
    },

    /**
     * Crea el HTML para un nuevo post y lo añade al principio del feed.
     * @param {string} postText - El contenido del post.
     */
    prependNewPost(postText, imageFile = null) {
        const container = document.getElementById('feed-container');
        if (!container) return;

        const author = {
            avatar: this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=invitado_${Math.floor(Math.random() * 10000)}`,
            displayName: this.userProfile.display_name,
            handle: this.bskyCreds.handle
        };

        let embed = undefined;
        if (imageFile) {
            // Creamos una URL local para la vista previa optimista
            const localImageUrl = URL.createObjectURL(imageFile);
            embed = {
                $type: 'app.bsky.embed.images',
                images: [{ thumb: localImageUrl, alt: 'Imagen recién publicada' }]
            };
        }
        
        const fakePost = {
            author: author,
            record: { text: postText },
            embed: embed,
            indexedAt: new Date().toISOString(),
            replyCount: 0, repostCount: 0, likeCount: 0,
            viewer: {}
        };
        
        const postHtml = this.createPostHtml(fakePost);
        container.insertAdjacentHTML('afterbegin', postHtml);
    },

    /**
     * Maneja el evento de "Me Gusta" (funcionalidad futura).
     */
    async handleLike(button) {
        // Si el usuario no está conectado a Bluesky, no hacemos nada.
        if (!this.bskyCreds) {
            alert("Necesitas conectar tu cuenta de Bluesky para poder interactuar.");
            return;
        }
        if (button.disabled) return;

        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri;
        const postCid = postElement.dataset.cid;
        let likeUri = button.dataset.likeUri;

        const isLiked = button.classList.contains('is-liked');
        const countSpan = button.querySelector('span');
        const icon = button.querySelector('i');
        const originalCount = parseInt(countSpan.textContent);

        // 1. Actualización Optimista: Cambiamos la UI al instante.
        button.disabled = true;
        button.classList.toggle('is-liked');
        if (!isLiked) { // Si NO tenía like... ahora lo tiene
            icon.className = 'fa-solid fa-heart';
            countSpan.textContent = originalCount + 1;
        } else { // Si SÍ tenía like... ahora se lo quitamos
            icon.className = 'fa-regular fa-heart';
            countSpan.textContent = originalCount - 1;
        }

        // 2. Llamada a la Edge Function
        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-like-post', {
                body: { 
                    postUri: postUri, 
                    postCid: postCid,
                    likeUri: isLiked ? likeUri : undefined // Si ya tenía like, enviamos su URI para borrarlo
                },
            });

            if (error) throw error;

            // Si la acción fue un 'like' exitoso, guardamos el nuevo likeUri que nos devuelve la función.
            if (!isLiked && data.uri) {
                button.dataset.likeUri = data.uri;
            } else if (isLiked) {
                button.dataset.likeUri = ''; // Limpiamos el likeUri si lo quitamos
            }

        } catch (error) {
            console.error("Error al procesar el Like:", error);
            // 3. Reversión: Si algo falla, devolvemos la UI a su estado original.
            button.classList.toggle('is-liked');
            icon.className = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            countSpan.textContent = originalCount;
            alert("No se pudo procesar la acción. Inténtalo de nuevo.");
        } finally {
            button.disabled = false;
        }
    },
    
    /**
     * Intercepta el clic en "Comentar" y abre el lector de hilos nativo.
     */
    async handleReply(button) {
        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri;
        this.openThreadReaderModal(postUri);
    },

    /**
     * Abre el modal inmersivo, descarga el hilo de Bluesky y lo dibuja.
     */
    async openThreadReaderModal(postUri) {
        const template = document.getElementById('thread-reader-template');
        if (!template) return;

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = ''; // Limpiamos previos
        const modalNode = template.content.cloneNode(true);
        
        // Listener para cerrar
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        modalContainer.appendChild(modalNode);

        const loader = document.getElementById('thread-loader');
        const contentBox = document.getElementById('thread-content');
        const anchorContainer = document.getElementById('thread-anchor-post');
        const repliesContainer = document.getElementById('thread-replies');

        try {
            // Llamamos a tu Edge Function experta en hilos
            const { data, error } = await this.supabase.functions.invoke('bsky-get-post-thread', {
                body: { postUri: postUri }
            });

            if (error) throw error;

            // 1. Dibujamos el post principal usando la función súper-vitaminada que ya tenemos
            if (data.anchorPost) {
                // Modificamos el diseño del post principal para quitarle el hover/bordes y hacerlo plano
                const anchorHtml = this.createPostHtml(data.anchorPost).replace('bento-box', '').replace('border: 1px solid transparent;', 'border: none;');
                anchorContainer.innerHTML = anchorHtml;
            }

            // 2. Dibujamos las respuestas
            if (data.messages && data.messages.length > 0) {
                const repliesHtml = data.messages.map(msg => {
                    // Reutilizamos createPostHtml pero le damos un estilo de "comentario" (fondo distinto, sin márgenes grandes)
                    return this.createPostHtml(msg).replace('bento-box', '').replace('padding: 1.5rem;', 'padding: 1rem 1.5rem; background: var(--color-surface); border: none; border-bottom: 1px solid var(--color-background);');
                }).join('');
                repliesContainer.innerHTML = repliesHtml;
            } else {
                repliesContainer.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--color-secondary-text);">Aún no hay respuestas. ¡Sé el primero en comentar!</p>`;
            }

            loader.style.display = 'none';
            contentBox.style.display = 'block';

        } catch (err) {
            console.error("Error al cargar el hilo:", err);
            loader.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-accent); font-size: 2rem;"></i><p>No se pudo cargar la conversación.</p>`;
        }
    },

    openReplyModal(postData) {
        const template = document.getElementById('reply-modal-template');
        if (!template) return console.error("La plantilla de respuesta no existe.");

        const modalContainer = document.getElementById('modal-container');
        const modalNode = template.content.cloneNode(true);

        // Rellenamos el modal con la información del post padre
        modalNode.querySelector('#parent-post-avatar').src = postData.author.avatar;
        modalNode.querySelector('#parent-post-author').textContent = postData.author.displayName;
        modalNode.querySelector('#parent-post-text').innerHTML = postData.text;
        modalNode.querySelector('#reply-user-avatar').src = this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${this.userProfile.username || 'user'}`;
        
        // Añadimos los listeners
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        const form = modalNode.querySelector('#reply-form');
        const textArea = form.querySelector('textarea');
        const charCounter = form.querySelector('.char-counter');

        textArea.addEventListener('input', () => {
            const remaining = 300 - textArea.value.length;
            charCounter.textContent = remaining;
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply(textArea.value, postData, form);
        });
        
        modalContainer.innerHTML = ''; // Limpiamos por si había otro modal
        modalContainer.appendChild(modalNode);
    },

    async submitReply(replyText, parentPostData, form) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!replyText.trim()) return;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: {
                    replyText: replyText,
                    // El objeto que espera nuestra Edge Function
                    parentPost: {
                        uri: parentPostData.uri,
                        cid: parentPostData.cid
                    }
                },
            });

            if (error) throw error;
            
            // Actualización Optimista: incrementamos el contador de comentarios
            const originalPostElement = document.querySelector(`.feed-post[data-uri="${parentPostData.uri}"]`);
            if (originalPostElement) {
                const countSpan = originalPostElement.querySelector('.reply-btn span');
                countSpan.textContent = parseInt(countSpan.textContent) + 1;
            }

            this.closePostModal();
            
        } catch (error) {
            alert(`Error al publicar el comentario: ${error.message}`);
            submitButton.disabled = false;
            submitButton.innerHTML = 'Responder';
        }
    },

    // No olvides que esta función ya la tienes, solo asegúrate de que esté
    closePostModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    },

    // --- HELPERS ---
    
    /**
     * Crea el HTML para un único post. Reutilizable y fácil de mantener.
     * @param {object} post - El objeto del post de Bluesky.
     * @returns {string} - La cadena de HTML para el post.
     */
    createPostHtml(post) {
        if (!post || !post.author || !post.record) return '';

        const postText = (post.record.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
        const author = post.author;
        const isLiked = !!post.viewer?.like;
        const postDate = new Date(post.indexedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        // --- PROCESAMIENTO NATIVO DE MULTIMEDIA (AT PROTOCOL) ---
        let embedHtml = '';
        const embed = post.embed;
        
        if (embed) {
            // Extracción segura soportando posts citados y anidamientos
            const imagesData = embed.images || (embed.media && embed.media.images);
            const externalData = embed.external || (embed.media && embed.media.external);
            
            // 1. DIBUJA VIDEOS DE BLUESKY
            if (embed.$type.startsWith('app.bsky.embed.video') || (embed.media && embed.media.$type === 'app.bsky.embed.video')) {
                const videoData = embed.video || (embed.media && embed.media.video) || embed;
                const rkey = post.uri.split('/').pop();
                embedHtml = `
                    <div class="post-embed-video" style="position: relative; margin-top: 12px; cursor: pointer; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border);" onclick="window.open('https://bsky.app/profile/${author.handle}/post/${rkey}', '_blank')">
                        <img src="${videoData.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" style="width: 100%; display: block; filter: brightness(0.85);">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(4px); transition: transform 0.2s;">
                            <i class="fa-solid fa-play" style="color: white; font-size: 1.5rem; margin-left: 5px;"></i>
                        </div>
                    </div>`;
            }
            // 2. DIBUJA IMÁGENES
            else if (imagesData && imagesData.length > 0) {
                embedHtml = `
                    <div class="post-embed-image" style="margin-top: 12px;">
                        <img src="${imagesData[0].thumb}" alt="${imagesData[0].alt || 'Imagen adjunta'}" loading="lazy" onclick="ComunidadApp.openImageLightbox(this.src)" style="width: 100%; border-radius: 12px; border: 1px solid var(--color-border); cursor: zoom-in;">
                    </div>`;
            } 
            // 3. DIBUJA TARJETAS DE ENLACES (LINK PREVIEWS)
            else if (externalData) {
                let hostname = 'Enlace externo';
                try { hostname = new URL(externalData.uri).hostname; } catch(e) {}
                embedHtml = `
                    <a href="${externalData.uri}" target="_blank" rel="noopener noreferrer" class="link-preview-card" style="display: block; text-decoration: none; color: inherit; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; margin-top: 12px; background: var(--color-surface); transition: transform 0.2s;">
                        ${externalData.thumb ? `<img src="${externalData.thumb}" alt="Vista previa" class="link-preview-image" style="width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid var(--color-border);">` : ''}
                        <div class="link-preview-info" style="padding: 15px;">
                            <p class="link-preview-title" style="margin: 0 0 5px 0; font-weight: 700; font-size: 0.95rem; line-height: 1.3; color: var(--color-primary-text);">${externalData.title || hostname}</p>
                            <p class="link-preview-description" style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--color-secondary-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${externalData.description || ''}</p>
                            <p class="link-preview-uri" style="margin: 0; font-size: 0.75rem; color: var(--color-accent); font-weight: 600;"><i class="fa-solid fa-link"></i> ${hostname}</p>
                        </div>
                    </a>`;
            }
        }
        // --- FIN DE LA MODIFICACIÓN ---

        return `
            <div class="bento-box feed-post" data-uri="${post.uri}" data-cid="${post.cid}">
                <div class="post-header">
                    <img src="${author.avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${author.handle}`}" alt="Avatar" class="post-avatar">
                    <div class="post-author-info">
                        <strong>${author.displayName || author.handle}</strong>
                        <span class="post-handle">@${author.handle}</span>
                    </div>
                </div>
                <div class="post-body">
                    <p>${postText}</p>
                    ${embedHtml}
                </div>
                <div class="post-footer">
                    <span class="post-date">${postDate}</span>
                    <div class="post-actions">
                        <button class="post-action-btn share-btn" title="Copiar y compartir enlace">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                        <button class="post-action-btn reply-btn" title="Comentar">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.replyCount || 0}</span>
                        </button>
                        <button class="post-action-btn like-btn ${isLiked ? 'is-liked' : ''}" 
                                title="Me Gusta" 
                                data-like-uri="${post.viewer?.like || ''}">
                            <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                            <span>${post.likeCount || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    handleShare(button) {
        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri; // at://did:plc:user/app.bsky.feed.post/rkey

        // Extraemos el handle y el rkey del URI para construir una URL web
        const parts = postUri.split('/');
        const handle = postElement.querySelector('.post-handle').textContent.substring(1); // quitamos el @
        const rkey = parts[parts.length - 1];
        
        const webUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

        navigator.clipboard.writeText(webUrl).then(() => {
            alert('¡Enlace al post copiado al portapapeles!');
        }).catch(err => {
            console.error('Error al copiar el enlace:', err);
            alert('No se pudo copiar el enlace.');
        });
    },

    // --- FUNCIONES DEL MODAL (Nuevas) ---

    // REEMPLAZA ESTAS DOS FUNCIONES en comunidad.js

    openPostModal() {
        const modalContainer = document.getElementById('modal-container');
        // CORRECCIÓN: Comprobamos si el contenedor específico de modales dinámicos ya tiene algo adentro
        if (modalContainer && modalContainer.innerHTML.trim() !== '') return; 

        const template = document.getElementById('post-form-template');
        if (!template) {
            console.error("La plantilla #post-form-template no existe en el HTML.");
            return;
        }
        
        const modalNode = template.content.cloneNode(true);
        const modalOverlay = modalNode.querySelector('.modal-overlay');
        
        modalNode.querySelector('#modal-user-avatar').src = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=invitado`;
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        const textArea = modalNode.querySelector('textarea');
        textArea.addEventListener('input', (e) => {
            this.updateCharCounter(e);
            this.detectLinkInText(e.target.value);
        });

        modalContainer.appendChild(modalNode);
        this.addFormEventListeners(modalContainer);

        requestAnimationFrame(() => {
            modalOverlay.classList.add('is-visible');
        });
    },

    closePostModal() {
        const modalOverlay = document.querySelector('.modal-overlay.is-visible');
        if (modalOverlay) {
            // Quitamos la clase para iniciar la transición de salida
            modalOverlay.classList.remove('is-visible');
            
            // Esperamos a que la transición CSS termine antes de borrar el HTML del DOM
            modalOverlay.addEventListener('transitionend', () => {
                const modalContainer = document.getElementById('modal-container');
                if (modalContainer) modalContainer.innerHTML = '';
            }, { once: true }); // 'once: true' se asegura de que el listener se auto-elimine
        }
    },

    updateCharCounter(e) {
        const maxLength = 300;
        const currentLength = e.target.value.length;
        const remaining = maxLength - currentLength;
        // Buscamos el contador relativo al formulario actual
        const form = e.target.closest('form');
        if(form) {
            form.querySelector('.char-counter').textContent = remaining;
        }
    },

    // Añade esta función a ComunidadApp en comunidad.js
    renderBskyStatus() {
        const container = document.getElementById('user-panel-bsky-status');
        if (!container) return;

        if (this.bskyCreds) {
            // Si las credenciales existen, las mostramos <p style="font-size: 0.75rem; word-break: break-all; color: var(--color-secondary-text); margin-top: 0.5rem;">DID: ${this.bskyCreds.did}</p>
            container.innerHTML = `
                <div class="status-badge connected">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Conectado como <strong>@${this.bskyCreds.handle}</strong></span>
                </div>
            `;
        } else {
            // Si no, mostramos un botón para conectar
            container.innerHTML = `
                <p class="form-hint">Conecta tu cuenta para poder publicar.</p>
                <button id="connect-bsky-btn" class="btn btn-primary" style="width:100%; margin-top:0.5rem;">
                    <i class="fa-solid fa-link"></i> Conectar Cuenta
                </button>
            `;
        }
    },

    // Añade estas funciones a ComunidadApp en comunidad.js
    openBskyConnectModal() {
        const template = document.getElementById('bsky-connect-template');
        if (!template) { console.error("La plantilla del modal no existe."); return; }

        const modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) {
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }

        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeBskyConnectModal());
        
        // EL FIX: Escuchar al nuevo botón OAuth en lugar del formulario viejo
        const oauthBtn = modalContainer.querySelector('#bsky-oauth-start-btn');
        if (oauthBtn) {
            oauthBtn.addEventListener('click', () => this.handleBlueskyOAuthStart());
        }
    },

    closeBskyConnectModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    },

    async handleBlueskyConnect(e) {
        e.preventDefault();
        const form = e.target;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

        const handle = form.querySelector('#bsky-handle').value;
        const appPassword = form.querySelector('#bsky-app-password').value;

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-auth', { body: { handle, appPassword } });
            if (error) throw error;
            alert(data.message);
            location.reload(); // Recargamos para que todo se actualice
        } catch (error) {
            alert(`Error al conectar: ${error.message}`);
            button.disabled = false;
            button.innerHTML = 'Conectar Cuenta';
        }
    },

    // ==========================================
    // MÓDULOS DE LA COMUNIDAD (Historias, Eventos, Investigadores)
    // ==========================================

    // Variable temporal para guardar los datos de las historias en pantalla
    currentStoriesData: [],

    async renderLatestPublications() {
        const list = document.getElementById('feed-publications-stories');
        if (!list) return;
        try {
            // Traemos TODOS los datos de la base de conocimiento para armar el resumen
            const { data, error } = await this.supabase
                .from('knowledge_base')
                .select('title, url, image_url, description, author_name, published_at')
                .order('published_at', { ascending: false })
                .limit(8);

            if (error) throw error;

            if (data && data.length > 0) {
                // Guardamos los datos en la app para que el modal los pueda leer después
                this.currentStoriesData = data;

                list.style.display = 'flex';
                list.style.gap = '12px';
                list.style.overflowX = 'auto';
                list.style.paddingBottom = '10px';
                list.style.scrollbarWidth = 'none';

                list.innerHTML = data.map((pub, index) => {
                    const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
                    return `
                        <li onclick="ComunidadApp.openPublicationModal(${index})" style="min-width: 120px; width: 120px; height: 170px; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; flex-shrink: 0; border: 1px solid var(--color-border); box-shadow: var(--shadow-soft); transition: transform 0.2s;">
                            <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1;">
                            <div style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 30px 10px 10px 10px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.4), transparent); z-index: 2;">
                                <span style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: white; font-size: 0.75rem; font-weight: 700; line-height: 1.3; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${pub.title}</span>
                            </div>
                        </li>
                    `;
                }).join('');
                
                list.querySelectorAll('li').forEach(item => {
                    item.addEventListener('mouseenter', () => item.style.transform = 'scale(1.03)');
                    item.addEventListener('mouseleave', () => item.style.transform = 'scale(1)');
                });

            } else {
                list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">No hay artículos recientes.</p>';
            }
        } catch (e) { 
            console.error("Error cargando revista:", e); 
            list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">Error al cargar.</p>';
        }
    },

    // 2. Cargar Agenda y Eventos (Desde sessions)
    async renderSidebarEvents() {
        const list = document.getElementById('sidebar-event-list');
        if (!list) return;
        try {
            const { data, error } = await this.supabase.from('sessions')
                .select('id, session_title, scheduled_at, status')
                .eq('is_archived', false)
                .order('scheduled_at', { ascending: false })
                .limit(10); 
                
            if (error) throw error;

            if (data && data.length > 0) {
                const now = new Date();
                
                // MAGIA: Filtramos estrictamente por FECHA. 
                // Si la fecha es mayor a AHORA, es Próximamente. Si ya pasó, es Grabación.
                const upcoming = data.filter(s => new Date(s.scheduled_at) > now).reverse().slice(0, 2);
                const past = data.filter(s => new Date(s.scheduled_at) <= now).slice(0, 2);
                
                let html = '';
                
                upcoming.forEach(s => {
                    const dateObj = new Date(s.scheduled_at);
                    const dateStr = dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                    html += `
                        <li class="upcoming-event" style="margin-bottom: 0.8rem; border-left: 3px solid var(--color-accent); padding-left: 10px;">
                            <a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);">
                                <strong style="color: var(--color-accent); font-size: 0.75rem; display: block; text-transform: uppercase;">Próximamente (${dateStr})</strong>
                                <span style="font-size: 0.85rem; font-weight: 600; line-height: 1.3; display: block; margin-top: 3px;">${s.session_title}</span>
                            </a>
                        </li>`;
                });
                
                past.forEach(s => {
                    html += `
                        <li class="past-event" style="opacity: 0.7; margin-bottom: 0.8rem; padding-left: 10px;">
                            <a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);">
                                <strong style="color: var(--color-secondary-text); font-size: 0.75rem; display: block; text-transform: uppercase;">Grabación</strong>
                                <span style="font-size: 0.85rem; line-height: 1.3; display: block; margin-top: 3px;">${s.session_title}</span>
                            </a>
                        </li>`;
                });

                list.innerHTML = html || '<li><span class="trend-topic">No hay eventos por mostrar.</span></li>';
            } else {
                list.innerHTML = '<li><span class="trend-topic">No hay eventos registrados.</span></li>';
            }
        } catch (error) {
            console.error("Error al cargar eventos:", error);
            list.innerHTML = '<li><span class="trend-topic">Error al cargar la agenda.</span></li>';
        }
    },

    async renderFeaturedMembers() {
        const container = document.getElementById('featured-members-list');
        if (!container) return;

        try {
            // 1. Consultar quién está EN VIVO
            const { data: liveBroadcasts, error: liveError } = await this.supabase
                .from('active_broadcasts')
                .select('*, profiles(display_name, avatar_url, username)')
                .eq('status', 'live');

            if (liveError) throw liveError;

            // 2. Consultar destacados (Traemos a los que tienen proyectos)
            // Quitamos el .limit() aquí para poder contar los proyectos de todos y ordenarlos bien
            const { data: members, error: membersError } = await this.supabase
                .from('profiles')
                .select('id, display_name, avatar_url, username, projects!inner(id), updated_at');

            if (membersError) throw membersError;

            // --- NUEVA LÓGICA DE ORDENAMIENTO (Más proyectos primero) ---
            members.sort((a, b) => {
                const countA = a.projects ? a.projects.length : 0;
                const countB = b.projects ? b.projects.length : 0;
                
                // 1º Prioridad: Quién tiene más proyectos
                if (countB !== countA) {
                    return countB - countA; 
                }
                // 2º Prioridad: Si tienen los mismos proyectos, gana el que tuvo actividad más reciente
                return new Date(b.updated_at) - new Date(a.updated_at);
            });

            // Ahora sí, tomamos solo los 10 mejores para no saturar la pantalla
            const topMembers = members.slice(0, 10);

            let html = '';
            const paintedLiveUsers = new Set(); // Para evitar duplicados
            
            // 3. Pintar PRIMERO a los que están EN VIVO
            if (liveBroadcasts && liveBroadcasts.length > 0) {
                liveBroadcasts.forEach(broadcast => {
                    if (!paintedLiveUsers.has(broadcast.user_id)) {
                        paintedLiveUsers.add(broadcast.user_id);
                        const profile = broadcast.profiles;
                        html += `
                            <div class="story-item is-live" onclick="ComunidadApp.openLiveViewer('${broadcast.playback_url}', '${profile.username || profile.display_name}', '${broadcast.id}')">
                                <div class="story-avatar-container" style="background: linear-gradient(45deg, #ef4444, #b72a1e); animation: pulse-border 2s infinite;">
                                    <img src="${profile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${broadcast.user_id}`}" alt="Avatar" class="story-avatar">
                                </div>
                                <span class="story-username" style="color: #ef4444; font-weight: bold;">🔴 EN VIVO</span>
                            </div>
                        `;
                    }
                });
            }

            // 4. Pintar a los investigadores normales
            const paintedNormalUsers = new Set();
            topMembers.forEach(member => {
                if (!paintedLiveUsers.has(member.id) && !paintedNormalUsers.has(member.id)) {
                    paintedNormalUsers.add(member.id);
                    
                    // --- CORRECCIÓN DEL ENLACE AL MODAL ---
                    // Usamos username. Si por algún error no tiene username, usamos su ID como respaldo.
                    const userParam = member.username ? `'${member.username}'` : `'${member.id}'`;
                    
                    html += `
                        <div class="story-item" onclick="ComunidadApp.openProfileModal(${userParam})">
                            <div class="story-avatar-container">
                                <img src="${member.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="story-avatar">
                            </div>
                            <span class="story-username">${member.display_name || member.username}</span>
                        </div>
                    `;
                }
            });

            container.innerHTML = html;

        } catch (error) {
            console.error("Error cargando el carrusel de destacados:", error);
        }
    },

    // 3. Obtener el Podcast vía RSS (Al estilo app.js)
    async fetchLatestPodcast() {
        try {
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua';            const response = await fetch(rssUrl);
            const data = await response.json();
            
            if (data.status === 'ok' && data.items.length > 0) {
                const latestEpisode = data.items[0];
                
                // Extraemos el mp3, el título y la portada
                const audioUrl = latestEpisode.enclosure.link;
                const title = latestEpisode.title;
                const imgUrl = latestEpisode.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
                
                // Inyectamos todo en la caja oculta
                document.getElementById('podcast-title').textContent = title;
                document.getElementById('podcast-audio').src = audioUrl;
                document.getElementById('podcast-cover').src = imgUrl;
            } else {
                document.getElementById('podcast-title').textContent = "No hay episodios disponibles.";
            }
        } catch (error) {
            console.error("Error al cargar el podcast:", error);
            document.getElementById('podcast-title').textContent = "Error de conexión con el Podcast.";
        }
    },

    // ==========================================
    // LÓGICA DEL REPRODUCTOR DE PODCAST (LISTA DE REPRODUCCIÓN)
    // ==========================================
    podcastEpisodes: [],
    currentEpisodeIndex: 0,

    setupAudioPlayer() {
        // --- NUEVO: Lógica de Minimizar en Móvil ---
        const minimizeBtn = document.getElementById('player-minimize-btn');
        const playerContainer = document.getElementById('persistent-audio-player');
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                playerContainer.classList.toggle('is-minimized');
            });
        }
        const audioEl = document.getElementById('hidden-audio-source');
        const playBtn = document.getElementById('player-play-btn');
        const closeBtn = document.getElementById('player-close-btn');
        const timeline = document.getElementById('player-timeline-slider');
        const currentTimeEl = document.getElementById('player-current-time');
        const durationEl = document.getElementById('player-duration');
        const volumeSlider = document.getElementById('player-volume-slider');
        //*const playerContainer = document.getElementById('persistent-audio-player');*//
        const playlistPanel = document.getElementById('podcast-playlist-panel');
        
        // 1. Play / Pause
        playBtn.addEventListener('click', () => {
            if (audioEl.paused) { audioEl.play(); playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; } 
            else { audioEl.pause(); playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
        });

        // 2. AVANZAR Y RETROCEDER ENTRE EPISODIOS
        document.getElementById('player-rewind-btn').addEventListener('click', () => {
            if (this.currentEpisodeIndex > 0) this.loadEpisodeIntoPlayer(this.currentEpisodeIndex - 1);
        });
        document.getElementById('player-forward-btn').addEventListener('click', () => {
            if (this.currentEpisodeIndex < this.podcastEpisodes.length - 1) this.loadEpisodeIntoPlayer(this.currentEpisodeIndex + 1);
        });

        // 3. Menú Flotante de la Lista de Reproducción
        document.getElementById('player-playlist-btn').addEventListener('click', () => {
            playlistPanel.style.display = playlistPanel.style.display === 'none' ? 'flex' : 'none';
        });
        document.getElementById('close-playlist-btn').addEventListener('click', () => {
            playlistPanel.style.display = 'none';
        });

        // Delegación de clics en la lista para reproducir uno específico
        document.getElementById('podcast-playlist-list').addEventListener('click', (e) => {
            const item = e.target.closest('.playlist-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.loadEpisodeIntoPlayer(index);
                // Si la lista molesta al usuario tras elegir, la podemos ocultar:
                // playlistPanel.style.display = 'none'; 
            }
        });

        // 4. Controles de tiempo y cierre...
        closeBtn.addEventListener('click', () => {
            audioEl.pause(); playlistPanel.style.display = 'none';
            playerContainer.classList.remove('is-visible');
            setTimeout(() => { playerContainer.style.display = 'none'; }, 400); 
        });

        audioEl.addEventListener('timeupdate', () => {
            const currentM = Math.floor(audioEl.currentTime / 60);
            const currentS = Math.floor(audioEl.currentTime - currentM * 60);
            currentTimeEl.textContent = `${currentM}:${currentS.toString().padStart(2, '0')}`;
            
            if (audioEl.duration) {
                const durationM = Math.floor(audioEl.duration / 60);
                const durationS = Math.floor(audioEl.duration - durationM * 60);
                durationEl.textContent = `${durationM}:${durationS.toString().padStart(2, '0')}`;
                timeline.value = (audioEl.currentTime / audioEl.duration) * 100;
            }
        });

        timeline.addEventListener('input', () => { if(audioEl.duration) audioEl.currentTime = (timeline.value / 100) * audioEl.duration; });
        volumeSlider.addEventListener('input', () => { audioEl.volume = volumeSlider.value / 100; });

        // Auto-reproducir siguiente episodio al terminar (CON BUCLE)
        audioEl.addEventListener('ended', () => {
            if (this.currentEpisodeIndex < this.podcastEpisodes.length - 1) {
                this.loadEpisodeIntoPlayer(this.currentEpisodeIndex + 1);
            } else {
                // Si llegó al final, vuelve a reproducir el episodio 0
                this.loadEpisodeIntoPlayer(0);
            }
        });

        // Lanzar desde Bento Box
        document.getElementById('btn-launch-podcast').addEventListener('click', () => {
            const iframe = document.getElementById('ept-tv-iframe');
            if(iframe) iframe.src = ''; 
            audioEl.play(); playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            playerContainer.style.display = 'block';
            setTimeout(() => playerContainer.classList.add('is-visible'), 10);
        });
    },

    async fetchLatestPodcast() {
        try {
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua';
            const response = await fetch(rssUrl);
            
            if (!response.ok) throw new Error("Servidor RSS caído"); // Capturamos el error 500
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.items.length > 0) {
                this.podcastEpisodes = data.items; 
                // ... (código de renderizado de la lista queda igual)
                const listContainer = document.getElementById('podcast-playlist-list');
                listContainer.innerHTML = this.podcastEpisodes.map((ep, idx) => {
                    const img = ep.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
                    const date = new Date(ep.pubDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
                    return `<li class="playlist-item" data-index="${idx}">
                                <img src="${img}" class="playlist-item-img">
                                <div class="playlist-item-info">
                                    <p class="playlist-item-title">${ep.title}</p>
                                    <p class="playlist-item-date">${date}</p>
                                </div>
                            </li>`;
                }).join('');

                this.loadEpisodeIntoPlayer(0);
                this.setupAudioPlayer();
            } else {
                throw new Error("No hay items");
            }
        } catch (error) { 
            console.warn("Aviso controlado - Podcast:", error.message); 
            document.getElementById('podcast-title').textContent = "Podcast temporalmente no disponible";
        }
    },

    loadEpisodeIntoPlayer(index) {
        if (index < 0 || index >= this.podcastEpisodes.length) return;
        this.currentEpisodeIndex = index;
        
        const episode = this.podcastEpisodes[index];
        const audioUrl = episode.enclosure.link;
        const imgUrl = episode.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
        const title = episode.title;

        // Actualiza el Bento Box lateral
        document.getElementById('podcast-title').textContent = title;
        document.getElementById('podcast-cover').src = imgUrl;

        // Actualiza el reproductor persistente
        const audioEl = document.getElementById('hidden-audio-source');
        const isPlaying = !audioEl.paused;
        
        audioEl.src = audioUrl;
        document.getElementById('player-track-title').textContent = title;
        document.getElementById('player-track-image').src = imgUrl;

        // Marcar visualmente el episodio activo en la lista
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            if (i === index) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Si ya estaba sonando otro, que este arranque automáticamente
        if (isPlaying || document.getElementById('persistent-audio-player').classList.contains('is-visible')) {
            audioEl.play().catch(e => console.log("Autoplay bloquedo", e));
            document.getElementById('player-play-btn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        }
        
        // Expandir automáticamente si estaba minimizado
        const playerContainer = document.getElementById('persistent-audio-player');
        if (playerContainer) playerContainer.classList.remove('is-minimized');
    },

    openProfileModal(username) {
        console.log("Abriendo perfil de:", username);
        let modalContainer = document.getElementById('modal-container');
        
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        // Eliminamos la "opacidad" manual para no pelear con tu archivo style.css
        modalContainer.innerHTML = `
            <div class="modal-overlay" id="profile-iframe-overlay" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
                <div class="modal" style="width: 95%; max-width: 1000px; height: 90vh; padding: 0; position: relative; overflow: hidden; background: var(--color-background); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.3s ease;">
                    <button class="modal-close-btn" style="position: absolute; top: 15px; right: 25px; z-index: 10; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.5rem; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s;">&times;</button>
                    <iframe src="/@${username}" style="width: 100%; height: 100%; border: none; background: var(--color-background);"></iframe>
                </div>
            </div>
        `;
        
        const overlay = document.getElementById('profile-iframe-overlay');
        const modalBox = overlay.querySelector('.modal');
        document.body.style.overflow = 'hidden'; 
        
        // ¡LA SOLUCIÓN! Añadimos la clase oficial is-visible para que el CSS lo revele suavemente
        setTimeout(() => {
            overlay.classList.add('is-visible');
            modalBox.style.transform = 'scale(1)';
        }, 10);
        
        // Función de cierre que remueve la visibilidad
        const closeFn = () => {
            overlay.classList.remove('is-visible');
            modalBox.style.transform = 'scale(0.95)';
            document.body.style.overflow = '';
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        };
        
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeFn(); });
    },

    // Detecta si hay un link mientras el usuario escribe
    detectLinkInText(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const match = text.match(urlRegex);
        const currentUrl = match ? match[0] : null;

        // Si hay una URL y es distinta a la última procesada
        if (currentUrl && currentUrl !== this.lastProcessedUrl) {
            this.lastProcessedUrl = currentUrl;
            this.fetchLinkPreview(currentUrl);
        } else if (!currentUrl) {
            this.lastProcessedUrl = null;
            document.getElementById('link-preview-editor').style.display = 'none';
        }
    },

    // Obtiene los datos del link y los muestra en el editor
    async fetchLinkPreview(url) {
        const loader = document.getElementById('link-preview-loader');
        const container = document.getElementById('link-preview-editor');
        
        loader.style.display = 'block';
        
        try {
            // Usamos una API gratuita de ayuda para obtener metadatos rápidamente en el cliente
            const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
            const json = await res.json();
            const meta = json.data;

            if (meta) {
                container.innerHTML = `
                    <button type="button" class="remove-image-btn" onclick="document.getElementById('link-preview-editor').style.display='none'" style="top: 5px; right: 5px;">&times;</button>
                    ${meta.image ? `<img src="${meta.image.url}" style="width:100%; height:150px; object-fit:cover; border-bottom:1px solid var(--color-border);">` : ''}
                    <div style="padding:12px;">
                        <strong style="display:block; font-size:0.9rem; color:var(--color-primary-text); margin-bottom:4px;">${meta.title || 'Enlace'}</strong>
                        <p style="font-size:0.8rem; color:var(--color-secondary-text); margin:0; line-height:1.2;">${meta.description || ''}</p>
                        <span style="font-size:0.75rem; color:var(--color-accent); margin-top:8px; display:block;"><i class="fa-solid fa-link"></i> ${new URL(url).hostname}</span>
                    </div>
                `;
                container.style.display = 'block';
            }
        } catch (e) {
            console.error("Error preview:", e);
        } finally {
            loader.style.display = 'none';
        }
    },

    // ==========================================
    // MODAL DE LECTURA (RESUMEN NATIVO BASE DE DATOS)
    // ==========================================
    openPublicationModal(index) {
        // Recuperamos los datos del artículo seleccionado
        const pub = this.currentStoriesData[index];
        if (!pub) return;

        console.log("Abriendo resumen nativo:", pub.title);
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
        const dateStr = new Date(pub.published_at).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
        const author = pub.author_name || 'Redacción EPT';
        
        // Cortamos la descripción a 250 caracteres para un resumen perfecto y añadimos "..."
        let desc = pub.description || 'Lee el artículo completo en nuestra revista oficial.';
        if (desc.length > 250) desc = desc.substring(0, 250) + '...';

        modalContainer.innerHTML = `
            <div class="modal-overlay" id="pub-iframe-overlay" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);">
                
                <div class="modal" style="width: 95%; max-width: 550px; height: auto; max-height: 90vh; padding: 0; position: relative; overflow-y: auto; background: var(--color-surface); border-radius: 16px; box-shadow: 0 15px 50px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    
                    <div style="width: 100%; height: 220px; position: relative;">
                        <button class="modal-close-btn" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; backdrop-filter: blur(4px);">&times;</button>
                        <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 50%; background: linear-gradient(to top, var(--color-surface), transparent);"></div>
                    </div>

                    <div style="padding: 0 2rem 2rem 2rem; position: relative; z-index: 2; margin-top: -20px;">
                        <span style="background: var(--color-accent); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Revista</span>
                        
                        <h2 style="margin: 15px 0 10px 0; font-size: 1.4rem; color: var(--color-primary-text); line-height: 1.3;">${pub.title}</h2>
                        
                        <div style="display: flex; gap: 15px; color: var(--color-secondary-text); font-size: 0.85rem; margin-bottom: 20px; font-weight: 500;">
                            <span><i class="fa-solid fa-pen-nib"></i> ${author}</span>
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                        
                        <p style="color: var(--color-primary-text); font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px; opacity: 0.9;">
                            ${desc}
                        </p>
                        
                        <a href="${pub.url}" target="_blank" class="btn-primary" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; font-size: 1rem; width: 100%; box-shadow: 0 4px 15px rgba(183, 42, 30, 0.4);">
                            Leer artículo completo <i class="fa-solid fa-arrow-right"></i>
                        </a>
                    </div>

                </div>
            </div>
        `;
        
        const overlay = document.getElementById('pub-iframe-overlay');
        const modalBox = overlay.querySelector('.modal');
        document.body.style.overflow = 'hidden'; 
        
        setTimeout(() => {
            overlay.classList.add('is-visible');
            modalBox.style.transform = 'scale(1)';
        }, 10);
        
        const closeFn = () => {
            overlay.classList.remove('is-visible');
            modalBox.style.transform = 'scale(0.95)';
            document.body.style.overflow = '';
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        };
        
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeFn(); });
    },

    // ==========================================
    // VISOR DE IMÁGENES (LIGHTBOX)
    // ==========================================
    openImageLightbox(src) {
        const overlay = document.getElementById('image-lightbox-overlay');
        const img = document.getElementById('lightbox-full-image');
        if (overlay && img) {
            img.src = src;
            overlay.style.display = 'flex';
            
            // Forzamos un micro-retraso para que la animación CSS se dispare correctamente
            setTimeout(() => overlay.classList.add('is-visible'), 10);
            
            // Cierra al hacer clic en el fondo oscuro o en la X
            overlay.onclick = (e) => { 
                if (e.target === overlay || e.target.id === 'lightbox-close-btn') {
                    overlay.classList.remove('is-visible'); // Iniciamos la desaparición suave
                    
                    // Esperamos a que termine la animación (300ms) para ocultarlo del todo
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        img.src = '';
                    }, 300);
                }
            };
        }
    },

    // ==========================================
    // SISTEMA UNIFICADO DE CHAT (ESPECTADOR Y BROADCASTER)
    // ==========================================
    liveChatChannel: null,
    currentBroadcastId: null,
    chatFadeTimer: null,

    openLiveViewer(playbackUrl, handle, broadcastId) {
        this.currentBroadcastId = broadcastId;
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;

        const embedUrl = "https://stream.place/embed/epistecnologia.com";
        
        const chatInputHtml = this.user 
            ? `<div style="display: flex; gap: 8px; align-items: center;">
                 <button id="btn-react-viewer" class="btn-reaction" title="Reaccionar">❤️</button>
                 <div class="chat-input-wrapper" style="flex-grow: 1;">
                     <input type="text" id="golive-chat-input" placeholder="Escribe..." autocomplete="off">
                     <button id="btn-send-golive-chat"><i class="fa-solid fa-paper-plane"></i></button>
                 </div>
               </div>`
            : `<div class="chat-login-prompt">
                 <p>Inicia sesión para participar en el chat</p>
                 <a href="/?auth=open" class="btn-primary-sm" style="font-size: 0.8rem; padding: 6px 12px; display: inline-block; text-decoration: none;">Entrar</a>
               </div>`;

        const modalHtml = `
            <div class="live-agora-fullscreen" id="live-viewer-overlay">
                <button class="modal-close-btn" id="close-viewer-btn" style="position: absolute; right: 15px; top: 15px; color: white; background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; width: 40px; height: 40px; border-radius: 50%; z-index: 20; cursor: pointer;">&times;</button>
                
                <div class="video-background-layer">
                    <iframe src="${embedUrl}" allow="autoplay; fullscreen" allowfullscreen></iframe>
                    <div class="video-overlay-info">
                        <span class="badge-live"><span class="dot"></span> EN VIVO</span>
                        <span class="user-handle">@${handle}</span>
                    </div>
                </div>

                <div class="chat-overlay-layer">
                    <div id="golive-chat-messages" class="chat-scroll-area"></div>
                    <div class="chat-controls-area">
                        ${chatInputHtml}
                    </div>
                </div>
            </div>
        `;
        
        modalContainer.innerHTML = modalHtml;
        document.getElementById('close-viewer-btn').onclick = () => this.closeLiveViewer();
        
        if (this.user) {
            this.setupRobustChatInput('golive-chat-input', 'btn-send-golive-chat');
        }

        // Llamamos al motor unificado indicándole qué contenedor usar
        this.initUnifiedChat(broadcastId, 'golive-chat-messages');
    },

    closeLiveViewer() {
        if (this.liveChatChannel) {
            this.supabase.removeChannel(this.liveChatChannel);
            this.liveChatChannel = null;
        }
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    },

    // ---------------------------------------------------------
    // MOTOR DE CHAT UNIFICADO (Emisor y Receptor usan lo mismo)
    // ---------------------------------------------------------
    async initUnifiedChat(broadcastId, containerId) {
        const msgContainer = document.getElementById(containerId);
        if (!msgContainer) return;
        msgContainer.innerHTML = '';

        try {
            const { data, error } = await this.supabase
                .from('golive_chat')
                .select('*').eq('broadcast_id', broadcastId).order('created_at', { ascending: true }).limit(50);

            if (!error && data.length > 0) {
                data.forEach(msg => this.renderUnifiedChatMessage(msg, containerId));
            }
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (e) { console.error("Error cargando chat:", e); }

        if (this.liveChatChannel) this.supabase.removeChannel(this.liveChatChannel);

        this.liveChatChannel = this.supabase.channel(`chat_${broadcastId}`)
            // Escuchamos mensajes normales (Base de datos)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'golive_chat', filter: `broadcast_id=eq.${broadcastId}` }, 
            payload => { this.renderUnifiedChatMessage(payload.new, containerId); })
            // NUEVO: Escuchamos reacciones en tiempo real (Broadcast)
            .on('broadcast', { event: 'reaction' }, payload => {
                this.animateReaction(payload.payload.emoji, containerId);
            })
            .subscribe();
            
        // NUEVO: Listeners para los botones de reacción
        const btnReactViewer = document.getElementById('btn-react-viewer');
        const btnReactStudio = document.getElementById('btn-react-studio');
        if (btnReactViewer) btnReactViewer.onclick = () => this.sendReaction('❤️');
        if (btnReactStudio) btnReactStudio.onclick = () => this.sendReaction('❤️');
    },

    async sendReaction(emoji) {
        if (!this.liveChatChannel) return;
        // Enviamos el emoji por el canal de WebSocket sin tocar la base de datos
        this.liveChatChannel.send({
            type: 'broadcast',
            event: 'reaction',
            payload: { emoji: emoji }
        });
        // Animamos localmente para nosotros mismos inmediatamente
        const containerId = document.getElementById('golive-fullscreen-studio') && !document.getElementById('golive-fullscreen-studio').classList.contains('hidden') ? 'studio-chat-messages' : 'golive-chat-messages';
        this.animateReaction(emoji, containerId);
    },

    animateReaction(emoji, containerId) {
        // Buscamos el contenedor padre dependiendo si somos emisor o receptor
        const targetLayer = containerId === 'studio-chat-messages' 
            ? document.getElementById('studio-chat-overlay') 
            : document.querySelector('.chat-overlay-layer');
            
        if (!targetLayer) return;

        const reactionEl = document.createElement('div');
        reactionEl.classList.add('floating-reaction');
        reactionEl.innerText = emoji;

        // Pequeña aleatoriedad horizontal para que no suban en línea recta perfecta
        const randomOffset = Math.floor(Math.random() * 40) - 20; 
        reactionEl.style.transform = `translateX(${randomOffset}px)`;

        targetLayer.appendChild(reactionEl);

        // Limpieza de memoria: Eliminamos el elemento cuando termina la animación (2 segundos)
        setTimeout(() => { reactionEl.remove(); }, 2000);
    },

    renderUnifiedChatMessage(msg, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const isMe = this.user && msg.user_id === this.user.id;
        const avatar = msg.user_avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${msg.user_id}`;
        
        let displayName = msg.user_name;
        let nameColor = '#ffffff';
        if (isMe) {
            displayName = 'Tú';
            nameColor = '#38bdf8'; // Azul para destacar
        }

        // Diseño estructural idéntico para Emisor y Receptor
        const msgHtml = `
            <div class="golive-chat-msg-row">
                <img src="${avatar}">
                <div>
                    <span class="golive-chat-msg-name" style="color: ${nameColor};">${displayName}</span>
                    <p class="golive-chat-msg-text">${msg.message}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHtml);
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

        // Si somos el Emisor y llega un mensaje nuevo, despertamos la pantalla
        if (containerId === 'studio-chat-messages') {
            this.wakeUpChatOverlay();
        }
    },

    async sendLiveChatMessage(messageText) {
        if (!this.user || !this.currentBroadcastId) {
            console.error("No se puede enviar: Faltan datos (User o BroadcastID)");
            return;
        }

        const userName = this.userProfile?.display_name || this.userProfile?.username || 'Investigador';
        const userAvatar = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${this.user.id}`;

        try {
            const { error } = await this.supabase.from('golive_chat').insert([{
                broadcast_id: this.currentBroadcastId,
                user_id: this.user.id,
                user_name: userName,
                user_avatar: userAvatar,
                message: messageText
            }]);
            if (error) throw error;
        } catch (e) { console.error("Error al enviar mensaje:", e); }
    },

    setupRobustChatInput(inputId, btnId) {
        let input = document.getElementById(inputId);
        let btn = document.getElementById(btnId);
        if (!input || !btn) return;

        const newInput = input.cloneNode(true);
        const newBtn = btn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        btn.parentNode.replaceChild(newBtn, btn);

        const triggerSend = () => {
            const val = newInput.value.trim();
            if (val !== '') {
                newInput.value = ''; 
                this.sendLiveChatMessage(val);
                newInput.focus(); 
            }
        };

        newBtn.addEventListener('click', (e) => { e.preventDefault(); triggerSend(); });
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                triggerSend();
            }
        });
    },

    // ---------------------------------------------------------
    // AUTO-FADE DE INACTIVIDAD MEJORADO (Para el Emisor)
    // ---------------------------------------------------------
    setupBroadcasterFadeOut() {
        const studioArea = document.getElementById('golive-fullscreen-studio');
        if (!studioArea) return;
        
        // Usamos 'pointer' events que agrupan touch, mouse y stylus de forma perfecta
        const wakeUpEvents = ['pointerdown', 'pointermove', 'keydown'];
        
        // Limpiamos listeners previos de sesiones anteriores para evitar clones
        if (this._wakeUpHandler) {
            wakeUpEvents.forEach(evt => studioArea.removeEventListener(evt, this._wakeUpHandler));
        }
        
        this._wakeUpHandler = () => this.wakeUpChatOverlay();
        
        wakeUpEvents.forEach(evt => {
            studioArea.addEventListener(evt, this._wakeUpHandler, { passive: true });
        });

        this.wakeUpChatOverlay(); // Encendemos al arrancar
    },

    wakeUpChatOverlay() {
        const overlay = document.getElementById('studio-chat-overlay');
        const controls = document.querySelector('.studio-controls-ui');
        
        if (!overlay) return;

        // 1. Despertar instantáneamente
        overlay.style.opacity = '1';
        if (controls) controls.style.opacity = '1';

        // 2. Destruir cualquier temporizador previo
        if (this.chatFadeTimer) clearTimeout(this.chatFadeTimer);

        // 3. Crear el nuevo temporizador de 5 segundos
        this.chatFadeTimer = setTimeout(() => {
            const input = document.getElementById('studio-chat-input');
            
            // Si el input tiene el foco (el teclado virtual está abierto), ABORTAR el desvanecimiento.
            if (document.activeElement === input) return;
            
            // Si nadie está escribiendo, desvanecer
            overlay.style.opacity = '0.2'; 
            if (controls) controls.style.opacity = '0.4'; 
        }, 5000);
    },

    async handleBlueskyOAuthStart() {
        const oauthBtn = document.getElementById('bsky-oauth-start-btn');
        if (oauthBtn) {
            oauthBtn.disabled = true;
            oauthBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        }
        try {
            const redirectUri = window.location.origin + window.location.pathname;
            const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', {
                body: { redirect_uri: redirectUri }
            });
            if (error) throw error;
            if (data?.auth_url) window.location.href = data.auth_url;
        } catch (error) {
            alert("❌ No pudimos conectar con Bluesky en este momento.");
            if (oauthBtn) {
                oauthBtn.disabled = false;
                oauthBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Autorizar con Bluesky';
            }
        }
    },

    async checkForBlueskyCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
            window.history.replaceState({}, document.title, window.location.pathname);
            if (window.showToast) window.showToast("⏳ Finalizando conexión con Bluesky...");

            try {
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-callback', {
                    body: { 
                        code: code, 
                        state: state,
                        redirect_uri: window.location.origin + window.location.pathname 
                    }
                });
                if (error) throw error;
                
                alert(`✅ ¡Cuenta de Bluesky conectada! Bienvenido, @${data.handle}`);
                location.reload(); 
            } catch (error) {
                alert("❌ Hubo un problema al guardar tu cuenta de Bluesky. Intenta de nuevo.");
            }
        }
    },

    openStreamKeyModal() {
        const template = document.getElementById('streamkey-connect-template');
        if (!template) return;
        const modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) {
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => {
            modalContainer.innerHTML = '';
        });
        
        const saveBtn = modalContainer.querySelector('#save-streamkey-btn');
        saveBtn.addEventListener('click', async () => {
            const keyInput = modalContainer.querySelector('#streamkey-input').value.trim();
            if(!keyInput.startsWith('did:key:')) return alert("La llave debe empezar con did:key:");
            
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            saveBtn.disabled = true;

            const { error } = await this.supabase.from('bsky_credentials')
                .update({ stream_key: keyInput }).eq('user_id', this.user.id);
            
            if (error) {
                alert("Error al guardar la llave.");
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Guardar y Transmitir';
                return;
            }

            if (!this.bskyCreds) this.bskyCreds = {}; // <-- Asegura que el objeto exista
            this.bskyCreds.stream_key = keyInput;
            modalContainer.innerHTML = ''; // Cierra el modal
            this.startBroadcastToStreamplace(); // Reanuda
        });
    },

};

// Inicializar la aplicación SOLAMENTE cuando main.js haya preparado Supabase
document.addEventListener('mainReady', () => {
    ComunidadApp.init();
    // Exponemos la app al navegador para que funcionen los OnClick del HTML
window.ComunidadApp = ComunidadApp;
});
