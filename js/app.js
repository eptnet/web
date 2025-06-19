/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * Versión 9.2 - COMPLETA Y CON TODAS LAS FUNCIONES ACTIVADAS
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. CONFIGURACIÓN E INICIALIZACIÓN DE SERVICIOS
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 2. SELECCIÓN DE ELEMENTOS DEL DOM
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

    // 3. CONSTANTES Y PLANTILLAS HTML
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=13';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';
    const topStaticModulesHTML = `<div class="bento-box welcome-module bento-box--2x2" data-id="static-welcome" style="cursor: default;"><h2>¿Investigas, divulgas o simplemente quieres entender mejor el mundo?</h2><p>Te damos la bienvenida a <strong>Epistecnología</strong>, una <strong>plataforma abierta de divulgación científica y cultural</strong> que pone la <strong>tecnología al servicio del conocimiento con sabiduría</strong>. Aquí, investigadores, docentes, divulgadores y curiosos del saber encuentran un espacio para <strong>crear, compartir y explorar contenidos académicos</strong>.</p></div>`;
    const videoStoriesCardHTML = `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/cSX1NWyR/sterieweb-Whisk-3577df53ea.jpg'); cursor: pointer; background-size: cover; background-position: center;"><div class="card-content"><span class="card-category" style="color: white;">Colección</span><h4 style="color: white;">Minuto cultural</h4></div></div>`;
    const quoteCardHTML = `<div class="bento-box bento-box--1x2" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`;
    const videoFeaturedModuleHTML = `<div class="bento-box bento-box--2x2 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/6PSKbO5yfDQ?rel=0&modestbranding=1&playsinline=1" title="Video destacado de YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    const inFeedModuleHTML = `<div class="bento-box bento-box--2x2 mobile-full-width bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro newsletter.</p><br/><iframe src="https://eptnews.substack.com/embed" width="100%" height="100%" style="border:0;" frameborder="0" scrolling="no"></iframe></div></div>`;
    const endStaticModulesHTML = `<div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div><div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><div class="card-content"><span class="card-category">Ver Ahora</span><h4>El Futuro de la Exploración Espacial</h4></div></div>`;
        
    // 4. LÓGICA PRINCIPAL (FUNCIONES)
    let allPostsData = [];
    let wavesurferInstance = null;

    async function loadPosts() { if (!bentoGrid) return; bentoGrid.innerHTML = '<div class="loading">Cargando...</div>'; try { const response = await fetch(apiUrl); if (!response.ok) throw new Error(`Error de red: ${response.statusText}`); const data = await response.json(); if (data.status === 'ok' && data.items) { allPostsData = data.items; bentoGrid.innerHTML = ""; displayPosts(allPostsData); displayCategoryPosts("Cultura", "cultura-grid", 3); } else { throw new Error("Respuesta de API no fue exitosa."); } } catch (error) { console.error("Falló la carga de posts:", error); bentoGrid.innerHTML = '<div class="error">No se pudieron cargar los posts.</div>'; } }
    function displayPosts(items) { bentoGrid.insertAdjacentHTML("beforeend", topStaticModulesHTML); bentoGrid.insertAdjacentHTML("beforeend", videoStoriesCardHTML); bentoGrid.insertAdjacentHTML("beforeend", quoteCardHTML); items.forEach((item, index) => { if (index === 3) bentoGrid.insertAdjacentHTML("beforeend", videoFeaturedModuleHTML); if (index === 7) bentoGrid.insertAdjacentHTML("beforeend", inFeedModuleHTML); const isAudio = item.enclosure?.link?.endsWith(".mp3"); const thumbnail = item.thumbnail || extractFirstImageUrl(item.content); const cardImageStyle = thumbnail ? `style="background-image: url(${thumbnail});"` : (isAudio ? `style="background-image: url(${audioPostBackground});"` : ''); const cardType = isAudio ? "Podcast" : "Publicación"; let cardSizeClass = "bento-box--1x1"; if (index === 0) cardSizeClass = "bento-box--2x2"; else if (index % 3 === 2) cardSizeClass = "bento-box--1x2"; const postCardHTML = `<div class="bento-box post-card ${cardSizeClass}" data-id="${item.guid}" ${cardImageStyle}><div class="card-content"><span class="card-category">${cardType}</span><h4>${item.title}</h4></div></div>`; bentoGrid.insertAdjacentHTML("beforeend", postCardHTML); }); bentoGrid.insertAdjacentHTML("beforeend", endStaticModulesHTML); }
    function openSidePanel(clickedElement) { if (sidePanel.classList.contains('is-open')) return; const dataset = clickedElement.dataset; if (dataset.id === "static-launch-stories") { document.dispatchEvent(new CustomEvent('launch-stories')); return; } if (dataset.id === "static-video-featured" || dataset.id === "static-welcome" || dataset.id === "static-quote" || dataset.id === "static-zenodo") return; const post = allPostsData.find(p => p.guid === dataset.id); if (!post) return; const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }); const audioPlayerHTML = post.enclosure?.link?.endsWith(".mp3") ? `<div id="audio-player-container"><button id="play-pause-btn" aria-label="Reproducir/Pausar"><i class="fa-solid fa-play"></i></button><div id="waveform"></div></div>` : ""; const contentHTML = `<h2>${post.title}</h2><div class="post-meta">Publicado por ${post.author} el ${postDate}</div>${audioPlayerHTML}<div class="post-body">${post.content}</div>`; sidePanelContent.innerHTML = contentHTML; sidePanel.classList.add("is-open"); overlay.classList.add("is-open"); document.body.style.overflow = "hidden"; document.dispatchEvent(new CustomEvent('panel-opened')); if (post.enclosure?.link?.endsWith(".mp3")) { const audioUrl = post.enclosure.link; const playerContainer = document.getElementById('audio-player-container'); if (typeof WaveSurfer === 'undefined') { if (playerContainer) playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${audioUrl}" style="width: 100%;"></audio>`; return; } wavesurferInstance = WaveSurfer.create({ container: '#waveform', waveColor: 'rgb(200, 200, 200)', progressColor: 'rgb(183, 42, 30)', url: `https://thingproxy.freeboard.io/fetch/${audioUrl}`, barWidth: 3, barRadius: 3, barGap: 2, height: 80 }); wavesurferInstance.on('error', () => { wavesurferInstance.destroy(); if (playerContainer) playerContainer.innerHTML = `<audio controls autoplay controlsList="nodownload" src="${audioUrl}" style="width: 100%;"></audio>`; }); const playPauseBtn = document.getElementById('play-pause-btn'); const icon = playPauseBtn?.querySelector('i'); if (playPauseBtn && icon) { playPauseBtn.addEventListener('click', () => wavesurferInstance.playPause()); wavesurferInstance.on('play', () => { icon.className = 'fa-solid fa-pause'; }); wavesurferInstance.on('pause', () => { icon.className = 'fa-solid fa-play'; }); } } }
    function closeSidePanel() { if (sidePanelContent.classList.contains('side-panel__content--video')) { document.dispatchEvent(new CustomEvent('close-shorts-player')); } if (wavesurferInstance) { wavesurferInstance.destroy(); wavesurferInstance = null; } const nativeAudioPlayer = sidePanelContent.querySelector('audio'); if (nativeAudioPlayer) { nativeAudioPlayer.pause(); nativeAudioPlayer.src = ''; } sidePanel.classList.remove("is-open"); overlay.classList.remove("is-open"); document.body.style.overflow = ""; }
    function displayCategoryPosts(category, gridId, maxPosts) { const grid = document.getElementById(gridId); if (!grid) return; const categoryPosts = allPostsData.filter(p => p.categories?.includes(category)).slice(0, maxPosts); if (categoryPosts.length === 0) return; grid.innerHTML = ""; categoryPosts.forEach(post => { const thumbnail = post.thumbnail || extractFirstImageUrl(post.content); const styleAttr = thumbnail ? `style="background-image: url(${thumbnail});"` : ""; const postHTML = `<div class="bento-box post-card" data-id="${post.guid}" ${styleAttr}><div class="card-content"><h4>${post.title}</h4></div></div>`; grid.insertAdjacentHTML("beforeend", postHTML); }); }
    function applyTheme(theme) { document.body.classList.toggle("dark-theme", theme === "dark"); const iconClass = theme === "dark" ? "fa-sun" : "fa-moon"; themeSwitcherDesktop?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun'); themeSwitcherDesktop?.querySelector('i')?.classList.add('fa-solid', iconClass); themeSwitcherMobile?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun'); themeSwitcherMobile?.querySelector('i')?.classList.add('fa-solid', iconClass); }
    function toggleTheme() { const isCurrentlyDark = document.body.classList.contains("dark-theme"); const newTheme = isCurrentlyDark ? "light" : "dark"; localStorage.setItem("theme", newTheme); applyTheme(newTheme); }
    function extractFirstImageUrl(htmlContent) { const parser = new DOMParser(); const doc = parser.parseFromString(htmlContent, "text/html"); const img = doc.querySelector("img"); return img ? img.src : null; }
    function cleanupPostContent() { sidePanelContent.querySelectorAll(".pencraft.icon-container")?.forEach(el => el.parentElement.remove()); }
    function setupShareButtons(config) { const link = encodeURIComponent(config.link); const title = encodeURIComponent(config.title || document.title); const fb = document.getElementById("share-fb"); if(fb) fb.onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`); const li = document.getElementById("share-li"); if(li) li.onclick = () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${link}&title=${title}`); const wa = document.getElementById("share-wa"); if(wa) wa.onclick = () => window.open(`https://api.whatsapp.com/send?text=${title}%20${link}`); const x = document.getElementById("share-x"); if(x) x.onclick = () => window.open(`https://twitter.com/intent/tweet?url=${link}&text=${title}`); const copyBtn = document.getElementById("copy-link"); if(copyBtn) copyBtn.onclick = () => { navigator.clipboard.writeText(config.link).then(() => { copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { copyBtn.innerHTML = '<i class="fa-solid fa-link"></i>'; }, 2000); }).catch(err => console.error("Error al copiar enlace:", err)); }; }
    function checkLiveStatus() { const isLive = true; const desktopBtn = document.getElementById("nav-live-desktop"); const mobileBtn = document.getElementById("nav-live-mobile"); if (desktopBtn) desktopBtn.classList.toggle("is-live", isLive); if (mobileBtn) { mobileBtn.classList.toggle("is-live", isLive); mobileBtn.style.color = isLive ? "var(--color-accent)" : ""; } }
    
    // --- FUNCIÓN DEL BANNER DE BIENVENIDA (HERO) ---
    function initHero() {
    const heroButton = document.getElementById('scroll-to-content-btn');
    const desktopScrollTarget = document.querySelector('.desktop-nav');
    const desktopNav = document.querySelector('.desktop-nav');
    const mobileNav = document.querySelector('.mobile-nav');

    // Lógica para el botón de scroll (sin cambios)
    if (heroButton && desktopScrollTarget) {
        heroButton.addEventListener('click', () => {
            desktopScrollTarget.scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Lógica para ambos menús al hacer scroll
    if (desktopNav && mobileNav) {
        const checkNavPosition = () => {
            // Lógica para el menú de escritorio (sin cambios)
            if (window.scrollY < 50) {
                desktopNav.classList.add('is-at-top');
            } else {
                desktopNav.classList.remove('is-at-top');
            }

            // --- NUEVA LÓGICA DIRECTA PARA EL MENÚ MÓVIL ---
            // En lugar de usar clases, aplicamos el estilo de transformación directamente.
            if (window.scrollY < 50) {
                // Si estamos arriba, lo movemos 100% hacia abajo (fuera de la pantalla).
                mobileNav.style.transform = 'translateY(100%)';
            } else {
                // Si hacemos scroll, lo movemos a su posición original (0).
                mobileNav.style.transform = 'translateY(0)';
            }
        };
        
        window.addEventListener('scroll', checkNavPosition);
        checkNavPosition(); // La llamamos una vez para el estado inicial
    }
    
    // Inicializa Atropos (sin cambios)
    if (typeof Atropos !== 'undefined' && document.querySelector('.my-atropos')) {
        Atropos({
            el: '.my-atropos',
            activeOffset: 40,
            shadow: false,
        });
    }
}

    // 5. LÓGICA DE AUTENTICACIÓN Y EVENTOS
    function showUserUI(user) { const userView = document.getElementById('user-view'); const guestView = document.getElementById('guest-view'); const avatarLink = document.getElementById('user-avatar-link'); const logoutBtn = document.getElementById('logout-btn'); if (userView && guestView && avatarLink) { guestView.style.display = 'none'; userView.style.display = 'flex'; const avatarUrl = user.user_metadata?.avatar_url || 'img/default-avatar.png'; const userName = user.user_metadata?.full_name || user.email; avatarLink.innerHTML = `<img src="${avatarUrl}" alt="Avatar de ${userName}" style="width: 32px; height: 32px; border-radius: 50%;">`; logoutBtn?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); }, { once: true }); } }
    function showGuestUI() { const userView = document.getElementById('user-view'); const guestView = document.getElementById('guest-view'); if (userView && guestView) { userView.style.display = 'none'; guestView.style.display = 'flex'; } }
    supabaseClient.auth.onAuthStateChange((event, session) => { if (session && session.user) { showUserUI(session.user); 
        if (event === 'SIGNED_IN') { window.location.href = '/inv/dashboard.html'; } } else { showGuestUI(); } });
    async function handleOAuthLogin(provider) { 
        const { error } = await supabaseClient.auth.signInWithOAuth({ 
            provider, options: { redirectTo: window.location.origin + '/inv/dashboard.html' } }); 
        if (error) console.error(`Error al iniciar sesión con ${provider}:`, error); }
    const loginMenuTrigger = document.getElementById('login-menu-trigger'); const loginPopover = document.getElementById('login-popover');
    loginMenuTrigger?.addEventListener('click', (e) => { e.stopPropagation(); loginPopover?.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (!loginMenuTrigger?.contains(e.target) && !loginPopover?.contains(e.target)) loginPopover?.classList.remove('is-open'); });
    document.getElementById('login-google-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    document.getElementById('login-github-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    document.getElementById('login-google-btn-mobile')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    document.getElementById('login-github-btn-mobile')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    themeSwitcherDesktop?.addEventListener("click", toggleTheme);
    themeSwitcherMobile?.addEventListener("click", toggleTheme);
    sidePanelClose?.addEventListener("click", closeSidePanel);
    overlay?.addEventListener("click", () => { closeSidePanel(); mobileMoreMenu?.classList.remove("is-open"); });
    bentoGrid?.addEventListener("click", (event) => { const bentoBox = event.target.closest('.bento-box[data-id]'); if (bentoBox) openSidePanel(bentoBox); });
    mobileMoreBtn?.addEventListener("click", (event) => { event.stopPropagation(); mobileMoreMenu?.classList.toggle("is-open"); });
    mobileMoreMenuClose?.addEventListener("click", () => { mobileMoreMenu?.classList.remove("is-open"); });

    // 6. INICIALIZACIÓN
    function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        initHero();
        loadPosts();
        checkLiveStatus();
    }
    init();
});