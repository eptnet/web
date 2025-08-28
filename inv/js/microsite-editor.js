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
        
        // --- LÍNEA AÑADIDA ---
        // Una vez que tenemos los datos del proyecto, cargamos el resto
        await this.loadRelatedData();

        // 4. Inicializamos el editor de texto y los listeners
        this.initializeEditor();
        this.setupEventListeners();
    },

    // --- NUEVA FUNCIÓN PARA CARGAR DATOS RELACIONADOS ---
    async loadRelatedData() {
        // Usamos Promise.all para hacer todas las peticiones a la vez y mejorar el rendimiento
        const [researchers, sessions, posts] = await Promise.all([
            this.fetchResearchers(),
            this.fetchSessions(),
            this.fetchPosts()
        ]);

        this.renderResearchers(researchers);
        this.renderSessions(sessions);
        this.renderPosts(posts);
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
        // Asumimos que las sesiones se vinculan con un 'project_id'
        const { data, error } = await this.supabase
            .from('sessions')
            .select('session_title, scheduled_at')
            .eq('project_id', this.currentProject.id);
        if (error) console.error("Error fetching sessions:", error);
        return data || [];
    },
    async fetchPosts() {
        const { data, error } = await this.supabase
            .from('posts')
            .select('title, status, updated_at')
            .eq('project_id', this.currentProject.id);
        if (error) console.error("Error fetching posts:", error);
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
        if (sessions.length === 0) {
            container.innerHTML = '<p>No hay sesiones asociadas a este proyecto.</p>';
            return;
        }
        container.innerHTML = sessions.map(session => {
            const date = new Date(session.scheduled_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            return `
                <div class="preview-card">
                    <h5>${session.session_title}</h5>
                    <p>🗓️ ${date}</p>
                </div>
            `;
        }).join('');
    },
    renderPosts(posts) {
        const container = document.getElementById('posts-preview-container');
        if (posts.length === 0) {
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
        document.getElementById('summary-content').value = content.summary?.content || this.currentProject.description || '';
        document.getElementById('microsite-is-public').checked = this.currentProject.microsite_is_public || false;
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
        const previewBtn = document.getElementById('preview-btn'); // Obtenemos el botón de vista previa

        if (addTextModuleBtn) addTextModuleBtn.addEventListener('click', () => this.createModule('text'));
        if (addEmbedModuleBtn) addEmbedModuleBtn.addEventListener('click', () => this.createModule('embed'));
        if (form) form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        document.querySelectorAll('.ai-button').forEach(button => {
            button.addEventListener('click', () => alert('✨ ¡Función de IA en desarrollo!'));
        });

        // --- INICIO DE LA LÓGICA AÑADIDA ---
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                if (!this.currentProject || !this.currentProject.id) {
                    alert("No se ha cargado ningún proyecto para previsualizar.");
                    return;
                }

                // Construimos la URL apuntando a la raíz del sitio
                const publicUrl = `/site.html?id=${this.currentProject.id}`;
                
                // Abrimos la URL en una nueva pestaña
                window.open(publicUrl, '_blank');
            });
        }
        // --- FIN DE LA LÓGICA AÑADIDA ---
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
        if (type === 'text') {
            contentHtml = `<label for="title-${moduleId}">Título del Módulo:</label><input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Metodología..." value="${initialData?.title || ''}"><label for="content-${moduleId}" style="margin-top:10px;">Contenido:</label><textarea id="content-${moduleId}" class="module-content" placeholder="Desarrolla el contenido...">${initialData?.content || ''}</textarea>`;
        } else if (type === 'embed') {
            contentHtml = `<label for="title-${moduleId}">Título del Módulo:</label><input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Video Explicativo..." value="${initialData?.title || ''}"><label for="url-${moduleId}" style="margin-top:10px;">URL para incrustar:</label><input type="text" id="url-${moduleId}" class="module-content" placeholder="Pega un enlace de YouTube, etc." value="${initialData?.content || ''}">`;
        }
        moduleCard.innerHTML = `<div class="module-header"><h4>Módulo de ${type === 'text' ? 'Texto' : 'Enlace'}</h4><div class="module-card-actions"><button type="button" class="delete-module-btn" title="Eliminar Módulo"><i class="fa-solid fa-trash"></i></button></div></div>${contentHtml}`;
        modulesContainer.appendChild(moduleCard);
        moduleCard.querySelector('.delete-module-btn').addEventListener('click', () => moduleCard.remove());
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
            cover: { headline: document.getElementById('cover-headline').value, imageUrl: document.getElementById('cover-image-url').value },
            summary: { content: document.getElementById('summary-content').value },
            custom_modules: []
        };
        document.querySelectorAll('#custom-modules-container .module-card').forEach(moduleEl => {
            micrositeData.custom_modules.push({
                id: moduleEl.dataset.moduleId,
                type: moduleEl.dataset.moduleType,
                title: moduleEl.querySelector('.module-title').value,
                content: moduleEl.querySelector('.module-content').value
            });
        });
        const isPublic = document.getElementById('microsite-is-public').checked;
        const { error } = await this.supabase.from('projects').update({ microsite_content: micrositeData, microsite_is_public: isPublic }).eq('id', this.currentProject.id);
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