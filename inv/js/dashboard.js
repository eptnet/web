/**
 * =========================================================================
 * DASHBOARD.JS - VERSIÓN FINAL CORREGIDA Y COMPLETA 5.0
 * - NO USA 'import'. Carga Supabase de forma clásica y segura.
 * - Funcionalidad completa para Proyectos y Estudio VDO.Ninja.
 * =========================================================================
 */

const App = {
    supabase: null,
    userId: null,
    userProfile: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            alert("Sesión de usuario no encontrada. Serás redirigido para iniciar sesión.");
            // window.location.href = '/'; 
            return;
        }
        this.userId = session.user.id;
        
        const { data } = await this.supabase.from('profiles').select('*').eq('id', this.userId).single();
        this.userProfile = data;
        
        Header.init(session.user);
        Navigation.init();
    },
};

const Header = {
    init(user) {
        document.getElementById('user-name-header').textContent = `Dashboard de ${user.user_metadata?.full_name || user.email}`;
    }
};

const Navigation = {
    init() {
        document.body.addEventListener('click', e => {
            const navLink = e.target.closest('.nav-link');
            if (navLink) {
                // Si el enlace es para cambiar de sección (Inicio, Estudio)
                if (navLink.dataset.section) {
                    e.preventDefault(); // La prevención se hace aquí dentro
                    this.showSection(navLink.dataset.section);
                }
                // Si el enlace es el botón de Cerrar Sesión
                else if (navLink.id === 'logout-btn') {
                    e.preventDefault(); // Y también aquí
                    App.supabase.auth.signOut().then(() => window.location.href = '/');
                }
                // ¡Importante! Si el enlace no cumple ninguna condición anterior (como "Mi Perfil"),
                // no se ejecuta e.preventDefault() y el navegador seguirá el 'href' con normalidad.
            }

            const creationCard = e.target.closest('.creation-card');
            if (creationCard && creationCard.dataset.studioAction) {
                Studio.openModal(creationCard.dataset.studioAction);
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
            if (link) link.classList.add('active');
            this.initializeSectionLogic(sectionId);
        }
    },
    initializeSectionLogic(sectionId) {
        if (sectionId === 'home-section') Projects.init();
        if (sectionId === 'studio-section') {
            // La lógica ahora se dispara desde las tarjetas, no al entrar a la sección.
        }
    }
};

const Projects = {
    init() {
        if (document.getElementById('projects-list-container')?.dataset.initialized) return;
        this.loadProjects();
        document.getElementById('projects-list-container').dataset.initialized = 'true';
    },
    loadProjects() {
        const container = document.getElementById('projects-list-container');
        const projects = App.userProfile?.projects || [];
        if (projects.length > 0) {
            const select = document.createElement('select');
            select.id = 'project-selector-dropdown';
            select.className = 'project-dropdown'; // Asegúrate de tener esta clase en tu CSS
            select.innerHTML = `<option value="">Selecciona un proyecto...</option>` +
                               projects.map(p => `<option value="${p.title}">${p.title}</option>`).join('');
            container.innerHTML = '';
            container.appendChild(select);
        } else {
            container.innerHTML = '<p>No tienes proyectos registrados. <a href="/inv/profile.html">Añade tu primer proyecto en tu perfil</a>.</p>';
        }
    }
};

const Studio = {
    generatedUrls: {},
    openModal(actionType) {
        if (!App.userProfile?.orcid) {
            alert("Es necesario que completes tu ORCID en tu página de perfil para poder crear una sala.");
            return;
        }
        
        const modalContainer = document.getElementById('modal-overlay-container');
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header"><h2>Configurar: ${this.getTitleForAction(actionType)}</h2><button class="modal-close-btn">&times;</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <div class="form-group"><label>Título de esta Sesión</label><input id="session-title" type="text" required></div>
                            <button type="submit" class="btn-primary" style="width:100%;">Generar y Abrir Control</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        modalContainer.querySelector('#studio-form').addEventListener('submit', (e) => this.handleGenerateRoom(e, actionType));
    },
    closeModal() { document.getElementById('modal-overlay-container').innerHTML = ''; },
    handleGenerateRoom(e, actionType) {
        e.preventDefault();
        
        const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${Date.now().toString().slice(-5)}`;
        const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
        const projectDropdown = document.getElementById('project-selector-dropdown');
        const projectTitle = projectDropdown ? projectDropdown.value : '';
        const vdoDomain = 'https://vdo.epistecnologia.com';
        
        let params = new URLSearchParams();
        params.set('room', roomName);
        params.set('director', directorKey);
        params.set('label', encodeURIComponent(App.userProfile.displayName || 'Investigador'));
        if (projectTitle) params.set('sl1', encodeURIComponent(`Proyecto: ${projectTitle}`));

        switch(actionType) {
            case 'podcast': params.set('proaudio', '1'); params.set('codec', 'opus'); break;
            case 'presentation': params.set('screenshare', '1'); params.set('layout', '4'); break;
            case 'interview': params.set('totalviews', '4'); params.set('layout', '2'); break;
            case 'live': params.set('push', `live-${App.userProfile.orcid.slice(-6)}`); break;
        }

        this.generatedUrls = { director: `${vdoDomain}/mixer.html?${params.toString()}`, guest: `${vdoDomain}/?room=${roomName}` };
        this.openMixer();
        this.closeModal();
    },
    openMixer() {
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.style.display = 'flex';
        mixerContainer.querySelector('#mixer-iframe').src = this.generatedUrls.director;
        this.updateMixerActions();
    },
    closeMixer() {
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.querySelector('#mixer-iframe').src = 'about:blank';
        mixerContainer.style.display = 'none';
    },
    updateMixerActions() {
        const container = document.getElementById('mixer-room-actions');
        const whatsappLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Te invito a mi sala de grabación: ${this.generatedUrls.guest}`)}`;
        container.innerHTML = `
            <button class="btn-secondary" onclick="window.open('${this.generatedUrls.guest}', '_blank')"><i class="fa-solid fa-video"></i> Link Invitado</button>
            <button class="btn-secondary" id="mixer-action-copy"><i class="fa-solid fa-copy"></i> Copiar Link</button>
            <a href="${whatsappLink}" target="_blank" class="btn-secondary whatsapp-btn"><i class="fa-brands fa-whatsapp"></i></a>
        `;
        container.querySelector('#mixer-action-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(this.generatedUrls.guest).then(() => alert('¡Enlace de invitado copiado!'));
        });
        document.getElementById('mixer-popout-btn').onclick = () => window.open(this.generatedUrls.director, '_blank');
        document.getElementById('mixer-close-btn').onclick = () => this.closeMixer();
    },
    getTitleForAction(action) {
        const titles = {
            podcast: 'Grabar Podcast', presentation: 'Grabar Presentación',
            interview: 'Grabar Entrevista', live: 'Transmitir en Vivo'
        };
        return titles[action] || 'Creación';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());