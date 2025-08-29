// =================================================================
// ARCHIVO DEFINITIVO Y CORREGIDO v3: /inv/js/microsite-editor.js
// AÑADE CARGA DE DATOS RELACIONADOS (INVESTIGADORES, SESIONES, POSTS)
// =================================================================

const MicrositeEditorApp = {
    supabase: null,
    user: null,
    currentProject: null,

    async init() {
        // 1. INICIALIZAR SUPABASE Y VERIFICAR SESIÓN
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            this.showError('No has iniciado sesión. Por favor, <a href="/">inicia sesión</a> y vuelve a intentarlo.');
            return;
        }
        this.user = session.user;

        // 2. OBTENER EL PROYECTO ACTIVO DESDE sessionStorage
        const activeProjectString = sessionStorage.getItem('activeProject');
        if (!activeProjectString) {
            this.showError('No se ha seleccionado ningún proyecto. Por favor, vuelve al <a href="/inv/dashboard.html">Dashboard</a> y elige un proyecto.');
            return;
        }
        this.currentProject = JSON.parse(activeProjectString);

        // 3. Cargamos los datos del microsite y los datos relacionados
        await this.loadMicrositeData();
        // Una vez que tenemos los datos del proyecto, cargamos el resto
        await this.loadRelatedData();

        // 4. Inicializamos el editor de texto y los listeners
        this.initializeEditor();
        this.setupEventListeners();
    },

    // --- NUEVA FUNCIÓN PARA CARGAR DATOS RELACIONADOS ---
    async loadRelatedData() {
        const [researchers, sessions, posts] = await Promise.all([
            this.fetchResearchers(),
            this.fetchSessions(),
            this.fetchPosts() // <-- Esta función cambia
        ]);
        this.renderResearchers(researchers);
        this.renderSessions(sessions);
        this.renderPosts(posts); // <-- Esta función cambia
    },

    // --- NUEVAS FUNCIONES DE FETCH ---
    async fetchResearchers() {
        if (!this.currentProject.authors || this.currentProject.authors.length === 0) return [];
        // Buscamos perfiles que coincidan con los nombres en el array de autores del proyecto
        const { data, error } = await this.supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .in('display_name', this.currentProject.authors);
        if (error) console.error("Error fetching researchers:", error);
        return data || [];
    },

    async fetchSessions() {
        // Añadimos el 'id' a la selección
        const { data, error } = await this.supabase
            .from('sessions')
            .select('id, session_title, scheduled_at, thumbnail_url')
            .eq('project_title', this.currentProject.title);
        if (error) console.error("Error fetching sessions:", error);
        return data || [];
    },

    async fetchPosts() {
        // CORRECCIÓN: Ahora consultamos la tabla 'posts'
        const { data, error } = await this.supabase
            .from('posts')
            .select('title, status')
            .eq('project_id', this.currentProject.id);
        if (error) { console.error("Error fetching posts:", error); return []; }
        return data || [];
    },

    // --- NUEVAS FUNCIONES DE RENDER ---
    renderResearchers(profiles) {
        const container = document.getElementById('researchers-preview-container');
        const authorNames = this.currentProject.authors || [];
        if (authorNames.length === 0) {
            container.innerHTML = '<p>No hay autores definidos en este proyecto.</p>';
            return;
        }

        container.innerHTML = authorNames.map(name => {
            const profile = profiles.find(p => p.display_name === name);
            const avatarUrl = profile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'; // Avatar por defecto
            return `
                <div class="preview-card researcher-card">
                    <img src="${avatarUrl}" alt="Avatar de ${name}">
                    <h5>${name}</h5>
                </div>
            `;
        }).join('');
    },

    renderSessions(sessions) {
        const container = document.getElementById('sessions-preview-container');
        if (!sessions || sessions.length === 0) { container.innerHTML = '<p>No hay sesiones asociadas.</p>'; return; }
        
        // Construimos la URL del evento de la misma forma que en la página pública
        container.innerHTML = sessions.map(s => `
            <a href="/live.html?sesion=${s.id}" target="_blank" class="card session-card" style="text-decoration:none; color:inherit;">
                <img src="${s.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Miniatura" style="width:100%; height:100px; object-fit:cover; border-radius: 8px 8px 0 0;">
                <div style="padding:1rem;">
                    <h5 style="margin:0;">${s.session_title}</h5>
                </div>
            </a>
        `).join('');
    },

    renderPosts(posts) {
        // CORRECCIÓN: Adaptamos el renderizado a los datos de la tabla 'posts'
        const container = document.getElementById('posts-preview-container');
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p>No hay publicaciones asociadas a este proyecto.</p>';
            return;
        }
        container.innerHTML = posts.map(post => `
            <div class="preview-card">
                <h5>${post.title}</h5>
                <p>Estado: ${post.status}</p>
            </div>
        `).join('');
    },

    /**
     * Muestra un mensaje de error en el panel de edición.
     */
    showError(message) {
        const editorPanel = document.querySelector('.editor-panel');
        if (editorPanel) {
            editorPanel.innerHTML = `<h1>Error</h1><p>${message}</p>`;
        }
    },

    /**
     * Carga los datos del microsite desde Supabase.
     */
    async loadMicrositeData() {
        const { data, error } = await this.supabase
            .from('projects')
            .select('microsite_content, microsite_is_public')
            .eq('id', this.currentProject.id)
            .eq('user_id', this.user.id) // ¡Importante! Aseguramos que el proyecto pertenezca al usuario
            .single();

        if (error) {
            console.error("Error al cargar datos del microsite:", error);
            alert("No se pudieron cargar los datos del microsite. Es posible que no tengas permiso para editar este proyecto.");
            return;
        }
        
        this.currentProject.microsite_content = data.microsite_content;
        this.currentProject.microsite_is_public = data.microsite_is_public;
        this.populateForm();
    },

    /**
     * Rellena el formulario con los datos cargados.
     */
    populateForm() {
        const content = this.currentProject.microsite_content || {};
        document.getElementById('cover-headline').value = content.cover?.headline || `Un microsite para: ${this.currentProject.title}`;
        document.getElementById('cover-image-url').value = content.cover?.imageUrl || '';
        document.getElementById('seo-image-url').value = content.seo?.imageUrl || '';
        document.getElementById('summary-content').value = content.summary?.content || this.currentProject.description || '';
        document.getElementById('microsite-is-public').checked = this.currentProject.microsite_is_public || false; 
        document.getElementById('template-style-select').value = this.currentProject.template_style || 'classic';
        document.getElementById('color-palette-select').value = this.currentProject.color_palette || 'default';
        
        const modulesContainer = document.getElementById('custom-modules-container');
        modulesContainer.innerHTML = '';
        if (content.custom_modules && Array.isArray(content.custom_modules)) {
            content.custom_modules.forEach(moduleData => {
                this.createModule(moduleData.type, moduleData);
            });
        }
    },

    /**
     * Inicializa el editor TinyMCE.
     */
    initializeEditor() {
        tinymce.init({
            selector: '.tinymce-editor',
            plugins: 'autolink lists link image charmap preview anchor pagebreak',
            toolbar_mode: 'floating',
            height: 200,
            placeholder: 'Explica tu proyecto de forma sencilla...'
        });
    },

    /**
     * Configura todos los listeners de la página.
     */
    setupEventListeners() {
        const form = document.getElementById('microsite-form');
        const addTextModuleBtn = document.getElementById('add-text-module-btn');
        const addEmbedModuleBtn = document.getElementById('add-embed-module-btn');
        const previewBtn = document.getElementById('preview-btn');
        const addSubscriptionModuleBtn = document.getElementById('add-subscription-module-btn');
        const addSponsorsModuleBtn = document.getElementById('add-sponsors-module-btn'); 
        const addTimelineModuleBtn = document.getElementById('add-timeline-module-btn'); 

        
        if (addTextModuleBtn) addTextModuleBtn.addEventListener('click', () => this.createModule('text'));
        if (addEmbedModuleBtn) addEmbedModuleBtn.addEventListener('click', () => this.createModule('embed'));
        if (addSubscriptionModuleBtn) addSubscriptionModuleBtn.addEventListener('click', () => this.createModule('subscription')); 
        if (addSponsorsModuleBtn) addSponsorsModuleBtn.addEventListener('click', () => this.createModule('sponsors')); 
        if (addTimelineModuleBtn) addTimelineModuleBtn.addEventListener('click', () => this.createModule('timeline')); 
        if (form) form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        document.querySelectorAll('.ai-button').forEach(button => {
            button.addEventListener('click', () => alert('✨ ¡Función de IA en desarrollo!'));
        });

        // --- INICIO DE LA LÓGICA AÑADIDA ---
            if (previewBtn) {
                previewBtn.addEventListener('click', () => {
                    if (!this.currentProject || !this.currentProject.slug) {
                        alert("El proyecto no tiene un slug generado para previsualizar.");
                        return;
                    }

                    // CORRECCIÓN: Codificamos el slug para que sea seguro en una URL
                    const safeSlug = encodeURIComponent(this.currentProject.slug);
                    const publicUrl = `/site.html?slug=${safeSlug}`;
                    
                    window.open(publicUrl, '_blank');
                });
            }
        },

    /**
     * Crea un nuevo módulo de contenido en el DOM.
     */
    createModule(type, initialData = null) {
        const modulesContainer = document.getElementById('custom-modules-container');
        const moduleId = initialData ? initialData.id : `module-${Date.now()}`;
        const moduleCard = document.createElement('div');
        moduleCard.classList.add('module-card');
        moduleCard.setAttribute('data-module-id', moduleId);
        moduleCard.setAttribute('data-module-type', type);
        let contentHtml = '';
        let headerTitle = 'Módulo';
        const data = initialData || {};

        if (type === 'text') {
            headerTitle = 'Módulo de Texto';
            contentHtml = `
                <label for="title-${moduleId}">Título del Módulo:</label>
                <input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Metodología..." value="${initialData?.title || ''}">
                <label for="content-${moduleId}" style="margin-top:10px;">Contenido:</label>
                <textarea id="content-${moduleId}" class="module-content" placeholder="Desarrolla el contenido...">${initialData?.content || ''}</textarea>
            `;
        } else if (type === 'embed') {
            headerTitle = 'Módulo de Enlace/Embed';
            contentHtml = `
                <label for="title-${moduleId}">Título del Módulo:</label>
                <input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Video Explicativo..." value="${initialData?.title || ''}">
                <label for="url-${moduleId}" style="margin-top:10px;">URL para incrustar:</label>
                <input type="text" id="url-${moduleId}" class="module-content" placeholder="Pega un enlace de YouTube, Substack (embed), etc." value="${initialData?.content || ''}">
            `;
        } else if (type === 'subscription') { // --- NUEVA LÓGICA ---
            headerTitle = 'Módulo de Suscripción';
            const data = initialData || {};
            contentHtml = `
                <label for="title-${moduleId}">Título (ej: "Suscríbete a nuestro boletín"):</label>
                <input type="text" id="title-${moduleId}" class="module-title" value="${data.title || ''}">
                
                <label for="text-${moduleId}" style="margin-top:10px;">Texto descriptivo:</label>
                <textarea id="text-${moduleId}" class="module-text" rows="3">${data.text || ''}</textarea>
                
                <label for="url-${moduleId}" style="margin-top:10px;">Enlace de Suscripción (ej: URL de Substack):</label>
                <input type="text" id="url-${moduleId}" class="module-url" value="${data.url || ''}">
            `;
        }
        // --- NUEVA LÓGICA PARA PATROCINADORES ---
        else if (type === 'sponsors') {
            headerTitle = 'Módulo de Patrocinadores';
            contentHtml = `
                <label for="title-${moduleId}">Título de la sección (ej: "Con el apoyo de"):</label>
                <input type="text" id="title-${moduleId}" class="module-title" value="${data.title || ''}">
                <div id="sponsors-list-${moduleId}" class="sponsors-list-editor">
                    </div>
                <button type="button" class="btn-add-item"><i class="fa-solid fa-plus"></i> Añadir Patrocinador</button>
            `;
        }
        // --- NUEVA LÓGICA PARA TIMELINE ---
        else if (type === 'timeline') {
            headerTitle = 'Módulo de Timeline';
            contentHtml = `
                <label for="title-${moduleId}">Título de la sección (ej: "Hitos de la Investigación"):</label>
                <input type="text" id="title-${moduleId}" class="module-title" value="${data.title || ''}">
                <div id="timeline-list-${moduleId}" class="timeline-list-editor">
                    </div>
                <button type="button" class="btn-add-item"><i class="fa-solid fa-plus"></i> Añadir Hito</button>
            `;
        }

        moduleCard.innerHTML = `
            <div class="module-header"><h4>${headerTitle}</h4><div class="module-card-actions"><button type="button" class="delete-module-btn" title="Eliminar Módulo"><i class="fa-solid fa-trash"></i></button></div></div>
            ${contentHtml}
        `;
        modulesContainer.appendChild(moduleCard);
        moduleCard.querySelector('.delete-module-btn').addEventListener('click', () => moduleCard.remove());
        
        // Si es un módulo de patrocinadores, configuramos su lógica interna
        if (type === 'sponsors') {
            const sponsorsListContainer = moduleCard.querySelector('.sponsors-list-editor');
            const addSponsorBtn = moduleCard.querySelector('.btn-add-item');
            
            addSponsorBtn.addEventListener('click', () => this.addSponsorFields(sponsorsListContainer));
            
            // Si estamos cargando datos existentes, los renderizamos
            if (data.sponsors && data.sponsors.length > 0) {
                data.sponsors.forEach(sponsor => this.addSponsorFields(sponsorsListContainer, sponsor));
            }
        }
        // Si es un módulo de timeline, configuramos su lógica interna
        if (type === 'timeline') {
            const milestonesListContainer = moduleCard.querySelector('.timeline-list-editor');
            const addMilestoneBtn = moduleCard.querySelector('.btn-add-item');
            
            addMilestoneBtn.addEventListener('click', () => this.addTimelineMilestoneFields(milestonesListContainer));
            
            if (data.milestones && data.milestones.length > 0) {
                data.milestones.forEach(milestone => this.addTimelineMilestoneFields(milestonesListContainer, milestone));
            }
        }
    },

    addSponsorFields(container, data = {}) {
        const sponsorId = `sponsor-${Date.now()}`;
        const fieldset = document.createElement('fieldset');
        fieldset.classList.add('item-fieldset');
        fieldset.innerHTML = `
            <legend>Patrocinador</legend>
            <button type="button" class="btn-remove-item">&times;</button>
            <label for="logo-${sponsorId}">URL del Logo:</label>
            <input type="text" id="logo-${sponsorId}" class="sponsor-logo-url" value="${data.logoUrl || ''}">
            <label for="url-${sponsorId}">URL del Sitio Web:</label>
            <input type="text" id="url-${sponsorId}" class="sponsor-site-url" value="${data.siteUrl || ''}">
        `;
        container.appendChild(fieldset);
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => fieldset.remove());
    },

    addTimelineMilestoneFields(container, data = {}) {
        const milestoneId = `milestone-${Date.now()}`;
        const fieldset = document.createElement('fieldset');
        fieldset.classList.add('item-fieldset');
        fieldset.innerHTML = `
            <legend>Hito</legend>
            <button type="button" class="btn-remove-item">&times;</button>
            <label for="date-${milestoneId}">Fecha o Periodo (ej: "Q1 2024"):</label>
            <input type="text" id="date-${milestoneId}" class="milestone-date" value="${data.date || ''}">
            <label for="title-${milestoneId}">Título del Hito:</label>
            <input type="text" id="title-${milestoneId}" class="milestone-title" value="${data.title || ''}">
            <label for="desc-${milestoneId}">Descripción:</label>
            <textarea id="desc-${milestoneId}" class="milestone-description" rows="3">${data.description || ''}</textarea>
        `;
        container.appendChild(fieldset);
        fieldset.querySelector('.btn-remove-item').addEventListener('click', () => fieldset.remove());
    },

    /**
     * Recopila los datos del formulario y los guarda en Supabase.
     */
    async handleFormSubmit(event) {
        event.preventDefault();
        tinymce.triggerSave();
        const saveButton = document.getElementById('save-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        
        const micrositeData = {
            cover: {
                headline: document.getElementById('cover-headline').value,
                imageUrl: document.getElementById('cover-image-url').value,
            },
            seo: {
                imageUrl: document.getElementById('seo-image-url').value,
            },
            summary: {
                content: document.getElementById('summary-content').value,
            },
            custom_modules: []
        };

        document.querySelectorAll('#custom-modules-container .module-card').forEach(moduleEl => {
            const moduleType = moduleEl.dataset.moduleType;
            let moduleData = {
                id: moduleEl.dataset.moduleId,
                type: moduleType,
                title: moduleEl.querySelector('.module-title').value,
            };

            if (moduleType === 'text' || moduleType === 'embed') {
                moduleData.content = moduleEl.querySelector('.module-content').value;
            } else if (moduleType === 'subscription') { // --- NUEVA LÓGICA ---
                moduleData.text = moduleEl.querySelector('.module-text').value;
                moduleData.url = moduleEl.querySelector('.module-url').value;
            }
            else if (moduleType === 'sponsors') {
                moduleData.sponsors = [];
                moduleEl.querySelectorAll('.item-fieldset').forEach(sponsorEl => {
                    moduleData.sponsors.push({
                        logoUrl: sponsorEl.querySelector('.sponsor-logo-url').value,
                        siteUrl: sponsorEl.querySelector('.sponsor-site-url').value
                    });
                });
            }
            else if (moduleType === 'timeline') {
                moduleData.milestones = [];
                moduleEl.querySelectorAll('.item-fieldset').forEach(milestoneEl => {
                    moduleData.milestones.push({
                        date: milestoneEl.querySelector('.milestone-date').value,
                        title: milestoneEl.querySelector('.milestone-title').value,
                        description: milestoneEl.querySelector('.milestone-description').value
                    });
                });
            }
            micrositeData.custom_modules.push(moduleData);
        });

        const isPublic = document.getElementById('microsite-is-public').checked;
        const templateStyle = document.getElementById('template-style-select').value;
        const colorPalette = document.getElementById('color-palette-select').value; 

        const { error } = await this.supabase
            .from('projects')
            .update({ 
                microsite_content: micrositeData, 
                microsite_is_public: isPublic, 
                template_style: templateStyle, 
                color_palette: colorPalette
            })
            .eq('id', this.currentProject.id);
        if (error) {
            console.error("Error al guardar:", error);
            alert("Hubo un error al guardar. Revisa la consola.");
        } else {
            alert("¡Microsite guardado con éxito!");
        }
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cambios';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    MicrositeEditorApp.init();
});