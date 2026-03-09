// ARCHIVO: /inv/js/configurar-sesion.js
// Actualizado con Integración API YouTube Dinámica y Soporte Twitch

const SessionConfigApp = {
    supabase: null,
    user: null,
    userProfile: null,
    currentProject: null,
    currentSession: null, // <-- NUEVO: Guarda la sesión actual para no duplicar eventos en YouTube
    IMGBB_API_KEY: "89d606fc7588367140913f93a4c89785", 
    addedParticipants: [],
    isEditMode: false,
    editSessionId: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href='/'; return; }
        this.user = session.user;

        const { data: profile } = await this.supabase.from('profiles')
            .select('orcid, display_name, username, avatar_url')
            .eq('id', this.user.id)
            .single();
            
        this.userProfile = profile || { orcid: '0000', display_name: 'Usuario', username: 'usuario' };

        const urlParams = new URLSearchParams(window.location.search);
        this.editSessionId = urlParams.get('edit');
        this.isEditMode = !!this.editSessionId;

        const activeProjectString = sessionStorage.getItem('activeProject');
        if (!activeProjectString && !this.isEditMode) { 
            alert('Selecciona un proyecto en el Dashboard primero.'); 
            window.location.href='/inv/dashboard.html'; 
            return; 
        }
        
        if (activeProjectString) {
            this.currentProject = JSON.parse(activeProjectString);
            document.getElementById('active-project-name').innerHTML = `<i class="fa-solid fa-folder-open"></i> ${this.currentProject.title}`;
        }

        this.setupEventListeners();
        this.setupRealtimePreview();

        if (this.isEditMode) {
            await this.loadSessionForEdit();
        } else {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('session-start').value = now.toISOString().slice(0,16);
        }
    },

    setupEventListeners() {
        document.querySelectorAll('input[name="platform"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handlePlatformChange(e.target.value));
        });
        document.getElementById('search-participant-btn').addEventListener('click', () => this.searchParticipants());
        document.getElementById('file-thumbnail').addEventListener('change', (e) => this.uploadToImgBB(e));
        
        document.getElementById('btn-save-session').addEventListener('click', () => this.saveSession());
        document.getElementById('btn-enter-studio').addEventListener('click', () => {
            if (this.editSessionId) window.location.href = `/inv/sala-de-control.html?id=${this.editSessionId}`;
        });

        document.getElementById('btn-generate-ai')?.addEventListener('click', () => this.generateTextAI());
        document.getElementById('btn-generate-img-ai')?.addEventListener('click', () => this.generateImageAI());
    
        document.getElementById('btn-discard-img')?.addEventListener('click', () => {
            document.getElementById('ai-gallery').classList.add('hidden');
            document.getElementById('ai-gallery-img').src = '';
        });
        document.getElementById('btn-use-img')?.addEventListener('click', (e) => this.uploadGalleryImage(e));

        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const input = document.getElementById(targetId);
                input.select();
                document.execCommand('copy');
                const originalIcon = e.currentTarget.innerHTML;
                e.currentTarget.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i>';
                setTimeout(() => e.currentTarget.innerHTML = originalIcon, 2000);
            });
        });

        const btnObs = document.getElementById('btn-download-obs');
        if (btnObs) {
            btnObs.addEventListener('click', (e) => this.generateOBSCollection(e.currentTarget));
        }

        document.getElementById('broadcast-mode')?.addEventListener('change', (e) => this.handleBroadcastModeChange(e.target.value));
    },

    generateOBSCollection(btn) {
        const viewerUrl = btn.dataset.viewerUrl;
        const sessionTitle = btn.dataset.sessionTitle || "Evento_Epistecnologia";
        
        if (!viewerUrl) { alert("El enlace aún no está listo. Guarda la sesión primero."); return; }

        const safeTitle = sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const obsJson = {
            "current_scene": "EPT Live - Escena Principal",
            "current_program_scene": "EPT Live - Escena Principal",
            "name": `EPT_${safeTitle}`,
            "scene_order": [{ "name": "EPT Live - Escena Principal" }],
            "sources": [
                {
                    "id": "scene",
                    "name": "EPT Live - Escena Principal",
                    "settings": {
                        "custom_size": false,
                        "id_counter": 1,
                        "items": [{ "id": 1, "name": "Cámara EPT Live (Navegador)", "visible": true }]
                    }
                },
                {
                    "id": "browser_source",
                    "name": "Cámara EPT Live (Navegador)",
                    "settings": {
                        "fps": 30, "height": 1080, "width": 1920,
                        "reroute_audio": true, "url": viewerUrl
                    }
                }
            ]
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obsJson, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `OBS_${safeTitle}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    setupRealtimePreview() {
        const sync = (inputId, targetId, isImage = false, prefix = '') => {
            const input = document.getElementById(inputId);
            if(!input) return;
            input.addEventListener('input', (e) => {
                const val = e.target.value || (isImage ? 'https://placehold.co/1280x720/1e293b/38bdf8?text=Vista+Previa' : '...');
                if (isImage) document.getElementById(targetId).src = val;
                else document.getElementById(targetId).textContent = prefix + val;
            });
        };
        sync('session-title', 'preview-title');
        sync('session-description', 'preview-desc');
        sync('session-thumbnail', 'preview-image', true);
        
        document.getElementById('session-start').addEventListener('change', (e) => {
            const dateStr = new Date(e.target.value).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
            document.getElementById('preview-date').innerHTML = `<i class="fa-regular fa-calendar"></i> ${dateStr}`;
        });
    },

    handlePlatformChange(platform) {
        document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('selected'));
        const activeRadio = document.querySelector(`input[name="platform"][value="${platform}"]`);
        if (activeRadio) activeRadio.closest('.platform-card').classList.add('selected');

        const externalOptions = document.getElementById('external-broadcast-options');
        const eptHint = document.getElementById('ept-live-hint');
        const badge = document.getElementById('preview-badge');

        if (platform === 'vdo_ninja') {
            if (externalOptions) externalOptions.classList.add('hidden');
            if (eptHint) eptHint.classList.remove('hidden');
            if (badge) { badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EPT Live'; badge.style.background = 'var(--accent)'; }
        } else {
            if (externalOptions) externalOptions.classList.remove('hidden');
            if (eptHint) eptHint.classList.add('hidden');
            if (badge) {
                const icons = { 'youtube': 'fa-youtube', 'twitch': 'fa-twitch', 'substack': 'fa-bookmark' };
                badge.innerHTML = `<i class="fa-brands ${icons[platform] || 'fa-video'}"></i> ${platform.toUpperCase()}`;
                badge.style.background = '#334155';
            }
            this.handleBroadcastModeChange(document.getElementById('broadcast-mode').value);
        }
    },

    handleBroadcastModeChange(mode) {
        const idContainer = document.getElementById('platform-id-container');
        const officialHint = document.getElementById('official-channel-hint');

        if (mode === 'own') {
            if (idContainer) idContainer.classList.remove('hidden');
            if (officialHint) officialHint.classList.add('hidden');
        } else {
            if (idContainer) idContainer.classList.add('hidden');
            if (officialHint) officialHint.classList.remove('hidden');
            const idInput = document.getElementById('platform-id');
            if (idInput) idInput.value = '';
        }
    },

    // ALGORITMO ORIGINAL DE PISCINA (Se conserva para Twitch y Substack)
    async assignStreamKey(platform, scheduledAt, endAt) {
        const { data: keys, error: keysError } = await this.supabase
            .from('stream_keys_pool').select('*').eq('platform', platform).eq('is_active', true);

        if (keysError || !keys || keys.length === 0) {
            throw new Error(`No hay claves configuradas en la piscina para ${platform.toUpperCase()}. Contacta a soporte.`);
        }

        const start = new Date(scheduledAt);
        const end = endAt ? new Date(endAt) : new Date(start.getTime() + 3 * 60 * 60 * 1000);
        const startOfDay = new Date(start); startOfDay.setHours(0,0,0,0);
        const endOfDay = new Date(start); endOfDay.setHours(23,59,59,999);

        const { data: overlappingSessions, error: sessionsError } = await this.supabase
            .from('sessions').select('id, stream_key, scheduled_at, end_at')
            .gte('scheduled_at', startOfDay.toISOString()).lte('scheduled_at', endOfDay.toISOString());

        if (sessionsError) throw new Error("Error al consultar disponibilidad de horarios.");

        const usedKeys = overlappingSessions.filter(s => {
            if (this.editSessionId && String(s.id) === String(this.editSessionId)) return false;
            if (!s.stream_key) return false;
            const sStart = new Date(s.scheduled_at);
            const sEnd = s.end_at ? new Date(s.end_at) : new Date(sStart.getTime() + 3 * 60 * 60 * 1000);
            return (start < sEnd && end > sStart);
        }).map(s => s.stream_key);

        const availableKey = keys.find(k => !usedKeys.includes(k.stream_key));

        if (!availableKey) {
            throw new Error(`Nuestros canales oficiales de ${platform.toUpperCase()} están llenos en ese horario. Por favor elige otra hora.`);
        }
        return availableKey.stream_key;
    },

    async generateTextAI() {
        const promptInput = document.getElementById('ai-prompt-input').value.trim();
        if (!promptInput) { alert("Cuéntale a la IA de qué deseas hablar primero."); return; }
        if (!this.currentProject) { alert("Selecciona un proyecto en el Dashboard primero para darle contexto a la IA."); return; }

        const btn = document.getElementById('btn-generate-ai');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pensando...';
        btn.disabled = true;

        const doiLink = this.currentProject.doi ? `https://doi.org/${this.currentProject.doi}` : `https://epistecnologia.com/@${this.userProfile.username}`;
        const systemPrompt = `Eres un experto en divulgación científica y cultural digital. 
        Tengo un proyecto titulado: "${this.currentProject.title}".
        El investigador quiere hacer una sesión en vivo sobre esto: "${promptInput}".
        
        Devuelve ÚNICAMENTE el siguiente formato exacto, sin saludos ni explicaciones extra:
        
        TÍTULO: [Un título muy atractivo y corto, máximo 8 palabras. Incluye 1 emoji al medio].
        DESCRIPCIÓN: [Gancho impactante de máximo 250 caracteres que despierte curiosidad, usa 1 o 2 emojis relevantes].\n\n[Desarrollo de la idea principal explicada de forma sencilla, empática y humana].\n\n📖 Lee el artículo completo aquí: ${doiLink}\n\n#Epistecnología #RevistEpistecnología #DivulgaciónCientífica`;

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', { 
                body: { textContent: `Proyecto base: ${this.currentProject.title}`, promptType: 'generate_from_instructions', customPrompt: systemPrompt } 
            });
            if (error) throw error;

            const responseText = data.result;
            const titleMatch = responseText.match(/TÍTULO:\s*(.+)/i);
            const descMatch = responseText.match(/DESCRIPCIÓN:\s*([\s\S]+)/i);

            if (titleMatch && titleMatch[1]) {
                const titleInput = document.getElementById('session-title');
                titleInput.value = titleMatch[1].trim().replace(/["*]/g, '');
                titleInput.dispatchEvent(new Event('input')); 
            }
            if (descMatch && descMatch[1]) {
                const descInput = document.getElementById('session-description');
                descInput.value = descMatch[1].trim();
                descInput.dispatchEvent(new Event('input'));
            }
        } catch (error) {
            console.error("Error en IA de texto:", error);
            alert("Hubo un error al generar el texto. Intenta de nuevo.");
        } finally { btn.innerHTML = originalText; btn.disabled = false; }
    },

    async generateImageAI() {
        const title = document.getElementById('session-title').value.trim();
        const promptInput = document.getElementById('ai-prompt-input').value.trim();
        const style = document.getElementById('ai-image-style').value;
        const engine = document.getElementById('ai-image-engine').value;
        const thumbText = document.getElementById('thumbnail-text').value.trim(); 
        
        if (!title && !promptInput) { alert("Genera primero el título o escribe de qué tratará la sesión."); return; }

        const btn = document.getElementById('btn-generate-img-ai');
        const originalBtnHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pintando...';
        btn.disabled = true;

        try {
            // 1. SOLUCIÓN A LO ABSTRACTO: 
            // Eliminamos "Concept art for:" para que el modelo haga imágenes fotorrealistas.
            let finalStyle = style;
            let cleanPrompt = `${title}. ${promptInput}. No text, no watermarks`;
            
            // Si elige cómic, lo adaptamos al idioma que entiende tu Edge Function
            if (style === 'Cartoon & Comic Classic') {
                cleanPrompt += ", detailed comic book style, 2d illustration. No text, no watermarks";
                finalStyle = 'vector'; 
            }

            const { data: imgData, error: imgError } = await this.supabase.functions.invoke('generate-image', { 
                body: { prompt: cleanPrompt, style: finalStyle, ratio: '16:9', engine: engine } 
            });
            if (imgError) throw imgError;

            const finalBase64 = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1280; canvas.height = 720;
                    const ctx = canvas.getContext('2d');
                    
                    // 2. LÓGICA DE RECORTE (Crop 16:9)
                    // Mantiene la imagen en proporción perfecta sin importar el tamaño que envíe FLUX
                    const sourceWidth = img.width; 
                    const sourceHeight = img.width * (9 / 16); 
                    const sourceY = (img.height - sourceHeight) / 2; 

                    ctx.drawImage(img, 0, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
                    
                    // Renderizado de las letras con el degradado
                    if (thumbText) {
                        const gradient = ctx.createLinearGradient(0, 0, canvas.width * 0.7, 0);
                        gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
                        gradient.addColorStop(1, "transparent");
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        ctx.font = "bold 85px 'Arial Black', Impact, sans-serif";
                        ctx.fillStyle = "#ffffff";
                        ctx.textAlign = "left"; 
                        ctx.textBaseline = "middle";
                        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                        ctx.shadowBlur = 15; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;

                        const words = thumbText.split(' ');
                        let lines = [];
                        if (words.length > 1) {
                            lines.push(words[0].toUpperCase());
                            lines.push(words.slice(1).join(' ').toUpperCase());
                        } else { lines.push(words[0].toUpperCase()); }

                        let startY = canvas.height - (lines.length * 95) - 40;
                        const startX = 60; 

                        for(let i = 0; i < lines.length; i++) {
                            ctx.fillStyle = i === 0 ? "#facc15" : "#ffffff"; 
                            ctx.lineWidth = 6; ctx.strokeStyle = '#000000';
                            ctx.strokeText(lines[i], startX, startY + (i * 95));
                            ctx.fillText(lines[i], startX, startY + (i * 95));
                        }
                    }

                    ctx.font = "bold 24px Arial"; ctx.fillStyle = "#ffffff8f"; ctx.shadowBlur = 4;
                    ctx.textAlign = "right";
                    ctx.fillText("✨EPT Live", canvas.width - 40, 40);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.onerror = () => reject(new Error("Error en Canvas."));
                img.src = imgData.image;
            });

            document.getElementById('ai-gallery-img').src = finalBase64;
            document.getElementById('ai-gallery').classList.remove('hidden');

        } catch (error) {
            console.error(error);
            alert("No se pudo generar la imagen. Intenta de nuevo.");
        } finally { btn.innerHTML = originalBtnHTML; btn.disabled = false; }
    },

    async uploadGalleryImage(e) {
        const btn = e.target;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
        btn.disabled = true;

        try {
            const base64Clean = document.getElementById('ai-gallery-img').src.split(',')[1];
            const formData = new FormData();
            formData.append("image", base64Clean);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, { method: "POST", body: formData });
            if (!response.ok) throw new Error("Fallo al subir a ImgBB");
            const uploadedData = await response.json();
            
            const thumbnailInput = document.getElementById('session-thumbnail');
            thumbnailInput.value = uploadedData.data.url;
            thumbnailInput.dispatchEvent(new Event('input')); 

            document.getElementById('ai-gallery').classList.add('hidden'); 
        } catch(err) {
            alert("Error subiendo la imagen.");
        } finally { btn.innerHTML = originalHTML; btn.disabled = false; }
    },

    async loadSessionForEdit() {
        document.getElementById('btn-save-session').innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Sesión';
        
        const { data: session, error } = await this.supabase.from('sessions').select('*').eq('id', this.editSessionId).single();
        if (error || !session) return alert('No se pudo cargar la sesión.');

        this.currentSession = session; // Guardamos en memoria para uso futuro

        if (!this.currentProject) {
            this.currentProject = { title: session.project_title, doi: session.project_doi };
            document.getElementById('active-project-name').innerHTML = `<i class="fa-solid fa-folder-open"></i> ${this.currentProject.title}`;
        }

        const platformRadio = document.querySelector(`input[name="platform"][value="${session.platform}"]`);
        if (platformRadio) {
            platformRadio.checked = true;
            this.handlePlatformChange(session.platform);
            
            if (session.platform !== 'vdo_ninja') {
                const modeSelect = document.getElementById('broadcast-mode');
                if (modeSelect) {
                    // Si el platform_id no es una URL rara de Supabase, significa que lo editó o lo conectó manual
                    // Inferimos si es suyo (texto corto como dQw4w9) o si lo pusimos nosotros.
                    // Para mantenerlo simple: si platform_id existe, es "own" o ya está configurado.
                    modeSelect.value = session.platform_id ? 'own' : 'official';
                    this.handleBroadcastModeChange(modeSelect.value);
                }
            }
        }
        
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const toLocalDatetime = (isoString) => {
            if (!isoString) return '';
            const d = new Date(isoString);
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16); 
        };

        setVal('platform-id', session.platform_id);
        setVal('session-title', session.session_title);
        setVal('session-start', toLocalDatetime(session.scheduled_at));
        setVal('session-end', toLocalDatetime(session.end_at));
        setVal('session-description', session.description);
        setVal('session-thumbnail', session.thumbnail_url);
        setVal('session-more-info', session.more_info_url);
        setVal('session-category', session.session_type || 'Divulgación General');

        document.getElementById('session-title')?.dispatchEvent(new Event('input'));
        document.getElementById('session-description')?.dispatchEvent(new Event('input'));
        document.getElementById('session-thumbnail')?.dispatchEvent(new Event('input'));
        document.getElementById('session-start')?.dispatchEvent(new Event('change'));

        const { data: participants } = await this.supabase.from('event_participants').select('profiles(id, display_name)').eq('session_id', this.editSessionId);
        if (participants) {
            this.addedParticipants = []; 
            participants.forEach(p => {
                if (p.profiles) this.addedParticipants.push({ id: p.profiles.id, name: p.profiles.display_name });
            });
            this.renderParticipants();
        }

        this.showLinksPanel(session);
    },

    showLinksPanel(session) {
        document.getElementById('btn-enter-studio').classList.remove('hidden');
        const panel = document.getElementById('session-links-panel');
        if (!panel) return;
        
        panel.classList.remove('hidden');
        
        document.getElementById('link-public').value = `https://epistecnologia.com/l/${session.id}`;
        document.getElementById('link-guest').value = session.guest_url || 'Pendiente...';
        document.getElementById('link-viewer').value = session.viewer_url || 'Pendiente...';
        document.getElementById('link-director').value = session.director_url || 'Pendiente...';

        const btnObs = document.getElementById('btn-download-obs');
        if (btnObs) {
            btnObs.dataset.viewerUrl = session.viewer_url; 
            btnObs.dataset.sessionTitle = session.session_title; 
        }

        // GUÍA OBS DINÁMICA
        const step3 = document.getElementById('obs-step-3');
        const broadcastMode = document.getElementById('broadcast-mode')?.value;

        if (step3) {
            if (session.platform === 'vdo_ninja' || broadcastMode === 'official') {
                const realStreamKey = session.stream_key || 'Clave-no-asignada';
                let rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
                
                if (session.platform === 'twitch') rtmpUrl = 'rtmp://live.twitch.tv/app';
                else if (session.platform === 'vdo_ninja') rtmpUrl = 'Servidor Interno EPT (Automático)';

                step3.innerHTML = `
                    En Servicio elige <strong>"Personalizado"</strong> y pega estos datos oficiales de nuestra red:<br>
                    <div style="display:inline-block; margin-top:10px; background: #000; padding: 12px; border-radius: 6px; color: #10b981; border: 1px dashed #334155; width: 100%; font-family: monospace;">
                        <strong>Servidor:</strong> <span style="user-select: all; color: #94a3b8;">${rtmpUrl}</span><br>
                        <strong>Clave:</strong> <span style="user-select: all; filter: blur(5px); cursor: pointer; transition: 0.3s;" onclick="this.style.filter='none'" title="Haz clic para revelar la clave">${realStreamKey}</span>
                    </div>
                `;
            } else {
                const platformName = session.platform.charAt(0).toUpperCase() + session.platform.slice(1);
                step3.innerHTML = `En Servicio elige <strong>"${platformName}"</strong>, conecta tu cuenta o pega tu propia clave de transmisión proporcionada por tu canal.`;
            }
        }
    },

    generateVdoNinjaUrls() {
        const stableId = self.crypto.randomUUID().slice(0, 8);
        const orcidStr = this.userProfile.orcid || '0000';
        const roomName = `ept_2_${orcidStr.slice(-4)}_${stableId}`; 
        const directorKey = `dir_${orcidStr.slice(-4)}`;
        const vdoDomain = 'https://vdo.ninja/alpha';
        
        let directorParams = new URLSearchParams({ room: roomName, director: directorKey, record: 'auto' });
        
        const recordingParams = new URLSearchParams({
            scene: '0', layout: '', remote: '', clean: '', chroma: '000', ssar: 'landscape',
            nosettings: '', prefercurrenttab: '', selfbrowsersurface: 'include',
            displaysurface: 'browser', np: '', nopush: '', publish: '', record: '',
            screenshareaspectratio: '1.7777777777777777', locked: '1.7777777777777777', room: roomName
        });
        const recording_source_url = `${vdoDomain}/?${recordingParams.toString()}`;
        
        let guestParams = new URLSearchParams({ room: roomName });
        let viewerParams = new URLSearchParams({ scene: '0', showlabels: '0', room: roomName });
        
        if (this.addedParticipants.length > 4) {
            const meshcastUrl = `https://cae1.meshcast.io/whep/${roomName}`;
            directorParams.set('whepshare', meshcastUrl);
            guestParams.set('whepshare', meshcastUrl);
            viewerParams.set('meshcast', '1');
        }

        const director_url = `${vdoDomain}/mixer?${directorParams.toString()}&meshcast`;
        const guest_url = `${vdoDomain}/?${guestParams.toString()}`;
        const viewer_url = `${vdoDomain}/?${viewerParams.toString()}&layout&whepshare=https://use1.meshcast.io/whep/${roomName}&cleanoutput`;

        return { director_url, guest_url, viewer_url, recording_source_url };
    },

    async saveSession() {
        const btn = document.getElementById('btn-save-session');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        const title = document.getElementById('session-title').value.trim();
        const start = document.getElementById('session-start').value;
        const platform = document.querySelector('input[name="platform"]:checked').value;
        const broadcastMode = document.getElementById('broadcast-mode')?.value;
        
        if (!title || !start) { 
            alert("El título y la fecha son obligatorios."); 
            btn.disabled=false; btn.innerHTML=originalText; 
            return; 
        }

        // --- MAGIA: LÓGICA DE INTEGRACIÓN API DE YOUTUBE Y TWITCH ---
        let platformIdToSave = document.getElementById('platform-id')?.value || null;
        let generatedStreamKey = this.currentSession?.stream_key || null;

        if (platform !== 'vdo_ninja' && broadcastMode === 'official') {
            // Verificamos si ya tenemos una clave válida generada para ESTA plataforma
            const alreadyHasOfficialKey = this.isEditMode && 
                                          this.currentSession?.platform === platform && 
                                          this.currentSession?.stream_key && 
                                          !this.currentSession?.platform_id?.includes('http');
            
            if (alreadyHasOfficialKey) {
                // Si ya existe (estamos editando), mantenemos el evento intacto
                platformIdToSave = this.currentSession.platform_id;
                generatedStreamKey = this.currentSession.stream_key;
            } else {
                try {
                    if (platform === 'youtube') {
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando en YouTube...';
                        
                        // LLAMAMOS A LA EDGE FUNCTION DE GOOGLE API
                        const { data, error } = await this.supabase.functions.invoke('create-youtube-live', {
                            body: {
                                title: title,
                                description: document.getElementById('session-description')?.value || '',
                                thumbnailUrl: document.getElementById('session-thumbnail')?.value || '' // <-- ¡LÍNEA NUEVA AÑADIDA!
                            }
                        });
                        
                        if (error) throw error;
                        if (!data.success) throw new Error(data.error);
                        
                        // La API nos devuelve el ID del video y la clave en tiempo real
                        platformIdToSave = data.videoId;
                        generatedStreamKey = data.streamKey;

                    } else if (platform === 'twitch') {
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando clave Twitch...';
                        generatedStreamKey = await this.assignStreamKey(platform, start, document.getElementById('session-end')?.value);
                        platformIdToSave = 'epistecnologia'; // Canal oficial de Twitch
                    } else {
                        // Substack / Otros (Aún usan piscina)
                        generatedStreamKey = await this.assignStreamKey(platform, start, document.getElementById('session-end')?.value);
                    }
                } catch (err) {
                    alert(`Error al configurar transmisión oficial: ${err.message}`);
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    return; 
                }
            }
        } else if (platform === 'vdo_ninja') {
            generatedStreamKey = this.currentSession?.stream_key || `ept-live-${self.crypto.randomUUID().slice(0, 8)}`;
            platformIdToSave = null;
        }
        // --- FIN MAGIA API ---

        let sessionData = {
            user_id: this.user.id,
            project_title: this.currentProject.title,
            project_doi: this.currentProject.doi,
            session_title: title,
            session_type: document.getElementById('session-category').value,
            scheduled_at: new Date(start).toISOString(),
            end_at: document.getElementById('session-end')?.value ? new Date(document.getElementById('session-end').value).toISOString() : null,
            description: document.getElementById('session-description')?.value || '',
            thumbnail_url: document.getElementById('session-thumbnail')?.value || '',
            more_info_url: document.getElementById('session-more-info')?.value || null,
            platform: platform,
            platform_id: platformIdToSave,
            stream_key: generatedStreamKey 
        };

        const authorInfo = {
            displayName: this.userProfile.display_name || this.userProfile.full_name,
            orcid: this.userProfile.orcid || ''
        };

        try {
            let savedSession;

            if (this.isEditMode) {
                const { data, error } = await this.supabase.from('sessions').update(sessionData).eq('id', this.editSessionId).select().single();
                if (error) throw error;
                savedSession = data;
            } else {
                sessionData.status = 'PROGRAMADO';
                sessionData.is_archived = false;
                
                const vdoUrls = this.generateVdoNinjaUrls();
                sessionData = { ...sessionData, ...vdoUrls };

                let postMethod = 'none';
                try {
                    const { data: status, error: checkError } = await this.supabase.functions.invoke('bsky-check-status');
                    if (checkError) throw checkError;

                    if (status && status.connected) {
                        postMethod = 'user';
                    } else {
                        const confirmed = confirm("Tu conexión con Bluesky ha fallado o no está configurada. ¿Deseas que el bot de Epistecnología publique el anuncio del evento por ti?");
                        if (confirmed) postMethod = 'bot';
                    }
                } catch (err) {
                    alert(`No se pudo verificar la conexión con Bluesky. La sesión se agendará sin crear el hilo de chat. Error: ${err.message}`);
                }
                
                const { data, error } = await this.supabase.functions.invoke('create-session-and-bsky-thread', {
                    body: { sessionData, authorInfo, postMethod }
                });

                if (error) throw error;
                savedSession = data.savedSession;
                
                this.isEditMode = true;
                this.editSessionId = savedSession.id;
                window.history.replaceState({}, '', `/inv/configurar-sesion.html?edit=${savedSession.id}`);
            }

            this.currentSession = savedSession; // Actualizamos la memoria

            if (this.addedParticipants.length > 0) {
                await this.supabase.from('event_participants').delete().eq('session_id', savedSession.id);
                const participantsData = this.addedParticipants.map(p => ({ session_id: savedSession.id, user_id: p.id }));
                await this.supabase.from('event_participants').insert(participantsData);
            }

            btn.disabled = false; 
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado!';
            setTimeout(() => btn.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Sesión', 2000);
            
            this.showLinksPanel(savedSession);

        } catch (err) {
            alert(`No se pudo guardar la sesión: ${err.message}`);
            console.error('Error al guardar la sesión:', err);
            btn.disabled = false; 
            btn.innerHTML = originalText;
        }
    },

    async uploadToImgBB(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const btn = e.target.nextElementSibling;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const formData = new FormData(); 
            formData.append("image", file);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                const urlInput = document.getElementById('session-thumbnail');
                urlInput.value = data.data.url;
                urlInput.dispatchEvent(new Event('input')); 
            } else throw new Error();
        } catch (error) {
            alert("Error al subir la imagen.");
        } finally {
            btn.innerHTML = originalText; 
            btn.disabled = false; 
            e.target.value = '';
        }
    },

    async searchParticipants() {
        const query = document.getElementById('participant-search').value.trim();
        if (!query) return;
        
        const { data, error } = await this.supabase.from('profiles')
            .select('id, display_name, username, avatar_url')
            .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
            .limit(5);

        const resultsContainer = document.getElementById('participant-search-results');
        if (error || !data.length) { 
            resultsContainer.innerHTML = '<div class="result-item">No se encontraron investigadores.</div>'; 
            return; 
        }

        resultsContainer.innerHTML = data.map(user => `
            <div class="result-item" onclick="SessionConfigApp.addParticipant('${user.id}', '${user.display_name}')">
                <img src="${user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                <span>${user.display_name} (@${user.username})</span>
            </div>
        `).join('');
    },

    addParticipant(id, name) {
        if (this.addedParticipants.some(p => p.id === id)) return;
        this.addedParticipants.push({ id, name });
        this.renderParticipants();
        document.getElementById('participant-search-results').innerHTML = '';
        document.getElementById('participant-search').value = '';
    },

    removeParticipant(id) {
        this.addedParticipants = this.addedParticipants.filter(p => p.id !== id);
        this.renderParticipants();
    },

    renderParticipants() {
        const ul = document.getElementById('added-participants-ul');
        ul.innerHTML = this.addedParticipants.map(p => `
            <li class="participant-li">
                <span><i class="fa-solid fa-user-astronaut text-muted"></i> ${p.name}</span>
                <button type="button" class="remove-participant" onclick="SessionConfigApp.removeParticipant('${p.id}')"><i class="fa-solid fa-times"></i></button>
            </li>
        `).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => SessionConfigApp.init());