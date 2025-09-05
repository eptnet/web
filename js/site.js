// =================================================================
// ARCHIVO DEFINITIVO Y CORREGIDO v3: /js/site.js
// INCLUYE TODAS LAS FUNCIONES Y LA LÓGICA CORRECTA PARA POSTS
// =================================================================

document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        // --- CAMBIO 1: Leemos 'slug' en lugar de 'id' ---
        const slug = urlParams.get('slug');

        if (!slug) {
            document.body.innerHTML = '<h1>Error: Slug de proyecto no encontrado en la URL.</h1>';
            return;
        }

        // --- CAMBIO 2: Buscamos en la base de datos usando la columna 'slug' ---
        const { data: project, error } = await supabase
            .from('projects')
            .select('id, user_id, title, authors, microsite_content, template_style, color_palette')
            .eq('slug', slug) 
            .eq('microsite_is_public', true)
            .single();

        if (error || !project) {
            console.error('Error fetching project:', error);
            document.body.innerHTML = '<h1>Proyecto no encontrado o no es público.</h1>'; 
            return;
        }

        document.body.classList.add(`template-${project.template_style}`, `palette-${project.color_palette}`);
        // const projectId = (await supabase.from('projects').select('id').eq('slug', slug).single()).data.id;

        // --- CAMBIO 1: Asegurarnos de traer el ID de la sesión ---
        const [sessionsResponse, postsResponse] = await Promise.all([
            supabase.from('sessions').select('id, session_title, scheduled_at, thumbnail_url').eq('project_title', project.title),
            supabase.from('posts').select('title, status').eq('project_id', project.id)
        ]);
        
        // Renderizamos todo
        renderCover(project);
        renderSummary(project.microsite_content);
        renderResearchers(project.authors);
        renderCustomModules(project.microsite_content?.custom_modules);
        renderSessions(sessionsResponse.data);
        renderPosts(postsResponse.data);
        
        setupScrollAnimations();
        setupEventListeners();
        setupStickyNav();
    }

    function setupStickyNav() {
        const nav = document.querySelector('.site-nav');
        if (!nav) return;

        const navLinkList = document.getElementById('nav-link-list');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const navLinks = nav.querySelectorAll('a');
        const sections = document.querySelectorAll('.site-section');

        // --- LÓGICA AÑADIDA PARA EL MENÚ MÓVIL ---
        mobileMenuBtn.addEventListener('click', () => {
            navLinkList.classList.toggle('is-open');
        });

        // Lógica para el smooth scroll (sin cambios)
        navLinks.forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                navLinkList.classList.remove('is-open'); // Cierra el menú móvil al hacer clic en un enlace
                const targetId = link.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Lógica para resaltar el enlace activo (sin cambios)
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navLinks.forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
                    });
                }
            });
        }, { rootMargin: "-40% 0px -60% 0px" });

        sections.forEach(section => {
            if (section.id) {
                observer.observe(section);
            }
        });
    }

    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            const researcherCard = e.target.closest('.researcher-card-btn');
            if (researcherCard) { openResearcherModal(researcherCard.dataset.authorName); }
            if (e.target.id === 'modal-close-btn' || e.target.classList.contains('modal-overlay')) {
                closeResearcherModal();
            }
        });
    }

    async function openResearcherModal(authorName) {
        const modalOverlay = document.getElementById('researcher-modal-overlay');
        const modalContent = document.getElementById('modal-profile-content');
        modalContent.innerHTML = '<p>Cargando perfil...</p>';
        modalOverlay.classList.add('is-visible');

        const { data: profile, error } = await supabase.from('profiles').select('*').eq('display_name', authorName).single();
        if (error || !profile) { modalContent.innerHTML = '<p>No se pudo cargar el perfil detallado.</p>'; return; }

        // --- CAMBIO 2: Añadir todas las redes sociales y hacer ORCID cliqueable ---
        const socials = [
            { url: profile.bsky_url, icon: 'fa-brands fa-bluesky', name: 'Bluesky' },
            { url: profile.linkedin_url, icon: 'fab fa-linkedin', name: 'LinkedIn' },
            { url: profile.x_url, icon: 'fa-brands fa-x-twitter', name: 'X' },
            { url: profile.youtube_url, icon: 'fab fa-youtube', name: 'YouTube' },
            { url: profile.instagram_url, icon: 'fab fa-instagram', name: 'Instagram' },
            { url: profile.substack_url, icon: 'fa-solid fa-bookmark', name: 'Substack' },
            { url: profile.website_url, icon: 'fas fa-globe', name: 'Sitio Web' }
        ].filter(s => s.url);
        
        const orcidHtml = profile.orcid 
            ? `<a href="${profile.orcid}" target="_blank" rel="noopener noreferrer" class="profile-orcid">
                 <i class="fa-brands fa-orcid"></i> ${profile.orcid.replace('https://orcid.org/','')}
               </a>`
            : '';

        modalContent.innerHTML = `
            <div class="profile-header">
                <img src="${profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="profile-avatar">
                <div>
                    <h2 class="profile-name">${profile.display_name}</h2>
                    ${orcidHtml}
                </div>
            </div>
            <p class="profile-bio">${profile.bio || 'Biografía no disponible.'}</p>
            ${socials.length > 0 ? `<div class="profile-socials">${socials.map(s => `<a href="${s.url}" target="_blank" title="${s.name}"><i class="${s.icon}"></i></a>`).join('')}</div>` : ''}
        `;
    }

    function closeResearcherModal() {
        document.getElementById('researcher-modal-overlay').classList.remove('is-visible');
    }

    function renderCover(project) {
        const content = project.microsite_content || {};
        const summaryText = content.summary?.content.replace(/<[^>]*>?/gm, '').substring(0, 150) || `Un proyecto de ${project.authors.join(', ')}`;
        const pageUrl = `${window.location.origin}${window.location.pathname}?slug=${project.slug}`;
        const coverSection = document.getElementById('cover-section'); 
        coverSection.style.setProperty('--cover-bg-image', `url(${content.cover?.imageUrl || ''})`); 

        // Rellenar contenido de la página
        document.title = project.title;
        document.getElementById('cover-section').style.backgroundImage = `url(${content.cover?.imageUrl || ''})`;
        document.getElementById('cover-headline').textContent = content.cover?.headline || project.title;
        document.getElementById('project-authors-list').textContent = (project.authors || []).join(', ');
        document.getElementById('nav-project-title').textContent = project.title;

        // --- LÓGICA AÑADIDA PARA RELLENAR META TAGS ---
        document.getElementById('og-title').setAttribute('content', content.cover?.headline || project.title);
        document.getElementById('og-description').setAttribute('content', summaryText);
        // Usa la imagen SEO si existe, si no, usa la imagen de portada
        document.getElementById('og-image').setAttribute('content', content.seo?.imageUrl || content.cover?.imageUrl || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png');
        document.getElementById('og-url').setAttribute('content', pageUrl);
    }
    
    function renderSummary(content) {
        if (!content?.summary?.content) { document.getElementById('summary-section').style.display = 'none'; return; }
        document.getElementById('summary-title').textContent = content.summary.title || 'Resumen del Proyecto';
        document.getElementById('summary-content').innerHTML = content.summary.content;
    }

    function renderResearchers(authors) {
        if (!authors || authors.length === 0) { document.getElementById('team-section').style.display = 'none'; return; }
        const container = document.getElementById('researchers-container');
        container.innerHTML = authors.map(name => `
            <button class="researcher-card-btn" data-author-name="${name}">
                <img src="https://i.ibb.co/61fJv24/default-avatar.png" alt="Avatar de ${name}">
                <h3>${name}</h3>
            </button>
        `).join('');
        loadResearcherAvatars(authors);
    }

    async function loadResearcherAvatars(authors) {
        const { data: profiles } = await supabase.from('profiles').select('display_name, avatar_url').in('display_name', authors);
        if (profiles) {
            profiles.forEach(p => {
                const imgEl = document.querySelector(`.researcher-card-btn[data-author-name="${p.display_name}"] img`);
                if (imgEl && p.avatar_url) imgEl.src = p.avatar_url;
            });
        }
    }

    // ESTA INCRUSTACIONES EMBED LINK
    function renderCustomModules(modules) {
        if (!modules || modules.length === 0) return;
        const container = document.getElementById('custom-modules-container');

        container.innerHTML = modules.map(module => {
            let contentHtml = '';
            if (module.type === 'text') {
                contentHtml = `<div class="prose">${module.content}</div>`;
            } else if (module.type === 'embed') {
                contentHtml = `<iframe src="${module.content.replace('watch?v=', 'embed/')}" width="100%" height="400" frameborder="0" allowfullscreen style="border:0; border-radius: 8px;"></iframe>`;
            } else if (module.type === 'subscription') { // --- NUEVA LÓGICA ---
                // Si el enlace es de Substack, lo convertimos en un embed.
                if (module.url && module.url.includes('substack.com')) {
                    const substackEmbedUrl = `${module.url}/embed`;
                    contentHtml = `<p>${module.text || ''}</p> <iframe src="${substackEmbedUrl}" width="100%" height="320" style="border:1px solid #EEE; background:white;" frameborder="0" scrolling="no"></iframe>`;
                } else {
                    contentHtml = `<p>${module.text || ''}</p> <a href="${module.url || '#'}" target="_blank" class="btn-subscribe">Suscribirse</a>`;
                }
            }
                else if (module.type === 'sponsors' && module.sponsors.length > 0) {
                contentHtml = `
                    <div class="sponsors-grid">
                        ${module.sponsors.map(sponsor => `
                            <a href="${sponsor.siteUrl}" target="_blank" rel="noopener" class="sponsor-link">
                                <img src="${sponsor.logoUrl}" alt="Logo del patrocinador" class="sponsor-logo">
                            </a>
                        `).join('')}
                    </div>
                `;
            }
                else if (module.type === 'timeline' && module.milestones.length > 0) {
                contentHtml = `
                    <div class="timeline">
                        ${module.milestones.map(milestone => `
                            <div class="timeline-item">
                                <div class="timeline-point"></div>
                                <div class="timeline-content">
                                    <div class="timeline-date">${milestone.date}</div>
                                    <h3 class="timeline-title">${milestone.title}</h3>
                                    <p class="timeline-description">${milestone.description}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            return `
                <section class="site-section scroll-animate">
                    <h2>${module.title}</h2>
                    ${contentHtml}
                </section>
            `;
        }).join('');
    }
    
    function renderSessions(sessions) {
        if (!sessions || sessions.length === 0) { document.getElementById('sessions-section').style.display = 'none'; return; }
        const container = document.getElementById('sessions-container');
        
        // --- CAMBIO 3: Construir la URL de la sesión correctamente ---
        container.innerHTML = sessions.map(s => `
            <a href="/live.html?sesion=${s.id}" target="_blank" class="card session-card">
                <img src="${s.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Miniatura del evento" class="session-card-image">
                <div class="session-card-content">
                    <h3>${s.session_title}</h3>
                    <p>🗓️ ${new Date(s.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                </div>
            </a>
        `).join('');
    }

    // FUNCIÓN ACTUALIZADA PARA USAR LA TABLA 'posts'
    function renderPosts(posts) {
        if (!posts || posts.length === 0) { document.getElementById('posts-section').style.display = 'none'; return; }
        const container = document.getElementById('posts-container');
        container.innerHTML = posts.map(p => `
            <div class="card post-card">
                <h3>${p.title}</h3>
                <p>Estado: ${p.status}</p>
            </div>
        `).join('');
    }
    
    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.scroll-animate').forEach(el => { observer.observe(el); });
    }

    init();
});