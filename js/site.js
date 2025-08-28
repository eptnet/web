document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    /**
     * Función principal que se ejecuta al cargar la página
     */
    async function init() {
        // 1. Obtener el ID del proyecto de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('id');

        if (!projectId) {
            document.body.innerHTML = '<h1>Error: ID de proyecto no encontrado.</h1>';
            return;
        }


        // 2. Buscar SOLO los datos del proyecto primero
        const { data: project, error } = await supabase
            .from('projects')
            .select('title, authors, microsite_content') // Quitamos sessions() y posts() de aquí
            .eq('id', projectId)
            .eq('microsite_is_public', true)
            .single();

        if (error || !project) {
            console.error('Error fetching project:', error);
            document.body.innerHTML = '<h1>Proyecto no encontrado o no es público.</h1>';
            return;
        }

        // 3. Si el proyecto existe, AHORA buscamos sus datos relacionados por separado
        const [sessionsResponse, postsResponse] = await Promise.all([
            // Las sesiones se buscan por el título del proyecto (según tu código `manager-estudio.js`)
            supabase.from('sessions').select('session_title, scheduled_at').eq('project_title', project.title),
            // Los posts se buscan por el ID del proyecto (según tu código `editor.js`)
            supabase.from('posts').select('title, status').eq('project_id', projectId)
        ]);
        
        // --- FIN DE LA CORRECCIÓN ---

        // 4. Renderizar cada sección de la página con todos los datos
        renderCover(project);
        renderSummary(project.microsite_content);
        await renderResearchers(project.authors);
        renderCustomModules(project.microsite_content?.custom_modules);
        renderSessions(sessionsResponse.data); // Usamos la data de la nueva respuesta
        renderPosts(postsResponse.data);     // Usamos la data de la nueva respuesta
        
        setupScrollAnimations();
    }

    function renderCover(project) {
        const content = project.microsite_content || {};
        document.title = project.title; // Cambia el título de la pestaña del navegador
        document.getElementById('cover-section').style.backgroundImage = `url(${content.cover?.imageUrl || ''})`;
        document.getElementById('cover-headline').textContent = content.cover?.headline || project.title;
        document.getElementById('project-authors-list').textContent = (project.authors || []).join(', ');
    }
    
    function renderSummary(content) {
        if (!content?.summary?.content) {
            document.getElementById('summary-section').style.display = 'none';
            return;
        }
        document.getElementById('summary-title').textContent = content.summary.title || 'Resumen del Proyecto';
        document.getElementById('summary-content').innerHTML = content.summary.content;
    }

    async function renderResearchers(authors) {
        if (!authors || authors.length === 0) {
            document.getElementById('team-section').style.display = 'none';
            return;
        }
        const container = document.getElementById('researchers-container');
        const { data: profiles } = await supabase.from('profiles').select('display_name, avatar_url, bio').in('display_name', authors);
        
        container.innerHTML = authors.map(name => {
            const profile = profiles.find(p => p.display_name === name);
            return `
                <div class="card">
                    <img src="${profile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar de ${name}" style="width:50px; height:50px; border-radius:50%;">
                    <h3>${name}</h3>
                    <p>${profile?.bio || ''}</p>
                </div>
            `;
        }).join('');
    }

    function renderCustomModules(modules) {
        if (!modules || modules.length === 0) return;
        const container = document.getElementById('custom-modules-container');
        container.innerHTML = modules.map(module => `
            <section class="site-section scroll-animate">
                <h2>${module.title}</h2>
                <div class="prose">${module.type === 'embed' ? `<iframe src="${module.content.replace('watch?v=', 'embed/')}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>` : module.content}</div>
            </section>
        `).join('');
    }
    
    function renderSessions(sessions) {
        if (!sessions || sessions.length === 0) {
            document.getElementById('sessions-section').style.display = 'none';
            return;
        }
        const container = document.getElementById('sessions-container');
        container.innerHTML = sessions.map(s => `
            <div class="card">
                <h3>${s.session_title}</h3>
                <p>🗓️ ${new Date(s.scheduled_at).toLocaleDateString()}</p>
            </div>
        `).join('');
    }

    function renderPosts(posts) {
        if (!posts || posts.length === 0) {
            document.getElementById('posts-section').style.display = 'none';
            return;
        }
        const container = document.getElementById('posts-container');
        container.innerHTML = posts.map(p => `
            <div class="card">
                <h3>${p.title}</h3>
                <p>Estado: ${p.status}</p>
            </div>
        `).join('');
    }
    
    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.scroll-animate').forEach(el => {
            observer.observe(el);
        });
    }

    // Iniciar todo el proceso
    init();
});