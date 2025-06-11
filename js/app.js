/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * =========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. CONSTANTES Y SELECTORES DEL DOM
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

    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

    // =========================================================================
    // 2. PLANTILLAS DE MÓDULOS ESTÁTICOS
    // =========================================================================
    const welcomeModuleHTML = `<div class="bento-box welcome-module bento-box--4x1" data-id="static-welcome"><h2>Una Galería de Conocimiento Curada</h2><p>Explora la intersección entre tecnología, ciencia y cultura.</p></div>`;
    const topStaticModulesHTML = `<div class="bento-box bento-box--4x1" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`;
    
    // Plantillas para Plyr.io
    const videoStoriesModuleHTML = `
        <div class="bento-box bento-box--1x3 video-stories-module" data-id="static-video-stories">
            <div class="story-player-wrapper">
                <div class="story-player is-active" data-plyr-provider="youtube" data-plyr-embed-id="MlJYzpXrlq8"></div>
                <div class="story-player" data-plyr-provider="youtube" data-plyr-embed-id="2E0mxIYMGAM"></div>
                <div class="story-player" data-plyr-provider="youtube" data-plyr-embed-id="ldeQjvd6x5U"></div>
            </div>
            <div class="story-controls">
                <button class="story-button" id="story-volume-btn" aria-label="Activar sonido"><i class="fa-solid fa-volume-xmark"></i></button>
                <button class="story-button" id="story-next-btn" aria-label="Siguiente historia"><i class="fa-solid fa-angle-right"></i></button>
            </div>
        </div>
    `;
    const videoFeaturedModuleHTML = `
        <div class="bento-box bento-box--2x2 video-featured-module" data-id="static-video-featured">
             <div id="video-featured-player" data-plyr-provider="youtube" data-plyr-embed-id="2Vq_N_wgUkk"></div>
        </div>
    `;
    
    const inFeedModuleHTML = `<div class="bento-box bento-box--2x1 bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro boletín para no perderte ninguna publicación.</p></div></div>`;
    
    const endStaticModulesHTML = `
        <div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo">
            <div class="card-content">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg>
                <h3>Conocimiento Citable</h3>
                <p>Accede a nuestros datasets y preprints.</p>
                <a href="#" class="btn">Visitar Repositorio</a>
            </div>
        </div>
        <div class="bento-box bento-box--2x2 bento-box--imagen" 
             data-id="static-video" 
             data-panel-type="embed" 
             data-panel-title="Video Destacado"
             data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ">
             <div class="card-content">
                <span class="card-category">Ver Ahora</span>
                <h4>El Futuro de la Exploración Espacial</h4>
            </div>
        </div>`;
        
    let allPostsData = [];

    async function loadPosts() {
        if (!bentoGrid) { console.error('Error Crítico: El contenedor .bento-grid no fue encontrado.'); return; }
        bentoGrid.innerHTML = '<div class="loading">Cargando publicaciones...</div>';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error en la red: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                allPostsData = data.items;
                bentoGrid.innerHTML = '';
                const categoryGrids = document.querySelectorAll('.category-grid');
                categoryGrids.forEach(grid => grid.innerHTML = '');
                displayPosts(allPostsData);
                displayCategoryPosts('Cultura', 'cultura-grid', 3);
            } else { 
                throw new Error('La respuesta de la API no fue exitosa.');
            }
        } catch (error) {
            console.error('Falló la carga de publicaciones:', error);
            bentoGrid.innerHTML = '<div class="error">No se pudieron cargar las publicaciones.</div>';
        }
    }

    function displayPosts(posts) {
        bentoGrid.insertAdjacentHTML('beforeend', welcomeModuleHTML);
        bentoGrid.insertAdjacentHTML('beforeend', topStaticModulesHTML);
        bentoGrid.insertAdjacentHTML('beforeend', videoStoriesModuleHTML); 
        posts.forEach((post, index) => {
            if (index === 2) { 
                bentoGrid.insertAdjacentHTML('beforeend', videoFeaturedModuleHTML);
            }
            if (index === 4) {
                bentoGrid.insertAdjacentHTML('beforeend', inFeedModuleHTML);
            }
            const isAudio = post.enclosure?.link?.endsWith('.mp3');
            let imageUrl = post.thumbnail || extractFirstImageUrl(post.content);
            let backgroundStyle = '', cardCategory = 'Artículo', sizeClass = '';
            if (isAudio) {
                backgroundStyle = `style="background-image: url(${audioPostBackground});"`;
                cardCategory = 'Podcast';
            } else if (imageUrl) {
                backgroundStyle = `style="background-image: url(${imageUrl});"`;
                cardCategory = 'Publicación';
            }
            if (index === 0) sizeClass = 'bento-box--2x2';
            else if (index % 5 === 1) sizeClass = 'bento-box--1x2';
            else if (index % 5 === 3) sizeClass = 'bento-box--2x1';
            const postHTML = `<div class="bento-box post-card ${sizeClass}" data-id="${post.guid}" ${backgroundStyle}><div class="card-content"><span class="card-category">${cardCategory}</span><h4>${post.title}</h4></div></div>`;
            bentoGrid.insertAdjacentHTML('beforeend', postHTML);
        });
        bentoGrid.insertAdjacentHTML('beforeend', endStaticModulesHTML);
    }

    function openSidePanel(cardElement) {
        const dataset = cardElement.dataset;
        if (dataset.id === 'static-video-stories' || dataset.id === 'static-video-featured') {
            return; 
        }
        let contentHTML = ''; 
        let shareableLink = window.location.href; 
        if (dataset.panelType === 'embed' && dataset.embedSrc) {
            const title = dataset.panelTitle || 'Contenido Adicional';
            contentHTML = `
                <h2>${title}</h2>
                <div class="post-body">
                    <div class="iframe-container">
                        <iframe src="${dataset.embedSrc}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                </div>
            `;
            shareableLink = dataset.embedSrc; 
        } else {
            const postData = allPostsData.find(p => p.guid === dataset.id);
            if (!postData) return;
            shareableLink = postData.link; 
            const postDate = new Date(postData.pubDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            let audioPlayerHTML = '';
            if (postData.enclosure?.link?.endsWith('.mp3')) {
                audioPlayerHTML = `<audio controls controlsList="nodownload" src="${postData.enclosure.link}"></audio>`;
            }
            contentHTML = `
                <h2>${postData.title}</h2>
                <div class="post-meta">Publicado por ${postData.author} el ${postDate}</div>
                ${audioPlayerHTML}
                <div class="post-body">${postData.content}</div>
            `;
        }
        sidePanelContent.innerHTML = contentHTML;
        cleanupPostContent();
        setupShareButtons({ link: shareableLink }); 
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function closeSidePanel() {
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }
    
    function displayCategoryPosts(categoryName, targetElementId, postLimit) {
        const targetGrid = document.getElementById(targetElementId);
        if (!targetGrid) { return; }
        const filteredPosts = allPostsData.filter(post => post.categories && post.categories.includes(categoryName)).slice(0, postLimit);
        if (filteredPosts.length === 0) { return; }
        targetGrid.innerHTML = ''; 
        filteredPosts.forEach(post => {
            let imageUrl = post.thumbnail || extractFirstImageUrl(post.content);
            let backgroundStyle = imageUrl ? `style="background-image: url(${imageUrl});"` : '';
            const postHTML = `<div class="bento-box post-card" data-id="${post.guid}" ${backgroundStyle}><div class="card-content"><h4>${post.title}</h4></div></div>`;
            targetGrid.insertAdjacentHTML('beforeend', postHTML);
        });
    }

    function applyTheme(theme) { document.body.classList.toggle('dark-theme', theme === 'dark'); }
    function toggleTheme() { const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark'; localStorage.setItem('theme', newTheme); applyTheme(newTheme); }
    function extractFirstImageUrl(htmlContent) { const parser = new DOMParser(); const doc = parser.parseFromString(htmlContent, 'text/html'); const firstImage = doc.querySelector('img'); return firstImage ? firstImage.src : null; }
    function cleanupPostContent() { sidePanelContent.querySelectorAll('.pencraft.icon-container')?.forEach(toolbar => toolbar.parentElement.remove()); }
    function setupShareButtons(shareData) {
        const url = encodeURIComponent(shareData.link);
        const title = encodeURIComponent(shareData.title || document.title);
        document.getElementById('share-fb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
        document.getElementById('share-li').onclick = () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`);
        document.getElementById('share-wa').onclick = () => window.open(`https://api.whatsapp.com/send?text=${title}%20${url}`);
        document.getElementById('share-x').onclick = () => window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`);
        const copyBtn = document.getElementById('copy-link');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(shareData.link).then(() => {
                const originalIconHTML = `<i class="fa-solid fa-link"></i>`;
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
                setTimeout(() => { copyBtn.innerHTML = originalIconHTML; }, 2000);
            }).catch(err => console.error('Error al copiar el enlace:', err));
        };
    }
    function checkLiveStatus() {
        const liveEstaActivo = true; 
        const liveIconDesktop = document.getElementById('nav-live-desktop');
        const liveIconMobile = document.getElementById('nav-live-mobile');
        if (liveIconDesktop) { liveIconDesktop.classList.toggle('is-live', liveEstaActivo); }
        if (liveIconMobile) { liveIconMobile.classList.toggle('is-live', liveEstaActivo); liveIconMobile.style.color = liveEstaActivo ? 'var(--color-accent)' : ''; }
    }

    if (themeSwitcherDesktop) themeSwitcherDesktop.addEventListener('click', toggleTheme);
    if (themeSwitcherMobile) themeSwitcherMobile.addEventListener('click', toggleTheme);
    if(sidePanelClose) sidePanelClose.addEventListener('click', closeSidePanel);
    if (overlay) { overlay.addEventListener('click', () => { closeSidePanel(); if (mobileMoreMenu) mobileMoreMenu.classList.remove('is-open'); }); }
    if (bentoGrid) {
        bentoGrid.addEventListener('click', e => {
            const clickedCard = e.target.closest('.bento-box[data-id]');
            if (clickedCard) {
                openSidePanel(clickedCard);
            }
        });
    }
    if (mobileMoreBtn) { mobileMoreBtn.addEventListener('click', e => { e.stopPropagation(); if (mobileMoreMenu) mobileMoreMenu.classList.toggle('is-open'); }); }
    if (mobileMoreMenuClose) { mobileMoreMenuClose.addEventListener('click', () => { if (mobileMoreMenu) mobileMoreMenu.classList.remove('is-open'); }); }
    
    function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        loadPosts();
        checkLiveStatus();
    }
    init();
});