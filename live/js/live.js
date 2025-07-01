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
    
    // Función principal de inicialización
    init() {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        this.cacheDOMElements();
        this.run(); // Ejecuta el ciclo principal por primera vez
        this.timers.mainLoop = setInterval(() => this.run(), 30000); // Y luego cada 30 segundos
    },

    // Guardamos los elementos del DOM para no tener que buscarlos todo el tiempo
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

    // El "corazón" de la página, se ejecuta periódicamente
    async run() {
        const { liveOrNextSession, upcomingSessions } = await this.fetchLiveSession();

        this.renderSchedule(upcomingSessions);

        if (liveOrNextSession) {
            const now = new Date();
            const scheduledAt = new Date(liveOrNextSession.scheduled_at);

            this.elements.liveTitle.textContent = liveOrNextSession.session_title;
            this.elements.liveProject.textContent = `Proyecto: ${liveOrNextSession.project_title}`;

            if (now >= scheduledAt) {
                // El evento está EN VIVO
                this.showLivePlayer(liveOrNextSession);
            } else {
                // El evento está PROGRAMADO (en cuenta regresiva)
                this.showCountdown(liveOrNextSession);
            }
        } else {
            // No hay eventos programados ni en vivo
            this.showEndedMessage();
            this.elements.liveTitle.textContent = 'No hay transmisión en vivo';
            this.elements.liveProject.textContent = '';
        }
    },

    // Busca en Supabase la sesión más próxima a transmitir o que ya esté en vivo
    async fetchLiveSession() {
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
            .from('sessions')
            .select('*')
            .in('status', ['PROGRAMADO', 'EN VIVO'])
            .gte('scheduled_at', now) // Busca eventos cuya hora programada sea ahora o en el futuro
            .order('scheduled_at', { ascending: true }); // Ordena para obtener el más próximo primero

        if (error) {
            console.error("Error al buscar sesión en vivo:", error);
            return { liveOrNextSession: null, upcomingSessions: [] };
        }
        
        const liveOrNextSession = data[0] || null;
        const upcomingSessions = data.slice(1); // Todos los demás son los próximos

        return { liveOrNextSession, upcomingSessions };
    },

    // Muestra la lista de próximos eventos en la agenda
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
            return `
                <div class="schedule-item">
                    <p>${session.session_title}</p>
                    <small>${day} a las ${time}</small>
                </div>
            `;
        }).join('');
    },

    // Muestra la cuenta regresiva
    showCountdown(session) {
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'block';
        this.elements.endedMessage.style.display = 'none';
        this.elements.player.innerHTML = ''; // Limpiamos el reproductor por si acaso

        this.elements.countdownTitle.textContent = session.session_title;
        
        // Limpiamos cualquier contador anterior
        if (this.timers.countdown) clearInterval(this.timers.countdown);

        // Iniciamos un nuevo contador
        const endTime = new Date(session.scheduled_at).getTime();
        this.timers.countdown = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                clearInterval(this.timers.countdown);
                this.elements.countdownClock.textContent = "¡EMPEZANDO!";
                this.run(); // Volvemos a ejecutar el ciclo para que detecte que ya es EN VIVO
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            this.elements.countdownClock.textContent = 
                `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    },

    // Muestra el reproductor de video
    showLivePlayer(session) {
        if (this.timers.countdown) clearInterval(this.timers.countdown); // Detenemos el contador si estaba activo
        
        this.elements.overlay.style.display = 'none';
        
        // Evitamos recargar el iframe si ya está puesto el video correcto
        const existingIframe = this.elements.player.querySelector('iframe');
        if (existingIframe && existingIframe.src === session.guest_url) {
            return;
        }
        
        this.elements.player.innerHTML = `<iframe src="${session.guest_url}&scale=1" allow="autoplay" frameborder="0"></iframe>`;
    },

    // Muestra el mensaje de que no hay transmisión
    showEndedMessage() {
        if (this.timers.countdown) clearInterval(this.timers.countdown);
        this.elements.overlay.style.display = 'flex';
        this.elements.countdownTimer.style.display = 'none';
        this.elements.endedMessage.style.display = 'block';
        this.elements.player.innerHTML = '';
    }
};

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => App.init());