// /inv/js/profile.js - VERSIÓN DEFINITIVA Y FUNCIONAL
const ProfileApp = {
    supabase: null,
    user: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        this.addEventListeners();
        await this.handleUserSession();
        this.setupTabNavigation(); // <-- AÑADE ESTA LÍNEA

        // Al cargar la página, revisamos si venimos de la redirección de ORCID
        this.checkForOrcidCode();

        // --- INICIO DE LA LÓGICA PARA IMGBB ---
        window.addEventListener('message', (event) => {
            // Verificamos que el mensaje venga del plugin de imgbb
            if (event.origin !== 'https://imgbb.com') return;

            if (event.data && typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data);
                    if (data.success && data.image && data.image.url) {
                        const newAvatarUrl = data.image.url;
                        console.log('Nueva URL de avatar recibida:', newAvatarUrl);
                        this.updateAvatar(newAvatarUrl);
                    }
                } catch (e) {
                    console.error('Error al procesar el mensaje de imgbb:', e);
                }
            }
        });
        // --- FIN DE LA LÓGICA PARA IMGBB ---
    },

    setupTabNavigation() {
        // Apuntamos a los botones en su nueva ubicación
        const navLinks = document.querySelectorAll('.profile-tab-link'); 
        const tabContents = document.querySelectorAll('.profile-tab-content');

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;
                navLinks.forEach(nav => nav.classList.remove('active'));
                link.classList.add('active');
                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === tabId);
                });
            });
        });
    },

    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { 
            window.location.href = '/'; 
            return; 
        }
        this.user = session.user;

        // Guardamos el perfil completo del usuario actual
        const { data: userProfile } = await this.supabase.from('profiles').select('*').eq('id', this.user.id).single();
        this.currentUserProfile = userProfile;

        const urlParams = new URLSearchParams(window.location.search);
        const profileIdFromUrl = urlParams.get('id');
        const targetProfileId = profileIdFromUrl || this.user.id;
        this.renderProfileData(targetProfileId);
    },

    addEventListeners() {
        document.body.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const action = target.id;
            if (action === 'connect-orcid-btn') this.handleOrcidConnect();
            else if (action === 'disconnect-orcid-btn') this.handleOrcidDisconnect();
            else if (action === 'logout-btn-header') {
                await this.supabase.auth.signOut();
                window.location.href = '/';
            }
            else if (action === 'theme-switcher') this.toggleTheme();
            else if (action === 'sync-orcid-works-btn') this.handleSyncWorks();
        });

        document.getElementById('profile-form')?.addEventListener('submit', (e) => this.handleSave(e, 'profile'));
        document.getElementById('platforms-form')?.addEventListener('submit', (e) => this.handleSave(e, 'platforms'));
        
        // --- LÍNEA AÑADIDA ---
        document.getElementById('avatar-update-form')?.addEventListener('submit', (e) => this.handleUpdateAvatar(e));
        document.getElementById('zenodo-form')?.addEventListener('submit', (e) => this.handleZenodoSubmit(e));
    },
    
    // --- INICIO DE LA CORRECCIÓN: Lógica Manual de ORCID ---
    handleOrcidConnect() {
        // ¡IMPORTANTE! Reemplaza el marcador de posición con tu Client ID real de ORCID.
        const ORCID_CLIENT_ID = 'APP-U2XLNHUBU73BN0VY';
        
         // Obtenemos la URL actual sin parámetros para la redirección
        const redirectUri = window.location.href.split('?')[0];
        
        // Construimos la URL de autorización manual, como indica la documentación de ORCID
        const authUrl = `https://orcid.org/oauth/authorize?client_id=${ORCID_CLIENT_ID}&response_type=code&scope=/authenticate&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        // Redirigimos al usuario a la página de login de ORCID
        window.location.href = authUrl;
    },

    async checkForOrcidCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            // Limpiamos la URL para que el código no quede visible y no se procese de nuevo si se recarga la página
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Mostramos una alerta de que estamos procesando
            alert("Verificando código de ORCID...");
            
            try {
                // Llamamos a nuestra Edge Function para intercambiar el código
                const { data, error } = await this.supabase.functions.invoke('verificar-orcid-code', {
                    body: { 
                        authorization_code: code,
                        redirect_uri: window.location.origin + window.location.pathname
                    },
                });

                if (error) throw error;

                // Si todo fue bien, guardamos el ORCID iD en el perfil del usuario
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({ orcid: `https://orcid.org/${data.orcid}` })
                    .eq('id', this.user.id);
                
                if (updateError) throw updateError;
                
                alert("¡Cuenta de ORCID conectada con éxito!");
                this.renderProfileData(); // Recargamos la información del perfil

            } catch(error) {
                alert("Error al verificar el código de ORCID: " + error.message);
            }
        }
    },
    // --- FIN DE LA CORRECCIÓN ---

    async handleOrcidDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de ORCID?")) return;
        const { error } = await this.supabase.from('profiles').update({ orcid: null }).eq('id', this.user.id);
        if (error) { alert("Error al desconectar la cuenta de ORCID."); } 
        else { alert("Cuenta de ORCID desconectada."); this.renderProfileData(); }
    },

    async renderProfileData(profileId) {
        if (!this.user) return;
        this.renderTopBar();

        // 1. Usamos el 'profileId' que recibimos para buscar el perfil
        const { data: profile, error } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .single();

            // --- INICIO DE LA MODIFICACIÓN ---
            // Quitamos la clase de carga DESPUÉS de tener una respuesta, sea cual sea.
            document.body.classList.remove('loading-profile');
            // --- FIN DE LA MODIFICACIÓN ---

        if (error) {
            console.error('Error cargando el perfil:', error);
            document.querySelector('.main-content').innerHTML = '<h2>Perfil no encontrado</h2><p>El investigador que buscas no existe o el enlace es incorrecto.</p>';
            return;
        }

        // --- LÓGICA PARA VISTA PÚBLICA VS. VISTA PROPIA ---
        // Comparamos el ID del perfil mostrado con el del usuario logueado
        const isMyOwnProfile = (profile.id === this.user.id);
        
        // Si NO es mi perfil, añadimos una clase al body para ocultar los formularios
        document.body.classList.toggle('public-view', !isMyOwnProfile);
        // --- FIN DE LA LÓGICA ---

        if (profile) {
            // --- INICIO: LÓGICA DE ROLES MEJORADA ---
            const isMyOwnProfile = (profile.id === this.user.id);
            const isAdmin = (this.currentUserProfile?.role === 'admin');

            // La vista será editable si es mi perfil O si soy admin
            const isEditable = isMyOwnProfile || isAdmin;

            // Añadimos la clase 'public-view' solo si la vista NO es editable
            document.body.classList.toggle('public-view', !isEditable);
            // --- FIN: LÓGICA DE ROLES ---
            // 2. Poblamos toda la información del perfil como antes
            document.getElementById('profile-card-avatar').src = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('profile-card-name').textContent = profile.display_name || 'Completa tu perfil';
            document.getElementById('profile-card-orcid').textContent = profile.orcid ? profile.orcid.replace('https://orcid.org/', '') : 'ORCID no conectado';
            document.getElementById('profile-card-bio').textContent = profile.bio || '';

            const socialsContainer = document.getElementById('profile-card-socials');
            if(socialsContainer) {
                socialsContainer.innerHTML = `
                    ${profile.substack_url ? `<a href="${profile.substack_url}" target="_blank" title="Substack"><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" id="Substack--Streamline-Simple-Icons" height="24" width="24">
                        <desc>
                            Substack Streamline Icon: https://streamlinehq.com
                        </desc>
                        <title>Substack</title>
                        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" fill="#e65c17" stroke-width="1"></path>
                        </svg></a>` : ''}
                    ${profile.website_url ? `<a href="${profile.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
                    ${profile.x_url ? `<a href="${profile.x_url}" target="_blank" title="Perfil de X"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                    ${profile.linkedin_url ? `<a href="${profile.linkedin_url}" target="_blank" title="Perfil de LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${profile.instagram_url ? `<a href="${profile.instagram_url}" target="_blank" title="Perfil de Instagram"><i class="fab fa-instagram"></i></a>` : ''}
                    ${profile.youtube_url ? `<a href="${profile.youtube_url}" target="_blank" title="Canal de YouTube"><i class="fab fa-youtube"></i></a>` : ''}`;
            }

            // Poblar Formularios
            document.getElementById('display-name').value = profile.display_name || '';
            document.getElementById('bio').value = profile.bio || '';
            document.getElementById('youtube-url').value = profile.youtube_url || '';
            document.getElementById('substack-url').value = profile.substack_url || '';
            document.getElementById('website-url').value = profile.website_url || '';
            document.getElementById('x-url').value = profile.x_url || '';
            document.getElementById('linkedin-url').value = profile.linkedin_url || '';
            document.getElementById('instagram-url').value = profile.instagram_url || '';
            document.getElementById('facebook-url').value = profile.facebook_url || '';
            document.getElementById('tiktok-url').value = profile.tiktok_url || '';
            
            // 3. Ahora, hacemos una SEGUNDA consulta solo para los proyectos
            const { data: projects, error: projectsError } = await this.supabase
                .from('projects')
                .select('*')
                .eq('user_id', profile.id);
            
            if (projectsError) {
                console.error("Error cargando los proyectos:", projectsError);
            } else {
                this.renderWorks(projects || []); // Mostramos los proyectos
            }
        }
        
        // 4. La lógica de ORCID se mantiene igual
        const orcidSection = document.getElementById('orcid-section');
        if (orcidSection) {
            if (profile?.orcid) {
                orcidSection.innerHTML = `<div class="status-badge connected"><i class="fa-solid fa-circle-check"></i><span>Conectado a ORCID</span></div> <button id="disconnect-orcid-btn" class="btn btn-secondary" style="width: auto; margin-top: 1rem;">Desconectar</button>`;
                document.getElementById('sync-orcid-works-btn')?.removeAttribute('disabled');
            } else {
                orcidSection.innerHTML = `<p>Valida tu perfil conectando tu cuenta de ORCID.</p><button id="connect-orcid-btn" class="btn btn-orcid"><i class="fa-brands fa-orcid"></i> Conectar con ORCID</button>`;
            }
        }

        // --- INICIO: LÓGICA MODIFICADA PARA LOS NUEVOS BOTONES ---
        const directoryBtnContainer = document.getElementById('directory-button-container');
        if (directoryBtnContainer) {
            let buttonsHTML = '';
            // Si el usuario tiene ORCID, mostramos los botones
            if (profile.orcid) {
                buttonsHTML = `
                    <a href="/inv/directorio.html" class="profile-card-nav__link">
                        <i class="fa-solid fa-users"></i> Directorio
                    </a>
                    <a href="#" class="profile-card-nav__link is-coming-soon">
                        <i class="fa-brands fa-bluesky"></i> Comunidad (Próx.)
                    </a>
                `;
            }
            directoryBtnContainer.innerHTML = buttonsHTML;
        // --- FIN: LÓGICA MODIFICADA ---
        }
    },

    // Se activa al hacer clic en "Sincronizar desde ORCID"
    async handleSyncWorks() {
        const syncButton = document.getElementById('sync-orcid-works-btn');
        if (!syncButton) return;

        syncButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando... (esto puede tardar)';
        syncButton.disabled = true;

        try {
            const { data: profile } = await this.supabase.from('profiles').select('orcid').eq('id', this.user.id).single();
            if (!profile?.orcid) throw new Error("No hay un ORCID iD conectado.");

            const orcidId = profile.orcid.replace('https://orcid.org/', '');

            const { data, error: functionError } = await this.supabase.functions.invoke('get-orcid-works', {
                body: { orcid_id: orcidId },
            });

            if (functionError) throw functionError;
            
            if (data.works) {
                const orcidDois = data.works.map(work => work.doi);
                // if (orcidDois.length > 0) {...}

                if (data.works.length > 0) {
                    const projectsToSave = data.works.map(work => ({
                        user_id: this.user.id,
                        doi: work.doi,
                        title: work.title,
                        authors: work.authors || [], 
                        publication_year: work.year || null,
                        description: work.description || null // <-- Se añade la descripción
                    }));

                    const { error: saveError } = await this.supabase.from('projects').upsert(projectsToSave, { onConflict: 'doi, user_id' });
                    if (saveError) throw saveError;
                }
            }
            
            alert(`Sincronización completada. Se encontraron y guardaron ${data.works.length} publicaciones.`);
            this.renderProfileData(this.user.id);

        } catch (error) {
            alert("Error al sincronizar las publicaciones: " + error.message);
        } finally {
            syncButton.innerHTML = '<i class="fa-solid fa-sync"></i> Sincronizar desde ORCID';
            syncButton.disabled = false;
        }
    },

    async handleZenodoSubmit(e) {
        e.preventDefault();
        if (!this.user) return alert("Debes iniciar sesión para publicar.");

        const title = document.getElementById('zenodo-title').value;
        const description = document.getElementById('zenodo-description').value;
        const fileInput = document.getElementById('zenodo-file');
        const file = fileInput.files[0];
        const messageEl = document.getElementById('zenodo-message');

        if (!title || !description || !file) {
            alert("Por favor, completa todos los campos.");
            return;
        }

        messageEl.textContent = "Subiendo archivo...";
        messageEl.className = 'form-message';

        try {
            // 1. Subimos el archivo a una carpeta temporal segura en Supabase Storage
            const filePath = `${this.user.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await this.supabase.storage
                .from('avatars') // Usamos el bucket 'avatars', o puedes crear uno nuevo 'uploads'
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Llamamos a la Edge Function con los metadatos y la ruta del archivo
            messageEl.textContent = "Procesando en Zenodo... (esto puede tardar un minuto)";
            const { data, error: functionError } = await this.supabase.functions.invoke('create-zenodo-doi', {
                body: {
                    filePath,
                    metadata: {
                        title: title,
                        description: description,
                        // El nombre del autor se obtiene del perfil en la Edge Function
                    }
                },
            });

            if (functionError) throw functionError;

            messageEl.textContent = `¡Éxito! Tu trabajo ha sido publicado con el DOI: ${data.doi}`;
            messageEl.classList.add('success');
            
            // Refrescamos la lista de proyectos para que aparezca el nuevo
            this.renderProfileData();

        } catch (error) {
            messageEl.textContent = `Error: ${error.message}`;
            messageEl.classList.add('error');
            console.error("Error en el proceso de Zenodo:", error);
        }
    },

    // REEMPLAZA ESTA FUNCIÓN en profile.js
    renderWorks(works) {
        const orcidListContainer = document.getElementById('projects-list');
        const eptDoiListContainer = document.getElementById('ept-doi-list'); // Nuevo contenedor

        if (!orcidListContainer || !eptDoiListContainer) return;

        // Filtramos los proyectos: los que vienen de ORCID y los creados en la plataforma
        const orcidProjects = works.filter(work => !work.created_via_platform);
        const eptProjects = works.filter(work => work.created_via_platform);

        // Renderizamos la lista de proyectos de ORCID
        if (orcidProjects.length === 0) {
            orcidListContainer.innerHTML = '<p class="form-hint">No tienes publicaciones sincronizadas desde ORCID.</p>';
        } else {
            orcidListContainer.innerHTML = orcidProjects.map(work => `
                <div class="publication-item">
                    <p>${work.title}</p>
                    <span>DOI: ${work.doi}</span>
                </div>
            `).join('');
        }

        // Renderizamos la lista de proyectos creados en EPT
        if (eptProjects.length === 0) {
            eptDoiListContainer.innerHTML = '<p class="form-hint">Aquí aparecerán los proyectos que publiques a través de esta herramienta.</p>';
        } else {
            eptDoiListContainer.innerHTML = eptProjects.map(work => `
                <div class="publication-item">
                    <p>${work.title}</p>
                    <span>DOI: ${work.doi}</span>
                    <div class="orcid-sync-hint">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>Recuerda añadir este DOI a tu perfil de ORCID y vuelve a sincronizar.</span>
                    </div>
                </div>
            `).join('');
        }
    },

    // AÑADE ESTA NUEVA FUNCIÓN en profile.js
    async handleOrcidDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de ORCID?")) return;

        const { error } = await this.supabase
            .from('profiles')
            .update({ orcid: null }) // Borramos el campo orcid
            .eq('id', this.user.id);
        
        if (error) {
            alert("Error al desconectar la cuenta de ORCID.");
            console.error(error);
        } else {
            alert("Cuenta de ORCID desconectada.");
            this.renderProfileData(); // Refrescamos la UI
        }
    },
    
    renderTopBar() {
        const topBar = document.querySelector('.top-bar');
        if (!topBar) return;
        const avatarUrl = this.user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        topBar.innerHTML = `
            <div class="top-bar__left">
                <a href="/" class="top-bar__logo"><img src="https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png" alt="Logo"></a>
            </div>
            <div class="top-bar__right">
                <a href="/live.html" class="top-bar-btn" title="Ir a EPT Live">
                    <i class="fa-solid fa-satellite-dish"></i>
                </a>
                <button class="top-bar-btn" id="theme-switcher" title="Cambiar tema"><i class="fa-solid fa-moon"></i></button>
                <button class="top-bar-btn" id="logout-btn-header" title="Cerrar Sesión"><i class="fa-solid fa-right-from-bracket"></i></button>
                <a href="/inv/dashboard.html" id="user-avatar-header" title="Ir al Dashboard">
                    <img src="${avatarUrl}" alt="Avatar">
                </a>
            </div>`;
        this.applyTheme();
    },
    
    toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        this.applyTheme();
    },

    applyTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle("dark-theme", theme === "dark");
        const themeIcon = document.querySelector('#theme-switcher i');
        if(themeIcon) themeIcon.className = `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`;
    },

    async handleSave(e, formType) {
        e.preventDefault();
        const form = e.target;
        const saveButton = form.querySelector('button[type="submit"]');
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        saveButton.disabled = true;

        let updates = { id: this.user.id, updated_at: new Date() };

        if (formType === 'profile') {
            updates.display_name = form.querySelector('#display-name').value;
            updates.bio = form.querySelector('#bio').value;
        } else if (formType === 'platforms') {
            // --- INICIO DEL CAMBIO: AÑADIMOS TODOS LOS CAMPOS AL GUARDAR ---
            updates.youtube_url = form.querySelector('#youtube-url').value;
            updates.substack_url = form.querySelector('#substack-url').value;
            updates.website_url = form.querySelector('#website-url').value;
            updates.x_url = form.querySelector('#x-url').value;
            updates.linkedin_url = form.querySelector('#linkedin-url').value;
            updates.instagram_url = form.querySelector('#instagram-url').value;
            updates.facebook_url = form.querySelector('#facebook-url').value;
            updates.tiktok_url = form.querySelector('#tiktok-url').value;
            // --- FIN DEL CAMBIO ---
        }

        const { error } = await this.supabase.from('profiles').upsert(updates);
        
        // Asumiendo que solo el formulario de perfil tiene un campo de mensaje
        if (formType === 'profile') {
            const messageEl = document.getElementById('form-message');
            if (messageEl) {
                messageEl.textContent = error ? `Error: ${error.message}` : '¡Perfil guardado!';
                messageEl.className = `form-message ${error ? 'error' : 'success'}`;
            }
        } else {
            alert(error ? `Error: ${error.message}` : '¡Plataformas guardadas!');
        }
        
        saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
        saveButton.disabled = false;
        
        if (!error) this.renderProfileData();
    },

    async handleUpdateAvatar(e) {
        e.preventDefault();
        const newUrl = document.getElementById('avatar-url').value.trim();
        
        if (!newUrl) {
            alert("Por favor, pega una URL.");
            return;
        }

        const { error } = await this.supabase
            .from('profiles')
            .update({ avatar_url: newUrl })
            .eq('id', this.user.id);
        
        if (error) {
            alert('Hubo un error al actualizar tu avatar.');
            console.error(error);
        } else {
            alert('¡Avatar actualizado con éxito!');
            this.renderProfileData(); // Refrescamos los datos para que se vea la nueva imagen
        }
    },
};

ProfileApp.init();