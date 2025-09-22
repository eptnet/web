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
        // Inicializar Supabase y sesión (sin cambios)
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        // --- LÓGICA DE CARGA CORREGIDA ---
        // Primero, preparamos los listeners y la estructura básica
        this.setupTabEvents();
        this.addEventListeners();

        // Segundo, esperamos a que los editores estén 100% listos
        await this.initializeEditors();

        // Tercero, AHORA SÍ cargamos los datos del evento
        const activeEventString = sessionStorage.getItem('activeEvent');
        if (activeEventString) {
            this.editMode = true;
            this.currentEvent = JSON.parse(activeEventString);
            await this.loadEventData();
        }
    },

    initializeEditors() {
        return new Promise(resolve => {
            let initializedEditors = 0;
            const totalEditors = 2; // Tenemos 2 editores

            const initParams = {
                selector: '#event-about, #event-call-for-papers',
                height: 300,
                setup: (editor) => {
                    editor.on('init', () => {
                        initializedEditors++;
                        if (initializedEditors >= totalEditors) {
                            resolve(); // Resolvemos la promesa cuando ambos estén listos
                        }
                    });
                }
            };
            tinymce.init(initParams);
        });
    },

    async loadEventData() {
        document.getElementById('event-main-title').textContent = this.currentEvent.title;
        document.getElementById('event-title').value = this.currentEvent.title;
        document.getElementById('event-cover-url').value = this.currentEvent.cover_url || '';
        document.getElementById('event-registration-url').value = this.currentEvent.registration_url || '';
        document.getElementById('event-is-public').checked = this.currentEvent.is_public;

        // --- CORRECCIÓN CLAVE: Acceso seguro a los datos ---
        const content = this.currentEvent.main_content || {}; // Si 'main_content' no existe, usamos un objeto vacío.
        document.getElementById('event-seo-image-url').value = content.seo?.imageUrl || '';
        
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

    // VERSIÓN ACTUALIZADA PARA openEditionEditor CON CHECKBOXES
async openEditionEditor(editionData = null) {
    this.activeEditionId = editionData ? editionData.id : 'new';
    this.renderEditionsList();

    const container = document.getElementById('edition-editor-container');
    container.style.display = 'block';

    console.log('Buscando sesiones para el user_id:', this.user.id);

    const { data: allSessions, error } = await this.supabase
        .from('sessions')
        .select('id, session_title')
        .eq('user_id', this.user.id);

    if (error) {
        console.error("Error al buscar sesiones:", error.message);
    }
    
    // --- CAMBIO CLAVE: Creamos checkboxes en lugar de <option> ---
    let sessionsCheckboxesHTML = (allSessions || []).map(session => `
        <div class="checkbox-item">
            <input type="checkbox" id="session-${session.id}" name="associated_session" value="${session.id}">
            <label for="session-${session.id}">${session.session_title}</label>
        </div>
    `).join('');

    // El HTML del contenedor principal ahora usa un div para los checkboxes.
    container.innerHTML = `
        <fieldset>
            <legend>${editionData ? `Editando: ${editionData.edition_name}` : 'Nueva Edición'}</legend>
            <div class="form-group"><label>Nombre de la Edición</label><input type="text" id="edition-name" value="${editionData?.edition_name || ''}" required></div>
            <div class="form-group-grid">
                <div><label>Fecha de Inicio</label><input type="date" id="edition-start-date" value="${editionData?.start_date || ''}"></div>
                <div><label>Fecha de Fin</label><input type="date" id="edition-end-date" value="${editionData?.end_date || ''}"></div>
            </div>
            <div class="form-group"><label>Lugar</label><input type="text" id="edition-location" value="${editionData?.location || ''}"></div>
        </fieldset>
        <fieldset>
            <legend><i class="fa-solid fa-users"></i> Ponentes</legend>
            <div id="speakers-list-container" class="item-list-editor"></div>
            <button type="button" class="btn-add-item" id="add-speaker-btn"><i class="fa-solid fa-plus"></i> Añadir Ponente</button>
        </fieldset>
        <fieldset>
            <legend><i class="fa-solid fa-list-check"></i> Programa</legend>
            <div id="program-items-container" class="item-list-editor"></div>
            <button type="button" class="btn-add-item" id="add-program-item-btn"><i class="fa-solid fa-plus"></i> Añadir al Programa</button>
        </fieldset>
        <fieldset>
            <legend><i class="fa-solid fa-podcast"></i> Sesiones de LiveRoom Asociadas</legend>
            <p class="form-hint">Marca todas las sesiones que quieres mostrar en la página del evento.</p>
            <div class="checkbox-list-container">${sessionsCheckboxesHTML}</div>
        </fieldset>
    `;

    if (allSessions?.length === 0) {
        container.querySelector('.checkbox-list-container').innerHTML = '<p class="form-hint" style="color: #E11D48;">No se encontraron sesiones de LiveRoom para este usuario.</p>';
    }

    // --- CAMBIO CLAVE: Lógica para marcar los checkboxes guardados ---
    if (editionData && editionData.selected_sessions) {
        editionData.selected_sessions.forEach(sessionId => {
            const checkbox = container.querySelector(`input[name="associated_session"][value="${sessionId}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }
    
    (editionData?.speakers || []).forEach(speaker => this.addSpeakerFields(container.querySelector('#speakers-list-container'), speaker));
    (editionData?.program || []).forEach(item => this.addProgramItemFields(container.querySelector('#program-items-container'), item));
    
    container.querySelector('#add-program-item-btn').addEventListener('click', () => this.addProgramItemFields(container.querySelector('#program-items-container'), {}));
    container.querySelector('#add-speaker-btn').addEventListener('click', () => this.addSpeakerFields(container.querySelector('#speakers-list-container')));
},

    // VERSIÓN ACTUALIZADA PARA handleSave LEYENDO CHECKBOXES
    async handleSave() {
        const saveButton = document.getElementById('save-event-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        // ... (El código para guardar el evento principal no cambia)
        tinymce.triggerSave();
        const eventUpdates = {
            title: document.getElementById('event-title').value,
            cover_url: document.getElementById('event-cover-url').value,
            registration_url: document.getElementById('event-registration-url').value,
            is_public: document.getElementById('event-is-public').checked,
            main_content: {
                about: tinymce.get('event-about').getContent(),
                callForPapers: tinymce.get('event-call-for-papers').getContent(),
                seo: { imageUrl: document.getElementById('event-seo-image-url').value }
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

        const editionEditor = document.getElementById('edition-editor-container');
        let editionError = null; 

        if (editionEditor.style.display === 'block' && this.activeEditionId) {
            const program = Array.from(document.querySelectorAll('#program-items-container .item-fieldset')).map(el => ({
                date: el.querySelector('.program-item-date').value || null,
                startTime: el.querySelector('.program-item-start-time').value,
                endTime: el.querySelector('.program-item-end-time').value,
                title: el.querySelector('.program-item-title').value,
                speaker_name: el.querySelector('.program-item-speaker').value,
                itemCoverUrl: el.querySelector('.program-item-cover-url').value,
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
            
            // --- CAMBIO CLAVE: Leemos los valores de los checkboxes marcados ---
            const selectedSessions = Array.from(document.querySelectorAll('input[name="associated_session"]:checked'))
                                        .map(checkbox => Number(checkbox.value));

            const editionDataToSave = {
                event_id: this.currentEvent.id,
                edition_name: document.getElementById('edition-name').value,
                start_date: document.getElementById('edition-start-date').value || null,
                end_date: document.getElementById('edition-end-date').value || null,
                location: document.getElementById('edition-location').value,
                program: program,
                speakers: speakers,
                selected_sessions: selectedSessions
            };

            if (this.activeEditionId !== 'new') {
                editionDataToSave.id = this.activeEditionId;
            }

            const { error } = await this.supabase
                .from('event_editions')
                .upsert([editionDataToSave]); 
            
            editionError = error; 
        }
        
        if (editionError) {
            console.error("Error saving edition:", editionError);
            alert("Se guardó el evento principal, pero hubo un error al guardar la edición.");
        } else {
            alert("¡Guardado con éxito!");
        }

        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
        
        await this.loadEventData();
        if (editionEditor) editionEditor.style.display = 'none';
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

    addProgramItemFields(container, data = {}) {
        const itemId = `program-${Date.now()}`;
        const fieldset = document.createElement('fieldset');
        fieldset.classList.add('item-fieldset');

        const speakerNameInputs = document.querySelectorAll('#speakers-list-container .speaker-name');
        const speakerNames = Array.from(speakerNameInputs).map(input => input.value).filter(name => name.trim() !== '');

        let dynamicAuthorsOptions = '<option value="">Seleccionar ponente...</option>';
        dynamicAuthorsOptions += speakerNames.map(name => `<option value="${name}">${name}</option>`).join('');

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
                <select id="speaker-${itemId}" class="program-item-speaker">${dynamicAuthorsOptions}</select>
            </div>
            <div class="form-group">
                <label for="item-cover-url-${itemId}">URL de la Imagen de Portada de la Ponencia</label>
                <input type="url" id="item-cover-url-${itemId}" class="program-item-cover-url" placeholder="https://..." value="${data.itemCoverUrl || ''}">
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
        
        // --- LÓGICA DE SINCRONIZACIÓN AÑADIDA ---
        // Cuando el usuario escriba en el campo de nombre, actualizamos los desplegables.
        fieldset.querySelector('.speaker-name').addEventListener('input', () => {
            this.updateSpeakerOptionsInProgram();
        });

        // Cuando se borre un ponente, también actualizamos los desplegables.
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => {
            fieldset.remove();
            this.updateSpeakerOptionsInProgram();
        });
    },

    async handleSave() {
        const saveButton = document.getElementById('save-event-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        // 1. Guardar datos del evento principal
        tinymce.triggerSave();
        const eventUpdates = {
            title: document.getElementById('event-title').value,
            cover_url: document.getElementById('event-cover-url').value,
            registration_url: document.getElementById('event-registration-url').value,
            is_public: document.getElementById('event-is-public').checked,
            main_content: {
                about: tinymce.get('event-about').getContent(),
                callForPapers: tinymce.get('event-call-for-papers').getContent(),
                seo: { imageUrl: document.getElementById('event-seo-image-url').value }
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
        let editionError = null; 

        if (editionEditor.style.display === 'block' && this.activeEditionId) {
            const program = Array.from(document.querySelectorAll('#program-items-container .item-fieldset')).map(el => ({
                date: el.querySelector('.program-item-date').value || null,
                startTime: el.querySelector('.program-item-start-time').value,
                endTime: el.querySelector('.program-item-end-time').value,
                title: el.querySelector('.program-item-title').value,
                speaker_name: el.querySelector('.program-item-speaker').value,
                itemCoverUrl: el.querySelector('.program-item-cover-url').value,
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
            // Convierte los valores a números para que coincida con `bigint`
            const selectedSessions = Array.from(document.getElementById('edition-selected-sessions').selectedOptions).map(opt => Number(opt.value));

            const editionDataToSave = {
                event_id: this.currentEvent.id,
                edition_name: document.getElementById('edition-name').value,
                start_date: document.getElementById('edition-start-date').value || null,
                end_date: document.getElementById('edition-end-date').value || null,
                location: document.getElementById('edition-location').value,
                program: program,
                speakers: speakers,
                selected_sessions: selectedSessions
            };

            if (this.activeEditionId !== 'new') {
                editionDataToSave.id = this.activeEditionId;
            }

            const { error } = await this.supabase
                .from('event_editions')
                .upsert([editionDataToSave]); 
            
            editionError = error; 
        }
        
        // 3. Manejo de mensajes y estado final
        if (editionError) {
            console.error("Error saving edition:", editionError);
            alert("Se guardó el evento principal, pero hubo un error al guardar la edición.");
        } else {
            alert("¡Guardado con éxito!");
        }

        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
        
        await this.loadEventData();
        if (editionEditor) editionEditor.style.display = 'none';
    },

    updateSpeakerOptionsInProgram() {
        // 1. Obtenemos todos los nombres de los ponentes que se han añadido hasta ahora.
        const speakerNameInputs = document.querySelectorAll('#speakers-list-container .speaker-name');
        const speakerNames = Array.from(speakerNameInputs).map(input => input.value).filter(name => name.trim() !== '');

        // 2. Creamos el HTML para las opciones del desplegable.
        let authorsOptions = '<option value="">Seleccionar ponente...</option>';
        authorsOptions += speakerNames.map(name => `<option value="${name}">${name}</option>`).join('');

        // 3. Actualizamos TODOS los desplegables de ponentes en el programa.
        const speakerSelects = document.querySelectorAll('.program-item-speaker');
        speakerSelects.forEach(select => {
            const currentValue = select.value; // Guardamos el valor actual para no perderlo
            select.innerHTML = authorsOptions;
            select.value = currentValue; // Intentamos re-seleccionar el valor anterior
        });
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