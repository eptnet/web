// =================================================================
// /edu/js/nooc-editor.js - CEREBRO SAAS (V7: Portadas Perfectas 50/50)
// =================================================================

const NoocApp = {
    supabase: null,
    user: null,
    userProfile: null,
    IMGBB_KEY: "89d606fc7588367140913f93a4c89785",
    
    courseData: { thumbnail_url: null },
    modules: [], 
    editorInstances: {}, 
    
    isEditing: false,
    editingCourseId: null,
    bsky_uri: null,
    bsky_cid: null,
    rawImageBlob: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;

        const { data: profile } = await this.supabase.from('profiles').select('display_name, username').eq('id', this.user.id).single();
        this.userProfile = profile;

        this.setupListeners();

        const activeCourseData = sessionStorage.getItem('activeCourse');
        if (activeCourseData) {
            await this.loadExistingCourse(JSON.parse(activeCourseData));
        }

        this.calculateXP();
    },

    setupListeners() {
        document.getElementById('thumbnail-upload-box')?.addEventListener('click', () => this.uploadImageToImgBB());
        
        document.getElementById('course-thumbnail-url')?.addEventListener('input', async (e) => {
            const url = e.target.value.trim();
            if (url.startsWith('http')) {
                this.courseData.thumbnail_url = url;
                document.getElementById('thumbnail-upload-box').innerHTML = `<img src="${url}" style="width:100%; border-radius:8px; display:block; object-fit:cover; height:100%;">`;
                this.rawImageBlob = url;
                document.getElementById('ai-gallery-img').src = url;
                document.getElementById('ai-gallery').style.display = 'block';
            }
        });

        document.getElementById('btn-ai-optimize')?.addEventListener('click', () => this.callAIAssistant());
        document.getElementById('btn-generate-img-ai')?.addEventListener('click', () => this.generateCourseImageAI());
        document.getElementById('btn-apply-ept-style')?.addEventListener('click', () => this.applyEptBranding());
        document.getElementById('btn-use-img')?.addEventListener('click', (e) => this.uploadGeneratedImage(e));
        
        document.getElementById('btn-save-draft')?.addEventListener('click', () => this.saveCourseData(false, false));
        document.getElementById('btn-save-course')?.addEventListener('click', () => this.saveCourseData(true, false));
        document.getElementById('btn-preview-course')?.addEventListener('click', () => this.saveCourseData(false, true));
    },

    // --- 1. IA CONSULTORA PEDAGÓGICA ---
    async callAIAssistant() {
        const promptInput = document.getElementById('ai-course-prompt')?.value.trim();
        if (!promptInput) return alert("Escribe de qué tratará tu curso.");

        const btn = document.getElementById('btn-ai-optimize');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Diseñando...';
        btn.disabled = true;

        const systemPrompt = `Eres un experto diseñador instruccional asesorando a un creador de cursos. 
        Crea la estructura de un nano-curso (NOOC) de autoformación sobre: "${promptInput}". 
        Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
        {
          "title": "Título del curso (MUY CORTO: Máximo 4 a 5 palabras, atractivo y memorable)",
          "description": "Párrafo persuasivo",
          "image_prompt": "Prompt en INGLÉS, hiperdetallado, fotorrealista para generar la portada del curso. Sin texto.",
          "modules": [
            { "title": "Nombre Módulo 1", "lessons": [
                { "title": "Lección 1", "tips": [
                    "💡 **TIPS PARA LA LECCIÓN (Borra esto antes de publicar):**", 
                    "👉 En este módulo sugerido deberías crear las secciones: 1. Introducción a X, 2. Ejemplo Práctico de Y.", 
                    "👉 Recomendación: Graba un video corto o incrusta un diseño de Canva para ilustrar el contenido."
                ] }
            ]}
          ]
        }`;

        try {
            const { data, error } = await this.supabase.functions.invoke('generate-text', { 
                body: { textContent: "Temática: " + promptInput, promptType: 'generate_from_instructions', customPrompt: systemPrompt } 
            });
            if (error) throw error;

            let jsonString = data.result.replace(/```json/gi, '').replace(/```/g, '').trim();
            const courseDesign = JSON.parse(jsonString);

            if (courseDesign.title) document.getElementById('course-title').value = courseDesign.title;
            if (courseDesign.description) document.getElementById('course-description').value = courseDesign.description;
            if (courseDesign.image_prompt) document.getElementById('ai-image-prompt').value = courseDesign.image_prompt;

            if (courseDesign.modules && courseDesign.modules.length > 0) {
                document.getElementById('empty-canvas-state').style.display = 'none';
                this.modules = [];
                this.editorInstances = {};

                courseDesign.modules.forEach(modData => {
                    const modId = 'mod_' + this.generateId();
                    const newMod = { id: modId, title: modData.title, lessons: [] };
                    
                    if (modData.lessons) {
                        modData.lessons.forEach(lesData => {
                            const lessonId = 'les_' + this.generateId();
                            const lessonBlocks = [];
                            if (lesData.tips) {
                                lesData.tips.forEach(tip => {
                                    let formattedTip = tip.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                                    lessonBlocks.push({ type: "paragraph", data: { text: formattedTip } });
                                });
                            }
                            newMod.lessons.push({ 
                                id: lessonId, title: lesData.title, type: 'texto', 
                                content_payload: { time: Date.now(), blocks: lessonBlocks, version: "2.28.2" } 
                            });
                        });
                    }
                    this.modules.push(newMod);
                });

                this.renderCanvas();
                this.calculateXP();
            }
            alert("¡Diseño Instruccional completado! Revisa los consejos en cada lección.");

        } catch (err) {
            alert("La IA tuvo un problema de formato. Intenta acortar tu instrucción.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // --- 2. IA VISUAL ---
    async generateCourseImageAI() {
        const promptInput = document.getElementById('ai-image-prompt').value.trim();
        if (!promptInput) return alert("Describe la imagen o usa la IA Diseñadora primero.");

        const btn = document.getElementById('btn-generate-img-ai');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Pintando...';
        btn.disabled = true;

        try {
            const cleanPrompt = `${promptInput}, cinematic, highly detailed, 4k, no text, no watermarks`;
            const { data: imgData, error } = await this.supabase.functions.invoke('generate-image', { 
                body: { prompt: cleanPrompt, style: 'photographic', ratio: '16:9', engine: 'flux' } 
            });
            
            if (error) throw error;
            if (imgData && imgData.error) throw new Error(imgData.error);

            let imageSrc = null;
            if (typeof imgData === 'string') imageSrc = imgData;
            else if (imgData?.image) imageSrc = imgData.image;
            else if (imgData?.result) imageSrc = imgData.result;
            else if (imgData?.url) imageSrc = imgData.url;

            if (!imageSrc) throw new Error("Estructura de API desconocida.");

            if (!imageSrc.startsWith('http') && !imageSrc.startsWith('data:')) {
                imageSrc = 'data:image/jpeg;base64,' + imageSrc;
            }

            this.rawImageBlob = imageSrc; 
            document.getElementById('ai-gallery-img').src = this.rawImageBlob;
            document.getElementById('ai-gallery').style.display = 'block';

        } catch (err) {
            console.error(err);
            alert("Error generando la imagen. Revisa la consola.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // --- 3. ESTILIZADOR DE PORTADA (ESTILO EPT EDU - DISEÑO EXACTO) ---
    async applyEptBranding() {
        if (!this.rawImageBlob) return alert("Genera o pega una imagen primero.");
        const title = document.getElementById('course-title').value.trim() || "CURSO SIN TÍTULO";
        const isInstActive = document.getElementById('toggle-institutional')?.checked;
        const instName = document.getElementById('inst-name')?.value || "";

        const btn = document.getElementById('btn-apply-ept-style');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Maquetando Estilo...';

        try {
            const loadImage = (url) => new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = url;
            });

            const baseImg = await loadImage(this.rawImageBlob);
            const logoEdu = await loadImage('https://i.ibb.co/DHyTWkH0/LOGO-EDU.png');

            const canvas = document.createElement('canvas');
            canvas.width = 1280; canvas.height = 720; 
            const ctx = canvas.getContext('2d');

            // 1. Imagen de Fondo
            if (baseImg) {
                const sourceHeight = baseImg.width * (9 / 16); 
                const sourceY = (baseImg.height - sourceHeight) / 2; 
                ctx.drawImage(baseImg, 0, sourceY, baseImg.width, sourceHeight, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = "#070a13"; ctx.fillRect(0,0,canvas.width, canvas.height);
            }

            // 2. Bloque lateral oscuro (Azul institucional)
            ctx.fillStyle = "rgba(4, 21, 63, 0.95)"; // Azul oscuro al estilo de tu demo
            ctx.fillRect(0, 0, canvas.width / 2, canvas.height);

            // 3. Plexus Decorativo en el lateral
            for(let i=0; i<60; i++) {
                ctx.beginPath();
                ctx.arc(Math.random() * (canvas.width / 2), Math.random() * canvas.height, Math.random() * 2, 0, Math.PI*2);
                ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill();
            }

            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "left"; 

            // 4. Logo Superior (El nuevo logo largo)
            if (logoEdu) {
                const targetWidth = 140; 
                const targetHeight = (logoEdu.height / logoEdu.width) * targetWidth;
                ctx.drawImage(logoEdu, 60, 50, targetWidth, targetHeight);
            }
            
            if (isInstActive && instName) {
                ctx.font = "italic 18px Arial"; ctx.fillStyle = "#f59e0b";
                ctx.fillText(`En colaboración con: ${instName}`, 60, 160);
            }

            // 5. Título del Curso (Centro)
            ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
            ctx.font = "bold 55px 'Arial Black', Impact, sans-serif";
            
            const words = title.split(' ');
            let lines = [];
            let currentLine = "";
            
            words.forEach(word => {
                if ((currentLine + word).length < 16) {
                    currentLine += (currentLine === "" ? "" : " ") + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            });
            lines.push(currentLine);

            let startY = 250;
            lines.slice(0, 4).forEach((line, i) => { 
                ctx.fillStyle = i % 2 === 0 ? "#facc15" : "#ffffff"; // Alterna colores (Amarillo/Blanco)
                ctx.fillText(line, 60, startY + (i * 65));
            });

            // 6. Autor y CTA (Parte Inferior)
            ctx.shadowBlur = 0;
            ctx.font = "18px Arial"; ctx.fillStyle = "#e2e8f0";
            const creatorName = this.userProfile?.display_name || this.userProfile?.username || "Investigador";
            ctx.fillText(`Diseñado por`, 60, canvas.height - 180);
            
            ctx.font = "bold 22px Arial"; ctx.fillStyle = "#ffffff";
            ctx.fillText(creatorName, 60, canvas.height - 150);

            // Registro (Llamado a la acción)
            ctx.font = "bold 28px Arial"; ctx.fillStyle = "#ffffff";
            ctx.fillText("REGÍSTRATE EN:", 60, canvas.height - 85);
            ctx.font = "24px Arial"; ctx.fillStyle = "#e2e8f0";
            ctx.fillText("epistecnologia.com/edu", 60, canvas.height - 50);

            document.getElementById('ai-gallery-img').src = canvas.toDataURL('image/jpeg', 0.92);

        } catch (e) {
            console.error(e);
            alert("Error aplicando el diseño EPT EDU.");
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Aplicar Estilo EPT';
        }
    },

    // --- 4. SUBIR A IMGBB ---
    async uploadGeneratedImage(e) {
        const btn = e.target;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a la Nube...';
        btn.disabled = true;

        try {
            const base64Clean = document.getElementById('ai-gallery-img').src.split(',')[1];
            const formData = new FormData();
            formData.append("image", base64Clean);
            
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${this.IMGBB_KEY}`, { method: "POST", body: formData });
            if (!response.ok) throw new Error("Fallo ImgBB");
            const data = await response.json();
            
            const urlInput = document.getElementById('course-thumbnail-url');
            if (urlInput) urlInput.value = data.data.url;
            
            this.courseData.thumbnail_url = data.data.url;
            document.getElementById('thumbnail-upload-box').innerHTML = `<img src="${data.data.url}" style="width:100%; border-radius:8px; display:block; object-fit:cover; height:100%;">`;
            
            document.getElementById('ai-gallery').style.display = 'none';
            alert("¡Portada anclada al curso con éxito!");
        } catch(err) {
            alert("Error subiendo la imagen.");
        } finally { 
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar Portada'; 
            btn.disabled = false; 
        }
    },

    // --- 5. LÓGICA MAESTRA DE GUARDADO ---
    async saveCourseData(isPublished, isPreview = false) {
        const title = document.getElementById('course-title').value;
        const slug = document.getElementById('course-slug').value;

        if (!title || !slug) return alert("El título y el slug son obligatorios.");
        if (this.modules.length === 0) return alert("Debes añadir al menos un módulo.");

        await this.saveAllEditors();
        
        const activeBtn = isPreview ? document.getElementById('btn-preview-course') : (isPublished ? document.getElementById('btn-save-course') : document.getElementById('btn-save-draft'));
        const originalText = activeBtn.innerHTML;
        activeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
        activeBtn.disabled = true;

        try {
            let bskyUri = this.bsky_uri;
            let bskyCid = this.bsky_cid;

            if (isPublished && !bskyUri) {
                const courseUrl = `https://epistecnologia.com/edu/nooc.html?c=${slug}`;
                const { data: tronco, error: troncoError } = await this.supabase.functions.invoke('bot-create-post', {
                    body: {
                        postText: `🏫 NUEVO CURSO: ${title}\n\n¡Te damos oficialmente la bienvenida! 🎓\n\n#EPTedu`,
                        authorInfo: { displayName: 'Motor EPT' },
                        botType: 'cursos',
                        postLink: courseUrl,
                        linkTitle: `NOOC: ${title}`,
                        linkDescription: document.getElementById('course-description')?.value || 'Inscríbete, aprende y valida tu conocimiento.',
                        linkThumb: this.courseData?.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg'
                    }
                });
                if (troncoError || !tronco?.success) throw new Error("Error con Bluesky.");
                bskyUri = tronco.uri;
                bskyCid = tronco.cid;
            }

            const isInstActive = document.getElementById('toggle-institutional')?.checked;
            const coursePayload = {
                title: title, slug: slug,
                description: document.getElementById('course-description')?.value || null,
                institution_name: isInstActive ? document.getElementById('inst-name')?.value : null,
                institution_logo: isInstActive ? document.getElementById('inst-logo')?.value : null,
                thumbnail_url: this.courseData?.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg',
                created_by: this.user.id, 
                is_published: isPublished,
                bsky_uri: bskyUri, bsky_cid: bskyCid
            };

            if (this.isEditing) coursePayload.id = this.editingCourseId;

            const { data: savedCourse, error: courseError } = await this.supabase.from('nooc_courses').upsert([coursePayload]).select().single();
            if (courseError) throw new Error("Error DB Curso: " + courseError.message);

            this.editingCourseId = savedCourse.id;
            this.isEditing = true;

            for (let i = 0; i < this.modules.length; i++) {
                let mod = this.modules[i];
                const modPayload = {
                    course_id: savedCourse.id, order_index: i + 1,
                    title: mod.title, content_type: 'modulo',
                    xp_reward: isInstActive ? 200 : 100
                };
                if (mod.isFromDB) modPayload.id = mod.id;

                const { data: savedMod, error: modError } = await this.supabase.from('nooc_modules').upsert([modPayload]).select().single();
                if (modError) throw new Error("Error DB Módulo.");

                for (let j = 0; j < mod.lessons.length; j++) {
                    let les = mod.lessons[j];
                    let lesBsUri = les.bsky_uri;
                    let lesBsCid = les.bsky_cid;

                    if (isPublished && !les.isFromDB && bskyUri) { 
                        const { data: rama } = await this.supabase.functions.invoke('bot-create-post', {
                            body: {
                                postText: `📖 Lección 0${j+1}: ${les.title}\n\nUsa este espacio para debatir los contenidos de este bloque.`,
                                authorInfo: { displayName: 'Motor EPT' },
                                botType: 'cursos',
                                replyTo: { rootUri: bskyUri, rootCid: bskyCid, parentUri: bskyUri, parentCid: bskyCid }
                            }
                        });
                        lesBsUri = rama?.uri;
                        lesBsCid = rama?.cid;
                    }

                    const lesPayload = {
                        module_id: savedMod.id, order_index: j + 1, title: les.title, content_type: les.type,
                        content_payload: les.content_payload, bsky_uri: lesBsUri, bsky_cid: lesBsCid, xp_reward: 20
                    };
                    if (les.isFromDB) lesPayload.id = les.id;

                    await this.supabase.from('nooc_lessons').upsert([lesPayload]);
                }
            }

            if (isPreview) {
                window.open(`/edu/nooc.html?c=${slug}`, '_blank');
                activeBtn.innerHTML = originalText;
                activeBtn.disabled = false;
            } else {
                alert(`¡Curso ${isPublished ? 'publicado' : 'guardado como borrador'} exitosamente!`);
                sessionStorage.removeItem('activeCourse');
                window.location.href = '/edu';
            }

        } catch (err) {
            alert("Fallo al guardar: " + err.message);
            activeBtn.innerHTML = originalText;
            activeBtn.disabled = false;
        }
    },

    // --- CARGA Y RENDERIZADO ---
    async loadExistingCourse(course) {
        this.isEditing = true;
        this.editingCourseId = course.id;
        this.bsky_uri = course.bsky_uri; 
        this.bsky_cid = course.bsky_cid;

        document.getElementById('course-title').value = course.title || '';
        document.getElementById('course-slug').value = course.slug || '';

        if (document.getElementById('course-description')) document.getElementById('course-description').value = course.description || '';
        
        const toggleInst = document.getElementById('toggle-institutional');
        const instFields = document.getElementById('inst-fields');
        if (toggleInst && course.institution_name) {
            toggleInst.checked = true;
            if (instFields) instFields.style.display = 'block';
            document.getElementById('inst-name').value = course.institution_name;
            document.getElementById('inst-logo').value = course.institution_logo || '';
        }

        if (course.thumbnail_url) {
            this.courseData.thumbnail_url = course.thumbnail_url;
            if (document.getElementById('course-thumbnail-url')) document.getElementById('course-thumbnail-url').value = course.thumbnail_url;
            document.getElementById('thumbnail-upload-box').innerHTML = `<img src="${course.thumbnail_url}" style="width:100%; border-radius:8px; display:block; object-fit:cover; height:100%;">`;
        }

        document.getElementById('empty-canvas-state').style.display = 'none';
        const container = document.getElementById('modules-container');
        container.innerHTML = '<p style="color:white; text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando estructura...</p>';

        try {
            const { data: modulesData, error } = await this.supabase
                .from('nooc_modules')
                .select('*, nooc_lessons(*)')
                .eq('course_id', course.id)
                .order('order_index', { ascending: true });

            if (error) throw error;

            if (modulesData && modulesData.length > 0) {
                this.modules = modulesData.map(m => ({
                    id: m.id, title: m.title, isFromDB: true, 
                    lessons: m.nooc_lessons.sort((a, b) => a.order_index - b.order_index).map(l => ({
                        id: l.id, title: l.title, type: l.content_type, content_payload: l.content_payload,
                        bsky_uri: l.bsky_uri, bsky_cid: l.bsky_cid, isFromDB: true
                    }))
                }));
            }
            this.renderCanvas();
        } catch (err) { alert("Error al descargar los módulos del curso."); }
    },

    calculateXP() {
        const isInst = document.getElementById('toggle-institutional-xp')?.checked;
        const baseModuleXP = isInst ? 200 : 100;
        let totalXP = 0;
        if (document.getElementById('toggle-start-feed')?.checked) totalXP += 50;
        if (document.getElementById('toggle-end-feed')?.checked) totalXP += 50;
        this.modules.forEach(mod => { totalXP += baseModuleXP; mod.lessons.forEach(() => totalXP += 20); });
        const xpSpan = document.getElementById('xp-value');
        if (xpSpan) xpSpan.innerText = totalXP;
    },

    async saveAllEditors() {
        const keys = Object.keys(this.editorInstances);
        for (let i = 0; i < keys.length; i++) {
            const lessonId = keys[i];
            const editor = this.editorInstances[lessonId];
            try {
                if (editor && typeof editor.save === 'function') {
                    const savedData = await editor.save();
                    this.modules.forEach(m => {
                        const les = m.lessons.find(l => l.id === lessonId);
                        if (les && les.type === 'texto') les.content_payload = savedData;
                    });
                }
            } catch (e) {}
        }
    },

    generateId() { return Math.random().toString(36).substr(2, 9); },

    async addModule() {
        await this.saveAllEditors();
        document.getElementById('empty-canvas-state').style.display = 'none';
        this.modules.push({ id: 'mod_' + this.generateId(), title: 'Nuevo Módulo', lessons: [] });
        this.renderCanvas(); this.calculateXP();
    },

    async deleteModule(moduleId) {
        if(confirm("¿Borrar todo el módulo? Se perderán sus lecciones.")) {
            await this.saveAllEditors();
            const mod = this.modules.find(m => m.id === moduleId);
            if (mod && mod.isFromDB) await this.supabase.from('nooc_modules').delete().eq('id', mod.id);
            this.modules = this.modules.filter(m => m.id !== moduleId);
            this.renderCanvas(); this.calculateXP();
        }
    },

    async addLesson(moduleId) {
        await this.saveAllEditors();
        const mod = this.modules.find(m => m.id === moduleId);
        if (!mod) return;
        mod.lessons.push({ id: 'les_' + this.generateId(), title: 'Nueva Lección', type: 'texto', content_payload: { time: Date.now(), blocks: [], version: "2.28.2" } });
        this.renderCanvas(); this.calculateXP();
    },

    async deleteLesson(moduleId, lessonId) {
        if(!confirm("¿Borrar lección?")) return;
        await this.saveAllEditors();
        const mod = this.modules.find(m => m.id === moduleId);
        const les = mod.lessons.find(l => l.id === lessonId);
        if (les && les.isFromDB) await this.supabase.from('nooc_lessons').delete().eq('id', les.id);
        mod.lessons = mod.lessons.filter(l => l.id !== lessonId);
        delete this.editorInstances[lessonId]; 
        this.renderCanvas(); this.calculateXP();
    },

    renderCanvas() {
        const container = document.getElementById('modules-container');
        container.innerHTML = '';
        this.modules.forEach((mod, index) => {
            container.insertAdjacentHTML('beforeend', `
                <div class="module-card">
                    <div class="module-header">
                        <input type="text" value="${mod.title}" onchange="NoocApp.updateModTitle('${mod.id}', this.value)">
                        <div style="display:flex; gap:10px;">
                            <button onclick="NoocApp.addLesson('${mod.id}')" class="btn-add-module" style="border:none;"><i class="fa-solid fa-plus"></i> Añadir Lección</button>
                            <button onclick="NoocApp.deleteModule('${mod.id}')" class="btn-delete" style="width:30px; height:30px;"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                    <div class="module-body">
                        ${mod.lessons.length === 0 ? '<p style="color:#666; font-size:0.85rem; margin:0;">No hay lecciones.</p>' : ''}
                        ${mod.lessons.map((les, i) => this.generateLessonHTML(mod.id, les, i)).join('')}
                    </div>
                </div>
            `);
        });

        this.modules.forEach(mod => mod.lessons.forEach(les => {
            if (les.type === 'texto') this.initEditorJs(les.id, les.content_payload);
        }));
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
                    ? `<input type="text" value="${savedContent}" placeholder="Pega el enlace de YouTube..." onchange="NoocApp.updateLessonContent('${modId}', '${les.id}', this.value)" style="width:100%; padding:10px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.1);">`
                    : `<textarea placeholder="Pega aquí código <iframe>..." onchange="NoocApp.updateLessonContent('${modId}', '${les.id}', this.value)" style="width:100%; padding:10px; border-radius:6px; background:#111; color:white; border:1px solid rgba(255,255,255,0.1); min-height:80px; font-family:monospace;">${savedContent}</textarea>`
                }
            </div>
        `;
    },

    async updateLessonType(mId, lId, val) { 
        await this.saveAllEditors();
        const lesson = this.modules.find(m => m.id === mId).lessons.find(l => l.id === lId);
        lesson.type = val; 
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
        this.editorInstances[lessonId] = new EditorJS({
            holder: `editor_${lessonId}`,
            placeholder: 'Escribe tu lección aquí. Usa "/" para comandos.',
            data: existingData, inlineToolbar: ['link', 'bold', 'italic'], 
            tools: {
                header: { class: Header, inlineToolbar: true, config: { levels: [2, 3, 4], defaultLevel: 2 } },
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
                if(document.getElementById('course-thumbnail-url')) document.getElementById('course-thumbnail-url').value = data.data.url;
                box.innerHTML = `<img src="${data.data.url}" style="width:100%; border-radius:8px; display:block; object-fit:cover; height:100%;">`;
                
                this.rawImageBlob = data.data.url;
                document.getElementById('ai-gallery-img').src = data.data.url;
                document.getElementById('ai-gallery').style.display = 'block';

            } catch (err) { alert("Error al subir imagen"); box.innerHTML = 'Error'; }
        };
        input.click();
    }
};

document.addEventListener('DOMContentLoaded', () => NoocApp.init());