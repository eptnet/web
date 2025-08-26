const LiveApp = {
    supabase: null,
    elements: {},
    allContentMap: {},
    featuredContent: [],
    currentSlideIndex: 0,
    isApiReady: false,
    countdownInterval: null,
    currentChannel: null,
    viewerCount: 0,
    currentItemInView: null, // <-- [NUEVO] Propiedad para guardar el evento actual en el modal

    init() {
        // --- [MODIFICADO] Guardia de ejecución ---
        if (!document.getElementById('schedule-list')) {
            console.log("LiveApp: No se está en live.html, se detiene la ejecución.");
            return;
        }

        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.cacheDOMElements();
        this.addEventListeners();

        this.supabase.auth.onAuthStateChange((_event, session) => {
            this.renderUserUI(session);
        });
        
        if (window.YT && typeof window.YT.Player === 'function') {
            this.isApiReady = true; this.run();
        } else {
            window.onYouTubeIframeAPIReady = () => { this.isApiReady = true; this.run(); };
        }
        this.listenForChanges();
        this.applyTheme(localStorage.getItem('theme') || 'light');

        // Lógica de Notificaciones
        this.checkForUnreadNotifications();
        this.supabase
            .channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                console.log('¡Nueva notificación recibida en Live!', payload.new);
                this.showNotificationAlert();
            })
            .subscribe();

        this.handleAnchorLink();
    },

    // --- INICIO: FUNCIONES MOVIDAS DENTRO DEL OBJETO ---

    showNotificationAlert() {
        const notificationsIcon = document.getElementById('notifications-bell-icon');
        if (notificationsIcon) {
            notificationsIcon.classList.add('has-notifications');
        }
    },

    async openNotificationsModal() {
        const notificationsIcon = document.getElementById('notifications-bell-icon');
        const notificationsModal = document.querySelector('.notifications-modal') || document.createElement('div');
        if (!notificationsModal.classList.contains('notifications-modal')) {
            notificationsModal.className = 'notifications-modal';
            document.body.appendChild(notificationsModal);
        }

        notificationsIcon?.classList.remove('has-notifications');
        notificationsModal.innerHTML = '<div class="notifications-content"><p>Cargando...</p></div>';
        notificationsModal.classList.add('is-visible');

        const { data, error } = await this.supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !data || data.length === 0) {
            notificationsModal.innerHTML = '<div class="notifications-content"><p>No hay notificaciones nuevas.</p></div>';
            return;
        }

        localStorage.setItem('lastSeenNotificationTimestamp', data[0].created_at);

        const notificationsHTML = data.map(notif => {
            const timeAgo = new Date(notif.created_at).toLocaleString('es-ES');
            return `<a href="${notif.link || '#'}" class="notification-item"><p>${notif.message}</p><span>${timeAgo}</span></a>`;
        }).join('');

        notificationsModal.innerHTML = `<div class="notifications-content"><h3>Últimas Novedades</h3>${notificationsHTML}</div>`;
    },

    async checkForUnreadNotifications() {
        const { data: latestNotification } = await this.supabase
            .from('notifications')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!latestNotification) return;

        const lastSeenTimestamp = localStorage.getItem('lastSeenNotificationTimestamp');
        if (!lastSeenTimestamp || new Date(latestNotification.created_at) > new Date(lastSeenTimestamp)) {
            this.showNotificationAlert();
        }
    },

    handleAnchorLink() {
        if (window.location.hash === '#seccion-eventos') {
            const eventSection = document.getElementById('seccion-eventos');
            const eventTab = document.querySelector('.tab-link[data-tab="agenda-tab"]');
            if (eventTab) {
                this.handleTabClick(eventTab);
            }
            if (eventSection) {
                setTimeout(() => {
                    eventSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    },

    handleDirectLink() {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('sesion');

        if (!sessionId) {
            return;
        }

        const item = this.allContentMap[sessionId] || this.allContentMap[`video-${sessionId}`];

        if (item) {
            this.openLiveRoom(sessionId);
            const newUrl = window.location.pathname;
            history.replaceState({}, '', newUrl);
        } else {
            console.warn(`No se encontró contenido para la sesión con ID: ${sessionId}`);
        }
    },

    // --- FIN: FUNCIONES MOVIDAS DENTRO DEL OBJETO ---

    cacheDOMElements() {
        this.elements = {
            desktopNav: document.querySelector('.desktop-nav'),
            guestViewDesktop: document.getElementById('guest-view'),
            userViewDesktop: document.getElementById('user-view'),
            avatarLinkDesktop: document.getElementById('user-avatar-link'),
            logoutBtnDesktop: document.getElementById('logout-btn-header'),
            themeSwitcherDesktop: document.getElementById('theme-switcher-desktop'),
            mobileMoreBtn: document.getElementById('mobile-more-btn'),
            mobileMoreMenu: document.getElementById('mobile-more-menu'),
            mobileMoreMenuClose: document.getElementById('mobile-more-menu-close'),
            mobileUserActions: document.getElementById('mobile-user-actions'),
            themeSwitcherMobile: document.getElementById('theme-switcher-mobile'),
            overlay: document.getElementById('overlay'),
            loginModalTriggerDesktop: document.getElementById('login-modal-trigger-desktop'),
            loginModalOverlay: document.getElementById('login-modal-overlay'),
            loginModalCloseBtn: document.getElementById('login-modal-close-btn'),
            carouselSection: document.getElementById('featured-carousel-section'),
            scheduleList: document.getElementById('schedule-list'),
            ondemandListContainer: document.getElementById('ondemand-list-container'),
            tabs: document.querySelectorAll('.tab-link'),
            tabContents: document.querySelectorAll('.tab-content'),
            modalContainer: document.getElementById('modal-container'),
            searchInput: document.getElementById('search-input'),
        };
    },
    
    applyTheme(theme) {
        document.body.classList.toggle("dark-theme", theme === "dark");
        const iconClass = theme === "dark" ? "fa-sun" : "fa-moon";
        if (this.elements.themeSwitcherDesktop) this.elements.themeSwitcherDesktop.querySelector('i').className = `fa-solid ${iconClass}`;
        if (this.elements.themeSwitcherMobile) this.elements.themeSwitcherMobile.querySelector('i').className = `fa-solid ${iconClass}`;
    },

    toggleTheme() {
        const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        this.applyTheme(newTheme);
    },
    
    handleOAuthLogin(provider) {
        const redirectTo = `${window.location.origin}/inv/profile.html`;
        this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    },

    renderUserUI(session) {
        const user = session?.user;
        if (this.elements.guestViewDesktop && this.elements.userViewDesktop) {
            if (user) {
                this.elements.guestViewDesktop.style.display = 'none';
                this.elements.userViewDesktop.style.display = 'flex';
                const avatarUrl = user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
                this.elements.avatarLinkDesktop.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
            } else {
                this.elements.guestViewDesktop.style.display = 'flex';
                this.elements.userViewDesktop.style.display = 'none';
            }
        }
        if (this.elements.mobileUserActions) {
            if (user) {
                const avatarUrl = user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
                this.elements.mobileUserActions.innerHTML = `
                    <a href="/inv/profile.html" class="mobile-more-menu__item">
                        <img src="${avatarUrl}" alt="Avatar">
                        <span>Mi Perfil</span>
                    </a>
                    <button id="logout-btn-mobile" class="mobile-more-menu__item">
                        <i class="fa-solid fa-right-from-bracket"></i>
                        <span>Cerrar Sesión</span>
                    </button>
                `;
            } else {
                this.elements.mobileUserActions.innerHTML = `
                    <a href="#" class="mobile-more-menu__item login-provider-btn" data-provider="google">
                        <i class="fa-brands fa-google"></i><span>Iniciar con Google</span>
                    </a>
                    <a href="#" class="mobile-more-menu__item login-provider-btn" data-provider="github">
                        <i class="fa-brands fa-github"></i><span>Iniciar con GitHub</span>
                    </a>
                `;
            }
        }
    },

    addEventListeners() {
        // --- Eventos del Menú ---
        this.elements.themeSwitcherDesktop?.addEventListener("click", () => this.toggleTheme());
        this.elements.themeSwitcherMobile?.addEventListener("click", () => this.toggleTheme());
        
        document.body.addEventListener('click', async (e) => {
            if (e.target.closest('#logout-btn-header') || e.target.closest('#logout-btn-mobile')) {
                await this.supabase.auth.signOut();
            }
            const providerBtn = e.target.closest('.login-provider-btn');
            if (providerBtn?.dataset.provider) this.handleOAuthLogin(providerBtn.dataset.provider);
        });

        this.elements.loginModalTriggerDesktop?.addEventListener('click', () => this.elements.loginModalOverlay?.classList.add('is-visible'));
        this.elements.loginModalCloseBtn?.addEventListener('click', () => this.elements.loginModalOverlay?.classList.remove('is-visible'));
        this.elements.loginModalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.loginModalOverlay) this.elements.loginModalOverlay.classList.remove('is-visible');
        });

        const openMobileMenu = () => { this.elements.mobileMoreMenu?.classList.add('is-visible'); this.elements.overlay?.classList.add('is-visible'); };
        const closeMobileMenu = () => { this.elements.mobileMoreMenu?.classList.remove('is-visible'); this.elements.overlay?.classList.remove('is-visible'); };
        this.elements.mobileMoreBtn?.addEventListener('click', openMobileMenu);
        this.elements.mobileMoreMenuClose?.addEventListener('click', closeMobileMenu);
        this.elements.overlay?.addEventListener('click', closeMobileMenu);

        const notificationsIcon = document.getElementById('notifications-bell-icon');
        notificationsIcon?.addEventListener('click', (e) => { e.preventDefault(); this.openNotificationsModal(); });
        document.addEventListener('click', (e) => {
            const notificationsModal = document.querySelector('.notifications-modal');
            if (notificationsModal && !notificationsModal.contains(e.target) && !notificationsIcon?.contains(e.target)) {
                notificationsModal.classList.remove('is-visible');
            }
        });
        
        // Listeners para elementos estáticos de la página (fuera de los modales)
        this.elements.scheduleList.addEventListener('click', (e) => this.handleCardClick(e));
        this.elements.ondemandListContainer.addEventListener('click', (e) => this.handleCardClick(e));
        this.elements.tabs.forEach(tab => tab.addEventListener('click', () => this.handleTabClick(tab)));
        this.elements.searchInput?.addEventListener('input', (e) => this.filterCards(e.target.value));
        
        // (Aquí puedes mantener los listeners del header, menú móvil, etc., que ya tienes y funcionan)

        // --- Listener de Clics UNIFICADO para el Contenedor Principal de Modales ---
        this.elements.modalContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (!target) return;

            if (target.matches('.emoji-char')) {
                e.preventDefault();
                const textArea = this.elements.modalContainer.querySelector('#chat-form textarea');
                if (textArea && !textArea.disabled) {
                    textArea.value += target.textContent;
                    textArea.focus();
                }
                return;
            }

            // Clic en el botón "Conectar Ahora" para Bluesky
            if (target.id === 'open-bsky-connect-modal') {
                e.preventDefault();
                this.openBskyConnectModal();
                return;
            }

            // Clic en el avatar de un investigador
            const avatar = target.closest('.avatar[data-user-id]');
            if (avatar) {
                this.openInvestigatorModal(avatar.dataset.userId);
                return;
            }

            // Clic en el botón de reportar sesión
            const reportButton = target.closest('button[data-action="report-session"]');
            if (reportButton) {
                this.handleReportSession(reportButton.dataset.sessionId);
                return;
            }
        });

        // --- Listener de Formularios UNIFICADO (solo para el chat) ---
        this.elements.modalContainer.addEventListener('submit', (e) => {
            if (e.target.id === 'chat-form') {
                e.preventDefault();
                this.handleChatMessageSend(e.target, this.currentItemInView.bsky_chat_thread_uri, this.currentItemInView.bsky_chat_thread_cid);
            }
        });
    },
    
    async run() {
        const [{ data: sessions }, { data: videos }] = await Promise.all([
            this.supabase.from('sessions').select(`*, organizer: profiles (*), participants: event_participants ( profiles (*) )`).neq('is_archived', true).order('status', { ascending: true }).order('scheduled_at', { ascending: false }),
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
        this.handleDirectLink();
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
                if (data.platform === 'substack') playerUrl = '';
                else if (data.platform === 'vdo_ninja') playerUrl = data.viewer_url;
                else if (data.platform === 'youtube') playerUrl = `https://www.youtube.com/embed/${data.platform_id}?enablejsapi=1&${autoplay}`;
                else playerUrl = `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&${autoplay}`;
                infoHTML = isLive ? `<h3>${data.session_title}</h3><p>${data.organizer.display_name}</p><button class="blinking-live-btn">EN VIVO: Ir a la sala</button>` : `<h3>${data.session_title}</h3><p>${data.organizer.display_name}</p>`;
            } else {
                playerUrl = `https://www.youtube.com/embed/${data.youtube_video_id}?enablejsapi=1&${autoplay}`;
                infoHTML = `<h3>${data.title}</h3>`;
            }

            return `<div class="carousel-slide" data-id="${id}" data-player-url="${playerUrl}" data-thumbnail-url="${thumbnailUrl}"><div class="slide-player"><img src="${thumbnailUrl}" loading="lazy"></div><div class="slide-info-box">${infoHTML}</div></div>`;
        }).join('');
        
        this.elements.carouselSection.querySelector('.prev').addEventListener('click', () => this.moveSlide(-1));
        this.elements.carouselSection.querySelector('.next').addEventListener('click', () => this.moveSlide(1));
        track.addEventListener('click', (e) => {
             const slide = e.target.closest('.carousel-slide');
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

            if (offset === 0 && playerUrl && !playerContainer.querySelector('iframe')) {
                playerContainer.innerHTML = `<iframe credentialless="true" src="${playerUrl}" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
            } else if (offset !== 0 && playerContainer.querySelector('iframe')) {
                playerContainer.innerHTML = `<img src="${slide.dataset.thumbnailUrl}" loading="lazy">`;
            }
        });
    },

    stopCarouselPlayer() {
        const track = this.elements.carouselSection.querySelector('.carousel-track');
        if (!track) return;

        const iframes = track.querySelectorAll('iframe');

        iframes.forEach(iframe => {
            const playerContainer = iframe.parentElement;
            const slide = playerContainer.closest('.carousel-slide');
            
            if (playerContainer && slide && slide.dataset.thumbnailUrl) {
                playerContainer.innerHTML = `<img src="${slide.dataset.thumbnailUrl}" loading="lazy">`;
            }
        });
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
        document.querySelectorAll('.event-card, .video-card').forEach(card => {
            card.style.display = card.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
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

            return `<div class="event-card" data-id="${s.id}"><div class="card-background" style="${backgroundStyle}"></div><div class="card-top-info"><div class="card-date">${day} ${month}</div>${liveIndicatorHTML}</div><div class="card-info"><h5>${s.session_title}</h5><p>${s.organizer?.display_name || ''}</p></div></div>`;
        }).join('');
    },

    renderOnDemandList(videos) {
        this.elements.ondemandListContainer.innerHTML = videos.map(v => `<div class="video-card" data-id="video-${v.id}"><img src="https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg" alt="${v.title}"><p class="video-title">${v.title}</p></div>`).join('');
    },

    // --- VERSIÓN FINAL Y LIMPIA PARA PRODUCCIÓN ---
    async openLiveRoom(id) {
        if (this.presenceChannel) this.supabase.removeChannel(this.presenceChannel);
        if (this.chatChannel) this.supabase.removeChannel(this.chatChannel);

        const item = this.allContentMap[id];
        if (!item) return;
        this.currentItemInView = item;
        this.viewerCount = 0;
        this.elements.modalContainer.innerHTML = '';

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'live-room-modal';
        modalOverlay.className = 'modal-overlay';
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.closeLiveRoom();
        modalOverlay.appendChild(closeButton);
        modalOverlay.appendChild(this.buildLiveRoomHTML());
        this.elements.modalContainer.appendChild(modalOverlay);

        const presenceChannelName = `session-${item.id}`;
        this.presenceChannel = this.supabase.channel(presenceChannelName);

        this.presenceChannel.on('presence', { event: 'sync' }, () => {
        // 1. Calculamos el nuevo conteo PRIMERO.
        const newCount = Object.keys(this.presenceChannel.presenceState()).length;

        this.viewerCount = newCount;            
        this.updateViewerCountUI();

            // Notificamos al servidor del nuevo recuento de espectadores.
            // Lo envolvemos en un try/catch para que no bloquee la UI si falla.
            this.supabase.functions.invoke('update-viewer-count', {
                body: { sessionId: item.id, viewerCount: newCount }
            }).catch(error => {
                // Este mensaje aparecerá en la consola del NAVEGADOR si la llamada falla.
                console.error('Error al invocar la función update-viewer-count:', error);
            });


        }).subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const { data: { session } } = await this.supabase.auth.getSession();
                await this.presenceChannel.track({ user_id: session?.user?.id || 'invitado' });
            }
        });

        if (item.type === 'EVENT' && item.platform === 'vdo_ninja' && item.bsky_chat_thread_uri) {
            const chatChannelName = `session-chat-${item.id}`;
            this.chatChannel = this.supabase.channel(chatChannelName);
            this.chatChannel.on('broadcast', { event: 'new_chat_message' }, async ({ payload }) => {
                // **CORRECCIÓN PARA MENSAJE DUPLICADO**
                const { data: { session } } = await this.supabase.auth.getSession();
                // Obtenemos el handle del usuario actual desde bsky_credentials para una comparación precisa
                const { data: bskyCreds } = session ? await this.supabase.from('bsky_credentials').select('handle').eq('user_id', session.user.id).single() : { data: null };
                const currentUserHandle = bskyCreds?.handle;

                // Solo añade el mensaje si no es del usuario actual
                if (currentUserHandle !== payload.author.handle) {
                    this.appendChatMessage(payload);
                }
            }).subscribe(status => {
                if (status === 'SUBSCRIBED') console.log(`Conectado al canal de chat: ${chatChannelName}`);
            });
        }
        await this.populateLiveRoom(item);
        setTimeout(() => modalOverlay.classList.add('is-visible'), 10);
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
        if (this.currentChannel) {
            this.supabase.removeChannel(this.currentChannel);
            this.currentChannel = null;
        }
        const modalOverlay = document.getElementById('live-room-modal');
        if (modalOverlay) {
            const playerContainer = modalOverlay.querySelector('#live-room-player');
            if (playerContainer) playerContainer.innerHTML = '';
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            modalOverlay.classList.remove('is-visible');
            setTimeout(() => { this.elements.modalContainer.innerHTML = ''; }, 300);
        }
    },

    updateViewerCountUI() {
        const viewerCountElement = document.getElementById('live-viewer-count');
        if (viewerCountElement) {
            viewerCountElement.innerHTML = `<i class="fas fa-eye"></i> ${this.viewerCount}`;
        }
    },

    async openInvestigatorModal(userId) {
        if (!userId) {
            console.error("ID de usuario no proporcionado.");
            return;
        }
        this.closeInvestigatorModal(); // Cierra cualquier otro modal de investigador abierto

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'investigator-modal';
        modalOverlay.className = 'investigator-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="investigator-modal">
                <header class="investigator-modal-header">
                    <button class="investigator-modal-close-btn">&times;</button>
                </header>
                <main id="investigator-modal-content" class="investigator-modal-content"><p>Cargando...</p></main>
            </div>`;
        
        document.body.appendChild(modalOverlay);
        document.body.style.overflow = 'hidden';

        modalOverlay.querySelector('.investigator-modal-close-btn').addEventListener('click', () => this.closeInvestigatorModal());
        modalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'investigator-modal') {
                this.closeInvestigatorModal();
            }
        });

        setTimeout(() => modalOverlay.classList.add('is-visible'), 10);

        try {
            const { data: user, error: userError } = await this.supabase.from('profiles').select('*').eq('id', userId).single();
            if (userError) throw userError;
            const { data: projects } = await this.supabase.from('projects').select('title').eq('user_id', userId).order('created_at', { ascending: false }).limit(3);
            const modalContent = document.getElementById('investigator-modal-content');
            if (!modalContent) return;

            const socialLinksHTML = `${user.substack_url ? `<a href="${user.substack_url}" target="_blank" title="Substack"><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="24" width="24"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" fill="#e65c17" stroke-width="1"></path></svg></a>` : ''}${user.website_url ? `<a href="${user.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}${user.youtube_url ? `<a href="${user.youtube_url}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}${user.x_url ? `<a href="${user.x_url}" target="_blank" title="Perfil de X"><i class="fab fa-twitter"></i></a>` : ''}${user.linkedin_url ? `<a href="${user.linkedin_url}" target="_blank" title="Perfil de LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}${user.instagram_url ? `<a href="${user.instagram_url}" target="_blank" title="Perfil de Instagram"><i class="fab fa-instagram"></i></a>` : ''}`;
            const orcidHTML = user.orcid ? `<a href="${user.orcid}" target="_blank">${user.orcid.replace('https://orcid.org/','')}</a>` : 'No disponible';
            let projectInfoHTML = projects && projects.length > 0 ? `<div class="project-info"><h4>Últimos proyectos:</h4><ul>${projects.map(p => `<li>${p.title}</li>`).join('')}</ul></div>` : `<div class="project-info"><p>No tiene proyectos publicados.</p></div>`;
            const finalContentHTML = `<img src="${user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${user.display_name || ''}" class="avatar"><h3>${user.display_name || 'Nombre no disponible'}</h3><p><strong>ORCID:</strong> ${orcidHTML}</p><div class="profile-card__socials">${socialLinksHTML}</div><p class="investigator-bio">${user.bio || ''}</p>${projectInfoHTML}`;
            modalContent.innerHTML = finalContentHTML;
        } catch (error) {
            console.error("Error al abrir modal del investigador:", error);
            const modalContent = document.getElementById('investigator-modal-content');
            if (modalContent) { modalContent.innerHTML = "<p>No se pudo cargar la información del investigador.</p>"; }
        }
    },

    closeInvestigatorModal() {
        const modal = document.getElementById('investigator-modal');
        if (modal) {
            modal.classList.remove('is-visible');
            setTimeout(() => {
                modal.remove();
                // Solo restaura el scroll si no queda ningún otro modal abierto
                if (!document.querySelector('.modal-overlay') && !document.getElementById('bsky-connect-modal')) {
                    document.body.style.overflow = '';
                }
            }, 300);
        }
    },

    openBskyConnectModal() {
        // Si ya existe un modal de conexión, no hagas nada para evitar duplicados.
        if (document.getElementById('bsky-connect-modal')) return;

        const template = document.getElementById('bsky-connect-template');
        if (!template) {
            console.error("El template 'bsky-connect-template' no se encuentra en el DOM.");
            alert("Error: No se pudo cargar el componente de conexión. Por favor, recarga la página.");
            return;
        }

        const modalContainer = document.createElement('div');
        modalContainer.id = 'bsky-connect-modal';
        
        const bentoBoxContent = template.content.cloneNode(true);
        const bentoBox = bentoBoxContent.querySelector('.bento-box');

        if (bentoBox) {
            const closeButton = document.createElement('button');
            closeButton.className = 'bsky-modal-close-btn';
            closeButton.innerHTML = '&times;';
            closeButton.setAttribute('aria-label', 'Cerrar');
            // Usamos onclick para una asignación directa y simple
            closeButton.onclick = () => modalContainer.remove();
            bentoBox.prepend(closeButton);
        }
        
        modalContainer.appendChild(bentoBoxContent);
        document.body.appendChild(modalContainer);

        modalContainer.addEventListener('click', (e) => {
            if (e.target.id === 'bsky-connect-modal') {
                modalContainer.remove();
            }
        });

        const form = modalContainer.querySelector('#bsky-connect-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const handle = form.querySelector('#bsky-handle').value;
            const appPassword = form.querySelector('#bsky-app-password').value;
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

            try {
                const { error } = await this.supabase.functions.invoke('bsky-connect-user', { body: { handle, appPassword } });
                if (error) throw error;
                alert("¡Éxito! Tu cuenta de Bluesky ha sido conectada.");
                modalContainer.remove();
                this.populateLiveRoom(this.currentItemInView);
            } catch (err) {
                alert(`Error al conectar: ${err.message}`);
            } finally {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-link"></i> Conectar Cuenta';
            }
        });
    },

    // --- REEMPLAZA ESTA FUNCIÓN CON LA VERSIÓN FINAL ---
    openEmojiModal() {
        if (document.getElementById('emoji-modal')) return;

        const modalContainer = document.createElement('div');
        modalContainer.id = 'emoji-modal';
        modalContainer.innerHTML = `
            <div class="emoji-modal-content">
                <div class="emoji-modal-header">
                    <h3>Seleccionar Emoji</h3>
                    <button class="emoji-modal-close-btn">&times;</button>
                </div>
                <div id="emoji-picker-container"></div>
            </div>
        `;
        document.body.appendChild(modalContainer);
        document.body.style.overflow = 'hidden';

        const closeModal = () => {
            modalContainer.remove();
            document.body.style.overflow = '';
        };

        modalContainer.querySelector('.emoji-modal-close-btn').addEventListener('click', closeModal);
        modalContainer.addEventListener('click', (e) => {
            if (e.target.id === 'emoji-modal') closeModal();
        });

        setTimeout(() => {
            const pickerContainer = document.getElementById('emoji-picker-container');
            if (!pickerContainer) return;
            
            // --- LA CORRECCIÓN ESTÁ AQUÍ ---
            // Se ha eliminado la línea "renderer: new TwemojiRenderer()," para forzar el uso de emojis nativos.
            const picker = picmo.createPicker({
                rootElement: pickerContainer,
                theme: document.body.classList.contains('dark-theme') ? 'dark' : 'light'
            });
            // --- FIN DE LA CORRECCIÓN ---

            picker.addEventListener('emoji:select', (selection) => {
                const textArea = document.querySelector('#chat-form textarea');
                if (textArea) {
                    textArea.value += selection.emoji;
                    textArea.focus();
                }
                closeModal();
            });
        }, 50);
    },

    //------ ORDEN EN EL LIVEROOM ------//
    buildLiveRoomHTML() {
        const container = document.createElement('div');
        container.className = 'live-room-content';
        container.innerHTML = `
            <main class="live-room-main">
                <div id="live-room-player" class="live-room-player"></div>
                <div id="live-room-interaction-area"></div>
                <div id="live-room-primary-action"></div> 
                <div id="live-room-countdown" class="live-room-countdown" style="display: none;"></div>
                <div id="live-room-investigators-strip" class="live-room-investigators-strip"></div>
                <div id="live-room-info" class="live-room-info"></div>                
                <div id="live-room-disclaimer" class="live-room-disclaimer"></div>
                <div id="live-room-report" class="live-room-report"></div>
            </main>
            <aside class="live-room-side">
                <div id="chat-box"></div>
            </aside>`;
        return container;
    },

    async populateLiveRoom(item) {
        const player = document.getElementById('live-room-player');
        const info = document.getElementById('live-room-info');
        const chat = document.getElementById('chat-box');
        const investigators = document.getElementById('live-room-investigators-strip');
        const countdown = document.getElementById('live-room-countdown');
        const primaryAction = document.getElementById('live-room-primary-action');

        // Reseteamos la UI del modal
        primaryAction.innerHTML = '';
        chat.style.display = 'block';
        investigators.style.display = 'block';
        countdown.style.display = 'none';

        if (item.type === 'VIDEO') {
            const video = item;
            investigators.style.display = 'none';
            chat.style.display = 'none';
            countdown.style.display = 'none';
            document.getElementById('live-room-disclaimer').style.display = 'none';
            document.getElementById('live-room-report').style.display = 'none';
            player.innerHTML = `<iframe credentialless="true" src="https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1" allowfullscreen allow="picture-in-picture"></iframe>`;
            info.innerHTML = `<h3>${video.title}</h3><p>${video.description || 'No hay descripción disponible para este video.'}</p>`;
            return;
        }

        // A partir de aquí, es solo para EVENTOS
        const session = item;
        const eventDate = new Date(session.scheduled_at);
        const dateString = eventDate.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
        const chatTitle = `<h4><i class="fas fa-comments"></i> Chat ${session.status === 'EN VIVO' ? `<span class="card-live-indicator">EN VIVO</span> <span id="live-viewer-count" class="viewer-count"><i class="fas fa-eye"></i> ${this.viewerCount}</span>` : ''}</h4>`;

        if (session.status === 'EN VIVO') {
            const channel = session.platform_id || 'epistecnologia';
            if (session.platform === 'vdo_ninja') player.innerHTML = `<iframe credentialless="true" src="${session.viewer_url}" allow="autoplay; fullscreen; picture-in-picture"></iframe>`;
            else if (session.platform === 'youtube') player.innerHTML = `<iframe credentialless="true" src="https://www.youtube.com/embed/${channel}?autoplay=1" allowfullscreen allow="picture-in-picture"></iframe>`;
            else if (session.platform === 'twitch') player.innerHTML = `<iframe credentialless="true" src="https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true&muted=true" allowfullscreen allow="picture-in-picture"></iframe>`;
        } else {
            const thumbnailUrl = session.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
            player.innerHTML = `<img src="${thumbnailUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        }

        if (session.platform === 'vdo_ninja' && session.bsky_chat_thread_uri) this.renderVDONinjaChat(session);
        else if (session.platform === 'substack') {
            primaryAction.innerHTML = `<a href="https://open.substack.com/live-stream/${session.platform_id}" target="_blank" rel="noopener noreferrer" class="btn-substack">Ir a la Sala en Substack</a>`;
            chat.innerHTML = `${chatTitle}<p>El chat para este evento está disponible directamente en Substack.</p>`;
        } else if (session.platform === 'youtube' && session.status === 'EN VIVO') {
            chat.style.cssText = 'display: grid; grid-template-rows: auto 1fr; gap: 1rem;';
            chat.innerHTML = `${chatTitle}<div id="chat-container"><iframe credentialless="true" src="https://www.youtube.com/live_chat?v=${session.platform_id}&embed_domain=${window.location.hostname}"></iframe></div>`;
        } else if (session.platform === 'twitch' && session.status === 'EN VIVO') {
            chat.style.cssText = 'display: grid; grid-template-rows: auto 1fr; gap: 1rem;';
            chat.innerHTML = `${chatTitle}<div id="chat-container"><iframe credentialless="true" src="https://www.twitch.tv/embed/${session.platform_id}/chat?parent=${window.location.hostname}&darkpopout"></iframe></div>`;
        } else {
            chat.innerHTML = `${chatTitle}<p>El chat solo está disponible durante la transmisión en vivo.</p>`;
        }
        
        if (session.status === 'PROGRAMADO' && eventDate > new Date()) {
            countdown.style.display = 'block';
            countdown.innerHTML = '<div id="countdown-timer"></div>';
            this.startCountdown(session.scheduled_at);
        }
        
        let projectHTML = '';
        if (session.project_title && session.organizer?.id) {
            const { data: project } = await this.supabase.from('projects').select('*').eq('user_id', session.organizer.id).eq('title', session.project_title).single();
            if (project) {
                const uniqueAuthors = project.authors && Array.isArray(project.authors) ? [...new Set(project.authors)].join(', ') : 'No disponible';
                const doiLink = project.doi ? `<a href="https://doi.org/${project.doi}" target="_blank" rel="noopener noreferrer" class="doi-badge">Ver Proyecto (DOI)</a>` : '';
                projectHTML = `<h4>Proyecto</h4><h3 class="live-room-project-title">${project.title}</h3><p><strong>Autores:</strong> ${uniqueAuthors}</p><p>${project.description || 'Resumen no disponible.'}</p>${doiLink}`;
            }
        }

        let actionButtonsHTML = '';
        if (session.more_info_url) actionButtonsHTML += `<a href="${session.more_info_url}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:block; text-align:center;">Saber Más</a>`;
        if (session.recording_url) actionButtonsHTML += `<a href="${session.recording_url}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="display:block; margin-top: 1rem; text-align:center;">Ver Grabación</a>`;

        const organizer = session.organizer;
        const organizerHTML = `<div class="organizer-info"><img src="${organizer?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar de ${organizer?.display_name || 'Anfitrión'}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;"><div class="organizer-name-block"><span>Organiza: </span><strong>${organizer?.display_name || 'Nombre no disponible'}</strong></div></div>`;
        info.innerHTML = `<h3>${session.session_title}</h3><p>${session.description || ''}</p>${organizerHTML}<p><strong>Fecha:</strong> ${dateString}</p><hr>${projectHTML}<div class="action-buttons-container" style="margin-top: 1rem; display:flex; flex-direction:column; gap:1rem;">${actionButtonsHTML}</div>`;

        const allUsers = [organizer, ...(session.participants?.map(p => p.profiles) || [])].filter(Boolean);
        investigators.innerHTML = allUsers.length > 0 ? `<h4>Investigadores</h4><div class="avatar-grid">${allUsers.map(u => u ? `<img src="${u.avatar_url}" title="${u.display_name}" class="avatar" data-user-id="${u.id}">` : '').join('')}</div>` : '';
        
        document.getElementById('live-room-disclaimer').innerHTML = `<p>El contenido de esta transmisión es responsabilidad exclusiva de su autor...</p>`;
        document.getElementById('live-room-report').innerHTML = `<button class="report-button" data-action="report-session" data-session-id="${session.id}"><i class="fas fa-flag"></i> Reportar esta sesión</button>`;
    },

    // --- [NUEVO] Funciones Auxiliares del Chat ---
    buildChatInterfaceHTML({ status, canWrite = false, customPrompt = null }) {
        // **CORRECCIÓN PARA RESTAURAR CONTADOR Y LIVE**
        const isLive = status === 'EN VIVO';
        const liveIndicatorHTML = isLive ? `<span class="card-live-indicator">EN VIVO</span> <span id="live-viewer-count" class="viewer-count"><i class="fas fa-eye"></i> ${this.viewerCount}</span>` : '';
        const title = `<h4><i class="fas fa-comments"></i> Chat ${liveIndicatorHTML}</h4>`;

        let placeholder = '';
        if (!isLive) placeholder = 'El chat solo está disponible durante la transmisión en vivo.';
        else if (!canWrite) placeholder = 'Conecta tu cuenta de Bluesky para poder escribir.';
        else placeholder = 'Escribe tu mensaje...';
        const isDisabled = !isLive || !canWrite;

        const emojiBar = `<div id="emoji-bar" class="emoji-bar"> <span class="emoji-char">👍</span><span class="emoji-char">❤️</span><span class="emoji-char">😂</span><span class="emoji-char">👏</span><span class="emoji-char">😮</span><span class="emoji-char">😢</span><span class="emoji-char">🤔</span><span class="emoji-char">🔥</span> </div>`;
        return `<div id="bsky-chat-container">${title}${customPrompt || ''}<div id="chat-messages" class="chat-messages-list"><p class="chat-system-message">Cargando...</p></div>${canWrite && isLive ? emojiBar : ''}<form id="chat-form" class="chat-input-form"><textarea name="chat-message" placeholder="${placeholder}" ${isDisabled ? 'disabled' : ''} required></textarea><button type="submit" class="send-btn" ${isDisabled ? 'disabled' : ''}><i class="fa-solid fa-paper-plane"></i></button></form></div>`;
    },

    async loadAndDisplayChat(threadUri) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        try {
            const { data: chatData, error } = await this.supabase.functions.invoke('bsky-get-post-thread', { body: { postUri: threadUri } });
            if (error) throw error;
            messagesContainer.innerHTML = '';
            if(chatData.anchorPost) this.appendChatMessage(chatData.anchorPost, true);
            if(chatData.messages) chatData.messages.forEach(message => this.appendChatMessage(message));
        } catch (error) {
            messagesContainer.innerHTML = `<p class="chat-system-message error">No se pudo cargar el chat.</p>`;
            console.error(error);
        }
    },

    async handleChatMessageSend(form, threadUri, threadCid) {
        const textArea = form.querySelector('textarea');
        const button = form.querySelector('button');
        const replyText = textArea.value.trim();
        if (!replyText) return;
        button.disabled = true;
        
        const { data: { session } } = await this.supabase.auth.getSession();
        const { data: userProfile } = session ? await this.supabase.from('profiles').select('display_name, avatar_url').eq('id', session.user.id).single() : { data: null };
        const { data: bskyCreds } = session ? await this.supabase.from('bsky_credentials').select('handle').eq('user_id', session.user.id).single() : { data: null };
        
        const optimisticMessage = {
            author: {
                avatar: userProfile?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
                displayName: userProfile?.display_name || 'Tú',
                handle: bskyCreds?.handle || '',
            },
            record: { text: replyText },
        };
        this.appendChatMessage(optimisticMessage);
        textArea.value = '';

        try {
            await this.supabase.functions.invoke('bsky-create-reply', { body: { replyText, parentPost: { uri: threadUri, cid: threadCid } } });
        } catch (error) {
            alert("No se pudo enviar tu mensaje. Por favor, inténtalo de nuevo.");
            console.error(error);
        } finally {
            button.disabled = false;
        }
    },

    appendChatMessage(message, isAnchor = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer || !message || !message.author || !message.record) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = isAnchor ? 'chat-message anchor-post' : 'chat-message';
        messageDiv.innerHTML = `
            <img src="${message.author.avatar}" alt="avatar" class="chat-avatar">
            <div class="chat-message-content">
                <div class="chat-author"><strong>${message.author.displayName}</strong> <span class="chat-handle">@${message.author.handle}</span></div>
                <p>${message.record.text.replace(/\n/g, '<br>')}</p>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    // Esta función ahora contiene toda la lógica de roles para el chat
    async renderVDONinjaChat(session) {
        const chatContainer = document.getElementById('chat-box');
        if (!chatContainer) return;

        const { data: { session: authSession } } = await this.supabase.auth.getSession();

        if (!authSession) {
            // Caso 1: Visitante
            chatContainer.innerHTML = `
                <div class="chat-login-prompt">
                    <h4><i class="fas fa-comments"></i> Chat del Evento</h4>
                    <p>Inicia sesión o regístrate para ver y participar en el chat.</p>
                    <div class="login-options">
                        <a href="#" class="login-provider-btn" data-provider="google"><i class="fa-brands fa-google"></i><span>Continuar con Google</span></a>
                        <a href="#" class="login-provider-btn" data-provider="github"><i class="fa-brands fa-github"></i><span>Continuar con GitHub</span></a>
                    </div>
                </div>
            `;
        } else {
            // Caso 2 y 3: Usuario registrado
            const { data: bskyCreds } = await this.supabase
                .from('bsky_credentials')
                .select('handle')
                .eq('user_id', authSession.user.id)
                .single();

            const hasBskyCreds = !!bskyCreds;

            if (hasBskyCreds) {
                // Caso 3: Registrado y con Bluesky conectado
                chatContainer.innerHTML = this.buildChatInterfaceHTML({
                    status: session.status,
                    canWrite: true
                });
                this.loadAndDisplayChat(session.bsky_chat_thread_uri);
            } else {
                // Caso 2: Registrado pero sin Bluesky conectado
                const connectPrompt = `<div class="chat-action-prompt"><p>¡Conecta tu cuenta de Bluesky para chatear!</p><button id="open-bsky-connect-modal" class="btn-secondary">Conectar Ahora</button></div>`;
                chatContainer.innerHTML = this.buildChatInterfaceHTML({
                    status: session.status,
                    canWrite: false,
                    customPrompt: connectPrompt
                });
                // Volvemos a cargar los mensajes para el modo de solo lectura.
                this.loadAndDisplayChat(session.bsky_chat_thread_uri);
            }
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