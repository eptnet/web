// =================================================================
// ARCHIVO COMPLETO: /inv/js/editor-studio.js (Hub Omnicanal V4)
// - Incluye API is.gd ultrarrápida para enlaces
// - Enlace obligatorio (Fallback al perfil del usuario)
// =================================================================

const SYSTEM_PROMPT = `Eres un Asistente Experto en Comunicación Científica de Epistecnología. 
REGLA ABSOLUTA: NO saludes, NO te despidas. Devuelve ÚNICAMENTE el contenido solicitado.

ESTRUCTURA OBLIGATORIA: Siempre divide tu respuesta exactamente en estas TRES partes usando etiquetas HTML:

<h3><span style="color: #b72a1e;">[PROPUESTA PARA REDES]</span></h3>
<p><em>(Escribe aquí un gancho breve, máximo 250 caracteres, para copiar en redes).</em></p>
<hr>
<h3>[CONTENIDO PRINCIPAL]</h3>
(Escribe aquí el cuerpo principal usando formato HTML básico como <h2>, <p>, <strong>).
<hr>
<h3>[SUGERENCIAS VISUALES PARA LA IA]</h3>
<p><em>(Crea 2 sugerencias de Prompts muy descriptivos en INGLÉS para generar imágenes que acompañen este texto).</em></p>
<ul>
<li><strong>Prompt 1:</strong> [Escribe el prompt en inglés aquí]</li>
<li><strong>Prompt 2:</strong> [Escribe el prompt en inglés aquí]</li>
</ul>`;

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
    saveTimeout: null, 
    isProgrammaticChange: false,

    async init() {
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            const themeBtn = document.getElementById('theme-switcher-studio');
            if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }

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
        await this.loadUserDrafts();

        const urlParams = new URLSearchParams(window.location.search);
        
        // --- LÓGICA DEL INTERRUPTOR DE CORREO ---
        const agent = urlParams.get('agent');
        const emailToggle = document.getElementById('email-toggle-container');
        const newsletterCheckbox = document.getElementById('toggle-newsletter');
        
        if (emailToggle && newsletterCheckbox) {
            if (agent && agent !== 'text') {
                emailToggle.style.display = 'none';
                newsletterCheckbox.checked = false; 
            } else {
                emailToggle.style.display = 'flex';
                newsletterCheckbox.checked = true; 
            }
        }

        if (urlParams.get('postId')) await this.loadPost(urlParams.get('postId'));
        else if (urlParams.get('projectId')) this.setProjectFocus(urlParams.get('projectId'));
    },

    addEventListeners() {
        const taskDropdown = document.getElementById('ai-task-dropdown');
        const customPromptArea = document.getElementById('ai-custom-prompt');
        
        if (taskDropdown && customPromptArea) {
            taskDropdown.innerHTML = '';
            Object.keys(agentPrompts).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = agentPrompts[key].label;
                taskDropdown.appendChild(option);
            });

            taskDropdown.addEventListener('change', (e) => {
                const selectedKey = e.target.value;
                customPromptArea.value = agentPrompts[selectedKey].prompt;
            });
            taskDropdown.dispatchEvent(new Event('change'));
        }

        document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });

        document.querySelectorAll('.ai-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(btn.classList.contains('disabled')) return;
                document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });

        document.getElementById('ai-generate-text-btn')?.addEventListener('click', () => this.callTextAI());
        document.getElementById('ai-generate-image-btn')?.addEventListener('click', () => this.callImageAI());
        document.getElementById('save-draft-btn')?.addEventListener('click', () => this.saveDraft(false));
        document.getElementById('publish-btn')?.addEventListener('click', () => this.handlePublish());

        document.getElementById('active-project-select')?.addEventListener('change', (e) => {
            if(e.target.value) this.setProjectFocus(e.target.value);
        });

        const themeBtn = document.getElementById('theme-switcher-studio');
        themeBtn?.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        });

        const titleInput = document.getElementById('post-title');
        titleInput?.addEventListener('input', () => this.triggerAutoSave());
        
        const socialText = document.getElementById('social-post-text');
        const charCount = document.getElementById('social-char-count');
        const linkInput = document.getElementById('social-post-link');
        
        if(socialText && charCount) {
            const updateCounter = () => {
                const linkLen = (linkInput && linkInput.value.trim().length > 0) ? linkInput.value.trim().length + 14 : 0;
                const totalLength = socialText.value.length + linkLen;
                
                charCount.textContent = totalLength;
                if(totalLength > 300) charCount.classList.add('limit-reached');
                else charCount.classList.remove('limit-reached');
            };
            socialText.addEventListener('input', updateCounter);
            if(linkInput) linkInput.addEventListener('input', updateCounter);
        }

        // --- API IS.GD: ACORTADOR CON PROXY ANTI-CORS ---
        document.getElementById('btn-shorten-link')?.addEventListener('click', async (e) => {
            const linkInput = document.getElementById('social-post-link');
            let urlToShorten = linkInput.value.trim();
            
            // Si intenta acortar sin haber escrito nada, le ponemos su perfil
            if (!urlToShorten) { 
                urlToShorten = `https://epistecnologia.com/@${window.StudioApp.currentUserProfile?.username || ''}`;
                linkInput.value = urlToShorten;
            }

            if (urlToShorten.includes('is.gd') || urlToShorten.includes('tinyurl.com') || urlToShorten.includes('n9.cl')) { 
                alert("Este enlace ya parece estar acortado."); 
                return; 
            }
            if (!urlToShorten.startsWith('http')) { 
                alert("El enlace debe empezar con http:// o https://"); 
                return; 
            }

            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;

            try {
                // 1. Construimos la petición a is.gd
                const isGdUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlToShorten)}`;
                
                // 2. Usamos el Proxy público AllOrigins para evadir el bloqueo de seguridad del navegador
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(isGdUrl)}`;
                
                const res = await fetch(proxyUrl);
                
                if (res.ok) {
                    const shortUrl = await res.text();
                    linkInput.value = shortUrl.trim(); // .trim() para limpiar espacios ocultos
                    linkInput.dispatchEvent(new Event('input')); // Dispara la actualización del contador
                } else {
                    alert("El acortador no respondió. Es posible que el enlace no sea válido.");
                }
            } catch (err) {
                console.error("Error acortando URL:", err);
                alert("No se pudo conectar con el acortador (Verifica tu conexión).");
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });
    },

    async loadUserProjects() {
        const { data: projects, error } = await this.supabase.from('projects').select('id, title, doi').eq('user_id', this.userId);
        if (error) return console.error("Error cargando proyectos:", error);

        const select = document.getElementById('active-project-select');
        select.innerHTML = '<option value="">Selecciona un proyecto base...</option>';
        projects.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.dataset.doi = p.doi || ''; 
            option.textContent = p.title.length > 40 ? p.title.substring(0, 40) + '...' : p.title;
            select.appendChild(option);
        });
    },

    async loadUserDrafts() {
        const { data: drafts, error } = await this.supabase
            .from('posts').select('id, title')
            .eq('user_id', this.userId).eq('status', 'draft')
            .order('updated_at', { ascending: false });
            
        if (error) return console.error("Error cargando borradores:", error);
        
        const select = document.getElementById('draft-select');
        select.innerHTML = '<option value="">+ Nuevo Artículo...</option>';
        drafts.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.title || 'Borrador sin título';
            if (String(d.id) === String(this.currentPost.id)) option.selected = true;
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            if(e.target.value) window.location.href = `/inv/editor.html?postId=${e.target.value}`;
            else window.location.href = `/inv/editor.html`;
        });
    },

    async setProjectFocus(projectId) {
        this.currentPost.projectId = projectId;
        const select = document.getElementById('active-project-select');
        select.value = projectId;

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

        const linkInput = document.getElementById('social-post-link');
        if (linkInput) linkInput.value = projectDoi ? `https://doi.org/${projectDoi}` : `https://epistecnologia.com/@${this.currentUserProfile?.username || ''}`;

        const { data } = await this.supabase.from('projects').select('description').eq('id', projectId).single();
        if(data && data.description) {
            await this.editorInstance.isReady;
            this.isProgrammaticChange = true;
            this.editorInstance.blocks.insert('paragraph', { 
                text: `<b>Contexto del Proyecto:</b> ${data.description}` 
            });
            setTimeout(() => { this.isProgrammaticChange = false; }, 500);
        }
    },

    initializeEditor() {
        return new Promise(resolve => {
            this.editorInstance = new EditorJS({
                holder: 'editorjs', 
                placeholder: 'Escribe tu artículo aquí... Presiona "Tab" para abrir el menú o "+" para añadir bloques.',
                tools: {
                    header: { class: Header, inlineToolbar: true, config: { placeholder: 'Escribe un Subtítulo', levels: [2, 3, 4], defaultLevel: 2 } },
                    list: { class: EditorjsList, inlineToolbar: true },
                    image: {
                        class: ImageTool,
                        config: {
                            uploader: {
                                uploadByFile: async (file) => {
                                    const formData = new FormData();
                                    formData.append("image", file);
                                    try {
                                        const response = await fetch('https://api.imgbb.com/1/upload?key=89d606fc7588367140913f93a4c89785', {
                                            method: 'POST', body: formData
                                        });
                                        const result = await response.json();
                                        return { success: 1, file: { url: result.data.url } };
                                    } catch (error) {
                                        console.error("Error subiendo a ImgBB:", error);
                                        return { success: 0, file: { url: null } };
                                    }
                                }
                            }
                        }
                    },
                    raw: { class: RawTool }
                },
                onReady: () => { resolve(); },
                onChange: () => { this.triggerAutoSave(); }
            });
        });
    },

    async loadPost(postId) {
        const { data, error } = await this.supabase.from('posts').select('*, project_id(id, doi)').eq('id', postId).eq('user_id', this.userId).single();
        if (error || !data) { alert('No se pudo cargar el borrador.'); return; }
        
        this.currentPost = { id: data.id, projectId: data.project_id?.id || null };
        document.getElementById('post-title').value = data.title;
        
        await this.editorInstance.isReady;
        
        try {
            let blocksData = data.content;
            if (typeof blocksData === 'string') blocksData = JSON.parse(blocksData);
            
            this.isProgrammaticChange = true;
            if (blocksData && blocksData.blocks) {
                await this.editorInstance.render(blocksData);
            } else {
                this.editorInstance.render({ blocks: [] });
            }
            setTimeout(() => { this.isProgrammaticChange = false; }, 500);

        } catch(e) {
            console.error("Error cargando JSON:", e);
            this.editorInstance.render({ blocks: [] });
        }
        
        if (this.currentPost.projectId) this.setProjectFocus(this.currentPost.projectId);
    },

    triggerAutoSave() {
        if (this.isProgrammaticChange) return; 
        if(!this.currentPost.projectId) return; 
        
        clearTimeout(this.saveTimeout);
        const statusEl = document.getElementById('save-status');
        statusEl.innerHTML = '<i class="fa-solid fa-pen"></i> Editando...';
        
        this.saveTimeout = setTimeout(() => {
            this.saveDraft(true);
        }, 3000); 
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
            const editorData = await this.editorInstance.save();

            let titleValue = document.getElementById('post-title').value.trim();
            if (!titleValue) {
                const today = new Date();
                const dateStr = today.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                titleValue = `Nuevo borrador | ${dateStr}`;
                document.getElementById('post-title').value = titleValue; 
            }

            if (editorData.blocks.length === 0 && titleValue.startsWith('Nuevo borrador')) {
                if(!isSilent) alert("Escribe algo en el editor antes de guardar un borrador.");
                statusEl.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizado';
                return;
            }

            const postData = {
                project_id: this.currentPost.projectId,
                user_id: this.userId,
                title: titleValue,
                content: editorData, 
                status: 'draft',
                updated_at: new Date().toISOString()
            };

            if (this.currentPost.id) postData.id = this.currentPost.id;

            const { data, error } = await this.supabase.from('posts').upsert(postData).select().single();
            if (error) throw error;
            
            this.currentPost.id = data.id;
            
            const newUrl = `/inv/editor.html?postId=${data.id}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);

            statusEl.innerHTML = '<i class="fa-solid fa-cloud-check" style="color:#2ecc71"></i> Guardado';
            setTimeout(() => { statusEl.innerHTML = '<i class="fa-solid fa-cloud"></i> Sincronizado'; }, 3000);

            if(!isSilent) alert('Borrador guardado con éxito.');

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

    async callTextAI() {
        const editorData = await this.editorInstance.save();
        const textContent = editorData.blocks.map(b => b.data.text || '').join('\n');
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
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data.result;

            const blocksToInsert = [];
            Array.from(tempDiv.children).forEach(el => {
                const tag = el.tagName;
                const htmlContent = el.innerHTML.trim();
                
                if (!htmlContent) return;

                if (tag === 'H2' || tag === 'H3' || tag === 'H1') {
                    blocksToInsert.push({ type: 'header', data: { text: htmlContent, level: 3 } });
                } else if (tag === 'P') {
                    blocksToInsert.push({ type: 'paragraph', data: { text: htmlContent } });
                } else if (tag === 'UL' || tag === 'OL') {
                    const items = Array.from(el.querySelectorAll('li')).map(li => li.innerHTML);
                    blocksToInsert.push({ type: 'list', data: { style: tag === 'UL' ? 'unordered' : 'ordered', items: items } });
                } else if (tag === 'HR') {
                    blocksToInsert.push({ type: 'paragraph', data: { text: '---' } });
                } else {
                    blocksToInsert.push({ type: 'paragraph', data: { text: el.outerHTML } });
                }
            });

            if (blocksToInsert.length > 0) {
                this.isProgrammaticChange = true;
                blocksToInsert.forEach(block => {
                    this.editorInstance.blocks.insert(block.type, block.data);
                });
                setTimeout(() => { this.isProgrammaticChange = false; }, 500);
            } else {
                this.isProgrammaticChange = true;
                this.editorInstance.blocks.insert('paragraph', { text: data.result });
                setTimeout(() => { this.isProgrammaticChange = false; }, 500);
            }
            
            this.triggerAutoSave();
            resultsContainer.innerHTML = '<p style="color: #2ecc71; font-size:0.85rem;"><i class="fa-solid fa-check"></i> Contenido insertado en el editor.</p>';

        } catch (error) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Hubo un error al contactar a la IA.</p>';
            console.error(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generar Texto';
        }
    },

    insertIntoEditor() {
        const content = document.getElementById('hidden-ai-result').innerHTML;
        this.isProgrammaticChange = true;
        this.editorInstance.insertContent(`<p><br></p>${content}<p><br></p>`);
        setTimeout(() => { this.isProgrammaticChange = false; }, 500);
        this.triggerAutoSave();
    },

    async callImageAI() {
        const promptInput = document.getElementById('ai-image-prompt').value.trim();
        const style = document.getElementById('ai-image-style').value;
        const ratio = document.getElementById('ai-image-ratio').value; 
        const engine = document.getElementById('ai-image-engine').value;
        const resultsContainer = document.getElementById('ai-image-results');

        if (promptInput.length < 10) return;

        const btn = document.getElementById('ai-generate-image-btn');
        btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pintando...';
        resultsContainer.innerHTML = '';

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-image', { 
                body: { prompt: promptInput, style: style, ratio: ratio, engine: engine } 
            });
            if (error) throw error;
            
            const watermarkedBase64 = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const watermarkSize = Math.max(16, Math.floor(canvas.height * 0.035));
                    ctx.font = `bold ${watermarkSize}px Arial`;
                    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
                    ctx.shadowColor = "rgba(0, 0, 0, 0.9)"; ctx.shadowBlur = 8; 
                    ctx.fillText("IA EPT ✨", canvas.width - (canvas.width * 0.02), canvas.height - (canvas.height * 0.02));
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.95));
                };
                img.onerror = () => reject(new Error("Error procesando imagen."));
                img.src = data.image; 
            });

            const gallery = document.getElementById('media-gallery');
            const emptyText = gallery.querySelector('.empty-tray-text');
            if(emptyText) emptyText.remove();

            const imgCard = document.createElement('div');
            imgCard.style.cssText = "min-width: 120px; max-width: 150px; border-radius: 8px; overflow: hidden; border: 2px solid var(--color-accent); cursor: pointer; position: relative;";
            imgCard.innerHTML = `<img src="${watermarkedBase64}" style="width:100%; height:80px; object-fit:cover; display:block;" onclick="document.getElementById('lightbox-img').src=this.src; document.getElementById('lightbox-modal').style.display='flex';">`;
            gallery.prepend(imgCard);
            
            this.setSocialImage(watermarkedBase64);

            resultsContainer.innerHTML = '<p style="color: #2ecc71; font-size:0.85rem;"><i class="fa-solid fa-check"></i> Imagen generada y adjuntada a tu Post de Redes.</p>';

        } catch (error) {
            resultsContainer.innerHTML = '<p style="color: red; font-size:0.85rem;">Error al generar imagen.</p>';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-palette"></i> Pintar Imagen';
        }
    },

    setSocialImage(base64Data) {
        this.socialImageBase64 = base64Data;
        const previewContainer = document.getElementById('social-image-preview-container');
        const previewImg = document.getElementById('social-image-preview');
        if (previewContainer && previewImg) {
            previewImg.src = base64Data;
            previewContainer.style.display = 'block';
        }
    },
    removeSocialImage() {
        this.socialImageBase64 = null;
        document.getElementById('social-image-preview-container').style.display = 'none';
        document.getElementById('social-image-upload').value = '';
    },
    handleSocialImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 1048576) { alert("La imagen pesa más de 1MB (Límite de Bluesky)."); return; }
        const reader = new FileReader();
        reader.onload = (e) => this.setSocialImage(e.target.result);
        reader.readAsDataURL(file);
    },

    downloadLocalImage() {
        const imgSrc = document.getElementById('lightbox-img').src;
        const a = document.createElement('a');
        a.href = imgSrc;
        a.download = `EPT_Generado_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    async uploadToImgBB() {
        const btn = document.getElementById('upload-imgbb-btn');
        const imgSrc = document.getElementById('lightbox-img').src; 
        
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

        try {
            const base64Data = imgSrc.split(',')[1];
            const formData = new FormData();
            formData.append("image", base64Data);
            
            const IMGBB_API_KEY = "89d606fc7588367140913f93a4c89785"; 
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) throw new Error("Fallo al subir a ImgBB");
            const data = await response.json();
            const cleanUrl = data.data.url;

            this.isProgrammaticChange = true;
            this.editorInstance.blocks.insert('image', {
                file: { url: cleanUrl },
                caption: "Imagen generada por IA EPT"
            });
            setTimeout(() => { this.isProgrammaticChange = false; }, 500);
            
            alert("¡Imagen subida e insertada en tu artículo con éxito!");
            document.getElementById('lightbox-modal').style.display='none';
        } catch (error) {
            alert(`Error al subir la imagen: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Insertar al Artículo';
        }
    },

    async handlePublish() {
        if (!this.currentPost.projectId) {
            alert('Por favor, selecciona un Proyecto Activo antes de publicar.');
            return;
        }

        const socialText = document.getElementById('social-post-text').value.trim();
        let postLink = document.getElementById('social-post-link')?.value.trim();
        const postToCommunity = document.getElementById('dest-epistecnologia').checked; 

        // --- ENLACE OBLIGATORIO: Fallback de seguridad ---
        if (!postLink) {
            postLink = `https://epistecnologia.com/@${this.currentUserProfile?.username || ''}`;
            if (document.getElementById('social-post-link')) {
                document.getElementById('social-post-link').value = postLink;
            }
        }

        if (postToCommunity && socialText.length === 0) {
            alert("Escribe un mensaje en la caja de Redes Sociales para acompañar tu publicación.");
            return;
        }

        let textForCommunity = socialText;
        if (postLink) {
            textForCommunity += `\n\n📖 Enlace: ${postLink}`;
        }

        if (postToCommunity && textForCommunity.length > 300) {
            const overflow = textForCommunity.length - 300;
            alert(`⚠️ El texto para redes (incluyendo el enlace automático) supera el límite de 300 caracteres de Bluesky.\n\nTe pasaste por ${overflow} caracteres. Por favor, acorta tu mensaje en la columna derecha.`);
            return; 
        }

        await this.saveDraft(true);

        const publishButton = document.getElementById('publish-btn');
        publishButton.disabled = true;
        publishButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        try {
            let linkTitle = null;
            let linkDescription = null;
            let linkThumb = null;

            if (postLink) {
                try {
                    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(postLink)}`);
                    const json = await res.json();
                    if (json.data) {
                        linkTitle = json.data.title;
                        linkDescription = json.data.description;
                        linkThumb = json.data.image ? json.data.image.url : null;
                    }
                } catch (e) {
                    console.warn("No se pudo extraer la miniatura desde el editor:", e);
                }
            }

            const newsletterCheckbox = document.getElementById('toggle-newsletter');
            const sendNewsletter = newsletterCheckbox && newsletterCheckbox.parentElement.parentElement.style.display !== 'none' 
                                   ? newsletterCheckbox.checked 
                                   : false;

            const { error: dbError } = await this.supabase.from('posts').update({ 
                status: 'published', 
                send_email: sendNewsletter, 
                updated_at: new Date().toISOString() 
            }).eq('id', this.currentPost.id);

            if (dbError) throw dbError;

            let bskyErrorMsg = null;
            if (postToCommunity) {
                // 1. Definimos las variables base FUERA del try para que todos puedan leerlas
                let cleanBase64 = null;
                if (this.socialImageBase64) {
                    cleanBase64 = this.socialImageBase64.includes(',') 
                        ? this.socialImageBase64.split(',')[1] 
                        : this.socialImageBase64;
                }

                try {
                    console.log("Intentando publicar con tu identidad (OAuth 2.0)...");
                    
                    const payloadBluesky = {
                        action: 'create_post',
                        text: textForCommunity,
                        postLink: postLink,
                        linkTitle: linkTitle,
                        linkDescription: linkDescription,
                        linkThumb: linkThumb
                    };

                    if (cleanBase64) {
                        payloadBluesky.imageBase64 = cleanBase64;
                        payloadBluesky.imageMimeType = 'image/jpeg';
                    }

                    const { data: lexData, error: lexError } = await this.supabase.functions.invoke('bsky-lexicon-api', { 
                        body: payloadBluesky 
                    });
                    
                    if (lexError) throw lexError;
                    if (lexData && lexData.error) throw new Error(lexData.error);
                    
                    console.log("✅ Publicado en Bluesky con tu cuenta personal.");

                } catch (investigatorError) {
                    // 🔥 AQUÍ IMPRIMIMOS EL ERROR REAL 🔥
                    console.error("🚨 MOTIVO EXACTO DEL FALLO OAUTH:", investigatorError.message || investigatorError);
                    console.log("⚠️ Activando Plan B: Fallback al Bot EPT...");
                    
                    // 2. PLAN B: Usamos el Bot antiguo (Y usamos las variables correctas)
                    const payloadBot = {
                        postText: textForCommunity, // El bot EPT usa postText
                        postLink: postLink,
                        linkTitle: linkTitle,
                        linkDescription: linkDescription,
                        linkThumb: linkThumb,
                        isBot: true,
                        authorInfo: {
                            displayName: this.currentUserProfile?.display_name || 'Investigador',
                            handle: null,
                            orcid: this.currentUserProfile?.orcid
                        }
                    };

                    if (cleanBase64) {
                        payloadBot.base64Image = cleanBase64;
                        payloadBot.imageMimeType = 'image/jpeg';
                    }

                    const { data: botData, error: botError } = await this.supabase.functions.invoke('bot-create-post', { body: payloadBot });
                    
                    if (botError) {
                        bskyErrorMsg = botError.message;
                    } else if (botData && botData.error) {
                        bskyErrorMsg = botData.error;
                    } else {
                        console.log("🤖 Publicado vía EPT Bot.");
                    }
                }
            }

            if (bskyErrorMsg) {
                alert(`⚠️ El artículo fue guardado, PERO falló la publicación en redes. Motivo: ${bskyErrorMsg}`);
            } else {
                alert("¡Contenido publicado con éxito en la plataforma y en redes!");
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

window.StudioApp = StudioApp;

document.addEventListener('DOMContentLoaded', () => {
    StudioApp.init();

    const mobileBtn = document.getElementById('mobile-selectors-btn');
    const topbar = document.querySelector('.studio-topbar');
    
    if (mobileBtn && topbar) {
        mobileBtn.addEventListener('click', () => {
            topbar.classList.toggle('show-selectors');
            mobileBtn.classList.toggle('active'); 
        });
    }
});