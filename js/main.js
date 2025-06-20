/**
 * =========================================================================
 * Script Principal de la Aplicación (main.js)
 * Carga componentes compartidos e inicializa la lógica global (Header, Auth).
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. INICIALIZACIÓN CENTRAL DE SUPABASE
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    
    // Creamos el cliente UNA SOLA VEZ y lo hacemos global para que otros scripts lo puedan usar.
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client creado y disponible globalmente.");

    // 2. CARGADOR DE COMPONENTES
    const loadComponent = (componentPath, placeholderId) => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            fetch(componentPath)
                .then(response => {
                    if (!response.ok) throw new Error(`Componente no encontrado: ${componentPath}`);
                    return response.text();
                })
                .then(html => {
                    placeholder.outerHTML = html;
                    // Avisamos que el componente está listo
                    document.dispatchEvent(new CustomEvent('componentLoaded', { detail: { id: placeholderId } }));
                })
                .catch(error => console.error(`Error cargando componente:`, error));
        }
    };

    // 3. CARGAMOS LOS COMPONENTES COMPARTIDOS
    // Usamos rutas absolutas para que funcione desde cualquier página
    loadComponent('/_header.html', 'header-placeholder');
    // Podríamos cargar el footer de la misma manera si quisiéramos
    // loadComponent('/_footer.html', 'footer-placeholder');
});


// 4. LÓGICA DE INTERACTIVIDAD DEL HEADER
// Esta lógica espera la señal de que el header ha sido cargado antes de ejecutarse.
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

    // --- AÑADE ESTE BLOQUE PARA EL MENÚ "MÁS OPCIONES" ---
    mobileMoreBtn?.addEventListener("click", (event) => {
        event.stopPropagation(); // Evita que otros clics interfieran
        mobileMoreMenu?.classList.toggle("is-open");
    });

    mobileMoreMenuClose?.addEventListener("click", () => {
        mobileMoreMenu?.classList.remove("is-open");
    });
    // --- FIN DEL BLOQUE NUEVO ---

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
        themeSwitcherDesktop?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun');
        themeSwitcherDesktop?.querySelector('i')?.classList.add('fa-solid', iconClass);
        themeSwitcherMobile?.querySelector('i')?.classList.remove('fa-moon', 'fa-sun');
        themeSwitcherMobile?.querySelector('i')?.classList.add('fa-solid', iconClass);
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
    document.addEventListener('click', (e) => { if (!loginMenuTrigger?.contains(e.target) && !loginPopover?.contains(e.target)) loginPopover?.classList.remove('is-open'); });
    googleLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginDesktop?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    googleLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
    githubLoginMobile?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    mobileMoreBtn?.addEventListener("click", (event) => { event.stopPropagation(); mobileMoreMenu?.classList.toggle("is-open"); });
    mobileMoreMenuClose?.addEventListener("click", () => { mobileMoreMenu?.classList.remove("is-open"); });

    // --- LÓGICA DE INICIALIZACIÓN DEL HEADER ---
    applyTheme(localStorage.getItem('theme') || 'light');
    if(liveIconDesktop) liveIconDesktop.classList.add("is-live"); // Activa el icono de Live
    
    // "Vigilante" de sesión que actualiza la UI
    window.supabaseClient.auth.onAuthStateChange((_event, session) => {
        session?.user ? showUserUI(session.user) : showGuestUI();
    });
    // Comprobación inicial para mostrar la UI correcta al cargar la página
    async function checkInitialSession() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        session?.user ? showUserUI(session.user) : showGuestUI();
    }
    checkInitialSession();
});