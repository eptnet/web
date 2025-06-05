document.addEventListener('DOMContentLoaded', function() {

    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;

    if (themeToggle) {
        const applyThemeVisuals = (theme) => {
            if (theme === 'light-mode') {
                body.classList.add('light-mode');
            } else {
                body.classList.remove('light-mode');
            }
        };
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            applyThemeVisuals(savedTheme);
        } else {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                applyThemeVisuals('light-mode');
            } else {
                applyThemeVisuals('dark-mode');
            }
        }
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            localStorage.setItem('theme', body.classList.contains('light-mode') ? 'light-mode' : 'dark-mode');
        });
    }

    // --- LÓGICA DEL MODAL DE CANALES EN VIVO ---
    const liveButtonDesktop = document.querySelector('.sidebar-right');
    const liveButtonMobile = document.getElementById('live-button-mobile');
    const liveModal = document.getElementById('live-modal');
    const closeModalButton = document.querySelector('.modal-close-button');

    if (liveModal && closeModalButton) {
        const openLiveModal = () => liveModal.classList.add('visible');
        const closeLiveModal = () => liveModal.classList.remove('visible');

        if (liveButtonDesktop) liveButtonDesktop.addEventListener('click', openLiveModal);
        if (liveButtonMobile) liveButtonMobile.addEventListener('click', openLiveModal);
        closeModalButton.addEventListener('click', closeLiveModal);
        liveModal.addEventListener('click', (event) => {
            if (event.target === liveModal) closeLiveModal();
        });
    }

    // --- LÓGICA DEL PANEL LATERAL DE PUBLICACIONES ---
    const postPanel = document.getElementById('post-panel');
    const panelCloseBtn = document.querySelector('.panel-close-button');
    const panelTitle = document.getElementById('panel-title');
    const panelAudioContainer = document.getElementById('panel-audio-player-container');
    const panelBodyContent = document.getElementById('panel-body-content');
    const shareTwitter = document.getElementById('share-twitter');
    const shareFacebook = document.getElementById('share-facebook');
    const shareLinkedin = document.getElementById('share-linkedin');
    
    const openPostPanel = (item) => {
        if (!postPanel || !panelTitle || !panelAudioContainer || !panelBodyContent) return;

        panelTitle.textContent = item.title || "Sin título";
        panelAudioContainer.innerHTML = '';
        panelBodyContent.innerHTML = '';

        if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg') && item.enclosure.link) {
            const audioPlayer = document.createElement('audio');
            audioPlayer.controls = true;
            audioPlayer.src = item.enclosure.link.replace(/^http:\/\//i, 'https://');
            panelAudioContainer.appendChild(audioPlayer);
        }
        
        panelBodyContent.innerHTML = item.content || "<p>Contenido no disponible.</p>";
        
        const shareUrl = encodeURIComponent(item.link || window.location.href);
        const shareTitle = encodeURIComponent(item.title || document.title);
        if(shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`;
        if(shareFacebook) shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        if(shareLinkedin) shareLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

        document.body.classList.add('panel-open');
        postPanel.classList.add('open');
    };

    const closePostPanel = () => {
        if (!postPanel) return;
        postPanel.classList.remove('open');
        document.body.classList.remove('panel-open');
        const audioPlayer = panelAudioContainer.querySelector('audio');
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }
    };

    if (panelCloseBtn) {
        panelCloseBtn.addEventListener('click', closePostPanel);
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && postPanel && postPanel.classList.contains('open')) {
            closePostPanel();
        }
    });

    // --- LÓGICA DEL FEED DE SUBSTACK (CON "CARGAR MÁS" Y TARJETA FINAL DE SUSCRIPCIÓN) ---
    const feedContainer = document.getElementById('substack-feed-grid');
    if (feedContainer) {
        const substackFeedUrl = 'https://eptnews.substack.com/feed';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
        const genericPodcastImage = 'https://i.ibb.co/F42PGTLf/Leonardo-Phoenix-10-A-vibrant-ornate-podcast-artwork-with-a-pr-1.jpg';
        const fallbackImage = 'https://i.imgur.com/VdefT0s.png';
        
        let allItems = [];
        let itemsPerLoad = 6; // Cuántos items mostrar inicialmente y por cada "cargar más"
        let currentIndex = 0;

        const truncateText = (html, maxLength) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            let text = tempDiv.textContent || tempDiv.innerText || "";
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        const createCardElement = (item) => {
            const card = document.createElement('div'); 
            card.classList.add('feed-card');
            card.addEventListener('click', () => openPostPanel(item));

            let imageUrl = fallbackImage;
            const isAudioPost = item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg');

            if (isAudioPost && genericPodcastImage) {
                imageUrl = genericPodcastImage;
            } else if (item.thumbnail && item.thumbnail.length > 0) {
                imageUrl = item.thumbnail;
            } else if (item.enclosure && item.enclosure.link && item.enclosure.type && item.enclosure.type.startsWith('image')) {
                imageUrl = item.enclosure.link;
            }
            imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
            
            const image = document.createElement('img');
            image.src = imageUrl;
            image.classList.add('card-image');
            image.alt = item.title || "Miniatura de publicación";
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
            return card;
        };
        
        const createEndOfFeedCard = () => {
            const card = document.createElement('div');
            card.id = 'end-of-feed-card';
            card.classList.add('feed-card', 'subscribe-card'); // Reutilizamos estilos si es posible
            card.innerHTML = `
                <div class="card-content">
                    <h3>¿Te gustó lo que viste?</h3>
                    <p>Sigue explorando en EPT News y suscríbete para no perderte futuras publicaciones.</p>
                    <a href="https://eptnews.substack.com/subscribe?" target="_blank" rel="noopener noreferrer" class="cta-button">Suscribirme a EPT News</a>
                </div>
            `;
            return card;
        };

        const displayItems = () => {
            const fragment = document.createDocumentFragment();
            const itemsToDisplay = allItems.slice(currentIndex, currentIndex + itemsPerLoad);
            
            itemsToDisplay.forEach(item => {
                fragment.appendChild(createCardElement(item));
            });
            
            // Quitar el botón "Cargar más" o la tarjeta final anteriores si existen
            const existingLoadMoreButton = document.getElementById('load-more-btn');
            if (existingLoadMoreButton) existingLoadMoreButton.remove();
            const existingEndOfFeedCard = document.getElementById('end-of-feed-card');
            if (existingEndOfFeedCard) existingEndOfFeedCard.remove();
            
            feedContainer.appendChild(fragment);
            currentIndex += itemsToDisplay.length;

            if (currentIndex < allItems.length) { // Si quedan items por cargar
                const loadMoreButton = document.createElement('div');
                loadMoreButton.id = 'load-more-btn';
                loadMoreButton.classList.add('feed-card', 'load-more-card');
                loadMoreButton.innerHTML = `<div class="card-content"><span>Cargar ${Math.min(itemsPerLoad, allItems.length - currentIndex)} publicaciones más</span><i class="fas fa-chevron-down"></i></div>`;
                loadMoreButton.addEventListener('click', displayItems);
                feedContainer.appendChild(loadMoreButton);
            } else { // Se han cargado todos los items
                feedContainer.appendChild(createEndOfFeedCard());
            }
        };

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (!feedContainer) return;
                feedContainer.innerHTML = ''; 
                if (data.items && data.items.length > 0) {
                    allItems = data.items;
                    currentIndex = 0;
                    displayItems(); // Muestra los primeros items y el botón correspondiente
                } else {
                    feedContainer.innerHTML = '<p>No se encontraron publicaciones.</p>';
                }
            })
            .catch(error => {
                console.error('Error al obtener el feed:', error);
                if (feedContainer) {
                     feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
                }
            });
    }
});