// Contenido para js/main.js - El nuevo cerebro de la app

document.addEventListener('DOMContentLoaded', () => {
    // 1. INICIALIZACIÓN CENTRAL DE SUPABASE
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    
    // Creamos el cliente UNA SOLA VEZ y lo hacemos global para que app.js y dashboard.js lo usen
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 2. CARGADOR DE COMPONENTES
    const loadComponent = (componentPath, placeholderId) => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            fetch(componentPath)
                .then(response => response.ok ? response.text() : Promise.reject('Componente no encontrado'))
                .then(html => {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    placeholder.replaceWith(...tempDiv.childNodes);
                    document.dispatchEvent(new CustomEvent('headerLoaded')); // Avisamos que el header está listo
                })
                .catch(error => console.error(`Error cargando componente: ${componentPath}`, error));
        }
    };

    const headerPath = window.location.pathname.includes('/inv/') ? '../_header.html' : '/_header.html';
    loadComponent(headerPath, 'header-placeholder');
});

// 3. LÓGICA DE INTERACTIVIDAD DEL HEADER
// Esperamos la señal de que el header está cargado para activar sus botones
document.addEventListener('headerLoaded', () => {
    const userView = document.getElementById('user-view');
    const guestView = document.getElementById('guest-view');
    const avatarLink = document.getElementById('user-avatar-link');
    const logoutBtn = document.getElementById('logout-btn');
    const loginMenuTrigger = document.getElementById('login-menu-trigger');
    const loginPopover = document.getElementById('login-popover');
    
    // Función para mostrar la UI de usuario logueado
    const showUserUI = (user) => {
        if (guestView) guestView.style.display = 'none';
        if (userView) userView.style.display = 'flex';
        if (avatarLink) {
            const avatarUrl = user.user_metadata?.avatar_url || '/img/default-avatar.png';
            avatarLink.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;">`;
        }
        logoutBtn?.addEventListener('click', async () => {
            await window.supabaseClient.auth.signOut();
            window.location.href = '/'; // Redirige a inicio al cerrar sesión
        }, { once: true });
    };

    // Función para mostrar la UI de invitado
    const showGuestUI = () => {
        if (userView) userView.style.display = 'none';
        if (guestView) guestView.style.display = 'flex';
    };

    // "Vigilante" de sesión de Supabase
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            showUserUI(session.user);
        } else {
            showGuestUI();
        }
    });
    
    // Comprobación inicial de la sesión al cargar el header
    async function checkInitialSession() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            showUserUI(session.user);
        } else {
            showGuestUI();
        }
    }
    checkInitialSession();

    // Lógica del menú desplegable de login
    loginMenuTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        loginPopover?.classList.toggle('is-open');
    });
    document.addEventListener('click', (e) => {
        if (!loginMenuTrigger?.contains(e.target) && !loginPopover?.contains(e.target)) {
            loginPopover?.classList.remove('is-open');
        }
    });

    // Lógica para los botones de login
    const handleOAuthLogin = async (provider) => {
        await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/inv/dashboard.html` } });
    };
    document.getElementById('login-google-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    document.getElementById('login-github-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    document.getElementById('login-google-btn-mobile')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    document.getElementById('login-github-btn-mobile')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
});