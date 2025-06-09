/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * =========================================================================
 *
 * Este archivo se encarga de:
 * - Gestionar el tema claro/oscuro y guardarlo en la memoria del navegador.
 * - Cargar las publicaciones desde el feed RSS de Substack a través de una API.
 * - Construir y mostrar dinámicamente el Bento Grid con las publicaciones.
 * - Manejar toda la interactividad del panel lateral para leer los posts.
 * - Limpiar el contenido de los posts (eliminando elementos de Substack).
 * - Gestionar la funcionalidad de los botones para compartir en redes sociales.
 */

// 'DOMContentLoaded' espera a que todo el HTML esté listo antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. CONSTANTES Y SELECTORES DEL DOM
    // =========================================================================
    // Referencias a los elementos del HTML que vamos a manipular.
    const bentoGrid = document.getElementById('bento-grid');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    
    // Selectores para elementos con versiones de escritorio y móvil.
    const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
    const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');

    // Constantes de la aplicación.
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

    // =========================================================================
    // 2. PLANTILLAS DE MÓDULOS ESTÁTICOS
    // =========================================================================
    // Definimos los bloques de HTML aquí para mantener las funciones más limpias.
    
    const welcomeModuleHTML = `<div class="bento-box welcome-module bento-box--4x1" data-id="static-welcome"><h2>Una Galería de Conocimiento Curada</h2><p>Explora la intersección entre tecnología, ciencia y cultura.</p></div>`;
    
    const topStaticModulesHTML = `<div class="bento-box bento-box--4x1" data-id="static-quote" style="cursor:default;"><div class="card-content" style="text-align: center;"><p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p><h4 style="margin-top: 0.5rem;">- Anónimo</h4></div></div>`;
    
    const inFeedModuleHTML = `<div class="bento-box bento-box--2x1 bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro boletín para no perderte ninguna publicación.</p></div></div>`;
    
    const endStaticModulesHTML = `<div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div><div class="bento-box collaborators-module bento-box--2x2"><div class="card-content"><h3>Colaboradores</h3><p>Logo 1 | Logo 2 | Logo 3</p></div></div>`;


    // =========================================================================
    // 3. ESTADO DE LA APLICACIÓN
    // =========================================================================
    let allPostsData = []; // Almacenará los datos de todos los posts.


    // =========================================================================
    // 4. FUNCIONES PRINCIPALES
    // =========================================================================

    /**
     * Carga las publicaciones desde la API de forma asíncrona.
     */
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
                displayPosts(allPostsData);
            } else { throw new Error('La respuesta de la API no fue exitosa.'); }
        } catch (error) {
            console.error('Falló la carga de publicaciones:', error);
            bentoGrid.innerHTML = '<div class="error">No se pudieron cargar las publicaciones.</div>';
        }
    }

    /**
     * Construye y muestra todo el Bento Grid, insertando los módulos en orden.
     * @param {Array} posts - El array de posts de la API.
     */
    function displayPosts(posts) {
        bentoGrid.insertAdjacentHTML('beforeend', welcomeModuleHTML);
        bentoGrid.insertAdjacentHTML('beforeend', topStaticModulesHTML);

        posts.forEach((post, index) => {
            if (index === 4) {
                bentoGrid.insertAdjacentHTML('beforeend', inFeedModuleHTML);
            }
            
            const isAudio = post.enclosure?.link?.endsWith('.mp3');
            let imageUrl = post.thumbnail;
            if (!imageUrl || imageUrl === "") {
                imageUrl = extractFirstImageUrl(post.content);
            }
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

    /**
     * Abre el panel lateral con el contenido de un post.
     * @param {string} postId - El ID (guid) del post a mostrar.
     */
    function openSidePanel(postId) {
        const postData = allPostsData.find(p => p.guid === postId);
        if (!postData) return;
        const postDate = new Date(postData.pubDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        let contentHTML = `<h2>${postData.title}</h2><div class="post-meta">Publicado por ${postData.author} el ${postDate}</div><div class="post-body">${postData.content}</div>`;
        if (postData.enclosure?.link?.endsWith('.mp3')) {
            contentHTML += `<audio controls controlsList="nodownload" src="${postData.enclosure.link}"></audio>`;
        }
        sidePanelContent.innerHTML = contentHTML;
        cleanupPostContent();
        setupShareButtons(postData);
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Cierra el panel lateral.
     */
    function closeSidePanel() {
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // =========================================================================
    // 5. FUNCIONES AUXILIARES (HELPERS)
    // =========================================================================

    function applyTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
    }

    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }
    
    /**
     * Extrae la URL de la primera imagen del contenido HTML de un post.
     * @param {string} htmlContent - El string de HTML.
     * @returns {string|null} - La URL de la imagen o null si no existe.
     */
    function extractFirstImageUrl(htmlContent) {
        // Creamos un elemento DOM temporal en memoria para analizar el HTML de forma segura.
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const firstImage = doc.querySelector('img');
        return firstImage ? firstImage.src : null;
    }

    function cleanupPostContent() {
        const selectorDeIconos = '.pencraft.icon-container';
        sidePanelContent.querySelectorAll(selectorDeIconos)?.forEach(toolbar => toolbar.parentElement.remove());
    }

    function setupShareButtons(postData) {
        const url = encodeURIComponent(postData.link);
        const title = encodeURIComponent(postData.title);
        document.getElementById('share-fb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
        document.getElementById('share-li').onclick = () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`);
        document.getElementById('share-wa').onclick = () => window.open(`https://api.whatsapp.com/send?text=${title}%20${url}`);
        document.getElementById('share-x').onclick = () => window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`);
        
        const copyBtn = document.getElementById('copy-link');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(postData.link).then(() => {
                const originalIconHTML = `<i class="fa-solid fa-link"></i>`;
                copyBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
                setTimeout(() => { copyBtn.innerHTML = originalIconHTML; }, 2000);
            }).catch(err => console.error('Error al copiar el enlace:', err));
        };
    }
    
    function checkLiveStatus() {
        const liveEstaActivo = true; // Simulación: cambia a false para probar
        const liveIconDesktop = document.getElementById('nav-live-desktop');
        const liveIconMobile = document.getElementById('nav-live-mobile');
        
        // Se asegura de que los elementos existan antes de manipularlos
        if (liveIconDesktop) {
            liveIconDesktop.classList.toggle('is-live', liveEstaActivo);
        }
        if (liveIconMobile) {
            liveIconMobile.classList.toggle('is-live', liveEstaActivo);
            liveIconMobile.style.color = liveEstaActivo ? 'var(--color-accent)' : '';
        }
    }


    // =========================================================================
    // 6. MANEJADORES DE EVENTOS (EVENT LISTENERS)
    // =========================================================================
    
    if (themeSwitcherDesktop) themeSwitcherDesktop.addEventListener('click', toggleTheme);
    if (themeSwitcherMobile) themeSwitcherMobile.addEventListener('click', toggleTheme);
    
    if(sidePanelClose) sidePanelClose.addEventListener('click', closeSidePanel);
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeSidePanel();
            if (mobileMoreMenu) mobileMoreMenu.classList.remove('is-open');
        });
    }

    if (bentoGrid) {
        bentoGrid.addEventListener('click', e => {
            const clickedCard = e.target.closest('.bento-box[data-id]');
            if (clickedCard && !clickedCard.dataset.id.startsWith('static')) {
                openSidePanel(clickedCard.dataset.id);
            }
        });
    }

    if (mobileMoreBtn) {
        mobileMoreBtn.addEventListener('click', e => {
            e.stopPropagation(); // Evita que el clic se propague y cierre el menú inmediatamente.
            if (mobileMoreMenu) mobileMoreMenu.classList.toggle('is-open');
        });
    }
    
    if (mobileMoreMenuClose) {
        mobileMoreMenuClose.addEventListener('click', () => {
            if (mobileMoreMenu) mobileMoreMenu.classList.remove('is-open');
        });
    }


    // =========================================================================
    // 7. INICIALIZACIÓN
    // =========================================================================
    
    function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        loadPosts();
        checkLiveStatus();
    }
    
    init();
});