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

// STUDIO
const Studio = {
    timers: { dashboardCountdown: null },

    async fetchSessions() {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        container.innerHTML = `<p>Cargando tus salas...</p>`;
        const { data: sessions, error } = await App.supabase.from('sessions').select('*').eq('user_id', App.userId).order('created_at', { ascending: false });
        if (error) { console.error('Error cargando las sesiones:', error); container.innerHTML = `<p>Error al cargar tus salas.</p>`; return; }
        this.renderSessions(sessions);
    },

    renderSessions(sessions) {
        const container = document.getElementById('sessions-container');
        if (!container) return;
        if (!sessions || sessions.length === 0) {
            container.innerHTML = `<div class="studio-launcher"><h3>Aún no has configurado ninguna sala</h3><p>Ve a la sección "Inicio" para crear tu primera sesión.</p></div>`;
            return;
        }
        container.innerHTML = sessions.map(session => {
            const publicLiveUrl = 'https://epistecnologia.com/live/live.html';
            const sessionData = encodeURIComponent(JSON.stringify(session));

            // Botones condicionales
            const guestLinkButton = session.platform === 'vdo_ninja'
                ? `<button class="btn-secondary" onclick="navigator.clipboard.writeText('${session.guest_url}').then(() => alert('¡Enlace de invitado copiado!'))"><i class="fa-solid fa-user-plus"></i> Copiar Link Invitado</button>`
                : '';
            
            const startNowButton = session.platform === 'youtube'
                ? `<button class="btn-secondary" onclick="Studio.startNow('${session.id}')"><i class="fa-solid fa-play-circle"></i> Iniciar Ahora</button>`
                : '';

            return `
            <div class="session-card" id="${session.id}">
                <div>
                    <div class="session-card__meta">${session.platform === 'youtube' ? 'YouTube Live' : 'EPT Live'}</div>
                    <h4>${session.session_title}</h4>
                    <small>Proyecto: ${session.project_title}</small>
                </div>
                <div class="session-card__actions">
                    <button class="btn-primary" onclick="Studio.openSession('${sessionData}')"><i class="fa-solid fa-arrow-right-to-bracket"></i> ${session.platform === 'youtube' ? 'Ver Detalles' : 'Ir a la Sala'}</button>
                    <button class="btn-secondary" onclick="Studio.openModal('${sessionData}')"><i class="fa-solid fa-pencil"></i> Editar</button>
                    ${startNowButton}
                    ${guestLinkButton}
                    <button class="btn-secondary" onclick="navigator.clipboard.writeText('${publicLiveUrl}').then(() => alert('¡Enlace de la página En Vivo copiado!'))"><i class="fa-solid fa-share-nodes"></i> Compartir</button>
                    <button class="btn-secondary" style="margin-left: auto; --color-accent: #e02424;" onclick="Studio.deleteSession('${session.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    },
    
    async deleteSession(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres borrar esta sesión? Esta acción es irreversible.");
        if (!confirmed) return;
        const { error } = await App.supabase.from('sessions').delete().eq('id', sessionId);
        if (error) { console.error('Error al borrar la sesión:', error); alert("Hubo un error al borrar la sesión."); } 
        else { alert("Sala borrada con éxito."); this.fetchSessions(); }
    },

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
            const localISOTime = (new Date(d - tzoffset)).toISOString().slice(0, 16);
            return localISOTime;
        };
        
        const modalContainer = document.getElementById('modal-overlay-container');
        modalContainer.innerHTML = `
            <div id="studio-modal" class="modal-overlay is-visible">
                <div class="modal">
                    <header class="modal-header"><h2>${isEditing ? 'Editar' : 'Configurar'} Sesión</h2><button class="modal-close-btn">&times;</button></header>
                    <main class="modal-content">
                        <form id="studio-form">
                            <p>Proyecto: <strong>${session ? session.project_title : selectedProject}</strong></p>
                            <div class="form-group"><label for="session-platform">Plataforma</label><select id="session-platform" name="platform" class="project-dropdown" ${isEditing ? 'disabled' : ''}>
                                <option value="vdo_ninja" ${session && session.platform === 'vdo_ninja' ? 'selected' : ''}>EPT Live (Sala Propia)</option>
                                <option value="youtube" ${session && session.platform === 'youtube' ? 'selected' : ''}>YouTube Live</option>
                            </select></div>
                            <div class="form-group"><label for="session-title">Título del Evento</label><input id="session-title" name="sessionTitle" type="text" value="${session ? session.session_title : ''}" required></div>
                            <div class="form-group"><label for="session-start">Fecha y Hora de Inicio</label><input id="session-start" name="scheduledAt" type="datetime-local" class="project-dropdown" value="${toLocalISOString(session?.scheduled_at)}" required></div>
                            <div class="form-group"><label for="session-end">Fecha y Hora de Fin</label><input id="session-end" name="endAt" type="datetime-local" class="project-dropdown" value="${toLocalISOString(session?.end_at)}"></div>
                            
                            <div id="vdo-ninja-fields" style="display:${session?.platform !== 'youtube' ? 'block' : 'none'};">
                                <div class="form-group"><label for="guest-count">Nº de Invitados</label><select id="guest-count" name="guestCount" class="project-dropdown">${Array.from({length: 9}, (_, i) => `<option value="${i + 1}" ${session?.guest_count == i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
                            </div>
                            <div id="youtube-fields" style="display:${session?.platform === 'youtube' ? 'block' : 'none'};">
                                <div class="form-group"><label for="youtube-id">ID del Video de YouTube</label><input id="youtube-id" name="youtubeId" type="text" value="${session?.platform_id || ''}" placeholder="Ej: dQw4w9WgXcQ"></div>
                            </div>
                            <button type="submit" class="btn-primary" style="width:100%; margin-top: 1rem;">${isEditing ? 'Actualizar' : 'Agendar'} Sesión</button>
                        </form>
                    </main>
                </div>
            </div>`;
        
        const form = modalContainer.querySelector('#studio-form');
        const platformSelector = modalContainer.querySelector('#session-platform');
        platformSelector.addEventListener('change', (e) => {
            const isVdoNinja = e.target.value === 'vdo_ninja';
            document.getElementById('vdo-ninja-fields').style.display = isVdoNinja ? 'block' : 'none';
            document.getElementById('youtube-fields').style.display = isVdoNinja ? 'none' : 'block';
        });

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
        form.addEventListener('submit', (e) => this.handleSaveSession(e, session ? session.id : null));
    },

    closeModal() { document.getElementById('modal-overlay-container').innerHTML = ''; },

    // EN dashboard.js, dentro del objeto Studio

    // EN dashboard.js, dentro del objeto Studio
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
            end_at: endAt ? new Date(endAt).toISOString() : null
        };
        
        if (!sessionId) {
            sessionData.user_id = App.userId;
        }

        if (platform === 'vdo_ninja') {
            sessionData.platform_id = null;
            if (!sessionId) {
                const stableId = self.crypto.randomUUID().slice(0, 8);
                const roomName = `ept-${App.userProfile.orcid.slice(-6)}-${stableId}`.replace(/[^a-zA-Z0-9-]/g, ''); // Nombre de sala limpio
                const directorKey = `dir-${App.userProfile.orcid.slice(-4)}`;
                const vdoDomain = 'https://vdo.epistecnologia.com';
                
                let directorParams = new URLSearchParams({ room: roomName, director: directorKey, record: 'auto' });
                let guestParams = new URLSearchParams({ room: roomName });
                let viewerParams = new URLSearchParams({ scene: '0', room: roomName, showlabels: '', cleanoutput: '', layout: '', remote: '' });
                
                // Lógica de meshcast correcta, solo en director y viewer
                if (formData.get('guestCount') > 4) {
                    directorParams.set('meshcast', '1');
                    viewerParams.set('meshcast', '1');
                }
                
                sessionData.director_url = `${vdoDomain}/mixer.html?${directorParams.toString()}`;
                sessionData.guest_url = `${vdoDomain}/?${guestParams.toString()}`;
                sessionData.viewer_url = `${vdoDomain}/?${viewerParams.toString()}`;
            }
        } else if (platform === 'youtube') {
            sessionData.platform_id = formData.get('youtubeId');
            if (!sessionData.platform_id) { alert("Por favor, introduce el ID del video de YouTube."); return; }
        }

        const { error } = sessionId
            ? await App.supabase.from('sessions').update(sessionData).eq('id', sessionId)
            : await App.supabase.from('sessions').insert(sessionData);

        if (error) { console.error('Error guardando la sesión:', error); alert("No se pudo guardar la sesión."); } 
        else { alert(`¡Sesión ${sessionId ? 'actualizada' : 'agendada'} con éxito!`); this.closeModal(); this.fetchSessions(); }
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

    async openSession(sessionData) {
        const session = JSON.parse(decodeURIComponent(sessionData));
        if (session.platform === 'youtube') {
            this.openModal(sessionData);
            return;
        }

        const { data: currentSession, error } = await App.supabase.from('sessions').select('*').eq('id', session.id).single();
        if (error || !currentSession) { alert("No se pudo encontrar la sesión."); this.fetchSessions(); return; }

        if (currentSession.status === 'FINALIZADO') {
            alert("Esta sesión ya ha finalizado.");
            return;
        }

        // --- NUEVA LÓGICA: BUSCAR LA PRÓXIMA SESIÓN ---
        const { data: upcomingSessions } = await App.supabase
            .from('sessions')
            .select('id, scheduled_at')
            .gt('scheduled_at', currentSession.scheduled_at) // Busca sesiones DESPUÉS de la actual
            .order('scheduled_at', { ascending: true })
            .limit(1);

        const nextSession = (upcomingSessions && upcomingSessions.length > 0) ? upcomingSessions[0] : null;

        const { director_url: directorUrl, guest_url: guestUrl, status } = currentSession;
        const mixerContainer = document.getElementById('mixer-embed-container');
        mixerContainer.style.display = 'flex';
        mixerContainer.querySelector('#mixer-iframe').src = directorUrl;
        
        const actionsContainer = document.getElementById('mixer-room-actions');
        const publicLiveUrl = 'https://epistecnologia.com/live/live.html';
        let liveControlsHTML = '';

        if (status === 'EN VIVO') {
            liveControlsHTML = `<span class="live-indicator">🔴 En Vivo</span><button class="btn-primary" style="background-color: #e02424;" onclick="Studio.endLiveStream('${currentSession.id}')"><i class="fa-solid fa-stop-circle"></i> Terminar</button>`;
        } else {
            liveControlsHTML = `<div class="live-dropdown"><button class="btn-primary"><i class="fa-solid fa-tower-broadcast"></i> Iniciar Transmisión</button><div class="live-dropdown-content"><a href="#" onclick="event.preventDefault(); Studio.goLive('${currentSession.id}', 0)">Iniciar Ahora</a><a href="#" onclick="event.preventDefault(); Studio.goLive('${currentSession.id}', 1)">En 1 minuto</a><a href="#" onclick="event.preventDefault(); Studio.goLive('${currentSession.id}', 3)">En 3 minutos</a><a href="#" onclick="event.preventDefault(); Studio.goLive('${currentSession.id}', 5)">En 5 minutos</a></div></div>`;
        }

        actionsContainer.innerHTML = `<button class="btn-secondary" onclick="window.open('${guestUrl}', '_blank')"><i class="fa-solid fa-video"></i> Link Invitado</button><button class="btn-secondary" onclick="navigator.clipboard.writeText('${guestUrl}').then(() => alert('¡Enlace copiado!'))"><i class="fa-solid fa-copy"></i> Copiar Invitado</button><button class="btn-secondary" onclick="navigator.clipboard.writeText('${publicLiveUrl}').then(() => alert('¡Enlace copiado!'))"><i class="fa-solid fa-share-nodes"></i> Compartir</button>${liveControlsHTML}<div id="mixer-countdown-display" class="mixer-countdown"></div>`;
        
        document.getElementById('mixer-popout-btn').onclick = () => window.open(directorUrl, '_blank');
        document.getElementById('mixer-close-btn').onclick = () => this.closeMixer();
        
        // Pasamos la sesión actual Y la siguiente a nuestro contador
        this.startDashboardCountdown(currentSession, nextSession);
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

    // En /dashboard.js, dentro del objeto Studio

    async endLiveStream(sessionId) {
        const confirmed = confirm("¿Estás seguro de que quieres terminar esta transmisión? Esta acción es irreversible y cortará la conexión para todos.");
        if (!confirmed) return;

        const endButton = document.querySelector(`button[onclick="Studio.endLiveStream('${sessionId}')"]`);
        if (endButton) {
            endButton.disabled = true;
            let countdown = 10;
            endButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalizando en ${countdown}...`;
            
            const countdownInterval = setInterval(() => {
                countdown--;
                endButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalizando en ${countdown}...`;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
        }
        
        // Esperamos 10 segundos antes de ejecutar la acción final
        await new Promise(resolve => setTimeout(resolve, 10000));

        // --- ACCIÓN DE FINALIZACIÓN AGRESIVA ---
        const { error } = await App.supabase
            .from('sessions')
            .update({ 
                status: 'FINALIZADO', 
                end_at: new Date().toISOString(),
                // Rompemos los enlaces para asegurar que la transmisión se corte
                director_url: null,
                viewer_url: null,
                guest_url: null
            })
            .eq('id', sessionId);
        
        if (error) {
            alert("Hubo un error al finalizar la transmisión.");
            console.error("Error en endLiveStream:", error);
            // Reactivar el botón si hay error
            if(endButton) {
            endButton.disabled = false;
            endButton.innerHTML = `<i class="fa-solid fa-stop-circle"></i> Terminar`;
            }
        } else { 
            alert("Transmisión finalizada correctamente.");
            this.closeMixer(); 
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

        this.timers.dashboardCountdown = setInterval(() => {
            const now = new Date();
            let message = '';
            countdownDisplay.className = 'mixer-countdown';

            if (session.status === 'EN VIVO') {
                if (!endTime) { message = 'Sin hora de fin programada.'; } 
                else {
                    const distance = endTime - now;
                    if (distance < 0) { // --- ESTAMOS EN TIEMPO EXTRA ---
                        if (!this.warnings.overtime) {
                            this.playWarningSound();
                            this.warnings.overtime = true;
                        }

                        // --- LÓGICA DE CONFLICTO ---
                        if (nextStartTime && now < nextStartTime) {
                            const timeToNext = nextStartTime - now;
                            
                            if (timeToNext <= 3 * 60 * 1000) {
                                // Cierre forzado
                                this.endLiveStream(session.id);
                                alert("La sesión ha finalizado automáticamente para dar paso al siguiente evento.");
                                clearInterval(this.timers.dashboardCountdown);
                                return;
                            }
                            
                            if (timeToNext <= 6 * 60 * 1000) {
                                if (!this.warnings.conflict_6m) {
                                    this.playWarningSound();
                                    this.warnings.conflict_6m = true;
                                }
                                const mins = Math.ceil(timeToNext / (60 * 1000));
                                message = `¡ATENCIÓN! Siguiente evento en ${mins} min. Esta sesión se cerrará pronto.`;
                                countdownDisplay.classList.add('is-danger', 'is-blinking'); // Añadimos clase para parpadeo
                            }

                        } else { // Si no hay conflicto, solo muestra tiempo excedido
                            const overTime = now - endTime;
                            const minutes = Math.floor((overTime % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((overTime % (1000 * 60)) / 1000);
                            message = `Tiempo excedido: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                            countdownDisplay.classList.add('is-danger');
                        }

                    } else { // --- AÚN QUEDA TIEMPO ---
                        const hours = Math.floor(distance / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        message = `Tiempo restante: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                        if (distance < 5 * 60 * 1000) countdownDisplay.classList.add('is-warning');
                    }
                }
            } else if (session.status === 'PROGRAMADO' && startTime > now) {
                // ... (la lógica de cuenta regresiva para iniciar se mantiene igual)
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

document.addEventListener('DOMContentLoaded', () => App.init());