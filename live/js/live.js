const LiveApp = {
    supabase: null,
    elements: {},
    allContentMap: {},
    featuredContent: [],
    currentSlideIndex: 0,
    isApiReady: false,
    countdownInterval: null,

    init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        this.addEventListeners();

        // --- INICIO DE LA LÓGICA DE AUTENTICACIÓN ---
        this.supabase.auth.onAuthStateChange((_event, session) => {
            this.renderUserIcon(session);
        });
        // --- FIN DE LA LÓGICA DE AUTENTICACIÓN ---
        
        if (window.YT && typeof window.YT.Player === 'function') {
            this.isApiReady = true;
            this.run();
        } else {
            window.onYouTubeIframeAPIReady = () => {
                this.isApiReady = true;
                this.run();
            };
        }
        this.listenForChanges();

        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
        }
    },

    cacheDOMElements() {
        this.elements = {
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            carouselSection: document.getElementById('featured-carousel-section'),
            scheduleList: document.getElementById('schedule-list'),
            ondemandListContainer: document.getElementById('ondemand-list-container'),
            tabs: document.querySelectorAll('.tab-link'),
            tabContents: document.querySelectorAll('.tab-content'),
            modalContainer: document.getElementById('modal-container'),
            userIconContainer: document.getElementById('user-icon-container'),
            searchInput: document.getElementById('search-input')
        };
    },

    renderUserIcon(session) {
        const container = this.elements.userIconContainer;
        if (!container) return;

        if (session && session.user) {
            const avatarUrl = session.user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            container.innerHTML = `
                <a href="/inv/profile.html" title="Mi Perfil" class="nav-icon"><img src="${avatarUrl}" alt="Avatar"></a>
                <button id="live-logout-btn" class="nav-icon" title="Cerrar Sesión"><i class="fa-solid fa-right-from-bracket"></i></button>
            `;
        } else {
            // Crea un BOTÓN para abrir el modal, no un enlace
            container.innerHTML = `
                <button id="login-modal-trigger" title="Iniciar Sesión" class="nav-icon">
                    <i class="fa-solid fa-right-to-bracket"></i>
                </button>
            `;
        }
    },

    addEventListeners() {
        if(this.elements.themeToggleBtn) {
            this.elements.themeToggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('light-theme');
                localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
            });
        }
        
        this.elements.scheduleList.addEventListener('click', (e) => this.handleCardClick(e));
        this.elements.ondemandListContainer.addEventListener('click', (e) => this.handleCardClick(e));
        this.elements.tabs.forEach(tab => tab.addEventListener('click', (e) => this.handleTabClick(e.currentTarget)));

        // --- INICIO DE LA NUEVA LÓGICA ---
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.addEventListener('click', async (e) => {
                // Para cerrar sesión
                if (e.target.closest('#live-logout-btn')) {
                    await this.supabase.auth.signOut();
                }
                // Para abrir el modal de login
                if (e.target.closest('#login-modal-trigger')) {
                    document.getElementById('login-modal-overlay')?.classList.add('is-visible');
                }
            });
        }

        // Para cerrar el modal
        const loginModalOverlay = document.getElementById('login-modal-overlay');
        const loginModalCloseBtn = document.getElementById('login-modal-close-btn');
        loginModalCloseBtn?.addEventListener('click', () => loginModalOverlay?.classList.remove('is-visible'));
        loginModalOverlay?.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) loginModalOverlay.classList.remove('is-visible');
        });

        // Para iniciar sesión con un proveedor
        loginModalOverlay?.addEventListener('click', async (e) => {
            const providerBtn = e.target.closest('.login-provider-btn');
            if (providerBtn && providerBtn.dataset.provider) {
                await this.supabase.auth.signInWithOAuth({ 
                    provider: providerBtn.dataset.provider,
                    options: { redirectTo: `${window.location.origin}/inv/profile.html` }
                });
            }
        });
        // --- FIN DE LA NUEVA LÓGICA ---

        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.filterCards(e.target.value);
            });
        }

    },

    async run() {
        const [{ data: sessions }, { data: videos }] = await Promise.all([
            // Consulta que ahora pide los perfiles de los participantes
            this.supabase.from('sessions').select(`
                *,
                organizer: profiles (*),
                participants: event_participants ( profiles (*) )
            `).neq('is_archived', true)
                .order('status', { ascending: true })
                .order('scheduled_at', { ascending: false }),
            this.supabase.from('ondemand_videos').select('*').order('created_at', { ascending: false })
        ]);

        const allEvents = sessions || [];
        const onDemandPlaylist = videos || [];
        
        this.allContentMap = {};
        allEvents.forEach(item => this.allContentMap[item.id] = { type: 'EVENT', ...item });
        onDemandPlaylist.forEach(item => this.allContentMap[`video-${item.id}`] = { type: 'VIDEO', ...item });

        this.renderCarousel(allEvents, onDemandPlaylist);
        this.renderSchedule(allEvents);
        this.renderOnDemandList(onDemandPlaylist);
    },

    renderCarousel(events, videos) {
        const liveContent = events.filter(s => s.status === 'EN VIVO');
        this.featuredContent = [...liveContent, ...videos].slice(0, 7);
        if (this.featuredContent.length === 0) {
            this.elements.carouselSection.style.display = 'none';
            return;
        }

        const track = this.elements.carouselSection.querySelector('.carousel-track');
        track.innerHTML = this.featuredContent.map(item => {
            const isEvent = !!item.session_title;
            const data = item;
            const id = isEvent ? data.id : `video-${data.id}`;
            const thumbnailUrl = isEvent ? data.thumbnail_url : `https://i.ytimg.com/vi/${data.youtube_video_id}/hqdefault.jpg`;
            const isLive = isEvent && data.status === 'EN VIVO';
            const autoplay = isLive ? 'autoplay=1&muted=1' : 'autoplay=0';
            let playerUrl = '';
            let infoHTML = '';

            if (isEvent) {
                const channel = data.platform_id || 'epistecnologia';
                
                // --- INICIO DEL FRAGMENTO A REEMPLAZAR ---
                if (data.platform === 'substack') {
                    // Para Substack, no asignamos URL de reproductor para que solo se vea la imagen
                    playerUrl = '';
                } else if (data.platform === 'vdo_ninja') {
                    playerUrl = data.viewer_url;
                } else if (data.platform === 'youtube') {
                    playerUrl = `https://www.youtube.com/embed/${data.platform_id}?enablejsapi=1&${autoplay}`;
                } else { // Twitch por defecto
                    playerUrl = `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&${autoplay}`;
                }
                // --- FIN DEL FRAGMENTO A REEMPLAZAR ---

                infoHTML = isLive ? `
                    <h3>${data.session_title}</h3>
                    <p>${data.organizer.display_name}</p>
                    <button class="blinking-live-btn">EN VIVO: Ir a la sala</button>
                ` : `<h3>${data.session_title}</h3><p>${data.organizer.display_name}</p>`;

            } else {
                playerUrl = `https://www.youtube.com/embed/${data.youtube_video_id}?enablejsapi=1&${autoplay}`;
                infoHTML = `<h3>${data.title}</h3>`;
            }

            return `
                <div class="carousel-slide" data-id="${id}" data-player-url="${playerUrl}" data-thumbnail-url="${thumbnailUrl}">
                    <div class="slide-player"><img src="${thumbnailUrl}" loading="lazy"></div>
                    <div class="slide-info-box">${infoHTML}</div>
                </div>`;
        }).join('');
        
        this.elements.carouselSection.querySelector('.prev').addEventListener('click', () => this.moveSlide(-1));
        this.elements.carouselSection.querySelector('.next').addEventListener('click', () => this.moveSlide(1));
        track.addEventListener('click', (e) => {
             const slide = e.target.closest('.carousel-slide.active');
             if(slide) this.handleCardClick(e);
        });
        this.updateCarouselView();
    },

    moveSlide(direction) {
        const slideCount = this.featuredContent.length;
        if (slideCount <= 1) return;
        this.currentSlideIndex = (this.currentSlideIndex + direction + slideCount) % slideCount;
        this.updateCarouselView();
    },

    updateCarouselView() {
        const track = this.elements.carouselSection.querySelector('.carousel-track');
        const slides = track.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;
        
        slides.forEach((slide, i) => {
            let offset = i - this.currentSlideIndex;
            if (offset < -Math.floor(slides.length / 2)) offset += slides.length;
            if (offset > Math.ceil(slides.length / 2)) offset -= slides.length;
            
            slide.style.transform = `translateX(${offset * 40}%) scale(${1 - Math.abs(offset) * 0.2})`;
            slide.style.opacity = Math.abs(offset) > 1 ? '0.4' : '1';
            slide.style.zIndex = slides.length - Math.abs(offset);
            slide.classList.toggle('active', offset === 0);

            const playerContainer = slide.querySelector('.slide-player');
            const playerUrl = slide.dataset.playerUrl;

            // --- INICIO DE LA CORRECCIÓN ---
            // Solo cargamos el iframe si la URL del reproductor existe
            if (offset === 0 && playerUrl && !playerContainer.querySelector('iframe')) {
                playerContainer.innerHTML = `<iframe src="${playerUrl}" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
            } else if (offset !== 0 && playerContainer.querySelector('iframe')) {
                playerContainer.innerHTML = `<img src="${slide.dataset.thumbnailUrl}" loading="lazy">`;
            }
            // --- FIN DE LA CORRECCIÓN ---
        });
    },

    stopCarouselPlayer() {
        const track = this.elements.carouselSection.querySelector('.carousel-track');
        if (!track) return;
        
        const activeSlide = track.querySelector('.carousel-slide.active');
        if (activeSlide) {
            const playerContainer = activeSlide.querySelector('.slide-player');
            const iframe = playerContainer.querySelector('iframe');
            
            // Si hay un iframe reproduciéndose, lo reemplazamos por la miniatura
            if (iframe) {
                playerContainer.innerHTML = `<img src="${activeSlide.dataset.thumbnailUrl}" loading="lazy">`;
            }
        }
    },

    handleTabClick(clickedTab) {
        this.elements.tabs.forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');
        this.elements.tabContents.forEach(content => content.classList.toggle('active', content.id === clickedTab.dataset.tab));
    },

    handleCardClick(e) {
        const card = e.target.closest('[data-id]');
        if (card && card.dataset.id) this.openLiveRoom(card.dataset.id);
    },

    filterCards(searchTerm) {
        const term = searchTerm.toLowerCase();
        const cards = document.querySelectorAll('.event-card, .video-card');

        cards.forEach(card => {
            const cardText = card.textContent.toLowerCase();
            if (cardText.includes(term)) {
                card.style.display = 'flex'; // O 'block' si prefieres
            } else {
                card.style.display = 'none';
            }
        });
    },
    
    renderSchedule(events) {
        this.elements.scheduleList.innerHTML = events.map(s => {
            const eventDate = new Date(s.scheduled_at);
            const day = eventDate.toLocaleDateString('es-ES', { day: '2-digit' });
            const month = eventDate.toLocaleDateString('es-ES', { month: 'short' });
            const isLive = s.status === 'EN VIVO';
            const liveIndicatorHTML = isLive ? `<div class="card-live-indicator">EN VIVO</div>` : '';
            const thumbnailUrl = s.thumbnail_url || 'https://i.ibb.co/vx57ZyXs/Leonardo-Kino-XL-Diseo-creativo-moderno-y-minimalista-de-una-e-0.jpg';
            const backgroundStyle = `background-image: linear-gradient(to top, rgba(0,0,0,0.95) 20%, transparent 80%), url('${thumbnailUrl}')`;

            return `
            <div class="event-card" data-id="${s.id}">
                <div class="card-background" style="${backgroundStyle}"></div>
                <div class="card-top-info">
                    <div class="card-date">${day} ${month}</div>
                    ${liveIndicatorHTML}
                </div>

                <div class="card-info">
                    <h5>${s.session_title}</h5>
                    <p>${s.organizer?.display_name || ''}</p>
                </div>
            </div>`;
        }).join('');
    },

    renderOnDemandList(videos) {
        this.elements.ondemandListContainer.innerHTML = videos.map(v => `
            <div class="video-card" data-id="video-${v.id}">
                <img src="https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg" alt="${v.title}">
                <p class="video-title">${v.title}</p>
            </div>`).join('');
    },

    openLiveRoom(id) {
        // Detiene cualquier video que se esté reproduciendo en el carrusel
        if (this.updateCarouselView) {
            this.updateCarouselView(); 
        }
        
        const item = this.allContentMap[id];
        if (!item) {
            console.error("Error: No se encontró el item en el mapa con ID:", id);
            return;
        }

        // --- INICIO DEL NUEVO CÓDIGO ROBUSTO ---
        
        // 1. Limpiamos el contenedor de modales
        this.elements.modalContainer.innerHTML = '';

        // 2. Creamos los elementos principales del modal con JavaScript
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'live-room-modal';
        modalOverlay.className = 'modal-overlay';

        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Cerrar');
        
        // 3. Añadimos el listener directamente al botón que acabamos de crear
        closeButton.addEventListener('click', () => this.closeLiveRoom());

        // 4. Construimos el contenido interno de la sala
        const content = this.buildLiveRoomHTML();

        // 5. Unimos todas las partes
        modalOverlay.appendChild(closeButton);
        modalOverlay.appendChild(content);
        
        // 6. Añadimos el modal completo al DOM
        this.elements.modalContainer.appendChild(modalOverlay);

        // 7. Ahora que todo existe, lo poblamos con datos y lo hacemos visible
        this.populateLiveRoom(item);
        setTimeout(() => modalOverlay.classList.add('is-visible'), 10);
        
        // --- FIN DEL NUEVO CÓDIGO ROBUSTO ---
    },

    startCountdown(targetDate) {
        const timerElement = document.getElementById('countdown-timer');
        if (!timerElement) return;

        const targetTime = new Date(targetDate).getTime();

        this.countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetTime - now;

            if (distance < 0) {
                clearInterval(this.countdownInterval);
                timerElement.innerHTML = "El evento debería haber comenzado.";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerElement.innerHTML = `Comienza en: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
    },

    closeLiveRoom() {
        const modalOverlay = document.getElementById('live-room-modal');
        if (modalOverlay) {
            // --- INICIO DE LA CORRECCIÓN ---
            // Buscamos el reproductor dentro del modal y lo vaciamos para detener el video.
            const playerContainer = modalOverlay.querySelector('#live-room-player');
            if (playerContainer) {
                playerContainer.innerHTML = '';
            }
            // --- FIN DE LA CORRECCIÓN ---

            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            
            modalOverlay.classList.remove('is-visible');
            setTimeout(() => {
                this.elements.modalContainer.innerHTML = '';
            }, 300);
        }
    },

    openInvestigatorModal(userId, session) {
        const organizer = session.organizer;
        const participants = session.participants?.map(p => p.profiles) || [];
        const allUsers = [organizer, ...participants].filter(Boolean);
        const user = allUsers.find(u => u && u.id === userId);

        if (!user) {
            console.error("No se encontraron datos para el investigador con ID:", userId);
            return;
        }

        const socialLinksHTML = `
            ${user.website_url ? `<a href="${user.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
            ${user.youtube_url ? `<a href="${user.youtube_url}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
            ${user.substack_url ? `<a href="${user.substack_url}" target="_blank" title="Substack"><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w.org/2000/svg" id="Substack--Streamline-Simple-Icons" height="24" width="24"><desc>Substack Streamline Icon: https://streamlinehq.com</desc><title>Substack</title><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" fill="#e65c17" stroke-width="1"></path></svg></a>` : ''}
            ${user.x_url ? `<a href="${user.x_url}" target="_blank" title="Perfil de X"><i class="fab fa-twitter"></i></a>` : ''}
            ${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" title="Perfil de LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
            ${user.instagram_url ? `<a href="${user.instagram_url}" target="_blank" title="Perfil de Instagram"><i class="fab fa-instagram"></i></a>` : ''}
            ${user.facebook_url ? `<a href="${user.facebook_url}" target="_blank" title="Perfil de Facebook"><i class="fab fa-facebook-f"></i></a>` : ''}
            ${user.tiktok_url ? `<a href="${user.tiktok_url}" target="_blank" title="Perfil de TikTok"><i class="fab fa-tiktok"></i></a>` : ''}
        `;
        
        // --- LÓGICA CORREGIDA PARA EL ENLACE DE ORCID ---
        const orcidHTML = user.orcid 
            ? `<a href="${user.orcid}" target="_blank" rel="noopener noreferrer">${user.orcid.replace('https://orcid.org/', '')}</a>` 
            : 'No disponible';

        const modalHTML = `
            <div id="investigator-modal" class="investigator-modal-overlay">
                <div class="investigator-modal">
                    <header class="investigator-modal-header">
                        <button class="investigator-modal-close-btn">×</button>
                    </header>
                    <main class="investigator-modal-content">
                        <img src="${user.avatar_url}" alt="${user.display_name}" class="avatar">
                        <h3>${user.display_name}</h3>
                        <p><strong>ORCID:</strong> ${orcidHTML}</p>
                        <div class="profile-card__socials">${socialLinksHTML}</div>
                        <p class="investigator-bio">${user.bio || ''}</p>
                        <div class="project-info">
                            <h4>Participa en el proyecto:</h4>
                            <p>${session.project_title || 'N/A'}</p>
                        </div>
                    </main>
                </div>
            </div>`;
        
        this.elements.modalContainer.insertAdjacentHTML('beforeend', modalHTML);
        
        const newModal = document.getElementById('investigator-modal');
        newModal.querySelector('.investigator-modal-close-btn').addEventListener('click', () => this.closeInvestigatorModal());
        newModal.addEventListener('click', (e) => {
            if (e.target === newModal) this.closeInvestigatorModal();
        });
    },

    closeInvestigatorModal() {
        const modal = document.getElementById('investigator-modal');
        if (modal) modal.remove();
    },

    buildLiveRoomHTML() {
        const container = document.createElement('div');
        container.className = 'live-room-content';
        container.innerHTML = `
            <main class="live-room-main">
                <div id="live-room-player" class="live-room-player"></div>
                <div id="live-room-primary-action"></div> 
                <div id="live-room-countdown" class="live-room-countdown" style="display: none;"></div>
                <div id="live-room-investigators-strip" class="live-room-investigators-strip"></div>
                <div id="live-room-info" class="live-room-info"></div>
            </main>
            <aside class="live-room-side">
                <div id="chat-box"></div>
            </aside>`;
        return container;
    },

    populateLiveRoom(item) {
        // 1. Obtenemos las referencias a los contenedores del modal
        const player = document.getElementById('live-room-player');
        const info = document.getElementById('live-room-info');
        const chat = document.getElementById('chat-box');
        const investigators = document.getElementById('live-room-investigators-strip');
        const countdown = document.getElementById('live-room-countdown');
        const primaryAction = document.getElementById('live-room-primary-action');

        // 2. Manejamos si es un Evento o un Video
        if (item.type === 'EVENT') {
            const session = item;
            const eventDate = new Date(session.scheduled_at);
            const dateString = eventDate.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });

            // 3. Lógica del Reproductor y el Chat (Unificada)
            const chatTitle = `<h4><i class="fas fa-comments"></i> Chat ${session.status === 'EN VIVO' ? '<span class="card-live-indicator">EN VIVO</span>' : ''}</h4>`;
            
            // Ocultamos/mostramos contenedores por defecto
            primaryAction.innerHTML = '';
            chat.style.display = 'block';
            investigators.style.display = 'block';
            countdown.style.display = 'none';

            if (session.platform === 'substack') {
                player.innerHTML = `<img src="${session.thumbnail_url || 'https://i.ibb.co/s5s2sYy/Default-Image.png'}" style="width:100%; height:100%; object-fit:cover;">`;
                primaryAction.innerHTML = `<a href="https://open.substack.com/live-stream/${session.platform_id}" target="_blank" rel="noopener noreferrer" class="btn-substack" style="display:block; text-align:center;">Ir a la Sala en Substack</a>`;
                chat.innerHTML = `${chatTitle}<p>El chat para este evento está disponible directamente en Substack.</p>`;
            } else if (session.status === 'EN VIVO') {
                if (session.platform === 'vdo_ninja') {
                    player.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen"></iframe>`;
                    chat.innerHTML = `${chatTitle}<p>El chat no está disponible para esta plataforma.</p>`;
                } else if (session.platform === 'youtube') {
                    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1" allowfullscreen></iframe>`;
                    chat.innerHTML = `${chatTitle}<div id="chat-container"><iframe src="https://www.youtube.com/live_chat?v=${session.platform_id}&embed_domain=${window.location.hostname}"></iframe></div>`;
                } else { // Twitch por defecto
                    const channel = session.platform_id || 'epistecnologia';
                    player.innerHTML = `<iframe src="https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true&muted=true" allowfullscreen></iframe>`;
                    chat.innerHTML = `${chatTitle}<div id="chat-container"><iframe src="https://www.twitch.tv/embed/${channel}/chat?parent=${window.location.hostname}&darkpopout"></iframe></div>`;
                }
            } else { // Eventos Programados o Finalizados (no Substack)
                player.innerHTML = `<img src="${session.thumbnail_url || 'https://i.ibb.co/s5s2sYy/Default-Image.png'}" style="width:100%; height:100%; object-fit:cover;">`;
                chat.innerHTML = `${chatTitle}<p>El chat aparecerá cuando el evento inicie.</p>`;
            }
            
            // 4. Lógica para el Contador
            if (session.status === 'PROGRAMADO' && eventDate > new Date()) {
                countdown.style.display = 'block';
                countdown.innerHTML = '<div id="countdown-timer"></div>';
                this.startCountdown(session.scheduled_at);
            }
            
            // 5. Lógica para el bloque de Información (incluyendo botones dinámicos)
            const organizer = session.organizer;
            const project = organizer?.projects?.find(p => p.title === session.project_title);
            let projectHTML = '';
            if (project) {
                projectHTML = `<p>${project.authors.join(', ')}</p><a href="https://doi.org/${project.doi}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Ver DOI</a>`;
            }
            
            let actionButtonsHTML = '';
            if (session.more_info_url) {
                actionButtonsHTML += `<a href="${session.more_info_url}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:block; text-align:center;">Saber Más</a>`;
            }
            if (session.recording_url) {
                actionButtonsHTML += `<a href="${session.recording_url}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="display:block; margin-top: 1rem; text-align:center;">Ver Grabación</a>`;
            }
            
            info.innerHTML = `
                <h3>${session.session_title}</h3>
                <p><strong>Fecha:</strong> ${dateString}</p>
                <p>${session.description || ''}</p>
                <hr>
                <h4>Organizador</h4>
                <p>${organizer?.display_name || 'N/A'}</p>
                <h4>Proyecto: ${session.project_title || ''}</h4>
                ${projectHTML}
                <div class="action-buttons-container" style="margin-top: 1rem; display:flex; flex-direction:column; gap:1rem;">${actionButtonsHTML}</div>
            `;
            
            // 6. Lógica de Investigadores (se ejecuta para todas las plataformas de eventos)
            const allUsers = [organizer, ...(session.participants?.map(p => p.profiles) || [])].filter(Boolean);
            investigators.innerHTML = allUsers.length > 0 ? `<h4>Investigadores</h4><div class="avatar-grid">${allUsers.map(u => u ? `<img src="${u.avatar_url}" title="${u.display_name}" class="avatar" data-user-id="${u.id}">` : '').join('')}</div>` : '<h4>Investigadores</h4><p>No hay investigadores registrados.</p>';
            investigators.addEventListener('click', (e) => {
                const avatar = e.target.closest('.avatar[data-user-id]');
                if (avatar) this.openInvestigatorModal(avatar.dataset.userId, session);
            });
        
        } else { // Si es un VIDEO On-Demand
            const video = item;
            player.innerHTML = `<iframe src="https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1" allowfullscreen></iframe>`;
            info.innerHTML = `<h3>${video.title}</h3>`;
            investigators.style.display = 'none';
            chat.style.display = 'none';
            countdown.style.display = 'none';
        }
    },

    listenForChanges() {
        this.supabase.channel('public-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                console.log("Cambio detectado, recargando...");
                this.run();
            })
            .subscribe();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    LiveApp.init();
});