// =================================================================
// ARCHIVO ACTUALIZADO: /inv/js/microsite-editor.js (Constructor SaaS)
// Funciones: Drag&Drop (Flechas), ImgBB Nativo, IA y Gestor de Slug.
// =================================================================

const MicrositeEditorApp = {
    supabase: null,
    user: null,
    currentProject: null,
    IMGBB_API_KEY: "89d606fc7588367140913f93a4c89785", // <-- ¡Reemplaza con tu Key de ImgBB!

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { alert('Debes iniciar sesión.'); window.location.href='/'; return; }
        this.user = session.user;

        const activeProjectString = sessionStorage.getItem('activeProject');
        if (!activeProjectString) { alert('Selecciona un proyecto primero.'); window.location.href='/inv/dashboard.html'; return; }
        this.currentProject = JSON.parse(activeProjectString);

        await this.loadMicrositeData();
        await this.loadRelatedData();
        await this.populateEventSelector();

        this.setupEventListeners();
    },

    async loadRelatedData() {
        const [researchers, sessions, posts] = await Promise.all([
            this.fetchResearchers(), this.fetchSessions(), this.fetchPosts()
        ]);
        this.renderResearchers(researchers);
        this.renderSessions(sessions);
        this.renderPosts(posts);
    },

    async fetchResearchers() {
        if (!this.currentProject.authors || this.currentProject.authors.length === 0) return [];
        const { data } = await this.supabase.from('profiles').select('display_name, avatar_url').in('display_name', this.currentProject.authors);
        return data || [];
    },

    async fetchSessions() {
        const { data } = await this.supabase.from('sessions').select('id, session_title').eq('project_title', this.currentProject.title);
        return data || [];
    },

    async fetchPosts() {
        const { data, error } = await this.supabase.from('posts')
            .select('title, status')
            .eq('project_id', this.currentProject.id)
            .eq('status', 'published');
        
        if (error) console.error("Error al cargar artículos:", error);
        return data || [];
    },

    renderResearchers(profiles) {
        const container = document.getElementById('researchers-preview-container');
        const authorNames = this.currentProject.authors || [];
        if (authorNames.length === 0) { container.innerHTML = '<p>No hay autores.</p>'; return; }
        container.innerHTML = authorNames.map(name => {
            const profile = profiles.find(p => p.display_name === name);
            const avatarUrl = profile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            return `<div class="preview-card"><img src="${avatarUrl}" alt="Avatar"><h5>${name}</h5></div>`;
        }).join('');
    },

    renderSessions(sessions) {
        const container = document.getElementById('sessions-preview-container');
        if (!container) return; // <-- Este es el seguro de vida que evita el cuelgue
        
        if (!sessions || sessions.length === 0) { 
            container.innerHTML = '<p class="form-hint" style="margin:0;">No hay sesiones grabadas.</p>'; 
            return; 
        }
        container.innerHTML = `
            <div class="preview-card">
                <i class="fa-solid fa-video text-accent" style="font-size: 1.2rem;"></i> 
                <h5 style="margin:0; font-size:0.85rem;">${sessions.length} sesión(es) detectada(s)</h5>
            </div>
        `;
    },

    renderPosts(posts) {
        const container = document.getElementById('posts-preview-container');
        if (!container) return;

        if (!posts || posts.length === 0) { 
            container.innerHTML = '<p class="form-hint" style="margin:0;">No hay artículos publicados.</p>'; 
            return; 
        }
        // Dibuja tarjetitas hermosas por cada artículo encontrado
        container.innerHTML = posts.map(p => `
            <div class="preview-card">
                <i class="fa-solid fa-file-lines text-accent" style="font-size: 1.2rem;"></i> 
                <h5 style="margin:0; font-size:0.85rem;">${p.title}</h5>
            </div>
        `).join('');
    },

    // 1. SELECTOR DE EVENTOS (Blindaje de tipos de datos)
    async populateEventSelector() {
        const select = document.getElementById('associated-event-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Ningún evento asociado --</option>'; 
        
        const { data: events, error } = await this.supabase.from('events')
            .select('id, title')
            .eq('user_id', this.user.id);
            
        if (error) console.error("Error al cargar eventos:", error);

        if (events && events.length > 0) {
            events.forEach(event => {
                const option = document.createElement('option'); 
                option.value = event.id.toString(); 
                option.textContent = event.title; 
                select.appendChild(option);
            });
        }

        // Si el proyecto ya tenía un evento guardado, lo seleccionamos
        if (this.currentProject && this.currentProject.associated_event_id) {
            select.value = this.currentProject.associated_event_id.toString();
        }
    },

    async loadMicrositeData() {
        // Traemos también el slug para editarlo
        const { data, error } = await this.supabase.from('projects').select('microsite_content, microsite_is_public, associated_event_id, template_style, color_palette, slug').eq('id', this.currentProject.id).single();
        if (error) return alert("Error cargando datos.");
        
        this.currentProject.microsite_content = data.microsite_content;
        this.currentProject.microsite_is_public = data.microsite_is_public;
        this.currentProject.associated_event_id = data.associated_event_id;
        this.currentProject.slug = data.slug;
        this.currentProject.template_style = data.template_style;
        this.currentProject.color_palette = data.color_palette;
        this.populateForm();
    },

    // 2. POBLAR FORMULARIO (Evitamos inyecciones nulas y marcamos el select)
    populateForm() {
        const content = this.currentProject.microsite_content || {};
        document.getElementById('cover-headline').value = content.cover?.headline || '';
        document.getElementById('cover-image-url').value = content.cover?.imageUrl || '';
        document.getElementById('seo-image-url').value = content.seo?.imageUrl || '';
        document.getElementById('microsite-is-public').checked = this.currentProject.microsite_is_public || false; 
        document.getElementById('template-style-select').value = this.currentProject.template_style || 'modern';
        document.getElementById('color-palette-select').value = this.currentProject.color_palette || 'dark';
        document.getElementById('project-slug').value = this.currentProject.slug || '';
        
        // Selección de Evento Segura
        if (this.currentProject.associated_event_id) {
            document.getElementById('associated-event-select').value = this.currentProject.associated_event_id.toString();
        }

        // Cargar módulos personalizados
        const modulesContainer = document.getElementById('custom-modules-container');
        modulesContainer.innerHTML = '';
        if (content.custom_modules && Array.isArray(content.custom_modules)) {
            content.custom_modules.forEach(moduleData => this.createModule(moduleData.type, moduleData));
        }

        // Dejar el texto listo para TinyMCE
        document.getElementById('summary-content').value = content.summary?.content || '';
        this.updatePublicStatusText();
        
        // ¡IMPORTANTE! Iniciamos TinyMCE justo DESPUÉS de poblar el contenido
        this.initializeEditor();
    },

    updatePublicStatusText() {
        const checkbox = document.getElementById('microsite-is-public');
        const text = document.getElementById('public-status-text');
        if (checkbox.checked) { text.textContent = "Público y Visible"; text.className = "status-text public"; } 
        else { text.textContent = "Borrador Privado"; text.className = "status-text"; }
    },

    // 3. INICIO DE TINYMCE (A prueba de balas)
    initializeEditor() {
        if (typeof tinymce === 'undefined') {
            console.error("TinyMCE no cargó correctamente desde el CDN.");
            return;
        }

        tinymce.remove(); 
        
        tinymce.init({
            selector: '#summary-content', 
            // Eliminamos 'textcolor' de aquí porque ya es nativo en la v6
            plugins: 'autolink lists link charmap', 
            // 'forecolor' se encarga de pintar el texto
            toolbar: 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | forecolor', 
            menubar: false, 
            height: 300, 
            placeholder: 'Desarrolla el contenido central de tu investigación...',
            skin: document.body.classList.contains('dark-theme') ? 'oxide-dark' : 'oxide',
            content_css: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
            setup: function (editor) {
                editor.on('change', function () {
                    editor.save(); 
                });
            }
        });
    },

    setupEventListeners() {
        // --- BOTÓN PUBLICAR / GUARDAR ---
        const saveBtn = document.getElementById('save-btn-header');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => this.handleFormSubmit(e));
        }

        // --- BOTÓN PREVISUALIZAR ---
        const previewBtn = document.getElementById('preview-btn-header');
        if (previewBtn) {
            previewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const slug = document.getElementById('project-slug').value.trim();
                if (!slug) {
                    alert("⚠️ Por favor, asigna un enlace (Slug) y guarda el proyecto antes de previsualizar.");
                    return;
                }
                // ¡AQUÍ ESTÁ EL CAMBIO! Ahora usa la ruta limpia
                window.open(`/p/${encodeURIComponent(slug)}`, '_blank');
            });
        }

        document.getElementById('microsite-is-public')?.addEventListener('change', () => this.updatePublicStatusText());

        // Botones Agregar Módulos
        document.querySelectorAll('.btn-add-mod').forEach(btn => {
            btn.addEventListener('click', (e) => this.createModule(e.target.closest('button').dataset.type));
        });

        // Eventos para subida de imágenes (ImgBB)
        this.setupImageUploads();

        // Eventos de IA (Simulada para Texto/Títulos)
        document.querySelectorAll('.ai-button, .ai-button-text').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleAIGeneration(e));
        });
    },

    // --- MAGIA 1: SUBIDA A IMGBB ---
    setupImageUploads() {
        const fileInputs = [
            { id: 'file-cover-image', target: 'cover-image-url' },
            { id: 'file-seo-image', target: 'seo-image-url' }
        ];

        fileInputs.forEach(inputObj => {
            const el = document.getElementById(inputObj.id);
            if (el) {
                el.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const btn = el.nextElementSibling;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    btn.disabled = true;

                    try {
                        const formData = new FormData();
                        formData.append("image", file);
                        const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_API_KEY}`, { method: "POST", body: formData });
                        const data = await response.json();
                        
                        if (data.success) {
                            document.getElementById(inputObj.target).value = data.data.url;
                        } else {
                            throw new Error("Error en ImgBB");
                        }
                    } catch (error) {
                        alert("Hubo un error subiendo la imagen.");
                    } finally {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                        el.value = ''; // Reset
                    }
                });
            }
        });
    },

    // --- MAGIA 2: ASISTENCIA IA ---
    async handleAIGeneration(e) {
        const btn = e.target.closest('button');
        const targetId = btn.dataset.target;
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        
        try {
            // Aquí puedes conectar a tu edge function real (ej: 'generate-text').
            // Por ahora extraemos el contexto para enviárselo.
            const context = this.currentProject.description || "Un proyecto de investigación.";
            const prompt = targetId === 'cover-headline' ? `Genera un título corto y publicitario para este proyecto: ${context}` : `Resume de forma accesible este proyecto: ${context}`;
            
            const { data, error } = await this.supabase.functions.invoke('generate-text', { body: { prompt } });
            
            if (error) throw error;
            
            if (targetId === 'summary-content') {
                tinymce.get('summary-content').setContent(data.text);
            } else {
                document.getElementById(targetId).value = data.text.replace(/"/g, '');
            }
        } catch (error) {
            console.error("AI Error:", error);
            alert("El servicio de IA no está disponible en este momento.");
        } finally {
            if (btn.classList.contains('ai-button-text')) btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Mejorar con IA';
            else btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        }
    },

    // --- MAGIA 3: DRAG & DROP Y CONSTRUCTOR DE MÓDULOS ---
    createModule(type, initialData = null) {
        const modulesContainer = document.getElementById('custom-modules-container');
        const moduleId = initialData ? initialData.id : `module-${Date.now()}`;
        const moduleCard = document.createElement('div');
        moduleCard.classList.add('module-card');
        moduleCard.setAttribute('data-module-id', moduleId);
        moduleCard.setAttribute('data-module-type', type);
        
        let contentHtml = '';
        let headerTitle = 'Módulo';
        let iconHtml = '';
        const data = initialData || {};

        if (type === 'text') {
            headerTitle = 'Módulo de Texto'; iconHtml = '<i class="fa-solid fa-align-left text-accent"></i>';
            contentHtml = `
                <div class="form-group mb-2"><label>Título de la Sección:</label><input type="text" class="module-title" value="${data.title || ''}"></div>
                <div class="form-group"><label>Contenido HTML:</label><textarea class="module-content">${data.content || ''}</textarea></div>
            `;
        } else if (type === 'embed') {
            headerTitle = 'Módulo de Video / Enlace'; iconHtml = '<i class="fa-solid fa-play text-accent"></i>';
            contentHtml = `
                <div class="form-group mb-2"><label>Título:</label><input type="text" class="module-title" value="${data.title || ''}"></div>
                <div class="form-group"><label>URL (YouTube, Vimeo):</label><input type="text" class="module-content" value="${data.content || ''}"></div>
            `;
        } else if (type === 'subscription') {
            headerTitle = 'Módulo de Suscripción'; iconHtml = '<i class="fa-solid fa-envelope text-accent"></i>';
            contentHtml = `
                <div class="form-group mb-2"><label>Título principal:</label><input type="text" class="module-title" value="${data.title || ''}"></div>
                <div class="form-group mb-2"><label>Mensaje motivador:</label><input type="text" class="module-text" value="${data.text || ''}"></div>
                <div class="form-group"><label>Enlace externo (Substack, Mailchimp):</label><input type="text" class="module-url" value="${data.url || ''}"></div>
            `;
        } else if (type === 'sponsors') {
            headerTitle = 'Módulo de Apoyos / Patrocinadores'; iconHtml = '<i class="fa-solid fa-handshake text-accent"></i>';
            contentHtml = `
                <div class="form-group mb-2"><label>Título de sección:</label><input type="text" class="module-title" value="${data.title || 'Con el apoyo de'}"></div>
                <div class="sponsors-list-editor"></div>
                <button type="button" class="btn-add-item"><i class="fa-solid fa-plus"></i> Añadir Patrocinador</button>
            `;
        } else if (type === 'timeline') {
            headerTitle = 'Módulo de Línea de Tiempo (Hitos)'; iconHtml = '<i class="fa-solid fa-stream text-accent"></i>';
            contentHtml = `
                <div class="form-group mb-2"><label>Título de sección:</label><input type="text" class="module-title" value="${data.title || 'Hitos del Proyecto'}"></div>
                <div class="timeline-list-editor"></div>
                <button type="button" class="btn-add-item"><i class="fa-solid fa-plus"></i> Añadir Hito</button>
            `;
        }

        // Estructura del card con botones de orden, ACORDEÓN y cuerpo separado
        moduleCard.innerHTML = `
            <div class="module-header" onclick="MicrositeEditorApp.toggleModuleCollapse(this)">
                <h4 style="pointer-events:none;"><i class="fa-solid fa-chevron-down toggle-collapse-icon"></i> ${iconHtml} ${headerTitle}</h4>
                <div class="module-card-actions" onclick="event.stopPropagation();"> <button type="button" class="mod-btn" onclick="MicrositeEditorApp.moveModule(this, 'up')" title="Subir"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="mod-btn" onclick="MicrositeEditorApp.moveModule(this, 'down')" title="Bajar"><i class="fa-solid fa-arrow-down"></i></button>
                    <div style="width:1px; background:#e5e7eb; margin:0 5px;"></div>
                    <button type="button" class="mod-btn delete" onclick="this.closest('.module-card').remove()" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="module-body">
                ${contentHtml}
            </div>
        `;
        
        modulesContainer.appendChild(moduleCard);
        
        // Inicializar sub-ítems si aplica
        if (type === 'sponsors') {
            const listContainer = moduleCard.querySelector('.sponsors-list-editor');
            moduleCard.querySelector('.btn-add-item').addEventListener('click', () => this.addSponsorFields(listContainer));
            if (data.sponsors) data.sponsors.forEach(s => this.addSponsorFields(listContainer, s));
        } else if (type === 'timeline') {
            const listContainer = moduleCard.querySelector('.timeline-list-editor');
            moduleCard.querySelector('.btn-add-item').addEventListener('click', () => this.addTimelineFields(listContainer));
            if (data.milestones) data.milestones.forEach(m => this.addTimelineFields(listContainer, m));
        }
    },

    // --- NUEVA FUNCIÓN PARA COLAPSAR MÓDULOS ---
    toggleModuleCollapse(headerElement) {
        const card = headerElement.closest('.module-card');
        if (card) {
            card.classList.toggle('collapsed');
        }
    },

    // Funciones de Reordenamiento Visual
    moveModule(btn, direction) {
        const card = btn.closest('.module-card');
        const container = card.parentNode;
        if (direction === 'up' && card.previousElementSibling) {
            container.insertBefore(card, card.previousElementSibling);
        } else if (direction === 'down' && card.nextElementSibling) {
            container.insertBefore(card.nextElementSibling, card);
        }
    },

    addSponsorFields(container, data = {}) {
        const id = `sp-${Date.now()}`;
        const div = document.createElement('div'); div.className = 'item-fieldset';
        div.innerHTML = `
            <button type="button" class="btn-remove-item" onclick="this.parentElement.remove()">&times;</button>
            <div class="form-group mb-2"><label>URL del Logo:</label><input type="text" class="sponsor-logo-url" value="${data.logoUrl || ''}"></div>
            <div class="form-group"><label>Enlace Web:</label><input type="text" class="sponsor-site-url" value="${data.siteUrl || ''}"></div>
        `;
        container.appendChild(div);
    },

    addTimelineFields(container, data = {}) {
        const id = `tm-${Date.now()}`;
        const div = document.createElement('div'); div.className = 'item-fieldset';
        div.innerHTML = `
            <button type="button" class="btn-remove-item" onclick="this.parentElement.remove()">&times;</button>
            <div class="form-group mb-2"><label>Fecha (Ej: Mayo 2024):</label><input type="text" class="milestone-date" value="${data.date || ''}"></div>
            <div class="form-group mb-2"><label>Título:</label><input type="text" class="milestone-title" value="${data.title || ''}"></div>
            <div class="form-group"><label>Descripción:</label><textarea class="milestone-description" style="min-height:60px;">${data.description || ''}</textarea></div>
        `;
        container.appendChild(div);
    },

    // --- GUARDADO FINAL ---
    async handleFormSubmit(event) {
        event.preventDefault();
        tinymce.triggerSave();
        
        const saveBtn = document.getElementById('save-btn-header');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        
        // Validar Slug (Regex básico para URLs limpias)
        let slugInput = document.getElementById('project-slug').value.trim();
        slugInput = slugInput.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        document.getElementById('project-slug').value = slugInput;

        const micrositeData = {
            cover: { headline: document.getElementById('cover-headline').value, imageUrl: document.getElementById('cover-image-url').value },
            seo: { imageUrl: document.getElementById('seo-image-url').value },
            summary: { content: document.getElementById('summary-content').value },
            custom_modules: []
        };

        // Recorrer los módulos en el orden visual actual
        document.querySelectorAll('#custom-modules-container .module-card').forEach(moduleEl => {
            const type = moduleEl.dataset.moduleType;
            let moduleData = { id: moduleEl.dataset.moduleId, type: type, title: moduleEl.querySelector('.module-title').value };

            if (type === 'text' || type === 'embed') { moduleData.content = moduleEl.querySelector('.module-content').value; } 
            else if (type === 'subscription') {
                moduleData.text = moduleEl.querySelector('.module-text').value; moduleData.url = moduleEl.querySelector('.module-url').value;
            } 
            else if (type === 'sponsors') {
                moduleData.sponsors = Array.from(moduleEl.querySelectorAll('.item-fieldset')).map(el => ({
                    logoUrl: el.querySelector('.sponsor-logo-url').value, siteUrl: el.querySelector('.sponsor-site-url').value
                }));
            } 
            else if (type === 'timeline') {
                moduleData.milestones = Array.from(moduleEl.querySelectorAll('.item-fieldset')).map(el => ({
                    date: el.querySelector('.milestone-date').value, title: el.querySelector('.milestone-title').value, description: el.querySelector('.milestone-description').value
                }));
            }
            micrositeData.custom_modules.push(moduleData);
        });

        const updates = { 
            microsite_content: micrositeData, 
            microsite_is_public: document.getElementById('microsite-is-public').checked, 
            template_style: document.getElementById('template-style-select').value, 
            color_palette: document.getElementById('color-palette-select').value,
            associated_event_id: document.getElementById('associated-event-select').value || null,
            slug: slugInput
        };

        const { error } = await this.supabase.from('projects').update(updates).eq('id', this.currentProject.id);
        
        saveBtn.disabled = false; saveBtn.innerHTML = originalText;
        if (error) { console.error("Error al guardar:", error); alert("Hubo un error al guardar. Revisa la consola."); } 
        else { 
            this.currentProject.slug = slugInput; // Actualizamos memoria local
            alert("¡Microsite publicado y guardado con éxito!"); 
        }
    }
};

document.addEventListener('DOMContentLoaded', () => MicrositeEditorApp.init());