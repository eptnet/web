/**
 * =========================================================================
 * Script de la Página de Inicio (app.js) - VERSIÓN CON CORRECCIÓN DE HISTORIAL
 * - Implementa el control del botón "atrás" del navegador para los paneles.
 * =========================================================================
 */

// --- LÓGICA DE LA PÁGINA DE INICIO ---
document.addEventListener('mainReady', () => {

    console.log("Evento 'mainReady' recibido. app.js comienza su ejecución.");

    // --- SELECCIÓN DE ELEMENTOS ---
    const bentoGrid = document.getElementById("bento-grid");
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    
    // --- LÓGICA ORIGINAL (SIN CAMBIOS) ---
    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua&order_dir=desc&count=13';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';
    let allPostsData = [];
    let wavesurferInstance = null;

    async function loadPosts() { if (!bentoGrid) return; bentoGrid.innerHTML = '<div class="loading" style="grid-column: span 4; text-align: center; padding: 2rem;">Cargando...</div>'; try { const response = await fetch(apiUrl); if (!response.ok) throw new Error(`Error de red: ${response.statusText}`); const data = await response.json(); if (data.status === 'ok' && data.items) { allPostsData = data.items; displayPosts(allPostsData); } else { throw new Error("API no respondió correctamente."); } } catch (error) { console.error("Falló la carga de posts:", error); bentoGrid.innerHTML = '<div class="error" style="grid-column: span 4; text-align: center; padding: 2rem;">No se pudieron cargar los posts.</div>'; } }
    
    function displayPosts(items) {
        // ... (Tu lógica para construir los bentos no cambia)
        const topStaticModulesHTML = `<div class="bento-box welcome-module bento-box--3x2" data-id="static-welcome" style="cursor: default;"><h2>¿Investigas, divulgas o simplemente quieres entender mejor el mundo?</h2><p>Te damos la bienvenida a <strong>Epistecnología</strong>...</p></div>`;
        const videoStoriesCardHTML = `<div class="bento-box bento-box--1x3 mobile-full-width" data-id="static-launch-stories" style="..."><div class="card-content">...</div></div>`;
        const quoteCardHTML = `<div class="bento-box bento-box--1x2 bento-style--flat" data-id="static-quote" style="..."><div class="card-content">...</div></div>`;
        bentoGrid.innerHTML = topStaticModulesHTML + videoStoriesCardHTML + quoteCardHTML;
        // ... etc
    }
    
    // --- LÓGICA DE PANELES (CON CORRECCIONES) ---

    function openSidePanelForArticle(clickedElement) {
        if (sidePanel.classList.contains('is-open')) return;
        const post = allPostsData.find(p => p.guid === clickedElement.dataset.id);
        if (!post) return;
        
        const contentHTML = `<h2>${post.title}</h2>...<div class="post-body">${post.content}</div>`;
        
        sidePanelContent.innerHTML = contentHTML;
        sidePanel.classList.add("is-open");
        overlay.classList.add("is-open");
        document.body.style.overflow = "hidden";
        
        // *** CAMBIO CLAVE 1: Añadimos un estado al historial al abrir el panel.
        history.pushState({ panelOpen: true }, '');
    }

    function closeSidePanel() {
        if (wavesurferInstance) { wavesurferInstance.destroy(); wavesurferInstance = null; }
        sidePanel.classList.remove("is-open");
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    // --- ASIGNACIÓN DE EVENTOS ---

    // El click en la bento grid ahora diferencia qué hacer.
    bentoGrid?.addEventListener("click", (event) => {
        const bentoBox = event.target.closest('.bento-box[data-id]');
        if (!bentoBox) return;

        const dataId = bentoBox.dataset.id;
        if (dataId === "static-launch-stories") {
            document.dispatchEvent(new CustomEvent('launch-stories'));
        } else if (allPostsData.some(p => p.guid === dataId)) {
            openSidePanelForArticle(bentoBox);
        }
    });

    // *** CAMBIO CLAVE 2: El botón 'X' y el overlay ahora navegan hacia atrás.
    sidePanelClose?.addEventListener("click", () => { history.back(); });
    overlay?.addEventListener("click", () => { history.back(); });

});

// *** CAMBIO CLAVE 3: El listener global que cierra el panel con el botón "atrás".
window.addEventListener('popstate', function(event) {
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel && sidePanel.classList.contains('is-open')) {
        if (document.getElementById('side-panel-content').classList.contains('side-panel__content--video')) {
            document.dispatchEvent(new CustomEvent('close-shorts-player'));
        } else {
            // Lógica de cierre para el panel de artículos
            const wavesurferInstance = window.wavesurferInstance; // Asume que lo hemos hecho global si es necesario
            if (wavesurferInstance) { wavesurferInstance.destroy(); window.wavesurferInstance = null; }
            sidePanel.classList.remove("is-open");
            document.getElementById('overlay').classList.remove("is-open");
            document.body.style.overflow = "";
        }
        console.log("Panel lateral cerrado por evento popstate en la página principal.");
    }
});
