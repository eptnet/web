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

// 'DOMContentLoaded' es un evento que espera a que todo el HTML de la página
// esté completamente cargado y listo antes de ejecutar cualquier código JavaScript.
// Esto previene errores comunes donde el script intenta manipular elementos que aún no existen.
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. CONSTANTES Y SELECTORES DEL DOM
    // =========================================================================
    // Es una buena práctica declarar todas las referencias a elementos del DOM
    // y constantes al principio del script para tener un acceso fácil y centralizado.

    const bentoGrid = document.getElementById('bento-grid');
    const themeSwitcher = document.getElementById('theme-switcher');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelClose = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

    const apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Feptnews.substack.com%2Ffeed';
    const audioPostBackground = 'https://i.ibb.co/vvPbhLpV/Leonardo-Phoenix-10-A-modern-and-minimalist-design-for-a-scien-2.jpg';


    // =========================================================================
    // 2. ESTADO DE LA APLICACIÓN
    // =========================================================================
    // Aquí guardamos datos que pueden cambiar durante la ejecución del programa.
    
    let allPostsData = []; // Almacenará los datos de todos los posts una vez que se carguen desde la API.


    // =========================================================================
    // 3. FUNCIONES PRINCIPALES (LÓGICA DE NEGOCIO)
    // =========================================================================

    /**
     * Carga las publicaciones desde la API. Es una función 'async' para poder
     * usar 'await', lo que permite esperar a que la respuesta de la red llegue
     * sin congelar la página.
     */
    async function loadPosts() {
        if (!bentoGrid) {
            console.error('Error Crítico: El contenedor .bento-grid no fue encontrado en el DOM.');
            return;
        }
        bentoGrid.innerHTML = '<div class="loading">Cargando publicaciones...</div>';

        // 'try...catch' es un bloque para manejo de errores. Si algo falla dentro
        // del 'try' (ej. no hay internet), el código salta al 'catch' sin detener la web.
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`Error en la red: ${response.statusText}`);
            
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                allPostsData = data.items;
                bentoGrid.innerHTML = ''; // Limpia el mensaje de "cargando"
                displayPosts(allPostsData);
            } else {
                throw new Error('La respuesta de la API no fue exitosa o no contiene items.');
            }
        } catch (error) {
            console.error('Falló la carga de publicaciones:', error);
            bentoGrid.innerHTML = '<div class="error">No se pudieron cargar las publicaciones.</div>';
        }
    }

    /**
     * Recibe un array de posts y construye el HTML para mostrarlos en el Bento Grid.
     * @param {Array} posts - El array de objetos de post que viene de la API.
     */
    function displayPosts(posts) {
        // Módulo de bienvenida estático
        const welcomeModule = `<div class="bento-box welcome-module" data-id="static-welcome"><h2>Epistecnología</h2><p>Una plataforma para la divulgación del conocimiento producido con Sabiduría</p></div>`;
        bentoGrid.insertAdjacentHTML('beforeend', welcomeModule);

        // Iteramos sobre cada post para crear su tarjeta correspondiente.
        posts.forEach((post, index) => {
            // Verificamos si es un post de audio o si tiene imagen en miniatura.
            // El 'encadenamiento opcional' (?.) evita errores si 'enclosure' o 'link' no existen.
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
            
            // Lógica para dar variedad de tamaños a las tarjetas del grid.
            if (index === 0) sizeClass = 'bento-box--large';
            else if (index % 5 === 2) sizeClass = 'bento-box--tall';
            else if (index % 5 === 3) sizeClass = 'bento-box--wide';

            // Creamos el HTML de la tarjeta y lo añadimos al grid.
            const postHTML = `<div class="bento-box post-card ${sizeClass}" data-id="${post.guid}" ${backgroundStyle}><div class="card-content"><span class="card-category">${cardCategory}</span><h4>${post.title}</h4></div></div>`;
            bentoGrid.insertAdjacentHTML('beforeend', postHTML);
        });

        // Módulos estáticos que van al final del grid.
        const staticModules = `
            <div class="bento-box zenodo-module bento-box--wide" data-id="static-zenodo">
                <div class="card-content">
                     <svg viewBox="0 0 24 24" fill="currentColor" style="width:100px; height:auto; margin: 0 auto 1rem;"><path d="M12.246 17.34l-4.14-4.132h2.802v-2.8H5.976l4.131-4.14L7.305 3.46l-6.84 6.832 6.84 6.84 2.802-2.801zm-.492-13.88l6.839 6.84-6.84 6.839 2.802 2.802 6.84-6.84-6.84-6.84-2.801 2.803zm-1.89 7.02h5.364v2.8H9.864v-2.8z"></path></svg>
                    <h3>Conocimiento Citable</h3>
                    <p>Accede a nuestros datasets, preprints y materiales de investigación.</p>
                    <a href="#" class="btn btn-zenodo">Visitar Repositorio</a>
                </div>
            </div>
            
            <div class="bento-box bento-box--wide collaborators-module">
                 <div class="card-content">
                    <h3>Colaboradores</h3>
                    <p>Logo 1 | Logo 2 | Logo 3</p>
                </div>
            </div>
            
            <div class="bento-box bento-box--tall" data-id="static-taller-junio">
                <div class="card-content">
                    <span class="card-category">Próximamente</span>
                    <h3>Taller de IA y Creatividad</h3>
                    <p>Explora cómo las herramientas de IA pueden potenciar tu proceso creativo.</p>
                    <a href="#" class="btn" style="margin-top: auto;">Inscribirse</a>
                </div>
            </div>
        `;
        bentoGrid.insertAdjacentHTML('beforeend', staticModules);
    }

    /**
     * Abre el panel lateral y lo puebla con el contenido de un post específico.
     * @param {string} postId - El ID (guid) único del post que se va a mostrar.
     */
    function openSidePanel(postId) {
        const postData = allPostsData.find(p => p.guid === postId);
        if (!postData) return; // Si no se encuentra el post, no hacemos nada.

        const postDate = new Date(postData.pubDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        
        let contentHTML = `<h2>${postData.title}</h2><div class="post-meta">Publicado por ${postData.author} el ${postDate}</div><div class="post-body">${postData.content}</div>`;
        
        if (postData.enclosure?.link?.endsWith('.mp3')) {
            contentHTML += `<audio controls controlsList="nodownload" src="${postData.enclosure.link}"></audio>`;
        }
        
        sidePanelContent.innerHTML = contentHTML;

        // Llamamos a las funciones auxiliares para los toques finales.
        cleanupPostContent();
        setupShareButtons(postData);

        // Hacemos visible el panel y el overlay añadiendo clases CSS.
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden'; // Evita que se pueda hacer scroll en el fondo.
    }

    /**
     * Cierra el panel lateral y el overlay.
     */
    function closeSidePanel() {
        sidePanel.classList.remove('is-open');
        overlay.classList.remove('is-open');
        document.body.style.overflow = ''; // Restaura el scroll en el fondo.
    }


    // =========================================================================
    // 4. FUNCIONES AUXILIARES (HELPERS)
    // =========================================================================

    /**
     * Aplica la clase 'dark-theme' al body si el tema es oscuro.
     * @param {string} theme - El tema a aplicar ('dark' o 'light').
     */
    function applyTheme(theme) {
        document.body.classList.toggle('dark-theme', theme === 'dark');
    }

    /**
     * Cambia el tema actual y lo guarda en localStorage para que la elección del usuario sea persistente.
     */
    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme); // Guarda la elección en el navegador.
        applyTheme(newTheme);
    }
    
    /**
     * Busca y elimina elementos no deseados (ej. barras de herramientas de Substack) del contenido del post.
     */
    function cleanupPostContent() {
        const selectorDeIconos = '.pencraft.icon-container';
        // Usamos el selector que identificaste para encontrar y eliminar los iconos molestos.
        sidePanelContent.querySelectorAll(selectorDeIconos)?.forEach(toolbar => toolbar.parentElement.remove());
    }

    /**
     * Configura la funcionalidad de los botones de compartir en el panel lateral.
     * @param {object} postData - Los datos del post actual para obtener su título y enlace.
     */
    function setupShareButtons(postData) {
        const url = encodeURIComponent(postData.link);
        const title = encodeURIComponent(postData.title);

        document.getElementById('share-fb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
        document.getElementById('share-li').onclick = () => window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`);
        document.getElementById('share-wa').onclick = () => window.open(`https://api.whatsapp.com/send?text=${title}%20${url}`);
        document.getElementById('share-x').onclick = () => window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`);
        
        const copyBtn = document.getElementById('copy-link');
        copyBtn.onclick = () => {
            // La API del Portapapeles es la forma moderna y segura de copiar texto.
            navigator.clipboard.writeText(postData.link).then(() => {
                const originalIcon = copyBtn.innerHTML;
                copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => { copyBtn.innerHTML = originalIcon; }, 2000); // Vuelve al icono original después de 2 segundos.
            }).catch(err => console.error('Error al copiar el enlace:', err));
        };
    }
    

    // =========================================================================
    // 5. MANEJADORES DE EVENTOS (EVENT LISTENERS)
    // =========================================================================
    // Esta sección asigna nuestras funciones a las interacciones del usuario.
    
    themeSwitcher.addEventListener('click', toggleTheme);
    sidePanelClose.addEventListener('click', closeSidePanel);
    overlay.addEventListener('click', closeSidePanel);

    // Técnica de "Delegación de Eventos": en lugar de añadir un listener a cada
    // tarjeta, añadimos uno solo al contenedor padre. Es mucho más eficiente.
    bentoGrid.addEventListener('click', e => {
        const clickedCard = e.target.closest('.bento-box[data-id]');
        if (clickedCard && !clickedCard.dataset.id.startsWith('static')) {
            openSidePanel(clickedCard.dataset.id);
        }
    });


    // =========================================================================
    // 6. INICIALIZACIÓN
    // =========================================================================
    // Este es el punto de partida que ejecuta el código cuando la página carga.
    
    function init() {
        // Aplica el tema guardado por el usuario (o 'light' por defecto).
        applyTheme(localStorage.getItem('theme') || 'light');
        // Carga las publicaciones.
        loadPosts();
    }
    
    // Ejecuta la función de inicialización.
    init();

});