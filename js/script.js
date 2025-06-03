// Este es el archivo script.js completo y corregido.
// Reemplaza todo el contenido de tu archivo js/script.js con este código.

document.addEventListener('DOMContentLoaded', function() {

    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    console.log("THEME: Iniciando lógica del tema.");
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;

    if (themeToggle) {
        console.log("THEME: themeToggle encontrado:", themeToggle);

        // Función para aplicar el tema visualmente
        const applyThemeVisuals = (theme) => {
            if (theme === 'light-mode') {
                body.classList.add('light-mode');
                console.log("THEME: Aplicada clase 'light-mode' al body.");
            } else { // 'dark-mode' (o default)
                body.classList.remove('light-mode');
                console.log("THEME: Removida clase 'light-mode' del body (activando dark/default).");
            }
        };

        // 1. Comprobar preferencia guardada en localStorage al cargar la página
        const savedTheme = localStorage.getItem('theme');
        console.log("THEME: Tema guardado en localStorage al cargar:", savedTheme);

        if (savedTheme) {
            applyThemeVisuals(savedTheme);
        } else {
            // 2. Si no hay nada guardado, comprobar preferencia del sistema operativo
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                console.log("THEME: No hay tema guardado, sistema prefiere light. Aplicando light-mode.");
                applyThemeVisuals('light-mode');
                // Opcional: Guardar preferencia del sistema si es la primera vez
                // localStorage.setItem('theme', 'light-mode');
            } else {
                console.log("THEME: No hay tema guardado, sistema prefiere dark (o sin preferencia). Usando default (dark).");
                applyThemeVisuals('dark-mode'); // Asegura que se aplique el default si no hay preferencia light
            }
        }

        // Evento para el botón de cambio de tema
        themeToggle.addEventListener('click', () => {
            console.log("THEME: Clic en themeToggle.");
            body.classList.toggle('light-mode'); // Alterna la clase light-mode

            // Guardar la nueva preferencia del usuario en localStorage
            if (body.classList.contains('light-mode')) {
                localStorage.setItem('theme', 'light-mode');
                console.log("THEME: Guardado 'light-mode' en localStorage después del clic.");
            } else {
                localStorage.setItem('theme', 'dark-mode'); // Guardamos 'dark-mode' explícitamente
                console.log("THEME: Guardado 'dark-mode' en localStorage después del clic.");
            }
        });
    } else {
        console.error("THEME: ERROR CRÍTICO - Botón .theme-toggle NO encontrado en el HTML.");
    }
    // --- FIN DE LA LÓGICA DEL TEMA ---

    // --- LÓGICA DEL MODAL DE CANALES EN VIVO ---
    const liveButtonDesktop = document.querySelector('.sidebar-right');
    const liveButtonMobile = document.getElementById('live-button-mobile');
    const liveModal = document.getElementById('live-modal');
    const closeModalButton = document.querySelector('.modal-close-button');

    if (liveModal && closeModalButton) {
        const openModal = () => liveModal.classList.add('visible');
        const closeModal = () => liveModal.classList.remove('visible');

        if (liveButtonDesktop) {
            liveButtonDesktop.addEventListener('click', openModal);
        }
        if (liveButtonMobile) {
            liveButtonMobile.addEventListener('click', openModal);
        }
        
        closeModalButton.addEventListener('click', closeModal);

        // Cerrar el modal si se hace clic fuera del contenido
        liveModal.addEventListener('click', function(event) {
            if (event.target === liveModal) {
                closeModal();
            }
        });
    }

    // --- LÓGICA DEL FEED DE SUBSTACK ---
    const feedContainer = document.getElementById('substack-feed-grid');

    if (feedContainer) {
        const substackFeedUrl = 'https://eptnews.substack.com/feed';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
        const fallbackImage = 'https://i.imgur.com/VdefT0s.png'; // Una imagen genérica

        // Función para truncar el texto de la descripción
        const truncateText = (html, maxLength) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            let text = tempDiv.textContent || tempDiv.innerText || "";
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                feedContainer.innerHTML = ''; // Limpiar el mensaje "Cargando..."

                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        const card = document.createElement('a');
                        card.href = item.link;
                        card.target = '_blank';
                        card.rel = 'noopener noreferrer';
                        card.classList.add('feed-card');

                        // Lógica mejorada para encontrar la imagen
                        let imageUrl = fallbackImage;
                        if (item.thumbnail && item.thumbnail.length > 0) {
                            imageUrl = item.thumbnail;
                        } else if (item.enclosure && item.enclosure.link && item.enclosure.type.startsWith('image')) {
                            imageUrl = item.enclosure.link;
                        }
                        imageUrl = imageUrl.replace(/^http:\/\//i, 'https://'); // Forzar HTTPS

                        const image = document.createElement('img');
                        image.src = imageUrl;
                        image.classList.add('card-image');
                        image.alt = item.title;
                        // Si la imagen de Substack falla, se carga la de respaldo
                        image.onerror = () => { image.src = fallbackImage; };

                        const content = document.createElement('div');
                        content.classList.add('card-content');

                        const title = document.createElement('h3');
                        title.textContent = item.title;

                        const description = document.createElement('p');
                        description.textContent = truncateText(item.description, 100);

                        content.appendChild(title);
                        content.appendChild(description);
                        card.appendChild(image);
                        card.appendChild(content);

                        feedContainer.appendChild(card);
                    });
                } else {
                    feedContainer.innerHTML = '<p>No se encontraron publicaciones recientes.</p>';
                }
            })
            .catch(error => {
                console.error('Error al obtener el feed de Substack:', error);
                feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
            });
    }
});