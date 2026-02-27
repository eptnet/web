export const Navigation = {
    init() {
        document.body.addEventListener('click', e => {
            const navLink = e.target.closest('.nav-link');
            if (navLink && navLink.dataset.section) {
                e.preventDefault();
                this.showSection(navLink.dataset.section);
            } else if (navLink && navLink.id === 'logout-btn') {
                e.preventDefault();
                window.App.supabase.auth.signOut().then(() => window.location.href = '/');
            }
        });
        this.showSection('home-section');
    },

    showSection(sectionId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        
        const container = document.getElementById(sectionId);
        const link = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
        
        if (container) {
            const template = document.getElementById(`template-${sectionId}`);
            if (template && container.innerHTML.trim() === '') {
                container.appendChild(template.content.cloneNode(true));
            }
            container.classList.add('active');
            if(link) link.classList.add('active');
            this.initializeSectionLogic(sectionId);
        }
    },

    async initializeSectionLogic(sectionId) {
        if (sectionId === 'home-section') {
            const { Projects } = await import('./manager-proyectos.js');
            Projects.init();
        } else if (sectionId === 'studio-section') {
            const { Studio } = await import('./manager-estudio.js');
            Studio.init();
        } else if (sectionId === 'events-section') { // --- LÓGICA AÑADIDA ---
            const { EventsManager } = await import('./manager-eventos.js');
            EventsManager.init();
        } else if (sectionId === 'content-section') {
            if (window.App.userProfile.role === 'admin') {
                const { ContentManager } = await import('./manager-contenido.js');
                ContentManager.init();
            } else {
                document.getElementById('content-section').innerHTML = '<h2><i class="fas fa-lock"></i> Acceso Denegado</h2><p>Esta sección solo está disponible para administradores.</p>';
            }
        // --- AÑADE ESTO PARA LA COMUNIDAD ---
        } else if (sectionId === 'community-section') {
            if (window.App.userProfile.role === 'admin') {
                const { CommunityManager } = await import('./manager-comunidad.js');
                CommunityManager.init(window.App.supabase, window.App.userProfile);
                CommunityManager.loadUsers(); // Cargamos la tabla al entrar
            }
        }
    }
};