// YA NO NECESITAMOS ESTA LÍNEA DE IMPORTACIÓN
// import ZoomVideo from '/inv/lib/zoom-sdk/main.js';

const EPTStream = {
    client: null,
    stream: null,
    participants: [],
    activeLayout: 'grid',
    pinnedParticipantId: null,
    sessionName: null,
    role: null,
    elements: {},

    async init() {
        this.cacheDOMElements();
        const params = new URLSearchParams(window.location.search);
        this.sessionName = params.get('session');
        this.role = params.get('role');

        if (!this.sessionName || !this.role) {
            this.showError("Faltan parámetros en la URL.");
            return;
        }

        // --- INICIO DE LA CORRECCIÓN CLAVE ---
        // El SDK ahora está disponible en el objeto 'window'. Lo definimos aquí.
        const ZoomVideo = window.WebVideoSDK.default;
        if (!ZoomVideo) {
            this.showError("El SDK de Zoom no se ha podido cargar.");
            return;
        }
        // --- FIN DE LA CORRECCIÓN CLAVE ---

        try {
            this.updateLoadingText('Obteniendo credenciales seguras...');
            const signature = await this.getZoomSignature();

            this.updateLoadingText('Iniciando cliente de video...');
            this.client = ZoomVideo.createClient();

            // Ya no necesitamos 'libPath' porque el CDN lo maneja internamente
            await this.client.init('en-US', 'Global');

            this.updateLoadingText('Conectando a la sesión...');
            const userName = `User-${Math.floor(Math.random() * 1000)}`;
            this.stream = this.client.join(this.sessionName, signature, userName, '');

            this.setupUI();
            this.setupSDKListeners();

            this.participants.push({
                userId: this.client.getCurrentUserInfo().userId,
                displayName: this.client.getCurrentUserInfo().displayName,
                videoOn: false
            });
            this.renderParticipantList();
            
            this.elements.loadingOverlay.classList.remove('is-visible');

        } catch (error) {
            console.error(error);
            this.showError(`Error al iniciar: ${error.message || 'Revise la consola.'}`);
        }
    },

    // El resto del código (cacheDOMElements, getZoomSignature, setupUI, etc.)
    // permanece exactamente igual que en el mensaje anterior.
    
    cacheDOMElements() {
        this.elements = {
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingText: document.getElementById('loading-text'),
            canvas: document.getElementById('video-canvas'),
            participantsList: document.getElementById('participants-list'),
            hostControls: document.getElementById('host-controls'),
            layoutControls: document.querySelector('.layout-controls'),
        };
    },

    async getZoomSignature() {
        const functionUrl = `https://seyknzlheaxmwztkfxmk.supabase.co/functions/v1/zoom-signature`;
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName: this.sessionName, role: this.role }),
        });
        if (!response.ok) throw new Error('No se pudo obtener la firma desde Supabase.');
        const { signature } = await response.json();
        return signature;
    },

    setupUI() {
        if (this.role === 'host') {
            this.elements.hostControls.classList.remove('hidden');
            this.elements.layoutControls.addEventListener('click', (e) => {
                const button = e.target.closest('.control-btn');
                if (button && button.dataset.layout) {
                    this.elements.layoutControls.querySelector('.active').classList.remove('active');
                    button.classList.add('active');
                    this.activeLayout = button.dataset.layout;
                    this.renderCanvasLayout();
                }
            });
            
            // Inicia el video del anfitrión automáticamente
            setTimeout(() => {
                this.stream.startVideo();
            }, 1000); // Pequeño retraso para asegurar que el stream esté listo
        }
    },

    setupSDKListeners() {
        this.client.on('user-added', (payload) => {
            this.participants = payload;
            this.renderParticipantList();
            this.renderCanvasLayout();
        });
        this.client.on('user-removed', (payload) => {
            this.participants = payload;
            this.renderParticipantList();
            this.renderCanvasLayout();
        });
        this.client.on('peer-video-state-change', (payload) => {
            const participant = this.participants.find(p => p.userId === payload.userId);
            if (participant) {
                participant.videoOn = payload.action === 'Start';
                this.renderParticipantList();
                this.renderCanvasLayout();
            }
        });
        this.client.on('video-active-change', (payload) => {
             const participant = this.participants.find(p => p.userId === payload.userId);
             if (participant) {
                participant.videoOn = payload.state === 'Active';
                this.renderParticipantList();
                this.renderCanvasLayout();
             }
        });
    },

    renderParticipantList() {
        let html = '';
        this.participants.forEach(p => {
            const icon = p.videoOn ? 'fa-video' : 'fa-video-slash';
            const isSelf = p.userId === this.client.getCurrentUserInfo().userId;
            html += `<div class="participant-item" data-user-id="${p.userId}">
                        <i class="fas ${icon}"></i>
                        <span>${p.displayName} ${isSelf ? '(Tú)' : ''}</span>
                     </div>`;
        });
        this.elements.participantsList.innerHTML = html;
    },

    async renderCanvasLayout() {
        if (!this.stream) return;
        await this.stream.stopRenderVideo(this.elements.canvas);
        const videoParticipants = this.participants.filter(p => p.videoOn);
        if (videoParticipants.length === 0) return;

        const canvasWidth = this.elements.canvas.width;
        const canvasHeight = this.elements.canvas.height;

        if (this.activeLayout === 'grid') {
            const count = videoParticipants.length;
            const cols = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / cols);
            const itemWidth = canvasWidth / cols;
            const itemHeight = canvasHeight / rows;
            
            for (let i = 0; i < videoParticipants.length; i++) {
                const user = videoParticipants[i];
                const x = (i % cols) * itemWidth;
                const y = Math.floor(i / cols) * itemHeight;
                await this.stream.renderVideo(this.elements.canvas, user.userId, itemWidth, itemHeight, x, y, 2);
            }
        } else if (this.activeLayout === 'speaker') {
            const speaker = videoParticipants[0];
            await this.stream.renderVideo(this.elements.canvas, speaker.userId, canvasWidth, canvasHeight, 0, 0, 2);
        }
    },
    
    showError(message) {
        this.elements.loadingText.textContent = message;
        if(this.elements.loadingOverlay.querySelector('.spinner')) {
           this.elements.loadingOverlay.querySelector('.spinner').style.display = 'none';
        }
    }
};

EPTStream.init();