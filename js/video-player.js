/**
 * =========================================================================
 * Lógica para los Reproductores de Video (Versión Dividida)
 * - Plyr.io para el video destacado.
 * - Player.js para las historias.
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
            new Plyr(featuredWrapper, {
                youtube: {
                    playerVars: {
                        origin: window.location.origin,
                        controls: 0,
                        iv_load_policy: 3
                    }
                }
            });
        } catch (e) {
            console.error("Error inicializando el reproductor destacado (Plyr):", e);
        }

        // --- 2. REPRODUCTOR DE HISTORIAS (PLAYER.JS) ---
        // Usa la librería especializada en playlists de múltiples fuentes.
        try {
            const storiesPlaylist = [
                { title: 'Historia 1', file: 'https://youtube.com/shorts/2E0mxIYMGAM' },
                { title: 'Historia 2', file: 'https://youtube.com/shorts/8GvLr9-DCF0' },
                { title: 'Historia 3', file: 'https://youtube.com/shorts/S2etubPd-ko' },
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