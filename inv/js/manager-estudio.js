export const Studio = {
    participants: [],
    init() {
        this.fetchSessions();
        this.fetchAllPublicSessions();
        this.setupTabEvents();
        this.addEventListeners(); 
    },

    setupTabEvents() {
        const tabLinks = document.querySelectorAll('.studio-tab-link');
        const tabContents = document.querySelectorAll('.studio-tab-content');
        if (!tabLinks.length || tabLinks[0].dataset.initialized) return; 

        tabLinks.forEach(button => {
            button.dataset.initialized = 'true';
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                tabLinks.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
            });
        });
    },

    // REEMPLAZA ESTA FUNCIÓN COMPLETA

    addEventListeners() {
        const container = document.getElementById('my-sessions-tab');
        if (!container || container.dataset.listenerAttached) return;
        container.dataset.listenerAttached = 'true';

        container.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            e.preventDefault();
            const action = button.dataset.action;
            const sessionData = button.dataset.session;
            const sessionId = button.dataset.sessionId;

            if (action === 'open-session') this.openSession(sessionData);
            else if (action === 'edit-session') this.openModal(JSON.parse(decodeURIComponent(sessionData)));
            else if (action === 'delete-session') this.deleteSession(sessionId);
            else if (action === 'save-recording-url') this.saveRecordingUrl(sessionId);
            else if (action === 'copy-guest-link') {
                const guestUrl = button.dataset.url;
                navigator.clipboard.writeText(guestUrl).then(() => {
                    alert('¡Enlace para invitados copiado al portapapeles!');
                });
            }
            else if (action === 'copy-recording-link') {
                const recordingUrl = button.dataset.url;
                navigator.clipboard.writeText(recordingUrl).then(() => {
                    alert('¡Enlace de grabación remota copiado al portapapeles!');
                });
            }
            // --- INICIO: LÓGICA AÑADIDA ---
            else if (action === 'copy-direct-link') {
                const directUrl = button.dataset.url;
                navigator.clipboard.writeText(directUrl).then(() => {
                    alert('¡Enlace directo para la audiencia copiado!');
                }).catch(err => {
                    console.error('Error al copiar enlace:', err);
                    alert('No se pudo copiar el enlace.');
                });
            }
            // --- FIN: LÓGICA AÑADIDA ---
            else if (action === 'archive-session') this.archiveSession(sessionId);
            else if (action === 'unarchive-session') this.unarchiveSession(sessionId);
        });
    },

    // AÑADE ESTA NUEVA FUNCIÓN al objeto Studio en manager-estudio.js
    async archiveSession(sessionId) {
        const confirmed = confirm("¿Archivar esta sesión? Desaparecerá de las vistas públicas pero no se borrará. Podrás seguir viéndola en esta sección.");
        if (!confirmed) return;

        const { error } = await App.supabase
            .from('sessions')
            .update({ is_archived: true })
            .eq('id', sessionId);

        if (error) {
            alert("Hubo un error al archivar la sesión.");
            console.error('Error archiving session:', error);
        } else {
            alert("Sesión archivada con éxito.");
            this.fetchSessions(); // Refrescamos la vista
        }
    },

    async unarchiveSession(sessionId) {
        const confirmed = confirm("¿Volver a mostrar esta sesión en las vistas públicas?");
        if (!confirmed) return;

        const { error } = await App.supabase
            .from('sessions')
            .update({ is_archived: false }) // Cambiamos el valor a false
            .eq('id', sessionId);

        if (error) {
            alert("Hubo un error al desarchivar la sesión.");
            console.error('Error unarchiving session:', error);
        } else {
            alert("Sesión restaurada con éxito. Ahora es visible públicamente.");
            this.fetchSessions();
        }
    },

    // REEMPLAZA ESTA FUNCIÓN EN manager-estudio.js

    async fetchSessions() {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando tus sesiones...</p>`;

        const { data: sessions, error } = await App.supabase
            .from('sessions')
            .select(`*, participants: event_participants(profiles(id, avatar_url, display_name))`)
            // .eq('is_archived', false) // <-- HEMOS ELIMINADO ESTA LÍNEA
            .eq('user_id', App.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching sessions:", error);
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
            const formattedDate = startTime.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            const formattedStartTime = startTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const participantsHTML = session.participants.map(p => 
                `<img src="${p.profiles.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${p.profiles.display_name}" title="${p.profiles.display_name}" class="participant-avatar">`
            ).join('');
            
            const directLink = `${window.location.origin}/live.html?sesion=${session.id}`;
            
            const archiveButtonHTML = session.is_archived
                ? `<button class="btn-secondary" data-action="unarchive-session" data-session-id="${session.id}" title="Restaurar"><i class="fas fa-box-open"></i><span>Restaurar</span></button>`
                : `<button class="btn-secondary" data-action="archive-session" data-session-id="${session.id}" title="Archivar"><i class="fas fa-box-archive"></i><span>Archivar</span></button>`;
            
            return `
            <div class="session-card ${session.is_archived ? 'is-archived' : ''}" id="${session.id}">
                <div class="session-card__header">
                    ${session.is_archived ? '<span class="archived-badge">Archivado</span>' : ''}
                    <span class="session-card__meta">${session.platform}</span>
                    <h4>${session.session_title}</h4>
                    <p>${session.project_title}</p>
                </div>
                <div class="session-card__participants">${participantsHTML}</div>
                <div class="session-card__schedule">
                    <p><i class="fas fa-calendar-alt"></i> ${formattedDate}</p>
                    <p><i class="fas fa-clock"></i> ${formattedStartTime}</p>
                </div>
                
                <div class="recording-url-adder">
                    <label for="recording-url-${session.id}">URL de Grabación Final</label>
                    <div class="input-group">
                        <input type="url" id="recording-url-${session.id}" value="${session.recording_url || ''}" placeholder="Pega el enlace aquí...">
                        <button class="btn-secondary" data-action="save-recording-url" data-session-id="${session.id}">
                            <i class="fas fa-save"></i>
                        </button>
                    </div>
                </div>
                <div class="session-card-actions icon-text-buttons">
                    <button class="btn-primary" data-action="open-session" data-session='${sessionData}'>
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>Sala de control</span>
                    </button>
                    <button class="btn-secondary" data-action="copy-direct-link" data-url="${directLink}" title="Copiar enlace directo para el público">
                        <i class="fa-solid fa-share-nodes"></i>
                        <span>Compartir evento</span>
                    </button>
                    <a href="${session.viewer_url}" target="_blank" class="btn-secondary" title="Ver como espectador">
                        <i class="fa-solid fa-eye"></i>
                        <span>Solo Ver</span>
                    </a>
                    <button class="btn-secondary" data-action="copy-guest-link" data-url="${session.guest_url}">
                        <i class="fas fa-copy"></i>
                        <span>Link invitados</span>
                    </button>
                    ${session.recording_source_url ? `
                    <button class="btn-secondary" data-action="copy-recording-link" data-url="${session.recording_source_url}">
                        <i class="fas fa-video"></i>
                        <span>Copiar Link Grab.</span>
                    </button>` : ''}
                    <button class="btn-secondary" data-action="edit-session" data-session='${sessionData}' style="margin-left: auto;">
                        <i class="fas fa-pencil-alt"></i>
                        <span>Editar</span>
                    </button>
                    ${archiveButtonHTML}
                    <button class="btn-secondary" data-action="delete-session" data-session-id="${session.id}" title="Borrar">
                        <i class="fas fa-trash"></i>
                        <span>Borrar</span>
                    </button>
                </div>
            </div>`;
        }).join('');
    },

    // --- CAMBIO 3: NUEVA FUNCIÓN PARA GUARDAR LA URL DE GRABACIÓN ---
    async saveRecordingUrl(sessionId) {
        const inputEl = document.getElementById(`recording-url-${sessionId}`);
        if (!inputEl) return;
        
        const recordingUrl = inputEl.value.trim();
        // Permite guardar un campo vacío para borrar la URL si es necesario
        if (recordingUrl && !recordingUrl.startsWith('http')) {
            alert("Por favor, introduce una URL válida.");
            return;
        }

        const { error } = await App.supabase
            .from('sessions')
            .update({ recording_url: recordingUrl })
            .eq('id', sessionId);

        if (error) {
            alert("Hubo un error al guardar la URL.");
            console.error(error);
        } else {
            alert("¡URL de grabación guardada con éxito!");
        }
    },

    async fetchAllPublicSessions() {
        const container = document.getElementById('global-schedule-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando agenda global...</p>`;

        // --- INICIO DE LA CORRECCIÓN ---
        const { data: sessions, error: sessionsError } = await App.supabase
            .from('sessions')
            .select('*')
            // Ahora también incluimos las sesiones FINALIZADO
            .in('status', ['PROGRAMADO', 'EN VIVO', 'FINALIZADO']) 
            .eq('is_archived', false) // Y quitamos este filtro
            .order('scheduled_at', { ascending: false });
        // --- FIN DE LA CORRECCIÓN ---
            
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
            const platformNames = {
                'vdo_ninja': 'EPT Live',
                'youtube': 'YouTube',
                'twitch': 'Twitch',
                'substack': 'Substack'
            };
            const displayName = platformNames[session.platform] || session.platform;
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

    openModal(session = null) { // Simplificamos el parámetro
        const isEditing = !!session;

        // --- INICIO DE LA MODIFICACIÓN ---
        // Obtenemos el proyecto activo desde sessionStorage
        const activeProjectString = sessionStorage.getItem('activeProject');
        if (!isEditing && !activeProjectString) {
            alert("Por favor, selecciona primero un proyecto en la página de Inicio.");
            return;
        }
        const activeProject = activeProjectString ? JSON.parse(activeProjectString) : null;
        // --- FIN DE LA MODIFICACIÓN ---

        if (isEditing && session.participants) {
            this.participants = session.participants.map(p => ({
                id: p.profiles.id,
                name: p.profiles.display_name,
                avatar: p.profiles.avatar_url
            }));
        } else {
            this.participants = [];
        }

        const toLocalISOString = (date) => {
            if (!date) return '';
            const d = new Date(date), tzoffset = d.getTimezoneOffset() * 60000;
            return new Date(d - tzoffset).toISOString().slice(0, 16);
        };
        
        const initialPlatform = session?.platform || 'vdo_ninja'; // Cambiado a vdo_ninja por defecto
        const modalContainer = document.getElementById('modal-overlay-container');
        
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header"><h2>${isEditing ? 'Editar' : 'Configurar'} Sesión</h2><button class="modal-close-btn">×</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${session ? session.project_title : activeProject.title}</strong></p>
                            <hr>
                            
                            <div class="form-group">
                                <label>Plataforma de Transmisión</label>
                                <div class="platform-selector">
                                    <div class="platform-option" data-platform="eptstream"><i class="fa-solid fa-wand-magic-sparkles"></i><span>EPTstream</span></div>
                                    <div class="platform-option" data-platform="vdo_ninja"><i class="fas fa-satellite-dish"></i><span>EPT Live</span></div>    
                                    <div class="platform-option" data-platform="twitch"><i class="fab fa-twitch"></i><span>Twitch</span></div>
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
                            
                            <div class="form-group rtmps-fields" style="display: ${initialPlatform === 'youtube' || initialPlatform === 'twitch' ? 'block' : 'none'};">
                                <hr>
                                <label>Conf. Manual - Próx. (Usar un software como OBS)</label>
                                <p class="form-hint">Pega aquí los datos de RTMP para transmitir directamente desde la sala de control.</p>
                                <input id="session-rtmp-url" name="rtmp_url" type="text" value="${session?.rtmp_url || ''}" placeholder="URL del servidor RTMPS (ej: rtmps://a.rtmps.youtube.com/live2)">
                                <input id="session-rtmp-key" name="rtmp_key" type="password" value="${session?.rtmp_key || ''}" placeholder="Clave de transmisión">
                            </div>
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
            // Ahora este bloque se activa para YouTube, Twitch y EPTstream
        if (platform === 'youtube' || platform === 'twitch' || platform === 'eptstream') {
            const platformName = platform === 'youtube' ? 'Video de YouTube' : 'Canal de Twitch';
            fieldHTML = `<div class="form-group"><label for="platform-id">ID del ${platformName}</label><input id="platform-id" name="platformId" type="text" value="${session?.platform_id || ''}" placeholder="El ID de tu canal o video"></div>`;
        } 
        // --- FIN: CAMBIO PUNTUAL --- 
        else if (platform === 'substack') {
                fieldHTML = `<div class="form-group"><label for="substack-id">ID del Directo de Substack</label><input id="substack-id" name="substackId" type="text" value="${session?.platform_id || ''}" placeholder="Lo optienes al agendar tu transmisión"></div>`;
            }
            platformSpecificFields.innerHTML = fieldHTML;

            const rtmpsFields = modalContainer.querySelector('.rtmps-fields');
            if (rtmpsFields) {
                // Tu lógica RTMP
                rtmpsFields.style.display = (platform === 'youtube' || platform === 'twitch' || platform === 'eptstream') ? 'block' : 'none';
            }
        };

        platformOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                updatePlatformSelection(opt.dataset.platform);
            });
        });
        
        updatePlatformSelection(initialPlatform);
        this.renderAddedParticipants();

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        form.addEventListener('submit', (e) => this.handleSaveSession(e, session));
        document.getElementById('search-participant-btn').addEventListener('click', () => {
            const searchTerm = document.getElementById('participant-search').value;
            this.searchParticipants(searchTerm);
        });
        const rtmpKeyInput = document.getElementById('session-rtmp-key');
        if (rtmpKeyInput) {
            rtmpKeyInput.addEventListener('click', () => {
                rtmpKeyInput.type = 'text';
                setTimeout(() => { rtmpKeyInput.type = 'password'; }, 5000);
            });
        }
    },

    closeModal() {
        const modalContainer = document.getElementById('modal-overlay-container');
        if(modalContainer) modalContainer.innerHTML = '';
    },

    async handleSaveSession(e, session = null) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const platform = formData.get('platform');
        
        const activeProjectString = sessionStorage.getItem('activeProject');
        const activeProject = activeProjectString ? JSON.parse(activeProjectString) : null;
        const projectTitle = session ? session.project_title : activeProject?.title;

        if (!projectTitle) {
            alert("Error: No se pudo determinar el proyecto asociado. Por favor, selecciónalo de nuevo.");
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
            platform_id: formData.get('platformId') || formData.get('substackId') || null, // Corregido para tomar el platformId
            rtmp_url: formData.get('rtmp_url'),
            rtmp_key: formData.get('rtmp_key')
        };
        
        if (!session) {
            sessionData.user_id = App.userId;
            sessionData.is_archived = false;

            // --- INICIO: LÓGICA CONDICIONAL PARA LA PLATAFORMA ---
            if (platform === 'eptstream') {
                // Generamos un nombre de sesión único para Zoom.
                const sessionName = self.crypto.randomUUID();
                
                // Creamos las URLs que apuntarán a nuestra nueva sala de control web.
                sessionData.director_url = `/inv/stream.html?session=${sessionName}&role=host`;
                sessionData.guest_url = `/inv/stream.html?session=${sessionName}&role=guest`;
                
                // La URL del espectador será la de la plataforma de destino (ej. YouTube).
                const platformId = formData.get('platformId');
                if (platformId) {
                    sessionData.viewer_url = `https://www.youtube.com/live/${platformId}`;
                }
            } else {
                // Esta es tu lógica existente para VDO.Ninja. La mantenemos intacta.
                const stableId = self.crypto.randomUUID().slice(0, 8);
                const roomName = `ept_2_${App.userProfile.orcid.slice(-4)}_${stableId}`; 
                const directorKey = `dir_${App.userProfile.orcid.slice(-4)}`;
                const vdoDomain = 'https://vdo.ninja/alpha';
                let directorParams = new URLSearchParams({ room: roomName, director: directorKey, record: 'auto' });
                
                const rtmpUrl = formData.get('rtmp_url');
                const rtmpKey = formData.get('rtmp_key');
                if (rtmpUrl && rtmpKey) {
                    const broadcastUrl = rtmpUrl.replace(/^rtmps?:\/\//, '');
                    directorParams.set('broadcast', `${rtmpKey}@${broadcastUrl}`);
                }
                sessionData.director_url = `${vdoDomain}/mixer?${directorParams.toString()}&meshcast`;
                
                const recordingParams = new URLSearchParams({
                    scene: '0', layout: '', remote: '', clean: '', chroma: '000', ssar: 'landscape',
                    nosettings: '', prefercurrenttab: '', selfbrowsersurface: 'include',
                    displaysurface: 'browser', np: '', nopush: '', publish: '', record: '',
                    screenshareaspectratio: '1.7777777777777777', locked: '1.7777777777777777', room: roomName
                });
                sessionData.recording_source_url = `${vdoDomain}/?${recordingParams.toString()}`;
                
                let guestParams = new URLSearchParams({ room: roomName });
                let viewerParams = new URLSearchParams({ scene: '0', showlabels: '0', room: roomName });
                
                if (formData.get('guestCount') > 4) {
                    const meshcastUrl = `https://cae1.meshcast.io/whep/${roomName}`;
                    directorParams.set('whepshare', meshcastUrl);
                    guestParams.set('whepshare', meshcastUrl);
                    viewerParams.set('meshcast', '1');
                }
                sessionData.guest_url = `${vdoDomain}/?${guestParams.toString()}`;
                sessionData.viewer_url = `${vdoDomain}/?${viewerParams.toString()}&layout&whepshare=https://use1.meshcast.io/whep/${roomName}&cleanoutput`;
            }
            // --- FIN: LÓGICA CONDICIONAL ---
        }

        // Guardamos la sesión en la base de datos
        const { data: savedSession, error } = session
            ? await App.supabase.from('sessions').update(sessionData).eq('id', session.id).select().single()
            : await App.supabase.from('sessions').insert(sessionData).select().single();

        if (error) {
            alert("No se pudo guardar la sesión.");
            console.error('Error guardando la sesión:', error);
            return;
        }

        // --- INICIO: LÓGICA DE CHAT BLUESKY ---
        // Si la sesión es de VDO Ninja y es una sesión nueva, creamos el hilo de chat.
        if (platform === 'vdo_ninja' && !session) {
            try {
                console.log("Creando hilo de chat en Bluesky...");
                const directLink = `https://epistecnologia.com/live.html?sesion=${savedSession.id}`;
        
                // Obtenemos la zona horaria del navegador del investigador
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                const { data: chatData, error: chatError } = await App.supabase.functions.invoke('bsky-create-anchor-post', {
                    body: { 
                        sessionTitle: savedSession.session_title,
                        scheduledAt: savedSession.scheduled_at,
                        directLink: directLink,
                        timezone: timezone
                    },
                });

                if (chatError) throw chatError;

                // --- LA CORRECCIÓN ESTÁ AQUÍ ---
                // Ahora guardamos tanto el URI como el CID del hilo.
                await App.supabase
                    .from('sessions')
                    .update({ 
                        bsky_chat_thread_uri: chatData.uri, 
                        bsky_chat_thread_cid: chatData.cid // <-- ESTA ES LA LÍNEA QUE FALTABA
                    })
                    .eq('id', savedSession.id);
                
                console.log("Hilo de chat creado y enlazado a la sesión");

            } catch (err) {
                alert(`La sesión se agendó, pero hubo un error al crear el hilo de chat en Bluesky: ${err.message}`);
                console.error(err);
            }
        }
        // --- FIN: LÓGICA DE CHAT BLUESKY ---

        // Lógica para guardar participantes (sin cambios)
        await App.supabase.from('event_participants').delete().eq('session_id', savedSession.id);
        if (this.participants && this.participants.length > 0) {
            const participantsData = this.participants.map(p => ({ session_id: savedSession.id, user_id: p.id }));
            const { error: participantsError } = await App.supabase.from('event_participants').insert(participantsData);
            if (participantsError) console.error('Error al guardar participantes:', participantsError);
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
                <img src="${p.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="" class="participant-avatar">
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

        // Verificamos si la sesión tiene un ID para construir el enlace
        if (!session.id) {
            alert("Esta sesión no tiene un ID válido.");
            return;
        }
        
        // --- LÓGICA ACTUALIZADA ---
        // Si la plataforma NO es 'eptstream', abre la sala de control local.
        if (session.platform !== 'eptstream') {
            window.open(`/inv/sala-de-control.html?id=${session.id}`, '_blank');
        } else {
            // Si es 'eptstream', abre su sala de producción directa.
            window.open(session.director_url, '_blank');
        }
        // --- FIN DE LA LÓGICA ---
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
    
    // REEMPLAZA ESTA FUNCIÓN

    async deleteSession(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres borrar esta sesión? Esta acción es irreversible.");
        if (!confirmed) return;

        // --- INICIO DEL CAMBIO ---
        // 1. Primero, borramos los participantes asociados a la sesión.
        const { error: participantsError } = await App.supabase
            .from('event_participants')
            .delete()
            .eq('session_id', sessionId);

        if (participantsError) {
            alert("Hubo un error al borrar los participantes asociados. No se pudo completar la eliminación.");
            console.error('Error deleting participants:', participantsError);
            return;
        }

        // 2. Si lo anterior tuvo éxito, ahora sí borramos la sesión.
        const { error: sessionError } = await App.supabase
            .from('sessions')
            .delete()
            .eq('id', sessionId);

        if (sessionError) { 
            alert("Hubo un error al borrar la sesión."); 
            console.error('Error deleting session:', sessionError);
        } else {
            alert("Sala y participantes borrados con éxito.");
            this.fetchSessions();
        }
        // --- FIN DEL CAMBIO ---
    }
};