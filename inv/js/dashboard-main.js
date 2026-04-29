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
        
        // 👉 AÑADE ESTA LÍNEA AQUÍ PARA ATRAPAR EL RETORNO DE BLUESKY
        await checkForBlueskyCallback();
        
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

        // --- NUEVO: EL ESCÁNER DE PERMISOS ---
        // Consultamos cuántos proyectos tiene el usuario (sin descargar toda la data, solo contando)
        const { count, error: projError } = await this.supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', this.userId);
            
        this.hasProjects = count > 0;
        this.isAdmin = this.userProfile.role === 'admin';
        // -------------------------------------

        // --- NUEVO: OCULTAR BOTONES DE ADMINISTRADOR ---
        if (!this.isAdmin) {
            const commLink = document.querySelector('.nav-link[data-section="community-section"]');
            const contLink = document.querySelector('.nav-link[data-section="content-section"]');
            if (commLink) commLink.style.display = 'none';
            if (contLink) contLink.style.display = 'none';
        }
        // -----------------------------------------------

        // Exponer globalmente
        window.App = this;
        window.UI = UI;

        // Inicializar UI General
        Header.init(this.userProfile);
        Navigation.init(); // Esto renderiza el home-section y bsky-status-container
        
        // CAMBIO: Agregamos el await para que espere la respuesta de la red social
        await BlueskyIntegration.init(); 
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

// Objeto para manejar la integración con Bluesky (Versión EPT Bot Logic)
const BlueskyIntegration = {
    // Restauramos init para que App.init() no se rompa
    async init() {
        await this.checkStatus();
    },

    async checkStatus() {
        // Asegúrate de que este ID coincida con el del HTML
        const container = document.getElementById('bsky-status-container');
        if (!container) {
            console.warn("No se encontró el contenedor #bsky-status-container");
            return;
        }

        try {
            // Verificamos el estado real en Bluesky vía OAuth 2.0
            const { data, error } = await App.supabase.functions.invoke('bsky-check-status');
            
            if (error) throw error;

            if (data && data.connected) {
                // ESTADO: INVESTIGADOR CONECTADO
                container.innerHTML = `
                    <div class="status-badge connected">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>Conectado como <strong>@${data.handle}</strong></span>
                    </div>
                    <p class="status-msg">Tus hilos y eventos se publicarán con tu identidad real.</p>
                `;
            } else {
                // ESTADO: MODO BOT (FALLBACK)
                container.innerHTML = `
                    <div class="status-badge disconnected">
                        <i class="fa-solid fa-robot"></i>
                        <span>Modo <strong>EPT Bot</strong> activo</span>
                    </div>
                    <p class="status-msg">Tus publicaciones serán realizadas por 🤖EPT Bot</p>
                    <button class="btn-secondary btn-sm" id="open-bsky-modal" style="margin-top:10px;">Conectar mi Bluesky</button>
                `;
                // Re-vinculamos el evento al nuevo botón
                document.getElementById('open-bsky-modal')?.addEventListener('click', () => this.openConnectModal());
            }
        } catch (error) {
            console.error("Error al verificar Bluesky:", error);
            container.innerHTML = `
                <div class="status-badge error">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <span>Error de verificación</span>
                </div>
                <button class="btn-secondary btn-sm" id="open-bsky-modal" style="margin-top:10px;">Reintentar Conexión</button>
            `;
            document.getElementById('open-bsky-modal')?.addEventListener('click', () => this.openConnectModal());
        }
    },

    openConnectModal() {
        const template = document.getElementById('bsky-connect-template');
        if (!template) {
            console.error("No se encontró el template bsky-connect-template en el HTML.");
            return;
        }

        // 1. Creamos un contenedor flotante infalible inyectado directamente en el Body
        let modalContainer = document.getElementById('ept-global-modal');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'ept-global-modal';
            document.body.appendChild(modalContainer);
        }

        // 2. Dibujamos la ventana oscura con estilos nativos
        modalContainer.innerHTML = `
            <div class="modal-overlay is-visible" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);">
                <div class="modal-content" style="background:var(--color-surface, #1e293b); padding:2.5rem; border-radius:16px; border:1px solid var(--color-border, rgba(255,255,255,0.1)); position:relative; width:90%; max-width:420px; box-shadow: 0 15px 40px rgba(0,0,0,0.6);">
                    <button class="modal-close-btn" style="position:absolute; top:15px; right:15px; background:none; border:none; font-size:1.8rem; color:var(--color-text-secondary, #94a3b8); cursor:pointer; transition:0.2s;">&times;</button>
                    <div id="modal-template-injection-zone"></div>
                </div>
            </div>
        `;

        // 3. Inyectamos el contenido de tu Template
        const injectionZone = modalContainer.querySelector('#modal-template-injection-zone');
        injectionZone.appendChild(template.content.cloneNode(true));

        // 4. Lógica para cerrar la ventana
        const closeModal = () => { modalContainer.innerHTML = ''; };
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', closeModal);
        modalContainer.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) closeModal();
        });

        // 5. Conectar el botón Azul de OAuth
        const oauthBtn = modalContainer.querySelector('#bsky-oauth-start-btn');
        if (oauthBtn) {
            // Pasamos el evento (e) para que handleConnectSubmit lo procese
            oauthBtn.addEventListener('click', (e) => this.handleConnectSubmit(e));
        }
    },

    async handleConnectSubmit(e) {
        e.preventDefault();
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redirigiendo...';

        try {
            const redirectUri = window.location.origin + window.location.pathname;
            const { data, error } = await App.supabase.functions.invoke('bsky-oauth-init', {
                body: { redirect_uri: redirectUri }
            });

            if (error) throw error;
            if (data?.auth_url) {
                window.location.href = data.auth_url;
            }
        } catch (error) {
            console.error("Error iniciando OAuth:", error);
            alert("No se pudo iniciar la conexión segura.");
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Autorizar con Bluesky';
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

// Añadir esta función dentro de App o al final del archivo dashboard-main.js
async function checkForBlueskyCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
        // Limpiamos la URL de inmediato para una experiencia limpia
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (window.showToast) window.showToast("⏳ Finalizando conexión con Bluesky...");

        try {
            const { data, error } = await App.supabase.functions.invoke('bsky-oauth-callback', {
                body: { 
                    code: code, 
                    state: state, 
                    redirect_uri: window.location.origin + window.location.pathname 
                }
            });

            if (error) throw error;
            if (window.showToast) window.showToast(`✅ ¡Cuenta conectada como @${data.handle}!`);
            
            // Actualizamos la interfaz
            await BlueskyIntegration.checkStatus();
        } catch (error) {
            console.error("Error en callback de Bluesky:", error);
            alert("Hubo un problema al autorizar tu cuenta. Por favor, intenta de nuevo.");
        }
    }
}

// DELEGACIÓN DE EVENTOS GLOBAL PARA EL DASHBOARD
document.addEventListener('click', (e) => {
    // 1. Detectar clic en el botón de conectar Bluesky (incluso si se acaba de crear)
    if (e.target.id === 'open-bsky-modal' || e.target.closest('#open-bsky-modal')) {
        console.log("Abriendo modal de Bluesky...");
        BlueskyIntegration.openConnectModal();
    }
    
    // 2. Detectar clic en el botón de autorizar dentro del modal
    if (e.target.id === 'bsky-oauth-start-btn' || e.target.closest('#bsky-oauth-start-btn')) {
        BlueskyIntegration.handleConnectSubmit(e);
    }
});