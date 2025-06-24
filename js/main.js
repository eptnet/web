/**
 * =========================================================================
 * Script Principal de la Aplicación (main.js) - VERSIÓN CORREGIDA
 * Carga componentes compartidos e inicializa la lógica global (Header, Auth).
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. INICIALIZACIÓN CENTRAL DE SUPABASE
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client creado y disponible globalmente.");

    // 2. CARGADOR DE COMPONENTES ASÍNCRONO
    const loadComponent = async (componentPath, placeholderId) => {
        const placeholder = document.getElementById(placeholderId);
        if (!placeholder) {
            console.warn(`Placeholder con ID "${placeholderId}" no encontrado.`);
            return;
        }
        try {
            const response = await fetch(componentPath);
            if (!response.ok) throw new Error(`Componente no encontrado: ${componentPath}`);
            const html = await response.text();
            placeholder.outerHTML = html;
            document.dispatchEvent(new CustomEvent('componentLoaded', { detail: { id: placeholderId } }));
            console.log(`Componente "${placeholderId}" cargado correctamente.`);
        } catch (error) {
            console.error(`Error cargando componente:`, error);
        }
    };

    // 3. FUNCIÓN PRINCIPAL PARA INICIALIZAR LA APP
    const initializeApp = async () => {
        // Cargamos componentes en paralelo para mayor eficiencia
        await Promise.all([
            loadComponent('/_header.html', 'header-placeholder'),
            loadComponent('/_footer.html', 'footer-placeholder')
        ]);
        
        // La lógica de autenticación y UI se ejecuta después de que los componentes estén listos,
        // especialmente el header que contiene los botones de login/logout.
    };

    // 4. INICIAMOS LA APLICACIÓN
    initializeApp();
});

// 5. LÓGICA DE INTERACTIVIDAD DEL HEADER
// Se ejecuta solo cuando el header confirma que ha sido cargado.
document.addEventListener('componentLoaded', (e) => {
    if (e.detail.id !== 'header-placeholder') return;

    console.log("Header cargado. Inicializando interactividad del menú...");

    // --- SELECCIÓN DE ELEMENTOS DEL HEADER ---
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

    // --- FUNCIONES DE UI DEL HEADER ---
    const showUserUI = (user) => {
        if(guestView) guestView.style.display = 'none';
        if(userView) userView.style.display = 'flex';
        if(avatarLink && user) {
            const avatarUrl = user.user_metadata?.avatar_url || '/img/default-avatar.png';
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
        if (themeIconDesktop) {
            themeIconDesktop.className = `fa-solid ${iconClass}`;
        }
        if (themeIconMobile) {
            themeIconMobile.className = `fa-solid ${iconClass}`;
        }
    };
    const toggleTheme = () => {
        const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
    };
    const handleOAuthLogin = async (provider) => {
        await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/inv/dashboard.html` } });
    };

    // --- ASIGNACIÓN DE EVENTOS DEL HEADER ---
    themeSwitcherDesktop?.addEventListener("click", toggleTheme);
    themeSwitcherMobile?.addEventListener("click", toggleTheme);
    logoutBtn?.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); window.location.href = '/'; });
    loginMenuTrigger?.addEventListener('click', (e) => { e.stopPropagation(); loginPopover?.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (loginPopover && !loginMenuTrigger?.contains(e.target) && !loginPopover.contains(e.target)) loginPopover.classList.remove('is-open'); });
    
    googleLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    googleLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });

    mobileMoreBtn?.addEventListener("click", (event) => { event.stopPropagation(); mobileMoreMenu?.classList.toggle("is-open"); });
    mobileMoreMenuClose?.addEventListener("click", () => { mobileMoreMenu?.classList.remove("is-open"); });

    // --- LÓGICA DE INICIALIZACIÓN DEL HEADER ---
    applyTheme(localStorage.getItem('theme') || 'light');
    liveIconDesktop?.classList.add("is-live");
    
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
        session?.user ? showUserUI(session.user) : showGuestUI();
    });

    (async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        session?.user ? showUserUI(session.user) : showGuestUI();
    })();
});