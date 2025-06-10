/**
 * =========================================================================
 * Lógica para los Reproductores de Video (usando Video.js)
 * Lógica de lista de reproducción manual para historias.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initializeVideoPlayers() {
        const storiesPlayerContainer = document.getElementById('video-stories-player');
        const featuredPlayerContainer = document.getElementById('video-featured-player');
        const nextButton = document.querySelector('.story-next-button');

        if (!storiesPlayerContainer || !featuredPlayerContainer || !nextButton) {
            return false;
        }

        // --- 1. CONFIGURACIÓN DEL REPRODUCTOR DE HISTORIAS ---
        const storiesPlayer = videojs('video-stories-player');
        
        // Lista de videos verticales
        const storiesPlaylist = [
            { src: 'https://videos.pexels.com/video-files/8541944/8541944-sd_640_1280_25fps.mp4', type: 'video/mp4' },
            { src: 'https://videos.pexels.com/video-files/4434242/4434242-sd_540_960_30fps.mp4', type: 'video/mp4' },
            { src: 'https://videos.pexels.com/video-files/8065339/8065339-sd_540_960_25fps.mp4', type: 'video/mp4' }
        ];
        let currentVideoIndex = 0;

        function playVideo(index) {
            storiesPlayer.src(storiesPlaylist[index]);
            storiesPlayer.play();
        }

        // Evento para pasar al siguiente video cuando uno termina
        storiesPlayer.on('ended', () => {
            currentVideoIndex++;
            if (currentVideoIndex >= storiesPlaylist.length) {
                currentVideoIndex = 0; // Vuelve al inicio
            }
            playVideo(currentVideoIndex);
        });

        // Evento para el botón de "Siguiente"
        nextButton.addEventListener('click', () => {
            currentVideoIndex++;
            if (currentVideoIndex >= storiesPlaylist.length) {
                currentVideoIndex = 0; // Vuelve al inicio
            }
            playVideo(currentVideoIndex);
        });

        // Iniciar la reproducción con el primer video
        playVideo(currentVideoIndex);


        // --- 2. INICIALIZACIÓN DEL VIDEO DESTACADO ---
        const featuredPlayer = videojs('video-featured-player');
        featuredPlayer.src({
            src: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            type: 'video/mp4'
        });
        
        return true;
    }

    const initializationInterval = setInterval(() => {
        const success = initializeVideoPlayers();
        if (success) {
            clearInterval(initializationInterval);
        }
    }, 100);
});