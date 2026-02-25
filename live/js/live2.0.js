// =================================================================
// ARCHIVO: /inv/js/live2.0.js (Catálogo Stream TV con Inteligencia de Tiempo)
// =================================================================

const LiveAppV2 = {
    supabase: null,
    allSessions: [],
    featuredSession: null,

    async init() {
        if (window.supabaseClient) {
            this.supabase = window.supabaseClient;
        } else {
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        this.setupEventListeners();
        await this.fetchSessions();
    },

    setupEventListeners() {
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        const categoryPills = document.querySelectorAll('.category-pill');
        categoryPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                categoryPills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    },

    async fetchSessions() {
        try {
            const { data, error } = await this.supabase
                .from('sessions')
                .select('*, profiles(display_name, avatar_url)')
                .eq('is_archived', false)
                // Obtenemos todo y luego lo ordenamos con JS para aplicar la inteligencia
                .order('scheduled_at', { ascending: false });

            if (error) throw error;

            this.processAndSortSessions(data || []);
        } catch (error) {
            console.error("Error al cargar las sesiones:", error);
            const list = document.getElementById('schedule-list');
            if(list) list.innerHTML = '<p>Error al cargar el contenido.</p>';
        }
    },

    // --- MAGIA: PROCESAR ESTADOS Y ORDENAR ---
    processAndSortSessions(data) {
        const now = new Date().getTime();
        const MARGIN_MS = 2 * 60 * 60 * 1000; // 2 horas de margen

        const processed = data.map(s => {
            let effectiveStatus = s.status;
            const scheduled = new Date(s.scheduled_at).getTime();

            // Solo auto-finalizamos si dice PROGRAMADO, ya pasaron más de 2 horas Y tiene link de grabación.
            // ELIMINADA LA REGLA DE 12 HORAS. ¡Los EN VIVO se quedan EN VIVO hasta que tú los cambies!
            if (effectiveStatus === 'PROGRAMADO' && now > (scheduled + MARGIN_MS) && s.recording_url) {
                effectiveStatus = 'FINALIZADO';
            }
            
            return { ...s, effectiveStatus };
        });

        this.allSessions = processed;
        this.distributeContent();
    },

    distributeContent() {
        if (this.allSessions.length === 0) {
            const heroContainer = document.getElementById('hero-tv-container');
            if (heroContainer) heroContainer.style.display = 'none';
            return;
        }

        // 1. EN VIVO: Ordenados por fecha (el más reciente primero)
        const liveSessions = this.allSessions
            .filter(s => s.effectiveStatus === 'EN VIVO')
            .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
        
        // 2. PROGRAMADOS (Próximamente): Ordenados del más cercano a iniciar al más lejano
        const scheduledSessions = this.allSessions
            .filter(s => s.effectiveStatus === 'PROGRAMADO')
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)); 

        // 3. FINALIZADOS (Grabaciones): Ordenados del más reciente al más antiguo
        const vodSessions = this.allSessions
            .filter(s => s.effectiveStatus === 'FINALIZADO')
            .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

        // SELECCIÓN DEL HERO: 
        // Primero el EN VIVO más nuevo. Si no hay, el PRÓXIMO más cercano. Si no, la última GRABACIÓN.
        if (liveSessions.length > 0) this.featuredSession = liveSessions[0];
        else if (scheduledSessions.length > 0) this.featuredSession = scheduledSessions[0];
        else if (vodSessions.length > 0) this.featuredSession = vodSessions[0];

        this.renderFeaturedContent();
        
        // Pasamos las listas para que la primera sección tenga (En Vivo + Próximamente) y la segunda (VOD)
        this.renderGrids(null, { liveSessions, scheduledSessions, vodSessions });
    },

    renderFeaturedContent() {
        const heroContainer = document.getElementById('hero-tv-container');
        if (!heroContainer || !this.featuredSession) return;

        const mainEvent = this.featuredSession;
        const isLive = mainEvent.effectiveStatus === 'EN VIVO';
        const isVOD = mainEvent.effectiveStatus === 'FINALIZADO';
        
        heroContainer.style.backgroundImage = 'none';
        const existingVideo = heroContainer.querySelector('.hero-video-wrapper');
        if (existingVideo) existingVideo.remove();

        if (isLive || isVOD) {
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'hero-video-wrapper';
            videoWrapper.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; background: #000; overflow:hidden; pointer-events:none;';
            
            videoWrapper.innerHTML = this.createPlayerIframe(mainEvent);
            heroContainer.insertBefore(videoWrapper, heroContainer.firstChild);
        } else {
            heroContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), url(${mainEvent.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'})`;
        }
        
        const badgeHtml = isLive 
            ? `<span class="badge live" id="hero-badge" style="padding:6px 12px; border-radius:4px;"><i class="fa-solid fa-tower-broadcast"></i> EN VIVO AHORA</span>`
            : `<span class="badge upcoming" id="hero-badge" style="background:rgba(255,255,255,0.2); backdrop-filter:blur(5px); color:white; padding:6px 12px; border-radius:4px;"><i class="fa-regular fa-calendar"></i> PRÓXIMAMENTE • ${new Date(mainEvent.scheduled_at).toLocaleDateString('es-ES', {month: 'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>`;

        const badgeEl = document.getElementById('hero-badge');
        if (badgeEl) badgeEl.outerHTML = badgeHtml;
        
        const titleEl = document.getElementById('hero-title');
        if(titleEl) titleEl.textContent = mainEvent.title || mainEvent.session_title;
        
        const descEl = document.getElementById('hero-desc');
        if(descEl) descEl.textContent = mainEvent.description || 'Únete a esta sesión especial de divulgación.';
        
        const actionsContainer = document.getElementById('hero-actions');
        if(actionsContainer) {
            if (isLive || isVOD) {
                actionsContainer.innerHTML = `<button onclick="window.open('/l/${mainEvent.id}', '_blank')" class="btn-tv-primary"><i class="fa-solid fa-play"></i> ${isLive ? 'Ver Transmisión' : 'Ver Grabación'}</button>`;
            } else {
                actionsContainer.innerHTML = `<button onclick="window.open('/l/${mainEvent.id}', '_blank')" class="btn-tv-secondary"><i class="fa-regular fa-clock"></i> Ir a Sala de Espera</button>`;
            }
        }
    },

    renderGrids(filteredSessions = null, preSorted = null) {
        const scheduleContainer = document.getElementById('schedule-list');
        const recordingsContainer = document.getElementById('recordings-list');
        
        if (scheduleContainer) scheduleContainer.innerHTML = '';
        if (recordingsContainer) recordingsContainer.innerHTML = '';

        // Si es una búsqueda, mostramos los filtrados. Si no, usamos las listas ordenadas.
        let toRenderUpcoming = [];
        let toRenderVOD = [];

        if (filteredSessions) {
            toRenderUpcoming = filteredSessions.filter(s => s.effectiveStatus !== 'FINALIZADO');
            toRenderVOD = filteredSessions.filter(s => s.effectiveStatus === 'FINALIZADO');
        } else if (preSorted) {
            toRenderUpcoming = [...preSorted.liveSessions, ...preSorted.scheduledSessions];
            toRenderVOD = preSorted.vodSessions;
        }

        const renderCards = (sessions, container) => {
            sessions.forEach(item => {
                if (!filteredSessions && this.featuredSession && item.id === this.featuredSession.id) return;

                const isLive = item.effectiveStatus === 'EN VIVO';
                const isVOD = item.effectiveStatus === 'FINALIZADO';
                
                let badgeHtml = '';
                if (isLive) badgeHtml = `<span class="badge live" style="position:absolute; top:10px; left:10px; font-size:0.7rem; padding:5px 10px; border-radius: 6px;"><i class="fa-solid fa-tower-broadcast"></i> EN VIVO</span>`;
                else if (!isVOD) badgeHtml = `<span class="badge upcoming" style="position:absolute; top:10px; left:10px; font-size:0.7rem; padding:5px 10px; border-radius: 6px; background: rgba(0,0,0,0.6); color: white; backdrop-filter: blur(4px);"><i class="fa-regular fa-calendar"></i> PRÓXIMAMENTE</span>`;

                const dateString = new Date(item.scheduled_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const avatarUrl = item.profiles?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
                const creatorName = item.profiles?.display_name || 'Investigador';

                const cardHTML = `
                    <div class="tv-card" onclick="window.open('/l/${item.id}', '_blank')" style="display: flex; flex-direction: column; height: 100%; cursor: pointer;">
                        <div class="tv-card-img" style="aspect-ratio: 16/9; position: relative; background: #000;">
                            <img src="${item.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Thumb" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
                            ${badgeHtml}
                        </div>
                        <div class="tv-card-content" style="padding: 1.2rem; flex-grow: 1; display: flex; flex-direction: column;">
                            <h3 class="tv-card-title" style="margin: 0 0 12px 0; font-size: 1.1rem; line-height: 1.3;">${item.title || item.session_title}</h3>
                            <div class="tv-card-meta" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--color-secondary); margin-bottom: 12px; font-weight: 500;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <img src="${avatarUrl}" alt="${creatorName}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
                                    <span style="color: var(--color-text-primary); font-weight: 600;">${creatorName}</span>
                                </div>
                                <span><i class="fa-regular fa-clock"></i> ${dateString}</span>
                            </div>
                            <p class="tv-card-desc" style="font-size: 0.85rem; color: var(--color-secondary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5;">
                                ${item.description || 'Haz clic para ver los detalles de esta sesión y acceder a la transmisión.'}
                            </p>
                        </div>
                    </div>
                `;
                if (container) container.insertAdjacentHTML('beforeend', cardHTML);
            });
        };

        renderCards(toRenderUpcoming, scheduleContainer);
        renderCards(toRenderVOD, recordingsContainer);

        if (scheduleContainer && scheduleContainer.innerHTML === '') scheduleContainer.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">No hay sesiones programadas en este momento.</p>';
        if (recordingsContainer && recordingsContainer.innerHTML === '') recordingsContainer.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">No hay grabaciones disponibles.</p>';
    },

    createPlayerIframe(session) {
        const platform = session.platform || 'vdo_ninja';
        if (platform === 'youtube' && session.platform_id) {
            return `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&loop=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
        if (platform === 'twitch' && session.platform_id) {
            const domain = window.location.hostname;
            return `<iframe src="https://player.twitch.tv/?channel=${session.platform_id}&parent=${domain}&muted=true&autoplay=true" allowfullscreen></iframe>`;
        }
        if (platform === 'vdo_ninja' && session.viewer_url) {
            const cleanUrl = session.viewer_url + '&automute=1&transparent=1';
            return `<iframe src="${cleanUrl}" allow="autoplay; camera; microphone; fullscreen; picture-in-picture"></iframe>`;
        }
        return '';
    },

    handleSearch(query) {
        if (!query || query.trim() === '') {
            this.distributeContent(); // Volver al orden natural
            return;
        }
        
        const lowerQuery = query.toLowerCase();
        const filtered = this.allSessions.filter(s => {
            const title = (s.title || s.session_title || '').toLowerCase();
            const desc = (s.description || '').toLowerCase();
            const project = (s.project_title || '').toLowerCase();
            const creator = (s.profiles?.display_name || '').toLowerCase();
            return title.includes(lowerQuery) || desc.includes(lowerQuery) || project.includes(lowerQuery) || creator.includes(lowerQuery);
        });

        this.renderGrids(filtered);
    }
};

document.addEventListener('DOMContentLoaded', () => LiveAppV2.init());