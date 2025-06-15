/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * Versión 5.1 - Lógica de Panel y Navegador Centralizada (Completo)
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. SELECCIÓN DE ELEMENTOS DEL DOM
    // =========================================================================
    const bentoGrid = document.getElementById('bento-grid');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
    const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');

    // =========================================================================
    // 2. CONSTANTES Y PLANTILLAS HTML
    // =========================================================================
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=13';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

    /* const welcomeModuleHTML = `
        <div class="bento-box welcome-module bento-box--3x1" data-id="static-welcome" style="cursor: default;">
            <h2>Epistecnología</h2>
            <p>Explora la intersección entre tecnología, ciencia y cultura y su divulgación con Sabiduría.</p>
        </div>`; */

    const topStaticModulesHTML = `
        <div class="bento-box welcome-module bento-box--3x1" data-id="static-welcome" style="cursor: default;">
            <h2>Epistecnología</h2>
            <p>Explora la intersección entre tecnología, ciencia y cultura y su divulgación con Sabiduría.</p>
        </div>
        
        <div class="bento-box bento-box--1x1" data-id="static-quote" style="cursor:default;">
            <div class="card-content" style="text-align: center;">
                <p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p>
                <h4 style="margin-top: 0.5rem;">- Anónimo</h4>
            </div>
        </div>`;
    
    const videoStoriesCardHTML = `
        <div class="bento-box bento-box--1x3" data-id="static-launch-stories" 
        style="background-image: url('https://i.ibb.co/cSX1NWyR/sterieweb-Whisk-3577df53ea.jpg'); cursor: pointer; background-size: cover; background-position: center;">
            <div class="card-content">
                <span class="card-category" style="color: white;">Colección</span>
                <h4 style="color: white;">Minuto cultural</h4>
            </div>
        </div>`;

    const videoFeaturedModuleHTML = `
        <div class="bento-box bento-box--2x3 video-featured-module" data-id="static-video-featured">
             <iframe 
                src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" 
                title="Video destacado de YouTube" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
             </iframe>
        </div>`;
    
    const inFeedModuleHTML = `
        <div class="bento-box bento-box--1x1 bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;">
            <div class="card-content">
                <h3>¿Disfrutando el Contenido?</h3>
                <p>Suscríbete a nuestro boletín para no perderte ninguna publicación.</p>
            </div>
        </div>`;

    const endStaticModulesHTML = `
        <div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo">
            <div class="card-content">
                <h3>Conocimiento Citable</h3>
                <p>Accede a nuestros datasets y preprints.</p>
                <a href="#" class="btn">Visitar Repositorio</a>
            </div>
        </div>
        <div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ">
            <div class="card-content">
                <span class="card-category">Ver Ahora</span>
                <h4>El Futuro de la Exploración Espacial</h4>
            </div>
        </div>`;

    // =========================================================================
    // 3. LÓGICA PRINCIPAL (FUNCIONES)
    // =========================================================================
    
    let allPostsData = [];
    let wavesurferInstance = null; 

    async function loadPosts() {
        if (!bentoGrid) {
            console.error("Error Crítico: El contenedor .bento-grid no fue encontrado.");
            return;
        }
        bentoGrid.innerHTML = '<div class="loading">Cargando publicaciones...</div>';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error en la red: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                allPostsData = data.items;
                bentoGrid.innerHTML = "";
                displayPosts(allPostsData);
                displayCategoryPosts("Cultura", "cultura-grid", 3);
            } else {
                throw new Error("La respuesta de la API no fue exitosa.");
            }
        } catch (error) {
            console.error("Falló la carga de publicaciones:", error);
            bentoGrid.innerHTML = '<div class="error">No se pudieron cargar las publicaciones.</div>';
        }
    }
    
    function displayPosts(items) {
        // bentoGrid.insertAdjacentHTML("beforeend", welcomeModuleHTML);
        bentoGrid.insertAdjacentHTML("beforeend", topStaticModulesHTML);
        
        // Mover el video destacado a la tercera posición
        bentoGrid.insertAdjacentHTML("beforeend", videoStoriesCardHTML);
        // bentoGrid.insertAdjacentHTML("beforeend", videoFeaturedModuleHTML);
        

        items.forEach((item, index) => {
            if (index === 5) {
                bentoGrid.insertAdjacentHTML("beforeend", videoFeaturedModuleHTML);
            }

            if (index === 6) {
                bentoGrid.insertAdjacentHTML("beforeend", inFeedModuleHTML);
            }
            
            // --- INICIO DE LA CORRECCIÓN ---
            const isAudio = item.enclosure?.link?.endsWith(".mp3");
            const thumbnail = item.thumbnail || extractFirstImageUrl(item.content);
            const cardImageStyle = thumbnail ? `style="background-image: url(${thumbnail});"` : (isAudio ? `style="background-image: url(${audioPostBackground});"` : '');
            const cardType = isAudio ? "Podcast" : "Publicación";
            
            let cardSizeClass = "";
            // Asignamos tamaños especiales para dar variedad
            if (index === 0) {
                cardSizeClass = "bento-box--2x2";
            } else if (index % 5 === 1) {
                cardSizeClass = "bento-box--1x2";
            } else if (index % 5 === 3) {
                cardSizeClass = "bento-box--2x1";
            } else {
                // ¡ESTA ES LA LÍNEA CLAVE!
                // Si un post no tiene un tamaño especial, le damos uno por defecto (1x1).
                cardSizeClass = "bento-box--1x1"; 
            }

            // Ahora, como todos los posts tienen un tamaño, siempre se crearán.
            const postCardHTML = `
                <div class="bento-box post-card ${cardSizeClass}" data-id="${item.guid}" ${cardImageStyle}>
                    <div class="card-content">
                        <span class="card-category">${cardType}</span>
                        <h4>${item.title}</h4>
                    </div>
                </div>`;
            bentoGrid.insertAdjacentHTML("beforeend", postCardHTML);
            // --- FIN DE LA CORRECCIÓN ---
            
        });
        bentoGrid.insertAdjacentHTML("beforeend", endStaticModulesHTML);
    }
    
    function openSidePanel(clickedElement) {
    const dataset = clickedElement.dataset;
    if (sidePanel.classList.contains('is-open')) return;

    if (dataset.id === "static-launch-stories") {
        document.dispatchEvent(new CustomEvent('launch-stories'));
        return;
    }
    if (dataset.id === "static-video-featured" || dataset.id === "static-welcome" || dataset.id === "static-quote") {
        return;
    }

    const post = allPostsData.find(p => p.guid === dataset.id);
    if (!post) return;

    const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
    let audioPlayerHTML = "";

    // Si es un post de audio, preparamos el contenedor para Wavesurfer.
    if (post.enclosure?.link?.endsWith(".mp3")) {
        audioPlayerHTML = `<div id="audio-player-container"><div id="waveform"></div><div id="audio-controls"><button id="play-pause-btn" aria-label="Reproducir/Pausar"><i class="fa-solid fa-play"></i></button></div></div>`;
    }
    
    const contentHTML = `<h2>${post.title}</h2><div class="post-meta">Publicado por ${post.author} el ${postDate}</div>${audioPlayerHTML}<div class="post-body">${post.content}</div>`;
    
    sidePanelContent.innerHTML = contentHTML;
    sidePanel.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";
    document.dispatchEvent(new CustomEvent('panel-opened'));

    // Si el post tiene un audio, ahora intentamos inicializar Wavesurfer
    if (post.enclosure?.link?.endsWith(".mp3")) {
        if (typeof WaveSurfer === 'undefined') {
            console.error('Wavesurfer.js no está cargado.');
            // Si la librería no carga, mostramos el reproductor nativo directamente
            const playerContainer = document.getElementById('audio-player-container');
            if(playerContainer) playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${post.enclosure.link}" style="width: 100%;"></audio>`;
            return;
        }

        const audioUrl = post.enclosure.link;
        const playerContainer = document.getElementById('audio-player-container');
        
        // Usamos un proxy para intentar evitar el bloqueo de CORS
        const proxiedUrl = `https://thingproxy.freeboard.io/fetch/${audioUrl}`;

        wavesurferInstance = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgb(200, 200, 200)',
            progressColor: 'rgb(183, 42, 30)',
            url: proxiedUrl, // PLAN A: Intentamos cargar vía proxy
            barWidth: 3, barRadius: 3, barGap: 2, height: 80,
        });

        // --- INICIO DE LA LÓGICA DEL PLAN B (RESTAURADA) ---
        wavesurferInstance.on('error', (err) => {
            console.warn('Wavesurfer falló (probablemente por CORS). Usando reproductor nativo como alternativa.', err);
            wavesurferInstance.destroy(); // Destruimos la instancia fallida
            // Reemplazamos el contenedor con el reproductor de audio nativo (nuestro Plan B)
            if (playerContainer) {
                playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${audioUrl}" style="width: 100%;"></audio>`;
            }
        });
        // --- FIN DE LA LÓGICA DEL PLAN B ---

        const playPauseBtn = document.getElementById('play-pause-btn');
        const icon = playPauseBtn?.querySelector('i');
        if (playPauseBtn && icon) {
            playPauseBtn.addEventListener('click', () => wavesurferInstance.playPause());
            wavesurferInstance.on('play', () => { icon.className = 'fa-solid fa-pause'; });
            wavesurferInstance.on('pause', () => { icon.className = 'fa-solid fa-play'; });
        }
    }
}

    function closeSidePanel() {
        if (wavesurferInstance) {
            wavesurferInstance.destroy();
            wavesurferInstance = null;
        }
        const nativeAudioPlayer = sidePanelContent.querySelector('audio');
        if (nativeAudioPlayer) {
            nativeAudioPlayer.pause();
            nativeAudioPlayer.src = '';
        }
        sidePanel.classList.remove("is-open");
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    function displayCategoryPosts(category, gridId, maxPosts) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        const categoryPosts = allPostsData.filter(p => p.categories?.includes(category)).slice(0, maxPosts);
        if (categoryPosts.length === 0) return;
        grid.innerHTML = "";
        categoryPosts.forEach(post => {
            const thumbnail = post.thumbnail || extractFirstImageUrl(post.content);
            const styleAttr = thumbnail ? `style="background-image: url(${thumbnail});"` : "";
            const postHTML = `<div class="bento-box post-card" data-id="${post.guid}" ${styleAttr}><div class="card-content"><h4>${post.title}</h4></div></div>`;
            grid.insertAdjacentHTML("beforeend", postHTML);
        });
    }
    
    function applyTheme(theme) {
        document.body.classList.toggle("dark-theme", theme === "dark");
        const iconClass = theme === "dark" ? "fa-sun" : "fa-moon";
        themeSwitcherDesktop?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun');
        themeSwitcherDesktop?.querySelector('i')?.classList.add('fa-solid', iconClass);
        themeSwitcherMobile?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun');
        themeSwitcherMobile?.querySelector('i')?.classList.add('fa-solid', iconClass);
    }

    function toggleTheme() {
        const isCurrentlyDark = document.body.classList.contains("dark-theme");
        const newTheme = isCurrentlyDark ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
    }

    function extractFirstImageUrl(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const img = doc.querySelector("img");
        return img ? img.src : null;
    }

    function cleanupPostContent() {
        sidePanelContent.querySelectorAll(".pencraft.icon-container")?.forEach(el => el.parentElement.remove());
    }

    function setupShareButtons(config) {
        const link = encodeURIComponent(config.link);
        const title = encodeURIComponent(config.title || document.title);
        document.getElementById("share-fb").onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`);
        document.getElementById("share-li").onclick = () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`);
        document.getElementById("share-wa").onclick = () => window.open(`https://api.whatsapp.com/send?text=${title}%20${link}`);
        document.getElementById("share-x").onclick = () => window.open(`https://twitter.com/intent/tweet?url=${link}&text=${title}`);
        const copyBtn = document.getElementById("copy-link");
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(config.link).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-link"></i>'; }, 2000);
            }).catch(err => console.error("Error al copiar enlace:", err));
        };
    }

    function checkLiveStatus() {
        const isLive = true;
        const desktopBtn = document.getElementById("nav-live-desktop");
        const mobileBtn = document.getElementById("nav-live-mobile");
        if (desktopBtn) desktopBtn.classList.toggle("is-live", isLive);
        if (mobileBtn) {
            mobileBtn.classList.toggle("is-live", isLive);
            mobileBtn.style.color = isLive ? "var(--color-accent)" : "";
        }
    }
    
    // =========================================================================
    // 4. ASIGNACIÓN DE EVENTOS Y LÓGICA DE NAVEGADOR
    // =========================================================================
    themeSwitcherDesktop?.addEventListener("click", toggleTheme);
    themeSwitcherMobile?.addEventListener("click", toggleTheme);
    
    bentoGrid?.addEventListener("click", (event) => {
        const bentoBox = event.target.closest('.bento-box[data-id]');
        if (bentoBox) openSidePanel(bentoBox);
    });
    
    mobileMoreBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        mobileMoreMenu?.classList.toggle("is-open");
    });
    
    mobileMoreMenuClose?.addEventListener("click", () => {
        mobileMoreMenu?.classList.remove("is-open");
    });

    // --- LÓGICA DE CIERRE CENTRALIZADA ---
    sidePanelClose?.addEventListener("click", () => {
        if (history.state?.panelIsOpen) history.back();
        else closeSidePanel(); // Fallback por si no hay estado en el historial
    });
    overlay?.addEventListener("click", () => {
        if (history.state?.panelIsOpen) history.back();
        else closeSidePanel();
        mobileMoreMenu?.classList.remove("is-open");
    });
    
    // Al abrir CUALQUIER panel, empujamos un estado al historial
    document.addEventListener('panel-opened', () => {
        history.pushState({ panelIsOpen: true }, '');
    });

    // El "guardia" que escucha el botón "atrás" del navegador/celular
    window.addEventListener('popstate', () => {
        if (sidePanel.classList.contains('is-open')) {
            if (sidePanelContent.classList.contains('side-panel__content--video')) {
                document.dispatchEvent(new CustomEvent('close-shorts-player'));
            } else {
                closeSidePanel();
            }
        }
    });
    
    // =========================================================================
    // 5. INICIALIZACIÓN
    // =========================================================================
    function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        initHero();
        loadPosts();
        checkLiveStatus();

         // Inicializa Atropos en nuestro nuevo banner
            if (document.querySelector('.my-atropos')) {
                Atropos({
                    el: '.my-atropos',
                    activeOffset: 40,
                    shadow: true,
                    shadowScale: 2.05,
                });
            }

    function initHero() {
            const heroButton = document.getElementById('scroll-to-content-btn');
            const desktopScrollTarget = document.querySelector('.desktop-nav');
            const desktopNav = document.querySelector('.desktop-nav');
            const mobileNav = document.querySelector('.mobile-nav');

            // Lógica para el botón de scroll
            if (heroButton && desktopScrollTarget) {
                heroButton.addEventListener('click', () => {
                    desktopScrollTarget.scrollIntoView({ behavior: 'smooth' });
                });
            }
            
            // Lógica para ambos menús al hacer scroll
            if (desktopNav && mobileNav) {
                const checkNavPosition = () => {
                    if (window.scrollY < 50) {
                        // Escritorio: transparente
                        desktopNav.classList.add('is-at-top');
                        // Móvil: NO visible
                        mobileNav.classList.remove('is-visible'); 
                    } else {
                        // Escritorio: con fondo
                        desktopNav.classList.remove('is-at-top');
                        // Móvil: SÍ visible
                        mobileNav.classList.add('is-visible');
                    }
                };
                
                window.addEventListener('scroll', checkNavPosition);
                checkNavPosition();
            }
            
            // Inicializa Atropos
            if (document.querySelector('.my-atropos')) {
                Atropos({
                    el: '.my-atropos',
                    activeOffset: 40,
                    shadow: false,
                });
            }
        }
    }

    init();
});