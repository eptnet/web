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
        
        this.checkForBlueskyCallback(); 
        this.subscribeToLiveBroadcasts();
        this.addEventListeners();
    },

    // --- GESTIÓN DE LA SESIÓN DEL USUARIO ---
    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();

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
        this.supabase.channel('public:active_broadcasts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_broadcasts' }, payload => {
                this.handleLiveStatusChange(payload);
            }).subscribe();
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
        document.getElementById('golive-setup-panel').classList.remove('hidden');
        document.getElementById('golive-live-ui').classList.add('hidden');
        
        const avatarImg = document.getElementById('golive-audio-avatar');
        if (avatarImg && this.userProfile) avatarImg.src = this.userProfile.avatar_url || 'https://api.dicebear.com/9.x/shapes/svg?seed=user';

        document.getElementById('btn-close-setup').onclick = () => this.closeGoLiveModal();
        document.getElementById('btn-ready-to-live').onclick = () => this.startBroadcastToStreamplace();
        document.getElementById('btn-switch-lens').onclick = () => this.switchLens();
        document.getElementById('btn-toggle-camera').onclick = () => this.toggleCamera();
        document.getElementById('golive-video-select').onchange = () => this.startCameraPreview(true);
        document.getElementById('golive-audio-select').onchange = () => this.startCameraPreview(true);

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
            if (this.localMediaStream) this.localMediaStream.getTracks().forEach(track => track.stop());

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
                previewVideo.style.transform = !videoSelect?.value ? "scaleX(-1)" : "scaleX(1)";
            }

            if (!isDeviceChange) await this.populateDeviceSelectors();
        } catch (error) { console.error("Error cámara:", error); }
    },

    async switchLens() {
        if (this.isCameraOff) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            if (videoDevices.length < 2) {
                if(window.showToast) window.showToast("No se encontraron cámaras adicionales.");
                return;
            }

            const currentTrack = this.localMediaStream.getVideoTracks()[0];
            const currentDeviceId = currentTrack.getSettings().deviceId;

            let currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
            let nextIndex = (currentIndex + 1) % videoDevices.length; 
            let nextDevice = videoDevices[nextIndex];

            if (currentTrack) {
                currentTrack.stop(); 
                this.localMediaStream.removeTrack(currentTrack);
            }

            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { deviceId: { exact: nextDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } 
            });
            
            const newVideoTrack = newStream.getVideoTracks()[0];
            const videoEl = document.getElementById('golive-local-video');
            
            const label = nextDevice.label.toLowerCase();
            const isFront = label.includes('front') || label.includes('user') || label.includes('frontal') || (nextIndex === 0 && !label.includes('back') && !label.includes('environment'));
            videoEl.style.transform = isFront ? "scaleX(-1)" : "scaleX(1)";
            
            this.localMediaStream.addTrack(newVideoTrack);
            
            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(newVideoTrack);
            }

            const videoSelect = document.getElementById('golive-video-select');
            if (videoSelect) videoSelect.value = nextDevice.deviceId;
            
        } catch (err) {
            console.error("Error al cambiar de cámara:", err);
            this.startCameraPreview();
        }
    },

    async switchMicDevice() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(d => d.kind === 'audioinput');

            if (audioDevices.length < 2) return;

            const currentTrack = this.localMediaStream.getAudioTracks()[0];
            const currentDeviceId = currentTrack ? currentTrack.getSettings().deviceId : null;

            let currentIndex = audioDevices.findIndex(d => d.deviceId === currentDeviceId);
            let nextIndex = (currentIndex + 1) % audioDevices.length; 
            let nextDevice = audioDevices[nextIndex];

            if (currentTrack) {
                currentTrack.stop();
                this.localMediaStream.removeTrack(currentTrack);
            }

            const newStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: { exact: nextDevice.deviceId }, echoCancellation: true, noiseSuppression: true } 
            });
            const newAudioTrack = newStream.getAudioTracks()[0];
            
            this.localMediaStream.addTrack(newAudioTrack);
            
            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
                if (sender) await sender.replaceTrack(newAudioTrack);
            }

            const audioSelect = document.getElementById('golive-audio-select');
            if (audioSelect) audioSelect.value = nextDevice.deviceId;
            
        } catch (err) { console.error("Error al cambiar de micrófono:", err); }
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

    async toggleCamera() {
        if (!this.localMediaStream) return;
        const videoTrack = this.localMediaStream.getVideoTracks()[0];
        if (!videoTrack) return;

        this.isCameraOff = !this.isCameraOff;
        const videoEl = document.getElementById('golive-local-video');
        const audioModeEl = document.getElementById('golive-audio-mode');
        const btnCam = document.getElementById('btn-toggle-camera');
        
        const sender = this.peerConnection ? this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video') : null;

        if (this.isCameraOff) {
            videoEl.classList.add('hidden');
            audioModeEl.classList.remove('hidden');
            btnCam.innerHTML = '<i class="fa-solid fa-video-slash" style="color: #ef4444;"></i>';
            videoTrack.enabled = false; 
            this.startAudioVisualizer();
            
            if (sender) {
                const canvas = document.getElementById('golive-visualizer');
                const canvasStream = canvas.captureStream(30); 
                await sender.replaceTrack(canvasStream.getVideoTracks()[0]);
            }
        } else {
            videoEl.classList.remove('hidden');
            audioModeEl.classList.add('hidden');
            btnCam.innerHTML = '<i class="fa-solid fa-video"></i>';
            if (this.visualizerAnimationId) cancelAnimationFrame(this.visualizerAnimationId);
            videoTrack.enabled = true;
            if (sender) await sender.replaceTrack(videoTrack);
        }
    },

    toggleMic() {
        if (!this.localMediaStream) return;
        const audioTrack = this.localMediaStream.getAudioTracks()[0];
        if (!audioTrack) return;

        this.isMicMuted = !this.isMicMuted;
        audioTrack.enabled = !this.isMicMuted; 
        
        const btnMic = document.getElementById('btn-toggle-mic');
        btnMic.innerHTML = this.isMicMuted ? '<i class="fa-solid fa-microphone-slash" style="color: #ef4444;"></i>' : '<i class="fa-solid fa-microphone"></i>';
    },

    startAudioVisualizer() {
        const canvas = document.getElementById('golive-visualizer');
        const container = document.getElementById('golive-audio-mode');
        if (!canvas || !container) return;
        const ctx = canvas.getContext('2d');
        
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const avatarImg = new Image();
        avatarImg.crossOrigin = "anonymous"; 
        avatarImg.src = this.userProfile?.avatar_url || 'https://api.dicebear.com/9.x/shapes/svg?seed=user';

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
            const radius = Math.min(canvas.width, canvas.height) * 0.15; 

            ctx.lineWidth = 4;
            for(let i = 0; i < bufferLength; i++) {
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

    async startBroadcastToStreamplace() {
        const btnReady = document.getElementById('btn-ready-to-live');
        if (btnReady) {
            btnReady.disabled = true;
            btnReady.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
        }
        
        try {
            if (!this.bskyCreds) this.bskyCreds = {};
            const streamKey = this.bskyCreds.stream_key;
            if (!streamKey) {
                if (btnReady) {
                    btnReady.disabled = false;
                    btnReady.innerHTML = '<i class="fa-solid fa-bolt"></i> Iniciar Transmisión';
                }
                alert("No se detectó tu Stream Key.");
                return;
            }

            const { data, error } = await this.supabase.functions.invoke('start-broadcast', { body: { streamKey: streamKey }});
            if (error) throw error;
            if (!data || !data.ingestUrl) throw new Error("La Edge Function no devolvió URL.");

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

            const response = await fetch(whipUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/sdp', 'Authorization': `Bearer ${streamKey}` },
                body: offer.sdp
            });

            if (!response.ok) throw new Error(`Fallo WHIP: ${response.status}`);

            const answerSdp = await response.text();
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

            document.getElementById('golive-setup-panel').classList.add('hidden');
            document.getElementById('golive-live-ui').classList.remove('hidden');
            
            document.getElementById('btn-switch-lens').onclick = () => this.switchLens();
            document.getElementById('btn-switch-mic').onclick = () => this.switchMicDevice();
            document.getElementById('btn-toggle-camera').onclick = () => this.toggleCamera();
            document.getElementById('btn-toggle-mic').onclick = () => this.toggleMic();
            document.getElementById('btn-stop-broadcast').onclick = () => this.stopBroadcast();
            document.getElementById('btn-toggle-studio-chat').onclick = () => {
                document.getElementById('studio-chat-overlay').classList.toggle('hidden');
                this.wakeUpChatOverlay();
            };

            let broadcastId = data.id || data.broadcast_id || data.broadcastId;
            if (!broadcastId) {
                for(let i=0; i<4; i++) {
                    const { data: dbData } = await this.supabase.from('active_broadcasts').select('id').eq('user_id', this.user.id).eq('status', 'live').limit(1); 
                    if (dbData && dbData.length > 0) { broadcastId = dbData[0].id; break; }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            if (broadcastId) {
                this.currentBroadcastId = broadcastId;
                document.getElementById('studio-chat-overlay').classList.remove('hidden');
                this.setupRobustChatInput('studio-chat-input', 'btn-send-studio-chat');
                this.initUnifiedChat(broadcastId, 'studio-chat-messages');
                this.setupBroadcasterFadeOut();
            }
        } catch (err) {
            console.error("Error al transmitir:", err);
            const btnReady = document.getElementById('btn-ready-to-live');
            if (btnReady) {
                btnReady.disabled = false;
                btnReady.innerHTML = '<i class="fa-solid fa-bolt"></i> Reintentar';
            }
            if (this.supabase && this.user) {
                try { await this.supabase.from('active_broadcasts').update({ status: 'ended' }).eq('user_id', this.user.id).eq('status', 'live'); } catch(e) {}
            }
        }
    },

    async stopBroadcast() {
        if (!confirm("¿Seguro que deseas terminar la transmisión?")) return;
        if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
        if (this.studioChatChannel) { this.supabase.removeChannel(this.studioChatChannel); this.studioChatChannel = null; }
        try { await this.supabase.from('active_broadcasts').update({ status: 'ended' }).eq('user_id', this.user.id).eq('status', 'live'); } catch(e) {}
        this.closeGoLiveModal();
    },

    async renderUserPanel() {
        const loadingPanel = document.getElementById('user-panel-loading');
        const contentPanel = document.getElementById('user-panel-content');
        
        if (this.userProfile) {
            const userName = this.userProfile.display_name || 'Sin nombre';
            document.getElementById('user-panel-avatar').src = this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${userName}`;

            const sloganEl = document.getElementById('user-panel-slogan');
            const bioEl = document.getElementById('user-panel-bio');

            if (this.userProfile.bio_short) {
                sloganEl.textContent = `"${this.userProfile.bio_short}"`;
                sloganEl.style.display = 'block';
            } else {
                sloganEl.style.display = 'none';
            }
            if (bioEl) bioEl.textContent = this.userProfile.bio || 'Divulgador en Epistecnología';
            
            const hasOrcid = this.userProfile.orcid && this.userProfile.orcid !== '0000';
            const hasBsky = !!this.bskyCreds;
            document.getElementById('user-panel-name').innerHTML = `${userName} ${hasOrcid && hasBsky ? '<i class="fa-solid fa-circle-check verified-check" title="Divulgador Verificado"></i>' : ''}`;
            
            const badgesContainer = document.getElementById('community-user-badges');
            if (badgesContainer) badgesContainer.style.display = 'flex';
            document.getElementById('badge-citizen')?.classList.add('active-citizen');
            if (hasBsky) document.getElementById('badge-social')?.classList.add('active-social');
            if (hasOrcid) document.getElementById('badge-academic')?.classList.add('active-academic');
            if (new Date(this.userProfile.created_at) < new Date('2026-12-31')) document.getElementById('badge-founder')?.classList.add('active-founder');
            if (this.userProfile.membership_tier && this.userProfile.membership_tier !== 'free') document.getElementById('badge-member')?.classList.add('active-member');

            try {
                const { count } = await this.supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', this.user.id);
                if (count >= 5) document.getElementById('badge-divulgador')?.classList.add('active-divulgador');
            } catch (e) { }
            
        } else {
            document.getElementById('user-panel-avatar').src = `https://api.dicebear.com/9.x/shapes/svg?seed=invitado_${Math.floor(Math.random() * 10000)}`;
            document.getElementById('user-panel-name').textContent = 'Invitado Explorador';
            const badgesContainer = document.getElementById('community-user-badges');
            if (badgesContainer) badgesContainer.style.display = 'none';
            const actionArea = document.getElementById('user-panel-bsky-status');
            if (actionArea) {
                actionArea.innerHTML = `
                    <p style="font-size: 0.85rem; color: var(--color-secondary-text);">Inicia sesión para poder publicar e interactuar.</p>
                    <button class="btn-primary" style="width: 100%; margin-top: 10px;" onclick="window.location.href='/?auth=open';">Iniciar Sesión</button>`;
            }
            const profileBtn = contentPanel.querySelector('.btn-secondary');
            if(profileBtn) profileBtn.style.display = 'none';
        }

        loadingPanel.style.display = 'none';
        contentPanel.style.display = 'block';
    },

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
            container.innerHTML = feed.map(item => this.createPostHtml(item.post)).join('');
        } catch (error) {
            container.innerHTML = '<p class="bento-box" style="color: var(--color-accent);">Error al cargar el feed.</p>';
        }
    },

    // ==========================================
    // SISTEMA DE FORMULARIOS UNIFICADOS (PREVIEWS SCOPED)
    // ==========================================
    addFormEventListeners(container) {
        const form = container.tagName === 'FORM' ? container : container.querySelector('form');
        if (!form) return;

        // Inyectamos contenedores de preview dinámicamente si no existen (vital para el Modal de Respuesta)
        const wrapper = form.querySelector('.post-input-wrapper') || form.querySelector('.textarea-container');
        if (wrapper && !form.querySelector('.link-preview-editor')) {
            wrapper.insertAdjacentHTML('beforeend', `
                <div class="link-preview-loader" style="display:none; font-size: 0.8rem; margin: 10px 0; color: var(--color-accent);">
                    <i class="fa-solid fa-spinner fa-spin"></i> Generando vista previa...
                </div>
                <div class="link-preview-editor link-preview-card" style="display:none; margin-bottom: 15px; position: relative;"></div>
            `);
        }

        // Enlaza el texto para los links y contadores
        form.querySelector('textarea')?.addEventListener('input', (e) => {
            this.updateCharCounter(e);
            this.detectLinkInText(e.target.value, form); // Le pasamos el form específico
        });

        // Enlaza la subida de imágenes
        const imageUploadBtn = form.querySelector('.image-upload-btn') || form.querySelector('#image-upload-btn');
        const imageUploadInput = form.querySelector('.image-upload-input') || form.querySelector('#image-upload-input');
        const removeImageBtn = form.querySelector('.remove-image-btn');

        if (imageUploadBtn && imageUploadInput) {
            imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
            imageUploadInput.addEventListener('change', (e) => this.handleImageSelection(e, form));
        }
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => this.removeSelectedImage(form));
        }
    },

    detectLinkInText(text, form) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const match = text.match(urlRegex);
        const currentUrl = match ? match[0] : null;

        if (currentUrl && currentUrl !== form.dataset.lastProcessedUrl) {
            form.dataset.lastProcessedUrl = currentUrl;
            this.fetchLinkPreview(currentUrl, form);
        } else if (!currentUrl) {
            form.dataset.lastProcessedUrl = '';
            const editor = form.querySelector('.link-preview-editor');
            if(editor) editor.style.display = 'none';
        }
    },

    async fetchLinkPreview(url, form) {
        const loader = form.querySelector('.link-preview-loader');
        const container = form.querySelector('.link-preview-editor');
        if (loader) loader.style.display = 'block';
        
        try {
            const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
            const json = await res.json();
            const meta = json.data;

            if (meta && container) {
                container.innerHTML = `
                    <button type="button" class="remove-image-btn" onclick="this.parentElement.style.display='none'; this.closest('form').dataset.lastProcessedUrl='';" style="position: absolute; top: 5px; right: 5px; z-index:10; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">&times;</button>
                    ${meta.image ? `<img src="${meta.image.url}" style="width:100%; height:150px; object-fit:cover; border-bottom:1px solid var(--color-border);">` : ''}
                    <div style="padding:12px;">
                        <strong style="display:block; font-size:0.9rem; color:var(--color-primary-text); margin-bottom:4px;">${meta.title || 'Enlace'}</strong>
                        <p style="font-size:0.8rem; color:var(--color-secondary-text); margin:0; line-height:1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${meta.description || ''}</p>
                    </div>
                `;
                container.style.display = 'block';
            }
        } catch (e) {
            console.error("Error preview:", e);
        } finally {
            if (loader) loader.style.display = 'none';
        }
    },

    addEventListeners() {
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

        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button');
            const investigatorItem = target.closest('.featured-investigator-item, .story-item');
            
            if (investigatorItem) {
                e.preventDefault(); e.stopPropagation();
                const username = investigatorItem.dataset.username;
                if (username) this.openProfileModal(username);
            }

            const directoBtn = target.closest('a');
            if (directoBtn && directoBtn.innerHTML.includes('fa-bolt')) {
                e.preventDefault();
                if (this.bskyCreds && (this.userProfile?.role === 'researcher' || this.userProfile?.role === 'admin')) {
                    if (!this.bskyCreds.stream_key) this.openStreamKeyModal(); else this.openGoLiveModal();
                } else alert("Solo los investigadores verificados pueden iniciar transmisiones en vivo.");
                return;
            }

            const tabBtn = target.closest('.community-tab-btn');
            if (tabBtn) {
                document.querySelectorAll('.community-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active'); 
                document.getElementById('feed-tab').classList.remove('is-active-tab');
                document.getElementById('profile-tab').classList.remove('is-active-tab');
                document.getElementById('explore-tab').classList.remove('is-active-tab');
                const activeColumn = document.getElementById(tabBtn.getAttribute('data-target'));
                if (activeColumn) activeColumn.classList.add('is-active-tab');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            const embedImg = target.closest('.post-embed-image img');
            if (embedImg) { e.preventDefault(); this.openImageLightbox(embedImg.src); return; }

            const navLink = target.closest('.community-nav-link');
            if (navLink) {
                if(navLink.getAttribute('href') === '#') e.preventDefault();
                if (navLink.innerHTML.includes('Reglas')) {
                    const rulesModal = document.getElementById('rules-modal-overlay');
                    if (rulesModal) { rulesModal.style.display = 'flex'; setTimeout(() => rulesModal.classList.add('is-visible'), 10); }
                }
                else if (navLink.id === 'notifications-bell-icon') {
                    if (this.bskyCreds) window.open('https://bsky.app/notifications', '_blank');
                    else alert("Únete a Epistecnología para recibir notificaciones.");
                }
                else if (navLink.innerHTML.includes('Guardados')) alert("🚀 Próximamente: Podrás guardar tus artículos.");
            }

            if (target.id === 'rules-close-btn' || target.id === 'rules-accept-btn' || target.id === 'rules-modal-overlay') {
                const rulesModal = document.getElementById('rules-modal-overlay');
                if (rulesModal) { rulesModal.classList.remove('is-visible'); setTimeout(() => rulesModal.style.display = 'none', 300); }
            }

            if (button && (button.id === 'connect-bsky-btn' || button.id === 'connect-bsky-in-creator-btn')) this.openBskyConnectModal();

            const fabToggle = target.closest('#fab-main-toggle');
            const fabContainer = document.getElementById('fab-container');
            if (fabToggle) { fabContainer.classList.toggle('is-open'); return; }
            if (fabContainer && fabContainer.classList.contains('is-open') && !target.closest('.fab-container')) fabContainer.classList.remove('is-open');
            if (button && button.id === 'fab-post') { fabContainer.classList.remove('is-open'); this.openPostModal(); }
            if (button && button.id === 'fab-golive') {
                fabContainer.classList.remove('is-open');
                if (this.bskyCreds && (this.userProfile?.role === 'researcher' || this.userProfile?.role === 'admin')) {
                    if (!this.bskyCreds.stream_key) this.openStreamKeyModal(); else this.openGoLiveModal();
                } else alert("Solo los investigadores verificados pueden transmitir.");
            }

            const channelBtn = target.closest('.channel-btn');
            if (channelBtn) {
                document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
                channelBtn.classList.add('active');
                const type = channelBtn.dataset.type;
                const iframeContainer = document.getElementById('ept-tv-iframe');
                const podcastContainer = document.getElementById('native-podcast-player');
                if (type === 'video') { podcastContainer.style.display = 'none'; iframeContainer.style.display = 'block'; iframeContainer.src = channelBtn.dataset.src; } 
                else if (type === 'podcast') { iframeContainer.style.display = 'none'; iframeContainer.src = ''; podcastContainer.style.display = 'flex'; }
            }
        });

        // FIX UX: Separación de Lector de Hilo vs Responder
        document.getElementById('feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const replyButton = e.target.closest('.reply-btn');
            const shareButton = e.target.closest('.share-btn');
            const deleteButton = e.target.closest('.delete-btn');
            const postBody = e.target.closest('.post-body') || e.target.closest('.post-header');

            if (likeButton) this.handleLike(likeButton);
            else if (replyButton) this.handleReply(replyButton); // Abre el modal de respuesta con la caja de texto
            else if (shareButton) this.handleShare(shareButton);
            else if (deleteButton) this.handleDeletePost(deleteButton);
            else if (postBody && !e.target.closest('a') && !e.target.closest('button')) {
                // Abre el hilo inmersivo si haces clic en el texto o la foto de la persona
                const postElement = postBody.closest('.feed-post');
                this.openThreadReaderModal(postElement.dataset.uri);
            }
        });
    },

    toggleCreatePostBox() {
        const container = document.querySelector('.create-post-box');
        if (!container) return;

        if (this.bskyCreds && (this.userProfile.role === 'researcher' || this.userProfile.role === 'admin')) {
            const avatarUrl = this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=user`;
            container.innerHTML = `
                <form id="create-post-form" class="clean-post-form">
                    <div class="textarea-container">
                        <img id="inline-user-avatar" src="${avatarUrl}" class="post-avatar">
                        <div class="post-input-wrapper">
                            <textarea id="post-text" name="post-text" placeholder="¿Qué hay de nuevo, investigador?" maxlength="300" required></textarea>
                            <div id="image-preview-container" class="image-preview-container" style="display: none;">
                                <button type="button" class="remove-image-btn">&times;</button>
                                <img class="image-preview" src="#" alt="Vista previa de la imagen">
                            </div>
                        </div>
                    </div>
                    <div class="create-post-actions">
                        <div class="action-icons">
                            <input type="file" id="image-upload-input" class="image-upload-input" accept="image/jpeg, image/png" style="display: none;">
                            <button type="button" id="image-upload-btn" class="post-action-icon image-upload-btn" title="Añadir imagen"><i class="fa-regular fa-image"></i></button>
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
            container.innerHTML = `<h4>¡Ya eres parte de la conversación!</h4><p class="form-hint">Tu cuenta está conectada. Ahora puedes interactuar.</p>`;
        } else {
            container.innerHTML = `<h4>Participa en la Conversación</h4><button id="connect-bsky-in-creator-btn" class="btn btn-primary" style="width:100%;"><i class="fa-solid fa-link"></i> Conectar Cuenta de Bluesky</button>`;
        }
    },

    handleImageSelection(event, form) {
        const file = event.target.files[0];
        const previewContainer = form.querySelector('.image-preview-container');
        const previewImage = form.querySelector('.image-preview');

        if (!file) { this.removeSelectedImage(form); return; }
        if (file.size > 1000000) { alert("Máximo 1MB."); event.target.value = ''; return; }

        this.selectedImageFile = file; // Usamos la variable global
        const reader = new FileReader();
        reader.onload = (e) => {
            if(previewImage) previewImage.src = e.target.result;
            if(previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    removeSelectedImage(form) {
        this.selectedImageFile = null;
        const input = form.querySelector('.image-upload-input');
        const previewContainer = form.querySelector('.image-preview-container');
        if (input) input.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
    },

    async handleCreatePost(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const textArea = form.querySelector('textarea');
        const postText = textArea.value.trim();

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = postText.match(urlRegex);
        const postLink = match ? match[0] : null;

        if (!postText && !this.selectedImageFile) return alert("El post debe contener texto o una imagen.");

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const previewContainer = form.querySelector('.link-preview-editor');
        const hasPreview = previewContainer && previewContainer.style.display !== 'none';

        let body = { 
            action: 'create_post',
            text: postText,
            postLink: postLink,
            linkTitle: hasPreview && previewContainer.querySelector('strong') ? previewContainer.querySelector('strong').textContent : null,
            linkDescription: hasPreview && previewContainer.querySelector('p') ? previewContainer.querySelector('p').textContent : null,
            linkThumb: hasPreview && previewContainer.querySelector('img') ? previewContainer.querySelector('img').src : null
        };

        if (this.selectedImageFile) {
            try {
                const fullBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(this.selectedImageFile);
                });
                body.imageUrl = fullBase64;
            } catch (error) { alert("No se pudo procesar la imagen."); submitButton.disabled = false; submitButton.textContent = 'Publicar'; return; }
        }

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-lexicon-api', { body: body });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            this.prependNewPost(postText, this.selectedImageFile, data.uri, data.cid);
            textArea.value = '';
            this.removeSelectedImage(form);
            this.updateCharCounter({ target: textArea });
            this.closePostModal();
        } catch (error) {
            alert(`No se pudo publicar. Revisa tu conexión. Detalle: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Publicar';
        }
    },

    prependNewPost(postText, imageFile = null, uri = "", cid = "") {
        const container = document.getElementById('feed-container');
        if (!container) return;

        const author = {
            avatar: this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=user`,
            displayName: this.userProfile.display_name,
            handle: this.bskyCreds.handle
        };

        let embed = undefined;
        if (imageFile) {
            const localImageUrl = URL.createObjectURL(imageFile);
            embed = { $type: 'app.bsky.embed.images', images: [{ thumb: localImageUrl, alt: 'Imagen' }] };
        }
        
        const fakePost = { uri: uri, cid: cid, author: author, record: { text: postText }, embed: embed, indexedAt: new Date().toISOString(), replyCount: 0, repostCount: 0, likeCount: 0, viewer: {} };
        const postHtml = this.createPostHtml(fakePost);
        container.insertAdjacentHTML('afterbegin', postHtml);
    },

    async handleLike(button) {
        if (!this.bskyCreds) return alert("Necesitas conectar tu cuenta.");
        if (button.disabled) return;

        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri;
        const postCid = postElement.dataset.cid;
        let likeUri = button.dataset.likeUri;
        
        if (!postUri || postUri === "undefined") return alert("Error de ID.");

        const isLiked = button.classList.contains('is-liked');
        const countSpan = button.querySelector('span');
        const icon = button.querySelector('i');
        const originalCount = parseInt(countSpan.textContent) || 0;

        button.disabled = true;
        button.classList.toggle('is-liked');
        
        if (!isLiked) { icon.className = 'fa-solid fa-heart'; countSpan.textContent = originalCount + 1; } 
        else { icon.className = 'fa-regular fa-heart'; countSpan.textContent = Math.max(0, originalCount - 1); }

        try {
            const actionName = isLiked ? 'unlike_post' : 'like_post';
            const { data, error } = await this.supabase.functions.invoke('bsky-lexicon-api', {
                body: { action: actionName, postUri: postUri, postCid: postCid, likeUri: likeUri }
            });
            if (error) throw error;
            if (!isLiked && data.uri) button.dataset.likeUri = data.uri;
            else if (isLiked) button.dataset.likeUri = '';
        } catch (error) {
            button.classList.toggle('is-liked');
            icon.className = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            countSpan.textContent = originalCount;
        } finally { button.disabled = false; }
    },

    async handleDeletePost(button) {
        if (!confirm("¿Seguro que deseas eliminar esta publicación?")) return;
        const postElement = button.closest('.feed-post');
        postElement.style.opacity = '0.5';
        button.disabled = true;

        try {
            const { error } = await this.supabase.functions.invoke('bsky-lexicon-api', {
                body: { action: 'delete_post', postUri: postElement.dataset.uri }
            });
            if (error) throw error;
            postElement.remove();
        } catch (error) {
            postElement.style.opacity = '1';
            button.disabled = false;
        }
    },
    
    // FIX UX: Abre la caja de texto para escribir la respuesta
    async handleReply(button) {
        const postElement = button.closest('.feed-post');
        const postData = {
            uri: postElement.dataset.uri,
            cid: postElement.dataset.cid,
            author: {
                avatar: postElement.querySelector('.post-avatar').src,
                displayName: postElement.querySelector('.post-author-info strong').textContent
            },
            text: postElement.querySelector('.post-body p').innerHTML
        };
        this.openReplyModal(postData);
    },

    openReplyModal(postData) {
        const template = document.getElementById('reply-modal-template');
        if (!template) return;

        const modalContainer = document.getElementById('modal-container');
        const modalNode = template.content.cloneNode(true);

        modalNode.querySelector('#parent-post-avatar').src = postData.author.avatar;
        modalNode.querySelector('#parent-post-author').textContent = postData.author.displayName;
        modalNode.querySelector('#parent-post-text').innerHTML = postData.text;
        modalNode.querySelector('#reply-user-avatar').src = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=user`;
        
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        const form = modalNode.querySelector('#reply-form');
        
        // FIX HTML DEL MODAL DE RESPUESTA: Asegurar que el textarea se vea bien y acepte preview
        const textarea = form.querySelector('textarea');
        if (!textarea.parentElement.classList.contains('post-input-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'post-input-wrapper';
            textarea.parentNode.insertBefore(wrapper, textarea);
            wrapper.appendChild(textarea);
            textarea.style.width = '100%';
            textarea.style.minHeight = '80px';
            textarea.style.border = 'none';
            textarea.style.background = 'transparent';
            textarea.style.fontFamily = 'inherit';
            textarea.style.color = 'var(--color-primary-text)';
            textarea.style.outline = 'none';
            textarea.style.resize = 'none';
            
            // Añadimos el botón oculto para imagen por si en el futuro quieren responder con imagen
            wrapper.insertAdjacentHTML('beforeend', `
                <div class="image-preview-container" style="display: none; margin-top: 10px; position: relative;">
                    <button type="button" class="remove-image-btn" style="position: absolute; top:5px; right:5px;">&times;</button>
                    <img class="image-preview" src="#" style="width:100%; border-radius:12px;">
                </div>
            `);
        }

        // Activamos la detección de Link Preview en este nuevo modal
        this.addFormEventListeners(form);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply(textarea.value, postData, form);
        });
        
        modalContainer.innerHTML = '';
        modalContainer.appendChild(modalNode);
    },

    async submitReply(replyText, parentPostData, form) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!replyText.trim() && !this.selectedImageFile) return;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        // Escaneamos si el comentario generó una vista previa
        const previewContainer = form.querySelector('.link-preview-editor');
        const hasPreview = previewContainer && previewContainer.style.display !== 'none';
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = replyText.match(urlRegex);

        let body = {
            action: 'create_reply',
            text: replyText,
            replyTo: {
                rootUri: parentPostData.uri,
                rootCid: parentPostData.cid,
                parentUri: parentPostData.uri,
                parentCid: parentPostData.cid
            },
            postLink: match ? match[0] : null,
            linkTitle: hasPreview && previewContainer.querySelector('strong') ? previewContainer.querySelector('strong').textContent : null,
            linkDescription: hasPreview && previewContainer.querySelector('p') ? previewContainer.querySelector('p').textContent : null,
            linkThumb: hasPreview && previewContainer.querySelector('img') ? previewContainer.querySelector('img').src : null
        };

        if (this.selectedImageFile) {
            const fullBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(this.selectedImageFile);
            });
            body.imageUrl = fullBase64;
        }

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-lexicon-api', { body: body });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
            
            // Actualizamos la pantalla principal
            const originalPostElement = document.querySelector(`.feed-post[data-uri="${parentPostData.uri}"]`);
            if (originalPostElement) {
                const countSpan = originalPostElement.querySelector('.reply-btn span');
                countSpan.textContent = parseInt(countSpan.textContent || 0) + 1;
            }

            this.removeSelectedImage(form);
            this.closePostModal();
            if (window.showToast) window.showToast("¡Respuesta publicada!");
            
        } catch (error) {
            alert(`Error al publicar el comentario: ${error.message}`);
            submitButton.disabled = false;
            submitButton.innerHTML = 'Responder';
        }
    },

    async openThreadReaderModal(postUri) {
        const template = document.getElementById('thread-reader-template');
        if (!template) return;

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = ''; 
        const modalNode = template.content.cloneNode(true);
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        modalContainer.appendChild(modalNode);

        const loader = document.getElementById('thread-loader');
        const contentBox = document.getElementById('thread-content');
        const anchorContainer = document.getElementById('thread-anchor-post');
        const repliesContainer = document.getElementById('thread-replies');

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-lexicon-api', { body: { action: 'get_post_thread', uri: postUri } });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            const threadData = data.thread;
            if (!threadData) throw new Error("Hilo no encontrado");

            if (threadData.post) {
                const anchorHtml = this.createPostHtml(threadData.post).replace('bento-box', '').replace('border: 1px solid transparent;', 'border: none;');
                anchorContainer.innerHTML = anchorHtml;
            }

            if (threadData.replies && threadData.replies.length > 0) {
                const repliesHtml = threadData.replies.map(replyObj => {
                    const msg = replyObj.post;
                    if (!msg) return '';
                    return this.createPostHtml(msg).replace('bento-box', '').replace('padding: 1.5rem;', 'padding: 1rem 1.5rem; background: var(--color-surface); border: none; border-bottom: 1px solid var(--color-background);');
                }).join('');
                repliesContainer.innerHTML = repliesHtml;
            } else {
                repliesContainer.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--color-secondary-text);">Aún no hay respuestas. ¡Sé el primero en comentar!</p>`;
            }

            loader.style.display = 'none';
            contentBox.style.display = 'block';
        } catch (err) {
            loader.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-accent); font-size: 2rem;"></i><p>No se pudo cargar la conversación.</p>`;
        }
    },

    openPostModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer && modalContainer.innerHTML.trim() !== '') return; 

        const template = document.getElementById('post-form-template');
        if (!template) return;
        
        const modalNode = template.content.cloneNode(true);
        const modalOverlay = modalNode.querySelector('.modal-overlay');
        
        modalNode.querySelector('#modal-user-avatar').src = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=user`;
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());

        modalContainer.appendChild(modalNode);
        
        // Activamos los escáneres de Links para este modal específico
        const form = modalContainer.querySelector('form');
        this.addFormEventListeners(form);

        requestAnimationFrame(() => modalOverlay.classList.add('is-visible'));
    },

    closePostModal() {
        const modalOverlay = document.querySelector('.modal-overlay.is-visible');
        if (modalOverlay) {
            modalOverlay.classList.remove('is-visible');
            modalOverlay.addEventListener('transitionend', () => {
                const modalContainer = document.getElementById('modal-container');
                if (modalContainer) modalContainer.innerHTML = '';
            }, { once: true });
        }
    },

    updateCharCounter(e) {
        const remaining = 300 - e.target.value.length;
        const form = e.target.closest('form');
        if(form) form.querySelector('.char-counter').textContent = remaining;
    },

    renderBskyStatus() {
        const container = document.getElementById('user-panel-bsky-status');
        if (!container) return;
        if (this.bskyCreds) {
            container.innerHTML = `<div class="status-badge connected"><i class="fa-solid fa-circle-check"></i><span>Conectado como <strong>@${this.bskyCreds.handle}</strong></span></div>`;
        } else {
            container.innerHTML = `<p class="form-hint">Conecta tu cuenta para poder publicar.</p><button id="connect-bsky-btn" class="btn btn-primary" style="width:100%;"><i class="fa-solid fa-link"></i> Conectar Cuenta</button>`;
        }
    },

    openBskyConnectModal() {
        const template = document.getElementById('bsky-connect-template');
        if (!template) return;

        let modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) { modalContainer.id = 'modal-container'; document.body.appendChild(modalContainer); }

        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));
        const overlay = modalContainer.querySelector('.modal-overlay');

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeBskyConnectModal());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeBskyConnectModal(); });
        
        const oauthBtn = modalContainer.querySelector('#bsky-oauth-start-btn');
        if (oauthBtn) oauthBtn.addEventListener('click', () => this.handleBlueskyOAuthStart());
    },

    closeBskyConnectModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        const overlay = modalContainer.querySelector('.modal-overlay');
        if (overlay) {
            overlay.classList.remove('is-visible');
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        }
    },

    async handleBlueskyConnect(e) {
        e.preventDefault();
        const form = e.target;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

        const handle = form.querySelector('#bsky-handle').value;
        const appPassword = form.querySelector('#bsky-app-password').value;

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-auth', { body: { handle, appPassword } });
            if (error) throw error; alert(data.message); location.reload();
        } catch (error) { alert(`Error: ${error.message}`); button.disabled = false; button.innerHTML = 'Conectar'; }
    },

    // --- CARGAS LATERALES ---
    currentStoriesData: [],
    async renderLatestPublications() {
        const list = document.getElementById('feed-publications-stories');
        if (!list) return;
        try {
            const { data, error } = await this.supabase.from('knowledge_base').select('title, url, image_url, description, author_name, published_at').order('published_at', { ascending: false }).limit(8);
            if (error) throw error;
            if (data && data.length > 0) {
                this.currentStoriesData = data;
                list.style.display = 'flex'; list.style.gap = '12px'; list.style.overflowX = 'auto'; list.style.paddingBottom = '10px'; list.style.scrollbarWidth = 'none';
                list.innerHTML = data.map((pub, index) => {
                    const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
                    return `
                        <li onclick="ComunidadApp.openPublicationModal(${index})" style="min-width: 120px; width: 120px; height: 170px; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; flex-shrink: 0; border: 1px solid var(--color-border); box-shadow: var(--shadow-soft); transition: transform 0.2s;">
                            <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1;">
                            <div style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 30px 10px 10px 10px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.4), transparent); z-index: 2;">
                                <span style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: white; font-size: 0.75rem; font-weight: 700; line-height: 1.3;">${pub.title}</span>
                            </div>
                        </li>
                    `;
                }).join('');
            } else list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">No hay artículos recientes.</p>';
        } catch (e) { list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">Error al cargar.</p>'; }
    },

    async renderSidebarEvents() {
        const list = document.getElementById('sidebar-event-list');
        if (!list) return;
        try {
            const { data, error } = await this.supabase.from('sessions').select('id, session_title, scheduled_at, status').eq('is_archived', false).order('scheduled_at', { ascending: false }).limit(10); 
            if (error) throw error;
            if (data && data.length > 0) {
                const now = new Date();
                const upcoming = data.filter(s => new Date(s.scheduled_at) > now).reverse().slice(0, 2);
                const past = data.filter(s => new Date(s.scheduled_at) <= now).slice(0, 2);
                let html = '';
                upcoming.forEach(s => { html += `<li class="upcoming-event" style="margin-bottom: 0.8rem; border-left: 3px solid var(--color-accent); padding-left: 10px;"><a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);"><strong style="color: var(--color-accent); font-size: 0.75rem; display: block; text-transform: uppercase;">Próximamente</strong><span style="font-size: 0.85rem; font-weight: 600;">${s.session_title}</span></a></li>`; });
                past.forEach(s => { html += `<li class="past-event" style="opacity: 0.7; margin-bottom: 0.8rem; padding-left: 10px;"><a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);"><strong style="color: var(--color-secondary-text); font-size: 0.75rem; display: block; text-transform: uppercase;">Grabación</strong><span style="font-size: 0.85rem;">${s.session_title}</span></a></li>`; });
                list.innerHTML = html || '<li><span class="trend-topic">No hay eventos por mostrar.</span></li>';
            } else list.innerHTML = '<li><span class="trend-topic">No hay eventos registrados.</span></li>';
        } catch (error) { list.innerHTML = '<li><span class="trend-topic">Error al cargar la agenda.</span></li>'; }
    },

    async renderFeaturedMembers() {
        const container = document.getElementById('featured-members-list');
        if (!container) return;
        try {
            const { data: liveBroadcasts } = await this.supabase.from('active_broadcasts').select('*, profiles(display_name, avatar_url, username)').eq('status', 'live');
            const { data: members } = await this.supabase.from('profiles').select('id, display_name, avatar_url, username, projects!inner(id), updated_at');

            members.sort((a, b) => {
                const countA = a.projects ? a.projects.length : 0; const countB = b.projects ? b.projects.length : 0;
                if (countB !== countA) return countB - countA; 
                return new Date(b.updated_at) - new Date(a.updated_at);
            });
            const topMembers = members.slice(0, 10);
            let html = ''; const paintedLiveUsers = new Set(); 
            
            if (liveBroadcasts) {
                liveBroadcasts.forEach(broadcast => {
                    if (!paintedLiveUsers.has(broadcast.user_id)) {
                        paintedLiveUsers.add(broadcast.user_id);
                        const profile = broadcast.profiles;
                        html += `<div class="story-item is-live" onclick="ComunidadApp.openLiveViewer('${broadcast.playback_url}', '${profile.username || profile.display_name}', '${broadcast.id}', '${broadcast.streamplace_id}')"><div class="story-avatar-container" style="background: linear-gradient(45deg, #ef4444, #b72a1e); animation: pulse-border 2s infinite;"><img src="${profile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${broadcast.user_id}`}" alt="Avatar" class="story-avatar"></div><span class="story-username" style="color: #ef4444; font-weight: bold;">🔴 EN VIVO</span></div>`;
                    }
                });
            }
            const paintedNormalUsers = new Set();
            topMembers.forEach(member => {
                if (!paintedLiveUsers.has(member.id) && !paintedNormalUsers.has(member.id)) {
                    paintedNormalUsers.add(member.id);
                    const userParam = member.username ? `'${member.username}'` : `'${member.id}'`;
                    html += `<div class="story-item" onclick="ComunidadApp.openProfileModal(${userParam})"><div class="story-avatar-container"><img src="${member.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="story-avatar"></div><span class="story-username">${member.display_name || member.username}</span></div>`;
                }
            });
            container.innerHTML = html;
        } catch (error) { }
    },

    // --- REPRODUCTORES Y MODALES NATIVOS ---
    createPostHtml(post) {
        if (!post || !post.author || !post.record) return '';

        const postText = (post.record.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
        const author = post.author;
        const isLiked = !!post.viewer?.like;
        const postDate = new Date(post.indexedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        let embedHtml = '';
        const embed = post.embed;
        
        if (embed) {
            const imagesData = embed.images || (embed.media && embed.media.images);
            const externalData = embed.external || (embed.media && embed.media.external);
            
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
            else if (imagesData && imagesData.length > 0) {
                embedHtml = `
                    <div class="post-embed-image" style="margin-top: 12px;">
                        <img src="${imagesData[0].thumb}" alt="${imagesData[0].alt || 'Imagen adjunta'}" loading="lazy" onclick="ComunidadApp.openImageLightbox(this.src)" style="width: 100%; border-radius: 12px; border: 1px solid var(--color-border); cursor: zoom-in;">
                    </div>`;
            } 
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

        const isMyPost = this.bskyCreds && author.handle === this.bskyCreds.handle;
        const deleteBtnHtml = isMyPost ? `<button class="post-action-btn delete-btn" title="Eliminar" style="margin-left: auto;"><i class="fa-solid fa-trash-can"></i></button>` : '';

        return `
            <div class="bento-box feed-post" data-uri="${post.uri}" data-cid="${post.cid}">
                <div class="post-header">
                    <img src="${author.avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${author.handle}`}" alt="Avatar" class="post-avatar">
                    <div class="post-author-info">
                        <strong>${author.displayName || author.handle}</strong>
                        <span class="post-handle">@${author.handle}</span>
                    </div>
                    ${deleteBtnHtml}
                </div>
                <div class="post-body" style="cursor: pointer;">
                    <p>${postText}</p>
                    ${embedHtml}
                </div>
                <div class="post-footer">
                    <span class="post-date">${postDate}</span>
                    <div class="post-actions">
                        <button class="post-action-btn share-btn" title="Compartir"><i class="fa-solid fa-share-nodes"></i></button>
                        <button class="post-action-btn reply-btn" title="Comentar"><i class="fa-regular fa-comment"></i><span>${post.replyCount || 0}</span></button>
                        <button class="post-action-btn like-btn ${isLiked ? 'is-liked' : ''}" data-like-uri="${post.viewer?.like || ''}"><i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i><span>${post.likeCount || 0}</span></button>
                    </div>
                </div>
            </div>
        `;
    },

    async handleShare(button) {
        const originalHtml = button.innerHTML;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        button.disabled = true;

        try {
            const postElement = button.closest('.feed-post');
            const postUri = postElement.dataset.uri;
            const handle = postElement.querySelector('.post-handle').textContent.substring(1); 
            const postTextElement = postElement.querySelector('.post-body p');
            const postText = postTextElement ? postTextElement.textContent.substring(0, 60) + '...' : 'Mira esta publicación';

            const encodedUri = encodeURIComponent(postUri);
            const longUrl = `https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/share-post?uri=${encodedUri}`; 

            const shareTitle = `Aporte de @${handle} en Epistecnología`;
            const shareText = `Mira este debate en nuestra comunidad:\n"${postText}"`;

            this.showCustomShareModal(longUrl, shareTitle, shareText);
        } finally {
            button.innerHTML = originalHtml;
            button.disabled = false;
        }
    },

    showCustomShareModal(longUrl, title, text) {
        const existingModal = document.getElementById('custom-share-modal');
        if (existingModal) existingModal.remove();

        const encodedText = encodeURIComponent(text);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const nativeShareBtnHtml = (isMobile && navigator.share) ? `
            <button id="btn-native-share" style="width: 100%; padding: 12px; margin-bottom: 15px; background: var(--color-primary-text); color: var(--color-surface); border: none; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.2s;">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Más opciones (Nativo)
            </button>
        ` : '';

        const modalHtml = `
            <div id="custom-share-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s ease;">
                <div style="background: var(--color-surface); padding: 25px; border-radius: 20px; width: 90%; max-width: 380px; box-shadow: 0 15px 35px rgba(0,0,0,0.2); transform: translateY(20px); transition: transform 0.3s ease; border: 1px solid var(--color-border);">
                    <h3 style="margin-top: 0; margin-bottom: 20px; color: var(--color-primary-text); font-size: 1.2rem; text-align: center;">Compartir publicación</h3>
                    ${nativeShareBtnHtml}
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <a id="share-wa" href="https://api.whatsapp.com/send?text=${encodedText}%0A${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--color-primary-text); padding: 15px; border-radius: 15px; background: rgba(37, 211, 102, 0.1); transition: transform 0.2s;">
                            <i class="fa-brands fa-whatsapp" style="font-size: 2rem; color: #25D366;"></i><span style="font-size: 0.85rem; font-weight: 600;">WhatsApp</span></a>
                        <a id="share-tw" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--color-primary-text); padding: 15px; border-radius: 15px; background: rgba(0, 0, 0, 0.05); transition: transform 0.2s;">
                            <i class="fa-brands fa-x-twitter" style="font-size: 2rem; color: var(--color-primary-text);"></i><span style="font-size: 0.85rem; font-weight: 600;">X (Twitter)</span></a>
                        <a id="share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--color-primary-text); padding: 15px; border-radius: 15px; background: rgba(24, 119, 242, 0.1); transition: transform 0.2s;">
                            <i class="fa-brands fa-facebook" style="font-size: 2rem; color: #1877F2;"></i><span style="font-size: 0.85rem; font-weight: 600;">Facebook</span></a>
                        <a id="share-in" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: var(--color-primary-text); padding: 15px; border-radius: 15px; background: rgba(10, 102, 194, 0.1); transition: transform 0.2s;">
                            <i class="fa-brands fa-linkedin" style="font-size: 2rem; color: #0a66c2;"></i><span style="font-size: 0.85rem; font-weight: 600;">LinkedIn</span></a>
                    </div>
                    <button id="btn-copy-share" style="width: 100%; padding: 12px; background: var(--color-accent); color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Acortando enlace...
                    </button>
                    <button id="btn-close-share" style="width: 100%; padding: 10px; margin-top: 10px; background: transparent; color: var(--color-secondary-text); border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">Cancelar</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('custom-share-modal');
        let finalUrl = longUrl; 

        setTimeout(() => { modal.style.opacity = '1'; modal.children[0].style.transform = 'translateY(0)'; }, 10);

        const callbackName = 'isgd_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            if (data.shorturl) {
                finalUrl = data.shorturl;
                document.getElementById('share-wa').href = `https://api.whatsapp.com/send?text=${encodedText}%0A${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-tw').href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-in').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(finalUrl)}`;
            }
            document.getElementById('btn-copy-share').innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Enlace Corto';
        };

        const script = document.createElement('script');
        script.src = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}&callback=${callbackName}`;
        script.onerror = function() { delete window[callbackName]; document.getElementById('btn-copy-share').innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Enlace'; };
        document.body.appendChild(script);

        document.getElementById('btn-copy-share').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(finalUrl); const copyBtn = document.getElementById('btn-copy-share'); copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!'; copyBtn.style.background = '#25D366'; setTimeout(() => closeModal(), 1500); } catch (e) { }
        });

        const nativeBtn = document.getElementById('btn-native-share');
        if (nativeBtn) {
            nativeBtn.addEventListener('click', async () => {
                try { await navigator.share({ title: title, text: text, url: finalUrl }); closeModal(); } catch (err) { }
            });
        }

        const closeModal = () => { modal.style.opacity = '0'; modal.children[0].style.transform = 'translateY(20px)'; setTimeout(() => modal.remove(), 300); };
        document.getElementById('btn-close-share').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    },

    openPublicationModal(index) {
        const pub = this.currentStoriesData[index];
        if (!pub) return;
        
        let modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) { modalContainer.id = 'modal-container'; document.body.appendChild(modalContainer); }
        
        const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
        const dateStr = new Date(pub.published_at).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
        const author = pub.author_name || 'Redacción EPT';
        
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
                            <span><i class="fa-solid fa-pen-nib"></i> ${author}</span><span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                        <p style="color: var(--color-primary-text); font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px; opacity: 0.9;">${desc}</p>
                        <a href="${pub.url}" target="_blank" class="btn-primary" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; font-size: 1rem; width: 100%; box-shadow: 0 4px 15px rgba(183, 42, 30, 0.4);">Leer artículo completo <i class="fa-solid fa-arrow-right"></i></a>
                    </div>
                </div>
            </div>
        `;
        
        const overlay = document.getElementById('pub-iframe-overlay');
        const modalBox = overlay.querySelector('.modal');
        document.body.style.overflow = 'hidden'; 
        
        setTimeout(() => { overlay.classList.add('is-visible'); modalBox.style.transform = 'scale(1)'; }, 10);
        
        const closeFn = () => { overlay.classList.remove('is-visible'); modalBox.style.transform = 'scale(0.95)'; document.body.style.overflow = ''; setTimeout(() => { modalContainer.innerHTML = ''; }, 300); };
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeFn(); });
    },

    openImageLightbox(src) {
        const overlay = document.getElementById('image-lightbox-overlay');
        const img = document.getElementById('lightbox-full-image');
        if (overlay && img) {
            img.src = src;
            overlay.style.display = 'flex';
            setTimeout(() => overlay.classList.add('is-visible'), 10);
            overlay.onclick = (e) => { 
                if (e.target === overlay || e.target.id === 'lightbox-close-btn') {
                    overlay.classList.remove('is-visible'); 
                    setTimeout(() => { overlay.style.display = 'none'; img.src = ''; }, 300);
                }
            };
        }
    },

    liveChatChannel: null,
    currentBroadcastId: null,
    chatFadeTimer: null,

    openLiveViewer(playbackUrl, handle, broadcastId, streamplaceId) {
        this.currentBroadcastId = broadcastId;
        let modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) { modalContainer.id = 'modal-container'; document.body.appendChild(modalContainer); }

        const embedUrl = `https://stream.place/embed/${streamplaceId}`;
        
        const chatInputHtml = this.user 
            ? `<div style="display: flex; gap: 8px; align-items: center;">
                 <button id="btn-react-viewer" class="btn-reaction" title="Reaccionar">❤️</button>
                 <div class="chat-input-wrapper" style="flex-grow: 1;">
                     <input type="text" id="golive-chat-input" placeholder="Escribe..." autocomplete="off">
                     <button id="btn-send-golive-chat"><i class="fa-solid fa-paper-plane"></i></button>
                 </div>
               </div>`
            : `<div class="chat-login-prompt"><p>Inicia sesión para participar en el chat</p><a href="/?auth=open" class="btn-primary-sm" style="font-size: 0.8rem; padding: 6px 12px; display: inline-block; text-decoration: none;">Entrar</a></div>`;

        modalContainer.innerHTML = `
            <div class="live-agora-fullscreen" id="live-viewer-overlay">
                <button class="modal-close-btn" id="close-viewer-btn" style="position: absolute; right: 15px; top: 15px; color: white; background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; width: 40px; height: 40px; border-radius: 50%; z-index: 20; cursor: pointer;">&times;</button>
                <div class="video-background-layer">
                    <iframe src="${embedUrl}" allow="autoplay; fullscreen" allowfullscreen></iframe>
                    <div class="video-overlay-info">
                        <span class="badge-live"><span class="dot"></span> EN VIVO</span>
                        <span style="background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; margin-left: 8px; backdrop-filter: blur(4px);">
                            <i class="fa-regular fa-eye"></i> <span id="golive-viewer-count">0</span>
                        </span>
                        <span class="user-handle" style="margin-left: 8px;">@${handle}</span>
                    </div>
                </div>
                <div class="chat-overlay-layer">
                    <div id="golive-chat-messages" class="chat-scroll-area"></div>
                    <div class="chat-controls-area">${chatInputHtml}</div>
                </div>
            </div>
        `;
        document.getElementById('close-viewer-btn').onclick = () => this.closeLiveViewer();
        if (this.user) this.setupRobustChatInput('golive-chat-input', 'btn-send-golive-chat');
        this.initUnifiedChat(broadcastId, 'golive-chat-messages');
    },

    closeLiveViewer() {
        if (this.liveChatChannel) { this.supabase.removeChannel(this.liveChatChannel); this.liveChatChannel = null; }
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    },

    async initUnifiedChat(broadcastId, containerId) {
        const msgContainer = document.getElementById(containerId);
        if (!msgContainer) return;
        msgContainer.innerHTML = '';

        try {
            const { data, error } = await this.supabase.from('golive_chat').select('*').eq('broadcast_id', broadcastId).order('created_at', { ascending: true }).limit(50);
            if (!error && data.length > 0) data.forEach(msg => this.renderUnifiedChatMessage(msg, containerId));
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (e) { }

        if (this.liveChatChannel) this.supabase.removeChannel(this.liveChatChannel);
        const presenceKey = this.user ? this.user.id : 'guest_' + Math.floor(Math.random() * 1000000);

        this.liveChatChannel = this.supabase.channel(`chat_${broadcastId}`, { config: { presence: { key: presenceKey } } })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'golive_chat', filter: `broadcast_id=eq.${broadcastId}` }, payload => { this.renderUnifiedChatMessage(payload.new, containerId); })
            .on('broadcast', { event: 'reaction' }, payload => { this.animateReaction(payload.payload.emoji, containerId); })
            .on('presence', { event: 'sync' }, () => {
                const newState = this.liveChatChannel.presenceState();
                let viewerCount = 0;
                for (let key in newState) viewerCount += newState[key].length;
                const viewerEl = document.getElementById('golive-viewer-count');
                const studioEl = document.getElementById('studio-viewer-count');
                if (viewerEl) viewerEl.innerText = viewerCount;
                if (studioEl) studioEl.innerText = viewerCount;
            }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await this.liveChatChannel.track({ online_at: new Date().toISOString() }); });
            
        const btnReactViewer = document.getElementById('btn-react-viewer');
        const btnReactStudio = document.getElementById('btn-react-studio');
        if (btnReactViewer) btnReactViewer.onclick = () => this.sendReaction('❤️');
        if (btnReactStudio) btnReactStudio.onclick = () => this.sendReaction('❤️');
    },

    async sendReaction(emoji) {
        if (!this.liveChatChannel) return;
        this.liveChatChannel.send({ type: 'broadcast', event: 'reaction', payload: { emoji: emoji } });
        const containerId = document.getElementById('golive-fullscreen-studio') && !document.getElementById('golive-fullscreen-studio').classList.contains('hidden') ? 'studio-chat-messages' : 'golive-chat-messages';
        this.animateReaction(emoji, containerId);
    },

    animateReaction(emoji, containerId) {
        const targetLayer = containerId === 'studio-chat-messages' ? document.getElementById('studio-chat-overlay') : document.querySelector('.chat-overlay-layer');
        if (!targetLayer) return;
        const reactionEl = document.createElement('div');
        reactionEl.classList.add('floating-reaction');
        reactionEl.innerText = emoji;
        reactionEl.style.transform = `translateX(${Math.floor(Math.random() * 40) - 20}px)`;
        targetLayer.appendChild(reactionEl);
        setTimeout(() => { reactionEl.remove(); }, 2000);
    },

    renderUnifiedChatMessage(msg, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const isMe = this.user && msg.user_id === this.user.id;
        const avatar = msg.user_avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${msg.user_id}`;
        let displayName = msg.user_name; let nameColor = '#ffffff';
        if (isMe) { displayName = 'Tú'; nameColor = '#38bdf8'; }

        const msgHtml = `<div class="golive-chat-msg-row"><img src="${avatar}"><div><span class="golive-chat-msg-name" style="color: ${nameColor};">${displayName}</span><p class="golive-chat-msg-text">${msg.message}</p></div></div>`;
        container.insertAdjacentHTML('beforeend', msgHtml);
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

        if (containerId === 'studio-chat-messages') this.wakeUpChatOverlay();
    },

    async sendLiveChatMessage(messageText) {
        if (!this.user || !this.currentBroadcastId) return;
        const userName = this.userProfile?.display_name || this.userProfile?.username || 'Investigador';
        const userAvatar = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${this.user.id}`;
        try {
            const { error } = await this.supabase.from('golive_chat').insert([{ broadcast_id: this.currentBroadcastId, user_id: this.user.id, user_name: userName, user_avatar: userAvatar, message: messageText }]);
            if (error) throw error;
        } catch (e) {}
    },

    setupRobustChatInput(inputId, btnId) {
        let input = document.getElementById(inputId); let btn = document.getElementById(btnId);
        if (!input || !btn) return;
        const newInput = input.cloneNode(true); const newBtn = btn.cloneNode(true);
        input.parentNode.replaceChild(newInput, input); btn.parentNode.replaceChild(newBtn, btn);
        const triggerSend = () => { const val = newInput.value.trim(); if (val !== '') { newInput.value = ''; this.sendLiveChatMessage(val); newInput.focus(); } };
        newBtn.addEventListener('click', (e) => { e.preventDefault(); triggerSend(); });
        newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); triggerSend(); } });
    },

    setupBroadcasterFadeOut() {
        const studioArea = document.getElementById('golive-fullscreen-studio');
        if (!studioArea) return;
        const wakeUpEvents = ['pointerdown', 'pointermove', 'keydown'];
        if (this._wakeUpHandler) wakeUpEvents.forEach(evt => studioArea.removeEventListener(evt, this._wakeUpHandler));
        this._wakeUpHandler = () => this.wakeUpChatOverlay();
        wakeUpEvents.forEach(evt => { studioArea.addEventListener(evt, this._wakeUpHandler, { passive: true }); });
        this.wakeUpChatOverlay(); 
    },

    wakeUpChatOverlay() {
        const overlay = document.getElementById('studio-chat-overlay');
        const controls = document.querySelector('.studio-controls-ui');
        if (!overlay) return;
        overlay.style.opacity = '1';
        if (controls) controls.style.opacity = '1';
        if (this.chatFadeTimer) clearTimeout(this.chatFadeTimer);
        this.chatFadeTimer = setTimeout(() => {
            const input = document.getElementById('studio-chat-input');
            if (document.activeElement === input) return;
            overlay.style.opacity = '0.2'; 
            if (controls) controls.style.opacity = '0.4'; 
        }, 5000);
    },

    async handleBlueskyOAuthStart() {
        const oauthBtn = document.getElementById('bsky-oauth-start-btn');
        if (oauthBtn) { oauthBtn.disabled = true; oauthBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...'; }
        try {
            const redirectUri = window.location.origin + window.location.pathname;
            const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', { body: { redirect_uri: redirectUri } });
            if (error) throw error;
            if (data?.auth_url) window.location.href = data.auth_url;
        } catch (error) {
            alert("❌ No pudimos conectar con Bluesky. Asegúrate de que el oauth-client-metadata.json esté actualizado.");
            if (oauthBtn) { oauthBtn.disabled = false; oauthBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Autorizar con Bluesky'; }
        }
    },

    async checkForBlueskyCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code'); const state = urlParams.get('state');
        if (code && state) {
            window.history.replaceState({}, document.title, window.location.pathname);
            if (window.showToast) window.showToast("⏳ Finalizando conexión con Bluesky...");
            try {
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-callback', { body: { code: code, state: state, redirect_uri: window.location.origin + window.location.pathname } });
                if (error) throw error;
                alert(`✅ ¡Cuenta de Bluesky conectada! Bienvenido, @${data.handle}`);
                location.reload(); 
            } catch (error) { alert("❌ Hubo un problema al guardar tu cuenta de Bluesky. Intenta de nuevo."); }
        }
    },

    openStreamKeyModal() {
        const template = document.getElementById('streamkey-connect-template');
        if (!template) return;
        const modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) { modalContainer.id = 'modal-container'; document.body.appendChild(modalContainer); }
        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => { modalContainer.innerHTML = ''; });
        
        const saveBtn = modalContainer.querySelector('#save-streamkey-btn');
        saveBtn.addEventListener('click', async () => {
            const keyInput = modalContainer.querySelector('#streamkey-input').value.trim();
            if(keyInput === '') return alert("Ingresa tu Stream Key.");
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; saveBtn.disabled = true;
            const { error } = await this.supabase.from('bsky_credentials').update({ stream_key: keyInput }).eq('user_id', this.user.id);
            if (error) { alert("Error al guardar la llave."); saveBtn.disabled = false; saveBtn.innerHTML = 'Guardar y Transmitir'; return; }
            if (!this.bskyCreds) this.bskyCreds = {};
            this.bskyCreds.stream_key = keyInput;
            modalContainer.innerHTML = ''; 
            this.openGoLiveModal(); 
        });
    }
};

// Inicializar la aplicación SOLAMENTE cuando main.js haya preparado Supabase
document.addEventListener('mainReady', () => {
    ComunidadApp.init();
    // Exponemos la app al navegador para que funcionen los OnClick del HTML
    window.ComunidadApp = ComunidadApp;
});