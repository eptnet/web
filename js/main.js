// js/main.js - El nuevo cerebro de la app
document.addEventListener('DOMContentLoaded', () => {
    // 1. INICIALIZACIÓN CENTRAL DE SUPABASE
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 2. CARGADOR DE COMPONENTES
    const loadComponent = (componentPath, placeholderId) => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            fetch(componentPath)
                .then(res => res.ok ? res.text() : Promise.reject('Componente no encontrado'))
                .then(html => {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    placeholder.replaceWith(...tempDiv.childNodes);
                    document.dispatchEvent(new CustomEvent('componentLoaded', { detail: { id: placeholderId } }));
                }).catch(err => console.error(`Error cargando ${componentPath}:`, err));
        }
    };
    loadComponent('/_header.html', 'header-placeholder');
});

// 3. LÓGICA DE INTERACTIVIDAD DEL HEADER
document.addEventListener('componentLoaded', (e) => {
    if (e.detail.id === 'header-placeholder') {
        const userView = document.getElementById('user-view');
        const guestView = document.getElementById('guest-view');
        const avatarLink = document.getElementById('user-avatar-link');
        const logoutBtn = document.getElementById('logout-btn-header');
        
        const showUserUI = (user) => {
            if(guestView) guestView.style.display = 'none';
            if(userView) userView.style.display = 'flex';
            if(avatarLink && user) {
                const avatarUrl = user.user_metadata?.avatar_url || '/img/default-avatar.png';
                avatarLink.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%;">`;
            }
            logoutBtn?.addEventListener('click', async () => {
                await window.supabaseClient.auth.signOut();
                window.location.href = '/';
            });
        };

        const showGuestUI = () => {
            if(userView) userView.style.display = 'none';
            if(guestView) guestView.style.display = 'flex';
        };

        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
            session?.user ? showUserUI(session.user) : showGuestUI();
        });

        const handleOAuthLogin = async (provider) => {
            await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/inv/dashboard.html` } });
        };

        document.getElementById('login-google-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('google'); });
        document.getElementById('login-github-btn-desktop')?.addEventListener('click', (e) => { e.preventDefault(); handleOAuthLogin('github'); });
    }
});