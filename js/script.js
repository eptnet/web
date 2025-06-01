document.addEventListener('DOMContentLoaded', function() {

    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        // Función para aplicar un tema
        const applyTheme = (theme) => {
            if (theme === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
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
            const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }


    // --- LÓGICA DEL MODAL DE CANALES EN VIVO ---
    const liveButtonDesktop = document.querySelector('.sidebar-right');
    const liveButtonMobile = document.getElementById('live-button-mobile');
    const liveModal = document.getElementById('live-modal');
    const closeModalButton = document.querySelector('.modal-close-button');

    if (liveModal && closeModalButton) {
        const openModal = () => liveModal.classList.add('visible');
        const closeModal = () => liveModal.classList.remove('visible');

        if (liveButtonDesktop) liveButtonDesktop.addEventListener('click', openModal);
        if (liveButtonMobile) liveButtonMobile.addEventListener('click', openModal);
        
        closeModalButton.addEventListener('click', closeModal);

        liveModal.addEventListener('click', function(event) {
            if (event.target === liveModal) {
                closeModal();
            }
        });
    }


    // --- LÓGICA DEL FEED DE SUBSTACK (VERSIÓN CORREGIDA) ---
    const feedContainer = document.getElementById('substack-feed-grid');
    if (feedContainer) {
        const substackFeedUrl = 'https://eptnews.substack.com/feed';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
        const fallbackImage = 'https://i.imgur.com/VdefT0s.png';

        const truncateText = (html, maxLength) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            let text = tempDiv.textContent || tempDiv.innerText || "";
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                feedContainer.innerHTML = ''; 

                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        const card = document.createElement('a');
                        card.href = item.link;
                        card.target = '_blank';
                        card.rel = 'noopener noreferrer';
                        card.classList.add('feed-card');
                        
                        let imageUrl = fallbackImage;
                        if (item.thumbnail && item.thumbnail.length > 0) {
                            imageUrl = item.thumbnail.replace(/^http:\/\//i, 'https://');
                        }
                        
                        const image = document.createElement('img');
                        image.src = imageUrl;
                        image.classList.add('card-image');
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
                    feedContainer.innerHTML = '<p>No se pudieron cargar las publicaciones.</p>';
                }
            })
            .catch(error => {
                console.error('Error al obtener el feed:', error);
                feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
            });
    }
});