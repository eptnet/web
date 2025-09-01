import { Navigation } from './manager-navegacion.js';
import { Projects } from './manager-proyectos.js'; // <-- LÍNEA AÑADIDA


// Objeto global para compartir datos como supabase y userProfile
const App = {
    supabase: null,
    userId: null,
    userProfile: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            window.location.href = '/';
            return;
        }
        this.userId = session.user.id;
        
        // 1. Hacemos una consulta simple y segura solo para el perfil
        const { data: profileData, error } = await this.supabase.from('profiles').select('*').eq('id', this.userId).single();
        
        if (error) {
            alert("Hubo un error al cargar tu perfil.");
            console.error("Error fetching profile:", error);
            return;
        }
        
        this.userProfile = { ...session.user.user_metadata, ...profileData };
        window.App = this;
        
        Header.init(this.userProfile);
        Navigation.init();
        
        this.checkBskyConnectionStatus();

        // Aplica el tema guardado al cargar la página
        applyTheme(localStorage.getItem('theme') || 'light');

        // Añade el listener para el botón de cambio de tema
        const themeSwitcher = document.getElementById('theme-switcher-dashboard');
        themeSwitcher?.addEventListener('click', toggleTheme);
        
        // 2. Ahora que el perfil cargó, revisamos el rol de admin
        const contentNavLink = document.querySelector('.nav-link[data-section="content-section"]');
        if (contentNavLink && this.userProfile.role === 'admin') {
            contentNavLink.style.display = 'flex';
        }

        // 3. Hacemos una SEGUNDA consulta solo para los proyectos
        const { data: projects, error: projectsError } = await this.supabase.from('projects').select('*').eq('user_id', this.userId);
        
        if (projectsError) {
            console.error("Error al cargar proyectos:", projectsError);
        } else {
            this.userProfile.projects = projects || []; // Añadimos los proyectos al perfil
        }

        // 4. Verificamos si hay proyectos para mostrar la vista correcta
        if (!this.userProfile.projects || this.userProfile.projects.length === 0) {
            const homeSection = document.getElementById('home-section');
            if (homeSection) {
                 homeSection.innerHTML = `
                    <div class="workflow-step">
                        <h2><span class="step-number">1</span> 
                            ¡Bienvenido! Añade tu primer proyecto</h2>
                            <p>Para crear contenido, necesitas un proyecto con DOI. Sincroniza con ORCID o crea uno en tu perfil.</p>
                            <a href="/inv/profile.html" class="btn btn-primary" style="margin-top: 1rem; width: auto; text-decoration: none;">Ir a mi Perfil</a>
                    </div>`;
            }
        } else {
            const homeTemplate = document.getElementById('template-home-section');
            const homeSection = document.getElementById('home-section');
            if (homeTemplate && homeSection) {
                homeSection.innerHTML = homeTemplate.innerHTML;
            }
            Projects.init();
        }
    },

    async checkBskyConnectionStatus() {
        const banner = document.getElementById('bsky-status-banner');
        if (!banner) return;

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-check-status');
            
            if (error) throw error;

            banner.classList.remove('is-loading');

            if (data.connected) {
                banner.classList.add('is-connected');
                banner.innerHTML = `<p><i class="fa-solid fa-check-circle"></i> Conectado a Bluesky como: <strong>${data.handle}</strong></p>`;
            } else {
                banner.classList.add('is-disconnected');
                banner.innerHTML = `
                    <p><i class="fa-solid fa-triangle-exclamation"></i> No estás conectado a Bluesky. El chat no se creará para nuevos eventos.</p>
                    <a href="/inv/profile.html#comunidad" class="btn-connect">Conectar Cuenta</a>
                `;
            }
        } catch (err) {
            banner.classList.remove('is-loading');
            banner.classList.add('is-disconnected');
            banner.innerHTML = `<p><i class="fa-solid fa-triangle-exclamation"></i> No se pudo verificar la conexión con Bluesky.</p>`;
            console.error("Error al verificar el estado de Bluesky:", err);
        }
    },
};

// Objeto para manejar el encabezado
const Header = {
    init(user) {
        const el = document.getElementById('user-name-header');
        if (el) el.textContent = `Dashboard de ${user.full_name || user.email}`;
    }
};

const applyTheme = (theme) => {
    document.body.classList.toggle("dark-theme", theme === "dark");
    const themeIcon = document.querySelector('#theme-switcher-dashboard i');
    if (themeIcon) {
        themeIcon.className = `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`;
    }
};

const toggleTheme = () => {
    const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());