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

// ESTE ES EL CÓDIGO NUEVO QUE REEMPLAZA AL ANTERIOR
const Studio = {
    generatedUrls: {},

    // --- MÉTODO MODIFICADO: openModal ---
    // Ahora construye un formulario mucho más completo.
    openModal(actionType) {
        // Validación 1: El usuario debe tener un ORCID en su perfil.
        if (!App.userProfile?.orcid) {
            alert("Es necesario que completes tu ORCID en tu página de perfil para poder crear una sala.");
            return;
        }

        // Validación 2: El usuario debe haber seleccionado un proyecto primero.
        const projectDropdown = document.getElementById('project-selector-dropdown');
        const selectedProject = projectDropdown ? projectDropdown.value : '';
        if (!selectedProject) {
            alert("Por favor, selecciona primero un proyecto en el Paso 1.");
            return;
        }
        
        const modalContainer = document.getElementById('modal-overlay-container');
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header">
                        <h2>Configurar: ${this.getTitleForAction(actionType)}</h2>
                        <button class="modal-close-btn">&times;</button>
                    </header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${selectedProject}</strong></p>
                            <div class="form-group">
                                <label for="session-title">Título del Evento o Sesión</label>
                                <input id="session-title" name="sessionTitle" type="text" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="session-mode">Modo de la Sala</label>
                                <select id="session-mode" name="sessionMode" class="project-dropdown">
                                    <option value="control">Solo entrar a la sala de control</option>
                                    <option value="record">Grabar la sesión</option>
                                    <option value="live">Grabar y Transmitir en Vivo</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="guest-count">Número Máximo de Invitados</label>
                                <select id="guest-count" name="guestCount" class="project-dropdown">
                                    ${Array.from({length: 9}, (_, i) => `<option value="${i + 1}">${i + 1} invitado(s)</option>`).join('')}
                                </select>
                            </div>

                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 0.5rem;">
                                    <input id="hide-names" name="hideNames" type="checkbox" style="width: auto;">
                                    Ocultar nombres de los participantes en la sala
                                </label>
                            </div>
                            
                            <button type="submit" class="btn-primary" style="width:100%; margin-top: 1rem;">Generar y Abrir Sala</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        modalContainer.querySelector('#studio-form').addEventListener('submit', (e) => this.handleGenerateRoom(e, actionType));
    },

    closeModal() { 
        document.getElementById('modal-overlay-container').innerHTML = ''; 
    },

    // --- MÉTODO MODIFICADO: handleGenerateRoom ---
    // Ahora lee los nuevos campos del formulario para construir la URL.
    handleGenerateRoom(e, actionType) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${Date.now().toString().slice(-5)}`;
        const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
        const projectTitle = document.getElementById('project-selector-dropdown').value;
        const vdoDomain = 'https://vdo.epistecnologia.com';
        
        let params = new URLSearchParams();
        params.set('room', roomName);
        params.set('director', directorKey);
        
        // Parámetros básicos de la sala
        const sessionTitle = formData.get('sessionTitle');
        if(sessionTitle) params.set('sl2', encodeURIComponent(sessionTitle));
        if (projectTitle) params.set('sl1', encodeURIComponent(`Proyecto: ${projectTitle}`));
        params.set('label', encodeURIComponent(App.userProfile.displayName || 'Investigador'));
        
        // Parámetros del nuevo formulario
        const sessionMode = formData.get('sessionMode');
        const guestCount = formData.get('guestCount');
        const hideNames = formData.get('hideNames');

        if (sessionMode === 'record') {
            params.set('record', 'auto'); // Inicia grabación automáticamente
        } else if (sessionMode === 'live') {
            params.set('record', 'auto');
            // Creamos un stream ID único. A futuro, se podría pedir en el formulario.
            const streamId = `live-${App.userProfile.orcid.slice(-6)}`;
            params.set('push', streamId);
            params.set('sl3', '🔴 EN VIVO');
        }

        if (guestCount) {
            params.set('totalviews', guestCount);
        }

        if (hideNames === 'on') { // El valor de un checkbox es 'on'
            params.set('hidenames', '1');
        }
        
        // Parámetros específicos del tipo de creación (tarjeta)
        switch(actionType) {
            case 'podcast':
                params.set('proaudio', '1');
                params.set('codec', 'opus');
                params.set('novideo', '1'); // Deshabilita el video para un podcast de solo audio
                break;
            case 'presentation':
                params.set('screenshare', '1');
                params.set('layout', '4'); // Layout que favorece la pantalla compartida
                break;
            case 'interview':
                params.set('layout', '2'); // Layout de entrevista
                break;
        }

        this.generatedUrls = { 
            director: `${vdoDomain}/mixer.html?${params.toString()}`, 
            guest: `${vdoDomain}/?room=${roomName}` 
        };
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
            <button class="btn-secondary" onclick="window.open('${this.generatedUrls.guest}', '_blank')" title="Abrir enlace de invitado"><i class="fa-solid fa-video"></i> Link Invitado</button>
            <button class="btn-secondary" id="mixer-action-copy" title="Copiar enlace de invitado"><i class="fa-solid fa-copy"></i> Copiar Link</button>
            <a href="${whatsappLink}" target="_blank" class="btn-secondary whatsapp-btn" title="Compartir por WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
        `;
        container.querySelector('#mixer-action-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(this.generatedUrls.guest).then(() => alert('¡Enlace de invitado copiado!'));
        });
        document.getElementById('mixer-popout-btn').onclick = () => window.open(this.generatedUrls.director, '_blank');
        document.getElementById('mixer-close-btn').onclick = () => this.closeMixer();
    },

    getTitleForAction(action) {
        const titles = {
            podcast: 'Podcast de Audio',
            presentation: 'Presentación con Diapositivas',
            interview: 'Entrevista en Video',
            live: 'Transmisión en Vivo'
        };
        return titles[action] || 'Creación Personalizada';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());