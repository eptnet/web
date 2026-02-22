// =================================================================
// ARCHIVO COMPLETO: /inv/js/editor-studio.js (Hub Omnicanal V3)
// =================================================================

// --- 1. CONFIGURACIÓN DEL SISTEMA (Formato Quirúrgico y Directo) ---
const SYSTEM_PROMPT = `Eres un Asistente Experto en Comunicación Científica de Epistecnología. 
REGLA ABSOLUTA: NO saludes, NO te despidas, NO uses frases introductorias (ej. "Aquí tienes tu texto"). Devuelve ÚNICAMENTE el contenido solicitado.

ESTRUCTURA OBLIGATORIA: Siempre divide tu respuesta exactamente en estas dos partes usando etiquetas HTML:

<h3><span style="color: #b72a1e;">[PROPUESTA PARA REDES]</span></h3>
<p><em>(Escribe aquí un gancho breve, máximo 280 caracteres, que el usuario pueda copiar y pegar en la caja de redes sociales de la derecha).</em></p>
<hr>
<h3>[CONTENIDO PRINCIPAL]</h3>
(Escribe aquí el cuerpo principal: el artículo, el hilo o el guion, usando formato HTML básico como <h2>, <p>, <strong>, <ul> para que se vea bien en el editor).`;

const agentPrompts = {
    'text': {
        label: 'Redactar Artículo de Divulgación',
        prompt: `${SYSTEM_PROMPT}\n\nEscribe un artículo de divulgación basado en el texto base. Mantén un tono 100% humano, cercano y empático. Usa la Pirámide Invertida. Simplifica conceptos complejos con analogías.`
    },
    'script': {
        label: 'Guion para Video (Reel/Short)',
        prompt: `${SYSTEM_PROMPT}\n\nElabora un guion natural para un video corto (menos de 1 minuto). Estructura: [Inicio] Gancho, [Desarrollo] Explicación sencilla, [Cierre] Mensaje inspirador y llamado a la acción.`
    },
    'social': {
        label: 'Hilo para Comunidad / Redes',
        prompt: `${SYSTEM_PROMPT}\n\nGenera un hilo de 3 posts para redes. El tono debe ser entusiasta y en primera persona. El primer post es el gancho, los siguientes explican el valor, y el último invita a la reflexión.`
    },
    'summary': {
        label: 'Resumen (Abstract Divulgativo)',
        prompt: `${SYSTEM_PROMPT}\n\nCrea un resumen breve (máximo 150 palabras) del texto base. Fácil de entender para un ciudadano sin formación técnica, pero exacto científicamente.`
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
        
        // Redes Sociales - Contador de caracteres inteligente
        const socialText = document.getElementById('social-post-text');
        const charCount = document.getElementById('social-char-count');
        const linkInput = document.getElementById('social-post-link');
        
        if(socialText && charCount) {
            const updateCounter = () => {
                // Calculamos el tamaño del enlace + el texto adicional ("\n\n📖 Enlace: " son aprox 14 caracteres)
                const linkLen = (linkInput && linkInput.value.trim().length > 0) ? linkInput.value.trim().length + 14 : 0;
                const totalLength = socialText.value.length + linkLen;
                
                charCount.textContent = totalLength;
                
                if(totalLength > 300) {
                    charCount.classList.add('limit-reached');
                } else {
                    charCount.classList.remove('limit-reached');
                }
            };

            // Escuchamos ambos inputs para que el contador sea preciso en todo momento
            socialText.addEventListener('input', updateCounter);
            if(linkInput) linkInput.addEventListener('input', updateCounter);
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

            // Verificar DOI 
            const selectedOption = select.options[select.selectedIndex];
            const doiBadge = document.getElementById('doi-badge');
            let projectDoi = null;
            
            if (selectedOption && selectedOption.dataset.doi && selectedOption.dataset.doi !== 'null') {
                projectDoi = selectedOption.dataset.doi;
                doiBadge.classList.remove('badge-hidden');
                doiBadge.title = `DOI: ${projectDoi}`;
            } else {
                doiBadge.classList.add('badge-hidden');
            }

            // AUTO-COMPLETAR EL ENLACE DE REDES
            const linkInput = document.getElementById('social-post-link');
            if (linkInput) {
                if (projectDoi) {
                    linkInput.value = `https://doi.org/${projectDoi}`;
                } else if (this.currentUserProfile) {
                    linkInput.value = `https://epistecnologia.com/@${this.currentUserProfile.username}`;
                }
            }

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
            const { data, error } = await this.supabase.functions.invoke('generate-text', { 
                body: { textContent, promptType: 'generate_from_instructions', customPrompt } 
            });
            if (error) throw error;
            
            // TODO EL CONTENIDO (sea artículo o hilo) VA AL EDITOR PRINCIPAL
            // Ya no lo enviamos a la caja de redes.
            const formattedResult = data.result.replace(/\n/g, '<br>');
            this.editorInstance.setContent(formattedResult);
            
            // Disparamos autoguardado
            this.triggerAutoSave();
            
            resultsContainer.innerHTML = '<p style="color: #2ecc71; font-size:0.85rem;"><i class="fa-solid fa-check"></i> Contenido generado en el editor principal. Corta y pega la propuesta de redes en la columna derecha.</p>';

        } catch (error) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Hubo un error al contactar a la IA.</p>';
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
        const promptInput = document.getElementById('ai-image-prompt').value.trim();
        const style = document.getElementById('ai-image-style').value;
        const resultsContainer = document.getElementById('ai-image-results');

        if (promptInput.length < 10) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Describe la imagen con al menos 10 caracteres.</p>';
            return;
        }

        const btn = document.getElementById('ai-generate-image-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pintando...';
        resultsContainer.innerHTML = '';

        try {
            // 1. Llamamos a nuestra propia Edge Function (Segura)
            const { data, error } = await this.supabase.functions.invoke('generate-image', { 
                body: { prompt: promptInput, style: style } 
            });
            if (error) throw error;

            // 2. Cargamos la imagen base64 devuelta por Hugging Face y le estampamos la marca
            const watermarkedImageData = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');

                    // Dibujar la imagen
                    ctx.drawImage(img, 0, 0);

                    // Sello de Agua "IA EPT"
                    const watermarkText = "IA EPT";
                    ctx.font = "bold 28px Arial";
                    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                    ctx.textAlign = "right";
                    ctx.textBaseline = "bottom";
                    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                    ctx.shadowBlur = 8;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    ctx.fillText(watermarkText, canvas.width - 20, canvas.height - 20);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.onerror = () => reject(new Error("Error procesando la imagen descargada."));
                img.src = data.image; // Usamos el base64 devuelto por la función
            });

            // 3. Añadir a la bandeja
            const tray = document.getElementById('media-gallery');
            const emptyText = tray.querySelector('.empty-tray-text');
            if(emptyText) emptyText.remove();

            const imgHtml = `
                <div style="position:relative; width: 120px; height: 90px; flex-shrink: 0; border-radius: 6px; overflow: hidden; border: 1px solid var(--color-border); cursor: grab;">
                    <img src="${watermarkedImageData}" style="width:100%; height:100%; object-fit:cover;" 
                         draggable="true" 
                         ondragstart="event.dataTransfer.setData('text/html', '<img src=\\'${watermarkedImageData}\\' style=\\'max-width:100%; border-radius:8px;\\'>')">
                </div>
            `;
            tray.insertAdjacentHTML('afterbegin', imgHtml);
            
            resultsContainer.innerHTML = '<p style="color: #2ecc71; font-size:0.85rem; margin-top: 1rem;"><i class="fa-solid fa-check"></i> Imagen generada. Arrástrala al editor.</p>';

        } catch (error) {
            console.error(error);
            resultsContainer.innerHTML = `<p style="color: red; font-size:0.85rem;">Error al generar imagen. Intenta de nuevo.</p>`;
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

        const socialText = document.getElementById('social-post-text').value.trim();
        const postLink = document.getElementById('social-post-link')?.value.trim() || "";
        const postToCommunity = document.getElementById('dest-epistecnologia').checked; 

        if (postToCommunity && socialText.length === 0) {
            alert("Escribe un mensaje en la caja de Redes Sociales para acompañar tu publicación.");
            return;
        }

        // --- SOLUCIÓN AL BUG DE LOS 300 CARACTERES ---
        // Construimos el texto final antes para medirlo completo
        let textForCommunity = socialText;
        if (postLink) {
            textForCommunity += `\n\n📖 Enlace: ${postLink}`;
        }

        // Verificamos el límite real de Bluesky (300 caracteres)
        if (postToCommunity && textForCommunity.length > 300) {
            const overflow = textForCommunity.length - 300;
            alert(`⚠️ El texto para redes (incluyendo el enlace automático) supera el límite de 300 caracteres de Bluesky.\n\nTe pasaste por ${overflow} caracteres. Por favor, acorta tu mensaje en la columna derecha.`);
            return; // Detenemos la ejecución aquí, sin lanzar errores al servidor
        }

        // Guardamos primero
        await this.saveDraft(true);

        const publishButton = document.getElementById('publish-btn');
        publishButton.disabled = true;
        publishButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        try {
            // Construimos el texto final antes para medirlo completo
            let textForCommunity = socialText;
            if (postLink) {
                textForCommunity += `\n\n📖 Enlace: ${postLink}`;
            }

            // PASO 1: PRIMERO ACTUALIZAMOS LA BASE DE DATOS
            // CORRECCIÓN: Usamos 'updated_at' porque 'published_at' no existe en tu tabla posts
            const { error: dbError } = await this.supabase.from('posts').update({ 
                status: 'published', 
                updated_at: new Date().toISOString() 
            }).eq('id', this.currentPost.id);

            if (dbError) throw dbError; // Si falla la BD, saltamos al catch principal

            // PASO 2: INTENTAMOS PUBLICAR EN BLUESKY (Aislado para no romper la app si falla)
            let bskyErrorMsg = null;
            if (postToCommunity) {
                try {
                    const { data: creds } = await this.supabase.from('bsky_credentials').select('*').eq('user_id', this.userId).single();
                    
                    if (creds) {
                        const { error } = await this.supabase.functions.invoke('bsky-create-post', { body: { postText: textForCommunity }});
                        if (error) throw error;
                    } else {
                        const authorInfo = {
                            displayName: this.currentUserProfile.display_name,
                            handle: null,
                            orcid: this.currentUserProfile.orcid
                        };
                        const { error: botError } = await this.supabase.functions.invoke('bot-create-post', { body: { postText: textForCommunity, authorInfo }});
                        if (botError) throw botError;
                    }
                } catch (bskyErr) {
                    console.error("Fallo interno en Bluesky:", bskyErr);
                    bskyErrorMsg = bskyErr.message || "La función bsky-create-post falló.";
                }
            }

            // PASO 3: INFORMAR AL USUARIO
            if (bskyErrorMsg) {
                alert(`⚠️ El artículo fue publicado y enviado al Editor, PERO falló la publicación en redes. Motivo: ${bskyErrorMsg}`);
            } else {
                alert("¡Contenido publicado con éxito en la comunidad y enviado al Editor!");
            }
            
        } catch (error) {
            console.error("Error crítico publicando:", error);
            alert(`Hubo un error crítico al guardar la publicación: ${error.message}`);
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