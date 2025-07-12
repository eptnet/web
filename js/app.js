/**
 * =========================================================================
 * Script de la Página de Inicio (app.js) - VERSIÓN COMPLETA Y ESTABLE
 * - Restaura el `grid_layout` para un control fácil del orden de los bentos.
 * - Añade un nuevo bento que carga un feed de podcast.
 * - Implementa un reproductor de audio persistente en la parte inferior.
 * - Corrige el comportamiento del botón "atrás" del navegador.
 * =========================================================================
 */

document.addEventListener('mainReady', () => {

    console.log("app.js: Usando sistema de Modal de Inmersión y Reproductor de Podcast.");

    // --- 1. SELECCIÓN DE ELEMENTOS ---
    const bentoGrid = document.getElementById("bento-grid");
    const modalOverlay = document.getElementById('immersion-modal-overlay');
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalShareFooter = document.getElementById('modal-share-footer');
    
    // --- 2. DEFINICIÓN DE MÓDULOS ESTÁTICOS ---
    const staticModules = {
        welcome: `<div class="bento-box 
                            welcome-module 
                            bento-box--3x3 bento-style--flat" 
                            data-id="static-welcome" 
                            style="cursor: default;">
                            <h1>Investiga 
                            </br>Divulga 
                            </br>Entiende el mundo</h1>
                            </br>
                            <p>Te damos la bienvenida a <strong>Epistecnología</strong>, una <strong>plataforma abierta de divulgación científica y cultural</strong> que pone la <strong>tecnología al servicio del conocimiento con Sabiduría</strong>. Aquí, investigadores, docentes, divulgadores y curiosos del saber encuentran un espacio para <strong>crear, compartir y explorar contenidos académicos</strong>, desde artículos y podcasts hasta <strong>videos, transmisiones en vivo y publicaciones indexadas</strong>.</p>
                            <a href="#" class="cta-button" id="welcome-cta-btn">Empezar a Crear</a>
                            </div>`,
        stories: `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/9kDJPK5K/Whisk-7b4dfc4406.jpg'); cursor: pointer; background-size: cover; background-position: center;"><div class="card-content"><span class="card-category" style="color: white;">Colección</span><h4 style="color: white;">Minuto cultural 📺</h4></div></div>`,
        quote: `<div class="bento-box bento-box--1x1 bento-style--flat" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`,
        videoFeatured: `<div class="bento-box bento-box--2x2 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" title="Video destacado de YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
        
        // *** NUEVO MÓDULO DE PODCAST ***
        podcastPlayer: `<div class="bento-box bento-box--1x3 bento-podcast-player mobile-full-width" data-id="static-podcast"><h3>Podcast DiCiencia 🎙️</h3><div class="podcast-episode-list"><p>Cargando episodios...</p></div></div>`,

        inFeed: `<div class="bento-box bento-box--2x2 mobile-full-width bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro newsletter.</p><br/><iframe src="https://eptnews.substack.com/embed" width="100%" height="100%" style="border:0;" frameborder="0" scrolling="no"></iframe></div></div>`,
        end: `<div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div><div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><div class="card-content"><span class="card-category">Ver Ahora</span><h4>El Futuro de la Exploración Espacial</h4></div></div>`
    };

    // --- 3. EL "PLANO DE CONSTRUCCIÓN" DE LA GRID ---
    const grid_layout = [
        { type: 'module', id: 'welcome' },
        { type: 'module', id: 'stories' },  
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' },       
        { type: 'module', id: 'podcastPlayer' },
        { type: 'module', id: 'videoFeatured' },
        { type: 'module', id: 'quote' },  
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'module', id: 'inFeed' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'module', id: 'end' }
    ];

    // --- 4. LÓGICA DE LA APLICACIÓN ---
    const articlesApiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=20';
    const podcastApiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss';
    let allPostsData = [];
    
    async function loadContent() {
        if (!bentoGrid) return;
        bentoGrid.innerHTML = '<div class="loading" style="grid-column: span 4; text-align: center; padding: 2rem;">Cargando...</div>';
        try {
            const [articleResponse, podcastResponse] = await Promise.all([
                fetch(articlesApiUrl),
                fetch(podcastApiUrl)
            ]);
            
            const articleData = await articleResponse.json();
            const podcastData = await podcastResponse.json();

            if (articleData.status === 'ok' && articleData.items) {
                // Filtramos para quitar los posts que son solo audio
                allPostsData = articleData.items.filter(item => !item.enclosure?.link?.endsWith(".mp3"));
                displayContent(allPostsData, podcastData.items);
            } else { throw new Error("API de artículos no respondió correctamente."); }
        } catch (error) {
            console.error("Falló la carga de contenido:", error);
            bentoGrid.innerHTML = '<div class="error" style="grid-column: span 4; text-align: center; padding: 2rem;">No se pudo cargar el contenido.</div>';
        }
    }

    function displayContent(articles, podcasts) {
        bentoGrid.innerHTML = "";
        let postIndex = 0;
        grid_layout.forEach(element => {
            let elementHTML = '';
            if (element.type === 'module') {
                elementHTML = staticModules[element.id];
            } else if (element.type === 'post') {
                const post = articles[postIndex];
                if (post) {
                    elementHTML = createPostCardHTML(post);
                    postIndex++;
                }
            }
            if (elementHTML) bentoGrid.insertAdjacentHTML("beforeend", elementHTML);
        });
        
        if (podcasts && podcasts.length > 0) {
            audioPlayer.setPlaylist(podcasts);
            populatePodcastPlayer(podcasts);
        }
    }
    
    function populatePodcastPlayer(episodes) {
        const listContainer = document.querySelector('.podcast-episode-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        episodes.forEach((episode, index) => {
            const episodeHTML = `
                <div class="podcast-episode" data-index="${index}">
                    <i class="fa-solid fa-play episode-play-icon"></i>
                    <div class="episode-info">
                        <p>${episode.title}</p>
                        <span>${new Date(episode.pubDate).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', episodeHTML);
        });

        listContainer.addEventListener('click', (e) => {
            const episodeDiv = e.target.closest('.podcast-episode');
            if (episodeDiv) {
                const episodeIndex = parseInt(episodeDiv.dataset.index, 10);
                audioPlayer.playEpisode(episodeIndex);
            }
        });
    }

    function createPostCardHTML(item) {
        const thumbnail = item.thumbnail || extractFirstImageUrl(item.content);
        const cardImageStyle = thumbnail ? `style="background-image: url('${thumbnail}');"` : '';
        return `<div class="bento-box post-card bento-box--1x1" data-id="${item.guid}" ${cardImageStyle}><div class="card-content"><span class="card-category">Publicación</span><h4>${item.title}</h4></div></div>`;
    }

    function extractFirstImageUrl(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const img = doc.querySelector("img");
        return img ? img.src : null;
    }

    function truncateText(htmlContent, maxLength) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";
        if (plainText.length <= maxLength) {
            return plainText;
        }
        return plainText.substring(0, maxLength) + '...';
    }

    function sanitizeSubstackContent(htmlString) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        tempDiv.querySelectorAll('.pencraft, .pc-display-flex').forEach(el => el.remove());
        return tempDiv.innerHTML;
    }
    
    function openModal(content, type = 'article', shareConfig = null) {
        if (!modalOverlay || !modalContent) return;
        document.body.dataset.modalType = type;
        modalContent.innerHTML = content;
        if (type === 'stories') {
            modalContainer.classList.add('modal-container--video');
            modalShareFooter.style.display = 'none';
        } else {
            modalContainer.classList.remove('modal-container--video');
            modalShareFooter.style.display = 'flex';
            if (shareConfig) setupShareButtons(shareConfig);
        }
        modalOverlay.classList.add('is-visible');
        document.body.style.overflow = 'hidden';

        if (!history.state?.modalOpen) {
            history.pushState({ modalOpen: true }, '');
        }
    }

    function closeModal() {
        if (!modalOverlay || !modalOverlay.classList.contains('is-visible')) return;
        const type = document.body.dataset.modalType;
        if (type === 'stories') {
            document.dispatchEvent(new CustomEvent('close-shorts-player'));
        }
        modalOverlay.classList.remove('is-visible');
        document.body.style.overflow = '';
        modalContent.innerHTML = '';
        delete document.body.dataset.modalType;
    }

    function setupShareButtons(config) {
        const link = encodeURIComponent(config.link);
        const title = encodeURIComponent(config.title || document.title);
        modalShareFooter.querySelector("#share-fb")?.addEventListener('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`));
        modalShareFooter.querySelector("#share-li")?.addEventListener('click', () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`));
        modalShareFooter.querySelector("#share-wa")?.addEventListener('click', () => window.open(`https://api.whatsapp.com/send?text=${title}%20${link}`));
        modalShareFooter.querySelector("#share-x")?.addEventListener('click', () => window.open(`https://twitter.com/intent/tweet?url=${link}&text=${title}`));
    }

    const audioPlayer = {
        playerElement: document.getElementById('persistent-audio-player'),
        audio: new Audio(),
        playlist: [],
        currentIndex: -1,
        
        playBtn: document.getElementById('player-play-btn'),
        closeBtn: document.getElementById('player-close-btn'),
        forwardBtn: document.getElementById('player-forward-btn'),
        rewindBtn: document.getElementById('player-rewind-btn'),
        timeline: document.getElementById('player-timeline-slider'),
        volumeSlider: document.getElementById('player-volume-slider'),
        
        trackTitle: document.getElementById('player-track-title'),
        trackAuthor: document.getElementById('player-track-author'),
        trackImage: document.getElementById('player-track-image'),
        currentTimeEl: document.getElementById('player-current-time'),
        durationEl: document.getElementById('player-duration'),

        init() {
            this.playBtn.addEventListener('click', () => this.togglePlay());
            this.closeBtn.addEventListener('click', () => this.hide());
            this.forwardBtn.addEventListener('click', () => this.playNext());
            this.rewindBtn.addEventListener('click', () => this.playPrevious());
            this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
            this.audio.addEventListener('timeupdate', () => this.updateTimeline());
            this.audio.addEventListener('loadedmetadata', () => this.updateTimeline());
            this.audio.addEventListener('ended', () => this.playNext());
            this.timeline.addEventListener('input', (e) => { if(this.audio.duration) this.audio.currentTime = (e.target.value / 100) * this.audio.duration; });
        },
        setPlaylist(playlist) {
            this.playlist = playlist;
        },
        playEpisode(index) {
            if (index < 0 || index >= this.playlist.length) return;
            this.currentIndex = index;
            const track = this.playlist[index];
            
            this.audio.src = track.enclosure.link;
            this.trackTitle.textContent = track.title;
            this.trackAuthor.textContent = track.author;
            this.trackImage.src = track.thumbnail;
            this.audio.play();
            this.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.playerElement.classList.add('is-visible');
            this.updatePlayingStatus();
        },
        playNext() {
            this.playEpisode((this.currentIndex + 1) % this.playlist.length);
        },
        playPrevious() {
            const newIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
            this.playEpisode(newIndex);
        },
        togglePlay() {
            if (this.audio.src) {
                if (this.audio.paused) { this.audio.play(); } else { this.audio.pause(); }
                this.playBtn.innerHTML = this.audio.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
                this.updatePlayingStatus();
            }
        },
        setVolume(value) {
            this.audio.volume = value / 100;
        },
        updateTimeline() {
            const formatTime = (secs) => {
                if (isNaN(secs)) return '0:00';
                const minutes = Math.floor(secs / 60);
                const seconds = Math.floor(secs % 60);
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            };
            this.timeline.value = (this.audio.currentTime / this.audio.duration) * 100 || 0;
            this.currentTimeEl.textContent = formatTime(this.audio.currentTime);
            this.durationEl.textContent = formatTime(this.audio.duration);
        },
        updatePlayingStatus() {
            document.querySelectorAll('.podcast-episode').forEach((el, index) => {
                el.classList.toggle('is-playing', index === this.currentIndex);
                const icon = el.querySelector('.episode-play-icon');
                if (icon) {
                    icon.className = (index === this.currentIndex && !this.audio.paused) ? 'fa-solid fa-pause episode-play-icon' : 'fa-solid fa-play episode-play-icon';
                }
            });
        },
        hide() {
            this.audio.pause();
            this.playerElement.classList.remove('is-visible');
            this.updatePlayingStatus();
            this.currentIndex = -1;
        }
    };
    audioPlayer.init();

    function initHero() {
        const heroButton = document.getElementById('scroll-to-content-btn');
        const desktopNav = document.querySelector('.desktop-nav');
        if (heroButton && desktopNav) { heroButton.addEventListener('click', () => { desktopNav.scrollIntoView({ behavior: 'smooth' }); }); }
        if (desktopNav) { const checkNavPosition = () => { desktopNav.classList.toggle('is-at-top', window.scrollY < 50); }; window.addEventListener('scroll', checkNavPosition, { passive: true }); checkNavPosition(); }
    }

    function initMobileNav() {
        const mobileNav = document.querySelector('.mobile-nav');
        if (!mobileNav) return;
        const checkNavPosition = () => { mobileNav.classList.toggle('is-visible', window.scrollY > 50); };
        window.addEventListener('scroll', checkNavPosition, { passive: true });
        checkNavPosition();
    }
    
    bentoGrid?.addEventListener("click", async (event) => {
        const bentoBox = event.target.closest('.bento-box[data-id]');
        const ctaButton = event.target.closest('#welcome-cta-btn');

        // Lógica para el botón CTA
        if (ctaButton) {
            event.preventDefault();
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.user) {
                window.location.href = '/inv/dashboard.html';
            } else {
                document.getElementById('login-modal-trigger')?.click();
            }
            return;
        }

        if (!bentoBox) return;
        const dataId = bentoBox.dataset.id;

        if (dataId === "static-launch-stories") {
            document.dispatchEvent(new CustomEvent('launch-stories'));
        } else if (allPostsData.some(p => p.guid === dataId)) {
            const post = allPostsData.find(p => p.guid === dataId);
            
            // --- INICIO DE LA LÓGICA MODIFICADA ---
            const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
            const excerpt = truncateText(post.content, 800);
            
            // Obtenemos la imagen del post
            const thumbnail = post.thumbnail || extractFirstImageUrl(post.content);
            
            // Creamos una variable para la imagen, solo si existe
            const imageHTML = thumbnail ? `<img src="${thumbnail}" alt="${post.title}" class="modal-post-image">` : '';

            const contentHTML = `
                ${imageHTML} 
                <div class="modal-padded-content">
                    <h2>${post.title}</h2>
                    <div class="post-meta">Publicado por ${post.author} el ${postDate}</div>
                    <div class="post-body">
                        <p>${excerpt}</p>
                    </div>
                    <div class="modal-cta-container">
                        <a href="${post.link}" target="_blank" class="modal-cta-button modal-cta-button--primary">Seguir en EPT News</a>
                        <a href="https://eptnews.substack.com/" target="_blank" class="modal-cta-button">Suscribirse al Newsletter</a>
                    </div>
                </div>
            `;
            // --- FIN DE LA LÓGICA MODIFICADA ---

            openModal(contentHTML, 'article', { link: post.link, title: post.title });
        }
    });

    modalCloseBtn?.addEventListener('click', () => { if (history.state?.modalOpen) history.back(); else closeModal(); });
    modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) { if (history.state?.modalOpen) history.back(); else closeModal(); } });
    document.addEventListener('stories-ready', (e) => { openModal(e.detail.html, 'stories'); });
    window.addEventListener('popstate', (event) => { if (modalOverlay.classList.contains('is-visible')) closeModal(); });

    loadContent();
    initHero();
    initMobileNav();
});
