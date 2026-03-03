export const EventEditorApp = {
    supabase: null,
    user: null,
    editMode: false,
    currentEvent: null,
    currentEditions: [],
    activeEditionId: null,
    IMGBB_API_KEY: "89d606fc7588367140913f93a4c89785", 

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        this.setupTabEvents();
        this.addEventListeners();
        this.setupImageUploads();
        await this.initializeEditors();

        const activeEventString = sessionStorage.getItem('activeEvent');
        if (activeEventString) {
            this.editMode = true;
            this.currentEvent = JSON.parse(activeEventString);
            await this.loadEventData();
        } else {
            this.updatePublicStatusText();
        }
    },

    initializeEditors() {
        return new Promise(resolve => {
            const totalEditors = 3;
            let initializedEditors = 0;
            tinymce.init({
                selector: '#event-about, #event-call-for-papers, #event-thank-you-message',
                plugins: 'autolink lists link charmap',
                toolbar: 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link | forecolor',
                menubar: false,
                height: 350,
                skin: document.body.classList.contains('dark-theme') ? 'oxide-dark' : 'oxide',
                content_css: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
                setup: (editor) => {
                    editor.on('init', () => {
                        initializedEditors++;
                        if (initializedEditors >= totalEditors) resolve();
                    });
                }
            });
        });
    },

    async loadEventData() {
        document.getElementById('event-main-title').textContent = this.currentEvent.title;
        document.getElementById('event-title').value = this.currentEvent.title;
        document.getElementById('event-slug').value = this.currentEvent.slug || '';
        document.getElementById('event-cover-url').value = this.currentEvent.cover_url || '';
        document.getElementById('event-registration-url').value = this.currentEvent.registration_url || '';
        document.getElementById('event-is-public').checked = this.currentEvent.is_public;

        const content = this.currentEvent.main_content || {};
        document.getElementById('event-seo-image-url').value = content.seo?.imageUrl || '';
        
        tinymce.get('event-about')?.setContent(content.about || '');
        tinymce.get('event-call-for-papers')?.setContent(content.callForPapers || '');
        tinymce.get('event-thank-you-message')?.setContent(this.currentEvent.registration_thank_you_message || '');

        this.updatePublicStatusText();
        this.updatePreviewButton();

        const { data: editions, error } = await this.supabase.from('event_editions').select('*').eq('event_id', this.currentEvent.id);
        if (error) { console.error("Error fetching editions:", error); return; }
        this.currentEditions = editions || [];
        this.renderEditionsList();
    },

    updatePreviewButton() {
        const viewPageBtn = document.getElementById('view-page-btn');
        if (this.currentEvent && this.currentEvent.slug) {
            viewPageBtn.style.display = 'inline-flex';
            viewPageBtn.onclick = (e) => {
                e.preventDefault();
                window.open(`/e/${this.currentEvent.slug}`, '_blank');
            };
        } else {
            viewPageBtn.style.display = 'none';
        }
    },

    updatePublicStatusText() {
        const checkbox = document.getElementById('event-is-public');
        const text = document.getElementById('public-status-text');
        if (checkbox.checked) { text.textContent = "Público y Visible"; text.className = "status-text public"; } 
        else { text.textContent = "Borrador Privado"; text.className = "status-text"; }
    },

    setupTabEvents() {
        const tabLinks = document.querySelectorAll('.tab-link');
        const tabContents = document.querySelectorAll('.tab-content');
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                tabLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                const tabId = link.dataset.tab;
                tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            });
        });
    },

    setupImageUploads() {
        const uploaders = [
            { btnId: 'file-event-cover', targetId: 'event-cover-url' },
            { btnId: 'file-event-seo', targetId: 'event-seo-image-url' }
        ];

        uploaders.forEach(u => {
            const fileInput = document.getElementById(u.btnId);
            if (fileInput) {
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const uploadBtn = fileInput.nextElementSibling;
                    const originalHTML = uploadBtn.innerHTML;
                    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    uploadBtn.disabled = true;

                    try {
                        const formData = new FormData();
                        formData.append("image", file);
                        const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, { method: "POST", body: formData });
                        const data = await res.json();
                        if (data.success) {
                            document.getElementById(u.targetId).value = data.data.url;
                        } else throw new Error("Fallo en ImgBB");
                    } catch (error) {
                        alert("Error al subir la imagen.");
                    } finally {
                        uploadBtn.innerHTML = originalHTML;
                        uploadBtn.disabled = false;
                        fileInput.value = '';
                    }
                });
            }
        });
    },

    addEventListeners() {
        // Generador RESPETUOSO de Slug
        document.getElementById('event-title').addEventListener('blur', (e) => {
            const slugInput = document.getElementById('event-slug');
            if (!slugInput.value.trim() && e.target.value.trim()) {
                slugInput.value = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            }
        });

        document.getElementById('event-is-public').addEventListener('change', () => this.updatePublicStatusText());
        document.getElementById('save-event-btn').addEventListener('click', () => this.handleSave());
        document.getElementById('add-edition-btn').addEventListener('click', () => this.openEditionEditor(null));
        
        // Escuchador de clics en el menú lateral de ediciones
        document.getElementById('editions-nav-list').addEventListener('click', e => {
            const navItem = e.target.closest('.edition-nav-item');
            if (!navItem) return;
            const editionId = navItem.dataset.editionId;
            const edition = this.currentEditions.find(ed => ed.id === editionId);
            this.openEditionEditor(edition);
        });

        // Eventos de IA
        document.querySelectorAll('.ai-button, .ai-button-text').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAIClick(e.currentTarget));
        });
    },

    async handleAIClick(btn) {
        const targetId = btn.dataset.target;
        const isRichText = btn.classList.contains('ai-button-text');
        const currentContent = isRichText ? tinymce.get(targetId).getContent({format: 'text'}) : document.getElementById(targetId).value;
        const projectContext = document.getElementById('event-title').value;

        if (!projectContext) return alert('Escribe primero el Título del Evento para darle contexto a la IA.');

        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        let systemInstruction = "Eres un asistente experto en divulgación científica y organización de eventos.";
        if (targetId === 'event-title') systemInstruction += " Mejora este título de evento para que sea muy atractivo e impactante. Devuelve SOLO EL TÍTULO SIN COMILLAS, máximo 8 palabras.";
        else if (targetId === 'event-about') systemInstruction += " Redacta un texto persuasivo en HTML (usando <p>, <strong>) sobre este evento. Hazlo empático e invita a participar. Máximo 2 párrafos cortos.";
        else if (targetId === 'event-call-for-papers') systemInstruction += " Redacta un llamado a ponencias (Call for Papers) en HTML para este evento. Sé claro, profesional y motivador. Usa viñetas <ul> si es necesario.";

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', {
                body: { textContent: `Evento: ${projectContext}. Texto actual: ${currentContent || 'Ninguno'}`, promptType: 'generate_from_instructions', customPrompt: systemInstruction }
            });
            if (error) throw error;
            
            let result = data.result.replace(/^["']|["']$/g, '').trim();
            if (isRichText) tinymce.get(targetId).setContent(result);
            else document.getElementById(targetId).value = result;
        } catch (error) {
            console.error("AI Error:", error);
            alert("No se pudo conectar con la IA.");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    renderEditionsList() {
        const container = document.getElementById('editions-nav-list');
        const welcomeScreen = document.getElementById('edition-welcome');
        const editorScreen = document.getElementById('edition-editor-container');
        
        if (!container) return;
        
        if (this.currentEditions.length === 0) {
            container.innerHTML = `<p class="form-hint" style="text-align:center;">Aún no has creado ediciones.</p>`;
            welcomeScreen.style.display = 'block';
            editorScreen.style.display = 'none';
            return;
        }

        container.innerHTML = this.currentEditions.map(edition => `
            <button class="edition-nav-item ${edition.id === this.activeEditionId ? 'active' : ''}" data-edition-id="${edition.id}">
                <span>${edition.edition_name}</span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `).join('');

        // Controlar qué pantalla mostrar
        if (this.activeEditionId) {
            welcomeScreen.style.display = 'none';
            editorScreen.style.display = 'block';
        } else {
            welcomeScreen.style.display = 'block';
            editorScreen.style.display = 'none';
        }
    },

    async openEditionEditor(editionData = null) {
        this.activeEditionId = editionData ? editionData.id : 'new';
        this.renderEditionsList();

        const container = document.getElementById('edition-editor-container');
        container.style.display = 'block';

        const { data: allSessions } = await this.supabase.from('sessions').select('id, session_title').eq('user_id', this.user.id);
        
        let sessionsCheckboxesHTML = (allSessions || []).map(session => `
            <div class="checkbox-item">
                <input type="checkbox" id="session-${session.id}" name="associated_session" value="${session.id}">
                <label for="session-${session.id}">${session.session_title}</label>
            </div>
        `).join('');

        container.innerHTML = `
            <fieldset class="builder-section">
                <legend><i class="fa-solid fa-pen text-accent"></i> ${editionData ? `Editando: ${editionData.edition_name}` : 'Nueva Edición'}</legend>
                ${editionData ? `<button type="button" class="btn-danger" style="float: right; margin-top: -2.0rem;" onclick="EventEditorApp.deleteEdition('${editionData.id}')"><i class="fa-solid fa-trash"></i> Eliminar Edición</button>` : ''}
                <div class="form-group"><label>Nombre de la Edición</label><input type="text" id="edition-name" value="${editionData?.edition_name || ''}" required></div>
                <div class="form-group-grid mt-3">
                    <div><label>Fecha de Inicio</label><input type="date" id="edition-start-date" value="${editionData?.start_date || ''}"></div>
                    <div><label>Fecha de Fin</label><input type="date" id="edition-end-date" value="${editionData?.end_date || ''}"></div>
                </div>
                <div class="form-group mt-3"><label>Lugar</label><input type="text" id="edition-location" value="${editionData?.location || ''}"></div>
                
                <div class="setting-box flex-center-col mt-3" style="align-items: flex-start; padding:0; border:none;">
                    <label>Activar cuenta atrás en portada</label>
                    <label class="switch modern-switch">
                        <input type="checkbox" id="edition-countdown-enabled">
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="form-group mt-3" id="countdown-time-wrapper" style="display: none;">
                    <label>Hora límite de la cuenta atrás</label>
                    <input type="time" id="edition-countdown-time" value="${editionData?.countdown_time || ''}">
                </div>
            </fieldset>

            <fieldset class="builder-section">
                <legend><i class="fa-solid fa-users text-accent"></i> Ponentes</legend>
                <div id="speakers-list-container" class="item-list-editor"></div>
                <button type="button" class="btn-add-item" id="add-speaker-btn"><i class="fa-solid fa-plus"></i> Añadir Ponente</button>
            </fieldset>

            <fieldset class="builder-section">
                <legend><i class="fa-solid fa-list-check text-accent"></i> Programa</legend>
                <div id="program-items-container" class="item-list-editor"></div>
                <button type="button" class="btn-add-item" id="add-program-item-btn"><i class="fa-solid fa-plus"></i> Añadir al Programa</button>
            </fieldset>

            <fieldset class="builder-section bg-light-panel">
                <legend><i class="fa-solid fa-podcast text-accent"></i> Sesiones EPT Live Asociadas</legend>
                <div class="checkbox-list-container">${sessionsCheckboxesHTML || '<p class="form-hint">No tienes sesiones EPT Live.</p>'}</div>
            </fieldset>
        `;

        const countdownToggle = container.querySelector('#edition-countdown-enabled');
        const countdownTimeWrapper = container.querySelector('#countdown-time-wrapper');
        countdownToggle.checked = editionData?.countdown_enabled ?? true;
        const toggleTimeVisibility = () => countdownTimeWrapper.style.display = countdownToggle.checked ? 'block' : 'none';
        toggleTimeVisibility();
        countdownToggle.addEventListener('change', toggleTimeVisibility);

        if (editionData?.selected_sessions) {
            editionData.selected_sessions.forEach(sessionId => {
                const checkbox = container.querySelector(`input[value="${sessionId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        (editionData?.speakers || []).forEach(speaker => this.addSpeakerFields(container.querySelector('#speakers-list-container'), speaker));
        (editionData?.program || []).forEach(item => this.addProgramItemFields(container.querySelector('#program-items-container'), item));
        
        container.querySelector('#add-program-item-btn').addEventListener('click', () => this.addProgramItemFields(container.querySelector('#program-items-container'), {}));
        container.querySelector('#add-speaker-btn').addEventListener('click', () => this.addSpeakerFields(container.querySelector('#speakers-list-container')));
    },

    addProgramItemFields(container, data = {}) {
        const fieldset = document.createElement('div'); fieldset.className = 'item-fieldset';
        const speakerNames = Array.from(document.querySelectorAll('.speaker-name')).map(i => i.value).filter(n => n.trim());
        let opts = '<option value="">Seleccionar ponente...</option>' + speakerNames.map(n => `<option value="${n}">${n}</option>`).join('');

        fieldset.innerHTML = `
            <button type="button" class="btn-remove-item">&times;</button>
            <div class="form-group mb-2"><label>Fecha</label><input type="date" class="program-item-date" value="${data.date || ''}"></div>
            <div class="form-group-grid mb-2">
                <div><label>Hora Inicio</label><input type="time" class="program-item-start-time" value="${data.startTime || ''}"></div>
                <div><label>Hora Fin</label><input type="time" class="program-item-end-time" value="${data.endTime || ''}"></div>
            </div>
            <div class="form-group mb-2"><label>Título</label><input type="text" class="program-item-title" value="${data.title || ''}"></div>
            <div class="form-group mb-2"><label>Ponente</label><select class="modern-select program-item-speaker">${opts}</select></div>
            <div class="form-group mb-2"><label>Portada (Hero)</label>
                <div class="input-with-upload">
                    <input type="text" class="program-item-cover-url" placeholder="URL imagen" value="${data.itemCoverUrl || ''}">
                    <input type="file" accept="image/*" style="display:none;" onchange="EventEditorApp.handleNestedUpload(this)">
                    <button type="button" class="btn-upload" onclick="this.previousElementSibling.click()"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                </div>
            </div>
            <div class="form-group"><label>Descripción Corta</label><textarea class="program-item-description" style="min-height:60px;">${data.description || ''}</textarea></div>
        `;
        if (data.speaker_name) fieldset.querySelector('.program-item-speaker').value = data.speaker_name;
        container.appendChild(fieldset);
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => fieldset.remove());
    },

    addSpeakerFields(container, data = {}) {
        const fieldset = document.createElement('div'); fieldset.className = 'item-fieldset';
        fieldset.innerHTML = `
            <button type="button" class="btn-remove-item">&times;</button>
            <div class="form-group mb-2"><label>Nombre</label><input type="text" class="speaker-name" value="${data.name || ''}"></div>
            <div class="form-group mb-2"><label>URL Foto (Avatar)</label>
                <div class="input-with-upload">
                    <input type="text" class="speaker-avatar" placeholder="URL avatar" value="${data.avatarUrl || ''}">
                    <input type="file" accept="image/*" style="display:none;" onchange="EventEditorApp.handleNestedUpload(this)">
                    <button type="button" class="btn-upload" onclick="this.previousElementSibling.click()"><i class="fa-solid fa-cloud-arrow-up"></i></button>
                </div>
            </div>
            <div class="form-group mb-2"><label>Bio corta</label><textarea class="speaker-bio" style="min-height:60px;">${data.bio || ''}</textarea></div>
            <label>Redes Sociales</label>
            <div class="form-group-grid-3-col mt-2">
                <input type="text" class="speaker-social1" placeholder="Web/ORCID" value="${data.social1 || ''}">
                <input type="text" class="speaker-social2" placeholder="LinkedIn" value="${data.social2 || ''}">
                <input type="text" class="speaker-social3" placeholder="X/Twitter" value="${data.social3 || ''}">
            </div>
        `;
        container.appendChild(fieldset);
        fieldset.querySelector('.speaker-name').addEventListener('input', () => this.updateSpeakerOptionsInProgram());
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => { fieldset.remove(); this.updateSpeakerOptionsInProgram(); });
    },

    // Subida auxiliar para Ponentes e Items del Programa
    async handleNestedUpload(inputEl) {
        const file = inputEl.files[0];
        if (!file) return;
        const uploadBtn = inputEl.nextElementSibling;
        const textInput = inputEl.previousElementSibling;
        const originalHTML = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        uploadBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append("image", file);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) textInput.value = data.data.url;
        } catch (e) { alert("Error al subir imagen."); } 
        finally { uploadBtn.innerHTML = originalHTML; uploadBtn.disabled = false; inputEl.value = ''; }
    },

    updateSpeakerOptionsInProgram() {
        const speakerNames = Array.from(document.querySelectorAll('.speaker-name')).map(i => i.value).filter(n => n.trim());
        let opts = '<option value="">Seleccionar ponente...</option>' + speakerNames.map(n => `<option value="${n}">${n}</option>`).join('');
        document.querySelectorAll('.program-item-speaker').forEach(s => { const val = s.value; s.innerHTML = opts; s.value = val; });
    },

    async deleteEdition(editionId) {
        if (!confirm("¿Estás seguro de que quieres borrar esta edición?")) return;
        const { error } = await this.supabase.from('event_editions').delete().eq('id', editionId);
        if (!error) {
            this.currentEditions = this.currentEditions.filter(ed => ed.id !== editionId);
            this.renderEditionsList();
            document.getElementById('edition-editor-container').style.display = 'none';
        }
    },

    async handleSave() {
        const saveButton = document.getElementById('save-event-btn');
        const originalText = saveButton.innerHTML;
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        tinymce.triggerSave();

        // Limpieza de tu Slug (Si está vacío, usa el título por defecto)
        let slugInput = document.getElementById('event-slug').value.trim();
        if (!slugInput) slugInput = document.getElementById('event-title').value.trim();
        slugInput = slugInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        document.getElementById('event-slug').value = slugInput;

        const eventUpdates = {
            title: document.getElementById('event-title').value,
            slug: slugInput, 
            cover_url: document.getElementById('event-cover-url').value,
            registration_url: document.getElementById('event-registration-url').value,
            is_public: document.getElementById('event-is-public').checked,
            main_content: {
                about: tinymce.get('event-about').getContent(),
                callForPapers: tinymce.get('event-call-for-papers').getContent(),
                seo: { imageUrl: document.getElementById('event-seo-image-url').value }
            },
            registration_thank_you_message: tinymce.get('event-thank-you-message').getContent(),
            user_id: this.user.id
        };

        const { data: savedEvent, error: eventError } = await this.supabase.from('events').upsert(this.editMode ? { id: this.currentEvent.id, ...eventUpdates } : eventUpdates).select().single();

        if (eventError) {
            alert("Error al guardar el evento. Asegúrate de modificar el Trigger en Supabase si el slug te da error.");
            saveButton.disabled = false; saveButton.innerHTML = originalText; return;
        }
        
        this.currentEvent = savedEvent;
        this.editMode = true;
        sessionStorage.setItem('activeEvent', JSON.stringify(savedEvent));

        // Guardar Edición activa si el panel está abierto
        const editionEditor = document.getElementById('edition-editor-container');
        if (editionEditor.style.display === 'block' && this.activeEditionId) {
            const program = Array.from(document.querySelectorAll('#program-items-container .item-fieldset')).map(el => ({
                date: el.querySelector('.program-item-date').value || null,
                startTime: el.querySelector('.program-item-start-time').value,
                endTime: el.querySelector('.program-item-end-time').value,
                title: el.querySelector('.program-item-title').value,
                speaker_name: el.querySelector('.program-item-speaker').value,
                itemCoverUrl: el.querySelector('.program-item-cover-url').value,
                description: el.querySelector('.program-item-description').value
            }));
            const speakers = Array.from(document.querySelectorAll('#speakers-list-container .item-fieldset')).map(el => ({
                name: el.querySelector('.speaker-name').value, avatarUrl: el.querySelector('.speaker-avatar').value,
                bio: el.querySelector('.speaker-bio').value, social1: el.querySelector('.speaker-social1').value,
                social2: el.querySelector('.speaker-social2').value, social3: el.querySelector('.speaker-social3').value
            }));
            const selectedSessions = Array.from(document.querySelectorAll('input[name="associated_session"]:checked')).map(cb => Number(cb.value));
            
            const editionDataToSave = {
                event_id: this.currentEvent.id, edition_name: document.getElementById('edition-name').value,
                start_date: document.getElementById('edition-start-date').value || null, end_date: document.getElementById('edition-end-date').value || null,
                location: document.getElementById('edition-location').value, program: program, speakers: speakers, selected_sessions: selectedSessions,
                countdown_enabled: document.getElementById('edition-countdown-enabled').checked, countdown_time: document.getElementById('edition-countdown-time').value || null
            };
            if (this.activeEditionId !== 'new') editionDataToSave.id = this.activeEditionId;
            await this.supabase.from('event_editions').upsert([editionDataToSave]); 
        }
        
        saveButton.disabled = false; 
        saveButton.innerHTML = '<i class="fa-solid fa-check"></i> ¡Publicado!';
        setTimeout(() => saveButton.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publicar Cambios', 2000);
        await this.loadEventData();
    }
};

window.EventEditorApp = EventEditorApp; // <-- ESTA ES LA LÍNEA MÁGICA
document.addEventListener('DOMContentLoaded', () => EventEditorApp.init());