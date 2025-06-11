/**
 * =========================================================================
 * Lógica para los Reproductores de Video (usando Plyr.io)
 * Versión Final: Lógica de carrusel declarativa.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initializeVideoPlayers() {
        const storyPlayerElements = document.querySelectorAll('.story-player');
        
        if (storyPlayerElements.length === 0) {
            // Reintentar si app.js aún no ha añadido los divs al DOM
            setTimeout(initializeVideoPlayers, 200); 
            return;
        }

        // --- 1. REPRODUCTOR DESTACADO ---
        // Se autoinicializa desde el HTML. Solo lo instanciamos para poder controlarlo si es necesario.
        const featuredPlayer = new Plyr('#video-featured-player');

        // --- 2. REPRODUCTOR DE HISTORIAS ---
        const nextButton = document.getElementById('story-next-btn');
        const volumeButton = document.getElementById('story-volume-btn');

        // Plyr.setup inicializa todos los reproductores que coinciden con el selector
        // y devuelve un array de las instancias de Plyr que ha creado.
        const storyPlayerInstances = Plyr.setup('.story-player', {
            controls: [],
            autoplay: false, // El autoplay lo manejamos nosotros para tener más control
            muted: true,
            clickToPlay: false,
            tooltips: { controls: false, seek: false },
             youtube: {
                playerVars: {
                    playsinline: 1,
                    controls: 0,
                    rel: 0,
                    showinfo: 0
                }
            }
        });

        if (storyPlayerInstances.length === 0) return;

        let currentVideoIndex = 0;

        // Función que muestra una historia y oculta las demás
        function showStory(index) {
            storyPlayerInstances.forEach((player, i) => {
                // el.elements.container es el div del reproductor, .parentNode es el div con la clase .story-player
                const playerContainer = player.elements.container.parentNode; 
                
                if (i === index) {
                    playerContainer.classList.add('is-active');
                    // Solo reproducir si la ventana está activa para evitar errores
                    if (document.hasFocus()) {
                       player.play();
                    }
                } else {
                    playerContainer.classList.remove('is-active');
                    player.stop(); // Detenemos los videos que no están visibles
                }
            });
        }
        
        // Función para avanzar a la siguiente historia
        function nextStory() {
            currentVideoIndex = (currentVideoIndex + 1) % storyPlayerInstances.length; // Avanza y vuelve al inicio
            showStory(currentVideoIndex);
        }

        // Asignamos el evento 'ended' a CADA reproductor de la lista
        storyPlayerInstances.forEach(player => {
            player.on('ended', nextStory);
        });

        // Asignamos los eventos a nuestros botones personalizados
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
        
        // Inicia el carrusel mostrando la primera historia
        showStory(currentVideoIndex);
    }

    // Inicia todo el proceso
    initializeVideoPlayers();
});