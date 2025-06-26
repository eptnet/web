/**
 * =========================================================================
 * Script de la Página de Inicio (app.js) - VERSIÓN FINAL CON MODAL
 * - Dirige toda la lógica de apertura y cierre del modal.
 * - Corrige la reproducción de MP3s con Wavesurfer.
 * - Corrige el comportamiento del botón "atrás" del navegador.
 * =========================================================================
 */

document.addEventListener('mainReady', () => {

    console.log("app.js: Usando sistema de Modal de Inmersión.");

    // --- 1. SELECCIÓN DE ELEMENTOS ---
    const bentoGrid = document.getElementById("bento-grid");
    const modalOverlay = document.getElementById('immersion-modal-overlay');
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalShareFooter = document.getElementById('modal-share-footer');
    
    // --- 2. DEFINICIÓN DE MÓDULOS Y GRID LAYOUT ---
    const staticModules = {
        welcome: `<div class="bento-box welcome-module bento-box--3x2" data-id="static-welcome" style="cursor: default;"><h2>¿Investigas, divulgas o simplemente quieres entender mejor el mundo?</h2><p>Te damos la bienvenida a <strong>Epistecnología</strong>...</p></div>`,
        stories: `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/cSX1NWyR/sterieweb-Whisk-3577df53ea.jpg'); cursor: pointer; background-size: cover; background-position: center;"><div class="card-content"><span class="card-category" style="color: white;">Colección</span><h4 style="color: white;">Minuto cultural</h4></div></div>`,
        quote: `<div class="bento-box bento-box--1x2 bento-style--flat" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`,
        videoFeatured: `<div class="bento-box bento-box--2x2 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" title="Video destacado de YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
        inFeed: `<div class="bento-box bento-box--2x2 mobile-full-width bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro newsletter.</p><br/><iframe src="https://eptnews.substack.com/embed" width="100%" height="100%" style="border:0;" frameborder="0" scrolling="no"></iframe></div></div>`,
        end: `<div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div><div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><div class="card-content"><span class="card-category">Ver Ahora</span><h4>El Futuro de la Exploración Espacial</h4></div></div>`
    };
    const grid_layout = [ { type: 'module', id: 'welcome' }, { type: 'module', id: 'stories' }, { type: 'post' }, { type: 'post' }, { type: 'module', id: 'quote' }, { type: 'post' }, { type: 'module', id: 'videoFeatured' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'module', id: 'inFeed' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'post' }, { type: 'module', id: 'end' }];

    // --- 4. LÓGICA DE LA APLICACIÓN ---
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=13';
    let allPostsData = [];
    window.wavesurferInstance = null;
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

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
            } else { throw new Error("API no respondió correctamente."); }
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
    
    // --- LÓGICA DEL MODAL DE INMERSIÓN ---

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
        
        // Añadimos un estado al historial para poder interceptar el botón "atrás"
        history.pushState({ modalOpen: true }, '');
    }

    function closeModal() {
        if (!modalOverlay || !modalOverlay.classList.contains('is-visible')) return;
        
        const type = document.body.dataset.modalType;

        if (type === 'stories') {
            document.dispatchEvent(new CustomEvent('close-shorts-player'));
        }
        if (window.wavesurferInstance) {
            window.wavesurferInstance.destroy();
            window.wavesurferInstance = null;
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
    
    bentoGrid?.addEventListener("click", (event) => {
        const bentoBox = event.target.closest('.bento-box[data-id]');
        if (!bentoBox) return;
        
        const dataId = bentoBox.dataset.id;

        if (dataId === "static-launch-stories") {
            document.dispatchEvent(new CustomEvent('launch-stories'));
        } else if (allPostsData.some(p => p.guid === dataId)) {
            const post = allPostsData.find(p => p.guid === dataId);
            const sanitizedContent = sanitizeSubstackContent(post.content);
            const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
            const audioPlayerHTML = post.enclosure?.link?.endsWith(".mp3") ? `<div id="audio-player-container"><button id="play-pause-btn" aria-label="Reproducir/Pausar"><i class="fa-solid fa-play"></i></button><div id="waveform"></div></div>` : "";
            const contentHTML = `<h2>${post.title}</h2><div class="post-meta">Publicado por ${post.author} el ${postDate}</div>${audioPlayerHTML}<div class="post-body">${sanitizedContent}</div>`;
            
            openModal(contentHTML, 'article', { link: post.link, title: post.title });
            
            if (post.enclosure?.link?.endsWith(".mp3")) {
                const audioUrl = post.enclosure.link;
                const playerContainer = document.getElementById('audio-player-container');
                if (typeof WaveSurfer === 'undefined') { if (playerContainer) playerContainer.innerHTML = `<audio controls autoplay src="${audioUrl}"></audio>`; return; }
                const proxiedUrl = `https://thingproxy.freeboard.io/fetch/${audioUrl}`;
                window.wavesurferInstance = WaveSurfer.create({ container: '#waveform', waveColor: 'rgb(200, 200, 200)', progressColor: 'rgb(183, 42, 30)', url: proxiedUrl, barWidth: 3, barRadius: 3, barGap: 2, height: 80 });
                
                const playPauseBtn = document.getElementById('play-pause-btn');
                const icon = playPauseBtn?.querySelector('i');
                if (playPauseBtn && icon) {
                    playPauseBtn.addEventListener('click', () => window.wavesurferInstance.playPause());
                    window.wavesurferInstance.on('play', () => { icon.className = 'fa-solid fa-pause'; });
                    window.wavesurferInstance.on('pause', () => { icon.className = 'fa-solid fa-play'; });
                }
            }
        }
    });

    modalCloseBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('stories-ready', (e) => {
        openModal(e.detail.html, 'stories');
    });

    // *** CAMBIO CLAVE: El botón atrás ahora solo llama a nuestra función de cierre.
    window.addEventListener('popstate', () => {
        if (modalOverlay.classList.contains('is-visible')) {
            closeModal();
        }
    });

    loadPosts();
    initHero();
    initMobileNav();
});
