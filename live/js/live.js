/**
 * LIVE.JS - LÓGICA PARA LA PÁGINA DE TRANSMISIÓN
 *
 * FASE 1:
 * - Se conecta a Supabase.
 * - Busca sesiones programadas o en vivo.
 * - Muestra una cuenta regresiva para el próximo evento.
 * - Muestra el reproductor de video cuando el evento comienza.
 * - Lista los próximos eventos en la agenda.
 */

// =========================================================================
// CONFIGURACIÓN DE SUPABASE - ¡REEMPLAZA ESTOS VALORES!
// =========================================================================
const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co'; // <-- TU URL DE SUPABASE AQUÍ
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E'; // <-- TU CLAVE 'anon' DE SUPABASE AQUÍ

const App = {
    supabase: null,
    elements: {},
    timers: { mainLoop: null, countdown: null },
    currentSessionId: null, // Para saber qué sesión estamos mostrando
    
    init() {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        this.cacheDOMElements();
        this.run();
        this.timers.mainLoop = setInterval(() => this.run(), 30000);
    },

    cacheDOMElements() {
        this.elements = {
            player: document.getElementById('video-player'),
            overlay: document.getElementById('event-overlay'),
            countdownTimer: document.getElementById('countdown-timer'),
            countdownClock: document.getElementById('countdown-clock'),
            countdownTitle: document.getElementById('countdown-title'),
            endedMessage: document.getElementById('event-ended-message'),
            scheduleList: document.getElementById('schedule-list'),
            liveTitle: document.getElementById('live-title'),
            liveProject: document.getElementById('live-project'),
        };
    },

    async run() {
        const { activeSession, upcomingSessions } = await this.fetchSessions();

        this.renderSchedule(upcomingSessions);

        if (activeSession) {
            const now = new Date();
            const scheduledAt = new Date(activeSession.scheduled_at);

            this.elements.liveTitle.textContent = activeSession.session_title;
            this.elements.liveProject.textContent = `Proyecto: ${activeSession.project_title}`;

            // Si el estado es 'EN VIVO' o si está 'PROGRAMADO' y ya es la hora
            if (activeSession.status === 'EN VIVO' || (activeSession.status === 'PROGRAMADO' && now >= scheduledAt)) {
                this.showLivePlayer(activeSession);
            } else if (activeSession.status === 'PROGRAMADO' && now < scheduledAt) {
                // Si está programado para el futuro
                this.showCountdown(activeSession);
            }
        } else {
            this.showEndedMessage();
            this.elements.liveTitle.textContent = 'No hay transmisión en vivo';
            this.elements.liveProject.textContent = '';
        }
    },

    // --- FUNCIÓN MODIFICADA ---
    // Ahora busca primero un evento EN VIVO, y si no, el próximo PROGRAMADO.
    async fetchSessions() {
        // 1. Busca una sesión que ya esté EN VIVO
        // --- INICIO DE LA CORRECCIÓN ---
        // Quitamos .single() y manejamos el resultado como un array
        const { data: liveData, error: liveError } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('status', 'EN VIVO')
            .limit(1); // Le pedimos solo 1, pero sin la restricción de .single()

        if (liveError) {
            console.error("Error buscando sesión EN VIVO:", liveError);
            // No detenemos la ejecución, aún podemos buscar sesiones programadas
        }

        // Si encontramos una sesión en vivo, la procesamos
        if (liveData && liveData.length > 0) {
            // Como liveData es un array, tomamos el primer elemento
            return { activeSession: liveData[0], upcomingSessions: [] };
        }
        // --- FIN DE LA CORRECCIÓN ---

        // 2. Si no hay nada EN VIVO, busca la próxima sesión PROGRAMADA (esta parte no cambia)
        const now = new Date().toISOString();
        const { data: upcomingData, error: upcomingError } = await this.supabase
            .from('sessions')
            .select('*')
            .eq('status', 'PROGRAMADO')
            .gte('scheduled_at', now)
            .order('scheduled_at', { ascending: true });

        if (upcomingError) {
            console.error("Error buscando sesiones programadas:", upcomingError);
            return { activeSession: null, upcomingSessions: [] };
        }
        
        const nextSession = upcomingData[0] || null;
        const futureSessions = upcomingData.slice(1);

        return { activeSession: nextSession, upcomingSessions: futureSessions };
    },

    renderSchedule(sessions) {
        if (!this.elements.scheduleList) return;
        if (sessions.length === 0) {
            this.elements.scheduleList.innerHTML = '<p class="placeholder-text">No hay más eventos programados.</p>';
            return;
        }
        this.elements.scheduleList.innerHTML = sessions.map(session => {
            const date = new Date(session.scheduled_at);
            const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const day = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            return `<div class="schedule-item"><p>${session.session_title}</p><small>${day} a las ${time}</small></div>`;
        }).join('');
    },

    showCountdown(session) {
        this.currentSessionId = session.id;
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'block';
        this.elements.endedMessage.style.display = 'none';
        this.elements.player.innerHTML = '';
        this.elements.countdownTitle.textContent = session.session_title;
        
        if (this.timers.countdown) clearInterval(this.timers.countdown);

        const endTime = new Date(session.scheduled_at).getTime();
        this.timers.countdown = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 1000) { // Un segundo antes, actualizamos
                clearInterval(this.timers.countdown);
                this.elements.countdownClock.textContent = "¡EMPEZANDO!";
                this.setSessionLive(session.id); // ¡Cambiamos el estado a EN VIVO!
                setTimeout(() => this.run(), 1500); // Esperamos 1.5s y recargamos el estado
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            this.elements.countdownClock.textContent = `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    },
    
    // --- NUEVA FUNCIÓN ---
    // Actualiza el estado de la sesión en la base de datos a 'EN VIVO'
    async setSessionLive(sessionId) {
        const { error } = await this.supabase
            .from('sessions')
            .update({ status: 'EN VIVO' })
            .eq('id', sessionId);
        
        if(error) console.error("Error al actualizar la sesión a EN VIVO:", error);
    },

    showLivePlayer(session) {
        // Hemos eliminado la línea que causaba el problema.
        // Ahora solo verificamos si el iframe ya existe para no recargarlo.
        const streamUrl = session.viewer_url;
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src === streamUrl) {
            return;
        }

        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'none';
        
        this.elements.player.innerHTML = `<iframe src="${streamUrl}" allow="autoplay; fullscreen" frameborder="0"></iframe>`;
    },

    showEndedMessage() {
        this.currentSessionId = null;
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'none';
        this.elements.endedMessage.style.display = 'block';
        this.elements.player.innerHTML = '';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());