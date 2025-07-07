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
        if (!session) { window.location.href = '/'; return; }
        this.userId = session.user.id;
        
        const { data: profileData, error } = await this.supabase.from('profiles').select('*').eq('id', this.userId).single();
        if (error && error.code !== 'PGRST116') { alert("Hubo un error al cargar tu perfil."); return; }
        
        this.userProfile = { ...session.user.user_metadata, ...profileData };
        
        const hasOrcid = this.userProfile.orcid;
        const hasProjects = this.userProfile.projects && this.userProfile.projects.length > 0;
        if (!hasOrcid || !hasProjects) {
            alert("Perfil incompleto. Debes registrar tu ORCID y al menos un proyecto para continuar.");
            window.location.href = '/inv/profile.html';
            return;
        }
        
        Header.init(this.userProfile);
        Navigation.init();

        const contentNavLink = document.querySelector('.nav-link[data-section="content-section"]');
        if (contentNavLink && this.userProfile.role === 'admin') {
            contentNavLink.style.display = 'flex';
        }
    },
};

const Header = {
    init(user) {
        document.getElementById('user-name-header').textContent = `Dashboard de ${user.full_name || user.email}`;
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
                } else if (navLink.id === 'logout-btn') {
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
        document.querySelectorAll('.content-section, .nav-link').forEach(el => el.classList.remove('active'));
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

    // En el objeto Navigation, reemplaza esta función completa
    initializeSectionLogic(sectionId) {
        if (sectionId === 'home-section') {
            Projects.init();
        } else if (sectionId === 'studio-section') {
            Studio.init(); // Usamos Studio.init() para empezar
        } else if (sectionId === 'content-section') {
            if (App.userProfile.role === 'admin') {
                ContentManager.init();
            } else {
                document.getElementById('content-section').innerHTML = '<h2>Acceso Denegado</h2><p>Esta sección solo está disponible para administradores.</p>';
            }
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

    // STUDIO
    const Studio = {
        init() {
        // init se encarga de llamar a las funciones para cargar las sesiones
        this.fetchSessions();
        this.fetchAllPublicSessions();

        // Y también configura las pestañas internas de esta sección
        const tabLinks = document.querySelectorAll('.studio-tab-link');
        const tabContents = document.querySelectorAll('.studio-tab-content');
        tabLinks.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                tabLinks.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            });
        });
    },


        timers: { dashboardCountdown: null },

        async fetchSessions() {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando tus salas...</p>`;

        // --- LÍNEAS DE DEPURACIÓN ---
        console.log("Buscando sesiones para el User ID:", App.userId);
        // -----------------------------

        const { data: sessions, error } = await App.supabase
            .from('sessions')
            .select('*')
            .eq('is_archived', false) // <-- AÑADE ESTA LÍNEA
            .eq('user_id', App.userId)
            .order('created_at', { ascending: false });

        // --- LÍNEAS DE DEPURACIÓN ---
        console.log("Supabase devolvió estas sesiones:", sessions);
        // -----------------------------

        if (error) { 
            console.error('Error cargando las sesiones:', error); 
            container.innerHTML = `<p>Error al cargar tus salas.</p>`; 
            return; 
        }
        this.renderSessions(sessions);
    },

    

    // En /dashboard/js, dentro del objeto Studio

    // En /dashboard/js, dentro del objeto Studio

    renderSessions(sessions) {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<div class="studio-launcher"><h3>No has configurado ninguna sala</h3><p>Ve a la sección "Inicio" para crear tu primera sesión.</p></div>`;
            return;
        }

        const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };

        container.innerHTML = sessions.map(session => {
            const sessionData = encodeURIComponent(JSON.stringify(session));
            
            // Formateo de fechas y horas
            const startTime = new Date(session.scheduled_at);
            const endTime = session.end_at ? new Date(session.end_at) : null;
            const formattedDate = startTime.toLocaleDateString('es-ES', dateOptions);
            const formattedStartTime = startTime.toLocaleTimeString('es-ES', timeOptions);
            const formattedEndTime = endTime ? endTime.toLocaleTimeString('es-ES', timeOptions) : '';

            // Lógica para el botón de acción principal (Iniciar/Terminar)
            let actionButtonHTML = '';
            if (session.status === 'EN VIVO') {
                actionButtonHTML = `<button class="btn-primary is-live" onclick="Studio.endLiveStream('${session.id}')"><i class="fa-solid fa-stop-circle"></i> Terminar Directo</button>`;
            } else if (session.status === 'PROGRAMADO') {
                const isExternal = session.platform === 'youtube' || session.platform === 'substack';
                const canGoLive = !isExternal || (isExternal && session.platform_id);
                if (canGoLive) {
                    actionButtonHTML = `<button class="btn-primary" onclick="Studio.goLive('${session.id}', 0)"><i class="fa-solid fa-tower-broadcast"></i> Iniciar Directo</button>`;
                } else {
                    actionButtonHTML = `<button class="btn-primary" disabled title="Añade el ID de la plataforma para activar">Iniciar Directo</button>`;
                }
            }

            // Lógica para el campo de añadir ID
            let platformIdField = '';
            if ((session.platform === 'youtube' || session.platform === 'substack') && !session.platform_id) {
                platformIdField = `
                    <div class="platform-id-adder">
                        <label>Añade el ID de ${session.platform === 'youtube' ? 'YouTube' : 'Substack'}:</label>
                        <div class="platform-id-input-group">
                            <input type="text" id="id-input-${session.id}" placeholder="Pega el ID aquí...">
                            <button class="btn-secondary" onclick="Studio.savePlatformId('${session.id}')">Guardar</button>
                        </div>
                    </div>`;
            }

            // Construcción del HTML completo de la tarjeta
            return `
            <div class="session-card" id="${session.id}">
                <div class="session-card__header">
                    <span class="session-card__meta">${session.platform === 'youtube' ? 'YouTube Live' : session.platform === 'substack' ? 'Substack Live' : 'EPT Live'}</span>
                    <h4>${session.session_title}</h4>
                    <p class="session-card__project">Proyecto: ${session.project_title}</p>
                </div>
                
                <div class="session-card__schedule">
                    <p><i class="fa-solid fa-calendar-day"></i> <strong>Fecha:</strong> ${formattedDate}</p>
                    <p><i class="fa-solid fa-clock"></i> <strong>Horario:</strong> ${formattedStartTime} ${endTime ? '- ' + formattedEndTime : ''}</p>
                </div>

                ${platformIdField}

                <div class="session-card__actions">
                    ${actionButtonHTML}
                    <button class="btn-secondary" onclick="Studio.openSession('${sessionData}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Sala</button>
                    <button class="btn-secondary" onclick="Studio.openModal('${sessionData}')"><i class="fa-solid fa-pencil"></i> Editar</button>
                    <button class="btn-secondary" style="margin-left: auto;" onclick="Studio.deleteSession('${session.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    },

    // En /dashboard/js/dashboard.js, reemplaza esta función completa

    async fetchAllPublicSessions() {
        const container = document.getElementById('global-schedule-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando agenda global...</p>`;

        // --- PASO 1: OBTENER TODAS LAS SESIONES PÚBLICAS ---
        const { data: sessions, error } = await App.supabase
            .from('sessions')
            .select('*, profiles(display_name)')
            .eq('is_archived', false) // <-- AÑADE ESTA LÍNEA
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            .order('scheduled_at', { ascending: true });
            
        if (sessionsError) {
            console.error('Error cargando la agenda global (sesiones):', sessionsError);
            container.innerHTML = `<p>Error al cargar la agenda.</p>`;
            return;
        }

        if (!sessions || sessions.length === 0) {
            this.renderAllSessions([]); // Llama a render con un array vacío
            return;
        }

        // --- PASO 2: OBTENER LOS PERFILES PARA ESAS SESIONES ---
        const userIds = [...new Set(sessions.map(s => s.user_id).filter(id => id))];
        let profilesMap = new Map();

        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await App.supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', userIds);

            if (profilesError) {
                console.error("Error buscando perfiles para la agenda global:", profilesError);
            } else {
                profiles.forEach(p => profilesMap.set(p.id, p));
            }
        }

        // --- PASO 3: UNIR LOS DATOS MANUALMENTE ---
        const fullSessionData = sessions.map(session => ({
            ...session,
            // Usamos nuestro mapa para adjuntar el perfil
            profiles: profilesMap.get(session.user_id) 
        }));

        // --- PASO 4: RENDERIZAR ---
        this.renderAllSessions(fullSessionData);
    },

    // Nueva función para mostrar la agenda global
    renderAllSessions(sessions) {
        const container = document.getElementById('global-schedule-container');
        if (!container) return;
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<p>No hay eventos programados en la plataforma.</p>`;
            return;
        }

        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };

        container.innerHTML = sessions.map(session => {
            const startTime = new Date(session.scheduled_at);
            const endTime = session.end_at ? new Date(session.end_at) : null;
            const day = startTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            
            const formattedStartTime = startTime.toLocaleTimeString('es-ES', timeOptions);
            // Formateamos la hora de fin si existe
            const formattedEndTime = endTime ? endTime.toLocaleTimeString('es-ES', timeOptions) : 'N/A';

            const organizer = session.profiles?.display_name || 'Investigador';
            const platformIcon = session.platform === 'youtube' ? 'fab fa-youtube' : (session.platform === 'substack' ? 'fas fa-bookmark' : 'fas fa-satellite-dish');

            return `
                <div class="global-event-card ${session.status === 'EN VIVO' ? 'is-live' : ''}">
                    <h5>${session.session_title}</h5>
                    <p><i class="fa-solid fa-calendar-day"></i> ${day}</p>
                    <p><i class="fa-solid fa-clock"></i> ${formattedStartTime} - ${formattedEndTime}</p>
                    <p><i class="fa-solid fa-user"></i> Organiza: <strong>${organizer}</strong></p>
                    <p><i class="${platformIcon}"></i> Plataforma: ${session.platform}</p>
                </div>
            `;
        }).join('');
    },
    
    async deleteSession(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres borrar esta sesión? Esta acción es irreversible.");
        if (!confirmed) return;
        const { error } = await App.supabase.from('sessions').delete().eq('id', sessionId);
        if (error) { console.error('Error al borrar la sesión:', error); alert("Hubo un error al borrar la sesión."); } 
        else { alert("Sala borrada con éxito."); this.fetchSessions(); }
    },

    // En /dashboard/js, dentro del objeto Studio
    openModal(sessionDataOrActionType) {
        const isEditing = typeof sessionDataOrActionType === 'string' && sessionDataOrActionType.startsWith('{');
        const session = isEditing ? JSON.parse(decodeURIComponent(sessionDataOrActionType)) : null;

        const projectDropdown = document.getElementById('project-selector-dropdown');
        const selectedProject = projectDropdown ? projectDropdown.value : '';
        if (!isEditing && !selectedProject) {
            alert("Por favor, selecciona primero un proyecto en el Paso 1.");
            return;
        }

        const toLocalISOString = (date) => {
            if (!date) return '';
            const d = new Date(date);
            const tzoffset = d.getTimezoneOffset() * 60000;
            return (new Date(d - tzoffset)).toISOString().slice(0, 16);
        };
        
        const modalContainer = document.getElementById('modal-overlay-container');
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header"><h2>${isEditing ? 'Editar' : 'Configurar'} Sesión</h2><button class="modal-close-btn">&times;</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${session ? session.project_title : selectedProject}</strong></p>
                            
                            <div class="form-group">
                                <label>Plataforma de Transmisión</label>
                                <div class="platform-selector">
                                    <div class="platform-option" data-platform="vdo_ninja"><i class="fas fa-satellite-dish"></i><span>EPT Live</span></div>
                                    <div class="platform-option" data-platform="youtube"><i class="fab fa-youtube"></i><span>YouTube</span></div>
                                    <div class="platform-option" data-platform="substack"><i class="fas fa-bookmark"></i><span>Substack</span></div>
                                </div>
                                <input type="hidden" id="session-platform" name="platform" value="${session?.platform || 'vdo_ninja'}">
                            </div>

                            <div class="form-group"><label for="session-title">Título del Evento</label><input id="session-title" name="sessionTitle" type="text" value="${session?.session_title || ''}" required></div>
                            <div class="form-group"><label for="session-start">Fecha y Hora de Inicio</label><input id="session-start" name="scheduledAt" type="datetime-local" class="project-dropdown" value="${toLocalISOString(session?.scheduled_at)}" required></div>
                            
                            <div class="form-group"><label for="session-end">Fecha y Hora de Fin</label><input id="session-end" name="endAt" type="datetime-local" class="project-dropdown" value="${toLocalISOString(session?.end_at)}"></div>
                            
                            <div class="form-group"><label for="session-description">Descripción Corta</label><textarea id="session-description" name="description" rows="3" maxlength="500">${session?.description || ''}</textarea></div>
                            <div class="form-group"><label for="session-thumbnail">URL de la Miniatura</label><input id="session-thumbnail" name="thumbnail_url" type="url" value="${session?.thumbnail_url || ''}" placeholder="https://ejemplo.com/imagen.jpg"></div>
                            <div class="form-group"><label for="session-more-info">URL para "Saber Más"</label><input id="session-more-info" name="more_info_url" type="url" value="${session?.more_info_url || ''}"></div>

                            <div id="platform-specific-fields"></div>
                            <button type="submit" class="btn-primary" style="width:100%; margin-top: 1rem;">${isEditing ? 'Actualizar' : 'Agendar'} Sesión</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
        // ... (El resto de la lógica de la función se mantiene igual)
        const form = modalContainer.querySelector('#studio-form');
        const platformOptions = modalContainer.querySelectorAll('.platform-option');
        const platformInput = modalContainer.querySelector('#session-platform');
        const platformSpecificFields = modalContainer.querySelector('#platform-specific-fields');

        const updatePlatformSelection = (platform) => {
            platformOptions.forEach(opt => opt.classList.toggle('selected', opt.dataset.platform === platform));
            platformInput.value = platform;
            let fieldHTML = '';
            if (platform === 'youtube') {
                fieldHTML = `<div class="form-group"><label for="youtube-id">ID del Video de YouTube</label><input id="youtube-id" name="youtubeId" type="text" value="${session?.platform_id || ''}" placeholder="Opcional al agendar"></div>`;
            } else if (platform === 'substack') {
                fieldHTML = `<div class="form-group"><label for="substack-id">ID del Directo de Substack</label><input id="substack-id" name="substackId" type="text" value="${session?.platform_id || ''}" placeholder="Opcional al agendar"></div>`;
            }
            platformSpecificFields.innerHTML = fieldHTML;
        };
        platformOptions.forEach(opt => opt.addEventListener('click', () => {
            if (!isEditing) updatePlatformSelection(opt.dataset.platform);
        }));
        updatePlatformSelection(platformInput.value);
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        form.addEventListener('submit', (e) => this.handleSaveSession(e, session ? session.id : null));
    },

    closeModal() { document.getElementById('modal-overlay-container').innerHTML = ''; },

    // EN dashboard.js, dentro del objeto Studio

    // En /dashboard/js/dashboard.js, reemplaza esta función completa
    async handleSaveSession(e, sessionId = null) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const platform = formData.get('platform');
        const scheduledAt = formData.get('scheduledAt');
        const endAt = formData.get('endAt');

        let sessionData = {
            project_title: document.getElementById('project-selector-dropdown')?.value || (await App.supabase.from('sessions').select('project_title').eq('id', sessionId).single()).data.project_title,
            session_title: formData.get('sessionTitle'),
            platform: platform,
            status: 'PROGRAMADO',
            scheduled_at: new Date(scheduledAt).toISOString(),
            end_at: endAt ? new Date(endAt).toISOString() : null,
            description: formData.get('description'),
            thumbnail_url: formData.get('thumbnail_url'),
            more_info_url: formData.get('more_info_url')
        };
        
        if (!sessionId) {
            sessionData.user_id = App.userId;
        }
        
        // --- LÓGICA DEL NUEVO FLUJO ---

        // 1. Asignamos el platform_id si existe, pero ya no es obligatorio
        if (platform === 'youtube') {
            sessionData.platform_id = formData.get('youtubeId') || null;
        } else if (platform === 'substack') {
            sessionData.platform_id = formData.get('substackId') || null;
        } else {
            sessionData.platform_id = null;
        }

        // 2. SIEMPRE generamos una sala de VDO.Ninja al crear una nueva sesión.
        //    Esto servirá como la "Sala de Control" universal.
        if (!sessionId) {
            const stableId = self.crypto.randomUUID().slice(0, 8);
            const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${stableId}`.replace(/[^a-zA-Z0-9-]/g, '');
            const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
            const vdoDomain = 'https://vdo.epistecnologia.com';
            
            let directorParams = new URLSearchParams({ room: roomName, director: directorKey, record: 'auto' });
            let guestParams = new URLSearchParams({ room: roomName });
            let viewerParams = new URLSearchParams({ scene: '0', room: roomName, showlabels: '', cleanoutput: '', layout: '', remote: '' });
            
            if (formData.get('guestCount') > 4) {
                directorParams.set('meshcast', '1');
                guestParams.set('meshcast', '1');
                viewerParams.set('meshcast', '1');
            }
            
            sessionData.director_url = `${vdoDomain}/mixer.html?${directorParams.toString()}`;
            sessionData.guest_url = `${vdoDomain}/?${guestParams.toString()}`;
            sessionData.viewer_url = `${vdoDomain}/?${viewerParams.toString()}&whepshare=https://cae1.meshcast.io/whep/EPTLive`;
        }

        const { error } = sessionId
            ? await App.supabase.from('sessions').update(sessionData).eq('id', sessionId)
            : await App.supabase.from('sessions').insert(sessionData);

        if (error) {
            console.error('Error guardando la sesión:', error);
            alert("No se pudo guardar la sesión.");
        } else {
            alert(`¡Sesión ${sessionId ? 'actualizada' : 'agendada'} con éxito!`);
            this.closeModal();
            this.fetchSessions();
        }
    },

    // En /dashboard/js, dentro del objeto Studio
    async savePlatformId(sessionId) {
        const inputEl = document.getElementById(`id-input-${sessionId}`);
        if (!inputEl) return;
        
        const platformId = inputEl.value.trim();
        if (!platformId) {
            alert("Por favor, introduce un ID válido.");
            return;
        }

        const { error } = await App.supabase
            .from('sessions')
            .update({ platform_id: platformId })
            .eq('id', sessionId);

        if (error) {
            alert("Hubo un error al guardar el ID.");
            console.error("Error en savePlatformId:", error);
        } else {
            alert("¡ID guardado con éxito!");
            this.fetchSessions(); // Refrescamos la lista de sesiones para ver los cambios
        }
    },
    
    async startNow(sessionId) {
        if (!sessionId) return;
        const confirmed = confirm("¿Estás seguro de que quieres iniciar este evento ahora? La página 'En Vivo' lo mostrará inmediatamente.");
        if (!confirmed) return;
        
        const { error } = await App.supabase.from('sessions').update({ scheduled_at: new Date().toISOString() }).eq('id', sessionId);
        if (error) { alert('Error al iniciar el evento.'); }
        else { alert('¡Evento iniciado! Ya debería estar visible en la página pública.'); this.fetchSessions(); }
    },

    // EN dashboard.js, dentro del objeto Studio

    // En /dashboard/js, dentro del objeto Studio
    openSession(sessionData) {
        const session = JSON.parse(decodeURIComponent(sessionData));
        
        // Abre la nueva página de sala de control en una nueva pestaña, pasando el ID en la URL.
        window.open(`/inv/sala-de-control.html?id=${session.id}`, '_blank');
    },

    // ELIMINA la función 'scheduleLive' y reemplázala por esta
    async goLive(sessionId, minutes) {
        if (!sessionId) return;

        // Calculamos la hora de inicio y la ponemos en el formato correcto
        const scheduledTime = new Date(new Date().getTime() + minutes * 60000);
        const scheduled_at_iso = scheduledTime.toISOString();
        
        // Actualizamos la sesión para marcarla como 'EN VIVO' y con la nueva hora de inicio
        const { error } = await App.supabase.from('sessions')
            .update({ status: 'EN VIVO', scheduled_at: scheduled_at_iso })
            .eq('id', sessionId);

        if (error) {
            alert('Hubo un error al iniciar la transmisión.');
            console.error("Error en goLive:", error);
        } else {
            alert(`¡Transmisión iniciada! La cuenta regresiva comenzará en la página pública.`);
            // Volvemos a abrir la sesión para refrescar los botones y mostrar "Terminar"
            const { data: session } = await App.supabase.from('sessions').select('*').eq('id', sessionId).single();
            this.openSession(encodeURIComponent(JSON.stringify(session)));
        }
    },

    // En /dashboard/js/dashboard.js
    async endLiveStream(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres terminar la transmisión pública? La sala de control permanecerá activa.");
        if (!confirmed) return;

        // Ya no hacemos cuenta regresiva ni rompemos las URLs.
        // Simplemente actualizamos el estado.
        const { error } = await App.supabase
            .from('sessions')
            .update({ 
                status: 'FINALIZADO', 
                end_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        
        if (error) {
            alert("Hubo un error al finalizar la transmisión.");
            console.error("Error en endLiveStream:", error);
        } else { 
            alert("La transmisión pública ha finalizado.");
            // Ya no cerramos el mezclador, solo refrescamos las sesiones para que se actualice el estado
            this.fetchSessions(); 
        }
    },

    closeMixer() {
        // Detenemos el contador del dashboard si está activo.
        if (this.timers.dashboardCountdown) {
            clearInterval(this.timers.dashboardCountdown);
            this.timers.dashboardCountdown = null;
        }
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.querySelector('#mixer-iframe').src = 'about:blank';
        mixerContainer.style.display = 'none';
    },

    // En /dashboard.js, dentro del objeto Studio

    startDashboardCountdown(session, nextSession) {
        const countdownDisplay = document.getElementById('mixer-countdown-display');
        if (!countdownDisplay) return;

        // Reseteamos las advertencias para esta sesión
        this.warnings = { overtime: false, conflict_6m: false };

        if (this.timers.dashboardCountdown) clearInterval(this.timers.dashboardCountdown);

        const startTime = new Date(session.scheduled_at);
        const endTime = session.end_at ? new Date(session.end_at) : null;
        const nextStartTime = nextSession ? new Date(nextSession.scheduled_at) : null;

        this.timers.dashboardCountdown = setInterval(async () => {
            const now = new Date();
            let message = '';
            countdownDisplay.className = 'mixer-countdown';

            if (session.status === 'EN VIVO') {
                if (!endTime) { message = 'Sin hora de fin programada.'; } 
                else {
                    const distance = endTime - now;
                    let conflictOccurred = false; // Bandera para evitar mostrar dos mensajes a la vez

                    // --- LÓGICA DE CONFLICTO MEJORADA ---
                    if (nextStartTime && now < nextStartTime) {
                        const timeToNext = nextStartTime - now;
                        const forceCloseThreshold = 3 * 60 * 1000; // 3 minutos para el cierre
                        const warningThreshold = 6 * 60 * 1000;   // 6 minutos para la advertencia

                        if (timeToNext <= forceCloseThreshold) {
                            // Cierre forzado e inmediato
                            await this.endLiveStream(session.id); // Usamos await para esperar la finalización
                            alert("La sesión ha finalizado automáticamente para dar paso al siguiente evento.");
                            clearInterval(this.timers.dashboardCountdown);
                            return;
                        }
                        
                        if (timeToNext <= warningThreshold) {
                            conflictOccurred = true; // Marcamos que hay un conflicto activo
                            if (!this.warnings.conflict_6m) {
                                this.playWarningSound();
                                this.warnings.conflict_6m = true;
                            }
                            
                            // --- NUEVO CONTADOR DE CIERRE FORZOSO ---
                            const timeUntilShutdown = timeToNext - forceCloseThreshold;
                            const minutes = Math.floor(timeUntilShutdown / 60000);
                            const seconds = Math.floor((timeUntilShutdown % 60000) / 1000);
                            message = `¡LA SESIÓN SE CERRARA EN ${minutes}:${String(seconds).padStart(2, '0')}!`;
                            countdownDisplay.classList.add('is-danger', 'is-blinking');
                        }
                    }

                    // Si no hay un conflicto activo, mostramos el estado normal
                    if (!conflictOccurred) {
                        if (distance < 0) {
                            if (!this.warnings.overtime) {
                                this.playWarningSound();
                                this.warnings.overtime = true;
                            }
                            const overTime = now - endTime;
                            const minutes = Math.floor((overTime % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((overTime % (1000 * 60)) / 1000);
                            message = `Tiempo excedido: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                            countdownDisplay.classList.add('is-danger');
                        } else {
                            const hours = Math.floor(distance / (1000 * 60 * 60));
                            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                            message = `Tiempo restante: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                            if (distance < 5 * 60 * 1000) countdownDisplay.classList.add('is-warning');
                        }
                    }
                }
            } else if (session.status === 'PROGRAMADO' && startTime > now) {
                // (La lógica de cuenta regresiva para iniciar se mantiene igual)
                const distance = startTime - now;
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                message = `Inicia en: ${days > 0 ? days + 'd ' : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                countdownDisplay.classList.add('is-info');
            }

            countdownDisplay.textContent = message;
        }, 1000);
    },

    playWarningSound() {
        // Puedes reemplazar esta URL con cualquier sonido de notificación que prefieras.
        const audio = new Audio('https://freesound.org/data/previews/415/415762_6142146-lq.mp3');
        audio.volume = 0.5; // Ajusta el volumen
        audio.play().catch(e => console.error("No se pudo reproducir el sonido:", e));
    },

    getTitleForAction(action) { return action; }
};

// --- OBJETO COMPLETO PARA GESTIONAR CONTENIDO ---
const ContentManager = {
    init() {
        this.addEventListeners();
        this.fetchOnDemandVideos();
        this.fetchShorts();
    },

    addEventListeners() {
        document.getElementById('add-ondemand-form').addEventListener('submit', e => this.handleAddContent(e, 'ondemand'));
        document.getElementById('add-short-form').addEventListener('submit', e => this.handleAddContent(e, 'short'));
        document.getElementById('ondemand-list-container').addEventListener('click', e => this.handleDeleteClick(e, 'ondemand'));
        document.getElementById('shorts-list-container').addEventListener('click', e => this.handleDeleteClick(e, 'short'));
    },

    async handleAddContent(e, type) {
        e.preventDefault();
        const form = e.target;
        const dataToInsert = { youtube_video_id: form.youtube_video_id.value };
        if (type === 'ondemand') dataToInsert.title = form.title.value;
        const tableName = type === 'ondemand' ? 'ondemand_videos' : 'shorts';

        const { error } = await App.supabase.from(tableName).insert(dataToInsert);
        if (error) {
            alert(`Error al añadir el ${type}.`);
        } else {
            form.reset();
            type === 'ondemand' ? this.fetchOnDemandVideos() : this.fetchShorts();
        }
    },

    async handleDeleteClick(e, type) {
        if (!e.target.matches('.delete-btn')) return;
        const id = e.target.dataset.id;
        const tableName = type === 'ondemand' ? 'ondemand_videos' : 'shorts';
        
        if (confirm(`¿Estás seguro de que quieres borrar este ${type}?`)) {
            const { error } = await App.supabase.from(tableName).delete().eq('id', id);
            if (error) alert(`Error al borrar el ${type}.`);
            else type === 'ondemand' ? this.fetchOnDemandVideos() : this.fetchShorts();
        }
    },

    async fetchOnDemandVideos() {
        const { data } = await App.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false });
        this.renderVideoList(data, 'ondemand-list-container');
    },

    async fetchShorts() {
        const { data } = await App.supabase.from('shorts').select('*').order('created_at', { ascending: false });
        this.renderVideoList(data, 'shorts-list-container');
    },

    renderVideoList(videos, containerId) {
        const container = document.getElementById(containerId);
        if (!videos || videos.length === 0) {
            container.innerHTML = '<p>No hay videos añadidos.</p>';
            return;
        }
        container.innerHTML = videos.map(video => `
            <div class="video-list-item">
                <img src="https://i.ytimg.com/vi/${video.youtube_video_id}/mqdefault.jpg" alt="miniatura">
                <span>${video.title || video.youtube_video_id}</span>
                <button class="delete-btn" data-id="${video.id}">&times;</button>
            </div>
        `).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());