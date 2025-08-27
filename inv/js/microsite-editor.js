// Espera a que todo el contenido de la página se cargue antes de ejecutar el script
document.addEventListener('DOMContentLoaded', () => {

    // --- INICIALIZACIÓN ---
    // Inicializa el editor de texto enriquecido TinyMCE en los textareas con la clase 'tinymce-editor'
    tinymce.init({
        selector: '.tinymce-editor',
        plugins: 'autolink lists link image charmap preview anchor pagebreak',
        toolbar_mode: 'floating',
        height: 200,
    });

    // --- SELECTORES DE ELEMENTOS ---
    const form = document.getElementById('microsite-form');
    const modulesContainer = document.getElementById('custom-modules-container');
    const addTextModuleBtn = document.getElementById('add-text-module-btn');
    const addEmbedModuleBtn = document.getElementById('add-embed-module-btn');
    const aiButtons = document.querySelectorAll('.ai-button');

    // --- MANEJADORES DE EVENTOS ---
    addTextModuleBtn.addEventListener('click', () => createModule('text'));
    addEmbedModuleBtn.addEventListener('click', () => createModule('embed'));

    form.addEventListener('submit', handleFormSubmit);

    aiButtons.forEach(button => {
        button.addEventListener('click', handleAIClick);
    });

    // --- FUNCIONES PRINCIPALES ---

    /**
     * Crea y añade un nuevo módulo (texto o embed) al contenedor.
     * @param {string} type - El tipo de módulo ('text' o 'embed').
     */
    function createModule(type) {
        const moduleId = `module-${Date.now()}`;
        const moduleCard = document.createElement('div');
        moduleCard.classList.add('module-card');
        moduleCard.setAttribute('data-module-id', moduleId);
        moduleCard.setAttribute('data-module-type', type);

        let contentHtml = '';
        if (type === 'text') {
            contentHtml = `
                <label for="title-${moduleId}">Título del Módulo:</label>
                <input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Metodología, Resultados Clave...">
                <label for="content-${moduleId}" style="margin-top:10px;">Contenido:</label>
                <textarea id="content-${moduleId}" class="module-content" placeholder="Desarrolla el contenido aquí..."></textarea>
            `;
        } else if (type === 'embed') {
            contentHtml = `
                <label for="title-${moduleId}">Título del Módulo:</label>
                <input type="text" id="title-${moduleId}" class="module-title" placeholder="Ej: Video Explicativo, Gráfico Interactivo...">
                <label for="url-${moduleId}" style="margin-top:10px;">URL para incrustar:</label>
                <input type="text" id="url-${moduleId}" class="module-content" placeholder="Pega un enlace de YouTube, Figma, etc.">
            `;
        }

        moduleCard.innerHTML = `
            <div class="module-header">
                <h4>Módulo de ${type === 'text' ? 'Texto' : 'Enlace'}</h4>
                <div class="module-card-actions">
                    <button type="button" class="delete-module-btn" title="Eliminar Módulo"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            ${contentHtml}
        `;

        modulesContainer.appendChild(moduleCard);

        // Añade el evento de borrado al nuevo botón
        moduleCard.querySelector('.delete-module-btn').addEventListener('click', () => {
            moduleCard.remove();
        });
    }

    /**
     * Simula la llamada a la función de IA.
     * @param {Event} event - El evento de clic.
     */
    function handleAIClick(event) {
        const targetId = event.currentTarget.dataset.target;
        const promptType = event.currentTarget.dataset.prompt;
        const targetElement = document.getElementById(targetId);

        console.log(`Llamando a la IA con el prompt: "${promptType}" para el elemento: "#${targetId}"`);
        alert('✨ ¡Magia de la IA en camino! (Función simulada)');
        // Aquí, en el futuro, llamarías a tu Edge Function de Supabase
        // y al recibir la respuesta, la pondrías en targetElement.value
    }

    /**
     * Recopila todos los datos del formulario y los muestra en la consola.
     * @param {Event} event - El evento de submit del formulario.
     */
    function handleFormSubmit(event) {
        event.preventDefault(); // Evita que la página se recargue

        // Actualiza el contenido de los editores TinyMCE antes de guardar
        tinymce.triggerSave();

        const formData = {
            cover: {
                headline: document.getElementById('cover-headline').value,
                imageUrl: document.getElementById('cover-image-url').value,
            },
            summary: {
                content: document.getElementById('summary-content').value,
            },
            custom_modules: []
        };

        const moduleElements = modulesContainer.querySelectorAll('.module-card');
        moduleElements.forEach(moduleEl => {
            const moduleData = {
                id: moduleEl.dataset.moduleId,
                type: moduleEl.dataset.moduleType,
                title: moduleEl.querySelector('.module-title').value,
                content: moduleEl.querySelector('.module-content').value
            };
            formData.custom_modules.push(moduleData);
        });

        console.log("Datos listos para enviar a Supabase:");
        console.log(JSON.stringify(formData, null, 2));

        alert('¡Cambios guardados! (Revisa la consola para ver la estructura de datos)');
        // Aquí es donde harías la llamada `UPDATE` a Supabase para guardar el JSON.
    }
});