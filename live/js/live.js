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
        };
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
    },

    async run() {
        const [{ data: sessions }, { data: videos }] = await Promise.all([
            // Consulta ultra-estable: solo pide lo necesario para la vista principal.
            this.supabase.from('sessions').select(`*, organizer: profiles (*)`).neq('is_archived', true).order('status', { ascending: true }).order('scheduled_at', { ascending: false }),
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
            const autoplay = isLive ? 'autoplay=true&muted=true' : 'autoplay=0';
            let playerUrl = '';
            let infoHTML = '';

            if (isEvent) {
                const channel = data.platform_id || 'epistecnologia';
                playerUrl = (data.platform === 'vdo_ninja') ? data.viewer_url : `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&${autoplay}`;
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
                    <div class="slide-player">
                        <img src="${thumbnailUrl}" loading="lazy" alt="Miniatura del video">
                    </div>
                    <div class="slide-info-box">
                        ${infoHTML}
                    </div>
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
            if (offset === 0 && !playerContainer.querySelector('iframe')) {
                playerContainer.innerHTML = `<iframe src="${slide.dataset.playerUrl}" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
            } else if (offset !== 0 && playerContainer.querySelector('iframe')) {
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
    
    renderSchedule(events) {
        this.elements.scheduleList.innerHTML = events.map(s => {
            const eventDate = new Date(s.scheduled_at);
            const day = eventDate.toLocaleDateString('es-ES', { day: '2-digit' });
            const month = eventDate.toLocaleDateString('es-ES', { month: 'short' });
            const isLive = s.status === 'EN VIVO';

            // Genera el indicador de EN VIVO solo si corresponde
            const liveIndicatorHTML = isLive 
                ? `<div class="card-live-indicator">EN VIVO</div>` 
                : '';

            return `
            <div class="event-card" data-id="${s.id}">
                <div class="card-background" style="background-image: url('${s.thumbnail_url}')"></div>
                
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

    closeLiveRoom() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        const modalOverlay = document.getElementById('live-room-modal');
        if (modalOverlay) {
            modalOverlay.classList.remove('is-visible');
            setTimeout(() => { this.elements.modalContainer.innerHTML = ''; }, 300);
        }
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

    openInvestigatorModal(userId, session) {
        const organizer = session.organizer;
        const participants = session.participants?.map(p => p.profiles) || [];
        const allUsers = [organizer, ...participants].filter(Boolean);
        const user = allUsers.find(u => u && u.id === userId);

        if (!user) {
            console.error("No se encontraron datos para el investigador con ID:", userId);
            return;
        }

        const modalHTML = `
            <div id="investigator-modal" class="investigator-modal-overlay">
                <div class="investigator-modal">
                    <header class="investigator-modal-header">
                        <button class="investigator-modal-close-btn">×</button>
                    </header>
                    <main class="investigator-modal-content">
                        <img src="${user.avatar_url}" alt="${user.display_name}" class="avatar">
                        <h3>${user.display_name}</h3>
                        <p><strong>ORCID:</strong> ${user.orcid || 'No disponible'}</p>
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
                <div id="live-room-player" class="live-room-player">
                    </div>
                <div class="live-room-scrollable-content">
                    <div id="live-room-investigators-strip" class="live-room-investigators-strip">
                    </div>
                    </br>
                    <div id="live-room-info" class="live-room-info">
                    </div>
                </div>
            </main>
            <aside class="live-room-side">
                <div id="chat-box"></div>
            </aside>`;
        return container;
    },

    populateLiveRoom(item) {
        console.log("Poblando modal con el siguiente item:", item); // Línea de depuración

        const player = document.getElementById('live-room-player');
        const info = document.getElementById('live-room-info');
        const chat = document.getElementById('chat-box');
        const investigators = document.getElementById('live-room-investigators-strip');

        // Ocultamos estas secciones por defecto, las llenaremos después si hay datos
        investigators.style.display = 'none';
        chat.style.display = 'flex';

        if (item.type === 'EVENT') {
            const session = item;
            const eventDate = new Date(session.scheduled_at);

            if (session.status === 'EN VIVO') {
                // --- LÓGICA CORREGIDA PARA SELECCIONAR EL REPRODUCTOR ---
                if (session.platform === 'vdo_ninja') {
                    player.innerHTML = `<iframe src="${session.viewer_url}" allow="autoplay; fullscreen"></iframe>`;
                } else if (session.platform === 'youtube') {
                    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${session.platform_id}?autoplay=1" allowfullscreen></iframe>`;
                } else { // Twitch por defecto
                    const channel = session.platform_id || 'epistecnologia';
                    player.innerHTML = `<iframe src="https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true&muted=true" allowfullscreen></iframe>`;
                }
                chat.innerHTML = `<h4><i class="fas fa-comments"></i> Chat</h4><div id="chat-container"><iframe src="https://www.twitch.tv/embed/${session.platform_id || 'epistecnologia'}/chat?parent=${window.location.hostname}&darkpopout"></iframe></div>`;
            } else {
                player.innerHTML = `<img src="${session.thumbnail_url}" style="width:100%; height:100%; object-fit:cover;">`;
                chat.innerHTML = `<h4><i class="fas fa-comments"></i> Chat</h4><p>El chat aparecerá cuando el evento inicie.</p>`;
            }
            
            const organizer = session.organizer;
            let projectHTML = '';
            if (organizer?.projects && session.project_title) {
                 const project = organizer.projects.find(p => p.title === session.project_title);
                 if (project && project.doi) {
                    projectHTML = `<p>${project.authors.join(', ')}</p><a href="https://doi.org/${project.doi}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Ver DOI</a>`;
                 }
            }
            const dateString = eventDate.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
            const countdownHTML = session.status === 'PROGRAMADO' && eventDate > new Date()
                ? `<div id="countdown-timer"></div>`
                : '';

            info.innerHTML = `
                <h3>${session.session_title}</h3>
                <p>${session.description || ''}</p>
                <hr>
                <h4>Organizador</h4>
                <p>${organizer?.display_name || 'N/A'}</p>
                <h4>Proyecto: ${session.project_title || ''}</h4>
                ${projectHTML}
                `;

             // 3. Activa el contador si es necesario
            if (session.status === 'PROGRAMADO' && eventDate > new Date()) {
                this.startCountdown(session.scheduled_at);
            }
            
            const allUsers = [organizer, ...(session.participants?.map(p => p.profiles) || [])].filter(Boolean);
            if (allUsers.length > 0) {
                investigators.style.display = 'block';
                investigators.innerHTML = `<h4>Investigadores</h4><div class="avatar-grid">${allUsers.map(u => u ? `<img src="${u.avatar_url}" title="${u.display_name}" class="avatar" data-user-id="${u.id}">` : '').join('')}</div>`;
                investigators.addEventListener('click', (e) => {
                    const avatar = e.target.closest('.avatar[data-user-id]');
                    if (avatar) this.openInvestigatorModal(avatar.dataset.userId, session);
                });
            } else {
                investigators.style.display = 'none';
            }
        
        } else {
            const video = item;
            player.innerHTML = `<iframe src="https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1" allowfullscreen></iframe>`;
            info.innerHTML = `<h3>${video.title}</h3>`;
            investigators.style.display = 'none';
            chat.style.display = 'none';
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