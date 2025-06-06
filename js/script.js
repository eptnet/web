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

    // --- LÓGICA DEL PANEL LATERAL ---
    const postPanel = document.getElementById('post-panel');
    if (postPanel) {
        const panelCloseBtn = postPanel.querySelector('.panel-close-button');
        const panelTitle = postPanel.querySelector('#panel-title');
        const panelAudioContainer = postPanel.querySelector('#panel-audio-player-container');
        const panelBodyContent = postPanel.querySelector('#panel-body-content');
        const shareTwitter = postPanel.querySelector('#share-twitter');
        const shareFacebook = postPanel.querySelector('#share-facebook');
        const shareLinkedin = postPanel.querySelector('#share-linkedin');
        const copyLinkButton = postPanel.querySelector('#share-copy-link');
        const nativeShareButton = postPanel.querySelector('#native-share-btn');
        let currentUrlToShare = '';

        if (nativeShareButton && !navigator.share) {
            nativeShareButton.style.display = 'none';
        }

        const openPostPanel = (item) => {
            panelTitle.textContent = item.title || "Sin título";
            panelAudioContainer.innerHTML = '';
            panelBodyContent.innerHTML = item.content || "<p>Contenido no disponible.</p>";
            currentUrlToShare = item.link || window.location.href;

            if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg') && item.enclosure.link) {
                const audioPlayer = document.createElement('audio');
                audioPlayer.controls = true;
                audioPlayer.controlsList = 'nodownload';
                audioPlayer.src = item.enclosure.link.replace(/^http:\/\//i, 'https://');
                panelAudioContainer.appendChild(audioPlayer);
            }
            
            const shareUrl = encodeURIComponent(currentUrlToShare);
            const shareTitle = encodeURIComponent(item.title || document.title);
            if(shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`;
            if(shareFacebook) shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
            if(shareLinkedin) shareLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

            document.body.classList.add('panel-open');
            postPanel.classList.add('open');
        };

        const openPlaceholderPanel = (title) => {
            panelTitle.textContent = title;
            panelAudioContainer.innerHTML = '';
            panelBodyContent.innerHTML = `<p style="padding: 20px; text-align: center;">Aquí se mostrará el contenido correspondiente a la sección "<strong>${title}</strong>".<br/>Esta funcionalidad está en desarrollo.</p>`;
            currentUrlToShare = window.location.href;
            
            const shareUrl = encodeURIComponent(currentUrlToShare);
            const shareTitle = encodeURIComponent(title);
            if(shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`;
            if(shareFacebook) shareFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
            if(shareLinkedin) shareLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
            
            document.body.classList.add('panel-open');
            postPanel.classList.add('open');
        };
        
        const closePostPanel = () => {
            postPanel.classList.remove('open');
            document.body.classList.remove('panel-open');
            const audioPlayer = panelAudioContainer.querySelector('audio');
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
        };

        if (panelCloseBtn) panelCloseBtn.addEventListener('click', closePostPanel);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && postPanel.classList.contains('open')) closePostPanel();
        });

        document.querySelectorAll('.panel-trigger').forEach(trigger => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                const placeholderTitle = trigger.getAttribute('data-panel-title');
                if (placeholderTitle) {
                    openPlaceholderPanel(placeholderTitle);
                }
            });
        });

        if (copyLinkButton) {
            copyLinkButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (currentUrlToShare && navigator.clipboard) {
                    navigator.clipboard.writeText(currentUrlToShare).then(() => {
                        const icon = copyLinkButton.querySelector('i');
                        if (icon) {
                            const originalHTML = icon.outerHTML;
                            copyLinkButton.innerHTML = '¡Copiado!';
                            setTimeout(() => { copyLinkButton.innerHTML = originalHTML; }, 2000);
                        }
                    }).catch(err => console.error('Error al copiar enlace:', err));
                }
            });
        }

        if (nativeShareButton && navigator.share) {
            nativeShareButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (currentUrlToShare) {
                    try {
                        await navigator.share({ title: panelTitle.textContent, url: currentUrlToShare });
                    } catch (err) { console.error('Error al compartir:', err); }
                }
            });
        }
        
        // --- LÓGICA DEL FEED DE SUBSTACK ---
        const feedContainer = document.getElementById('substack-feed-grid');
        if (feedContainer) {
            const substackFeedUrl = 'https://eptnews.substack.com/feed';
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
            const genericPodcastImage = 'https://i.ibb.co/F42PGTLf/Leonardo-Phoenix-10-A-vibrant-ornate-podcast-artwork-with-a-pr-1.jpg';
            const fallbackImage = 'https://i.imgur.com/VdefT0s.png';
            let allItems = [];
            let itemsPerLoad = 8;
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
                card.addEventListener('click', () => openPostPanel(item)); // Listener de clic reparado
                
                let imageUrl = fallbackImage;
                const isAudioPost = item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg');
                if (isAudioPost) { imageUrl = genericPodcastImage; }
                else if (item.thumbnail && item.thumbnail.length > 0) { imageUrl = item.thumbnail; }
                else if (item.enclosure && item.enclosure.link && item.enclosure.type.startsWith('image')) { imageUrl = item.enclosure.link; }
                
                if(imageUrl) imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
                
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
                const cardLink = document.createElement('a');
                cardLink.id = 'end-of-feed-card';
                cardLink.href = "https://eptnews.substack.com/subscribe?";
                cardLink.target = "_blank";
                cardLink.rel = "noopener noreferrer";
                cardLink.classList.add('feed-card', 'subscribe-card');
                cardLink.innerHTML = `<div class="card-content"><h3>¿Te gustó lo que viste?</h3><p>Sigue explorando en EPT News y suscríbete para no perderte futuras publicaciones.</p><span class="cta-button-imitation">Suscribirme a EPT News</span></div>`;
                return cardLink;
            };

            const displayItems = () => {
                const fragment = document.createDocumentFragment();
                const itemsToDisplay = allItems.slice(currentIndex, currentIndex + itemsPerLoad);
                itemsToDisplay.forEach(item => fragment.appendChild(createCardElement(item)));
                
                const existingLoadMoreButton = document.getElementById('load-more-btn');
                if (existingLoadMoreButton) existingLoadMoreButton.remove();
                
                feedContainer.appendChild(fragment);
                currentIndex += itemsToDisplay.length;
                
                if (currentIndex < allItems.length) {
                    const loadMoreButton = document.createElement('div');
                    loadMoreButton.id = 'load-more-btn';
                    loadMoreButton.classList.add('feed-card', 'load-more-card');
                    loadMoreButton.innerHTML = `<div class="card-content"><span>Cargar más publicaciones</span><i class="fas fa-chevron-down"></i></div>`;
                    loadMoreButton.addEventListener('click', displayItems);
                    feedContainer.appendChild(loadMoreButton);
                } else {
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
                        displayItems();
                    } else {
                        feedContainer.innerHTML = '<p>No se encontraron publicaciones.</p>';
                    }
                })
                .catch(error => {
                    console.error('Error al obtener el feed:', error);
                    if (feedContainer) feedContainer.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
                });
        }
    }
});