document.addEventListener('DOMContentLoaded', function() {

    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        const body = document.body;
        const applyTheme = (theme) => {
            body.classList.toggle('light-mode', theme === 'light-mode');
        };
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            applyTheme(systemPrefersLight ? 'light-mode' : 'dark-mode');
        }
        themeToggle.addEventListener('click', () => {
            const newTheme = body.classList.contains('light-mode') ? 'dark-mode' : 'light-mode';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // --- LÓGICA DEL PANEL LATERAL ---
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel) {
        const panelCloseBtn = sidePanel.querySelector('.panel-close-button');
        const panelTitle = sidePanel.querySelector('#panel-title');
        const panelAudioContainer = sidePanel.querySelector('#panel-audio-player-container');
        const panelBodyContent = sidePanel.querySelector('#panel-body-content');
        const copyLinkButton = sidePanel.querySelector('#share-copy-link');
        const nativeShareButton = sidePanel.querySelector('#native-share-btn');
        let currentShareData = {};

        if (nativeShareButton && !navigator.share) {
            nativeShareButton.style.display = 'none';
        }

        const openPanel = (data) => {
            currentShareData = data;
            panelTitle.textContent = data.title || "Sin título";
            panelAudioContainer.innerHTML = '';
            panelBodyContent.innerHTML = data.content || "<p>Contenido no disponible.</p>";

            if (data.isAudio && data.audioUrl) {
                const audioPlayer = document.createElement('audio');
                audioPlayer.controls = true;
                audioPlayer.controlsList = 'nodownload';
                audioPlayer.src = data.audioUrl.replace(/^http:\/\//i, 'https://');
                panelAudioContainer.appendChild(audioPlayer);
            }
            
            sidePanel.classList.add('open');
        };

        const closePanel = () => {
            sidePanel.classList.remove('open');
            const audioPlayer = panelAudioContainer.querySelector('audio');
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
        };

        if (panelCloseBtn) panelCloseBtn.addEventListener('click', closePanel);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && sidePanel.classList.contains('open')) closePanel();
        });

        document.querySelectorAll('.panel-trigger').forEach(trigger => {
            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                const placeholderTitle = trigger.getAttribute('data-panel-title');
                if (placeholderTitle) {
                    openPanel({
                        title: placeholderTitle,
                        content: `<p style="padding: 20px; text-align: center;">Aquí se mostrará el contenido correspondiente.<br/>Esta funcionalidad está en desarrollo.</p>`,
                        link: window.location.href
                    });
                }
            });
        });

        if (copyLinkButton) {
            copyLinkButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (currentShareData.link && navigator.clipboard) {
                    navigator.clipboard.writeText(currentShareData.link).then(() => {
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
                if (currentShareData) {
                    try {
                        await navigator.share({ title: currentShareData.title, text: currentShareData.description, url: currentShareData.link });
                    } catch (err) { console.error('Error al compartir:', err); }
                }
            });
        }
        
        // --- LÓGICA DEL FEED DE SUBSTACK ---
        const feedGrid = document.getElementById('substack-feed-grid');
        // CORRECCIÓN CRÍTICA: Apuntar a .main-container para el scroll, no a .main-content
        const mainContainer = document.querySelector('.main-container'); 
        
        if (feedGrid && mainContainer) {
            const substackFeedUrl = 'https://eptnews.substack.com/feed';
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
            const genericPodcastImage = 'https://i.ibb.co/F42PGTLf/Leonardo-Phoenix-10-A-vibrant-ornate-podcast-artwork-with-a-pr-1.jpg';
            const fallbackImage = 'https://i.imgur.com/VdefT0s.png';
            let allItems = [];
            let isLoading = false;
            let cursor = 0;
            const itemsPerLoad = 9;

            const createCardElement = (item) => {
                const card = document.createElement('div');
                card.classList.add('feed-card');
                card.addEventListener('click', () => {
                    const isAudio = item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg');
                    openPanel({
                        title: item.title,
                        content: item.content,
                        link: item.link,
                        description: item.description,
                        isAudio: isAudio,
                        audioUrl: isAudio ? item.enclosure.link : null
                    });
                });
                
                let imageUrl = fallbackImage;
                const isAudioPost = item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('audio/mpeg');
                if (isAudioPost) { imageUrl = genericPodcastImage; }
                else if (item.thumbnail && item.thumbnail.length > 0) { imageUrl = item.thumbnail; }
                else if (item.enclosure && item.enclosure.link && item.enclosure.type.startsWith('image')) { imageUrl = item.enclosure.link; }
                if(imageUrl) imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
                
                card.innerHTML = `
                    <img src="${imageUrl}" class="card-image" alt="" onerror="this.onerror=null;this.src='${fallbackImage}';">
                    <div class="card-content">
                        <h3>${item.title || ''}</h3>
                    </div>
                `;
                return card;
            };

            const loadMoreItems = () => {
                if (isLoading || cursor >= allItems.length) return;
                isLoading = true;

                const itemsToLoad = allItems.slice(cursor, cursor + itemsPerLoad);
                itemsToLoad.forEach(item => {
                    feedGrid.appendChild(createCardElement(item));
                });

                cursor += itemsPerLoad;
                isLoading = false;
            };

            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.items && data.items.length > 0) {
                        feedGrid.innerHTML = '';
                        allItems = data.items;
                        loadMoreItems();
                    } else {
                        feedGrid.innerHTML = '<p>No se encontraron publicaciones.</p>';
                    }
                })
                .catch(error => {
                    console.error('Error al obtener el feed:', error);
                    feedGrid.innerHTML = '<p>Hubo un problema al cargar las publicaciones.</p>';
                });

            mainContainer.addEventListener('scroll', () => {
                if (mainContainer.scrollTop + mainContainer.clientHeight >= mainContainer.scrollHeight - 500) {
                    loadMoreItems();
                }
            });
        }
    }
});