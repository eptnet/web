const NoocRoom = {
    supabase: null,
    currentCourse: null,
    activeLesson: null,
    
    async init() {
        // Inicializar Supabase
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = '...'; // Tu Key
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Obtener Slug del curso de la URL
        const params = new URLSearchParams(window.location.search);
        const slug = params.get('c');
        if (!slug) { window.location.href = '/edu'; return; }

        await this.loadCourseData(slug);
        this.initPlexus();
    },

    async loadCourseData(slug) {
        // 1. Traer datos del curso, módulos y lecciones
        const { data, error } = await this.supabase
            .from('nooc_courses')
            .select(`*, nooc_modules(*, nooc_lessons(*))`)
            .eq('slug', slug)
            .single();

        if (error) { console.error(error); return; }
        this.currentCourse = data;
        
        // Ordenar módulos por order_index
        this.currentCourse.nooc_modules.sort((a,b) => a.order_index - b.order_index);
        
        this.renderSidebar();
        this.showView('start');
    },

    renderSidebar() {
        const list = document.getElementById('modules-nav-list');
        list.innerHTML = this.currentCourse.nooc_modules.map(mod => `
            <div class="module-group">
                <button class="menu-item module-title" disabled><i class="fa-solid fa-layer-group"></i> ${mod.title}</button>
                <div class="lessons-sub-list">
                    ${mod.nooc_lessons.sort((a,b) => a.order_index - b.order_index).map(les => `
                        <button class="menu-item lesson-link" onclick="NoocRoom.loadLesson('${les.id}')">
                            <i class="${les.content_type === 'video' ? 'fa-solid fa-play' : 'fa-solid fa-file-lines'}"></i> ${les.title}
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    showView(view) {
        const stage = document.getElementById('content-display');
        if (view === 'start') {
            stage.innerHTML = `
                <div class="course-intro">
                    <img src="${this.currentCourse.thumbnail_url}" style="width:100%; border-radius:20px; margin-bottom:20px;">
                    <h1>${this.currentCourse.title}</h1>
                    <p class="instructor-tag">Por Henry Márquez | Investigador EPT</p>
                    <div class="prose">${this.currentCourse.description || 'Cargando detalles...'}</div>
                </div>
            `;
        } else if (view === 'feed') {
            // AQUÍ INTEGRAMOS BSKY
            stage.innerHTML = `
                <h2>El Pasillo de la Comunidad</h2>
                <p>Conversación global bajo el tag: <strong>#EPTnooc_${this.currentCourse.slug}</strong></p>
                <div id="bsky-feed-container" class="bsky-feed">
                    <p style="opacity:0.5;">Conectando con Bluesky...</p>
                </div>
            `;
            this.loadBskyFeed();
        }
    },

    loadLesson(lessonId) {
        // Busca la lección en la memoria
        let lesson = null;
        this.currentCourse.nooc_modules.forEach(m => {
            const found = m.nooc_lessons.find(l => l.id === lessonId);
            if(found) lesson = found;
        });

        const stage = document.getElementById('content-display');
        stage.innerHTML = `
            <div class="lesson-viewer">
                <h3>${lesson.title}</h3>
                <div class="lesson-media-box">
                    ${this.renderMedia(lesson)}
                </div>
                <div class="lesson-text-body">
                    </div>
                <hr>
                <div class="lesson-social-thread">
                    <h4>Hilo de Discusión</h4>
                    <div id="lesson-comments">Cargando comentarios de Bsky...</div>
                </div>
            </div>
        `;
    },

    renderMedia(les) {
        if (les.content_type === 'video') {
            return `<iframe width="100%" height="450" src="${les.content_payload}" frameborder="0" allowfullscreen></iframe>`;
        }
        if (les.content_type === 'iframe') {
            return les.content_payload; // Inyecta el código de Canva/Genially
        }
        return '';
    },

    // MOTOR PLEXUS (Simplificado para performance)
    initPlexus() {
        /* Lógica del canvas de partículas heredada de servicios.html */
    }
};

document.addEventListener('DOMContentLoaded', () => NoocRoom.init());