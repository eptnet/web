// =================================================================
// ARCHIVO COMPLETO: /inv/js/editor-studio.js (Hub Omnicanal V3)
// =================================================================

// --- 1. CONFIGURACIÓN DEL SISTEMA (Línea Editorial de Epistecnología) ---
const SYSTEM_PROMPT = `Actúa como el editor principal de Epistecnología, un "puente sociotécnico" que conecta el rigor científico con la sabiduría cultural. 
Tu tono debe ser divulgativo, accesible, pedagógico y cercano, pero siempre manteniendo el rigor ético y científico. Evita el clickbait, el facilismo comercial o el tono elitista excluyente. Recuerda que construimos archivos permanentes diseñados para "durar siglos, no segundos". Promueve la interdisciplinariedad y el respeto por la dignidad humana.`;

// Prompts Específicos (Incluyendo tus agentes expertos)
const agentPrompts = {
    'text': {
        label: 'Redactar Artículo de Divulgación',
        prompt: `${SYSTEM_PROMPT}
Actúa como un Asistente Experto en Comunicación Científica. Tu tarea principal es generar artículos de opinión con un tono de divulgación basado en el texto proporcionado.
Reglas estrictas:
1. Claridad y Sencillez: Simplifica el lenguaje complejo y la jerga técnica.
2. Estructura de Pirámide Invertida: Reorganiza el contenido. La información más crucial (el "quién, qué, cuándo, dónde, por qué y cómo") debe estar en el primer párrafo.
3. Tono: Atractivo, informativo y accesible, despertando curiosidad.
Estructura la salida con un Título Atractivo, un Lead (Entradilla potente) y el Cuerpo del artículo organizado de mayor a menor relevancia.`
    },
    'script': {
        label: 'Guion para Video (Reel/Short)',
        prompt: `${SYSTEM_PROMPT}
Actúa como Guionista de Contenido Educativo. Elabora un guion breve (menos de 1 minuto) para un reel de divulgación científica que explique, de forma clara y atractiva, la investigación proporcionada.
Estructura el guion en tres partes:
[Inicio - 0:00 a 0:10]: Un gancho atractivo o pregunta que despierte curiosidad.
[Desarrollo - 0:10 a 0:40]: Explicación sencilla del impacto social/humano y ejemplos concretos. Evita tecnicismos.
[Cierre - 0:40 a 0:60]: Cierre inspirador que vincule la labor científica con el bienestar humano. Termina con una frase memorable.`
    },
    'social': {
        label: 'Hilo para Comunidad / Redes',
        prompt: `${SYSTEM_PROMPT}
Genera un hilo de 3 posts concisos basados en el texto base. El primero debe ser un gancho potente y ético. Los siguientes desarrollan la idea. El último invita a la reflexión alturada. No uses lenguaje sensacionalista.`
    },
    'summary': {
        label: 'Resumen (Abstract Divulgativo)',
        prompt: `${SYSTEM_PROMPT}
Crea un resumen técnico pero accesible (máximo 150 palabras) del texto proporcionado, ideal para ser el abstract público de una investigación indexada.`
    }
};

const StudioApp = {
    supabase: null,
    editorInstance: null,
    currentPost: { id: null, projectId: null },
    userId: null,
    currentUserProfile: null,
    saveTimeout: null, // Para el autoguardado silencioso

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.userId = session.user.id;
        
        const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', this.userId).single();
        this.currentUserProfile = profile;

        await this.initializeEditor();
        this.addEventListeners();
        await this.loadUserProjects();

        // Lógica de URL para mantener trazabilidad
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        const postId = urlParams.get('postId');

        if (postId) {
            await this.loadPost(postId);
        } else if (projectId) {
            this.setProjectFocus(projectId);
        }
    },

    // --- 2. CONFIGURACIÓN DE LA INTERFAZ Y PESTAÑAS ---
    addEventListeners() {
        // Selector de Tareas IA (Texto)
        const taskDropdown = document.getElementById('ai-task-dropdown');
        const customPromptArea = document.getElementById('ai-custom-prompt');
        
        if (taskDropdown && customPromptArea) {
            // Llenar dinámicamente el menú desde nuestro objeto agentPrompts
            taskDropdown.innerHTML = '';
            Object.keys(agentPrompts).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = agentPrompts[key].label;
                taskDropdown.appendChild(option);
            });

            taskDropdown.addEventListener('change', (e) => {
                const selectedKey = e.target.value;
                // Mostramos el prompt al usuario para que vea las reglas, pero puede editarlo
                customPromptArea.value = agentPrompts[selectedKey].prompt;
            });
            // Disparar el primer evento para llenar el cuadro
            taskDropdown.dispatchEvent(new Event('change'));
        }

        // Pestañas (Tabs) de la IA
        document.querySelectorAll('.ai-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(btn.classList.contains('disabled')) return;
                
                // Remover active de todos
                document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.remove('active'));
                
                // Activar el clickeado
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });

        // Botones de Acción
        document.getElementById('ai-generate-text-btn')?.addEventListener('click', () => this.callTextAI());
        document.getElementById('ai-generate-image-btn')?.addEventListener('click', () => this.callImageAI());
        document.getElementById('save-draft-btn')?.addEventListener('click', () => this.saveDraft(false));
        document.getElementById('publish-btn')?.addEventListener('click', () => this.handlePublish());

        // Selector de Proyecto (Cambio manual)
        document.getElementById('active-project-select')?.addEventListener('change', (e) => {
            if(e.target.value) this.setProjectFocus(e.target.value);
        });

        // Autoguardado al escribir (Debounce)
        const titleInput = document.getElementById('post-title');
        titleInput?.addEventListener('input', () => this.triggerAutoSave());
        
        // Redes Sociales - Contador de caracteres
        const socialText = document.getElementById('social-post-text');
        const charCount = document.getElementById('social-char-count');
        if(socialText && charCount) {
            socialText.addEventListener('input', () => {
                const length = socialText.value.length;
                charCount.textContent = length;
                if(length > 300) charCount.classList.add('limit-reached');
                else charCount.classList.remove('limit-reached');
            });
        }
    },

    // --- 3. TRAZABILIDAD Y PROYECTOS (Punto de Enfoque) ---
    async loadUserProjects() {
        const { data: projects, error } = await this.supabase.from('projects').select('id, title, doi').eq('user_id', this.userId);
        if (error) return console.error("Error cargando proyectos:", error);

        const select = document.getElementById('active-project-select');
        select.innerHTML = '<option value="">Selecciona un proyecto base...</option>';
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            // Guardamos el DOI como un atributo del option para accederlo fácil
            option.dataset.doi = p.doi || ''; 
            option.textContent = p.title.length > 40 ? p.title.substring(0, 40) + '...' : p.title;
            select.appendChild(option);
        });
    },

    async setProjectFocus(projectId) {
        this.currentPost.projectId = projectId;
        const select = document.getElementById('active-project-select');
        select.value = projectId;

        // Verificar DOI para mostrar el Badge de trazabilidad
        const selectedOption = select.options[select.selectedIndex];
        const doiBadge = document.getElementById('doi-badge');
        if (selectedOption && selectedOption.dataset.doi) {
            doiBadge.classList.remove('badge-hidden');
            doiBadge.title = `DOI: ${selectedOption.dataset.doi}`;
        } else {
            doiBadge.classList.add('badge-hidden');
        }

        // Si no hay post activo, cargamos la descripción del proyecto al editor como base
        if (!this.currentPost.id && this.editorInstance.getContent() === '') {
            const { data } = await this.supabase.from('projects').select('description').eq('id', projectId).single();
            if(data && data.description) {
                this.editorInstance.setContent(`<blockquote><strong>Contexto del Proyecto:</strong><br>${data.description}</blockquote><p><br></p>`);
            }
        }
    },

    // --- 4. EDITOR MULTIMODAL (TinyMCE) ---
    initializeEditor() {
        return new Promise(resolve => {
            tinymce.init({
                selector: '#rich-text-editor',
                plugins: 'lists link image autoresize wordcount',
                toolbar: 'undo redo | formatselect | bold italic | bullist numlist | link image | removeformat',
                autoresize_bottom_margin: 50,
                min_height: 500,
                skin: document.body.classList.contains('dark-theme') ? 'oxide-dark' : 'oxide',
                content_css: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
                placeholder: 'Escribe aquí tu artículo. Puedes arrastrar imágenes generadas directamente a este espacio...',
                setup: (editor) => { 
                    editor.on('init', () => { 
                        this.editorInstance = editor; 
                        resolve(); 
                    });
                    // Disparar autoguardado al cambiar contenido
                    editor.on('input change undo redo', () => this.triggerAutoSave());
                }
            });
        });
    },

    async loadPost(postId) {
        const { data, error } = await this.supabase.from('posts').select('*, project_id(id, doi)').eq('id', postId).eq('user_id', this.userId).single();
        if (error || !data) { alert('No se pudo cargar el borrador.'); return; }
        
        this.currentPost = { id: data.id, projectId: data.project_id.id };
        document.getElementById('post-title').value = data.title;
        this.editorInstance.setContent(data.content);
        
        // Actualizar UI
        this.setProjectFocus(data.project_id.id);
        
        // Simular que cargamos el texto de la red social (Si lo estuviéramos guardando en BD)
        // Por ahora, como es nuevo, lo dejamos en blanco para que el usuario redacte.
    },

    // --- 5. LOGICA DE AUTOGUARDADO (Silencioso) ---
    triggerAutoSave() {
        if(!this.currentPost.projectId) return; // No guardar si no hay proyecto
        
        clearTimeout(this.saveTimeout);
        const statusEl = document.getElementById('save-status');
        statusEl.innerHTML = '<i class="fa-solid fa-pen"></i> Editando...';
        
        this.saveTimeout = setTimeout(() => {
            this.saveDraft(true);
        }, 3000); // Guarda 3 segundos después de dejar de escribir
    },

    async saveDraft(isSilent = false) {
        if (!this.editorInstance || !this.currentPost.projectId) { 
            if(!isSilent) alert('Selecciona un Proyecto Activo en la barra superior antes de guardar.');
            return; 
        }

        const statusEl = document.getElementById('save-status');
        if(!isSilent) {
            const btn = document.getElementById('save-draft-btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
            btn.disabled = true;
        } else {
            statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        }

        try {
            const postData = {
                project_id: this.currentPost.projectId,
                user_id: this.userId,
                title: document.getElementById('post-title').value || 'Borrador sin título',
                content: this.editorInstance.getContent(),
                status: 'draft',
                updated_at: new Date().toISOString()
            };

            if (this.currentPost.id) postData.id = this.currentPost.id;

            const { data, error } = await this.supabase.from('posts').upsert(postData).select().single();
            if (error) throw error;
            
            this.currentPost.id = data.id;
            
            // Actualizar URL sin recargar para mantener trazabilidad
            const newUrl = `/inv/editor.html?postId=${data.id}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);

            statusEl.innerHTML = '<i class="fa-solid fa-cloud-check" style="color:#2ecc71"></i> Guardado';
            setTimeout(() => { statusEl.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizado'; }, 3000);

            if(!isSilent) alert('Borrador guardado manualmente con éxito.');

        } catch (error) {
            console.error('Error guardando:', error);
            statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i> Error al guardar';
        } finally {
            if(!isSilent) {
                const btn = document.getElementById('save-draft-btn');
                btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Guardar Borrador';
                btn.disabled = false;
            }
        }
    },

    // --- 6. CONEXIÓN CON INTELIGENCIA ARTIFICIAL ---
    async callTextAI() {
        const textContent = this.editorInstance.getContent({ format: 'text' });
        const customPrompt = document.getElementById('ai-custom-prompt').value.trim();
        const resultsContainer = document.getElementById('ai-text-results');

        if (textContent.trim().length < 20 && customPrompt.length < 20) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Escribe algo en el editor central o da instrucciones más largas a la IA.</p>';
            return;
        }

        const btn = document.getElementById('ai-generate-text-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
        resultsContainer.innerHTML = '';

        try {
            // Utilizamos el endpoint que ya tienes configurado
            const { data, error } = await this.supabase.functions.invoke('generate-text', { 
                body: { 
                    textContent: textContent, 
                    promptType: 'generate_from_instructions', 
                    customPrompt: customPrompt 
                } 
            });
            if (error) throw error;
            
            const formattedResult = data.result.replace(/\n/g, '<br>');
            
            // Mostramos el resultado con un botón para insertarlo fácilmente en el editor
            resultsContainer.innerHTML = `
                <div class="ai-result-box" style="background: var(--color-surface); padding: 1rem; border-radius: 8px; border: 1px solid var(--color-border); margin-top: 1rem; font-size:0.9rem;">
                    ${formattedResult}
                    <button onclick="StudioApp.insertIntoEditor()" class="btn-secondary w-100" style="margin-top: 1rem;">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i> Añadir al Editor
                    </button>
                </div>
                <div id="hidden-ai-result" style="display:none;">${formattedResult}</div>
            `;
        } catch (error) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Hubo un error al contactar a la IA de texto.</p>';
            console.error(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generar Texto';
        }
    },

    // Función auxiliar global para el botón HTML inyectado arriba
    insertIntoEditor() {
        const content = document.getElementById('hidden-ai-result').innerHTML;
        this.editorInstance.insertContent(`<p><br></p>${content}<p><br></p>`);
        this.triggerAutoSave();
    },

    async callImageAI() {
        const prompt = document.getElementById('ai-image-prompt').value.trim();
        const style = document.getElementById('ai-image-style').value;
        const resultsContainer = document.getElementById('ai-image-results');

        if (prompt.length < 10) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Describe la imagen con al menos 10 caracteres.</p>';
            return;
        }

        const btn = document.getElementById('ai-generate-image-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';
        resultsContainer.innerHTML = '';

        // NOTA: Aquí preparamos la llamada a la FUTURA Edge Function de Imágenes
        try {
            /* const { data, error } = await this.supabase.functions.invoke('generate-image', { 
                body: { prompt: prompt, style: style } 
            });
            if (error) throw error;
            const imageUrl = data.url;
            */
            
            // Simulación temporal para ver cómo funciona la UI y el Drag&Drop
            await new Promise(r => setTimeout(r, 2000));
            const dummyImageUrl = `https://picsum.photos/seed/${Math.random()}/400/300`; 

            // Añadir a la bandeja multimedia (Drag & Drop)
            const tray = document.getElementById('media-gallery');
            const emptyText = tray.querySelector('.empty-tray-text');
            if(emptyText) emptyText.remove();

            const imgHtml = `
                <div style="position:relative; width: 120px; height: 90px; flex-shrink: 0; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); cursor: grab;">
                    <img src="${dummyImageUrl}" style="width:100%; height:100%; object-fit:cover;" draggable="true" ondragstart="event.dataTransfer.setData('text/html', '<img src=\\'${dummyImageUrl}\\' style=\\'max-width:100%; border-radius:8px;\\'>')">
                </div>
            `;
            tray.insertAdjacentHTML('afterbegin', imgHtml);
            
            resultsContainer.innerHTML = '<p style="color: #2ecc71; font-size:0.85rem; margin-top: 1rem;"><i class="fa-solid fa-check"></i> Imagen enviada a tu bandeja. Arrástrala al editor.</p>';

        } catch (error) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Error al generar imagen.</p>';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-palette"></i> Generar Imagen';
        }
    },

    // --- 7. PUBLICACIÓN OMNICANAL ---
    async handlePublish() {
        if (!this.currentPost.projectId) {
            alert('Por favor, selecciona un Proyecto Activo antes de publicar.');
            return;
        }

        // 1. Guardar el estado actual como borrador primero por seguridad
        await this.saveDraft(true);

        const socialText = document.getElementById('social-post-text').value.trim();
        const postToCommunity = document.getElementById('dest-epistecnologia').checked; // Siempre true en UI, pero validamos

        if (postToCommunity && socialText.length === 0) {
            alert("Escribe un mensaje en la caja de Redes Sociales para acompañar tu publicación.");
            document.getElementById('social-post-text').focus();
            return;
        }

        if (socialText.length > 300) {
            alert("El texto para redes no puede exceder los 300 caracteres.");
            return;
        }

        const publishButton = document.getElementById('publish-btn');
        publishButton.disabled = true;
        publishButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        try {
            // El artículo largo ya se guardó en this.saveDraft(). 
            // Ahora procesamos la publicación en la Comunidad (Bluesky)
            const finalUrl = `https://epistecnologia.com/proyectos/${this.currentPost.projectId}/posts/${this.currentPost.id}`;
            const textForCommunity = `${socialText}\n\n📖 Lee el artículo completo: ${finalUrl}`;

            // Verificamos credenciales (Como en el código original)
            const { data: creds } = await this.supabase.from('bsky_credentials').select('*').eq('user_id', this.userId).single();
            
            if (creds) {
                const { error } = await this.supabase.functions.invoke('bsky-create-post', {
                    body: { postText: textForCommunity },
                });
                if (error) throw error;
            } else {
                const authorInfo = {
                    displayName: this.currentUserProfile.display_name,
                    handle: null,
                    orcid: this.currentUserProfile.orcid
                };
                const { error: botError } = await this.supabase.functions.invoke('bot-create-post', {
                    body: { postText: textForCommunity, authorInfo },
                });
                if (botError) throw botError;
            }

            // Cambiar estado en BD a publicado
            await this.supabase.from('posts').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', this.currentPost.id);
            
            alert("¡Contenido publicado con éxito! Ya es visible en la comunidad.");
            // Opcional: Redirigir al dashboard
            // window.location.href = '/inv/dashboard.html';
            
        } catch (error) {
            console.error("Error publicando:", error);
            alert(`Hubo un error al publicar: ${error.message}`);
        } finally {
            publishButton.disabled = false;
            publishButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Ahora';
        }
    }
};

// Exponer la función auxiliar al scope global para que el botón HTML la encuentre
window.StudioApp = StudioApp;

document.addEventListener('DOMContentLoaded', () => {
    StudioApp.init();
});