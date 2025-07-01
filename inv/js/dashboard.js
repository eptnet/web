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
                if (navLink.dataset.section) {
                    e.preventDefault();
                    this.showSection(navLink.dataset.section);
                }
                else if (navLink.id === 'logout-btn') {
                    e.preventDefault();
                    App.supabase.auth.signOut().then(() => window.location.href = '/');
                }
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
            this.initializeSectionLogic(sectionId); // Lógica de inicialización
        }
    },

    // --- FUNCIÓN MODIFICADA ---
    // Ahora, al entrar al estudio, se cargan las sesiones desde Supabase.
    initializeSectionLogic(sectionId) {
        if (sectionId === 'home-section') {
            Projects.init();
        } else if (sectionId === 'studio-section') {
            Studio.fetchSessions(); // ¡NUEVO! Carga las sesiones guardadas.
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

// Reemplaza el objeto Studio completo por este
const Studio = {
    // --- NUEVO: Objeto para manejar los temporizadores ---
    timers: { dashboardCountdown: null },

    async fetchSessions() {
        // (Sin cambios aquí)
        const container = document.getElementById('sessions-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando tus salas...</p>`;

        const { data: sessions, error } = await App.supabase
            .from('sessions')
            .select('*')
            .eq('user_id', App.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error cargando las sesiones:', error);
            container.innerHTML = `<p>Error al cargar tus salas. Inténtalo de nuevo.</p>`;
            return;
        }

        this.renderSessions(sessions);
    },

    renderSessions(sessions) {
        // (Sin cambios aquí)
        const container = document.getElementById('sessions-container');
        if (!container) return;

        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<div class="studio-launcher"><h3>Aún no has configurado ninguna sala</h3><p>Ve a la sección "Inicio" para crear tu primera sesión de grabación o transmisión.</p></div>`;
            return;
        }

        container.innerHTML = sessions.map(session => {
            const whatsappMessage = encodeURIComponent(`Hola, te invito a unirte a mi sala de grabación para el proyecto "${session.project_title}".\n\nPor favor, usa una conexión estable y audífonos si es posible.\n\nEnlace: ${session.guest_url}`);
            const whatsappLink = `https://api.whatsapp.com/send?text=${whatsappMessage}`;
            const sessionData = encodeURIComponent(JSON.stringify(session));

            return `
            <div class="session-card" id="${session.id}">
                <div>
                    <div class="session-card__meta">${this.getTitleForAction(session.session_type)}</div>
                    <h4>${session.session_title}</h4>
                    <small>Proyecto: ${session.project_title}</small>
                </div>
                <div class="session-card__actions">
                    <button class="btn-primary" onclick="Studio.openMixer('${sessionData}')"><i class="fa-solid fa-arrow-right-to-bracket"></i> Ir a la Sala</button>
                    <button class="btn-secondary" onclick="navigator.clipboard.writeText('${session.guest_url}').then(() => alert('¡Enlace de invitado copiado!'))"><i class="fa-solid fa-copy"></i> Copiar Link</button>
                    <a href="${whatsappLink}" target="_blank" class="btn-secondary"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>
                    <button class="btn-secondary" style="margin-left: auto; --color-accent: #e02424;" onclick="Studio.deleteSession('${session.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    },
    
    async deleteSession(sessionId) {
        // (Sin cambios aquí)
        const confirmed = confirm("¿Estás seguro de que quieres borrar esta sala? Esta acción es irreversible y el enlace dejará de funcionar.");
        if (!confirmed) return;

        const { error } = await App.supabase.from('sessions').delete().eq('id', sessionId);
        
        if (error) {
            console.error('Error al borrar la sesión:', error);
            alert("Hubo un error al borrar la sesión.");
        } else {
            alert("Sala borrada con éxito.");
            this.fetchSessions();
        }
    },

    openModal(actionType) {
        // (Sin cambios aquí)
        if (!App.userProfile?.orcid) {
            alert("Es necesario que completes tu ORCID en tu página de perfil para poder crear una sala.");
            return;
        }
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
                    <header class="modal-header"><h2>Configurar: ${this.getTitleForAction(actionType)}</h2><button class="modal-close-btn">&times;</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${selectedProject}</strong></p>
                            <div class="form-group"><label for="session-title">Título del Evento o Sesión</label><input id="session-title" name="sessionTitle" type="text" required></div>
                            <div class="form-group"><label for="session-mode">Modo de la Sala</label><select id="session-mode" name="sessionMode" class="project-dropdown"><option value="control">Solo entrar a la sala de control</option><option value="record">Grabar la sesión</option><option value="live">Grabar y Transmitir en Vivo (Prueba)</option></select></div>
                            <div class="form-group"><label for="guest-count">Número Máximo de Invitados</label><select id="guest-count" name="guestCount" class="project-dropdown">${Array.from({length: 9}, (_, i) => `<option value="${i + 1}">${i + 1} invitado(s)</option>`).join('')}</select></div>
                            <div class="form-group"><label style="display: flex; align-items: center; gap: 0.5rem;"><input name="askName" type="checkbox" style="width: auto;"> Solicitar nombre a los invitados al entrar</label></div>
                            <div class="form-group"><label style="display: flex; align-items: center; gap: 0.5rem;"><input name="hideNames" type="checkbox" style="width: auto;"> Ocultar nombres de los participantes en la sala</label></div>
                            <button type="submit" class="btn-primary" style="width:100%; margin-top: 1rem;">Guardar Sesión en el Estudio</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        modalContainer.querySelector('#studio-form').addEventListener('submit', (e) => this.handleGenerateRoom(e, actionType));
    },

    closeModal() { document.getElementById('modal-overlay-container').innerHTML = ''; },

    async handleGenerateRoom(e, actionType) {
        // (Sin cambios aquí)
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);

        const stableId = self.crypto.randomUUID().slice(0, 8);
        const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${stableId}`;
        const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
        const projectTitle = document.getElementById('project-selector-dropdown').value;
        const sessionTitle = formData.get('sessionTitle');
        const vdoDomain = 'https://vdo.epistecnologia.com';
        
        let directorParams = new URLSearchParams();
        directorParams.set('room', roomName);
        directorParams.set('director', directorKey);
        let guestParams = new URLSearchParams();
        guestParams.set('room', roomName);

        if (formData.get('askName') === 'on') {
            guestParams.set('label', '');
            directorParams.set('showlabels', '1');
        }

        if (sessionTitle) directorParams.set('sl2', encodeURIComponent(sessionTitle));
        if (projectTitle) directorParams.set('sl1', encodeURIComponent(`Proyecto: ${projectTitle}`));
        
        const sessionMode = formData.get('sessionMode');
        const guestCount = parseInt(formData.get('guestCount'), 10);
        if (sessionMode === 'record') directorParams.set('record', 'auto');
        if (sessionMode === 'live') {
            directorParams.set('record', 'auto');
            directorParams.set('meshcast', '1');
            directorParams.set('sl3', '🔴 PRUEBA EN VIVO');
        }
        if (guestCount) directorParams.set('totalviews', guestCount);
        if (formData.get('hideNames') === 'on') directorParams.set('hidenames', '1');
        if (guestCount > 4) directorParams.set('meshcast', '1');

        const directorUrl = `${vdoDomain}/mixer.html?${directorParams.toString()}`;
        const guestUrl = `${vdoDomain}/?${guestParams.toString()}`;
        
        const newSession = {
            user_id: App.userId,
            project_title: projectTitle,
            session_title: sessionTitle || 'Sesión sin título',
            session_type: actionType,
            director_url: directorUrl,
            guest_url: guestUrl,
            status: 'CREADO'
        };

        const { error } = await App.supabase.from('sessions').insert(newSession);
        if (error) {
            console.error('Error guardando la sesión:', error);
            alert("No se pudo guardar la sesión. Revisa la consola para más detalles.");
        } else {
            alert("¡Sala guardada con éxito en tu Estudio!");
            this.closeModal();
            Navigation.showSection('studio-section');
        }
    },

    // --- FUNCIÓN MODIFICADA ---
    openMixer(sessionData) {
        const session = JSON.parse(decodeURIComponent(sessionData));
        const { director_url: directorUrl, guest_url: guestUrl } = session;
        
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.style.display = 'flex';
        mixerContainer.querySelector('#mixer-iframe').src = directorUrl;
        
        const actionsContainer = document.getElementById('mixer-room-actions');
        actionsContainer.innerHTML = `
            <button class="btn-secondary" onclick="window.open('${guestUrl}', '_blank')"><i class="fa-solid fa-video"></i> Ingresar como Invitado</button>
            <button class="btn-secondary" onclick="navigator.clipboard.writeText('${guestUrl}').then(() => alert('¡Enlace de invitado copiado!'))"><i class="fa-solid fa-copy"></i> Copiar Link</button>
            <div class="live-dropdown">
                <button class="btn-secondary"><i class="fa-solid fa-tower-broadcast"></i> Transmitir</button>
                <div class="live-dropdown-content">
                    <a href="#" onclick="event.preventDefault(); Studio.scheduleLive('${session.id}', 3)">En 3 minutos</a>
                    <a href="#" onclick="event.preventDefault(); Studio.scheduleLive('${session.id}', 5)">En 5 minutos</a>
                    <a href="#" onclick="event.preventDefault(); Studio.scheduleLive('${session.id}', 15)">En 15 minutos</a>
                    <a href="#" onclick="event.preventDefault(); Studio.scheduleLive('${session.id}', 30)">En 30 minutos</a>
                </div>
            </div>
            <div id="mixer-countdown-display" class="mixer-countdown"></div>
        `;
        
        document.getElementById('mixer-popout-btn').onclick = () => window.open(directorUrl, '_blank');
        document.getElementById('mixer-close-btn').onclick = () => this.closeMixer();
    },

    // --- FUNCIÓN MODIFICADA ---
    async scheduleLive(sessionId, minutes) {
        if (!sessionId) return;
        
        const now = new Date();
        const scheduledTime = new Date(now.getTime() + minutes * 60000);

        const { error } = await App.supabase.from('sessions').update({ status: 'PROGRAMADO', scheduled_at: scheduledTime.toISOString() }).eq('id', sessionId);
        
        if (error) {
            console.error('Error al programar la transmisión:', error);
            alert('Hubo un error al programar la transmisión.');
        } else {
            alert(`¡Éxito! La transmisión ha sido programada para empezar en ${minutes} minutos.`);
            
            // Iniciar el temporizador en el dashboard
            const countdownDisplay = document.getElementById('mixer-countdown-display');
            if(this.timers.dashboardCountdown) clearInterval(this.timers.dashboardCountdown);

            this.timers.dashboardCountdown = setInterval(() => {
                const now = new Date().getTime();
                const distance = scheduledTime.getTime() - now;
                if (distance < 0) {
                    clearInterval(this.timers.dashboardCountdown);
                    countdownDisplay.innerHTML = `🔴 EN VIVO`;
                    return;
                }
                const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((distance % (1000 * 60)) / 1000);
                countdownDisplay.innerHTML = `En vivo en: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }, 1000);
        }
    },

    // --- FUNCIÓN MODIFICADA ---
    closeMixer() {
        if (this.timers.dashboardCountdown) clearInterval(this.timers.dashboardCountdown);
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.querySelector('#mixer-iframe').src = 'about:blank';
        mixerContainer.style.display = 'none';
    },

    getTitleForAction(action) {
        const titles = { podcast: 'Podcast de Audio', presentation: 'Presentación', interview: 'Entrevista', live: 'Transmisión en Vivo' };
        return titles[action] || 'Creación Personalizada';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());