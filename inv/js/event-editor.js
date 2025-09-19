// =================================================================
// ARCHIVO NUEVO: /inv/js/event-editor.js
// =================================================================

export const EventEditorApp = {
    supabase: null,
    user: null,
    editMode: false,
    currentEvent: null,
    currentEditions: [],
    activeEditionId: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        const activeEventString = sessionStorage.getItem('activeEvent');
        if (activeEventString) {
            this.editMode = true;
            this.currentEvent = JSON.parse(activeEventString);
            await this.loadEventData(); // Ahora esta función solo carga datos
        }

        // Ahora que los datos están listos (si existían), inicializamos todo lo demás
        this.initializeEditors();
        this.setupTabEvents();
        this.addEventListeners();
    },

    initializeEditors() {
        // Esta función ahora se ejecuta después de que los textareas tienen su contenido,
        // por lo que TinyMCE se inicializará correctamente.
        tinymce.init({
            selector: '#event-about, #event-call-for-papers',
            height: 300
        });
    },

    async loadEventData() {
        document.getElementById('event-main-title').textContent = this.currentEvent.title;
        document.getElementById('event-title').value = this.currentEvent.title;
        document.getElementById('event-is-public').checked = this.currentEvent.is_public;

        // --- CORRECCIÓN CLAVE: Acceso seguro a los datos ---
        const content = this.currentEvent.main_content || {}; // Si 'main_content' no existe, usamos un objeto vacío.
        
        // Usamos el `setup` de TinyMCE para asegurar que el editor esté listo antes de poner contenido.
        // Esto evita errores si los datos se cargan muy rápido.
        tinymce.get('event-about')?.setContent(content.about || '');
        tinymce.get('event-call-for-papers')?.setContent(content.callForPapers || '');

        const { data: editions, error } = await this.supabase
            .from('event_editions')
            .select('*')
            .eq('event_id', this.currentEvent.id);
        
        if (error) { console.error("Error fetching editions:", error); return; }
        this.currentEditions = editions;
        this.renderEditionsList();
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

    renderEditionsList() {
        const container = document.getElementById('editions-list-container');
        if (this.currentEditions.length === 0) {
            container.innerHTML = `<p class="form-hint">No hay ediciones para este evento.</p>`;
            return;
        }
        container.innerHTML = this.currentEditions.map(edition => `
            <div class="edition-item ${edition.id === this.activeEditionId ? 'active' : ''}" data-edition-id="${edition.id}">
                <span class="edition-item-name">${edition.edition_name}</span>
                <div class="edition-item-actions">
                    <button class="edit-edition-btn"><i class="fa-solid fa-pencil"></i> Editar</button>
                    <button class="delete-edition-btn"><i class="fa-solid fa-trash"></i> Borrar</button>
                </div>
            </div>
        `).join('');
    },

    async openEditionEditor(editionData = null) {
        this.activeEditionId = editionData ? editionData.id : 'new';
        this.renderEditionsList(); // Re-render para marcar la edición activa

        const container = document.getElementById('edition-editor-container');
        container.style.display = 'block';

        // Para el selector de ponentes, necesitamos los autores del proyecto asociado
        let authorsOptions = '<option value="">Seleccionar ponente...</option>';
        if (this.currentEvent && this.currentEvent.project_id) {
            const { data: project } = await this.supabase
                .from('projects')
                .select('authors')
                .eq('id', this.currentEvent.project_id)
                .single();
            if (project && project.authors) {
                authorsOptions += project.authors.map(author => `<option value="${author}">${author}</option>`).join('');
            }
        }

        // Construimos el HTML completo del editor de la edición
        container.innerHTML = `
            <fieldset>
                <legend>${editionData ? `Editando: ${editionData.edition_name}` : 'Nueva Edición'}</legend>
                <div class="form-group">
                    <label>Nombre de la Edición (ej: "Edición 2025")</label>
                    <input type="text" id="edition-name" value="${editionData?.edition_name || ''}" required>
                </div>
                <div class="form-group-grid">
                    <div class="form-group">
                        <label>Fecha de Inicio</label>
                        <input type="date" id="edition-start-date" value="${editionData?.start_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>Fecha de Fin</label>
                        <input type="date" id="edition-end-date" value="${editionData?.end_date || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Lugar (ej: "Virtual", "Arequipa, Perú")</label>
                    <input type="text" id="edition-location" value="${editionData?.location || ''}">
                </div>
            </fieldset>

            <fieldset>
                <legend><i class="fa-solid fa-users"></i> Ponentes (Speakers)</legend>
                <div id="speakers-list-container" class="item-list-editor"></div>
                <button type="button" class="btn-add-item" id="add-speaker-btn"><i class="fa-solid fa-plus"></i> Añadir Ponente</button>
            </fieldset>
            
            <fieldset>
                <legend><i class="fa-solid fa-list-check"></i> Programa del Evento</legend>
                <div id="program-items-container" class="item-list-editor"></div>
                <button type="button" class="btn-add-item" id="add-program-item-btn"><i class="fa-solid fa-plus"></i> Añadir al Programa</button>
            </fieldset>
            
        `;

        // Lógica para añadir items al programa y a los ponentes
        const programContainer = container.querySelector('#program-items-container');
        const speakersContainer = container.querySelector('#speakers-list-container');
        
        container.querySelector('#add-program-item-btn').addEventListener('click', () => {
            this.addProgramItemFields(programContainer, {}, authorsOptions);
        });
        container.querySelector('#add-speaker-btn').addEventListener('click', () => {
            this.addSpeakerFields(speakersContainer);
        });

        // Si estamos editando, poblamos los campos existentes
        if (editionData) {
            (editionData.program || []).forEach(item => this.addProgramItemFields(programContainer, item, authorsOptions));
            (editionData.speakers || []).forEach(speaker => this.addSpeakerFields(speakersContainer, speaker));
        }
    },

    addEventListeners() {
        document.getElementById('add-edition-btn').addEventListener('click', () => {
            this.openEditionEditor(null);
        });

        document.getElementById('editions-list-container').addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;

            const editionItem = e.target.closest('.edition-item');
            const editionId = editionItem.dataset.editionId;
            const edition = this.currentEditions.find(ed => ed.id === editionId);

            if (button.classList.contains('edit-edition-btn')) {
                this.openEditionEditor(edition);
            }
            if (button.classList.contains('delete-edition-btn')) {
                this.deleteEdition(editionId);
            }
        });

        document.getElementById('save-event-btn').addEventListener('click', () => {
            this.handleSave();
        });
    },

    addProgramItemFields(container, data = {}, authorsOptions) {
        const itemId = `program-${Date.now()}`;
        const fieldset = document.createElement('fieldset');
        fieldset.classList.add('item-fieldset');
        fieldset.innerHTML = `
            <legend>Item del Programa</legend>
            <button type="button" class="btn-remove-item">&times;</button>
            <div class="form-group">
                <label for="date-${itemId}">Fecha del Evento</label>
                <input type="date" id="date-${itemId}" class="program-item-date" value="${data.date || ''}">
            </div>
            <div class="form-group-grid">
                <div class="form-group">
                    <label for="start-time-${itemId}">Hora de Inicio</label>
                    <input type="time" id="start-time-${itemId}" class="program-item-start-time" value="${data.startTime || ''}">
                </div>
                <div class="form-group">
                    <label for="end-time-${itemId}">Hora de Fin</label>
                    <input type="time" id="end-time-${itemId}" class="program-item-end-time" value="${data.endTime || ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="title-${itemId}">Título de la Ponencia / Actividad</label>
                <input type="text" id="title-${itemId}" class="program-item-title" value="${data.title || ''}">
            </div>
            <div class="form-group">
                <label for="speaker-${itemId}">Ponente</label>
                <select id="speaker-${itemId}" class="program-item-speaker">${authorsOptions}</select>
            </div>
            <div class="form-group">
                <label for="desc-${itemId}">Descripción</label>
                <textarea id="desc-${itemId}" class="program-item-description" rows="3">${data.description || ''}</textarea>
            </div>
            <div class="form-group-grid">
                <div class="form-group">
                    <label for="link-text-${itemId}">Texto del Botón (ej: "Registrarse")</label>
                    <input type="text" id="link-text-${itemId}" class="program-item-link-text" value="${data.linkText || ''}">
                </div>
                <div class="form-group">
                    <label for="link-url-${itemId}">Enlace del Botón</label>
                    <input type="url" id="link-url-${itemId}" class="program-item-link-url" placeholder="https://..." value="${data.linkUrl || ''}">
                </div>
            </div>
        `;
        if (data.speaker_name) {
            fieldset.querySelector('.program-item-speaker').value = data.speaker_name;
        }
        container.appendChild(fieldset);
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => fieldset.remove());
    },

    addSpeakerFields(container, data = {}) {
        const speakerId = `speaker-${Date.now()}`;
        const fieldset = document.createElement('fieldset');
        fieldset.classList.add('item-fieldset');
        fieldset.innerHTML = `
            <legend>Ponente</legend>
            <button type="button" class="btn-remove-item">&times;</button>
            <div class="form-group">
                <label for="name-${speakerId}">Nombre del Ponente</label>
                <input type="text" id="name-${speakerId}" class="speaker-name" value="${data.name || ''}">
            </div>
            <div class="form-group">
                <label for="avatar-${speakerId}">URL de la Foto</label>
                <input type="text" id="avatar-${speakerId}" class="speaker-avatar" placeholder="https://ibb.co/..." value="${data.avatarUrl || ''}">
            </div>
            <div class="form-group">
                <label for="bio-${speakerId}">Afiliación o Bio corta</label>
                <textarea id="bio-${speakerId}" class="speaker-bio" rows="2">${data.bio || ''}</textarea>
            </div>
            <div class="form-group">
                <label for="email-${speakerId}">Email (opcional)</label>
                <input type="email" id="email-${speakerId}" class="speaker-email" value="${data.email || ''}">
            </div>
            <label>Redes Sociales (máximo 3)</label>
            <div class="form-group-grid-3-col">
                <input type="url" class="speaker-social1" placeholder="https://..." value="${data.social1 || ''}">
                <input type="url" class="speaker-social2" placeholder="https://..." value="${data.social2 || ''}">
                <input type="url" class="speaker-social3" placeholder="https://..." value="${data.social3 || ''}">
            </div>
        `;
        container.appendChild(fieldset);
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => fieldset.remove());
    },

    async handleSave() {
        const saveButton = document.getElementById('save-event-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        // 1. Guardar datos del evento principal (sin cambios)
        tinymce.triggerSave();
        const eventUpdates = {
            title: document.getElementById('event-title').value,
            is_public: document.getElementById('event-is-public').checked,
            main_content: {
                about: tinymce.get('event-about').getContent(),
                callForPapers: tinymce.get('event-call-for-papers').getContent()
            },
            user_id: this.user.id
        };
        const { data: savedEvent, error: eventError } = await this.supabase
            .from('events')
            .upsert(this.editMode ? { id: this.currentEvent.id, ...eventUpdates } : eventUpdates)
            .select().single();

        if (eventError) {
            console.error("Error saving event:", eventError);
            alert("Error al guardar el evento principal.");
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
            return;
        }
        this.currentEvent = savedEvent;
        this.editMode = true;
        sessionStorage.setItem('activeEvent', JSON.stringify(savedEvent));

        // 2. Guardar datos de la edición activa
        const editionEditor = document.getElementById('edition-editor-container');
        if (editionEditor.style.display === 'block' && this.activeEditionId) {
            // --- LÓGICA DE GUARDADO ACTUALIZADA ---
            const program = Array.from(document.querySelectorAll('#program-items-container .item-fieldset')).map(el => ({
                date: el.querySelector('.program-item-date').value,
                startTime: el.querySelector('.program-item-start-time').value,
                endTime: el.querySelector('.program-item-end-time').value,
                title: el.querySelector('.program-item-title').value,
                speaker_name: el.querySelector('.program-item-speaker').value,
                description: el.querySelector('.program-item-description').value,
                linkText: el.querySelector('.program-item-link-text').value,
                linkUrl: el.querySelector('.program-item-link-url').value,
            }));

            const speakers = Array.from(document.querySelectorAll('#speakers-list-container .item-fieldset')).map(el => ({
                name: el.querySelector('.speaker-name').value,
                avatarUrl: el.querySelector('.speaker-avatar').value,
                bio: el.querySelector('.speaker-bio').value,
                email: el.querySelector('.speaker-email').value,
                social1: el.querySelector('.speaker-social1').value,
                social2: el.querySelector('.speaker-social2').value,
                social3: el.querySelector('.speaker-social3').value,
            }));

            const editionUpdates = {
                event_id: this.currentEvent.id,
                edition_name: document.getElementById('edition-name').value,
                start_date: document.getElementById('edition-start-date').value || null,
                end_date: document.getElementById('edition-end-date').value || null,
                location: document.getElementById('edition-location').value,
                program: program,
                speakers: speakers
            };
            
            const editionIdToSave = this.activeEditionId === 'new' ? undefined : this.activeEditionId;
            const { error: editionError } = await this.supabase
                .from('event_editions')
                .upsert(editionIdToSave ? { id: editionIdToSave, ...editionUpdates } : editionUpdates);
                
            if (editionError) {
                console.error("Error saving edition:", editionError);
                alert("Se guardó el evento principal, pero hubo un error al guardar la edición.");
            }
        }
        
        alert("¡Guardado con éxito!");
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
        
        await this.loadEventData();
        editionEditor.style.display = 'none';
    },

    async deleteEdition(editionId) {
        if (!confirm("¿Estás seguro de que quieres borrar esta edición?")) return;
        
        const { error } = await this.supabase.from('event_editions').delete().eq('id', editionId);
        if (error) { alert("Error al borrar la edición."); } 
        else {
            this.currentEditions = this.currentEditions.filter(ed => ed.id !== editionId);
            this.renderEditionsList();
            document.getElementById('edition-editor-container').style.display = 'none';
        }
    },

};

document.addEventListener('DOMContentLoaded', () => EventEditorApp.init());