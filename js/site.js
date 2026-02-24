// =================================================================
// ARCHIVO ACTUALIZADO: /js/site.js (Lógica Bento CV + Modales)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let currentProjectData = null; // Guardamos el proyecto globalmente para los modales

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');

        // NUEVA LÓGICA: Si no hay '?slug=', lo extraemos de la ruta limpia '/p/mi-proyecto'
        if (!slug && window.location.pathname.startsWith('/p/')) {
            slug = window.location.pathname.split('/p/')[1].replace(/\/$/, '');
        }

        if (!slug) return document.body.innerHTML = '<h1 style="color:white; text-align:center; margin-top:100px;">Proyecto no encontrado.</h1>';

        const { data: project, error } = await supabase
            .from('projects')
            .select(`*, event:associated_event_id (*, editions:event_editions(start_date))`)
            .eq('slug', slug)
            .eq('microsite_is_public', true)
            .single();

        if (error || !project) return document.body.innerHTML = '<h1 style="color:white; text-align:center; margin-top:100px;">Proyecto no disponible.</h1>';
        currentProjectData = project;

        // Pedimos los posts (incluyendo contenido) y las sesiones
        const { data: sessions } = await supabase.from('sessions').select('*').eq('project_title', project.title);
        // Traemos el contenido html (content) para poder leerlo en el modal
        const { data: posts } = await supabase.from('posts').select('id, title, status, content, updated_at').eq('project_id', project.id);

        renderCover(project);
        renderSummary(project.microsite_content);
        renderResearchers(project.authors);
        renderActivitiesSection(project.event, sessions);
        renderPosts(posts);
        renderCustomModules(project.microsite_content?.custom_modules);
        
        setupScrollAnimations();
        setupEventListeners();
        setupStickyNav();
    }

    function renderCover(project) {
        const content = project.microsite_content || {};
        document.title = project.title;
        document.getElementById('cover-section').style.backgroundImage = `url(${content.cover?.imageUrl || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'})`;
        document.getElementById('cover-headline').textContent = content.cover?.headline || project.title;
        document.getElementById('project-authors-list').textContent = project.doi ? `DOI: ${project.doi}` : `Investigación por ${project.authors.join(', ')}`;
        document.getElementById('nav-project-title').textContent = project.title;
    }

    function renderSummary(content) {
        const bento = document.getElementById('summary-bento');
        if (!content?.summary?.content) { bento.style.display = 'none'; return; }
        document.getElementById('summary-content').innerHTML = content.summary.content;
    }

    function renderResearchers(authors) {
        const bento = document.getElementById('team-bento');
        if (!authors || authors.length === 0) { bento.style.display = 'none'; return; }
        const container = document.getElementById('researchers-container');
        container.innerHTML = authors.map(name => `
            <div class="team-member" onclick="openResearcherModal('${name}')">
                <img src="https://i.ibb.co/61fJv24/default-avatar.png" data-author="${name}" alt="Avatar">
                <div>
                    <h4>${name}</h4>
                    <span>Investigador</span>
                </div>
            </div>
        `).join('');
        loadResearcherAvatars(authors);
    }

    // 1. FUNCIÓN DE AVATARES CORREGIDA (Ahora busca a los autores de los artículos)
    async function loadResearcherAvatars(authors) {
        const { data: profiles } = await supabase.from('profiles').select('display_name, avatar_url').in('display_name', authors);
        if (profiles) {
            profiles.forEach(p => {
                // Actualiza la foto en la sección de equipo
                const teamImg = document.querySelector(`img[data-author="${p.display_name}"]`);
                if (teamImg && p.avatar_url) teamImg.src = p.avatar_url;
                
                // Actualiza TODAS las fotos en las tarjetas de artículos (NUEVO)
                const postImgs = document.querySelectorAll(`img[data-author-avatar="${p.display_name}"]`);
                postImgs.forEach(img => {
                    if (p.avatar_url) img.src = p.avatar_url;
                });
            });
        }
    }

    // EVENTOS BENTO: Main Event gigante + Carrusel secundario con Flechas
    function renderActivitiesSection(event, sessions) {
        const container = document.getElementById('events-container');
        let htmlContent = '';

        if (event && event.id) {
            const latestEdition = event.editions?.sort((a,b) => new Date(b.start_date) - new Date(a.start_date))[0];
            const date = latestEdition ? new Date(latestEdition.start_date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : '';
            htmlContent += `
                <div class="bento-box span-12 main-event-card scroll-animate" onclick="window.open('/evento.html?slug=${event.slug}', '_blank')">
                    <img src="${event.cover_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" class="main-event-bg" alt="Fondo Evento">
                    <div class="main-event-content">
                        <span class="badge" style="background:var(--primary-color); color:white; padding:6px 14px; border-radius:50px; font-size:0.85rem; margin-bottom:15px; display:inline-block; font-weight:bold;">✨ EVENTO PRINCIPAL</span>
                        <h3>${event.title}</h3>
                        <p style="color:rgba(255,255,255,0.9); font-size:1.1rem; margin:0;"><i class="fa-regular fa-calendar"></i> ${date}</p>
                    </div>
                </div>
            `;
        }

        if (sessions && sessions.length > 0) {
            htmlContent += `
                <div class="bento-box span-12 scroll-animate" style="padding: 2.5rem 2.5rem 1.5rem 2.5rem;">
                    <div class="bento-header"><i class="fa-solid fa-video text-accent"></i><h2>Sesiones Grabadas</h2></div>
                    <div class="carousel-wrapper">
                        <button class="carousel-arrow left" onclick="document.getElementById('ses-carousel').scrollBy({left: -320, behavior: 'smooth'})"><i class="fa-solid fa-chevron-left"></i></button>
                        
                        <div id="ses-carousel" class="sessions-carousel">
                            ${sessions.map(s => `
                                <a href="/live.html?sesion=${s.id}" target="_blank" class="session-mini-card">
                                    <img src="${s.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Thumb">
                                    <div>
                                        <h4>${s.session_title}</h4>
                                        <p style="margin:0; font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${new Date(s.scheduled_at).toLocaleDateString()}</p>
                                    </div>
                                </a>
                            `).join('')}
                        </div>
                        
                        <button class="carousel-arrow right" onclick="document.getElementById('ses-carousel').scrollBy({left: 320, behavior: 'smooth'})"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = htmlContent;
    }

    // ARTÍCULOS BENTO: Ahora con autor
    function renderPosts(posts) {
        const bento = document.getElementById('posts-bento');
        const container = document.getElementById('posts-container');
        if (!posts) return;
        
        const publishedPosts = posts.filter(p => p.status === 'published');
        if (publishedPosts.length === 0) { bento.style.display = 'none'; return; }
        
        bento.style.display = 'flex';
        
        // Obtenemos el nombre del primer autor del proyecto (o genérico)
        const authorName = currentProjectData.authors?.[0] || 'Investigador Principal';

        container.innerHTML = publishedPosts.map(p => {
            const postJson = encodeURIComponent(JSON.stringify(p));
            return `
                <div class="post-card" onclick="openArticleModal('${postJson}')">
                    <span class="post-card-meta"><i class="fa-solid fa-book-open"></i> Lectura</span>
                    <h3>${p.title}</h3>
                    <div class="post-card-author">
                        <img src="https://i.ibb.co/61fJv24/default-avatar.png" alt="Autor" data-author-avatar="${authorName}">
                        <span>${authorName}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Reutilizamos la función existente para cargar el avatar real si lo tiene
        loadResearcherAvatars([authorName]);
    }

    window.openArticleModal = function(postJsonString) {
        const post = JSON.parse(decodeURIComponent(postJsonString));
        document.getElementById('modal-article-title').textContent = post.title;
        document.getElementById('modal-article-content').innerHTML = post.content || '<p>Contenido no disponible.</p>';
        
        // Asignamos el DOI del proyecto si existe
        const doiElement = document.getElementById('modal-article-doi');
        if (currentProjectData && currentProjectData.doi) {
            doiElement.innerHTML = `<i class="fa-solid fa-fingerprint"></i> ${currentProjectData.doi}`;
            doiElement.style.display = 'inline-flex';
        } else {
            doiElement.style.display = 'none';
        }

        document.getElementById('article-modal-overlay').classList.add('is-visible');
    };

    // 2. MÓDULOS A 2 COLUMNAS (Inteligencia de distribución)
    function renderCustomModules(modules) {
        if (!modules || modules.length === 0) return;
        const container = document.getElementById('custom-modules-container');

        container.innerHTML = modules.map(module => {
            let contentHtml = '';
            
            // LÓGICA DE TAMAÑO: Texto y Suscripción ocupan media pantalla (span-6)
            let spanClass = (module.type === 'text' || module.type === 'subscription') ? 'span-6' : 'span-12';
            
            if (module.type === 'text') {
                contentHtml = `<div class="prose">${module.content}</div>`;
            } 
            else if (module.type === 'embed') {
                let embedUrl = module.content;
                if (embedUrl.includes('youtube.com/watch?v=')) embedUrl = `https://www.youtube.com/embed/${embedUrl.split('v=')[1].split('&')[0]}`;
                else if (embedUrl.includes('youtu.be/')) embedUrl = `https://www.youtube.com/embed/${embedUrl.split('youtu.be/')[1].split('?')[0]}`;
                contentHtml = `<div class="embed-responsive"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`;
            } 
            else if (module.type === 'sponsors' && module.sponsors && module.sponsors.length > 0) {
                const logosHtml = module.sponsors.map(s => `<a href="${s.siteUrl}" target="_blank"><img src="${s.logoUrl}" class="sponsor-logo" alt="Logo"></a>`).join('');
                contentHtml = `<div class="marquee-wrapper"><div class="marquee-content">${logosHtml}${logosHtml}</div></div>`;
            } 
            else if (module.type === 'subscription') {
                if (module.url && module.url.includes('substack.com')) {
                    contentHtml = `<p class="prose" style="text-align:center; margin-bottom:20px;">${module.text}</p><iframe src="${module.url}/embed" width="100%" height="320" style="background:white; border-radius:12px; border:none;" frameborder="0" scrolling="no"></iframe>`;
                } else {
                    contentHtml = `<p class="prose" style="text-align:center;">${module.text}</p><div style="text-align:center;"><a href="${module.url}" target="_blank" class="btn btn-primary">Suscribirse</a></div>`;
                }
            }
            else if (module.type === 'timeline' && module.milestones && module.milestones.length > 0) {
                contentHtml = `
                    <div class="timeline">
                        ${module.milestones.map(milestone => `
                            <div class="timeline-item">
                                <div class="timeline-point"></div>
                                <div class="timeline-date">${milestone.date}</div>
                                <h3 class="timeline-title">${milestone.title}</h3>
                                <p class="timeline-description">${milestone.description}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            return `
                <div class="bento-box ${spanClass} scroll-animate">
                    <div class="bento-header"><i class="fa-solid fa-star text-accent"></i><h2>${module.title}</h2></div>
                    ${contentHtml}
                </div>
            `;
        }).join('');
    }

    // Modal de Perfil de Investigador
    window.openResearcherModal = async function(authorName) {
        const modalOverlay = document.getElementById('researcher-modal-overlay');
        const modalContent = document.getElementById('modal-profile-content');
        modalContent.innerHTML = '<p>Cargando perfil...</p>';
        modalOverlay.classList.add('is-visible');

        const { data: profiles, error } = await supabase.from('profiles').select('*').eq('display_name', authorName);
        if (error || !profiles || profiles.length === 0) {
            modalContent.innerHTML = '<p>Perfil no disponible.</p>'; return;
        }

        const profile = profiles[0];
        const orcidHtml = profile.orcid ? `<a href="${profile.orcid}" target="_blank" style="color:var(--primary-color); font-size:0.9rem; margin-top:10px; display:block;"><i class="fa-brands fa-orcid"></i> ${profile.orcid.replace('https://orcid.org/','')}</a>` : '';

        modalContent.innerHTML = `
            <img src="${profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:1rem; border: 3px solid var(--surface-hover);">
            <h2 style="margin:0; color:#fff; font-family:'Playfair Display', serif;">${profile.display_name}</h2>
            ${orcidHtml}
            <p style="color:var(--text-muted); margin-top:1.5rem; line-height:1.6;">${profile.bio || 'Investigador en Epistecnología.'}</p>
        `;
    };

    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
    }

    function setupStickyNav() {
        const nav = document.getElementById('site-nav');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });
    }

    // 3. LISTENERS ACTUALIZADOS (Incluye el Botón Día/Noche)
    function setupEventListeners() {
        // Menú Móvil
        const mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                const list = document.getElementById('nav-link-list');
                list.style.display = list.style.display === 'flex' ? 'none' : 'flex';
                list.style.flexDirection = 'column';
                list.style.position = 'absolute';
                list.style.top = '100%';
                list.style.right = '0';
                list.style.background = 'var(--surface-color)';
                list.style.padding = '1rem 2rem';
            });
        }
        
        // Cambiador de Tema (Sol/Luna)
        const themeBtn = document.getElementById('theme-switcher-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isLight = document.body.classList.contains('palette-light');
                if (isLight) {
                    document.body.classList.remove('palette-light');
                    themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
                } else {
                    document.body.classList.add('palette-light');
                    themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                }
            });
        }
        
        // Cerrar modales
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if(e.target === overlay) overlay.classList.remove('is-visible');
            });
        });
    }

    init();
});