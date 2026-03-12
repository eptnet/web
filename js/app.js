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
                            <h1>Crea
                            </br>Divulga
                            </br>Comparte</h1>
                            </br>
                            <p>Te damos la bienvenida a <strong>Epistecnología</strong>, 
                            una <strong>plataforma abierta de divulgación científica y cultural</strong> 
                            que pone la <strong>tecnología al servicio del conocimiento con Sabiduría</strong>. 
                            Aquí, investigadores, docentes, divulgadores y curiosos del saber encuentran un 
                            espacio para <strong>crear, explorar y compartir contenidos académicos y culturales.</strong> 
                            </br>
                            <strong>Como investigador,</strong> únete y crea desde artículos, poster, podcasts hasta 
                            <strong>videos, eventos híbridos, transmisiones en vivo y mucho más, dales un DOI y haz 
                            que tus creaciones sean citables.</strong>
                            </p>
                            <a href="#" class="cta-button" id="welcome-cta-btn">Divulgador, a Crear 🚀</a>
                            </div>`,
        stories: `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/9kDJPK5K/Whisk-7b4dfc4406.jpg'); cursor: pointer; background-size: cover; background-position: center;"><div class="card-content"><span class="card-category" style="color: white;">Colección</span><h4 style="color: white;">Minuto cultural 📺</h4></div></div>`,
        quote: `<div class="bento-box bento-box--4x1 bento-style--flat mobile-full-width" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`,
        videoFeatured: `<div class="bento-box bento-box--3x3 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" title="Video destacado de YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
        
        // *** NUEVO MÓDULO DE PODCAST ***
        // DESPUÉS
        podcastPlayer: `
            <div class="bento-box bento-box--1x3 bento-podcast-player mobile-full-width" data-id="static-podcast">
                <div class="podcast-header">
                    <h3>Podcast DiCiencia 🎙️</h3>
                    <div class="waveform-placeholder">
                        <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                    </div>
                </div>
                <div class="podcast-episode-list">
                    <p>Cargando episodios...</p>
                </div>
                <div class="podcast-footer">
                    <a href="https://eptnews.substack.com/s/diciencias" target="_blank" rel="noopener noreferrer" class="podcast-cta-button">Seguir escuchando</a>
                </div>
            </div>`,

        // DESPUÉS
        logos: `
            <div class="bento-box bento-box--4x1 mobile-full-width logo-ticker-bento" data-id="static-logos">
                <div class="logo-ticker-track">
                    <div class="ticker-row">
                        <img src="https://i.ibb.co/3V9MS9N/1024px-Universita-t-Potsdam-logo-svg.png" alt="Universität Potsdam">
                        <img src="https://i.ibb.co/QF67Hyr9/BMZ-Logo.png" alt="BMZ">
                        <img src="https://i.ibb.co/RpLcpmxT/Culture-logo.png" alt="Culture & Cooperation">
                        <img src="https://i.ibb.co/Xr0YxR2g/DAAD-LOGO-100-an-os.png" alt="DAAD">
                        <img src="https://i.ibb.co/k2j629Mh/HRKEFM16.gif" alt="HRK">
                        
                        <img src="https://i.ibb.co/3V9MS9N/1024px-Universita-t-Potsdam-logo-svg.png" alt="Universität Potsdam">
                        <img src="https://i.ibb.co/QF67Hyr9/BMZ-Logo.png" alt="BMZ">
                        <img src="https://i.ibb.co/RpLcpmxT/Culture-logo.png" alt="Culture & Cooperation">
                        <img src="https://i.ibb.co/Xr0YxR2g/DAAD-LOGO-100-an-os.png" alt="DAAD">
                        <img src="https://i.ibb.co/k2j629Mh/HRKEFM16.gif" alt="HRK">
                    </div>
                    <div class="ticker-row reverse">
                        <img src="https://i.ibb.co/1YLf7HsJ/Logo-DIES-MOI-sin-10-an-os.png" alt="DIES MOI">
                        <img src="https://i.ibb.co/NdGH67sg/NMT-Logo2021.jpg" alt="NMT">
                        <img src="https://i.ibb.co/39j2mnth/U-Austral-de-Chile.png" alt="Universidad Austral de Chile">
                        <img src="https://i.ibb.co/4RYrHfSR/UCSP-en-letras-negras-Arequipa-1.png" alt="UCSP">

                        <img src="https://i.ibb.co/1YLf7HsJ/Logo-DIES-MOI-sin-10-an-os.png" alt="DIES MOI">
                        <img src="https://i.ibb.co/NdGH67sg/NMT-Logo2021.jpg" alt="NMT">
                        <img src="https://i.ibb.co/39j2mnth/U-Austral-de-Chile.png" alt="Universidad Austral de Chile">
                        <img src="https://i.ibb.co/4RYrHfSR/UCSP-en-letras-negras-Arequipa-1.png" alt="UCSP">
                    </div>
                </div>
            </div>`,
        
            subs: `
                <div class="bento-box bento-box--2x3 mobile-full-width bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;">
                    <div class="card-content">
                        <h3>Nuestro cóntenido en tu email</h3
                        <p>Suscríbete a la revista.</p>
                        <br/>
                        <iframe src="https://publicaciones.epistecnologia.com/embed" 
                            width="100%" 
                            height="50%" 
                            style="border:1px solid #EEE; background:white;" 
                            frameborder="0" scrolling="no">
                        </iframe>
                    </div>
                </div>`,
                
            zenodo: `
                <div class="bento-box zenodo-module bento-box--2x3 mobile-full-width" data-id="static-zenodo" style="background-image: url('https://i.ibb.co/x8JbV61H/a-futuristic-digital-artwork-depicting-a-k9-Jb0c-3-R0u8by-Ev-GGOrw-x-Ait-Jamg-RCat9-GLc-O810jg.jpg'); cursor: pointer;">
                    <div class="card-content">
                        <h3>Únete a la Comunidad</h3>
                        <p>Publica tus trabajos, obtén un DOI y forma parte de nuestro ecosistema de conocimiento abierto.</p>
                    </div>
                </div>`,

            // Un placeholder que llenaremos dinámicamente con el próximo evento
            nextEventPlaceholder: `<div class="bento-box bento-box--4x3 mobile-full-width" id="next-event-bento"></div>`,

            // Un bento estático para la llamada a la acción de Substack
            allPostsCTA: `
                <div class="bento-box bento-box--4x3 bento-substack-featured mobile-full-width" 
                    data-url="https://publicaciones.substack.com/" 
                    style="background-image: url('https://i.ibb.co/hJ5jsbv9/Leonardo-Phoenix-10-A-vibrant-and-dynamic-scene-depicting-the-2.jpg'); cursor: pointer;">
                    <div class="card-content">
                        <div class="featured-text">
                            <h4>Explora Todas Nuestras Publicaciones</h4>
                            <p>Lee todos nuestros artículos, investigaciones y posts directamente en EPT News.</p>
                        </div>
                        <span class="cta-button">
                            <i class="fa-solid fa-arrow-right"></i> Ir a Substack
                        </span>
                    </div>
                </div>
            `,

            end: `
                <div class="bento-box bento-box--4x1 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ">
                    <div class="card-content">
                        <span class="card-category">Ver Ahora</span>
                        <h4>El Futuro de la Exploración Espacial</h4>
                    </div>
                </div>`
    };

    // --- 3. EL "PLANO DE CONSTRUCCIÓN" DE LA GRID ---
    const grid_layout = [

        { type: 'module', id: 'nextEventPlaceholder' }, // <-- NUEVO EVENTO AQUÍ

        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' },

        { type: 'module', id: 'welcome' },
        { type: 'module', id: 'podcastPlayer' },
        
        { type: 'module', id: 'zenodo' },
        { type: 'module', id: 'subs' },
        
        { type: 'module', id: 'stories' },
        { type: 'module', id: 'videoFeatured' },
        { type: 'module', id: 'quote' },

        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' },
        { type: 'module', id: 'allPostsCTA' }, // <-- NUEVO CTA AQUÍ
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' }, 
        { type: 'post' },

        { type: 'module', id: 'logos' },
        { type: 'module', id: 'end' }
    ];

    // --- 4. LÓGICA DE LA APLICACIÓN ---
    const articlesApiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=15';
    const podcastApiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss';
    let allPostsData = [];
    
    // Guardaremos los perfiles aquí para no tener que pedirlos de nuevo
    let researcherProfiles = [];

    async function loadContent() {
        if (!bentoGrid) return;
        bentoGrid.innerHTML = '<div class="loading" style="grid-column: span 4; text-align: center; padding: 2rem;">Cargando...</div>';
        
        try {
            // --- INICIO DE LA LÓGICA MEJORADA ---
            // 1. Hacemos las tres peticiones en paralelo para máxima eficiencia
            const [articleResponse, podcastResponse, profilesResponse] = await Promise.all([
                fetch(articlesApiUrl),
                fetch(podcastApiUrl),
                // Petición a nuestra base de datos para traer los perfiles
                window.supabaseClient
                    .from('profiles')
                    .select('display_name, avatar_url, orcid, substack_author_name') // Traemos los campos que necesitamos
            ]);
            
            // 2. Procesamos los datos de los perfiles
            if (profilesResponse.error) throw profilesResponse.error;
            researcherProfiles = profilesResponse.data || [];
            console.log("Directorio de investigadores cargado:", researcherProfiles.length, "perfiles encontrados.");
            // --- FIN DE LA LÓGICA MEJORADA ---

            const articleData = await articleResponse.json();
            const podcastData = await podcastResponse.json();

            if (articleData.status === 'ok' && articleData.items) {
                allPostsData = articleData.items.filter(item => !item.enclosure?.link?.endsWith(".mp3"));
                displayContent(allPostsData, podcastData.items);
            } else { 
                throw new Error("API de artículos no respondió correctamente."); 
            }
        } catch (error) {
            console.error("Falló la carga de contenido o perfiles:", error);
            bentoGrid.innerHTML = '<div class="error" style="grid-column: span 4; text-align: center; padding: 2rem;">No se pudo cargar el contenido.</div>';
        }
    }

    function displayContent(articles, podcasts) {
        bentoGrid.innerHTML = "";
        let postIndex = 0;

        // 1. Creamos el HTML de la cuadrícula, igual que antes.
        //    Los bloques estarán invisibles por defecto gracias al CSS (opacity: 0).
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

        // --- INICIO DE LA NUEVA LÓGICA CON INTERSECTION OBSERVER ---

        // 2. Función que se ejecutará cuando la cuadrícula sea visible.
        const animateBentoGrid = () => {
            const bentoBoxes = bentoGrid.querySelectorAll('.bento-box');
            bentoBoxes.forEach((box, index) => {
                // Aumentamos el retraso para una animación más pausada.
                box.style.animationDelay = `${index * 100}ms`; // Retraso de 100ms entre bloques.
                box.classList.add('is-visible');
            });
        };

        // 3. Creamos un "observador" que vigile la cuadrícula (bentoGrid).
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // Si la cuadrícula está en la pantalla (isIntersecting es true)...
                if (entry.isIntersecting) {
                    // ...lanzamos la animación.
                    animateBentoGrid();
                    // ...y dejamos de observar para que no se repita.
                    observer.unobserve(bentoGrid);
                }
            });
        }, { threshold: 0.1 }); // Se activa cuando al menos el 10% del grid es visible.

        // 4. Le decimos al observador que empiece a vigilar nuestro bentoGrid.
        observer.observe(bentoGrid);
        
        // --- FIN DE LA NUEVA LÓGICA ---

        if (podcasts && podcasts.length > 0) {
            audioPlayer.setPlaylist(podcasts);
            populatePodcastPlayer(podcasts);
        }

        loadNextEvent();
    }

    // AÑADE ESTAS DOS FUNCIONES NUEVAS en app.js

    function createNextEventHTML(session) {
        const eventDate = new Date(session.scheduled_at);
        const day = eventDate.getDate();
        const month = eventDate.toLocaleDateString('es-ES', { month: 'long' });
        const weekday = eventDate.toLocaleDateString('es-ES', { weekday: 'long' });
        // Forzamos el formato de 24h para evitar confusiones
        const time = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

        let eventType = 'PRÓXIMO EVENTO';
        let statusText = `Inicia: ${weekday}, ${time}h`;
        const now = new Date();

        if (session.status === 'EN VIVO') {
            eventType = '<span class="live-indicator">AHORA EN VIVO</span>';
        } else if (eventDate < now) {
            eventType = 'EVENTO FINALIZADO';
            statusText = 'Esta sesión ha concluido';
        }
        
        // Fallback por si no hay imagen en la base de datos
        const thumbnailUrl = session.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';

        return `
            <div class="bento-next-event" style="background-image: linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.7)), url('${thumbnailUrl}');">
                <div class="event-date-box">
                    <div class="event-type">${eventType}</div>
                    <div class="date-day">${day}</div>
                    <div class="date-month">${month}</div>
                </div>
                <div class="event-details">
                    <div>
                        <h4>${session.session_title}</h4>
                        <p class="event-description">${session.description || ''}</p>
                        <p class="event-time-info">${statusText}</p>
                    </div>
                    <a href="/live.html?sesion=${session.id}" class="cta-button">Ir al Evento</a>
                </div>
            </div>
        `;
    }

    async function loadNextEvent() {
        if (!window.supabaseClient) return;
        const bentoContainer = document.getElementById('next-event-bento');
        if (!bentoContainer) return;

        // 1. Buscamos primero si hay un evento EN VIVO justo ahora
        let { data: liveEvent } = await window.supabaseClient
            .from('sessions')
            .select('*')
            .eq('is_archived', false)
            .eq('status', 'EN VIVO')
            .order('scheduled_at', { ascending: false })
            .limit(1)
            .single();

        if (liveEvent) {
            bentoContainer.innerHTML = createNextEventHTML(liveEvent);
            bentoContainer.classList.add('is-visible');
            bentoContainer.style.display = 'block';
            return;
        }

        // 2. Si no hay evento en vivo, buscamos uno PROGRAMADO estictamente en el FUTURO
        const nowIso = new Date().toISOString();
        let { data: nextEvent } = await window.supabaseClient
            .from('sessions')
            .select('*')
            .eq('is_archived', false)
            .eq('status', 'PROGRAMADO')
            .gte('scheduled_at', nowIso) // ¡Solo fechas mayores a AHORA!
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .single();

        if (nextEvent) {
            bentoContainer.innerHTML = createNextEventHTML(nextEvent);
            bentoContainer.classList.add('is-visible');
            bentoContainer.style.display = 'block';
        } else {
            // 3. Si no hay nada en vivo ni en el futuro, ocultamos completamente el bloque
            bentoContainer.style.display = 'none';
            bentoContainer.innerHTML = '';
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
        
        // --- LÍNEA AÑADIDA ---
        // Creamos un extracto de 100 caracteres a partir del contenido del post.
        const sourceText = item.description || item.content;
        const excerpt = truncateText(sourceText, 200);

        return `
            <div class="bento-box post-card bento-box--1x1 mobile-full-width" data-id="${item.guid}" ${cardImageStyle}>
                <div class="card-content">
                    <span class="card-category">Publicación</span>
                    <h4>${item.title}</h4>
                    
                    <p class="card-excerpt">${excerpt}</p>
                    
                </div>
            </div>
        `;
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

        setTimeout(() => {
            modalContent.scrollTop = 0;
        }, 0);

        if (type === 'stories') {
            modalContainer.classList.add('modal-container--video');
            modalShareFooter.style.display = 'none';
        } else {
            modalContainer.classList.remove('modal-container--video');
            modalShareFooter.style.display = 'flex';
            // --- INICIO DEL CAMBIO ---
            // Ahora guardamos la información en el propio elemento del footer
            if (shareConfig) {
                modalShareFooter.dataset.shareLink = shareConfig.link;
                modalShareFooter.dataset.shareTitle = shareConfig.title;
            } else {
                // Limpiamos por si el contenido no tiene nada que compartir
                delete modalShareFooter.dataset.shareLink;
                delete modalShareFooter.dataset.shareTitle;
            }
            // --- FIN DEL CAMBIO ---
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

    // Lógica centralizada para los botones de compartir
    modalShareFooter?.addEventListener('click', (e) => {
        const shareButton = e.target.closest('.share-btn');
        if (!shareButton) return; // Si no se hizo clic en un botón, no hacemos nada

        const service = shareButton.dataset.sharer;
        const link = encodeURIComponent(modalShareFooter.dataset.shareLink || window.location.href);
        const title = encodeURIComponent(modalShareFooter.dataset.shareTitle || document.title);
        
        let url;

        switch (service) {
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=${link}`;
                break;
            case 'linkedin':
                url = `https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`;
                break;
            case 'whatsapp':
                url = `https://api.whatsapp.com/send?text=${title}%20${link}`;
                break;
            case 'x':
                url = `https://twitter.com/intent/tweet?url=${link}&text=${title}`;
                break;
            case 'bluesky': // Lógica para el nuevo botón
                url = `https://bsky.app/intent/compose?text=${title}%20${link}`;
                break;
        }

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
        
        // Lógica para el botón de copiar enlace
        if (shareButton.id === 'copy-link') {
            navigator.clipboard.writeText(decodeURIComponent(link)).then(() => {
                const originalIcon = shareButton.innerHTML;
                shareButton.innerHTML = `<i class="fa-solid fa-check"></i>`; // Ícono de "copiado"
                setTimeout(() => {
                    shareButton.innerHTML = originalIcon; // Volver al ícono original
                }, 1500);
            }).catch(err => console.error('Error al copiar enlace:', err));
        }
    });

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

    // Actualizar en app.js para manejar el scroll entre las 3 secciones
    function initHero() {
        const startBtn = document.getElementById('start-legacy-btn');
        const searchSection = document.getElementById('search-portal');
        const mainContent = document.querySelector('main.container'); 
        const desktopNav = document.querySelector('.desktop-nav');

        // Botón "Comenzar" abre el registro
        startBtn?.addEventListener('click', () => {
            document.getElementById('login-modal-trigger')?.click();
        });

        // Control de transparencia del menú según la sección
        if (desktopNav) { 
            const checkNavPosition = () => { 
                // El menú se vuelve sólido al entrar en la sección de búsqueda
                const searchTop = searchSection.offsetTop;
                desktopNav.classList.toggle('is-at-top', window.scrollY < searchTop - 50); 
            }; 
            window.addEventListener('scroll', checkNavPosition, { passive: true }); 
        }
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
        const allPostsCta = event.target.closest('.bento-substack-featured'); 

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

        if (allPostsCta) {
            window.open(allPostsCta.dataset.url, '_blank');
            return;
        }

        if (!bentoBox) return;
        const dataId = bentoBox.dataset.id;

        if (dataId === "static-launch-stories") {
            document.dispatchEvent(new CustomEvent('launch-stories'));
        } 
        else if (dataId === "static-zenodo") {
            const imageURL = 'https://i.ibb.co/x8JbV61H/a-futuristic-digital-artwork-depicting-a-k9-Jb0c-3-R0u8by-Ev-GGOrw-x-Ait-Jamg-RCat9-GLc-O810jg.jpg';
            const contentHTML = `
                <img src="${imageURL}" alt="Comunidad Epistecnología en Zenodo" class="modal-post-image">
                <div class="modal-padded-content">
                    <h2>Publica tu Trabajo, Obtén un DOI y Únete a la Comunidad</h2>
                    <div class="post-body">
                        <p>En Epistecnología, te ofrecemos las herramientas para que tu conocimiento sea reconocido y citable. Nuestra integración con Zenodo te permite publicar tus trabajos directamente desde tu perfil y obtener un DOI oficial a tu nombre.</p>
                        
                        <h4>La Vía Epistecnología (Recomendado)</h4>
                        <p>Crea una cuenta o inicia sesión en nuestra plataforma, conecta tu ORCID y utiliza nuestra herramienta de publicación. Tu trabajo será enviado a nuestra comunidad en Zenodo con tu autoría, de forma simple y directa.</p>
                    </div>
                    <div class="modal-cta-container">
                        <button id="zenodo-modal-cta-btn" class="modal-cta-button modal-cta-button--primary">Publicar desde Epistecnología</button>
                        <a href="https://zenodo.org/communities/epistecnologia" target="_blank" class="modal-cta-button">Explorar la Comunidad en Zenodo</a>
                    </div>
                </div>
            `;
            openModal(contentHTML, 'article', { link: 'https://zenodo.org/communities/epistecnologia' });
        }
        // --- INICIO DE LA LÓGICA FINAL PARA POSTS ---
        else if (allPostsData.some(p => p.guid === dataId)) {
            const post = allPostsData.find(p => p.guid === dataId);
            
            // DATOS BÁSICOS DEL POST
            const fullContent = sanitizeSubstackContent(post.content);
            const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
            const thumbnail = post.thumbnail || extractFirstImageUrl(post.content);
            const imageHTML = thumbnail ? `<img src="${thumbnail}" alt="${post.title}" class="modal-post-image">` : '';

            // --- BÚSQUEDA EN EL DIRECTORIO ---
            // Buscamos un perfil cuyo 'substack_author_name' coincida con el autor del post
            const profile = researcherProfiles.find(p => p.substack_author_name === post.author);
            
            let authorAvatar, authorName, orcidHTML = '';
            
            if (profile) {
                // ¡Coincidencia encontrada! Usamos los datos del perfil de Supabase
                console.log("¡Perfil de investigador encontrado!", profile);
                authorAvatar = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
                authorName = profile.display_name; // Usamos el nombre principal del perfil
                // Si el perfil tiene ORCID, preparamos el HTML para mostrarlo
                if (profile.orcid) {
                    orcidHTML = `
                        <a href="https://orcid.org/${profile.orcid}" target="_blank" class="orcid-link">
                            <i class="fa-brands fa-orcid"></i> ${profile.orcid}
                        </a>
                    `;
                }
            } else {
                // No hubo coincidencia, usamos los datos por defecto del post
                authorAvatar = 'https://i.ibb.co/61fJv24/default-avatar.png';
                authorName = post.author;
            }

            // --- BÚSQUEDA DE DOI EN EL CONTENIDO ---
            let doiHTML = '';
            const doiMatch = fullContent.match(/https?:\/\/doi\.org\/([^\s"<]+)/);
            if (doiMatch) {
                const doiLink = doiMatch[0];
                const doiId = doiMatch[1];
                doiHTML = `
                    <a href="${doiLink}" target="_blank" class="doi-link">
                        <img src="https://zenodo.org/badge/DOI/${doiId}.svg" alt="DOI Badge">
                    </a>
                `;
            }
            
            // CONSTRUCCIÓN DEL HTML FINAL PARA EL MODAL
            const contentHTML = `
                ${imageHTML}
                <div class="modal-post-layout">
                    <aside class="modal-meta-column">
                        <div class="author-info">
                            <img src="${authorAvatar}" alt="Avatar de ${authorName}" class="author-avatar">
                            <div>
                                <div class="author-name">${authorName}</div>
                                <div class="post-date">${postDate}</div>
                            </div>
                        </div>
                        <div class="meta-badges">
                            ${orcidHTML}
                            ${doiHTML}
                        </div>
                    </aside>
                    <article class="modal-body-column">
                        <h2>${post.title}</h2>
                        <div class="post-body">
                            ${fullContent}
                        </div>
                        <div class="modal-cta-container">
                            <a href="${post.link}" target="_blank" class="modal-cta-button modal-cta-button--primary">Seguir leyendo</a>
                            <a href="https://publicaciones.epistecnologia.com/" target="_blank" class="modal-cta-button">Suscribirse al Newsletter</a>
                        </div>
                    </article>
                </div>
            `;

            openModal(contentHTML, 'article', { link: post.link, title: post.title });
        }
        // --- FIN DE LA LÓGICA FINAL ---
    });

    // --- INICIO: LÓGICA PARA EL BOTÓN DEL MODAL DE ZENODO ---
    // (Puedes añadir este código después del listener de "bentoGrid")

    document.body.addEventListener('click', async (e) => {
        // Verificamos si se hizo clic en el botón principal del modal de Zenodo
        if (e.target.closest('#zenodo-modal-cta-btn')) {
            e.preventDefault();
            
            // Obtenemos la sesión del usuario para saber si está logueado
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (session?.user) {
                // Si el usuario ya inició sesión, lo redirigimos a su perfil para que publique
                window.location.href = '/inv/profile.html';
            } else {
                // Si es un invitado, cerramos el modal actual y abrimos el de login
                closeModal();
                // Usamos un pequeño retraso para asegurar que el modal se cierre antes de abrir el otro
                setTimeout(() => {
                    // Hacemos "clic" programáticamente en el botón de login del menú
                    document.getElementById('login-modal-trigger')?.click();
                }, 300);
            }
        }
    });
    // --- FIN: LÓGICA PARA EL BOTÓN DEL MODAL DE ZENODO ---

    modalCloseBtn?.addEventListener('click', () => { if (history.state?.modalOpen) history.back(); else closeModal(); });
    modalOverlay?.addEventListener('click', (e) => { if (e.target === modalOverlay) { if (history.state?.modalOpen) history.back(); else closeModal(); } });
    document.addEventListener('stories-ready', (e) => { openModal(e.detail.html, 'stories'); });
    window.addEventListener('popstate', (event) => { if (modalOverlay.classList.contains('is-visible')) closeModal(); });

    loadContent();
    initHero();
    initMobileNav();

    // ==========================================
    // 1. EFECTO PLEXUS (Partículas conectadas)
    // ==========================================
    function initPlexus() {
        const canvas = document.getElementById('plexus-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];

        // Configuración
        const particleCount = 60; // Cantidad de puntos
        const connectionDistance = 150; // Distancia para conectar líneas
        const mouseDistance = 200; // Distancia de reacción al mouse

        // Mouse
        let mouse = { x: null, y: null };

        function resize() {
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
        }

        class Particle {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.vx = (Math.random() - 0.5) * 0.5; // Velocidad lenta
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2 + 1;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Rebote en bordes
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Interacción con mouse
                if (mouse.x != null) {
                    let dx = mouse.x - this.x;
                    let dy = mouse.y - this.y;
                    let distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < mouseDistance) {
                        const forceDirectionX = dx / distance;
                        const forceDirectionY = dy / distance;
                        const force = (mouseDistance - distance) / mouseDistance;
                        // Efecto de repulsión suave
                        this.vx -= forceDirectionX * force * 0.05;
                        this.vy -= forceDirectionY * force * 0.05;
                    }
                }
            }

            draw() {
                ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--color-text-secondary');
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }

        // Reemplaza la parte de "animate()" dentro de initPlexus en app.js
        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            // Detectamos si es tema oscuro o claro para el color de las líneas
            const isDark = document.body.classList.contains('dark-theme');
            // Si es oscuro: blanco (0.2 opacidad). Si es claro: NEGRO (0.1 opacidad) <-- ESTO ARREGLA LA VISIBILIDAD
            const baseColor = isDark ? '255,255,255' : '0,0,0'; 

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                // Dibujar partícula (círculo)
                ctx.fillStyle = `rgba(${baseColor}, 0.3)`; 
                ctx.beginPath();
                ctx.arc(particles[i].x, particles[i].y, particles[i].size, 0, Math.PI * 2);
                ctx.fill();

                // Dibujar conexiones
                for (let j = i; j < particles.length; j++) {
                    let dx = particles[i].x - particles[j].x;
                    let dy = particles[i].y - particles[j].y;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < connectionDistance) {
                        ctx.beginPath();
                        // La opacidad depende de la distancia
                        let opacity = 1 - (distance / connectionDistance);
                        ctx.strokeStyle = `rgba(${baseColor}, ${opacity * 0.15})`; // Aumenté un poco la opacidad a 0.15
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }

        window.addEventListener('resize', () => { resize(); initParticles(); });
        window.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

        resize();
        initParticles();
        animate();
    }

    // ==========================================
    // 2. EFECTO PARALLAX EN OBJETOS FLOTANTES
    // ==========================================
    function initParallax() {
        document.addEventListener('mousemove', (e) => {
            const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
            const moveY = (e.clientY - window.innerHeight / 2) * 0.01;

            document.querySelectorAll('.mouse-reactive').forEach(el => {
                const speed = el.getAttribute('data-speed') || 2;
                const x = moveX * speed;
                const y = moveY * speed;
                // Usamos translate3d para mejor rendimiento
                el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            });
        });
    }

    // Inicializar efectos visuales
    initPlexus();
    initParallax();


});

/* ==========================================================================
   3. SISTEMA DE INTELIGENCIA: BÚSQUEDA Y SINCRONIZACIÓN (V3.0)
   ========================================================================== */

// --- A. MOTOR DE BÚSQUEDA (Interfaz Visual) ---
(function initSearchSystem() {
    console.log("🛠️ Iniciando buscador...");
    
    const searchInput = document.getElementById('main-search-input');
    const resultsContainer = document.getElementById('search-results-area');

    if (!searchInput || !resultsContainer) {
        setTimeout(initSearchSystem, 800); // Reintentar si el HTML no está listo
        return;
    }

    let debounceTimer;

    // Escuchar escritura
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length === 0) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
            return;
        }
        
        // Retraso de 400ms para no saturar la base de datos
        debounceTimer = setTimeout(() => executeSearch(query), 400);
    });

    // Escuchar Enter
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            executeSearch(searchInput.value.trim());
        }
    });

    async function executeSearch(query) {
        if (!window.supabaseClient) return;

        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Explorando el archivo...</div>`;

        try {
            // Buscamos en título y descripción
            const { data: results, error } = await window.supabaseClient
                .from('knowledge_base')
                .select('*')
                .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
                .order('published_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (!results || results.length === 0) {
                resultsContainer.innerHTML = `<div style="text-align:center; padding:2rem;">No encontramos nada sobre "${query}".</div>`;
                return;
            }

            // Mapeo de tipos para traducción (Fix solicitado)
            const typeLabels = {
                'article': 'Artículo',
                'podcast': 'Podcast',
                'video': 'Video',
                'paper': 'Paper'
            };

            const html = results.map(item => {
                // Traducir etiqueta o usar la original capitalizada
                let label = typeLabels[item.source_type] || item.source_type.charAt(0).toUpperCase() + item.source_type.slice(1);
                
                // Icono según tipo
                let icon = item.source_type === 'podcast' ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-align-left"></i>';

                return `
                <a href="${item.url}" target="_blank" class="result-card">
                    <div class="result-img-wrapper">
                        <img src="${item.image_url || 'https://placehold.co/600x400'}" onerror="this.style.display='none'" loading="lazy">
                        <span class="source-badge">${icon} ${label}</span>
                    </div>
                    <div class="result-info">
                        <h4>${item.title}</h4>
                        <p>${item.description ? item.description.substring(0, 120) + '...' : 'Sin descripción.'}</p>
                    </div>
                </a>`;
            }).join('');

            resultsContainer.innerHTML = `<div class="results-grid-cine">${html}</div>`;

        } catch (err) {
            console.error(err);
            resultsContainer.innerHTML = `<div style="text-align:center; color:var(--color-accent);">Error de conexión.</div>`;
        }
    }

    // Helper global para etiquetas
    window.fillSearch = (term) => {
        searchInput.value = term;
        searchInput.focus();
        searchInput.dispatchEvent(new Event('input'));
    };

})(); 


// --- B. HERRAMIENTA DE SINCRONIZACIÓN (Admin) ---
// Para usar: Abre la consola (F12) y escribe: window.syncContent()
window.syncContent = async function() {
    console.log("🚀 Iniciando sincronización masiva...");
    
    // Intentamos pedir 50 artículos para traer más historia
    // Nota: rss2json gratuito a veces limita esto, pero intentamos forzarlo.
    const articlesUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&count=50';
    const podcastUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&count=50';

    let added = 0;

    const process = async (url, type) => {
        try {
            const res = await fetch(url);
            const data = await res.json();
            if(data.status !== 'ok') return;
            
            for (const item of data.items) {
                // Limpieza agresiva de HTML para guardar texto limpio en la DB
                let cleanText = item.description || item.content || '';
                cleanText = cleanText.replace(/<[^>]*>?/gm, ''); // Quitar etiquetas HTML
                cleanText = cleanText.substring(0, 600); // Guardamos más texto para mejorar la búsqueda

                // Detectar imagen (Thumbnail o Enclosure)
                let img = item.thumbnail;
                if(!img && item.enclosure?.link) img = item.enclosure.link;

                const payload = {
                    title: item.title,
                    description: cleanText, // Guardamos el texto limpio extendido
                    url: item.link,
                    image_url: img,
                    published_at: item.pubDate,
                    author_name: item.author || 'Epistecnología',
                    source_type: type // 'article' o 'podcast'
                };

                const { error } = await window.supabaseClient
                    .from('knowledge_base')
                    .upsert(payload, { onConflict: 'url' }); // Actualiza si ya existe
                
                if(!error) added++;
            }
        } catch (e) { console.error("Error sync:", e); }
    };

    await Promise.all([process(articlesUrl, 'article'), process(podcastUrl, 'podcast')]);
    alert(`✅ Sincronización finalizada. ${added} elementos procesados/actualizados.`);
    // Recargamos para que el buscador tenga los datos nuevos frescos en caché si es necesario
    location.reload();
};
