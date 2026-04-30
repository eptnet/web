const NoocRoom = {
    supabase: null,
    currentCourse: null,
    activeLesson: null,
    
    init() {
        document.addEventListener('mainReady', async () => {
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            // --- 1. CAPTURA DEL CALLBACK DE BLUESKY OAUTH ---
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                // Limpiamos la URL visualmente sin recargar la página para quitar los tokens
                const cleanUrl = window.location.pathname + '?c=' + urlParams.get('c');
                window.history.replaceState({}, document.title, cleanUrl);
                
                // Invocamos a la Edge Function para guardar las credenciales
                this.supabase.functions.invoke('bsky-oauth-callback', {
                    body: { 
                        code: code, 
                        state: state, 
                        redirect_uri: window.location.origin + window.location.pathname + '?c=' + urlParams.get('c') 
                    }
                }).then(({ data, error }) => {
                    if (!error) alert("¡Cuenta de Bluesky conectada! Ya puedes comentar.");
                });
            }
            // --------------------------------------------------

            // --- 2. GUARDIÁN DE SESIÓN DEL AULA ---
            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                this.user = session.user; // Guardamos el usuario globalmente

                // VERIFICACIÓN ESTRICTA DE BLUESKY
                const { data: bsky } = await this.supabase.from('bsky_credentials').select('handle').eq('user_id', session.user.id).maybeSingle();
                if (!bsky) {
                    window.location.href = '/edu/'; // Lo expulsamos al campus si no tiene Bluesky
                    return;
                }

                // Carga de perfil normal...
                const { data: profile } = await this.supabase.from('profiles').select('display_name, username, avatar_url, xp_total').eq('id', session.user.id).single();
                if (profile) {
                    document.getElementById('user-name-display').textContent = profile.display_name || profile.username || 'Investigador';
                    if (profile.avatar_url) document.getElementById('user-avatar-placeholder').innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    if (profile.xp_total !== undefined) document.getElementById('progress-percent').textContent = profile.xp_total + ' XP';
                }
            } else {
                window.location.href = '/edu/';
                return;
            }
            // --------------------------------------------------

            const slug = urlParams.get('c');
            if (!slug) { window.location.href = '/edu/'; return; }

            await this.loadCourseData(slug);
            this.initPlexus();
            this.setupModalListeners();
        });

        setTimeout(() => { if (!this.supabase) document.dispatchEvent(new Event('mainReady')); }, 1000);
    },

    // --- MOTOR RPG: RANGOS ---
    getSimpleRank(xp) {
        if (xp < 30) return 'Recluta';
        if (xp < 100) return 'Aprendiz';
        if (xp < 300) return 'Explorador';
        if (xp < 600) return 'Académico';
        return 'Investigador';
    },

    // --- ACTUALIZADOR MAESTRO DE LA BARRA LATERAL ---
    async updateSidebarUI() {
        if (!this.user || !this.currentCourse) return;

        // 1. Obtener Perfil Global (XP y Nivel)
        const { data: profile } = await this.supabase.from('profiles').select('xp_total, display_name, username, avatar_url').eq('id', this.user.id).single();
        const currentXP = profile?.xp_total || 0;
        const rank = this.getSimpleRank(currentXP);

        // 2. Calcular Progreso EXACTO del Curso Actual (Micro-Meta)
        let totalCourseXP = 0;
        this.currentCourse.nooc_modules.forEach(m => {
            m.nooc_lessons.forEach(l => totalCourseXP += (l.xp_reward || 20));
        });

        // Buscamos qué lecciones ya superó este usuario
        const { data: progressList } = await this.supabase.from('nooc_progress').select('lesson_id').eq('user_id', this.user.id);
        const completedIds = progressList ? progressList.map(p => p.lesson_id) : [];

        this.completedLessons = completedIds;

        let completedCourseXP = 0;
        this.currentCourse.nooc_modules.forEach(m => {
            m.nooc_lessons.forEach(l => {
                if (completedIds.includes(l.id)) completedCourseXP += (l.xp_reward || 20);
            });
        });

        // 3. Pintar la magia en el HTML
        document.getElementById('user-name-display').textContent = profile?.display_name || profile?.username || 'Investigador';
        if (profile?.avatar_url) document.getElementById('user-avatar-placeholder').innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        
        document.getElementById('user-rank').textContent = rank.toUpperCase();

        // Calculamos porcentaje del curso
        const progressPercent = totalCourseXP > 0 ? Math.round((completedCourseXP / totalCourseXP) * 100) : 0;
        
        const xpDisplay = document.getElementById('progress-percent');
        const progressBar = document.getElementById('course-progress-fill');

        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        
        // Unimos el porcentaje del curso con su XP Global
        if (xpDisplay) xpDisplay.innerHTML = `${progressPercent}% <span style="color: var(--color-edu-accent); font-size: 0.85em; font-weight: normal;">(${currentXP} XP)</span>`;
    },

    // --- NUEVO: CONTROL DEL MENÚ HAMBURGUESA ---
    toggleMobileMenu(forceClose = false) {
        const nav = document.getElementById('sidebar-nav');
        const overlay = document.getElementById('mobile-overlay');
        
        if (!nav || !overlay) return;

        if (forceClose) {
            nav.classList.remove('open');
            overlay.classList.remove('active');
            if(!document.getElementById('lesson-modal').classList.contains('active')) {
                document.body.style.overflow = ''; 
            }
            return;
        }

        nav.classList.toggle('open');
        overlay.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
    },

    async loadCourseData(slug) {
        try {
            const { data, error } = await this.supabase
                .from('nooc_courses')
                .select(`*, nooc_modules(*, nooc_lessons(*))`)
                .eq('slug', slug)
                .single();

            if (error) throw error;
            this.currentCourse = data;
            this.currentCourse.nooc_modules.sort((a,b) => a.order_index - b.order_index);

            // --- INYECCIÓN: ACTUALIZAMOS LA UI AQUÍ ---
            await this.updateSidebarUI();
            
            this.renderSidebar();
            this.showView('start');
        } catch (err) {
            console.error("Error cargando curso:", err);
            document.getElementById('content-display').innerHTML = '<p style="color:var(--edu-accent);">Error al cargar el curso.</p>';
        }
    },

    renderSidebar() {
        const list = document.getElementById('modules-nav-list');
        list.innerHTML = this.currentCourse.nooc_modules.map((mod, index) => `
            <div class="module-group" id="nav-mod-${mod.id}">
                <button class="menu-item module-title" onclick="NoocRoom.toggleModule('${mod.id}')">
                    <i class="fa-solid fa-layer-group"></i> 0${index + 1}. ${mod.title}
                    <i class="fa-solid fa-chevron-down accordion-icon" style="margin-left:auto; font-size:0.8rem; transition:0.3s;"></i>
                </button>
                <div class="lessons-sub-list">
                    ${mod.nooc_lessons.sort((a,b) => a.order_index - b.order_index).map(les => `
                        <button class="menu-item lesson-link" onclick="NoocRoom.openLessonModal('${les.id}')">
                            <i class="${les.content_type === 'video' ? 'fa-solid fa-play' : les.content_type === 'iframe' ? 'fa-solid fa-code' : 'fa-solid fa-file-lines'}"></i> ${les.title}
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    toggleModule(moduleId) {
        document.querySelectorAll('.module-group').forEach(group => {
            if (group.id === `nav-mod-${moduleId}`) group.classList.add('active');
            else group.classList.remove('active');
        });
        this.showView('module', moduleId);
        // NO cerramos el menú aquí para que el usuario pueda ver el acordeón desplegarse
    },

    async showView(view, payload = null) {
        document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active-main'));
        const stage = document.getElementById('content-display');
        
        if (view === 'start') {
            document.getElementById('btn-nav-inicio').classList.add('active-main');
            this.toggleMobileMenu(true); 

            stage.innerHTML = `
                <div class="course-intro bento-card glow-hover">
                    <img src="${this.currentCourse.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg'}" style="width:100%; border-radius:16px; margin-bottom:20px; object-fit:cover; max-height:300px;">
                    <span class="rank-tag" style="background: var(--color-edu-accent); color: white; padding: 5px 15px; border-radius: 50px;">Vista General</span>
                    <h1 style="font-size: 2.5rem; margin: 15px 0 10px 0;">${this.currentCourse.title}</h1>
                    <p style="opacity:0.8; font-size:1.1rem;">Selecciona un módulo en la brújula para comenzar tu aprendizaje.</p>
                </div>
            `;
        } else if (view === 'feed') {
            document.getElementById('btn-nav-feed').classList.add('active-main');
            this.toggleMobileMenu(true); 

            stage.innerHTML = `
                <div class="bento-card glow-hover">
                    <h2 style="margin-top:0;"><i class="fa-solid fa-users-rays"></i> Comunidad del Curso</h2>
                    <p style="opacity:0.8;">Preséntate, comparte tus avances y debate con otros investigadores inscritos en este programa.</p>
                    
                    <div class="organic-feed-box">
                        <div class="feed-composer">
                            <div class="avatar-sm"><i class="fa-solid fa-user"></i></div>
                            <input type="text" id="course-feed-input" placeholder="Comparte un hallazgo o duda con la clase..." class="feed-input">
                            <button class="btn-action" style="padding: 8px 15px; font-size: 0.8rem;" onclick="NoocRoom.postComment('course-feed-input', '${this.currentCourse.bsky_uri}', '${this.currentCourse.bsky_cid}', 'organic-feed-stream')"><i class="fa-solid fa-paper-plane"></i></button>
                        </div>
                        
                        <div id="organic-feed-stream" style="margin-top: 25px;">
                            <p style="opacity:0.5; text-align:center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Sincronizando red...</p>
                        </div>
                    </div>
                </div>
            `;
            if(this.currentCourse.bsky_uri) this.loadCommunityFeed(this.currentCourse.bsky_uri, 'organic-feed-stream');
            
        } else if (view === 'module') {
            const mod = this.currentCourse.nooc_modules.find(m => m.id === payload);
            if (!mod) return;
            
            let cardsHtml = mod.nooc_lessons.sort((a,b) => a.order_index - b.order_index).map((les, i) => `
                <div class="lesson-wide-card glow-hover" onclick="NoocRoom.openLessonModal('${les.id}')">
                    <div class="lesson-card-icon">
                        <i class="${les.content_type === 'video' ? 'fa-solid fa-play' : les.content_type === 'iframe' ? 'fa-solid fa-laptop-code' : 'fa-solid fa-book-open'}"></i>
                    </div>
                    <div class="lesson-card-info">
                        <span class="lesson-num">Lección 0${i+1}</span>
                        <h3>${les.title}</h3>
                    </div>
                    <div class="lesson-card-meta">
                        <span class="xp-reward">+${les.xp_reward || 20} XP</span>
                        <button class="btn-start-lesson"><i class="fa-solid fa-arrow-right"></i></button>
                    </div>
                </div>
            `).join('');

            if(mod.nooc_lessons.length === 0) cardsHtml = '<p style="opacity:0.5; text-align:center;">Pronto se añadirán lecciones a este módulo.</p>';

            stage.innerHTML = `
                <div class="module-stage-header">
                    <span class="rank-tag">Módulo Activo</span>
                    <h2 style="font-size: 2.2rem; margin: 10px 0 20px 0;">${mod.title}</h2>
                </div>
                <div class="lesson-cards-container">
                    ${cardsHtml}
                </div>
            `;
        } else if (view === 'cert') {
            document.getElementById('btn-nav-cert').classList.add('active-main');
            this.toggleMobileMenu(true); 

            stage.innerHTML = `<div style="text-align: center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Verificando expediente académico...</p></div>`;

            // 1. Calculamos el Progreso
            let totalCourseXP = 0;
            let completedCourseXP = 0;
            const completedIds = this.completedLessons || [];
            
            this.currentCourse.nooc_modules.forEach(m => m.nooc_lessons.forEach(l => {
                totalCourseXP += (l.xp_reward || 20);
                if (completedIds.includes(l.id)) completedCourseXP += (l.xp_reward || 20);
            }));
            const progressPercent = totalCourseXP > 0 ? Math.round((completedCourseXP / totalCourseXP) * 100) : 0;

            // 2. Verificamos si YA tiene el certificado guardado
            const { data: cert } = await this.supabase.from('nooc_certificates').select('*').eq('user_id', this.user.id).eq('course_id', this.currentCourse.id).maybeSingle();

            if (cert) {
                // ESTADO 3: CERTIFICADO EMITIDO

                // --- NUEVO: Buscamos el nombre del creador del curso ---
                let instructorName = "Comité Académico EPT";
                try {
                    if (this.currentCourse.created_by) {
                        const { data: inst } = await this.supabase.from('profiles').select('display_name, username').eq('id', this.currentCourse.created_by).maybeSingle();
                        if (inst) instructorName = inst.display_name || inst.username || instructorName;
                    }
                } catch(e) { console.warn("No se pudo obtener al profesor"); }
                // --------------------------------------------------------

                stage.innerHTML = `
                    <div class="bento-card glow-hover" style="text-align: center; padding: 30px;">
                        <h2 style="font-size: 2rem; margin: 0 0 10px 0; color: #10b981;"><i class="fa-solid fa-award"></i> ¡Felicidades!</h2>
                        <p style="opacity:0.8; margin-bottom: 25px;">Has completado este curso y tu certificado digital ha sido emitido.</p>
                        
                        <div style="width: 100%; max-width: 800px; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                            <canvas id="certificate-canvas" style="width: 100%; display: block;"></canvas>
                        </div>
                        
                        <div style="margin-top: 25px; display: flex; justify-content: center; gap: 15px;">
                            <button onclick="NoocRoom.downloadCertificate()" class="btn-action" style="background: var(--color-edu-accent); border-color: var(--color-edu-accent);"><i class="fa-solid fa-download"></i> Descargar Alta Calidad</button>
                            <a href="https://bsky.app/intent/compose?text=¡Acabo de certificarme en %22${encodeURIComponent(this.currentCourse.title)}%22 en el Campus de Epistecnología! 🎓⚡ Míralo aquí: ${window.location.origin}/edu/nooc.html?c=${this.currentCourse.slug}" target="_blank" class="btn-action" style="background: #0085ff; border-color: #0085ff;"><i class="fa-brands fa-bluesky"></i> Presumir Logro</a>
                        </div>
                    </div>
                `;
                
                // Salvavidas: Leemos certificate_hash o hash_code para no dejar a tu primer usuario en null
                const safeHash = cert.certificate_hash || cert.hash_code;
                const safeDate = cert.created_at || cert.issue_date;
                const shouldDownload = payload && payload.autoDownload; // Capturamos la intención de descarga
                
                setTimeout(() => {
                    this.drawCertificateCanvas(cert.legal_name, safeHash, safeDate, instructorName, shouldDownload);
                }, 200);

            } else if (progressPercent >= 100) {
                // ESTADO 2: DESBLOQUEADO PERO NO RECLAMADO
                stage.innerHTML = `
                    <div class="bento-card glow-hover" style="text-align: center; padding: 50px 20px;">
                        <i class="fa-solid fa-award" style="font-size: 4rem; color: #f59e0b; margin-bottom: 20px; animation: pulse 2s infinite;"></i>
                        <h2 style="font-size: 2.2rem; margin: 0 0 15px 0;">¡Curso Completado!</h2>
                        <p style="opacity:0.8; font-size:1.1rem; max-width: 600px; margin: 0 auto 30px auto;">
                            Has superado todas las lecciones. Estás listo para emitir tu certificado validado en la red.
                        </p>
                        <button onclick="NoocRoom.openCertificateModal()" class="btn-action" style="background: #10b981; border-color: #10b981; padding: 15px 30px; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                            <i class="fa-solid fa-file-signature"></i> Emitir Certificado Ahora
                        </button>
                    </div>
                `;
            } else {
                // ESTADO 1: BLOQUEADO
                stage.innerHTML = `
                    <div class="bento-card glow-hover" style="text-align: center; padding: 50px 20px;">
                        <i class="fa-solid fa-award" style="font-size: 4rem; color: var(--color-edu-accent); margin-bottom: 20px; opacity: 0.5;"></i>
                        <h2 style="font-size: 2.2rem; margin: 0 0 15px 0;">Certificación EPT</h2>
                        <p style="opacity:0.8; font-size:1.1rem; max-width: 600px; margin: 0 auto 30px auto;">
                            Completa todos los módulos y participa en la comunidad para desbloquear tu certificado.
                        </p>
                        <div class="progress-bar-container" style="max-width: 400px; margin: 0 auto 10px auto; height: 12px;">
                            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
                        </div>
                        <p style="font-size: 0.9rem; color: #a0aab5; margin-bottom: 30px;">${progressPercent}% Completado</p>
                        <button class="btn-action" style="margin-top: 20px; opacity: 0.5; cursor: not-allowed;"><i class="fa-solid fa-lock"></i> Completar al 100% para reclamar</button>
                    </div>
                `;
            }
        }
    },

    openLessonModal(lessonId) {
        let lesson = null;
        this.currentCourse.nooc_modules.forEach(m => { const found = m.nooc_lessons.find(l => l.id === lessonId); if(found) lesson = found; });
        if(!lesson) return;

        this.toggleMobileMenu(true); 

        const modal = document.getElementById('lesson-modal');
        const contentArea = document.getElementById('lesson-modal-content');
        
        let mediaHtml = '';
        if (lesson.content_type === 'video') {
            let videoUrl = lesson.content_payload;
            if(videoUrl && videoUrl.includes('watch?v=')) videoUrl = videoUrl.replace('watch?v=', 'embed/');
            mediaHtml = `<div class="modal-media-wrapper"><iframe src="${videoUrl}" frameborder="0" allowfullscreen></iframe></div>`;
        } else if (lesson.content_type === 'iframe') {
            mediaHtml = `<div class="modal-media-wrapper">${lesson.content_payload}</div>`;
        }

        let textHtml = '';
        if (lesson.content_type === 'texto' && lesson.content_payload && lesson.content_payload.blocks) {
            textHtml = lesson.content_payload.blocks.map(b => {
                if(b.type === 'paragraph') return `<p>${b.data.text}</p>`;
                if(b.type === 'header') return `<h${b.data.level}>${b.data.text}</h${b.data.level}>`;
                if(b.type === 'list') {
                    const listTag = b.data.style === 'ordered' ? 'ol' : 'ul';
                    return `<${listTag}>${b.data.items.map(i => `<li>${i}</li>`).join('')}</${listTag}>`;
                }
                return '';
            }).join('');
        }

        contentArea.innerHTML = `
            <div class="modal-lesson-header">
                <span class="xp-reward" style="margin-bottom:10px; display:inline-block;">+${lesson.xp_reward || 20} XP</span>
                <h1 style="margin:0; font-size:2.5rem; line-height:1.2;">${lesson.title}</h1>
            </div>
            
            ${mediaHtml}
            
            <div class="lesson-text-body prose">
                ${textHtml}
            </div>

            <hr style="border-color: rgba(255,255,255,0.1); margin: 40px 0;">
            
            <div class="organic-feed-box" style="background:transparent; border:none; padding:0;">
                <h3 style="margin-top:0;"><i class="fa-solid fa-comments"></i> Debate de la Lección</h3>
                <div class="feed-composer">
                    <input type="text" id="lesson-feed-input" placeholder="¿Qué aprendiste aquí? Añade tus notas..." class="feed-input">
                    <button class="btn-action" style="padding: 8px 15px;" onclick="NoocRoom.postComment('lesson-feed-input', '${lesson.bsky_uri}', '${lesson.bsky_cid}', 'lesson-comments-stream')"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                
                <div id="lesson-comments-stream" style="margin-top: 25px;">
                     <p style="opacity:0.5; text-align:center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando debate...</p>
                </div>
            </div>
        `;

        // --- INYECCIÓN: ESTADO INTELIGENTE DEL BOTÓN ---
        this.activeLesson = lesson; 
        const completeBtn = document.querySelector('.modal-footer-bar .btn-action');
        
        if (completeBtn) {
            // Verificamos si la lección ya está en la memoria de completadas
            if (this.completedLessons && this.completedLessons.includes(lesson.id)) {
                // 1. ESTADO: LECCIÓN YA SUPERADA
                completeBtn.disabled = true;
                completeBtn.style.opacity = '1';
                completeBtn.style.background = '#10b981'; // Se vuelve verde
                completeBtn.style.cursor = 'default';
                completeBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Lección Superada';
                completeBtn.onclick = null; // Quitamos el evento para que no puedan darle clic
            } else {
                // 2. ESTADO: PEAJE SOCIAL (Falta comentar)
                completeBtn.disabled = true;
                completeBtn.style.opacity = '0.5';
                completeBtn.style.background = 'var(--color-secondary)';
                completeBtn.style.cursor = 'not-allowed';
                completeBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Aporta al debate para completar (+20 XP)';
                completeBtn.onclick = () => this.completeLesson(); 
            }
        }
        // --------------------------------------------------
       
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; 

        // Disparamos la carga de comentarios de la lección
        if(lesson.bsky_uri) {
            this.loadCommunityFeed(lesson.bsky_uri, 'lesson-comments-stream');
        }
    },

    closeLessonModal() {
        document.getElementById('lesson-modal').classList.remove('active');
        document.getElementById('lesson-modal-content').innerHTML = ''; 
        document.body.style.overflow = ''; 
    },

    async completeLesson() {
        if (!this.activeLesson || !this.user) return;
        const btn = document.querySelector('.modal-footer-bar .btn-action');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando progreso...';

        try {
            // 1. Guardar el progreso en la base de datos
            const { error } = await this.supabase.from('nooc_progress').insert([{
                user_id: this.user.id,
                lesson_id: this.activeLesson.id
            }]);

            // Si el error NO es "Ya existe" (23505), lanzamos la alerta
            if (error && error.code !== '23505') throw error;

            // 2. Sumar los XP al perfil (Solo si es la primera vez que la completa)
            if (!error) {
                 const { data: profile } = await this.supabase.from('profiles').select('xp_total').eq('id', this.user.id).single();
                 const newXp = (profile?.xp_total || 0) + (this.activeLesson.xp_reward || 20);
                 
                 await this.supabase.from('profiles').update({ xp_total: newXp }).eq('id', this.user.id);

                 // --- INYECCIÓN: RECALCULAR BARRA EN VIVO ---
                 await this.updateSidebarUI();

                 // Actualizar la interfaz del aula
                 const xpDisplay = document.getElementById('progress-percent');
                 if (xpDisplay) xpDisplay.textContent = newXp + ' XP';
            }

            // 3. Cerrar y celebrar
            this.closeLessonModal();
            alert(`¡Lección completada! Has ganado +${this.activeLesson.xp_reward || 20} XP. Sigue así.`);

        } catch (err) {
            console.error(err);
            alert("Hubo un problema al registrar tu progreso.");
            btn.disabled = false;
            btn.innerHTML = 'Reintentar';
        }
    },

    setupModalListeners() {
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeLessonModal());
        document.getElementById('lesson-modal').addEventListener('click', (e) => {
            if (e.target.id === 'lesson-modal') this.closeLessonModal();
        });
    },

    // --- NUEVAS FUNCIONES DE LA COMUNIDAD (MOTOR EPT) ---

    // 1. DIBUJAR LOS COMENTARIOS (CON FILTRO INTELIGENTE)
    async loadCommunityFeed(threadUri, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const res = await this.supabase.functions.invoke('bsky-lexicon-api', {
                body: { action: 'get_post_thread', uri: threadUri }
            });

            if (res.error) throw res.error;
            const thread = res.data.thread;

            // FILTRO INTELIGENTE: Ignoramos los posts que haya hecho el Motor Oculto
            let validReplies = [];
            if (thread.replies) {
                validReplies = thread.replies.filter(reply => {
                    // Oculta todo lo publicado por la cuenta de infraestructura
                    return reply.post.author.handle !== 'cursos.epistecnologia.com';
                });
            }

            if (validReplies.length === 0) {
                container.innerHTML = '<p style="opacity:0.5; text-align:center;">El foro está abierto. ¡Sé el primero en compartir tu perspectiva!</p>';
                return;
            }

            let html = '';
            validReplies.forEach(reply => {
                const post = reply.post;
                const author = post.author;
                html += `
                    <div style="padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 15px;">
                        <img src="${author.avatar || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--edu-border);">
                        <div style="flex: 1;">
                            <div style="display: flex; gap: 10px; align-items: baseline;">
                                <strong style="color: white; font-size: 0.95rem;">${author.displayName || author.handle}</strong>
                                <span style="color: #a0aab5; font-size: 0.8rem;">@${author.handle}</span>
                            </div>
                            <p style="margin: 5px 0 0 0; color: #e2e8f0; line-height: 1.5; font-size: 0.95rem;">${post.record.text}</p>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;

        } catch (err) {
            console.error("Error cargando debate:", err);
            container.innerHTML = '<p style="color: var(--edu-accent); text-align:center;">Error de sincronización con la red académica.</p>';
        }
    },

    // 2. ENVIAR UN COMENTARIO (CON RUTEO PRECISO DEL PROTOCOLO AT)
    async postComment(inputId, parentUri, parentCid, containerId) {
        const input = document.getElementById(inputId);
        const text = input.value.trim();
        if (!text) return;

        const btn = input.nextElementSibling;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        // --- SISTEMA DE EMERGENCIA (FAILSAFE) ---
        // Si la lección no tiene un hilo asociado en la BD, perdonamos al estudiante y le desbloqueamos el botón
        if (!parentUri || parentUri === 'undefined' || parentUri === 'null') {
            alert("⚠️ Esta lección no tiene un hilo de debate generado. Contacta al creador del curso.");
            
            if (containerId === 'lesson-comments-stream') {
                const completeBtn = document.querySelector('.modal-footer-bar .btn-action');
                if (completeBtn && this.activeLesson) {
                    completeBtn.disabled = false;
                    completeBtn.style.opacity = '1';
                    completeBtn.style.background = 'var(--color-edu-accent)';
                    completeBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Completar Lección (+${this.activeLesson.xp_reward || 20} XP)`;
                }
            }
            input.value = '';
            btn.innerHTML = originalIcon;
            btn.disabled = false;
            return;
        }

        try {
            const rootUri = this.currentCourse.bsky_uri;
            const rootCid = this.currentCourse.bsky_cid;

            const res = await this.supabase.functions.invoke('bsky-lexicon-api', {
                body: {
                    action: 'create_reply',
                    text: text,
                    replyTo: { 
                        rootUri: rootUri, rootCid: rootCid, 
                        parentUri: parentUri, parentCid: parentCid 
                    }
                }
            });

            if (res.error) throw res.error;
            if (res.data && res.data.error) throw new Error(res.data.error);

            input.value = '';
            await this.loadCommunityFeed(parentUri, containerId);

            // --- INYECCIÓN: DESBLOQUEAR BOTÓN TRAS EL APORTE ---
            // Solo verificamos que esté comentando en la caja de la lección
            if (containerId === 'lesson-comments-stream') {
                const completeBtn = document.querySelector('.modal-footer-bar .btn-action');
                if (completeBtn && this.activeLesson) {
                    completeBtn.disabled = false;
                    completeBtn.style.opacity = '1';
                    completeBtn.style.background = 'var(--color-edu-accent)';
                    completeBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> Completar Lección (+${this.activeLesson.xp_reward || 20} XP)`;
                }
            }
            // ---------------------------------------------------

        } catch (err) {
            console.error("Error en postComment:", err);
            if (err.message.includes("jwt") || err.message.includes("auth") || err.message.includes("Token")) {
                alert("Tu sesión de Bluesky expiró o fue revocada. Ve al Campus para reconectar.");
            } else {
                alert("Error al publicar: " + err.message);
            }
        } finally {
            btn.innerHTML = originalIcon;
            btn.disabled = false;
        }
    },

    initPlexus() {
        const canvas = document.getElementById('edu-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];
        function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        window.addEventListener('resize', resize); resize();
        class Particle {
            constructor() { this.reset(); }
            reset() { this.x = Math.random() * canvas.width; this.y = Math.random() * canvas.height; this.radius = Math.random() * 2 + 0.5; this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3; }
            update() { this.x += this.vx; this.y += this.vy; if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset(); }
            draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.fill(); }
        }
        for (let i = 0; i < 50; i++) particles.push(new Particle());
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x; const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 120) {
                        ctx.beginPath(); ctx.strokeStyle = `rgba(183, 42, 30, ${0.3 - distance/400})`; 
                        ctx.lineWidth = 1; ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();
    },

    // --- MOTOR DE CERTIFICACIÓN ---
    openCertificateModal() {
        const modal = document.getElementById('lesson-modal');
        const contentArea = document.getElementById('lesson-modal-content');
        
        contentArea.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fa-solid fa-graduation-cap" style="font-size: 4rem; color: #f59e0b; margin-bottom: 20px;"></i>
                <h2 style="font-size: 2rem; margin-bottom: 10px;">Emisión de Certificado</h2>
                <p style="color: var(--color-secondary-text); margin-bottom: 30px;">
                    Tu certificado se generará y se guardará en la red académica.
                    Por favor, ingresa tus datos reales para validar tu identidad.
                </p>
                
                <div style="max-width: 400px; margin: 0 auto; text-align: left;">
                    <label style="font-weight: bold; font-size: 0.9rem; margin-bottom: 5px; display: block;">Nombre Legal Completo:</label>
                    <input type="text" id="cert-legal-name" placeholder="Ej: Juan Pérez García" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: white; font-size: 1rem; margin-bottom: 15px;">
                    
                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.9rem; margin-bottom: 5px; display: block;">Fecha de Nacimiento:</label>
                            <input type="date" id="cert-dob" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: white; font-size: 1rem;">
                        </div>
                        <div style="flex: 1;">
                            <label style="font-weight: bold; font-size: 0.9rem; margin-bottom: 5px; display: block;">Ciudad y País:</label>
                            <input type="text" id="cert-location" placeholder="Arequipa, Perú" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-background); color: white; font-size: 1rem;">
                        </div>
                    </div>
                    
                    <button id="btn-claim-submit" onclick="NoocRoom.claimCertificate()" class="btn-action" style="width: 100%; padding: 15px; font-size: 1.1rem; background: #10b981; border-color: #10b981;">
                        <i class="fa-solid fa-stamp"></i> Firmar y Enviar a WhatsApp
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    async claimCertificate() {
        const nameInput = document.getElementById('cert-legal-name').value.trim();
        const dobInput = document.getElementById('cert-dob').value;
        const locationInput = document.getElementById('cert-location').value.trim();

        if (!nameInput || !dobInput || !locationInput) {
            return alert("Por favor, completa todos los campos para poder emitir tu certificado.");
        }

        const btn = document.getElementById('btn-claim-submit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando expediente...';

        const hashCode = 'EPT-' + Math.random().toString(36).substr(2, 9).toUpperCase();

        try {
            // CORRECCIÓN: Usamos el nombre exacto de la columna en tu BD (certificate_hash)
            const { error } = await this.supabase.from('nooc_certificates').insert([{
                user_id: this.user.id,
                course_id: this.currentCourse.id,
                legal_name: nameInput,
                certificate_hash: hashCode, // <--- LA LLAVE MAESTRA QUE FALTABA
                birth_date: dobInput,
                location: locationInput
            }]);

            if (error) throw error;

            this.closeLessonModal();
            await this.showView('cert', { autoDownload: true });
            
            setTimeout(() => {
                this.downloadCertificate();
            }, 500);

            setTimeout(() => {
                const phone = "51993118573"; 
                const message = `🎓 *Nuevo Certificado Emitido*\n\nHola Epistecnología, acabo de culminar y generar mi certificado digital del curso *${this.currentCourse.title}*.\n\n*Mis Datos de Expediente:*\n👤 Nombre: ${nameInput}\n🎂 Nacimiento: ${dobInput}\n📍 Ubicación: ${locationInput}\n🔖 ID Validación: ${hashCode}\n\n_Adjunto a este mensaje la imagen de mi certificado descargado._`;
                
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                
                if(window.EptCampus && typeof window.EptCampus.shootConfetti === 'function') {
                    window.EptCampus.shootConfetti(2);
                }
            }, 1500);

        } catch (err) {
            console.error("Error al generar certificado:", err);
            alert("Hubo un problema de conexión con la base de datos. Detalles en consola.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-stamp"></i> Firmar y Enviar a WhatsApp';
        }
    },

    async drawCertificateCanvas(legalName, hashCode, dateString, instructorName, autoDownload = false) {
        const canvas = document.getElementById('certificate-canvas');
        if (!canvas) return;
        
        // Alta resolución 4K para impresión
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        const safeHash = hashCode || 'EPT-PENDIENTE-VERIFICACION';
        const safeDate = dateString ? new Date(dateString) : new Date();
        const cleanDate = safeDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

        const loadImage = (url) => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
        });

        // Cargamos los logos primero
        const logoEdu = await loadImage('https://i.ibb.co/DHyTWkH0/LOGO-EDU.png'); 
        const logoIcon = await loadImage('https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png');

        // 1. Fondo Base
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. PLEXUS (Más visible y denso)
        const nodes = [];
        const numNodes = 250; 
        const maxDist = 200;
        for (let i = 0; i < numNodes; i++) {
            nodes.push({ 
                x: Math.random() * canvas.width, 
                y: Math.random() * canvas.height, 
                r: Math.random() * 2 + 0.5 
            });
        }
        
        for (let i = 0; i < nodes.length; i++) {
            ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.fill(); // Puntos más brillantes
            for (let j = i + 1; j < nodes.length; j++) {
                const dist = Math.sqrt((nodes[i].x - nodes[j].x)**2 + (nodes[i].y - nodes[j].y)**2);
                if (dist < maxDist) {
                    const opacity = (1 - dist/maxDist) * 0.25; // Líneas más marcadas
                    ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`; 
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                }
            }
        }

        // 3. Marcos
        ctx.strokeStyle = '#b72a1e'; ctx.lineWidth = 20; ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4; ctx.strokeRect(70, 70, canvas.width - 140, canvas.height - 140);

        // 4. Logo Superior (Ajustado como corona)
        if (logoEdu) {
            const targetWidth = 320; 
            const targetHeight = (logoEdu.height / logoEdu.width) * targetWidth;
            ctx.drawImage(logoEdu, canvas.width / 2 - targetWidth / 2, 90, targetWidth, targetHeight);
        }

        // 5. Textos Centrales
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        ctx.font = '55px "Playfair Display", Georgia, serif';
        ctx.fillText("CERTIFICADO DE FINALIZACIÓN", canvas.width / 2, 340);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#a0aab5';
        ctx.fillText("Epistecnología otorga el presente reconocimiento a:", canvas.width / 2, 440);

        ctx.font = 'bold 85px "Playfair Display", Georgia, serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(legalName.toUpperCase(), canvas.width / 2, 550);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#a0aab5';
        ctx.fillText("Por haber superado con éxito la NLE del NOOC:", canvas.width / 2, 660);

        ctx.font = 'bold 55px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.currentCourse.title.toUpperCase(), canvas.width / 2, 740);

        ctx.font = 'italic 28px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Diseñado e impartido por: ${instructorName}`, canvas.width / 2, 800);

        // Isotipo Central
        if (logoIcon) ctx.drawImage(logoIcon, canvas.width / 2 - 40, 830, 80, 80);

        // 6. Pie de Página (Validación y Legal)
        ctx.font = '22px monospace';
        ctx.fillStyle = '#64748b';
        
        // Izquierda
        ctx.textAlign = 'left';
        ctx.fillText(`ID VALIDACIÓN: ${safeHash}`, 110, 940);
        ctx.fillText(`FECHA DE EMISIÓN: ${cleanDate}`, 110, 980);

        // Derecha (Check + URL)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`epistecnologia.com/edu/verificar`, canvas.width - 150, 940);
        
        // Ícono de Verificación (Círculo con Check)
        ctx.beginPath(); ctx.arc(canvas.width - 110, 932, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8'; ctx.fill();
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText("✓", canvas.width - 110, 940);

        // 7. BLOQUE LEGAL (3 Líneas definidas)
        ctx.textAlign = 'center';
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText("Epistecnología, revista de divulgación científica y cultural", canvas.width / 2, 930);
        ctx.fillText("Registrada y seriada internacionalmente por la Biblioteca Nacional del Perú", canvas.width / 2, 965);
        ctx.fillText("Depósito Legal N°: 2025-10424  |  ISSN: 3119-7108 (En línea)", canvas.width / 2, 1000);

        // --- DESCARGA AUTOMÁTICA SEGURA ---
        if (autoDownload) {
            setTimeout(() => this.downloadCertificate(), 500);
        }
    },

    downloadCertificate() {
        const canvas = document.getElementById('certificate-canvas');
        if (!canvas) return;
        
        // Convertimos el canvas en una imagen y forzamos la descarga
        const imageURI = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Certificado_EPT_${this.currentCourse.slug}.png`;
        link.href = imageURI;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

document.addEventListener('DOMContentLoaded', () => NoocRoom.init());