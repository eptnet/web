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

/// Objeto para manejar la integración con Bluesky (Versión EPT Bot Logic)
const BlueskyIntegration = {
    async init() {
        // 1. IMPORTANTE: Hacemos el objeto global AL PRINCIPIO para que el botón funcione siempre
        window.BlueskyIntegration = this;
        this.checkConnection();
    },

    async checkConnection() {
        const banner = document.getElementById('bsky-status-banner');
        if (!banner) return;

        banner.classList.add('is-loading');
        
        try {
            // Usamos .maybeSingle() para evitar el error 406 si no existe el registro
            const { data: creds, error } = await App.supabase
                .from('bsky_credentials')
                .select('handle')
                .eq('user_id', App.userId)
                .maybeSingle();

            banner.classList.remove('is-loading');

            if (creds) {
                // ESTADO: CONECTADO (Usa su propia cuenta)
                banner.classList.add('is-connected');
                banner.classList.remove('is-disconnected');
                banner.innerHTML = `<p><i class="fa-solid fa-circle-check"></i> Conectado a Bluesky como <strong>@${creds.handle}</strong>. Publicarás con tu propia identidad académica.</p>`;
            } else {
                // ESTADO: DESCONECTADO (Usa el EPT Bot)
                banner.classList.add('is-disconnected');
                banner.classList.remove('is-connected');
                banner.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:15px;">
                        <p style="margin:0; line-height:1.4;"><i class="fa-solid fa-robot"></i> No estás conectado a tu Bluesky. El chat será creado por <strong>🤖 EPT Bot</strong>. Crea/Conecta tu propia cuenta para una mejor experiencia.</p>
                        <button class="btn-connect" onclick="BlueskyIntegration.openConnectModal()" style="border:none; cursor:pointer; white-space:nowrap; background:var(--color-accent); color:white; padding:8px 16px; border-radius:6px; font-weight:600;">Conectar mi Cuenta</button>
                    </div>
                `;
            }
        } catch (err) {
            banner.classList.remove('is-loading');
            banner.classList.add('is-disconnected');
            banner.innerHTML = `<p><i class="fa-solid fa-triangle-exclamation"></i> Error al verificar conexión. Se usará el 🤖EPT Bot por defecto.</p>`;
            console.error("Error al verificar el estado de Bluesky:", err);
        }
    },

    openConnectModal() {
        const container = document.getElementById('modal-overlay-container');
        const template = document.getElementById('bsky-connect-template');
        if (!container || !template) return;

        // Inyectamos el diseño del modal
        container.innerHTML = `
            <div class="modal" style="background:var(--color-surface); border-radius:12px; width:90%; max-width:450px; display:flex; flex-direction:column; box-shadow: 0 20px 50px rgba(0,0,0,0.2); padding: 0; animation: fadeIn 0.2s ease;">
                ${template.innerHTML}
            </div>
        `;
        
        // Hacemos visible el fondo oscuro
        container.style.display = 'flex';
        container.classList.add('active');

        // Evento de cerrar
        const closeBtn = container.querySelector('.btn-close-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeConnectModal());

        // Evento de formulario
        const form = container.querySelector('#bsky-connect-form');
        if (form) form.addEventListener('submit', (e) => this.handleConnectSubmit(e));
    },

    closeConnectModal() {
        const container = document.getElementById('modal-overlay-container');
        if (container) {
            container.innerHTML = '';
            container.classList.remove('active');
            container.style.display = 'none';
        }
    },

    async handleConnectSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHtml = submitBtn.innerHTML;
        
        const handle = form.querySelector('#bsky-handle').value.trim();
        const appPassword = form.querySelector('#bsky-app-password').value.trim();

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

        try {
            const { data, error } = await App.supabase.functions.invoke('bsky-auth', { 
                body: { handle, appPassword } 
            });

            if (error) throw new Error(error.message || 'Error desconocido al conectar.');

            if (window.UI) window.UI.showAlert("✅ ¡Cuenta de Bluesky conectada!");
            else alert("¡Cuenta de Bluesky conectada!");
            
            this.closeConnectModal();
            this.checkConnection(); 

        } catch (error) {
            const detail = error.message.includes('password') ? 'Verifica tu handle y contraseña de aplicación.' : error.message;
            alert(`❌ Error: ${detail}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
        }
    }
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