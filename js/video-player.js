/**
 * =========================================================================
 * Lógica para el Reproductor de Video Destacado (usando Plyr.io)
 * Versión estable.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initPlayers() {
        const featuredWrapper = document.getElementById('video-featured-player');

        if (!featuredWrapper) {
            setTimeout(initPlayers, 100);
            return;
        }

        // Inicializamos el único reproductor que existe
        try {
            new Plyr(featuredWrapper, {
                youtube: {
                    playerVars: {
                        origin: window.location.origin
                    }
                }
            });
        } catch (e) {
            console.error("Error inicializando el reproductor destacado (Plyr):", e);
        }
    }
    
    initPlayers();
});