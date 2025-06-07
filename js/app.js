document.addEventListener('DOMContentLoaded', () => {
    // --- SELECTORES DE ELEMENTOS ---
    const bentoGrid = document.getElementById('bento-grid');
    const themeSwitcher = document.getElementById('theme-switcher');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

    // --- VARIABLES Y CONSTANTES ---
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';
    let allPostsData = [];

    // --- LÓGICA DE TEMA (CLARO/OSCURO) ---
    function applyTheme(theme) { document.body.classList.toggle('dark-theme', theme === 'dark'); }
    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }

    // --- LÓGICA PARA CARGAR Y MOSTRAR POSTS ---
    async function loadPosts() {
        if (!bentoGrid) { console.error('El contenedor .bento-grid no fue encontrado.'); return; }
        bentoGrid.innerHTML = '<div class="loading">Cargando publicaciones...</div>';
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error en la red: ${response.statusText}`);
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                allPostsData = data.items;
                bentoGrid.innerHTML = '';
                displayPosts(allPostsData);
            } else { throw new Error('La respuesta de la API no fue exitosa o no contiene items.'); }
        } catch (error) {
            console.error('Falló la carga de publicaciones:', error);
            bentoGrid.innerHTML = '<div class="error">No se pudieron cargar las publicaciones.</div>';
        }
    }

    function displayPosts(posts) {
        const welcomeModule = `<div class="bento-box welcome-module" data-id="static-welcome"><h2>Una Galería de Conocimiento Curada</h2><p>Explora la intersección entre tecnología, ciencia y cultura.</p></div>`;
        bentoGrid.insertAdjacentHTML('beforeend', welcomeModule);
        posts.forEach((post, index) => {
            const isAudio = post.enclosure?.link?.endsWith('.mp3');
            const hasThumbnail = post.thumbnail && post.thumbnail !== '';
            let backgroundStyle = '', cardCategory = 'Artículo', sizeClass = '';
            if (isAudio) {
                backgroundStyle = `style="background-image: url(${audioPostBackground});"`;
                cardCategory = 'Podcast';
            } else if (hasThumbnail) {
                backgroundStyle = `style="background-image: url(${post.thumbnail});"`;
                cardCategory = 'Publicación';
            }
            if (index === 0) sizeClass = 'bento-box--large';
            else if (index % 5 === 2) sizeClass = 'bento-box--tall';
            else if (index % 5 === 3) sizeClass = 'bento-box--wide';
            const postHTML = `<div class="bento-box post-card ${sizeClass}" data-id="${post.guid}" ${backgroundStyle}><div class="card-content"><span class="card-category">${cardCategory}</span><h4>${post.title}</h4></div></div>`;
            bentoGrid.insertAdjacentHTML('beforeend', postHTML);
        });
        const staticModules = `<div class="bento-box zenodo-module bento-box--wide" data-id="static-zenodo"><div class="card-content"><svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets, preprints y materiales de investigación.</p><a href="#" class="btn btn-zenodo">Visitar Repositorio</a></div></div><div class="bento-box collaborators-module"><p>Colaboradores</p></div>`;
        bentoGrid.insertAdjacentHTML('beforeend', staticModules);
    }

    // --- LÓGICA DEL PANEL LATERAL ---
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
    function cleanupPostContent() {
        // CORREGIDO: Usamos los selectores que encontraste.
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
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => { copyBtn.innerHTML = originalIcon; }, 2000);
            }).catch(err => console.error('Error al copiar', err));
        };
    }
    
    // --- EVENT LISTENERS ---
    themeSwitcher.addEventListener('click', toggleTheme);
    bentoGrid.addEventListener('click', e => {
        const clickedCard = e.target.closest('.bento-box[data-id]');
        if (clickedCard && !clickedCard.dataset.id.startsWith('static')) { openSidePanel(clickedCard.dataset.id); }
    });
    sidePanelClose.addEventListener('click', closeSidePanel);
    overlay.addEventListener('click', closeSidePanel);

    // --- INICIAR LA APLICACIÓN ---
    applyTheme(localStorage.getItem('theme') || 'light');
    loadPosts();
});