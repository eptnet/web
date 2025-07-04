/**
 * =========================================================================
 * Script Principal de la Aplicación (main.js) - VERSIÓN ESTABLE Y FINAL
 * Responsabilidades:
 * 1. Inicializa el cliente de Supabase.
 * 2. Controla TODA la interactividad del header (login, logout, tema, menús).
 * 3. Avisa a los demás scripts (`app.js`, etc.) que la base está lista.
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. INICIALIZACIÓN CENTRAL DE SUPABASE
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("main.js: Supabase client creado y disponible globalmente.");

    // 2. LÓGICA DE INTERACTIVIDAD DEL HEADER
    
    // --- Selección de todos los elementos del header ---
    const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
    const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');
    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');
    const userView = document.getElementById('user-view');
    const guestView = document.getElementById('guest-view');
    const avatarLink = document.getElementById('user-avatar-link');
    const logoutBtn = document.getElementById('logout-btn-header');
    const loginMenuTrigger = document.getElementById('login-menu-trigger');
    const loginPopover = document.getElementById('login-popover');
    const googleLoginDesktop = document.getElementById('login-google-btn-desktop');
    const githubLoginDesktop = document.getElementById('login-github-btn-desktop');
    const googleLoginMobile = document.getElementById('login-google-btn-mobile');
    const githubLoginMobile = document.getElementById('login-github-btn-mobile');
    const liveIconDesktop = document.getElementById('nav-live-desktop');

    // --- Funciones de UI del Header ---
    const showUserUI = (user) => {
        if(guestView) guestView.style.display = 'none';
        if(userView) userView.style.display = 'flex';
        if(avatarLink && user) {
            const avatarUrl = user.user_metadata?.avatar_url || 'img/default-avatar.png'; // Fallback a un avatar local
            avatarLink.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;">`;
        }
    };
    const showGuestUI = () => {
        if(userView) userView.style.display = 'none';
        if(guestView) guestView.style.display = 'flex';
    };
    const applyTheme = (theme) => {
        document.body.classList.toggle("dark-theme", theme === "dark");
        const iconClass = theme === "dark" ? "fa-sun" : "fa-moon";
        const themeIconDesktop = themeSwitcherDesktop?.querySelector('i');
        const themeIconMobile = themeSwitcherMobile?.querySelector('i');
        if (themeIconDesktop) { themeIconDesktop.className = `fa-solid ${iconClass}`; }
        if (themeIconMobile) { themeIconMobile.className = `fa-solid ${iconClass}`; }
    };
    const toggleTheme = () => {
        const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
    };
    const handleOAuthLogin = async (provider) => {
        await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/inv/dashboard.html` } });
    };

    // --- Asignación de todos los eventos del Header ---
    themeSwitcherDesktop?.addEventListener("click", toggleTheme);
    themeSwitcherMobile?.addEventListener("click", toggleTheme);
    logoutBtn?.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); });
    loginMenuTrigger?.addEventListener('click', (e) => { e.stopPropagation(); loginPopover?.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (loginPopover && !loginMenuTrigger?.contains(e.target) && !loginPopover.contains(e.target)) loginPopover.classList.remove('is-open'); });
    googleLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    googleLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    mobileMoreBtn?.addEventListener("click", (event) => { event.stopPropagation(); mobileMoreMenu?.classList.toggle("is-open"); });
    mobileMoreMenuClose?.addEventListener("click", () => { mobileMoreMenu?.classList.remove("is-open"); });

    // --- Lógica de Inicialización ---
    applyTheme(localStorage.getItem('theme') || 'light');
    liveIconDesktop?.classList.add("is-live");
    
    // "Vigilante" de sesión que actualiza la UI
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
        session?.user ? showUserUI(session.user) : showGuestUI();
    });

    // Comprobación inicial para mostrar la UI correcta al cargar la página
    (async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        session?.user ? showUserUI(session.user) : showGuestUI();
    })();

    // *** CORRECCIÓN CRUCIAL ***
    // Avisamos al resto de la aplicación que la inicialización principal ha terminado.
    // Esto se hace al FINAL de todo, para asegurar que todo lo anterior ya se ejecutó.
    document.dispatchEvent(new CustomEvent('mainReady'));
    console.log("main.js: Evento 'mainReady' disparado. La base está lista.");
});
