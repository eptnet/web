/**
 * =========================================================================
 * Lógica para los Reproductores de Video (usando Plyr.io)
 * Versión Final v6: Corrige error de 'postMessage' con inicialización JS.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initializeVideoPlayers() {
        // Contenedores
        const storiesPlayerWrappers = document.querySelectorAll('.story-player');
        const featuredWrapper = document.getElementById('video-featured-player');
        
        if (storiesPlayerWrappers.length === 0 || !featuredWrapper) {
            setTimeout(initializeVideoPlayers, 200);
            return;
        }

        // --- Opciones de Configuración para YouTube en Plyr ---
        // Esto soluciona el error 'postMessage' y los botones duplicados
        const plyrYoutubeOptions = {
            youtube: {
                playerVars: {
                    origin: window.location.origin, // Permite la comunicación segura con tu dominio
                    controls: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    showinfo: 0,
                    rel: 0
                }
            }
        };

        // --- 1. REPRODUCTOR DESTACADO ---
        const featuredPlayer = new Plyr(featuredWrapper, plyrYoutubeOptions);

        // --- 2. REPRODUCTOR DE HISTORIAS ---
        const nextButton = document.getElementById('story-next-btn');
        const volumeButton = document.getElementById('story-volume-btn');
        
        const storiesPlaylist = [
            { provider: 'youtube', embedId: 'MlJYzpXrlq8' },
            { provider: 'youtube', embedId: '2E0mxIYMGAM' },
            { provider: 'youtube', embedId: 'ldeQjvd6x5U' }
        ];
        let currentVideoIndex = 0;
        let storyPlayerInstances = [];

        // Opciones específicas para las historias
        const storiesPlayerOptions = {
            controls: [],
            autoplay: true,
            muted: true,
            clickToPlay: false,
            ...plyrYoutubeOptions // Unimos las opciones de YouTube
        };

        // Inicializamos una instancia de Plyr para cada div de historia
        storiesPlayerWrappers.forEach((wrapper, index) => {
            const player = new Plyr(wrapper, storiesPlayerOptions);
            storyPlayerInstances.push(player);
        });

        function playStory(index) {
            storyPlayerInstances.forEach((player, i) => {
                const playerContainer = player.elements.container.parentNode;
                if (i === index) {
                    playerContainer.classList.add('is-active');
                    // Asignamos la fuente solo al que vamos a reproducir
                    player.source = {
                        type: 'video',
                        sources: [{
                            src: storiesPlaylist[i].embedId,
                            provider: storiesPlaylist[i].provider,
                        }]
                    };
                } else {
                    playerContainer.classList.remove('is-active');
                    player.stop();
                }
            });
        }
        
        function nextStory() {
            currentVideoIndex = (currentVideoIndex + 1) % storyPlayerInstances.length;
            playStory(currentVideoIndex);
        }

        storyPlayerInstances.forEach((player, index) => {
            // Cuando el video está listo, nos aseguramos de que se reproduzca
            player.on('ready', event => {
                if (index === currentVideoIndex && document.hasFocus()) {
                    event.detail.plyr.play();
                }
            });
            // Cuando un video termina, llamamos a nextStory
            player.on('ended', nextStory);
        });

        if (nextButton) nextButton.addEventListener('click', nextStory);
        
        if (volumeButton) {
            volumeButton.addEventListener('click', () => {
                const currentPlayer = storyPlayerInstances[currentVideoIndex];
                if (currentPlayer) {
                    currentPlayer.muted = !currentPlayer.muted;
                    volumeButton.innerHTML = currentPlayer.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                }
            });
        }
        
        // Carga y muestra la primera historia
        playStory(currentVideoIndex);
    }

    // Inicia el proceso
    initializeVideoPlayers();
});