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

    // --- NUEVA FUNCIÓN: Guarda TODOS los editores antes de recargar el DOM ---
    async saveAllEditors() {
        const editorKeys = Object.keys(this.editorInstances);
        for (let i = 0; i < editorKeys.length; i++) {
            const lessonId = editorKeys[i];
            const editor = this.editorInstances[lessonId];
            try {
                if (editor && typeof editor.save === 'function') {
                    const savedData = await editor.save();
                    // Buscamos a qué lección pertenece y guardamos el JSON
                    this.modules.forEach(m => {
                        const les = m.lessons.find(l => l.id === lessonId);
                        if (les && les.type === 'texto') {
                            les.content_payload = savedData;
                        }
                    });
                }
            } catch (e) {
                console.warn("Editor aún no listo o vacío:", lessonId);
            }
        }
    },

    // --- CONSTRUCTOR MODULAR ---
    generateId() { return Math.random().toString(36).substr(2, 9); },

    async addModule() {
        await this.saveAllEditors(); // Salvamos textos antes de redibujar
        document.getElementById('empty-canvas-state').style.display = 'none';
        const modId = 'mod_' + this.generateId();
        
        this.modules.push({ id: modId, title: 'Nuevo Módulo', lessons: [] });
        this.renderCanvas();
        this.calculateXP();
    },

    async deleteModule(moduleId) {
        if(confirm("¿Estás seguro de borrar todo el módulo? Se perderán todas sus lecciones.")) {
            await this.saveAllEditors(); // Salvamos textos antes de redibujar
            this.modules = this.modules.filter(m => m.id !== moduleId);
            this.renderCanvas();
            this.calculateXP();
        }
    },

    async addLesson(moduleId) {
        await this.saveAllEditors(); // AQUÍ ESTABA EL ERROR: Ahora salva todo antes de añadir
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;

        const lessonId = 'les_' + this.generateId();
        // Inicializamos content_payload como un objeto vacío para Editor.js
        mod.lessons.push({ id: lessonId, title: 'Nueva Lección', type: 'texto', content_payload: {} });
        
        this.renderCanvas();
        this.calculateXP();
    },

    async deleteLesson(moduleId, lessonId) {
        await this.saveAllEditors();
        const mod = this.modules.find(m => m.id === moduleId);
        mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
        delete this.editorInstances[lessonId]; 
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

        // Volvemos a inicializar los editores de texto pasando los datos guardados
        this.modules.forEach(mod => {
            mod.lessons.forEach(les => {
                if (les.type === 'texto') {
                    this.initEditorJs(les.id, les.content_payload);
                }
            });
        });
    },

    generateLessonHTML(modId, les, index) {
        // Si no es texto, extraemos el string guardado
        const savedContent = (les.type !== 'texto' && typeof les.content_payload === 'string') ? les.content_payload : '';

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

    async updateLessonType(mId, lId, val) { 
        await this.saveAllEditors();
        const lesson = this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId);
        lesson.type = val; 
        lesson.content_payload = val === 'texto' ? {} : '';
        if(val !== 'texto') delete this.editorInstances[lId];
        this.renderCanvas(); 
    },

    updateLessonContent(mId, lId, val) {
        this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).content_payload = val;
    },

    updateModTitle(id, val) { this.modules.find(m => m.id === id).title = val; },
    updateLessonTitle(mId, lId, val) { this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).title = val; },

    // --- INTEGRACIÓN EDITOR.JS ---
    initEditorJs(lessonId, existingData = {}) {
        // Destruir instancia previa si por algún motivo quedó en memoria
        if (this.editorInstances[lessonId] && typeof this.editorInstances[lessonId].destroy === 'function') {
            try { this.editorInstances[lessonId].destroy(); } catch(e) {}
        }

        const editor = new EditorJS({
            holder: `editor_${lessonId}`,
            placeholder: 'Escribe tu lección aquí. Usa "/" para comandos o selecciona texto.',
            data: existingData, // Inyectamos el texto que habíamos guardado
            inlineToolbar: ['link', 'bold', 'italic'], 
            tools: {
                header: { class: Header, inlineToolbar: true, config: { placeholder: 'Título de sección', levels: [2, 3, 4], defaultLevel: 2 } },
                list: { class: EditorjsList, inlineToolbar: true },
                raw: { class: RawTool },
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

    // --- NUEVA FUNCIÓN: Salva el texto antes de que cambies de lección ---
    async saveCurrentEditorState() {
        if (this.activeLessonId && this.editorInstances[this.activeLessonId]) {
            try {
                const savedData = await this.editorInstances[this.activeLessonId].save();
                // Busca la lección en la memoria y le guarda el texto
                this.modules.forEach(m => {
                    const les = m.lessons.find(l => l.id === this.activeLessonId);
                    if (les) les.content_payload = savedData;
                });
            } catch (e) {
                console.error("Error guardando el texto en memoria:", e);
            }
        }
    },

    // --- FUNCIÓN PUBLICAR BLINDADA CONTRA NULOS ---
    async publishCourse() {
        const btn = document.getElementById('btn-save-course');
        const title = document.getElementById('course-title').value;
        const slug = document.getElementById('course-slug').value;

        if (!title || !slug) return alert("El título y el slug son obligatorios.");
        if (this.modules.length === 0) return alert("Debes añadir al menos un módulo.");

        // 1. Aseguramos que guarde la última lección en la que estabas escribiendo
        await this.saveAllEditors();

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando Árbol de Conocimiento...';
        btn.disabled = true;

        try {
            // 2. Traemos al usuario de forma segura (AQUÍ ESTÁ LA SOLUCIÓN AL ERROR NULL)
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error("Sesión expirada. Por favor, recarga la página e inicia sesión.");

            // 3. CREAR EL "POST TRONCO" EN BLUESKY
            const { data: tronco, error: troncoError } = await this.supabase.functions.invoke('bot-create-post', {
                body: {
                    postText: `🏫 NUEVO NOOC: ${title}\n\nEste hilo será el Ágora oficial para los alumnos. ¡Bienvenidos investigadores! 🎓\n\n#EPTedu`,
                    authorInfo: { displayName: 'Motor EPT' },
                    botType: 'cursos'
                }
            });
            if (troncoError || !tronco?.success) throw new Error("Error creando el hilo maestro en Bsky");

            // 4. GUARDAR EL CURSO EN SUPABASE
            const { data: courseData, error: courseError } = await this.supabase.from('nooc_courses').insert([{
                title: title, slug: slug,
                thumbnail_url: this.courseData?.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg',
                created_by: user.id, // Usamos la variable segura
                is_published: true,
                bsky_uri: tronco.uri, 
                bsky_cid: tronco.cid
            }]).select().single();
            if (courseError) throw courseError;

            // 5. PROCESAR MÓDULOS Y LECCIONES
            for (let i = 0; i < this.modules.length; i++) {
                let mod = this.modules[i];
                const { data: savedMod, error: modError } = await this.supabase.from('nooc_modules').insert([{
                    course_id: courseData.id, order_index: i + 1,
                    title: mod.title, xp_reward: document.getElementById('toggle-institutional').checked ? 200 : 100
                }]).select().single();

                for (let j = 0; j < mod.lessons.length; j++) {
                    let les = mod.lessons[j];
                    
                    // CREAR "POST RAMA" (Hilo de la lección)
                    const { data: rama } = await this.supabase.functions.invoke('bot-create-post', {
                        body: {
                            postText: `📖 Lección: ${les.title}\n\nUsa este espacio para debatir los contenidos de este bloque.`,
                            authorInfo: { displayName: 'Motor EPT' },
                            botType: 'cursos',
                            replyTo: { rootUri: tronco.uri, rootCid: tronco.cid, parentUri: tronco.uri, parentCid: tronco.cid }
                        }
                    });

                    // Insertamos la lección en la BD (les.content_payload ya está guardado por la nueva función)
                    await this.supabase.from('nooc_lessons').insert([{
                        module_id: savedMod.id, order_index: j + 1,
                        title: les.title, content_type: les.type,
                        content_payload: les.content_payload,
                        bsky_uri: rama?.uri, 
                        bsky_cid: rama?.cid,
                        xp_reward: 20
                    }]);
                }
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Ecosistema Listo';
            alert(`¡Curso publicado! Hilos académicos generados en @cursos.epistecnologia.com`);
            setTimeout(() => window.location.href = '/edu', 2000);

        } catch (err) {
            console.error(err);
            alert("Fallo en el ensamble: " + err.message);
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Publicar Curso';
            btn.disabled = false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => NoocApp.init());