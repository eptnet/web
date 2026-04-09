/**
 * =========================================================================
 * Script Principal de la Aplicación (main.js) - VERSIÓN 3.2 UNIFICADA
 * - Mantiene la inicialización segura de Supabase para evitar errores.
 * - Integra el Menú Móvil Inteligente (Dashboard/Perfil para usuarios logueados).
 * - Mantiene Banner PWA y Notificaciones en tiempo real.
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
        const liveIconDesktop = document.getElementById('nav-live-desktop');

        // --- INICIO: LÓGICA DE NOTIFICACIONES EN TIEMPO REAL ---
        const notificationsIcon = document.getElementById('notifications-bell-icon');
        const notificationsModal = document.createElement('div');
        notificationsModal.className = 'notifications-modal';
        document.body.appendChild(notificationsModal);

        const showNotificationAlert = () => {
            if (notificationsIcon) {
                notificationsIcon.classList.add('has-notifications');
            }
        };

        const openNotificationsModal = async () => {
            if (!window.supabaseClient) return;

            notificationsIcon.classList.remove('has-notifications');
            notificationsModal.innerHTML = '<div class="notifications-content"><p>Cargando...</p></div>';
            notificationsModal.classList.add('is-visible');

            const { data, error } = await window.supabaseClient
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                notificationsModal.innerHTML = '<div class="notifications-content"><p>No hay notificaciones nuevas.</p></div>';
                return;
            }

            localStorage.setItem('lastSeenNotificationTimestamp', data[0].created_at);

            const notificationsHTML = data.map(notif => {
                const timeAgo = new Date(notif.created_at).toLocaleString('es-ES');
                return `
                    <a href="${notif.link || '#'}" class="notification-item">
                        <p>${notif.message}</p>
                        <span>${timeAgo}</span>
                    </a>
                `;
            }).join('');

            notificationsModal.innerHTML = `
                <div class="notifications-content">
                    <h3>Últimas Novedades</h3>
                    ${notificationsHTML}
                </div>
            `;
        };  

        const checkForUnreadNotifications = async () => {
            if (!window.supabaseClient) return;

            const { data: latestNotification, error } = await window.supabaseClient
                .from('notifications')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !latestNotification) return;

            const lastSeenTimestamp = localStorage.getItem('lastSeenNotificationTimestamp');

            if (!lastSeenTimestamp || new Date(latestNotification.created_at) > new Date(lastSeenTimestamp)) {
                showNotificationAlert();
            }
        };

        notificationsIcon?.addEventListener('click', (e) => {
            e.preventDefault();
            openNotificationsModal();
        });

        document.addEventListener('click', (e) => {
            if (notificationsModal && !notificationsModal.contains(e.target)) {
                // Comprobamos de forma segura si el icono existe en esta página
                const isIconClick = notificationsIcon ? notificationsIcon.contains(e.target) : false;
                if (!isIconClick) {
                    notificationsModal.classList.remove('is-visible');
                }
            }
        });

        window.supabaseClient
            .channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                console.log('¡Nueva notificación recibida!', payload.new);
                showNotificationAlert();
            })
            .subscribe();
        // --- FIN: LÓGICA DE NOTIFICACIONES ---

        // =========================================================================
        // LÓGICA DEL MENÚ MÓVIL INTELIGENTE (PWA)
        // =========================================================================
        const updateMobileMenuForUser = (user, profileData) => {
            const authSection = document.getElementById('mobile-auth-section');
            if (!authSection) return;

            if (user) {
                // El usuario ESTÁ logueado
                const avatar = profileData?.avatar_url || user.user_metadata?.avatar_url || 'https://i.ibb.co/wzn25c8/default-avatar.png';
                const name = profileData?.display_name || user.user_metadata?.full_name || 'Investigador';
                
                authSection.innerHTML = `
                    <div style="padding: 10px 16px; display: flex; align-items: center; gap: 15px; margin-bottom: 10px; background: rgba(183, 42, 30, 0.05); border-radius: 12px; border: 1px solid rgba(183, 42, 30, 0.1);">
                        <img src="${avatar}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-surface);">
                        <div>
                            <p style="margin: 0; font-weight: bold; font-size: 1rem; color: var(--color-text-primary); line-height: 1.2;">${name}</p>
                            <span style="font-size: 0.75rem; color: var(--color-accent); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Cuenta Activa</span>
                        </div>
                    </div>
                    
                    <a href="/inv/dashboard.html" class="mobile-more-menu__item" style="color: var(--color-primary);">
                        <i class="fa-solid fa-chart-line"></i><span>Mi Panel (Dashboard)</span>
                    </a>
                    <a href="/inv/profile.html" class="mobile-more-menu__item" style="color: var(--color-primary);">
                        <i class="fa-solid fa-user-pen"></i><span>Editar Mi Perfil</span>
                    </a>
                    <button id="mobile-logout-btn" class="mobile-more-menu__item" style="color: #ef4444; width: 100%; text-align: left; background: none; border: none; font-family: inherit; font-size: 1rem; cursor: pointer;">
                        <i class="fa-solid fa-right-from-bracket"></i><span>Cerrar Sesión</span>
                    </button>
                    <hr>
                `;

                // Lógica de logout móvil
                document.getElementById('mobile-logout-btn')?.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await window.supabaseClient.auth.signOut();
                    window.location.href = '/'; 
                });

            } else {
                // El usuario NO ESTÁ logueado (Restauramos vista de invitado)
                authSection.innerHTML = `
                    <a href="#" data-provider="google" class="mobile-more-menu__item login-provider-btn"><i class="fa-brands fa-google"></i><span>Iniciar con Google</span></a>
                    <a href="#" data-provider="github" class="mobile-more-menu__item login-provider-btn"><i class="fa-brands fa-github"></i><span>Iniciar con GitHub</span></a>
                    <a href="#" class="mobile-more-menu__item is-disabled"><i class="fa-brands fa-orcid"></i><span>ORCID (Próximamente)</span></a>
                    <hr>
                `;
            }
        };

        // --- Funciones de UI Principales ---
        const showUserUI = async (user) => {
            const guestView = document.getElementById('guest-view');
            const userView = document.getElementById('user-view');
            if (guestView) guestView.style.display = 'none';
            if (userView) userView.style.display = 'flex';
            
            // 1. Renderizar Avatar en la cabecera de PC
            const avatarBtn = document.getElementById('user-avatar-link');
            if (avatarBtn && user) {
                const avatarUrl = user.user_metadata?.avatar_url || 'https://i.ibb.co/wzn25c8/default-avatar.png';
                avatarBtn.innerHTML = `<img src="${avatarUrl}" alt="Perfil">`;
            }

            // 2. Traer info del Perfil para Gamificación y Menú Móvil
            try {
                const { data: profile } = await window.supabaseClient
                    .from('profiles')
                    .select('orcid, display_name, avatar_url')
                    .eq('id', user.id)
                    .single();

                // Actualiza el menú móvil inteligentemente
                updateMobileMenuForUser(user, profile);

                const btnCreate = document.getElementById('btn-global-create');
                const createIcon = document.getElementById('create-icon');
                const dropdownContainer = document.getElementById('create-dropdown-container'); 

                if (btnCreate && dropdownContainer) {
                    if (profile && profile.orcid && profile.orcid !== '0000') {
                        // ROL: AUTOR (Desbloqueado)
                        btnCreate.classList.remove('create-locked');
                        btnCreate.classList.add('create-unlocked');
                        createIcon.className = 'fa-solid fa-circle-plus';
                        btnCreate.onclick = null; 
                        dropdownContainer.style.pointerEvents = 'auto';
                    } else {
                        // ROL: USUARIO/PARTICIPANTE (Bloqueado)
                        dropdownContainer.style.pointerEvents = 'none'; 
                        btnCreate.style.pointerEvents = 'auto'; 
                        btnCreate.onclick = () => showToast("💡 Solo autores con ORCID validado pueden crear contenido. Ve a tu perfil para activarlo.");
                    }
                }
            } catch (e) { console.error("Error validando perfil:", e); }
        };

        const showGuestUI = () => {
            const guestView = document.getElementById('guest-view');
            const userView = document.getElementById('user-view');
            if (userView) userView.style.display = 'none';
            if (guestView) guestView.style.display = 'flex';
            
            // Limpia el menú móvil
            updateMobileMenuForUser(null, null);

            const btnCreate = document.getElementById('btn-global-create');
            const dropdownContainer = document.getElementById('create-dropdown-container');
            
            if (btnCreate && dropdownContainer) {
                dropdownContainer.style.pointerEvents = 'none'; 
                btnCreate.style.pointerEvents = 'auto';
                btnCreate.onclick = () => {
                    showToast("🔑 Inicia sesión para comenzar a crear contenido.");
                    setTimeout(() => document.getElementById('login-modal-trigger')?.click(), 1500);
                };
            }
        };

        // MULTI-TRIGGER GLOBAL PARA EL MODAL DE ACCESO
        document.addEventListener('click', (e) => {
            if (e.target.closest('.trigger-login-modal')) {
                e.preventDefault(); 
                const modalOverlay = document.getElementById('login-modal-overlay');
                if (modalOverlay) {
                    modalOverlay.classList.add('is-visible'); 
                } else {
                    document.getElementById('login-modal-trigger')?.click();
                }
            }
        });

        // FUNCIÓN PARA LA NOTIFICACIÓN FLOTANTE (TOAST)
        window.showToast = (msg) => {
            const toast = document.getElementById('global-toast');
            if(!toast) return;
            toast.innerHTML = msg;
            toast.classList.remove('toast-hidden');
            setTimeout(() => toast.classList.add('toast-hidden'), 4000);
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
            const redirectTo = `${window.location.origin}/inv/profile.html`;
            await window.supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo } });
        };

        // --- Asignación de eventos ---
        if (themeSwitcherDesktop) themeSwitcherDesktop.addEventListener("click", toggleTheme);
        if (themeSwitcherMobile) themeSwitcherMobile.addEventListener("click", toggleTheme);
        if (logoutBtn) logoutBtn.addEventListener('click', async () => { await window.supabaseClient.auth.signOut(); });
        
        const loginModalTrigger = document.getElementById('login-modal-trigger');
        const loginModalOverlay = document.getElementById('login-modal-overlay');
        const loginModalCloseBtn = document.getElementById('login-modal-close-btn');

        loginModalTrigger?.addEventListener('click', () => { loginModalOverlay?.classList.add('is-visible'); });
        loginModalCloseBtn?.addEventListener('click', () => { loginModalOverlay?.classList.remove('is-visible'); });
        loginModalOverlay?.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) loginModalOverlay.classList.remove('is-visible');
        });

        // --- Lógica para el menú móvil de "Más Opciones" ---
        const mobileMoreBtn = document.getElementById('mobile-more-btn');
        const mobileMoreMenu = document.getElementById('mobile-more-menu');
        const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');
        const overlay = document.getElementById('overlay');

        const openMobileMenu = (e) => {
            if (e) e.preventDefault(); 
            mobileMoreMenu?.classList.add('is-visible');
            overlay?.classList.add('is-visible');
            document.body.style.overflow = 'hidden'; 
        };

        const closeMobileMenu = () => {
            mobileMoreMenu?.classList.remove('is-visible');
            overlay?.classList.remove('is-visible');
            document.body.style.overflow = '';
        };

        mobileMoreBtn?.addEventListener('click', openMobileMenu);
        mobileMoreMenuClose?.addEventListener('click', closeMobileMenu);
        overlay?.addEventListener('click', closeMobileMenu);
        
        // Cierre automático al tocar enlaces dentro del menú
        mobileMoreMenu?.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('click', (e) => {
                // No cerramos si tocan los inputs de login, el evento delegado lo maneja
                if (!e.target.closest('.login-provider-btn')) {
                    closeMobileMenu();
                }
            });
        });

        // Evento delegado Global para Login Social (Incluso en el menú móvil dinámico)
        document.body.addEventListener('click', (e) => {
            const providerBtn = e.target.closest('.login-provider-btn');
            if (providerBtn && providerBtn.dataset.provider) {
                e.preventDefault();
                handleOAuthLogin(providerBtn.dataset.provider);
            }
        });

        // --- Inicialización ---
        applyTheme(localStorage.getItem('theme') || 'light');
        if (liveIconDesktop) liveIconDesktop.classList.add("is-live"); 

        window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
             if (session?.user) {
                showUserUI(session.user);

                const pendingToken = sessionStorage.getItem('invitation_token');
                if (pendingToken) {
                    try {
                        await window.supabaseClient.functions.invoke('accept-invitation', {
                            body: { token: pendingToken },
                        });
                        sessionStorage.removeItem('invitation_token');
                    } catch (error) {
                        sessionStorage.removeItem('invitation_token');
                    }
                }
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
            checkForUnreadNotifications();
        })();

        // --- Lógica de Comunidad ---
        const handleCommunityClick = async (event) => {
            event.preventDefault();
            const communityUrl = event.currentTarget.dataset.url;
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (session) {
                window.open(communityUrl, '_blank');
            } else {
                document.getElementById('login-modal-trigger')?.click();
            }
        };

        document.getElementById('community-btn-desktop')?.addEventListener('click', handleCommunityClick);
        document.getElementById('community-btn-mobile')?.addEventListener('click', handleCommunityClick);

        // --- Parámetros URL (Invitación y Login Directo) ---
        const urlParams = new URLSearchParams(window.location.search);
        const invitationToken = urlParams.get('invitation_token');
        const authAction = urlParams.get('auth');

        if (invitationToken) {
            sessionStorage.setItem('invitation_token', invitationToken);
            window.history.replaceState({}, document.title, window.location.pathname);
            document.getElementById('login-modal-trigger')?.click();
        } else if (authAction === 'open') {
            document.getElementById('login-modal-trigger')?.click();
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        document.dispatchEvent(new CustomEvent('mainReady'));
        console.log("main.js: Evento 'mainReady' disparado. Base unificada y lista.");
    };

    // Verificador de carga de Supabase
    const checkSupabase = setInterval(() => {
        if (window.supabase) {
            clearInterval(checkSupabase);
            initializeApp();
        }
    }, 100);
});

// ==========================================
// CONTROL DEL MENÚ MÓVIL PWA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const mobileToggleBtn = document.getElementById('mobile-menu-toggle-btn');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');
    const mobileCloseBtn = document.getElementById('mobile-more-menu-close');

    if (mobileToggleBtn && mobileMoreMenu) {
        mobileToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMoreMenu.classList.add('is-visible');
        });
    }

    if (mobileCloseBtn && mobileMoreMenu) {
        mobileCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMoreMenu.classList.remove('is-visible');
        });
    }

    if (mobileMoreMenu) {
        mobileMoreMenu.addEventListener('click', (e) => {
            if (e.target === mobileMoreMenu) {
                mobileMoreMenu.classList.remove('is-visible');
            }
        });
    }
});

// ==========================================
// INSTALACIÓN MANUAL DE PWA (Con opción de cerrar)
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Si el usuario ya lo cerró en esta sesión, no lo mostramos de nuevo
    if (sessionStorage.getItem('pwa-banner-dismissed') === 'true') {
        return;
    }
    
    if (!document.getElementById('pwa-install-banner')) {
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.innerHTML = `
            <div style="position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: var(--color-surface); border: 1px solid var(--color-border); padding: 10px 15px; border-radius: 50px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 9999; display: flex; align-items: center; justify-content: space-between; width: 95%; max-width: 400px; gap: 10px;">
                
                <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1; overflow: hidden;">
                    <img src="https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">
                    <div style="text-align: left; line-height: 1.2; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                        <p style="margin: 0; font-weight: bold; font-size: 0.9rem; color: var(--color-text-primary);">Instalar App</p>
                        <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-secondary);">Experiencia nativa</p>
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="btn-install-pwa" style="background: var(--color-accent); color: white; border: none; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; cursor: pointer; transition: 0.2s;">Instalar</button>
                    <button id="btn-close-pwa-banner" style="background: transparent; border: none; color: var(--color-text-secondary); font-size: 1.2rem; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                
            </div>
        `;
        document.body.appendChild(banner);

        // Evento para el botón de instalar
        document.getElementById('btn-install-pwa').addEventListener('click', async () => {
            banner.style.display = 'none';
            deferredPrompt.prompt(); 
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        });

        // Evento para el botón de cerrar (X)
        document.getElementById('btn-close-pwa-banner').addEventListener('click', () => {
            banner.style.display = 'none';
            // Guardamos en memoria que el usuario lo cerró para no molestarlo más
            sessionStorage.setItem('pwa-banner-dismissed', 'true');
        });
    }
});