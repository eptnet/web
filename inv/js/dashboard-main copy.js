import { Navigation } from './manager-navegacion.js';

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
            window.location.href = '/'; // Redirige si no hay sesión
            return;
        }
        this.userId = session.user.id;
        
        const { data: profileData, error } = await this.supabase.from('profiles').select('*').eq('id', this.userId).single();
        if (error && error.code !== 'PGRST116') {
            alert("Hubo un error al cargar tu perfil.");
            return;
        }
        
        this.userProfile = { ...session.user.user_metadata, ...profileData };
        
        // Verificación de perfil completo para poder usar el dashboard
        if (!this.userProfile.orcid) {
            alert("Perfil incompleto. Debes registrar tu ORCID para continuar.");
            window.location.href = '/inv/profile.html';
            return;
        }
        
        Header.init(this.userProfile);
        Navigation.init();

        // Muestra el enlace de "Gestionar Contenido" si el usuario es admin
        const contentNavLink = document.querySelector('.nav-link[data-section="content-section"]');
        if (contentNavLink && this.userProfile.role === 'admin') {
            contentNavLink.style.display = 'flex';
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

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());