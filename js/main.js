/**
 * =========================================================================
 * Script Principal de la Aplicación (main.js) - VERSIÓN 3.1 UNIFICADA
 * - Mantiene la inicialización segura de Supabase para evitar errores.
 * - Mantiene la redirección a /inv/profile.html para el nuevo flujo.
 * - REINTEGRADA: La funcionalidad del botón "Live" y el cambio de tema.
 * - CORREGIDO: No da error si los elementos no existen en la página.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';

    // Función que se ejecutará solo cuando la librería de Supabase esté lista
    const initializeApp = () => {
        // Se crea el cliente de Supabase y se asigna a la ventana global
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("main.js: Supabase client creado y disponible globalmente.");

        // --- Selección de elementos del DOM ---
        const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
        const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');
        const userView = document.getElementById('user-view');
        const guestView = document.getElementById('guest-view');
        const avatarLink = document.getElementById('user-avatar-link');
        const logoutBtn = document.getElementById('logout-btn-header');
        const loginMenuTrigger = document.getElementById('login-menu-trigger');
        const loginPopover = document.getElementById('login-popover');
        const liveIconDesktop = document.getElementById('nav-live-desktop'); // <-- LÍNEA REINTEGRADA

        // --- Funciones de UI ---
        const showUserUI = (user) => {
            if (guestView) guestView.style.display = 'none';
            if (userView) userView.style.display = 'flex';
            if (avatarLink && user) {
                const avatarUrl = user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
                // El enlace del avatar ahora apunta a la nueva página de perfil
                avatarLink.innerHTML = `<a href="/inv/profile.html"><img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;"></a>`;
            }
        };
        const showGuestUI = () => {
            if (userView) userView.style.display = 'none';
            if (guestView) guestView.style.display = 'flex';
        };
        const applyTheme = (theme) => {
            document.body.classList.toggle("dark-theme", theme === "dark");
            const iconClass = theme === "dark" ? "fa-sun" : "fa-moon";
            if (themeSwitcherDesktop) themeSwitcherDesktop.querySelector('i').className = `fa-solid ${iconClass}`;
            if (themeSwitcherMobile) themeSwitcherMobile.querySelector('i').className = `fa-solid ${iconClass}`;
        };
        const toggleTheme = () => {
            const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
            localStorage.setItem("theme", newTheme);
            applyTheme(newTheme);
        };
        const handleOAuthLogin = async (provider) => {
            // Redirige a la nueva página de perfil después del login
            const redirectTo = `${window.location.origin}/inv/profile.html`;
            await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo } });
        };

        // --- Asignación de eventos de forma segura ---
        if (themeSwitcherDesktop) themeSwitcherDesktop.addEventListener("click", toggleTheme);
        if (themeSwitcherMobile) themeSwitcherMobile.addEventListener("click", toggleTheme);
        if (logoutBtn) logoutBtn.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); });
        
        if (loginMenuTrigger) {
            loginMenuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                if(loginPopover) loginPopover.classList.toggle('is-open');
            });
            document.addEventListener('click', (e) => {
                if (loginPopover && !loginMenuTrigger.contains(e.target) && !loginPopover.contains(e.target)) {
                    loginPopover.classList.remove('is-open');
                }
            });
        }
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#login-google-btn-desktop') || e.target.closest('#login-google-btn-mobile')) {
                e.preventDefault(); handleOAuthLogin('google');
            }
            if (e.target.closest('#login-github-btn-desktop') || e.target.closest('#login-github-btn-mobile')) {
                e.preventDefault(); handleOAuthLogin('github');
            }
        });

        // --- Lógica de Inicialización ---
        applyTheme(localStorage.getItem('theme') || 'light');
        if (liveIconDesktop) liveIconDesktop.classList.add("is-live"); // <-- LÍNEA REINTEGRADA

        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
             if (session?.user) {
                showUserUI(session.user);
            } else {
                showGuestUI();
                if (window.location.pathname.startsWith('/inv/')) {
                    window.location.href = '/';
                }
            }
        });

        (async () => {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            session?.user ? showUserUI(session.user) : showGuestUI();
        })();

        document.dispatchEvent(new CustomEvent('mainReady'));
        console.log("main.js: Evento 'mainReady' disparado. Base unificada y lista.");
    };

    // Verificador para asegurar que la librería Supabase esté cargada
    const checkSupabase = setInterval(() => {
        if (window.supabase) {
            clearInterval(checkSupabase);
            initializeApp();
        }
    }, 100);
});