/**
 * =========================================================================
 * Script de la Página de Inicio (app.js) - VERSIÓN FINAL CON CORRECCIONES
 * 1. Inicializa Atropos.js de forma segura usando window.onload.
 * 2. Implementa el control del botón "atrás" del navegador para el panel lateral.
 * =========================================================================
 */

// --- 1. LÓGICA DE ATROPOS.JS ---
// Usamos 'load' en lugar de 'DOMContentLoaded' para asegurar que las librerías externas (CDN) se hayan cargado.
window.addEventListener('load', () => {
    // Inicializador para el efecto parallax de Atropos en el banner
    try {
        const myAtropos = Atropos({
            el: '.my-atropos',
            activeOffset: 40,
            shadowScale: 1.05,
        });
        console.log("Atropos inicializado correctamente.");
    } catch (e) {
        console.error("No se pudo inicializar Atropos.js. ¿Está la librería cargada?", e);
    }
});


// --- 2. LÓGICA PRINCIPAL DE LA PÁGINA ---
// Se ejecuta después de que main.js haya terminado.
document.addEventListener('mainReady', () => {

    console.log("Evento 'mainReady' recibido. app.js comienza su ejecución.");

    // --- SELECCIÓN DE ELEMENTOS ---
    const bentoGrid = document.getElementById("bento-grid");
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');
    const scrollToContentBtn = document.getElementById('scroll-to-content-btn');

    // --- FUNCIONES ---

    async function loadPosts() {
        if (!bentoGrid) return;
        bentoGrid.innerHTML = '<div class="loading" style="grid-column: span 4; text-align: center; padding: 2rem;">Cargando contenido...</div>';
        try {
            const response = await fetch("https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed");
            if (!response.ok) throw new Error('Error al cargar el feed RSS.');
            const data = await response.json();
            displayPosts(data.items);
        } catch (error) {
            console.error(error);
            bentoGrid.innerHTML = '<div class="error" style="grid-column: span 4; text-align: center; padding: 2rem;">No se pudo cargar el contenido.</div>';
        }
    }
    
    function displayPosts(items) {
        bentoGrid.innerHTML = ''; // Limpiamos el mensaje de "Cargando..."
        const topStaticModulesHTML = `
            <div class="bento-box welcome-module bento-box--2x1" data-id="static-welcome" style="background-color: var(--color-accent); color: white;"><h3>Bienvenidos a la Sabiduría</h3><p>Explora, aprende y contribuye.</p></div>
            <div class="bento-box bento-box--2x2 mobile-full-width video-featured-module" data-id="static-video-featured"><iframe src="https://www.youtube.com/embed/S_8432qTT94" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
        `;
        bentoGrid.insertAdjacentHTML("beforeend", topStaticModulesHTML);

        items.slice(0, 10).forEach((item, index) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.content;
            
            const firstParagraph = tempDiv.querySelector('p:first-of-type')?.textContent || '';
            const image = tempDiv.querySelector('img')?.src || '';
            const cardSize = index % 5 === 0 ? 'bento-box--1x3' : 'bento-box--1x1';
            
            const postCardHTML = `
                <div class="bento-box post-card ${cardSize}" data-content='${JSON.stringify({title: item.title, author: item.author, html: item.content})}' style="${image ? `background-image: url('${image}');` : ''}">
                    <div class="card-content">
                        ${cardSize === 'bento-box--1x3' ? `<h4>${item.title}</h4>` : ''}
                        ${cardSize !== 'bento-box--1x3' ? `<p>${item.title}</p>` : ''}
                    </div>
                </div>
            `;
            bentoGrid.insertAdjacentHTML("beforeend", postCardHTML);
        });
    }
    
    function openSidePanel(contentHTML) {
        sidePanelContent.innerHTML = contentHTML;
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        
        // **NUEVO**: Añadimos un estado al historial del navegador
        history.pushState({ panelOpen: true }, null);
    }
    
    function closeSidePanel() {
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    // --- ASIGNACIÓN DE EVENTOS ---
    
    // **MODIFICADO**: El botón de cierre y el overlay ahora simplemente llaman a history.back()
    // para que la acción sea idéntica al botón "atrás" del navegador.
    sidePanelClose?.addEventListener('click', () => {
        history.back();
    });
    overlay?.addEventListener('click', () => {
        history.back();
    });

    bentoGrid?.addEventListener("click", async (e) => {
        const postCard = e.target.closest(".bento-box[data-content]");
        if (!postCard) return;

        const content = JSON.parse(postCard.dataset.content);
        const contentHTML = `
            <h2>${content.title}</h2>
            <span class="post-meta">Por ${content.author}</span>
            <div class="post-body">${content.html}</div>
        `;
        openSidePanel(contentHTML);
    });
    
    scrollToContentBtn?.addEventListener('click', () => {
        const header = document.querySelector('.desktop-nav');
        if(header) {
            header.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // --- LLAMADAS INICIALES ---
    loadPosts();
});

// **NUEVO**: Este listener es la clave para el botón "atrás".
// Se activa CADA VEZ que el usuario navega hacia atrás en el historial.
window.addEventListener('popstate', function(event) {
    // Simplemente cerramos el panel. Si ya estaba cerrado, no pasa nada.
    // Si estaba abierto, esta es la función que lo cierra visualmente.
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel && sidePanel.classList.contains('is-open')) {
        sidePanel.classList.remove('is-open');
        document.getElementById('overlay').classList.remove('is-open');
        document.body.style.overflow = '';
        console.log("Panel lateral cerrado por evento popstate.");
    }
});