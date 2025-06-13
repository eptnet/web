/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * Versión 2.2 - Refactorizado, Completo y con Bug de Tema Corregido
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
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';

    const welcomeModuleHTML = `
        <div class="bento-box welcome-module bento-box--4x1" data-id="static-welcome" style="cursor: default;">
            <h2>Una Galería de Conocimiento Curada</h2>
            <p>Explora la intersección entre tecnología, ciencia y cultura.</p>
        </div>`;

    const topStaticModulesHTML = `
        <div class="bento-box bento-box--4x1" data-id="static-quote" style="cursor:default;">
            <div class="card-content" style="text-align: center;">
                <p style="font-size: 1.2rem; font-style: italic;">"El conocimiento es la única riqueza que no se puede robar."</p>
                <h4 style="margin-top: 0.5rem;">- Anónimo</h4>
            </div>
        </div>`;
    
    const videoStoriesCardHTML = `
        <div class="bento-box bento-box--1x3" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/hxm0qPFx/Leonardo-Phoenix-10-A-modern-and-minimalist-cover-art-featurin-1.jpg'); cursor: pointer; background-size: cover; background-position: center;">
            <div class="card-content">
                <span class="card-category" style="color: white;">Colección</span>
                <h4 style="color: white;">Ver Historias</h4>
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
        <div class="bento-box bento-box--2x1 bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;">
            <div class="card-content">
                <h3>¿Disfrutando el Contenido?</h3>
                <p>Suscríbete a nuestro boletín para no perderte ninguna publicación.</p>
            </div>
        </div>`;

    const endStaticModulesHTML = `
        <div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo">
            <div class="card-content">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg>
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
        bentoGrid.insertAdjacentHTML("beforeend", welcomeModuleHTML);
        bentoGrid.insertAdjacentHTML("beforeend", topStaticModulesHTML);
        bentoGrid.insertAdjacentHTML("beforeend", videoStoriesCardHTML);
        
        items.forEach((item, index) => {
            if (index === 4) {
                bentoGrid.insertAdjacentHTML("beforeend", inFeedModuleHTML);
            }
            if (index === 5) {
                bentoGrid.insertAdjacentHTML("beforeend", videoFeaturedModuleHTML);
            }
            const isAudio = item.enclosure?.link?.endsWith(".mp3");
            const thumbnail = item.thumbnail || extractFirstImageUrl(item.content);
            const cardImageStyle = thumbnail ? `style="background-image: url(${thumbnail});"` : (isAudio ? `style="background-image: url(${audioPostBackground});"` : '');
            const cardType = isAudio ? "Podcast" : "Publicación";
            let cardSizeClass = "";
            if (index === 0) cardSizeClass = "bento-box--2x2";
            else if (index % 5 === 1) cardSizeClass = "bento-box--1x2";
            else if (index % 5 === 3) cardSizeClass = "bento-box--2x1";
            if (cardSizeClass) {
                const postCardHTML = `
                    <div class="bento-box post-card ${cardSizeClass}" data-id="${item.guid}" ${cardImageStyle}>
                        <div class="card-content"><span class="card-category">${cardType}</span><h4>${item.title}</h4></div>
                    </div>`;
                bentoGrid.insertAdjacentHTML("beforeend", postCardHTML);
            }
        });
        bentoGrid.insertAdjacentHTML("beforeend", endStaticModulesHTML);
    }
    
    function openSidePanel(clickedElement) {
        const dataset = clickedElement.dataset;
    
        if (dataset.id === "static-launch-stories") {
            document.dispatchEvent(new CustomEvent('launch-stories'));
            return;
        }
    
        if (dataset.id === "static-video-featured") {
            return;
        }
    
        let contentHTML = "";
        let shareLink = window.location.href;
    
        if (dataset.panelType === 'embed' && dataset.embedSrc) {
            contentHTML = `<h2>${dataset.panelTitle || "Contenido Adicional"}</h2><div class="post-body"><div class="iframe-container"><iframe src="${dataset.embedSrc}" title="${dataset.panelTitle || "Contenido Adicional"}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
            shareLink = dataset.embedSrc;
        } else {
            const post = allPostsData.find(p => p.guid === dataset.id);
            if (post) {
                shareLink = post.link;
                const postDate = new Date(post.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
                const audioPlayerHTML = post.enclosure?.link?.endsWith(".mp3") ? `<audio controls controlsList="nodownload" src="${post.enclosure.link}"></audio>` : "";
                contentHTML = `
                    <h2>${post.title}</h2>
                    <div class="post-meta">Publicado por ${post.author} el ${postDate}</div>
                    ${audioPlayerHTML}
                    <div class="post-body">${post.content}</div>`;
                sidePanelContent.innerHTML = contentHTML;
                setupShareButtons({ link: post.link });
            } else {
                return;
            }
        }
    
        sidePanelContent.innerHTML = contentHTML;
        cleanupPostContent();
        setupShareButtons({ link: shareLink });
        sidePanel.classList.add("is-open");
        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
    }

    function closeSidePanel() {
        sidePanel.classList.remove("is-open");
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    function displayCategoryPosts(category, gridId, maxPosts) {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        const categoryPosts = allPostsData.filter(p => p.categories && p.categories.includes(category)).slice(0, maxPosts);
        if (categoryPosts.length === 0) return;
        grid.innerHTML = "";
        categoryPosts.forEach(post => {
            const thumbnail = post.thumbnail || extractFirstImageUrl(post.content);
            const style = thumbnail ? `style="background-image: url(${thumbnail});"` : '';
            const postHTML = `<div class="bento-box post-card" data-id="${post.guid}" ${style}><div class="card-content"><h4>${post.title}</h4></div></div>`;
            grid.insertAdjacentHTML("beforeend", postHTML);
        });
    }
    
    // --- CORRECCIÓN DE FUNCIONES DE TEMA ---
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
    // --- FIN DE CORRECCIÓN ---

    function extractFirstImageUrl(t){const e=new DOMParser,o=e.parseFromString(t,"text/html"),n=o.querySelector("img");return n?n.src:null}
    function cleanupPostContent(){sidePanelContent.querySelectorAll(".pencraft.icon-container")?.forEach(t=>t.parentElement.remove())}
    function setupShareButtons(t){const e=encodeURIComponent(t.link),o=encodeURIComponent(t.title||document.title);document.getElementById("share-fb").onclick=()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${e}`),document.getElementById("share-li").onclick=()=>window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${e}&title=${o}`),document.getElementById("share-wa").onclick=()=>window.open(`https://api.whatsapp.com/send?text=${o}%20${e}`),document.getElementById("share-x").onclick=()=>window.open(`https://twitter.com/intent/tweet?url=${e}&text=${o}`);const n=document.getElementById("copy-link");n.onclick=()=>{navigator.clipboard.writeText(t.link).then(()=>{n.innerHTML='<i class="fa-solid fa-check"></i>',setTimeout(()=>{n.innerHTML='<i class="fa-solid fa-link"></i>'},2e3)}).catch(t=>console.error("Error al copiar el enlace:",t))}}
    function checkLiveStatus(){const t=!0,e=document.getElementById("nav-live-desktop"),o=document.getElementById("nav-live-mobile");e&&e.classList.toggle("is-live",t),o&&(o.classList.toggle("is-live",t),o.style.color=t?"var(--color-accent)":"")}
    
    // =========================================================================
    // 4. ASIGNACIÓN DE EVENTOS (EVENT LISTENERS)
    // =========================================================================
    themeSwitcherDesktop?.addEventListener("click", toggleTheme);
    themeSwitcherMobile?.addEventListener("click", toggleTheme);
    
    sidePanelClose?.addEventListener("click", closeSidePanel);
    overlay?.addEventListener("click",()=>{
        closeSidePanel();
        mobileMoreMenu?.classList.remove("is-open");
    });
    
    bentoGrid?.addEventListener("click",(event)=>{
        const bentoBox = event.target.closest('.bento-box[data-id]');
        if(bentoBox) openSidePanel(bentoBox);
    });
    
    mobileMoreBtn?.addEventListener("click",(event)=>{
        event.stopPropagation();
        mobileMoreMenu?.classList.toggle("is-open");
    });
    
    mobileMoreMenuClose?.addEventListener("click",()=>{
        mobileMoreMenu?.classList.remove("is-open");
    });
    
    // =========================================================================
    // 5. INICIALIZACIÓN
    // =========================================================================
    function init(){
        applyTheme(localStorage.getItem('theme') || 'light');
        loadPosts();
        checkLiveStatus();
    }

    init();
});