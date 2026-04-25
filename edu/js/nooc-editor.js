// =================================================================
// /edu/js/nooc-editor.js - CEREBRO DEL CONSTRUCTOR NOOC
// Combina gestión modular, ImgBB, Editor.js Dinámico y Gamificación.
// =================================================================

const NoocApp = {
    supabase: null,
    user: null,
    IMGBB_KEY: "89d606fc7588367140913f93a4c89785",
    
    // Estado de la aplicación
    courseData: {
        thumbnail_url: null
    },
    modules: [], // Almacena { id, title, lessons: [] }
    editorInstances: {}, // Mapa de ID de lección -> Instancia Editor.js

    // El Prompt del Asistente heredado de tu editor.js
    SYSTEM_PROMPT: `Eres un Asistente Experto en Diseño Instruccional de Epistecnología. 
    Analiza el texto de la lección y devuélvelo mejorado, más didáctico y genera 2 prompts para imágenes.`,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        this.setupListeners();
        this.calculateXP(); // Cálculo inicial (0)
        console.log("NoocApp Inicializado. Listo para ensamblar.");
    },

    setupListeners() {
        // Subida de Portada
        document.getElementById('thumbnail-upload-box').addEventListener('click', () => this.uploadImageToImgBB());
        // Botón Publicar
        document.getElementById('btn-save-course').addEventListener('click', () => this.publishCourse());
        // Asistente IA (Mockup)
        document.getElementById('btn-ai-optimize').addEventListener('click', () => this.callAIAssistant());
    },

    // --- LÓGICA DE GAMIFICACIÓN (XP) ---
    calculateXP() {
        const isInst = document.getElementById('toggle-institutional').checked;
        const baseModuleXP = isInst ? 200 : 100;
        
        let totalXP = 0;
        
        // XP Social Base
        if (document.getElementById('toggle-start-feed').checked) totalXP += 50;
        if (document.getElementById('toggle-end-feed').checked) totalXP += 50;

        // XP por Módulos y Lecciones
        this.modules.forEach(mod => {
            totalXP += baseModuleXP; // Puntos por existir el módulo
            mod.lessons.forEach(les => {
                totalXP += 20; // Puntos fijos por lección (configurable a futuro)
            });
        });

        document.getElementById('xp-value').innerText = totalXP;
    },

    // --- CONSTRUCTOR MODULAR ---
    generateId() { return Math.random().toString(36).substr(2, 9); },

    addModule() {
        document.getElementById('empty-canvas-state').style.display = 'none';
        const modId = 'mod_' + this.generateId();
        
        this.modules.push({ id: modId, title: 'Nuevo Módulo', lessons: [] });
        this.renderCanvas();
        this.calculateXP();
    },

    deleteModule(moduleId) {
        if(confirm("¿Estás seguro de borrar todo el módulo? Se perderán todas sus lecciones.")) {
            this.modules = this.modules.filter(m => m.id !== moduleId);
            // También limpiamos los editores asociados a sus lecciones
            this.renderCanvas();
            this.calculateXP();
        }
    },

    addLesson(moduleId) {
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;

        const lessonId = 'les_' + this.generateId();
        mod.lessons.push({ id: lessonId, title: 'Nueva Lección', type: 'texto', content: null });
        
        this.renderCanvas();
        this.calculateXP();
    },

    deleteLesson(moduleId, lessonId) {
        const mod = this.modules.find(m => m.id === moduleId);
        mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
        delete this.editorInstances[lessonId]; // Limpiar memoria
        this.renderCanvas();
        this.calculateXP();
    },

    renderCanvas() {
        const container = document.getElementById('modules-container');
        container.innerHTML = '';

        this.modules.forEach((mod, modIndex) => {
            const modHtml = `
                <div class="module-card">
                    <div class="module-header">
                        <input type="text" value="${mod.title}" onchange="NoocApp.updateModTitle('${mod.id}', this.value)">
                        <div style="display:flex; gap:10px;">
                            <button onclick="NoocApp.addLesson('${mod.id}')" class="btn-add-module" style="border:none;"><i class="fa-solid fa-plus"></i> Añadir Lección</button>
                            <button onclick="NoocApp.deleteModule('${mod.id}')" class="btn-delete" style="width:30px; height:30px;"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                    <div class="module-body">
                        ${mod.lessons.length === 0 ? '<p style="color:#666; font-size:0.85rem; margin:0;">No hay lecciones. Añade una.</p>' : ''}
                        ${mod.lessons.map((les, index) => this.generateLessonHTML(mod.id, les, index)).join('')}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', modHtml);
        });

        // Inicializar los editores nuevos
        this.modules.forEach(mod => {
            mod.lessons.forEach(les => {
                if (les.type === 'texto' && !this.editorInstances[les.id]) {
                    this.initEditorJs(les.id);
                }
            });
        });
    },

    // Reemplaza o añade estas funciones en tu objeto NoocApp:

    generateLessonHTML(modId, les, index) {
        const savedContent = typeof les.content_payload === 'string' ? les.content_payload : '';

        return `
            <div class="lesson-card">
                <div class="lesson-header">
                    <span style="color:#666; font-weight:bold;">0${index + 1}</span>
                    <select onchange="NoocApp.updateLessonType('${modId}', '${les.id}', this.value)">
                        <option value="texto" ${les.type === 'texto' ? 'selected' : ''}>Texto (Editor.js)</option>
                        <option value="video" ${les.type === 'video' ? 'selected' : ''}>Video (YouTube)</option>
                        <option value="iframe" ${les.type === 'iframe' ? 'selected' : ''}>Iframe / HTML Puro</option>
                    </select>
                    <input type="text" value="${les.title}" placeholder="Título de la lección" onchange="NoocApp.updateLessonTitle('${modId}', '${les.id}', this.value)">
                    <button class="btn-delete" onclick="NoocApp.deleteLesson('${modId}', '${les.id}')" title="Eliminar Lección"><i class="fa-solid fa-trash"></i></button>
                </div>
                
                ${les.type === 'texto' 
                    ? `<div id="editor_${les.id}" class="editor-container"></div>` 
                    
                    : les.type === 'video'
                    ? `<input type="text" value="${savedContent}" placeholder="Pega el enlace del Video aquí..." onchange="NoocApp.updateLessonContent('${modId}', '${les.id}', this.value)" style="width:100%; padding:10px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.1);">`
                    
                    : `<textarea placeholder="Pega aquí código <iframe> de Canva, Genially, o HTML puro..." onchange="NoocApp.updateLessonContent('${modId}', '${les.id}', this.value)" style="width:100%; padding:10px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.1); min-height: 80px; font-family: monospace;">${savedContent}</textarea>`
                }
            </div>
        `;
    },

    updateLessonType(mId, lId, val) { 
        const lesson = this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId);
        lesson.type = val; 
        
        // Si cambiamos de tipo, limpiamos el contenido anterior para evitar conflictos
        lesson.content_payload = val === 'texto' ? {} : '';
        
        if(val !== 'texto') delete this.editorInstances[lId];
        this.renderCanvas(); 
    },

    // NUEVA FUNCIÓN: Guarda el texto del iframe o video en la memoria del JSON
    updateLessonContent(mId, lId, val) {
        this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).content_payload = val;
    },

    // Actualizadores de estado
    updateModTitle(id, val) { this.modules.find(m => m.id === id).title = val; },
    updateLessonTitle(mId, lId, val) { this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).title = val; },

    // --- INTEGRACIÓN EDITOR.JS ---
    initEditorJs(lessonId) {
        const editor = new EditorJS({
            holder: `editor_${lessonId}`,
            placeholder: 'Escribe tu lección aquí. Usa "/" para comandos o selecciona texto.',
            // Activamos la barra de herramientas al seleccionar texto
            inlineToolbar: ['link', 'bold', 'italic'], 
            tools: {
                header: {
                    class: Header,
                    inlineToolbar: true,
                    config: { placeholder: 'Título de sección', levels: [2, 3, 4], defaultLevel: 2 }
                },
                list: {
                    class: EditorjsList, // <-- SOLUCIÓN AL ERROR DE CONSOLA
                    inlineToolbar: true
                },
                raw: {
                    class: RawTool, // <-- NUEVA HERRAMIENTA DE HTML/CÓDIGO
                },
                image: {
                    class: ImageTool,
                    config: {
                        uploader: {
                            uploadByFile: async (file) => {
                                const formData = new FormData(); formData.append('image', file);
                                const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_KEY}`, { method: 'POST', body: formData });
                                const data = await res.json();
                                return { success: 1, file: { url: data.data.url } };
                            }
                        }
                    }
                }
            }
        });
        this.editorInstances[lessonId] = editor;
    },

    // --- INTEGRACIÓN IMGBB (PORTADA) ---
    async uploadImageToImgBB() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0]; if(!file) return;
            const box = document.getElementById('thumbnail-upload-box');
            box.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
            
            const formData = new FormData(); formData.append('image', file);
            try {
                const res = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_KEY}`, { method: 'POST', body: formData });
                const data = await res.json();
                this.courseData.thumbnail_url = data.data.url;
                
                box.innerHTML = `<img src="${data.data.url}" style="width:100%; border-radius:8px; display:block;">`;
            } catch (err) { alert("Error al subir imagen"); box.innerHTML = 'Error'; }
        };
        input.click();
    },

    // --- ASISTENTE IA ---
    callAIAssistant() {
        const area = document.getElementById('ai-response-area');
        area.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando el contexto del curso y buscando mejoras didácticas...';
        
        // Simulación: Aquí conectarás tu Edge Function de IA
        setTimeout(() => {
            area.innerHTML = `
                <strong style="color:var(--accent-red);">Propuesta de Mejora:</strong><br><br>
                Tu última lección está muy técnica. Sugiero empezar con esta analogía:<br>
                <em>"Imagina la red descentralizada como un archipiélago donde cada isla es un servidor..."</em><br><br>
                <strong>Prompts Visuales:</strong><br>
                1. "A futuristic archipelago of glowing islands connected by digital light beams, cinematic lighting."
            `;
        }, 2000);
    },

    // --- ENSAMBLE Y GUARDADO (SUPABASE) ---
    async publishCourse() {
        const btn = document.getElementById('btn-save-course');
        const title = document.getElementById('course-title').value;
        const slug = document.getElementById('course-slug').value;

        if (!title || !slug) return alert("El título y el slug son obligatorios.");
        if (this.modules.length === 0) return alert("Debes añadir al menos un módulo.");

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ensamblando...';
        btn.disabled = true;

        try {
            // 1. Recopilar datos de todos los editores
            for (let mod of this.modules) {
                for (let les of mod.lessons) {
                    if (les.type === 'texto' && this.editorInstances[les.id]) {
                        les.content_payload = await this.editorInstances[les.id].save();
                    }
                }
            }

            // 2. Guardar Curso (Insert)
            const { data: courseData, error: courseError } = await this.supabase.from('nooc_courses').insert([{
                title: title, slug: slug,
                thumbnail_url: this.courseData.thumbnail_url,
                created_by: this.user.id,
                is_published: true
            }]).select().single();
            if (courseError) throw courseError;

            // 3. Guardar Módulos y Lecciones (Relacional)
            for (let i = 0; i < this.modules.length; i++) {
                let mod = this.modules[i];
                const { data: savedMod, error: modError } = await this.supabase.from('nooc_modules').insert([{
                    course_id: courseData.id, order_index: i + 1,
                    title: mod.title, content_type: 'bloque',
                    xp_reward: document.getElementById('toggle-institutional').checked ? 200 : 100
                }]).select().single();
                if (modError) throw modError;

                for (let j = 0; j < mod.lessons.length; j++) {
                    let les = mod.lessons[j];
                    await this.supabase.from('nooc_lessons').insert([{
                        module_id: savedMod.id, order_index: j + 1,
                        title: les.title, content_type: les.type,
                        content_payload: les.content_payload || {},
                        xp_reward: 20
                    }]);
                }
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Publicado con Éxito';
            alert(`¡Curso "${title}" publicado e indexado en el ecosistema!`);
            setTimeout(() => window.location.href = '/edu', 2000);

        } catch (err) {
            console.error(err);
            alert("Error al publicar: " + err.message);
            btn.innerHTML = 'Reintentar Publicación';
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => NoocApp.init());