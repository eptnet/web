const EditorApp = {
    supabase: null,
    editorInstance: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.initializeEditor();
        this.addEventListeners();
    },

    initializeEditor() {
        // Detectamos si el tema oscuro está activo para pasárselo al editor
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

        const resultsContainer = document.getElementById('ai-results');
        resultsContainer.innerHTML = '<p>Pensando...</p>';

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', {
                body: { textContent, promptType }
            });

            if (error) throw error;

            // Formateamos la respuesta para mostrarla como una lista
            const formattedResult = data.result.replace(/\n/g, '<br>');
            resultsContainer.innerHTML = `<div class="ai-result-box">${formattedResult}</div>`;

        } catch (error) {
            console.error('Error al llamar a la función de IA:', error);
            resultsContainer.innerHTML = '<p style="color: red;">Hubo un error al contactar a la IA.</p>';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    EditorApp.init();
});