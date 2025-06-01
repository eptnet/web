document.addEventListener('DOMContentLoaded', function() {
    
    // --- LÓGICA DEL FEED DE SUBSTACK (VERSIÓN MEJORADA) ---
    const substackFeedUrl = '[https://eptnews.substack.com/feed](https://eptnews.substack.com/feed)';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
    const feedContainer = document.getElementById('substack-feed-grid');
    const fallbackImage = '[https://i.imgur.com/VdefT0s.png](https://i.imgur.com/VdefT0s.png)';

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
            if (!feedContainer) return; // Salir si el contenedor no existe
            feedContainer.innerHTML = ''; 

            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const card = document.createElement('a');
                    card.href = item.link;
                    card.target = '_blank';
                    card.rel = 'noopener noreferrer';
                    card.classList.add('feed-card');
                    
                    let imageUrl = fallbackImage; // Empezamos con la imagen de fallback

                    // Verificamos si existe una miniatura en el feed
                    if (item.thumbnail && item.thumbnail.length > 0) {
                        // Si existe, la usamos y nos aseguramos de que sea HTTPS
                        imageUrl = item.thumbnail.replace(/^http:\/\//i, 'https://');
                    }
                    
                    const image = document.createElement('img');
                    image.src = imageUrl;
                    image.classList.add('card-image');
                    // Si incluso la URL https falla, usamos la de fallback
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
            if (feedContainer) {
                feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
            }
        });

    // ... (El resto de tu código, como el del tema y el modal, puede ir aquí si lo separaste, si no, asegúrate de que esté todo dentro del mismo 'DOMContentLoaded')
    // Si todo tu JS está en este archivo, solo necesitas reemplazar la sección del fetch.
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