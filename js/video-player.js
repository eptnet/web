/**
 * =========================================================================
 * Lógica para Reproductores de Video
 * Versión Final: Utiliza URLs de embed completas y corrige el error 'postMessage'.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const mainContainer = document.querySelector('main.container');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const sidePanelCloseBtn = document.getElementById('side-panel-close');
    const overlay = document.getElementById('overlay');

    let storiesPlayerInstance = null; 

    function initializeFeaturedPlayer() {
        const featuredWrapper = document.querySelector('[data-plyr-embed-id*="youtube.com/embed"]');
        if (!featuredWrapper) {
            setTimeout(initializeFeaturedPlayer, 100);
            return;
        }

        try {
            new Plyr(featuredWrapper, {
                youtube: {
                    playerVars: { origin: window.location.origin }
                }
            });
        } catch (e) {
            console.error("Error inicializando el reproductor destacado (Plyr):", e);
        }
    }

    function launchStoriesPlayer() {
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.add('side-panel__content--video');
        sidePanel.classList.add('is-open');
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';

        sidePanelContent.innerHTML = `
            <div id="panel-player-container">
                <div id="panel-player"></div>
                <div class="story-controls">
                    <button class="story-button" id="panel-volume-btn" aria-label="Activar sonido"><i class="fa-solid fa-volume-xmark"></i></button>
                    <button class="story-button" id="panel-next-btn" aria-label="Siguiente historia"><i class="fa-solid fa-angle-right"></i></button>
                </div>
            </div>
        `;

        const storiesPlaylist = [
            { provider: 'youtube', embedId: 'https://www.youtube.com/embed/MlJYzpXrlq8' },
            { provider: 'youtube', embedId: 'https://www.youtube.com/embed/2E0mxIYMGAM' },
            { provider: 'youtube', embedId: 'https://www.youtube.com/embed/ldeQjvd6x5U' }
        ];
        let currentVideoIndex = 0;

        storiesPlayerInstance = new Plyr('#panel-player', {
            controls: [],
            autoplay: true,
            muted: true,
            clickToPlay: false,
            youtube: {
                playerVars: {
                    origin: window.location.origin,
                    playsinline: 1,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    rel: 0
                }
            }
        });
        
        const playVideo = (index) => {
            if (storiesPlayerInstance) {
                const video = storiesPlaylist[index];
                storiesPlayerInstance.source = {
                    type: 'video',
                    sources: [{ src: video.embedId, provider: video.provider }]
                };
            }
        };

        const nextStory = () => {
            currentVideoIndex = (currentVideoIndex + 1) % storiesPlaylist.length;
            playVideo(currentVideoIndex);
        };
        
        storiesPlayerInstance.on('ready', event => event.detail.plyr.play());
        storiesPlayerInstance.on('ended', nextStory);

        document.getElementById('panel-next-btn').addEventListener('click', nextStory);
        document.getElementById('panel-volume-btn').addEventListener('click', () => {
            if (storiesPlayerInstance) {
                storiesPlayerInstance.muted = !storiesPlayerInstance.muted;
                document.getElementById('panel-volume-btn').innerHTML = storiesPlayerInstance.muted 
                    ? '<i class="fa-solid fa-volume-xmark"></i>' 
                    : '<i class="fa-solid fa-volume-high"></i>';
            }
        });

        playVideo(currentVideoIndex);
    }

    function destroyStoriesPlayer() {
        if (storiesPlayerInstance) {
            storiesPlayerInstance.destroy();
            storiesPlayerInstance = null;
        }
        sidePanelContent.innerHTML = '';
        sidePanelContent.classList.remove('side-panel__content--video');
    }

    initializeFeaturedPlayer();

    mainContainer.addEventListener('click', (event) => {
        const storiesCard = event.target.closest('[data-id="static-launch-stories"]');
        if (storiesCard) {
            launchStoriesPlayer();
        }
    });

    sidePanelCloseBtn.addEventListener('click', destroyStoriesPlayer);
    overlay.addEventListener('click', destroyStoriesPlayer);
});