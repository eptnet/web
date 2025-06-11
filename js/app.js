/**
 * =========================================================================
 * Script Principal para la funcionalidad de Epistecnologia.com
 * Versión con Tarjeta de Historias Estática
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

    // --- NUEVO: Plantilla para la TARJETA de Historias ---
    const videoStoriesCardHTML = `
        <div class="bento-box bento-box--1x3" data-id="static-launch-stories" style="background-image: url('https://i.ibb.co/7jJ2B5N/stories-placeholder.jpg'); cursor: pointer; background-size: cover; background-position: center;">
            <div class="card-content" border-radius: var(--border-radius);">
                <span class="card-category" style="color: white;">Colección</span>
                <h4 style="color: white;">Ver Historias</h4>
            </div>
        </div>
    `;

    // Plantilla para el video destacado
    const videoFeaturedModuleHTML = `
        <div class="bento-box bento-box--2x2 video-featured-module" data-id="static-video-featured">
             <div id="video-featured-player" data-plyr-provider="youtube" data-plyr-embed-id="2Vq_N_wgUkk"></div>
        </div>
    `;
    
    const inFeedModuleHTML = `<div class="bento-box bento-box--2x1 bento-box--acento" data-id="static-in-feed-promo" style="cursor:pointer;"><div class="card-content"><h3>¿Disfrutando el Contenido?</h3><p>Suscríbete a nuestro boletín para no perderte ninguna publicación.</p></div></div>`;
    
    const endStaticModulesHTML = `
        <div class="bento-box zenodo-module bento-box--2x2" data-id="static-zenodo"><div class="card-content"><svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg><h3>Conocimiento Citable</h3><p>Accede a nuestros datasets y preprints.</p><a href="#" class="btn">Visitar Repositorio</a></div></div>
        <div class="bento-box bento-box--2x2 bento-box--imagen" data-id="static-video" data-panel-type="embed" data-panel-title="Video Destacado" data-embed-src="https://www.youtube.com/embed/dQw4w9WgXcQ"><div class="card-content"><span class="card-category">Ver Ahora</span><h4>El Futuro de la Exploración Espacial</h4></div></div>`;
        
    let allPostsData = [];
    async function loadPosts(){if(!bentoGrid){console.error("Error Crítico: El contenedor .bento-grid no fue encontrado.");return}
    bentoGrid.innerHTML='<div class="loading">Cargando publicaciones...</div>';try{const t=await fetch(apiUrl);if(!t.ok)throw new Error(`Error en la red: ${t.statusText}`);const e=await t.json();if("ok"===e.status&&e.items){allPostsData=e.items,bentoGrid.innerHTML="";const t=document.querySelectorAll(".category-grid");t.forEach(t=>t.innerHTML=""),displayPosts(allPostsData),displayCategoryPosts("Cultura","cultura-grid",3)}else throw new Error("La respuesta de la API no fue exitosa.")}catch(t){console.error("Falló la carga de publicaciones:",t),bentoGrid.innerHTML='<div class="error">No se pudieron cargar las publicaciones.</div>'}}
    
    function displayPosts(posts){
        bentoGrid.insertAdjacentHTML("beforeend", welcomeModuleHTML);
        bentoGrid.insertAdjacentHTML("beforeend", topStaticModulesHTML);
        
        // --- Insertamos la nueva tarjeta de historias y el video destacado ---
        bentoGrid.insertAdjacentHTML("beforeend", videoStoriesCardHTML);
        bentoGrid.insertAdjacentHTML("beforeend", videoFeaturedModuleHTML);

        posts.forEach((post, index) => {
            if (index === 4) {
                bentoGrid.insertAdjacentHTML("beforeend", inFeedModuleHTML);
            }
            const isAudio = post.enclosure?.link?.endsWith(".mp3");
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

            // Evitamos duplicar los módulos de video que ya hemos insertado.
            if(sizeClass !== 'bento-box--1x3' && sizeClass !== 'bento-box--2x2') {
                 const postHTML = `<div class="bento-box post-card ${sizeClass}" data-id="${post.guid}" ${backgroundStyle}><div class="card-content"><span class="card-category">${cardCategory}</span><h4>${post.title}</h4></div></div>`;
                 bentoGrid.insertAdjacentHTML("beforeend", postHTML);
            }
        });
        bentoGrid.insertAdjacentHTML("beforeend", endStaticModulesHTML);
    }

    function openSidePanel(cardElement){
        const dataset = cardElement.dataset;
        // --- MODIFICADO: Añadimos el ID de la nueva tarjeta para que no haga nada (por ahora) ---
        if (dataset.id === 'static-video-featured' || dataset.id === 'static-launch-stories') {
            return; 
        }
        let contentHTML = ''; 
        let shareableLink = window.location.href; 
        if (dataset.panelType === 'embed' && dataset.embedSrc) {
            const title = dataset.panelTitle || 'Contenido Adicional';
            contentHTML = `<h2>${title}</h2><div class="post-body"><div class="iframe-container"><iframe src="${dataset.embedSrc}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
            shareableLink = dataset.embedSrc; 
        } else {
            const postData = allPostsData.find(p => p.guid === dataset.id);
            if (!postData) return;
            shareableLink = postData.link; 
            const postDate = new Date(postData.pubDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
            let audioPlayerHTML = '';
            if (postData.enclosure?.link?.endsWith(".mp3")) {
                audioPlayerHTML = `<audio controls controlsList="nodownload" src="${postData.enclosure.link}"></audio>`;
            }
            contentHTML = `<h2>${postData.title}</h2><div class="post-meta">Publicado por ${postData.author} el ${postDate}</div>${audioPlayerHTML}<div class="post-body">${postData.content}</div>`;
        }
        sidePanelContent.innerHTML = contentHTML;
        cleanupPostContent();
        setupShareButtons({ link: shareableLink }); 
        sidePanel.classList.add("is-open");
        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
    }

    function closeSidePanel(){sidePanel.classList.remove("is-open"),overlay.classList.remove("is-open"),document.body.style.overflow=""}
    function displayCategoryPosts(t,e,o){const n=document.getElementById(e);if(!n)return;const i=allPostsData.filter(e=>e.categories&&e.categories.includes(t)).slice(0,o);if(0===i.length)return;n.innerHTML="",i.forEach(t=>{let e=t.thumbnail||extractFirstImageUrl(t.content),o=e?`style="background-image: url(${e});"`:"";const i=`<div class="bento-box post-card" data-id="${t.guid}" ${o}><div class="card-content"><h4>${t.title}</h4></div></div>`;n.insertAdjacentHTML("beforeend",i)})}
    function applyTheme(t){document.body.classList.toggle("dark-theme","dark"===t)}
    function toggleTheme(){const t="dark"===document.body.classList.contains("dark-theme")?"light":"dark";localStorage.setItem("theme",t),applyTheme(t)}
    function extractFirstImageUrl(t){const e=new DOMParser,o=e.parseFromString(t,"text/html"),n=o.querySelector("img");return n?n.src:null}
    function cleanupPostContent(){sidePanelContent.querySelectorAll(".pencraft.icon-container")?.forEach(t=>t.parentElement.remove())}
    function setupShareButtons(t){const e=encodeURIComponent(t.link),o=encodeURIComponent(t.title||document.title);document.getElementById("share-fb").onclick=()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${e}`),document.getElementById("share-li").onclick=()=>window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${e}&title=${o}`),document.getElementById("share-wa").onclick=()=>window.open(`https://api.whatsapp.com/send?text=${o}%20${e}`),document.getElementById("share-x").onclick=()=>window.open(`https://twitter.com/intent/tweet?url=${e}&text=${o}`);const n=document.getElementById("copy-link");n.onclick=()=>{navigator.clipboard.writeText(t.link).then(()=>{n.innerHTML='<i class="fa-solid fa-check"></i>',setTimeout(()=>{n.innerHTML='<i class="fa-solid fa-link"></i>'},2e3)}).catch(t=>console.error("Error al copiar el enlace:",t))}}
    function checkLiveStatus(){const t=!0,e=document.getElementById("nav-live-desktop"),o=document.getElementById("nav-live-mobile");e&&e.classList.toggle("is-live",t),o&&(o.classList.toggle("is-live",t),o.style.color=t?"var(--color-accent)":"")}
    themeSwitcherDesktop&&themeSwitcherDesktop.addEventListener("click",toggleTheme),themeSwitcherMobile&&themeSwitcherMobile.addEventListener("click",toggleTheme),sidePanelClose&&sidePanelClose.addEventListener("click",closeSidePanel),overlay&&overlay.addEventListener("click",()=>{closeSidePanel(),mobileMoreMenu&&mobileMoreMenu.classList.remove("is-open")}),bentoGrid&&bentoGrid.addEventListener("click",t=>{const e=t.target.closest('.bento-box[data-id]');e&&openSidePanel(e)}),mobileMoreBtn&&mobileMoreBtn.addEventListener("click",t=>{t.stopPropagation(),mobileMoreMenu&&mobileMoreMenu.classList.toggle("is-open")}),mobileMoreMenuClose&&mobileMoreMenuClose.addEventListener("click",()=>{mobileMoreMenu&&mobileMoreMenu.classList.remove("is-open")});
    function init(){applyTheme(localStorage.getItem('theme')||'light'),loadPosts(),checkLiveStatus()}
    init();
});