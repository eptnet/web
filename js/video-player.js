/**
 * =========================================================================
 * Lógica para Reproductores Plyr.io
 * VERSIÓN DE DEPURACIÓN: Añade logs a la consola.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initializeVideoPlayers() {
        console.log('[PLYR DEBUG] Buscando elementos de reproductores...');
        const storyPlayerElements = document.querySelectorAll('.story-player');
        
        if (storyPlayerElements.length === 0) {
            setTimeout(initializeVideoPlayers, 200); 
            return;
        }
        console.log(`[PLYR DEBUG] Encontrados ${storyPlayerElements.length} reproductores de historias.`);

        // --- REPRODUCTOR DESTACADO ---
        try {
            const featuredPlayer = new Plyr('#video-featured-player');
            console.log('[PLYR DEBUG] Reproductor destacado inicializado con éxito.');
        } catch (e) {
            console.error('[PLYR DEBUG] Falló la inicialización del reproductor destacado:', e);
        }

        // --- REPRODUCTOR DE HISTORIAS ---
        const nextButton = document.getElementById('story-next-btn');
        const volumeButton = document.getElementById('story-volume-btn');

        const storiesPlayerOptions = {
            controls: [],
            autoplay: false,
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
        };

        console.log('[PLYR DEBUG] Inicializando todas las instancias de historias con Plyr.setup...');
        const storyPlayerInstances = Plyr.setup('.story-player', storiesPlayerOptions);

        if (!storyPlayerInstances || storyPlayerInstances.length === 0) {
            console.error('[PLYR DEBUG] Plyr.setup no devolvió instancias para las historias.');
            return;
        }
        console.log(`[PLYR DEBUG] Se crearon ${storyPlayerInstances.length} instancias de Plyr para las historias.`);

        let currentVideoIndex = 0;

        function showStory(index) {
            console.log(`[PLYR DEBUG] showStory llamado para el índice: ${index}`);
            storyPlayerInstances.forEach((player, i) => {
                const playerContainer = player.elements.container?.parentNode; 
                
                if (!playerContainer) {
                    console.error(`[PLYR DEBUG] No se encontró el contenedor para el reproductor de historias #${i}`);
                    return;
                }

                if (i === index) {
                    playerContainer.classList.add('is-active');
                    console.log(`[PLYR DEBUG] Mostrando historia #${i}. Intentando play.`);
                    if (document.hasFocus()) {
                       player.play();
                    }
                } else {
                    playerContainer.classList.remove('is-active');
                    player.stop();
                }
            });
        }
        
        function nextStory() {
            console.log('[PLYR DEBUG] nextStory llamado.');
            currentVideoIndex = (currentVideoIndex + 1) % storyPlayerInstances.length;
            showStory(currentVideoIndex);
        }

        storyPlayerInstances.forEach((player, index) => {
            player.on('ready', () => console.log(`[PLYR DEBUG] Reproductor de historia #${index} está listo (ready).`));
            player.on('playing', () => console.log(`[PLYR DEBUG] Reproductor de historia #${index} está reproduciendo (playing).`));
            player.on('pause', () => console.log(`[PLYR DEBUG] Reproductor de historia #${index} pausado.`));
            player.on('ended', () => {
                console.log(`[PLYR DEBUG] Reproductor de historia #${index} ha terminado (ended).`);
                nextStory();
            });
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
        
        console.log('[PLYR DEBUG] Mostrando la primera historia...');
        showStory(currentVideoIndex);
    }

    initializeVideoPlayers();
});