// =================================================================
// ARCHIVO COMPLETO: /inv/js/editor.js (Versión Definitiva 2.0)
// =================================================================

const agentPrompts = {
    'text': {
        label: 'Redactar Artículo de Divulgación',
        prompt: 'Actúa como un experto en comunicación científica. Usando el texto base proporcionado, redacta un artículo de entre 500 y 800 palabras. El tono debe ser de divulgación: accesible para un público general pero manteniendo el rigor científico. Estructura el contenido con un título atractivo, una introducción, subtítulos claros para los apartados y un párrafo de conclusión.'
    },
    'social': {
        label: 'Crear Hilo para Redes Sociales',
        prompt: 'Actúa como un community manager científico. Genera un hilo de 3 a 5 tweets (o posts para LinkedIn) sobre el texto base. El primer post debe ser un gancho potente. Los siguientes deben desarrollar la idea de forma concisa. El último debe incluir un llamado a la acción o una pregunta para generar debate. Usa hashtags relevantes.'
    },
    'script': {
        label: 'Desarrollar Guion para Video Corto',
        prompt: 'Actúa como guionista de contenido educativo. Desarrolla un guion para un video corto (formato reel/short de ~60 segundos). Estructura el guion en tres partes claras: 1) Un gancho inicial de 10 segundos que plantee una pregunta o dato sorprendente. 2) El desarrollo del tema principal de forma muy visual y directa. 3) Un cierre que resuma la idea y pida al espectador que comente o siga la cuenta.'
    },
    'summary': {
        label: 'Crear Resumen (Abstract)',
        prompt: 'Actúa como un comunicador científico. Crea un resumen conciso y técnico (máximo 150 palabras) del siguiente texto, adecuado para un abstract o entradilla de una publicación formal.'
    },
    'event': {
        label: 'Redactar Invitación a Evento',
        prompt: 'Actúa como organizador de eventos académicos. Redacta un email de invitación formal pero cercano para un evento (virtual, presencial o híbrido). El texto debe ser claro e incluir campos evidentes para [Nombre del Evento], [Fecha y Hora], [Lugar o Enlace de Conexión], [Breve descripción del propósito] y [Nombre del Ponente o Anfitrión]. Anima a los destinatarios a registrarse o confirmar su asistencia.'
    }
};

const EditorApp = {
    supabase: null,
    editorInstance: null,
    currentPost: { id: null, projectId: null },
    userId: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.userId = session.user.id;
        
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        const postId = urlParams.get('postId');
        const agent = urlParams.get('agent');

        if (!projectId && !postId) {
            document.querySelector('.main-content').innerHTML = '<h2>Error de Contexto</h2><p>No se ha especificado un proyecto o borrador. Vuelve al dashboard.</p>';
            return;
        }

        await this.initializeEditor();
        this.populateAgentDropdown();
        this.addEventListeners();

        if (postId) {
            await this.loadPost(postId);
        } else if (projectId) {
            this.currentPost.projectId = projectId;
            await this.loadProjectData(projectId);
            await this.loadDraftsList(projectId);
        }

        if (agent && agentPrompts[agent]) {
            const dropdown = document.getElementById('ai-task-dropdown');
            const promptTextarea = document.getElementById('ai-custom-prompt');
            
            dropdown.value = agent; // Seleccionamos la opción en el menú
            promptTextarea.value = agentPrompts[agent].prompt; // Rellenamos el prompt
        }
    },

    async loadDraftsList(projectId) {
        const container = document.getElementById('drafts-list-container');
        if (!container) return;

        const currentPostId = new URLSearchParams(window.location.search).get('postId');

        try {
            // --- INICIO DE LA CORRECIÓN ---
            const [draftsResponse, projectResponse] = await Promise.all([
                // Esta consulta ya estaba bien
                this.supabase.from('posts').select('id, title, updated_at').eq('user_id', this.userId).eq('project_id', projectId).eq('status', 'draft'),
                
                // Aquí cambiamos 'updated_at' por 'created_at' para que coincida con tu tabla
                this.supabase.from('projects').select('title, created_at').eq('id', projectId).single()
            ]);
            // --- FIN DE LA CORRECIÓN ---

            if (draftsResponse.error) throw draftsResponse.error;
            if (projectResponse.error) throw projectResponse.error;
            
            const drafts = draftsResponse.data || [];
            const project = projectResponse.data;

            const projectAsDraft = {
                id: projectId,
                title: `✍️ Proyecto Base: ${project.title}`,
                // Usamos 'created_at' del proyecto, pero lo guardamos en la clave 'updated_at'
                // para que la lógica de ordenamiento por fecha siga funcionando sin problemas.
                updated_at: project.created_at, 
                isProject: true
            };

            const allItems = [projectAsDraft, ...drafts].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

            container.innerHTML = allItems.map(item => {
                const updatedDate = new Date(item.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                
                let isActive = false;
                let href = '';

                if (item.isProject) {
                    isActive = !currentPostId;
                    href = `/inv/editor.html?projectId=${item.id}`;
                } else {
                    isActive = item.id === currentPostId;
                    href = `/inv/editor.html?postId=${item.id}`;
                }

                return `
                    <a href="${href}" class="draft-card ${isActive ? 'active' : ''}">
                        <span class="draft-title">${item.title || 'Borrador sin título'}</span>
                        <span class="draft-date">Últ. ed. ${updatedDate}</span>
                    </a>
                `;
            }).join('');

        } catch (error) {
            container.innerHTML = '<p>Error al cargar la lista de puntos de partida.</p>';
            console.error("Error al unificar borradores y proyecto:", error);
        }
    },
    
    populateAgentDropdown() {
        const dropdown = document.getElementById('ai-task-dropdown');
        if (!dropdown) return;
        Object.keys(agentPrompts).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = agentPrompts[key].label;
            dropdown.appendChild(option);
        });
    },

    addEventListeners() {
        document.getElementById('ai-task-dropdown')?.addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            const promptText = selectedKey ? agentPrompts[selectedKey].prompt : '';
            document.getElementById('ai-custom-prompt').value = promptText;
        });

        document.getElementById('ai-generate-btn')?.addEventListener('click', () => this.callAI('generate_from_instructions'));
        document.getElementById('ai-suggest-titles-btn')?.addEventListener('click', () => this.callAI('suggest_titles'));
        document.getElementById('save-draft-btn')?.addEventListener('click', () => this.saveDraft());
    },

    async loadPost(postId) {
        const { data, error } = await this.supabase.from('posts').select('*, project_id(id)').eq('id', postId).eq('user_id', this.userId).single();
        if (error || !data) { alert('No se pudo cargar el borrador.'); console.error(error); return; }
        
        this.currentPost = { id: data.id, projectId: data.project_id.id };
        document.getElementById('post-title').value = data.title;
        this.editorInstance.setContent(data.content);
        await this.loadDraftsList(data.project_id.id);
    },

    async loadProjectData(projectId) {
        const { data, error } = await this.supabase.from('projects').select('title, description').eq('id', projectId).single();
        if (error) { alert('No se pudieron cargar los datos del proyecto.'); console.error(error); return; }
        document.getElementById('post-title').value = `Borrador basado en: ${data.title}`;
        this.editorInstance.setContent(data.description || '');
    },

    async saveDraft() {
        if (!this.editorInstance || !this.userId || !this.currentPost.projectId) { alert('Error: Falta información de proyecto.'); return; }
        const saveButton = document.getElementById('save-draft-btn');
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const postData = {
                id: this.currentPost.id, 
                project_id: this.currentPost.projectId,
                user_id: this.userId,
                title: document.getElementById('post-title').value,
                content: this.editorInstance.getContent(),
                status: 'draft'
            };
            const { data, error } = await this.supabase.from('posts').upsert(postData).select().single();
            if (error) throw error;
            
            alert('¡Borrador guardado con éxito!');
            if (!this.currentPost.id) {
                window.location.href = `/inv/editor.html?postId=${data.id}`;
            } else {
                this.loadDraftsList(this.currentPost.projectId);
            }
        } catch (error) {
            alert('No se pudo guardar el borrador.');
            console.error('Error al guardar:', error);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = 'Guardar Borrador';
        }
    },
    
    initializeEditor() {
        return new Promise(resolve => {
            tinymce.init({
                selector: '#rich-text-editor',
                plugins: 'lists link image autoresize wordcount',
                toolbar: 'undo redo | blocks | bold italic | bullist numlist | link image',
                autoresize_bottom_margin: 20,
                height: 400,
                skin: document.body.classList.contains('dark-theme') ? 'oxide-dark' : 'oxide',
                content_css: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
                placeholder: 'El contenido de tu proyecto aparecerá aquí como punto de partida...',
                setup: (editor) => { editor.on('init', () => { this.editorInstance = editor; resolve(); }); }
            });
        });
    },

    async callAI(promptType) {
        if (!this.editorInstance) { alert('El editor no está listo.'); return; }
        const textContent = this.editorInstance.getContent({ format: 'text' });
        const customPrompt = document.getElementById('ai-custom-prompt')?.value.trim() || "";

        if (textContent.trim().length < 20) {
            alert('El editor principal debe contener un texto base de al menos 20 caracteres para que la IA trabaje.');
            return;
        }
        if (promptType === 'generate_from_instructions' && customPrompt.length < 20) {
            alert('Las instrucciones para la IA deben tener al menos 20 caracteres.');
            return;
        }

        const resultsContainer = document.getElementById('ai-results');
        resultsContainer.innerHTML = '<p class="ai-loading-indicator">Pensando...</p>';
        
        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', { 
                body: { textContent, promptType, customPrompt } 
            });
            if (error) throw error;
            const formattedResult = data.result.replace(/\n/g, '<br>');
            resultsContainer.insertAdjacentHTML('beforeend', `<div class="ai-result-box">${formattedResult}</div>`);
        } catch (error) {
            console.error('Error al llamar a la función de IA:', error);
            resultsContainer.innerHTML = '<p style="color: red;">Hubo un error al contactar a la IA.</p>';
        } finally {
            const loadingIndicator = document.querySelector('.ai-loading-indicator');
            if (loadingIndicator) loadingIndicator.remove();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EditorApp.init();
});