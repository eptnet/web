const NoocRoom = {
    supabase: null,
    currentCourse: null,
    activeLesson: null,
    
    init() {
        document.addEventListener('mainReady', async () => {
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            const { data: { session } } = await this.supabase.auth.getSession();
            if (session) {
                const { data: profile } = await this.supabase.from('profiles').select('display_name, username, avatar_url, xp_total').eq('id', session.user.id).single();
                if (profile) {
                    document.getElementById('user-name-display').textContent = profile.display_name || profile.username || 'Investigador';
                    if (profile.avatar_url) document.getElementById('user-avatar-placeholder').innerHTML = `<img src="${profile.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    if (profile.xp_total !== undefined) document.getElementById('progress-percent').textContent = profile.xp_total + ' XP';
                }
            }

            const params = new URLSearchParams(window.location.search);
            const slug = params.get('c');
            if (!slug) { window.location.href = '/edu'; return; }

            await this.loadCourseData(slug);
            this.initPlexus();
            this.setupModalListeners();
        });

        setTimeout(() => { if (!this.supabase) document.dispatchEvent(new Event('mainReady')); }, 1000);
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

    showView(view, payload = null) {
        document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active-main'));
        const stage = document.getElementById('content-display');
        
        if (view === 'start') {
            document.getElementById('btn-nav-inicio').classList.add('active-main');
            this.toggleMobileMenu(true); // Auto-cerrar menú en móvil

            stage.innerHTML = `
                <div class="course-intro bento-card glow-hover">
                    <img src="${this.currentCourse.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg'}" style="width:100%; border-radius:16px; margin-bottom:20px; object-fit:cover; max-height:300px;">
                    <span class="rank-tag" style="background: var(--edu-accent); color: white; padding: 5px 15px; border-radius: 50px;">Vista General</span>
                    <h1 style="font-size: 2.5rem; margin: 15px 0 10px 0;">${this.currentCourse.title}</h1>
                    <p style="opacity:0.8; font-size:1.1rem;">Selecciona un módulo en la brújula para comenzar tu aprendizaje.</p>
                </div>
            `;
        } else if (view === 'feed') {
            document.getElementById('btn-nav-feed').classList.add('active-main');
            this.toggleMobileMenu(true); // Auto-cerrar menú en móvil

            stage.innerHTML = `
                <div class="bento-card glow-hover">
                    <h2 style="margin-top:0;"><i class="fa-solid fa-users-rays"></i> Comunidad del Curso</h2>
                    <p style="opacity:0.8;">Preséntate, comparte tus avances y debate con otros investigadores inscritos en este programa.</p>
                    
                    <div class="organic-feed-box">
                        <div class="feed-composer">
                            <div class="avatar-sm"><i class="fa-solid fa-user"></i></div>
                            <input type="text" placeholder="Comparte un hallazgo o duda con la clase..." class="feed-input">
                            <button class="btn-action" style="padding: 8px 15px; font-size: 0.8rem;"><i class="fa-solid fa-paper-plane"></i></button>
                        </div>
                        <div id="organic-feed-stream" style="margin-top: 20px;">
                            <p style="opacity:0.5; text-align:center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Sincronizando red...</p>
                        </div>
                    </div>
                </div>
            `;
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
        }
    },

    openLessonModal(lessonId) {
        let lesson = null;
        this.currentCourse.nooc_modules.forEach(m => { const found = m.nooc_lessons.find(l => l.id === lessonId); if(found) lesson = found; });
        if(!lesson) return;

        this.toggleMobileMenu(true); // Si seleccionó la lección desde el menú lateral móvil, lo cerramos.

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
                    <input type="text" placeholder="¿Qué aprendiste aquí? Añade tus notas..." class="feed-input">
                    <button class="btn-action" style="padding: 8px 15px;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    },

    closeLessonModal() {
        document.getElementById('lesson-modal').classList.remove('active');
        document.getElementById('lesson-modal-content').innerHTML = ''; 
        document.body.style.overflow = ''; 
    },

    setupModalListeners() {
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeLessonModal());
        document.getElementById('lesson-modal').addEventListener('click', (e) => {
            if (e.target.id === 'lesson-modal') this.closeLessonModal();
        });
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
    }
};

document.addEventListener('DOMContentLoaded', () => NoocRoom.init());