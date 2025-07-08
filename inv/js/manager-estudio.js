export const Studio = {
    participants: [], // <-- AÑADE ESTA LÍNEA para guardar los participantes
    init() {
        // Esta función se llama al entrar a la sección "Estudio"
        this.fetchSessions();
        this.fetchAllPublicSessions();
        this.setupTabEvents();
        this.addEventListeners(); // Añadimos el manejador de eventos
    },

    setupTabEvents() {
        // Lógica para que las pestañas "Mis Sesiones" y "Agenda Global" funcionen
        const tabLinks = document.querySelectorAll('.studio-tab-link');
        const tabContents = document.querySelectorAll('.studio-tab-content');
        if (!tabLinks.length) return; // Si ya se inicializó, no volver a añadir listeners

        tabLinks.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                tabLinks.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            });
        });
    },

    addEventListeners() {
        const container = document.getElementById('my-sessions-tab');
        if (!container) return;

        // Este único "vigilante" escucha todos los clics dentro del contenedor de "Mis Sesiones"
        container.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const sessionData = button.dataset.session;
            const sessionId = button.dataset.sessionId;

            // Según la acción del botón, llamamos a la función correcta
            if (action === 'open-session') {
                this.openSession(sessionData);
            } else if (action === 'edit-session') {
                this.openModal(JSON.parse(decodeURIComponent(sessionData)));
            } else if (action === 'delete-session') {
                this.deleteSession(sessionId);
            }
        });
    },

    async fetchSessions() {
        // Busca y muestra solo las sesiones del usuario que ha iniciado sesión
        const container = document.getElementById('sessions-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando tus sesiones...</p>`;

        const { data: sessions, error } = await App.supabase
            .from('sessions')
            .select('*')
            .eq('is_archived', false)
            .eq('user_id', App.userId)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p>Error al cargar las sesiones.</p>`;
        } else {
            this.renderSessions(sessions);
        }
    },

    renderSessions(sessions) {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<p>Aún no has agendado ninguna sesión.</p>`;
            return;
        }

        container.innerHTML = sessions.map(session => {
            const sessionData = encodeURIComponent(JSON.stringify(session));
            const startTime = new Date(session.scheduled_at);
            const endTime = session.end_at ? new Date(session.end_at) : null;
            const formattedDate = startTime.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            const formattedStartTime = startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const formattedEndTime = endTime ? endTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
            
            let platformIdField = '';

             // Lógica para mostrar el campo de añadir ID
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

            return `
            <div class="session-card" id="${session.id}">
                <div class="session-card__header">
                    <span class="session-card__meta">${session.platform === 'youtube' ? 'YouTube' : session.platform === 'substack' ? 'Substack' : 'EPT Live'}</span>
                    <h4>${session.session_title}</h4>
                    <p>${session.project_title}</p>
                </div>

                <div class="session-card__schedule">
                    <p><i class="fas fa-calendar-alt"></i> ${formattedDate}</p>
                    <p><i class="fas fa-clock"></i> ${formattedStartTime} ${endTime ? ' - ' + formattedEndTime : ''}</p>
                </div>

                ${platformIdField}
                <div class="session-card-actions">
                    <button class="btn-primary" data-action="open-session" data-session='${sessionData}'>
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Sala
                    </button>
                    <button class="btn-secondary" data-action="edit-session" data-session='${sessionData}'>
                        <i class="fas fa-pencil-alt"></i> Editar
                    </button>
                    <button class="btn-secondary" data-action="delete-session" data-session-id="${session.id}" style="margin-left: auto;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        }).join('');
    },

    async fetchAllPublicSessions() {
    const container = document.getElementById('global-schedule-container');
    if (!container) return;
    container.innerHTML = `<p>Cargando agenda global...</p>`;

    // --- LÓGICA CORREGIDA CON CONSULTAS SEPARADAS ---
    const { data: sessions, error: sessionsError } = await App.supabase
        .from('sessions')
        .select('*')
        .in('status', ['PROGRAMADO', 'EN VIVO'])
        .eq('is_archived', false)
        .order('scheduled_at', { ascending: true });
        
    if (sessionsError) {
        container.innerHTML = `<p>Error al cargar la agenda.</p>`;
        return;
    }
    if (!sessions || sessions.length === 0) {
        this.renderAllSessions([]);
        return;
    }
    const userIds = [...new Set(sessions.map(s => s.user_id).filter(id => id))];
    let profilesMap = new Map();
    if (userIds.length > 0) {
        const { data: profiles } = await App.supabase.from('profiles').select('id, display_name').in('id', userIds);
        if (profiles) {
            profiles.forEach(p => profilesMap.set(p.id, p));
        }
    }
    const fullSessionData = sessions.map(session => ({ ...session, profiles: profilesMap.get(session.user_id) }));
    this.renderAllSessions(fullSessionData);
},

    renderAllSessions(sessions) {
        // Dibuja las tarjetas de la "Agenda Global"
        const container = document.getElementById('global-schedule-container');
        if (!container) return;
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<p>No hay eventos programados en la plataforma.</p>`;
            return;
        }

        container.innerHTML = sessions.map(session => {
            const startTime = new Date(session.scheduled_at);
            const endTime = session.end_at ? new Date(session.end_at) : null;
            const day = startTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            const formattedStartTime = startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const formattedEndTime = endTime ? endTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
            const organizer = session.profiles?.display_name || 'Investigador';
            const platformIcon = session.platform === 'youtube' ? 'fab fa-youtube' : (session.platform === 'substack' ? 'fas fa-bookmark' : 'fas fa-satellite-dish');

            return `
            <div class="global-event-card ${session.status === 'EN VIVO' ? 'is-live' : ''}">
                <h5>${session.session_title}</h5>
                <p><i class="fa-solid fa-calendar-day"></i> ${day}</p>
                <p><i class="fa-solid fa-clock"></i> ${formattedStartTime} ${endTime ? '- ' + formattedEndTime : ''}</p>
                <p><i class="fa-solid fa-user"></i> Organiza: <strong>${organizer}</strong></p>
                <p><i class="${platformIcon}"></i> Plataforma: ${session.platform}</p>
            </div>`;
        }).join('');
    },

    openModal(actionOrSessionData) {
        const isEditing = typeof actionOrSessionData === 'object' && actionOrSessionData !== null;
        const session = isEditing ? actionOrSessionData : null;
        this.participants = [];

        const projectDropdown = document.getElementById('project-selector-dropdown');
        const selectedProject = projectDropdown ? projectDropdown.value : '';

        if (!isEditing && !selectedProject) {
            alert("Por favor, selecciona primero un proyecto.");
            return;
        }

        const toLocalISOString = (date) => {
            if (!date) return '';
            const d = new Date(date), tzoffset = d.getTimezoneOffset() * 60000;
            return new Date(d - tzoffset).toISOString().slice(0, 16);
        };
        
        const initialPlatform = session?.platform || actionOrSessionData || 'vdo_ninja';
        const modalContainer = document.getElementById('modal-overlay-container');
        
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header"><h2>${isEditing ? 'Editar' : 'Configurar'} Sesión</h2><button class="modal-close-btn">&times;</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${session ? session.project_title : selectedProject}</strong></p>
                            <hr>

                            <div class="form-group">
                                <label>Plataforma</label>
                                <div class="platform-selector">
                                    <div class="platform-option" data-platform="vdo_ninja"><i class="fas fa-satellite-dish"></i><span>EPT Live</span></div>
                                    <div class="platform-option" data-platform="youtube"><i class="fab fa-youtube"></i><span>YouTube</span></div>
                                    <div class="platform-option" data-platform="substack"><i class="fas fa-bookmark"></i><span>Substack</span></div>
                                </div>
                                <input type="hidden" id="session-platform" name="platform" value="${initialPlatform}">
                            </div>

                            <div id="platform-specific-fields"></div>

                            <div class="form-group"><label for="session-title">Título del Evento</label><input id="session-title" name="sessionTitle" type="text" value="${session?.session_title || ''}" required></div>
                            <div class="form-group"><label for="session-start">Fecha y Hora de Inicio</label><input id="session-start" name="scheduledAt" type="datetime-local" value="${toLocalISOString(session?.scheduled_at)}" required></div>
                            <div class="form-group"><label for="session-end">Fecha y Hora de Fin</label><input id="session-end" name="endAt" type="datetime-local" value="${toLocalISOString(session?.end_at)}"></div>
                            <div class="form-group"><label for="session-description">Descripción Corta</label><textarea id="session-description" name="description" rows="3" maxlength="500">${session?.description || ''}</textarea></div>
                            <div class="form-group"><label for="session-thumbnail">URL de Miniatura</label><input id="session-thumbnail" name="thumbnail_url" type="url" value="${session?.thumbnail_url || ''}" placeholder="https://ejemplo.com/imagen.jpg"></div>
                            <div class="form-group"><label for="session-more-info">URL para "Saber Más"</label><input id="session-more-info" name="more_info_url" type="url" value="${session?.more_info_url || ''}"></div>
                            
                            <div class="form-group">
                                <label for="participant-search">Añadir Investigadores Participantes</label>
                                <div class="participant-search-group">
                                    <input type="text" id="participant-search" placeholder="Buscar por nombre o correo...">
                                    <button type="button" id="search-participant-btn" class="btn-secondary">Buscar</button>
                                </div>
                                <div id="participant-search-results"></div>
                                <div id="participant-list">
                                    <strong>Participantes añadidos:</strong>
                                    <ul id="added-participants-ul"></ul>
                                </div>
                            </div>

                            <button type="submit" class="btn-primary" style="width:100%; margin-top: 1rem;">${isEditing ? 'Actualizar' : 'Agendar'} Sesión</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
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

        if (!isEditing) {
            platformOptions.forEach(opt => {
                opt.addEventListener('click', () => updatePlatformSelection(opt.dataset.platform));
            });
        }
        
        updatePlatformSelection(initialPlatform);
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        form.addEventListener('submit', (e) => this.handleSaveSession(e, session));
        document.getElementById('search-participant-btn').addEventListener('click', () => {
            const searchTerm = document.getElementById('participant-search').value;
            this.searchParticipants(searchTerm);
        });
    },

    closeModal() {
        const modalContainer = document.getElementById('modal-overlay-container');
        if(modalContainer) modalContainer.innerHTML = '';
    },

    async handleSaveSession(e, session = null) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const platform = formData.get('platform');
        const projectTitle = document.getElementById('project-selector-dropdown')?.value || session?.project_title || '';
        if (!projectTitle) {
            alert("Error: No se pudo determinar el proyecto asociado.");
            return;
        }

        let sessionData = {
            project_title: projectTitle,
            session_title: formData.get('sessionTitle'),
            platform: platform,
            status: 'PROGRAMADO',
            scheduled_at: new Date(formData.get('scheduledAt')).toISOString(),
            end_at: formData.get('endAt') ? new Date(formData.get('endAt')).toISOString() : null,
            description: formData.get('description'),
            thumbnail_url: formData.get('thumbnail_url'),
            more_info_url: formData.get('more_info_url'),
            platform_id: formData.get('youtubeId') || formData.get('substackId') || null
        };
        
        if (!session) {
            sessionData.user_id = App.userId;
            sessionData.is_archived = false;
            
            // TU LÓGICA DE URLS PERSONALIZADAS (CORRECTA)
            const stableId = self.crypto.randomUUID().slice(0, 8);
            const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${stableId}`;
            const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
            const vdoDomain = 'https://vdo.epistecnologia.com';
            
            let directorParams = new URLSearchParams({ room: roomName, director: directorKey, record: 'auto' });
            let guestParams = new URLSearchParams({ room: roomName });
            let viewerParams = new URLSearchParams({ view: roomName });

            // Añadimos meshcast si es necesario
            if (formData.get('guestCount') > 4) {
                directorParams.set('meshcast', '1');
                guestParams.set('meshcast', '1');
                viewerParams.set('meshcast', '1');
            }
            
            sessionData.director_url = `${vdoDomain}/mixer?${directorParams.toString()}`;
            sessionData.guest_url = `${vdoDomain}/?${guestParams.toString()}`;
            sessionData.viewer_url = `${vdoDomain}/?${viewerParams.toString()}&whepshare=https://use1.meshcast.io/whep/EPTLive`;
        }

        const { data: savedSession, error } = session
            ? await App.supabase.from('sessions').update(sessionData).eq('id', session.id).select().single()
            : await App.supabase.from('sessions').insert(sessionData).select().single();

        if (error) {
            alert("No se pudo guardar la sesión.");
            console.error('Error guardando la sesión:', error);
            return;
        }

        // Lógica para guardar participantes
        await App.supabase.from('event_participants').delete().eq('session_id', savedSession.id);
        if (this.participants && this.participants.length > 0) {
            const participantsData = this.participants.map(p => ({
                session_id: savedSession.id,
                user_id: p.id
            }));
            const { error: participantsError } = await App.supabase.from('event_participants').insert(participantsData);
            if (participantsError) {
                alert("La sesión se guardó, pero hubo un error al guardar los participantes.");
            }
        }
        
        alert(`¡Sesión ${session ? 'actualizada' : 'agendada'} con éxito!`);
        this.closeModal();
        this.fetchSessions();
    },

    // Pega estas nuevas funciones dentro del objeto Studio en manager-estudio.js

    async searchParticipants(searchTerm) {
        if (searchTerm.length < 3) {
            alert("Por favor, introduce al menos 3 caracteres para buscar.");
            return;
        }
        const resultsContainer = document.getElementById('participant-search-results');
        resultsContainer.innerHTML = '<p>Buscando...</p>';

        // --- CONSULTA CORREGIDA: BUSCA POR NOMBRE O POR EMAIL ---
        const { data: profiles, error } = await App.supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
            .neq('id', App.userId)
            .limit(5);

        if (error || !profiles || profiles.length === 0) {
            resultsContainer.innerHTML = '<p>No se encontraron resultados.</p>';
            return;
        }

        resultsContainer.innerHTML = profiles.map(profile => `
            <div class="search-result-item" data-user-id="${profile.id}" data-user-name="${profile.display_name}" data-avatar-url="${profile.avatar_url}">
                <img src="${profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="">
                <span>${profile.display_name}</span>
                <button type="button" class="btn-add-participant">+</button>
            </div>
        `).join('');

        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-add-participant')) {
                    const user = {
                        id: item.dataset.userId,
                        name: item.dataset.userName,
                        avatar: item.dataset.avatarUrl
                    };
                    this.addParticipant(user);
                    resultsContainer.innerHTML = '';
                }
            });
        });
    },

    addParticipant(user) {
        // Evitamos añadir duplicados
        if (this.participants.some(p => p.id === user.id)) return;
        if (user.id === App.userId) return; // Evitamos añadir al propio organizador

        this.participants.push(user);
        this.renderAddedParticipants();
    },

    renderAddedParticipants() {
        const list = document.getElementById('added-participants-ul');
        if (!list) return;

        if (this.participants.length === 0) {
            list.innerHTML = '';
            return;
        }
        
        list.innerHTML = this.participants.map(p => `
            <li data-user-id="${p.id}">
                <img src="${p.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="">
                <span>${p.name}</span>
                <button type="button" class="btn-remove-participant">&times;</button>
            </li>
        `).join('');

        list.querySelectorAll('.btn-remove-participant').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.parentElement.dataset.userId;
                this.removeParticipant(userId);
            });
        });
    },

    removeParticipant(userId) {
        this.participants = this.participants.filter(p => p.id !== userId);
        this.renderAddedParticipants();
    },

    openSession(sessionData) {
        const session = JSON.parse(decodeURIComponent(sessionData));
        if (!session.director_url) {
            alert("Esta sesión no tiene una sala de control.");
            return;
        }
        window.open(`/inv/sala-de-control.html?id=${session.id}`, '_blank');
    },

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
        } else {
            alert("¡ID guardado con éxito!");
            this.fetchSessions(); // Refrescamos la lista para que desaparezca el campo
        }
    },
    
    async deleteSession(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres borrar esta sesión? Esta acción es irreversible.");
        if (!confirmed) return;
        const { error } = await App.supabase.from('sessions').delete().eq('id', sessionId);
        if (error) { 
            alert("Hubo un error al borrar la sesión."); 
        } else {
            alert("Sala borrada con éxito.");
            this.fetchSessions();
        }
    }
};