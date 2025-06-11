/**
 * =========================================================================
 * Lógica para los Reproductores de Video (usando Plyr.io)
 * Versión Definitiva: Corrige el error 'postMessage' y la lógica del carrusel.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initializeVideoPlayers() {
        const storyPlayerElements = document.querySelectorAll('.story-player');
        const featuredWrapper = document.getElementById('video-featured-player');
        
        if (storyPlayerElements.length === 0 || !featuredWrapper) {
            setTimeout(initializeVideoPlayers, 200);
            return;
        }

        // --- Configuración Esencial para YouTube ---
        const plyrYoutubeOptions = {
            youtube: {
                playerVars: {
                    origin: window.location.origin, // Permite la comunicación con tu dominio
                    controls: 0,
                    showinfo: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    modestbranding: 1,
                    playsinline: 1 // Clave para reproducción fluida
                }
            }
        };

        // --- 1. REPRODUCTOR DESTACADO ---
        // Lo inicializamos con JS para asegurarnos de que recibe las opciones correctas.
        const featuredPlayer = new Plyr(featuredWrapper, plyrYoutubeOptions);


        // --- 2. REPRODUCTOR DE HISTORIAS ---
        const nextButton = document.getElementById('story-next-btn');
        const volumeButton = document.getElementById('story-volume-btn');
        let storyPlayerInstances = [];
        let currentVideoIndex = 0;

        const storiesPlayerOptions = {
            controls: [],
            autoplay: true, // Dejamos que Plyr intente el autoplay inicial
            muted: true,
            clickToPlay: false,
            ...plyrYoutubeOptions // Unimos las opciones de YouTube
        };

        // Bucle para inicializar cada reproductor de historia individualmente
        storyPlayerElements.forEach((wrapper, index) => {
            const player = new Plyr(wrapper, storiesPlayerOptions);
            
            player.on('ready', event => {
                // Cuando un reproductor está listo, nos aseguramos de que se reproduzca si es el activo
                if (index === currentVideoIndex && document.hasFocus()) {
                    player.play();
                }
            });

            player.on('ended', () => {
                // Cuando un video termina, avanza al siguiente
                nextStory();
            });

            storyPlayerInstances.push(player);
        });

        if (storyPlayerInstances.length === 0) return;

        function showStory(index) {
            storyPlayerInstances.forEach((player, i) => {
                const playerContainer = player.elements.container.parentNode;
                
                if (i === index) {
                    playerContainer.classList.add('is-active');
                    player.play();
                } else {
                    playerContainer.classList.remove('is-active');
                    player.stop();
                }
            });
        }
        
        function nextStory() {
            currentVideoIndex = (currentVideoIndex + 1) % storyPlayerInstances.length;
            showStory(currentVideoIndex);
        }

        if (nextButton) {
            nextButton.addEventListener('click', nextStory);
        }
        
        if (volumeButton) {
            volumeButton.addEventListener('click', () => {
                const currentPlayer = storyPlayerInstances[currentVideoIndex];
                if (currentPlayer) {
                    currentPlayer.muted = !currentPlayer.muted;
                    volumeButton.innerHTML = currentPlayer.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                }
            });
        }
        
        // Muestra la primera historia (el reproductor ya tiene la fuente desde el HTML)
        showStory(currentVideoIndex);
    }

    // Inicia el proceso
    initializeVideoPlayers();
});