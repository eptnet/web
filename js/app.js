/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * =========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. CONSTANTES Y SELECTORES DEL DOM (CORREGIDOS)
    // =========================================================================
    // Ahora seleccionamos los elementos con sus IDs únicos para escritorio y móvil.
    const bentoGrid = document.getElementById('bento-grid');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    
    // Selectores para cambio de tema
    const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
    const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');

    // Selectores para menú móvil "Más"
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');

    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

    // =========================================================================
    // 2. ESTADO DE LA APLICACIÓN
    // =========================================================================
    let allPostsData = [];

    // =========================================================================
    // 3. FUNCIONES PRINCIPALES
    // =========================================================================
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

    function displayPosts(posts) {
        const welcomeModuleHTML = `
            <div class="bento-box welcome-module bento-box--4x1" data-id="static-welcome">
                <h2>Epistecnología</h2>
                <p>Plataforma para la divulgación del conocimiento producido con Sabiduría para el bien integral de la sociedad.</p>
            </div>
        `;
        bentoGrid.insertAdjacentHTML('beforeend', welcomeModuleHTML);
        
        posts.forEach((post, index) => {
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
    }

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

    function closeSidePanel() {
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // =========================================================================
    // 4. FUNCIONES AUXILIARES (HELPERS)
    // =========================================================================
    function applyTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
    }

    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }
    
    function extractFirstImageUrl(htmlContent) {
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
        const liveEstaActivo = true;
        const liveIconDesktop = document.getElementById('nav-live-desktop');
        const liveIconMobile = document.getElementById('nav-live-mobile');
        if (liveIconDesktop) {
            liveIconDesktop.classList.toggle('is-live', liveEstaActivo);
        }
        if (liveIconMobile) {
            liveIconMobile.classList.toggle('is-live', liveEstaActivo);
            liveIconMobile.style.color = liveEstaActivo ? 'var(--color-accent)' : '';
        }
    }

    // =========================================================================
    // 5. MANEJADORES DE EVENTOS (EVENT LISTENERS)
    // =========================================================================
    
    // Se asegura de que los listeners solo se añadan si los botones existen.
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
            e.stopPropagation();
            if (mobileMoreMenu) mobileMoreMenu.classList.toggle('is-open');
        });
    }
    
    if (mobileMoreMenuClose) {
        mobileMoreMenuClose.addEventListener('click', () => {
            if (mobileMoreMenu) mobileMoreMenu.classList.remove('is-open');
        });
    }

    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================
    function init() {
        applyTheme(localStorage.getItem('theme') || 'light');
        loadPosts();
        checkLiveStatus();
    }
    
    init();
});