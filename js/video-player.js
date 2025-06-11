/**
 * =========================================================================
 * Lógica para los Reproductores de Video (Versión Dividida)
 * - Plyr.io para el video destacado.
 * - Player.js para las historias.
 * Versión Final: Añade el parámetro 'origin' a las URLs de Player.js
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
        // Esta configuración es correcta y funciona.
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
        // La corrección clave está en cómo construimos las URLs en la lista.
        try {
            // Construimos la URL base para el origen dinámicamente.
            const originParam = `?enablejsapi=1&origin=${window.location.origin}`;

            const storiesPlaylist = [
                { title: 'Historia 1', file: `https://youtube.com/shorts/2E0mxIYMGAM?feature=share${originParam}` },
                { title: 'Historia 2', file: `https://youtube.com/shorts/8GvLr9-DCF0?feature=share${originParam}` },
                { title: 'Historia 3', file: `https://youtube.com/shorts/S2etubPd-ko?feature=share${originParam}` },
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