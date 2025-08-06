const EditorApp = {
    supabase: null,
    editorInstance: null,
    currentPost: {
        id: null,
        projectId: null,
    },
    userId: null, // Guardaremos el ID del usuario aquí

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // --- INICIO: OBTENER Y VERIFICAR SESIÓN DE USUARIO ---
        const { data: { session }, error } = await this.supabase.auth.getSession();
        if (error || !session) {
            alert("No se pudo verificar tu sesión. Serás redirigido.");
            window.location.href = '/';
            return;
        }
        this.userId = session.user.id;
        // --- FIN: OBTENER Y VERIFICAR SESIÓN ---

        const urlParams = new URLSearchParams(window.location.search);
        this.currentPost.projectId = urlParams.get('projectId');

        if (!this.currentPost.projectId) {
            document.querySelector('.main-content').innerHTML = '<h2>Error</h2><p>No se ha especificado un proyecto. Por favor, vuelve al dashboard y selecciona uno.</p>';
            return;
        }

        this.initializeEditor();
        this.addEventListeners();
    },

    initializeEditor() {
        const isDarkMode = document.body.classList.contains('dark-theme');
        tinymce.init({
            selector: '#rich-text-editor',
            plugins: 'lists link image autoresize wordcount',
            toolbar: 'undo redo | blocks | bold italic | bullist numlist | link image',
            autoresize_bottom_margin: 20,
            height: 500,
            skin: isDarkMode ? 'oxide-dark' : 'oxide',
            content_css: isDarkMode ? 'dark' : 'default',
            placeholder: 'Empieza a escribir tu artículo aquí...',
            setup: (editor) => {
                editor.on('init', () => {
                    this.editorInstance = editor;
                });
            }
        });
    },

    addEventListeners() {
        const suggestTitlesBtn = document.getElementById('ai-suggest-titles-btn');
        suggestTitlesBtn?.addEventListener('click', () => this.callAI('suggest_titles'));
        
        const createSummaryBtn = document.getElementById('ai-create-summary-btn');
        createSummaryBtn?.addEventListener('click', () => this.callAI('create_summary'));

        const saveDraftBtn = document.getElementById('save-draft-btn');
        saveDraftBtn?.addEventListener('click', () => this.saveDraft());
    },

    async saveDraft() {
    if (!this.editorInstance || !this.userId) {
        alert('Error: No se ha podido verificar el usuario o el editor no está listo.');
        return;
    }

    const saveButton = document.getElementById('save-draft-btn');
    saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    saveButton.disabled = true;

    try {
        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Creamos el objeto base sin el 'id'
        const postData = {
            project_id: this.currentPost.projectId,
            user_id: this.userId,
            title: document.getElementById('post-title').value,
            content: this.editorInstance.getContent(),
            status: 'draft'
        };

        // 2. SOLO si ya tenemos un ID (es decir, estamos actualizando), lo añadimos al objeto.
        if (this.currentPost.id) {
            postData.id = this.currentPost.id;
        }
        // --- FIN DE LA CORRECCIÓN ---

        const { data, error } = await this.supabase
            .from('posts')
            .upsert(postData)
            .select()
            .single();

        if (error) throw error;
        
        if (!this.currentPost.id) {
            this.currentPost.id = data.id;
            console.log('Borrador guardado por primera vez con ID:', data.id);
        }

        saveButton.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
        setTimeout(() => {
            saveButton.innerHTML = 'Guardar Borrador';
            saveButton.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error al guardar el borrador:', error);
        alert('No se pudo guardar el borrador.');
        saveButton.innerHTML = 'Guardar Borrador';
        saveButton.disabled = false;
    }
},

    async callAI(promptType) {
        if (!this.editorInstance) {
            alert('El editor no está listo.');
            return;
        }

        const textContent = this.editorInstance.getContent({ format: 'text' });
        if (textContent.trim().length < 50) {
            alert('Por favor, escribe al menos 50 caracteres antes de usar la IA.');
            return;
        }

        // Obtenemos el contenido del nuevo campo de prompt
        const customPromptInput = document.getElementById('ai-custom-prompt');
        const customPrompt = customPromptInput ? customPromptInput.value.trim() : "";

        const resultsContainer = document.getElementById('ai-results');
        
        // Mostramos un indicador de carga sin borrar los resultados anteriores
        const loadingIndicatorHTML = '<p class="ai-loading-indicator">Pensando...</p>';
        resultsContainer.insertAdjacentHTML('beforeend', loadingIndicatorHTML);

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', {
                // Enviamos el prompt personalizado junto con el resto de los datos
                body: { textContent, promptType, customPrompt }
            });

            if (error) throw error;
            
            // Formateamos y añadimos el nuevo resultado
            const formattedResult = data.result.replace(/\n/g, '<br>');
            const resultBoxHTML = `<div class="ai-result-box">${formattedResult}</div>`;
            resultsContainer.insertAdjacentHTML('beforeend', resultBoxHTML);

        } catch (error) {
            console.error('Error al llamar a la función de IA:', error);
            resultsContainer.insertAdjacentHTML('beforeend', '<p style="color: red;">Hubo un error al contactar a la IA.</p>');
        } finally {
            // Eliminamos el indicador de "Pensando..." al finalizar
            const loadingIndicator = resultsContainer.querySelector('.ai-loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EditorApp.init();
});