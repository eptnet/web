document.addEventListener('DOMContentLoaded', function() {
    
    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;

    // Función para aplicar un tema
    const applyTheme = (theme) => {
        if (theme === 'light') {
            body.classList.add('light-mode');
        } else {
            body.classList.remove('light-mode');
        }
    };

    // Al cargar la página, comprueba si hay un tema guardado o si prefiere el modo claro
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (prefersLight) {
        applyTheme('light');
    }

    // Evento para el botón de cambio de tema
    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('light-mode') ? 'dark' : 'light';
        applyTheme(newTheme);
        // Guarda la elección del usuario
        localStorage.setItem('theme', newTheme);
    });


    // --- LÓGICA DEL FEED DE SUBSTACK ---
    const substackFeedUrl = 'https://eptnews.substack.com/feed';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
    const feedContainer = document.getElementById('substack-feed-grid');
    const fallbackImage = 'https://i.imgur.com/VdefT0s.png';

    // Función para truncar texto y eliminar etiquetas HTML
    function truncateText(html, maxLength) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        let text = tempDiv.textContent || tempDiv.innerText || "";
        if (text.length > maxLength) {
            return text.substring(0, maxLength) + '...';
        }
        return text;
    }

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            feedContainer.innerHTML = ''; 

            if (data.items) {
                data.items.forEach(item => {
                    const card = document.createElement('a');
                    card.href = item.link;
                    card.target = '_blank';
                    card.rel = 'noopener noreferrer';
                    card.classList.add('feed-card');
                    
                    const imageUrl = item.thumbnail || fallbackImage;
                    const image = document.createElement('img');
                    image.src = imageUrl;
                    image.classList.add('card-image');
                    image.onerror = () => { image.src = fallbackImage; };

                    const content = document.createElement('div');
                    content.classList.add('card-content');

                    const title = document.createElement('h3');
                    title.textContent = item.title;

                    // ¡CAMBIO! Usamos la descripción en lugar del autor
                    const description = document.createElement('p');
                    description.textContent = truncateText(item.description, 100); // Acortamos a 100 caracteres

                    content.appendChild(title);
                    content.appendChild(description); // Añadimos la descripción
                    card.appendChild(image);
                    card.appendChild(content);

                    feedContainer.appendChild(card);
                });
            } else {
                feedContainer.innerHTML = '<p>No se pudieron cargar las publicaciones.</p>';
            }
        })
        .catch(error => {
            console.error('Error al obtener el feed:', error);
            feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
        });
});

// ... todo tu código anterior de tema y feed está aquí arriba ...

// --- LÓGICA DEL MODAL DE CANALES EN VIVO ---
document.addEventListener('DOMContentLoaded', function() {
    // Seleccionamos TODOS los elementos que pueden abrir el modal
    const liveButtonDesktop = document.querySelector('.sidebar-right');
    const liveButtonMobile = document.getElementById('live-button-mobile');
    
    const liveModal = document.getElementById('live-modal');
    const closeModalButton = document.querySelector('.modal-close-button');

    function openModal() {
        if (liveModal) liveModal.classList.add('visible');
    }

    function closeModal() {
        if (liveModal) liveModal.classList.remove('visible');
    }

    // Aseguramos que los elementos existan antes de añadirles eventos
    if (liveModal && closeModalButton) {
        // Añadimos el evento al botón de escritorio
        if (liveButtonDesktop) {
            liveButtonDesktop.addEventListener('click', openModal);
        }
        // Añadimos el evento al botón de móvil
        if (liveButtonMobile) {
            liveButtonMobile.addEventListener('click', openModal);
        }
        
        closeModalButton.addEventListener('click', closeModal);

        liveModal.addEventListener('click', function(event) {
            if (event.target === liveModal) {
                closeModal();
            }
        });
    }
});