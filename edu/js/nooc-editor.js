// =================================================================
// /edu/js/nooc-editor.js - CEREBRO DEL CONSTRUCTOR NOOC
// Combina gestión modular, ImgBB, Editor.js Dinámico y Gamificación.
// =================================================================

const NoocApp = {
    supabase: null,
    user: null,
    IMGBB_KEY: "89d606fc7588367140913f93a4c89785",
    
    courseData: { thumbnail_url: null },
    modules: [], 
    editorInstances: {}, 

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        this.setupListeners();
        this.calculateXP();
        console.log("NoocApp Inicializado. Listo para ensamblar.");
    },

    setupListeners() {
        document.getElementById('thumbnail-upload-box').addEventListener('click', () => this.uploadImageToImgBB());
        document.getElementById('btn-save-course').addEventListener('click', () => this.publishCourse());
        document.getElementById('btn-ai-optimize').addEventListener('click', () => this.callAIAssistant());
    },

    calculateXP() {
        const isInst = document.getElementById('toggle-institutional').checked;
        const baseModuleXP = isInst ? 200 : 100;
        let totalXP = 0;
        if (document.getElementById('toggle-start-feed').checked) totalXP += 50;
        if (document.getElementById('toggle-end-feed').checked) totalXP += 50;
        this.modules.forEach(mod => {
            totalXP += baseModuleXP;
            mod.lessons.forEach(() => totalXP += 20);
        });
        document.getElementById('xp-value').innerText = totalXP;
    },

    async saveAllEditors() {
        const editorKeys = Object.keys(this.editorInstances);
        for (let i = 0; i < editorKeys.length; i++) {
            const lessonId = editorKeys[i];
            const editor = this.editorInstances[lessonId];
            try {
                if (editor && typeof editor.save === 'function') {
                    const savedData = await editor.save();
                    this.modules.forEach(m => {
                        const les = m.lessons.find(l => l.id === lessonId);
                        if (les && les.type === 'texto') les.content_payload = savedData;
                    });
                }
            } catch (e) { console.warn("Editor aún no listo o vacío:", lessonId); }
        }
    },

    generateId() { return Math.random().toString(36).substr(2, 9); },

    async addModule() {
        await this.saveAllEditors();
        document.getElementById('empty-canvas-state').style.display = 'none';
        const modId = 'mod_' + this.generateId();
        this.modules.push({ id: modId, title: 'Nuevo Módulo', lessons: [] });
        this.renderCanvas();
        this.calculateXP();
    },

    async deleteModule(moduleId) {
        if(confirm("¿Estás seguro de borrar todo el módulo? Se perderán todas sus lecciones.")) {
            await this.saveAllEditors();
            this.modules = this.modules.filter(m => m.id !== moduleId);
            this.renderCanvas();
            this.calculateXP();
        }
    },

    async addLesson(moduleId) {
        await this.saveAllEditors();
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;

        const lessonId = 'les_' + this.generateId();
        // CORRECCIÓN: Estructura estricta que exige Editor.js para no dar error
        const emptyEditorData = { time: Date.now(), blocks: [], version: "2.28.2" };
        mod.lessons.push({ id: lessonId, title: 'Nueva Lección', type: 'texto', content_payload: emptyEditorData });
        
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

        this.modules.forEach(mod => {
            mod.lessons.forEach(les => {
                if (les.type === 'texto') this.initEditorJs(les.id, les.content_payload);
            });
        });
    },

    generateLessonHTML(modId, les, index) {
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
        
        // CORRECCIÓN: Estructura estricta para evitar el error amarillo
        lesson.content_payload = val === 'texto' ? { time: Date.now(), blocks: [], version: "2.28.2" } : '';
        
        if(val !== 'texto') delete this.editorInstances[lId];
        this.renderCanvas(); 
    },

    updateLessonContent(mId, lId, val) { this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).content_payload = val; },
    updateModTitle(id, val) { this.modules.find(m => m.id === id).title = val; },
    updateLessonTitle(mId, lId, val) { this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId).title = val; },

    initEditorJs(lessonId, existingData = { blocks: [] }) {
        if (this.editorInstances[lessonId] && typeof this.editorInstances[lessonId].destroy === 'function') {
            try { this.editorInstances[lessonId].destroy(); } catch(e) {}
        }
        const editor = new EditorJS({
            holder: `editor_${lessonId}`,
            placeholder: 'Escribe tu lección aquí. Usa "/" para comandos.',
            data: existingData, 
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

    callAIAssistant() {
        const area = document.getElementById('ai-response-area');
        area.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analizando contexto...';
        setTimeout(() => {
            area.innerHTML = `<strong>Propuesta de Mejora:</strong><br>Optimización lista.`;
        }, 2000);
    },

    async publishCourse() {
        const btn = document.getElementById('btn-save-course');
        const title = document.getElementById('course-title').value;
        const slug = document.getElementById('course-slug').value;

        if (!title || !slug) return alert("El título y el slug son obligatorios.");
        if (this.modules.length === 0) return alert("Debes añadir al menos un módulo.");

        await this.saveAllEditors();
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ensamblando Red Académica...';
        btn.disabled = true;

        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error("Sesión expirada. Por favor recarga.");

            const { data: tronco, error: troncoError } = await this.supabase.functions.invoke('bot-create-post', {
                body: {
                    postText: `🏫 NUEVO NOOC: ${title}\n\nEste hilo será el Ágora oficial para los alumnos. ¡Bienvenidos investigadores! 🎓\n\n#EPTedu`,
                    authorInfo: { displayName: 'Motor EPT' },
                    botType: 'cursos'
                }
            });
            if (troncoError || !tronco?.success) throw new Error("Error de conexión con Bluesky al crear el Tronco.");

            const { data: courseData, error: courseError } = await this.supabase.from('nooc_courses').insert([{
                title: title, slug: slug,
                thumbnail_url: this.courseData?.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg',
                created_by: user.id, is_published: true,
                bsky_uri: tronco.uri, bsky_cid: tronco.cid
            }]).select().single();
            
            // SEGURO AÑADIDO: Si hay error en el SQL, lo atrapa y lo muestra
            if (courseError) throw new Error("Error DB Curso: " + courseError.message);

            for (let i = 0; i < this.modules.length; i++) {
                let mod = this.modules[i];
                const { data: savedMod, error: modError } = await this.supabase.from('nooc_modules').insert([{
                    course_id: courseData.id, 
                    order_index: i + 1,
                    title: mod.title, 
                    content_type: 'modulo', // <-- ESTA LÍNEA SALVA EL ERROR DE LA BD
                    xp_reward: document.getElementById('toggle-institutional').checked ? 200 : 100
                }]).select().single();
                
                if (modError) throw new Error("Error DB Módulo: " + modError.message);

                for (let j = 0; j < mod.lessons.length; j++) {
                    let les = mod.lessons[j];
                    const { data: rama } = await this.supabase.functions.invoke('bot-create-post', {
                        body: {
                            postText: `📖 Lección 0${j+1}: ${les.title}\n\nUsa este espacio para debatir los contenidos de este bloque.`,
                            authorInfo: { displayName: 'Motor EPT' },
                            botType: 'cursos',
                            replyTo: { rootUri: tronco.uri, rootCid: tronco.cid, parentUri: tronco.uri, parentCid: tronco.cid }
                        }
                    });

                    const { error: lessonError } = await this.supabase.from('nooc_lessons').insert([{
                        module_id: savedMod.id, order_index: j + 1,
                        title: les.title, content_type: les.type,
                        content_payload: les.content_payload,
                        bsky_uri: rama?.uri, bsky_cid: rama?.cid,
                        xp_reward: 20
                    }]);
                    
                    if (lessonError) throw new Error("Error DB Lección: " + lessonError.message);
                }
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Ecosistema Listo';
            alert(`¡Curso publicado! El Árbol de Conocimiento se ha generado en Bluesky.`);
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