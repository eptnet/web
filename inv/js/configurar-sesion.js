const SessionConfigApp = {
    supabase: null,
    user: null,
    userProfile: null,
    currentProject: null,
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

        const { data: profile } = await this.supabase.from('profiles').select('orcid, display_name, full_name').eq('id', this.user.id).single();
        this.userProfile = profile || { orcid: '0000', display_name: 'Usuario', full_name: 'Usuario' };

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
    },

    setupRealtimePreview() {
        const sync = (inputId, targetId, isImage = false, prefix = '') => {
            const input = document.getElementById(inputId);
            if(!input) return;
            input.addEventListener('input', (e) => {
                const val = e.target.value || (isImage ? 'https://i.ibb.co/Vt9tv2D/default-placeholder.png' : '...');
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
        document.querySelector(`input[value="${platform}"]`).closest('.platform-card').classList.add('selected');

        const idContainer = document.getElementById('platform-id-container');
        const eptHint = document.getElementById('ept-live-hint');
        const badge = document.getElementById('preview-badge');

        if (platform === 'vdo_ninja') {
            idContainer.classList.add('hidden');
            eptHint.classList.remove('hidden');
            badge.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> EPT Live';
            badge.style.background = 'var(--accent)';
        } else {
            idContainer.classList.remove('hidden');
            eptHint.classList.add('hidden');
            const icons = { 'youtube': 'fa-youtube', 'twitch': 'fa-twitch', 'substack': 'fa-bookmark' };
            badge.innerHTML = `<i class="fa-brands ${icons[platform] || 'fa-video'}"></i> ${platform.toUpperCase()}`;
            badge.style.background = '#334155';
        }
    },

    async loadSessionForEdit() {
        document.getElementById('btn-save-session').innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Sesión';
        
        const { data: session, error } = await this.supabase.from('sessions').select('*').eq('id', this.editSessionId).single();
        if (error || !session) return alert('No se pudo cargar la sesión.');

        if (!this.currentProject) {
            this.currentProject = { title: session.project_title, doi: session.project_doi };
            document.getElementById('active-project-name').innerHTML = `<i class="fa-solid fa-folder-open"></i> ${this.currentProject.title}`;
        }

        document.querySelector(`input[name="platform"][value="${session.platform}"]`).checked = true;
        this.handlePlatformChange(session.platform);
        
        document.getElementById('platform-id').value = session.platform_id || '';
        document.getElementById('session-title').value = session.session_title || '';
        document.getElementById('session-start').value = session.scheduled_at ? new Date(session.scheduled_at).toISOString().slice(0,16) : '';
        document.getElementById('session-end').value = session.end_at ? new Date(session.end_at).toISOString().slice(0,16) : '';
        document.getElementById('session-description').value = session.description || '';
        document.getElementById('session-thumbnail').value = session.thumbnail_url || '';
        document.getElementById('session-more-info').value = session.more_info_url || '';

        document.getElementById('session-title').dispatchEvent(new Event('input'));
        document.getElementById('session-thumbnail').dispatchEvent(new Event('input'));
        document.getElementById('session-start').dispatchEvent(new Event('change'));

        const { data: participants } = await this.supabase.from('event_participants').select('profiles(id, display_name)').eq('session_id', this.editSessionId);
        if (participants) {
            participants.forEach(p => {
                if (p.profiles) this.addedParticipants.push({ id: p.profiles.id, name: p.profiles.display_name });
            });
            this.renderParticipants();
        }

        this.showLinksPanel(session);
    },

    showLinksPanel(session) {
        document.getElementById('btn-enter-studio').classList.remove('hidden');
        if (session.platform === 'vdo_ninja') {
            document.getElementById('session-links-panel').classList.remove('hidden');
            document.getElementById('link-guest').value = session.guest_url || 'Link no generado';
            document.getElementById('link-viewer').value = session.viewer_url || 'Link no generado';
            document.getElementById('link-public').value = `https://epistecnologia.com/live.html?sesion=${session.id}`;
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

        return {
            director_url,
            guest_url,
            viewer_url,
            recording_source_url
        };
    },

    async saveSession() {
        const btn = document.getElementById('btn-save-session');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        const title = document.getElementById('session-title').value.trim();
        const start = document.getElementById('session-start').value;
        const platform = document.querySelector('input[name="platform"]:checked').value;
        
        if (!title || !start) { 
            alert("El título y la fecha son obligatorios."); 
            btn.disabled=false; 
            btn.innerHTML=originalText; 
            return; 
        }

        let sessionData = {
            user_id: this.user.id,
            project_title: this.currentProject.title,
            project_doi: this.currentProject.doi,
            session_title: title,
            scheduled_at: new Date(start).toISOString(),
            end_at: document.getElementById('session-end').value ? new Date(document.getElementById('session-end').value).toISOString() : null,
            description: document.getElementById('session-description').value,
            thumbnail_url: document.getElementById('session-thumbnail').value,
            more_info_url: document.getElementById('session-more-info').value,
            platform: platform,
            platform_id: document.getElementById('platform-id').value,
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
                
                if (platform === 'vdo_ninja') {
                    const vdoUrls = this.generateVdoNinjaUrls();
                    sessionData = { ...sessionData, ...vdoUrls };
                }

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