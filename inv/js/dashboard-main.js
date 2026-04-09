import { Navigation } from './manager-navegacion.js';

// Objeto global para compartir datos como supabase y userProfile
const App = {
    supabase: null,
    userId: null,
    userProfile: null,

    async init() {
        // ==========================================
        // Usamos el cliente global de main.js
        // ==========================================
        if (window.supabaseClient) {
            this.supabase = window.supabaseClient;
        } else {
            // Fallback por si acaso el dashboard carga aislado
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            window.location.href = '/';
            return;
        }
        this.userId = session.user.id;
        
        // 1. Hacemos una consulta simple y segura solo para el perfil
        const { data: profile, error } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', this.userId)
            .single();

        if (error) {
            console.error("Error cargando perfil:", error);
            UI.showAlert("Error cargando tu perfil. Por favor, recarga la página.", "error");
            return;
        }

        this.userProfile = profile;
        console.log("Perfil cargado correctamente en Dashboard:", profile);

        // Exponer globalmente ANTES de inicializar los submódulos
        window.App = this;
        window.UI = UI;

        // Inicializar UI General
        Header.init(this.userProfile);
        Navigation.init();
        BlueskyIntegration.init();
    }
};

// Objeto global para utilidades de Interfaz (Modales, Alertas, Loaders)
const UI = {
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },
    
    closeAllModals() {
        document.querySelectorAll('.modal-overlay-container.active').forEach(m => m.classList.remove('active'));
    },
    
    showAlert(message, type = 'info') {
        // Usa la alerta global del main.js si existe, si no, usa un alert nativo
        if (window.showToast) {
            window.showToast(message);
        } else {
            alert(message);
        }
    },
    
    setLoading(btnElement, isLoading) {
        if (!btnElement) return;
        if (isLoading) {
            btnElement.dataset.originalText = btnElement.innerHTML;
            btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
            btnElement.disabled = true;
        } else {
            btnElement.innerHTML = btnElement.dataset.originalText;
            btnElement.disabled = false;
        }
    },

    populateForm(formId, data) {
        const form = document.getElementById(formId);
        if (!form || !data) return;
        Object.keys(data).forEach(key => {
            const input = form.elements[key];
            if (input) {
                if (input.type === 'checkbox') input.checked = data[key];
                else input.value = data[key];
            }
        });
    }
};

// Objeto para manejar la integración con Bluesky
const BlueskyIntegration = {
    async init() {
        this.checkConnection();
    },

    async checkConnection() {
        const banner = document.getElementById('bsky-status-banner');
        if (!banner) return;

        banner.classList.add('is-loading');
        
        try {
            const { data, error } = await App.supabase
                .from('api_keys')
                .select('id')
                .eq('user_id', App.userId)
                .eq('service', 'bluesky')
                .single();

            banner.classList.remove('is-loading');

            if (data) {
                banner.classList.add('is-connected');
                banner.innerHTML = `<p><i class="fa-solid fa-circle-check"></i> Conectado a Bluesky. El chat en vivo se creará automáticamente.</p>`;
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
        // Usa display_name si existe, si no, usa nombre completo o email.
        const nombre = user.display_name || user.full_name || 'Investigador';
        if (el) el.textContent = `Panel de ${nombre}`;
    }
};

// ==========================================
// TEMA Y EVENTOS GLOBALES
// ==========================================
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

// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay-container')) {
        UI.closeAllModals();
    }
    // Switcher de tema
    if (e.target.closest('#theme-switcher-dashboard')) {
        toggleTheme();
    }
});

// Inicialización del Dashboard (Esperamos un poco para que main.js termine de cargar Supabase)
document.addEventListener('DOMContentLoaded', () => {
    // TEMA AUTOMÁTICO: Revisa si el usuario ya eligió un tema. 
    // Si no, detecta si su Windows/Mac está en Modo Oscuro.
    let savedTheme = localStorage.getItem("theme");
    if (!savedTheme) {
        savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    applyTheme(savedTheme);
    setTimeout(() => { App.init(); }, 150);
});