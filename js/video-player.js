/**
 * =========================================================================
 * Lógica para los Reproductores de Video (Versión Dividida)
 * - Plyr.io para el video destacado.
 * - Player.js para las historias.
 * Versión Final v2: Corrige errores de inicialización y 'postMessage'.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    function initPlayers() {
        const featuredWrapper = document.getElementById('video-featured-player');
        const storiesWrapper = document.getElementById('video-stories-player');

        if (!featuredWrapper || !storiesWrapper) {
            setTimeout(initPlayers, 100);
            return;
        }

        // --- 1. REPRODUCTOR DESTACADO (PLYR.IO) ---
        // Soluciona el error 'postMessage' y los iconos duplicados.
        try {
            const featuredPlayer = new Plyr(featuredWrapper, {
                youtube: {
                    playerVars: {
                        origin: window.location.origin,
                        controls: 0,
                        iv_load_policy: 3
                    }
                }
            });
            // Asignamos la fuente desde JS para asegurar que las opciones se apliquen
            featuredPlayer.source = {
                type: 'video',
                sources: [{
                    src: '2Vq_N_wgUkk',
                    provider: 'youtube',
                }]
            };
        } catch (e) {
            console.error("Error inicializando el reproductor destacado (Plyr):", e);
        }

        // --- 2. REPRODUCTOR DE HISTORIAS (PLAYER.JS) ---
        // Soluciona el error 'TypeError' y 'postMessage'
        try {
            // Construimos el parámetro de origen dinámicamente
            const originParam = `?enablejsapi=1&origin=${window.location.origin}`;

            const storiesPlaylist = [
                { title: 'Historia 1', file: `https://youtube.com/shorts/2E0mxIYMGAM{originParam}` },
                { title: 'Historia 2', file: `https://youtube.com/shorts/8GvLr9-DCF0{originParam}` },
                { title: 'Historia 3', file: `https://youtube.com/shorts/S2etubPd-ko{originParam}` },
            ];

            const storiesPlayer = new Playerjs({
                id: 'video-stories-player',
                file: storiesPlaylist,
                autoplay: 1,
                muted: 1,
                loop: 1,
            });

            const nextButton = document.getElementById('story-next-btn');
            const volumeButton = document.getElementById('story-volume-btn');

            if (nextButton) nextButton.addEventListener('click', () => storiesPlayer.next());
            if (volumeButton) volumeButton.addEventListener('click', () => storiesPlayer.toggleMute());

        } catch (e) {
            console.error("Error inicializando el reproductor de historias (Player.js):", e);
        }
    }

    initPlayers();
});