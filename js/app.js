/**
 * =========================================================================
 * Script de la Página de Inicio (app.js) - VERSIÓN COMPLETA Y ESTABLE
 * - Gestiona el cierre de TODOS los tipos de paneles (artículos e historias).
 * - Soluciona el problema de audio persistente y la pérdida de estilos.
 * - Limpia el contenido de Substack para eliminar elementos no deseados.
 * =========================================================================
 */

document.addEventListener('mainReady', () => {

    console.log("Evento 'mainReady' recibido. app.js comienza su ejecución.");

    // --- 1. SELECCIÓN DE ELEMENTOS ---
    const bentoGrid = document.getElementById("bento-grid");
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    
    // --- 2. DEFINICIÓN DE MÓDULOS ESTÁTICOS ---
    const staticModules = {
        welcome: `<div class="bento-box welcome-module bento-box--3x2" data-id="static-welcome" style="cursor: default;"><h2>¿Investigas, divulgas o simplemente quieres entender mejor el mundo?</h2><p>Te damos la bienvenida a <strong>Epistecnología</strong>, una <strong>plataforma abierta de divulgación científica y cultural</strong> que pone la <strong>tecnología al servicio del conocimiento con Sabiduría</strong>. Aquí, investigadores, docentes, divulgadores y curiosos del saber encuentran un espacio para <strong>crear, compartir y explorar contenidos académicos</strong>, desde artículos y podcasts hasta <strong>videos, transmisiones en vivo y publicaciones indexadas</strong>.</p></div>`,
        stories: `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/cSX1NWyR/sterieweb-Whisk-3577df53ea.jpg'); cursor: pointer; background-size: cover; background-position: center;"><div class="card-content"><span class="card-category" style="color: white;">Colección</span><h4 style="color: white;">Minuto cultural</h4></div></div>`,
        quote: `<div class="bento-box bento-box--1x2 bento-style--flat" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`,
        videoFeatured: `<div class="bento-box bento-box--2x2 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" title="Video destacado de YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
        inFeed: `<div class="bento-box bento-box--2x2 mobile-full-width bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro newsletter.</p><br/><iframe src="https://eptnews.substack.com/embed" width="100%" height="100%" style="border:0;" frameborder="0" scrolling="no"></iframe></div></div>`,
        end: `<div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div><div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><div class="card-content"><span class="card-category">Ver Ahora</span><h4>El Futuro de la Exploración Espacial</h4></div></div>`
    };

    // --- 3. EL "PLANO DE CONSTRUCCIÓN" DE LA GRID ---
    const grid_layout = [
        { type: 'module', id: 'welcome' }, { type: 'module', id: 'stories' },
        { type: 'post' }, { type: 'post' },
        { type: 'module', id: 'quote' }, { type: 'post' },
        { type: 'module', id: 'videoFeatured' },
        { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' },
        { type: 'module', id: 'inFeed' },
        { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' },
        { type: 'module', id: 'end' }
    ];

    // --- 4. LÓGICA DE LA APLICACIÓN (Funciones Completas) ---
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=13';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';
    let allPostsData = [];
    window.wavesurferInstance = null;

    async function loadPosts() {
        if (!bentoGrid) return;
        bentoGrid.innerHTML = '<div class="loading" style="grid-column: span 4; text-align: center; padding: 2rem;">Cargando...</div>';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error de red: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                allPostsData = data.items;
                displayPosts(allPostsData);
            } else {
                throw new Error("API no respondió correctamente.");
            }
        } catch (error) {
            console.error("Falló la carga de posts:", error);
            bentoGrid.innerHTML = '<div class="error" style="grid-column: span 4; text-align: center; padding: 2rem;">No se pudieron cargar los posts.</div>';
        }
    }

    function displayPosts(items) {
        bentoGrid.innerHTML = "";
        let postIndex = 0;
        grid_layout.forEach(element => {
            let elementHTML = '';
            if (element.type === 'module') {
                elementHTML = staticModules[element.id];
            } else if (element.type === 'post') {
                const post = items[postIndex];
                if (post) {
                    elementHTML = createPostCardHTML(post, postIndex);
                    postIndex++;
                }
            }
            if (elementHTML) bentoGrid.insertAdjacentHTML("beforeend", elementHTML);
        });
    }

    function createPostCardHTML(item, index) {
        const isAudio = item.enclosure?.link?.endsWith(".mp3");
        const thumbnail = item.thumbnail || extractFirstImageUrl(item.content);
        const cardImageStyle = thumbnail ? `style="background-image: url('${thumbnail}');"` : (isAudio ? `style="background-image: url(${audioPostBackground});"` : '');
        const cardType = isAudio ? "Podcast" : "Publicación";
        let cardSizeClass = "bento-box--1x1";
        if (index === 0) cardSizeClass = "bento-box--2x2";
        else if (index % 3 === 2) cardSizeClass = "bento-box--1x2";
        if (index === 4) cardSizeClass = "bento-box--1x1 bento-style--circle";
        return `<div class="bento-box post-card ${cardSizeClass}" data-id="${item.guid}" ${cardImageStyle}><div class="card-content"><span class="card-category">${cardType}</span><h4>${item.title}</h4></div></div>`;
    }

    function extractFirstImageUrl(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const img = doc.querySelector("img");
        return img ? img.src : null;
    }

    function sanitizeSubstackContent(htmlString) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        tempDiv.querySelectorAll('.pencraft, .pc-display-flex').forEach(el => el.remove());
        return tempDiv.innerHTML;
    }

    function openArticlePanel(clickedElement) {
        if (sidePanel.classList.contains('is-open')) return;
        const post = allPostsData.find(p => p.guid === clickedElement.dataset.id);
        if (!post) return;

        const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
        const audioPlayerHTML = post.enclosure?.link?.endsWith(".mp3") ? `<div id="audio-player-container"><button id="play-pause-btn" aria-label="Reproducir/Pausar"><i class="fa-solid fa-play"></i></button><div id="waveform"></div></div>` : "";
        const sanitizedContent = sanitizeSubstackContent(post.content);
        const contentHTML = `<h2>${post.title}</h2><div class="post-meta">Publicado por ${post.author} el ${postDate}</div>${audioPlayerHTML}<div class="post-body">${sanitizedContent}</div>`;
        
        sidePanelContent.innerHTML = contentHTML;
        setupShareButtons({ link: post.link });
        sidePanel.classList.add("is-open");
        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
        
        document.body.dataset.panelType = 'article';
        history.pushState({ panelOpen: true }, '');

        if (post.enclosure?.link?.endsWith(".mp3")) {
            const audioUrl = post.enclosure.link;
            const playerContainer = document.getElementById('audio-player-container');
            if (typeof WaveSurfer === 'undefined') {
                if (playerContainer) playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${audioUrl}" style="width: 100%; height: 54px;"></audio>`;
                return;
            }
            const proxiedUrl = `https://thingproxy.freeboard.io/fetch/${audioUrl}`;
            window.wavesurferInstance = WaveSurfer.create({ container: '#waveform', waveColor: 'rgb(200, 200, 200)', progressColor: 'rgb(183, 42, 30)', url: proxiedUrl, barWidth: 3, barRadius: 3, barGap: 2, height: 80 });
            
            const playPauseBtn = document.getElementById('play-pause-btn');
            const icon = playPauseBtn?.querySelector('i');
            if (playPauseBtn && icon) {
                playPauseBtn.addEventListener('click', () => window.wavesurferInstance.playPause());
                window.wavesurferInstance.on('play', () => { icon.className = 'fa-solid fa-pause'; });
                window.wavesurferInstance.on('pause', () => { icon.className = 'fa-solid fa-play'; });
            }
             window.wavesurferInstance.on('error', () => { 
                window.wavesurferInstance?.destroy(); 
                if (playerContainer) playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${audioUrl}" style="width: 100%; height: 54px;"></audio>`; 
            });
        }
    }

    // *** CAMBIO CLAVE: Función de cierre ÚNICA Y CENTRALIZADA ***
    function closeSidePanel() {
        const panelType = document.body.dataset.panelType;
        
        // Limpieza específica según el tipo de panel
        if (panelType === 'stories') {
            console.log("Cerrando panel de historias...");
            document.dispatchEvent(new CustomEvent('close-shorts-player'));
        } 
        else if (panelType === 'article') {
            console.log("Cerrando panel de artículo...");
            if (window.wavesurferInstance) {
                window.wavesurferInstance.destroy();
                window.wavesurferInstance = null;
                console.log("Instancia de Wavesurfer destruida.");
            }
        }

        // Cierre visual UNIFICADO para todos
        sidePanel.classList.remove("is-open");
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        
        // Limpiamos la marca
        delete document.body.dataset.panelType;
    }

    function setupShareButtons(config) {
        const link = encodeURIComponent(config.link);
        const title = encodeURIComponent(config.title || document.title);
        const shareContainer = document.querySelector('.side-panel__share');
        if (shareContainer) {
            shareContainer.querySelector("#share-fb")?.addEventListener('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`));
            shareContainer.querySelector("#share-li")?.addEventListener('click', () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`));
            shareContainer.querySelector("#share-wa")?.addEventListener('click', () => window.open(`https://api.whatsapp.com/send?text=${title}%20${link}`));
            shareContainer.querySelector("#share-x")?.addEventListener('click', () => window.open(`https://twitter.com/intent/tweet?url=${link}&text=${title}`));
        }
    }

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

    // --- 5. ASIGNACIÓN DE EVENTOS E INICIALIZACIÓN ---
    
    // El botón 'X' y el overlay ahora llaman a la función de cierre directamente.
    sidePanelClose?.addEventListener("click", () => {
        // Solo navegamos hacia atrás si había un estado que empujar
        if (history.state?.panelOpen) {
            history.back();
        } else {
            closeSidePanel();
        }
    });
    overlay?.addEventListener("click", () => {
        if (history.state?.panelOpen) {
            history.back();
        } else {
            closeSidePanel();
        }
    });

    bentoGrid?.addEventListener("click", (event) => {
        const bentoBox = event.target.closest('.bento-box[data-id]');
        if (!bentoBox) return;
        const dataId = bentoBox.dataset.id;
        if (dataId === "static-launch-stories") {
            document.body.dataset.panelType = 'stories';
            document.dispatchEvent(new CustomEvent('launch-stories'));
        } else if (allPostsData.some(p => p.guid === dataId)) {
            openArticlePanel(bentoBox);
        }
    });

    // El popstate ahora también usa la función de cierre centralizada
    window.addEventListener('popstate', function(event) {
        if (sidePanel.classList.contains('is-open')) {
            closeSidePanel();
        }
    });

    loadPosts();
    initHero();
    initMobileNav();
});
