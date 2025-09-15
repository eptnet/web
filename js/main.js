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

        // --- INICIO: Lógica para manejar invitaciones ---
        const urlParams = new URLSearchParams(window.location.search);
        const invitationToken = urlParams.get('invitation_token');

        if (invitationToken) {
            // Si encontramos un token, lo guardamos en el almacenamiento de sesión del navegador.
            // Esto nos permite recordarlo incluso después de que el usuario sea redirigido por Google/GitHub.
            sessionStorage.setItem('invitation_token', invitationToken);

            // Borramos el token de la URL para que no se vea.
            window.history.replaceState({}, document.title, window.location.pathname);

            // Abrimos el modal de login automáticamente.
            console.log("Token de invitación detectado. Abriendo modal de login...");
            document.getElementById('login-modal-trigger')?.click();
        }
        // --- FIN: Lógica para manejar invitaciones ---

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

        // --- INICIO: LÓGICA DE NOTIFICACIONES EN TIEMPO REAL ---
        const notificationsIcon = document.getElementById('notifications-bell-icon');
        const notificationsModal = document.createElement('div');
        notificationsModal.className = 'notifications-modal';
        document.body.appendChild(notificationsModal);

        // Función para mostrar el punto rojo
        const showNotificationAlert = () => {
            if (notificationsIcon) {
                notificationsIcon.classList.add('has-notifications');
            }
        };

        // Función para mostrar el modal con las últimas notificaciones
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

            // --- INICIO DE LA LÍNEA AÑADIDA ---
            // Guardamos la fecha de la notificación más reciente (la primera de la lista)
            localStorage.setItem('lastSeenNotificationTimestamp', data[0].created_at);
            // --- FIN DE LA LÍNEA AÑADIDA ---

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

        // AÑADE ESTA NUEVA FUNCIÓN
        const checkForUnreadNotifications = async () => {
            if (!window.supabaseClient) return;

            // 1. Buscamos la notificación más reciente en la base de datos
            const { data: latestNotification, error } = await window.supabaseClient
                .from('notifications')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !latestNotification) {
                return; // No hay notificaciones o hubo un error
            }

            // 2. Obtenemos la fecha de la última notificación que el usuario vio
            const lastSeenTimestamp = localStorage.getItem('lastSeenNotificationTimestamp');

            // 3. Comparamos: si no hay fecha guardada, o si la notificación más reciente es posterior a la última vista...
            if (!lastSeenTimestamp || new Date(latestNotification.created_at) > new Date(lastSeenTimestamp)) {
                // ...mostramos el punto rojo.
                showNotificationAlert();
            }
        };

        // Listener para el clic en el icono de la campana
        notificationsIcon?.addEventListener('click', (e) => {
            e.preventDefault();
            openNotificationsModal();
        });

        // Cerramos el modal si se hace clic fuera de él
        document.addEventListener('click', (e) => {
            if (!notificationsModal.contains(e.target) && !notificationsIcon.contains(e.target)) {
                notificationsModal.classList.remove('is-visible');
            }
        });

        // Escuchamos por NUEVAS notificaciones en la base de datos
        window.supabaseClient
            .channel('public:notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                console.log('¡Nueva notificación recibida!', payload.new);
                showNotificationAlert();
            })
            .subscribe();

        // --- FIN: LÓGICA DE NOTIFICACIONES ---
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
        
        // Lógica para abrir y cerrar el nuevo modal de login
        const loginModalTrigger = document.getElementById('login-modal-trigger');
        const loginModalOverlay = document.getElementById('login-modal-overlay');
        const loginModalCloseBtn = document.getElementById('login-modal-close-btn');

        loginModalTrigger?.addEventListener('click', () => {
            loginModalOverlay?.classList.add('is-visible');
        });

        loginModalCloseBtn?.addEventListener('click', () => {
            loginModalOverlay?.classList.remove('is-visible');
        });

        // Cierra el modal si se hace clic en el fondo oscuro
        loginModalOverlay?.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) {
                loginModalOverlay.classList.remove('is-visible');
            }
        });

        loginModalOverlay?.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) {
                loginModalOverlay.classList.remove('is-visible');
            }
        });

        // --- Lógica para el menú móvil de "Más Opciones" ---
        const mobileMoreBtn = document.getElementById('mobile-more-btn');
        const mobileMoreMenu = document.getElementById('mobile-more-menu');
        const mobileMoreMenuClose = document.getElementById('mobile-more-menu-close');
        const overlay = document.getElementById('overlay');

        // Función para abrir el menú
        const openMobileMenu = () => {
            // Hacemos visibles el menú y el fondo oscuro
            mobileMoreMenu?.classList.add('is-visible');
            overlay?.classList.add('is-visible');
            // Opcional: Evita que el contenido de la página se desplace mientras el menú está abierto
            document.body.style.overflow = 'hidden'; 
        };

        // Función para cerrar el menú
        const closeMobileMenu = () => {
            // Ocultamos el menú y el fondo oscuro
            mobileMoreMenu?.classList.remove('is-visible');
            overlay?.classList.remove('is-visible');
            // Restaura el scroll de la página
            document.body.style.overflow = '';
        };

        // Asignación de eventos de forma segura
        mobileMoreBtn?.addEventListener('click', openMobileMenu); // Abre el menú al hacer clic en el botón de la barra
        mobileMoreMenuClose?.addEventListener('click', closeMobileMenu); // Cierra el menú desde su botón "Cerrar"
        overlay?.addEventListener('click', closeMobileMenu); // Cierra el menú al hacer clic en el fondo oscuro
        
        document.body.addEventListener('click', (e) => {
            // Buscamos si el clic ocurrió en cualquier botón con la clase .login-provider-btn
            const providerBtn = e.target.closest('.login-provider-btn');

            // Si encontramos un botón y tiene el atributo data-provider...
            if (providerBtn && providerBtn.dataset.provider) {
                e.preventDefault();
                // Usamos el valor de data-provider para iniciar sesión (ej. 'google' o 'github')
                handleOAuthLogin(providerBtn.dataset.provider);
            }
        });

        // --- Lógica de Inicialización ---
        applyTheme(localStorage.getItem('theme') || 'light');
        if (liveIconDesktop) liveIconDesktop.classList.add("is-live"); // <-- LÍNEA REINTEGRADA

        window.supabaseClient.auth.onAuthStateChange(async (_event, session) => {
             if (session?.user) {
                showUserUI(session.user);

                // Verificamos si hay un token de invitación pendiente
                const pendingToken = sessionStorage.getItem('invitation_token');
                if (pendingToken) {
                    try {
                        console.log("Aceptando invitación con token...");
                        await window.supabaseClient.functions.invoke('accept-invitation', {
                            body: { token: pendingToken },
                        });
                        // Una vez procesado (con éxito o error), lo eliminamos para no volver a intentarlo.
                        sessionStorage.removeItem('invitation_token');
                        console.log("Proceso de invitación finalizado.");
                    } catch (error) {
                        console.error("Error al aceptar la invitación:", error.message);
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

        // --- INICIO: Lógica para el botón de Comunidad ---
        const handleCommunityClick = async (event) => {
            event.preventDefault(); // Prevenimos la navegación del enlace
            
            // Obtenemos la URL de destino desde el atributo data-url
            const communityUrl = event.currentTarget.dataset.url;
            
            // Verificamos la sesión actual del usuario con Supabase
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (session) {
                // Si el usuario TIENE sesión, lo llevamos a la comunidad en una nueva pestaña
                window.open(communityUrl, '_blank');
            } else {
                // Si el usuario NO TIENE sesión, abrimos el modal de login
                document.getElementById('login-modal-trigger')?.click();
            }
        };

        // Asignamos la nueva lógica a ambos botones
        document.getElementById('community-btn-desktop')?.addEventListener('click', handleCommunityClick);
        document.getElementById('community-btn-mobile')?.addEventListener('click', handleCommunityClick);
        // --- FIN: Lógica para el botón de Comunidad ---

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