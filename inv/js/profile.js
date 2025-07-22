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

        // Al cargar la página, revisamos si venimos de la redirección de ORCID
        this.checkForOrcidCode();
    },

    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { window.location.href = '/'; return; }
        this.user = session.user;
        this.renderProfileData();
    },

    addEventListeners() {
        document.body.addEventListener('click', async (e) => { // <-- Añadimos async aquí
            const target = e.target.closest('button');
            if (!target) return;

            const action = target.id;
            if (action === 'connect-orcid-btn') this.handleOrcidConnect();
            else if (action === 'disconnect-orcid-btn') this.handleOrcidDisconnect();
            else if (action === 'logout-btn-header') {
                // --- INICIO DE LA CORRECCIÓN ---
                await this.supabase.auth.signOut();
                window.location.href = '/'; // Redirige al inicio después de salir
                // --- FIN DE LA CORRECCIÓN ---
            }
            else if (action === 'theme-switcher') this.toggleTheme();
            else if (action === 'sync-orcid-works-btn') this.handleSyncWorks();
        });

        document.getElementById('profile-form')?.addEventListener('submit', (e) => this.handleSave(e, 'profile'));
        document.getElementById('platforms-form')?.addEventListener('submit', (e) => this.handleSave(e, 'platforms'));
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

    async renderProfileData() {
        if (!this.user) return;
        this.renderTopBar();

        // 1. Hacemos una consulta simple y segura solo para los datos del perfil
        const { data: profile, error } = await this.supabase
            .from('profiles')
            .select('*') // Quitamos el join complejo a 'projects' para asegurar que esto funcione
            .eq('id', this.user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error cargando el perfil principal:', error);
            alert("No se pudo cargar tu perfil.");
            return;
        }

        if (profile) {
            // 2. Poblamos toda la información del perfil como antes
            document.getElementById('profile-card-avatar').src = profile.avatar_url || this.user.user_metadata?.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
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
                .eq('user_id', this.user.id);
            
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
    },

    // Se activa al hacer clic en "Sincronizar desde ORCID"
    async handleSyncWorks() {
        const syncButton = document.getElementById('sync-orcid-works-btn');
        if (!syncButton) return;

        syncButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
        syncButton.disabled = true;

        try {
            const { data: profile } = await this.supabase.from('profiles').select('orcid').eq('id', this.user.id).single();
            if (!profile?.orcid) throw new Error("No hay un ORCID iD conectado.");

            const orcidId = profile.orcid.replace('https://orcid.org/', '');

            const { data, error } = await this.supabase.functions.invoke('get-orcid-works', {
                body: { orcid_id: orcidId },
            });

            if (error) throw error;
            
            // --- INICIO DE LA LÓGICA PARA GUARDAR ---
            if (data.works && data.works.length > 0) {
                // Preparamos los datos para guardarlos en la tabla 'projects'
                const projectsToSave = data.works.map(work => ({
                    user_id: this.user.id,
                    doi: work.doi,
                    title: work.title,
                    // Asegúrate de que tu tabla 'projects' tenga estas columnas
                    authors: work.authors || [], 
                    publication_year: work.year || null
                }));

                // Usamos upsert para insertar nuevos y actualizar existentes (basado en el DOI)
                const { error: saveError } = await this.supabase
                    .from('projects')
                    .upsert(projectsToSave, { onConflict: 'doi, user_id' });

                if (saveError) throw saveError;
            }
            
            alert(`Sincronización completada. Se encontraron ${data.works.length} publicaciones.`);
            
            // Refrescamos toda la información del perfil para mostrar los proyectos guardados
            this.renderProfileData();
            // --- FIN DE LA LÓGICA PARA GUARDAR ---

        } catch (error) {
            alert("Error al sincronizar las publicaciones: " + error.message);
        } finally {
            syncButton.innerHTML = '<i class="fa-solid fa-sync"></i> Sincronizar desde ORCID';
            syncButton.disabled = false;
        }
    },

    // Dibuja la lista de trabajos en el HTML
    renderWorks(works) {
        const listContainer = document.getElementById('projects-list');
        if (!listContainer) return;

        if (!works || works.length === 0) {
            listContainer.innerHTML = '<p>No se encontraron publicaciones con DOI en tu perfil de ORCID.</p>';
            return;
        }

        listContainer.innerHTML = works.map(work => `
            <div class="publication-item">
                <p>${work.title}</p>
                <span>DOI: ${work.doi}</span>
            </div>
        `).join('');
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
            <div class="top-bar__left"><a href="/" class="top-bar__logo"><img src="https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png" alt="Logo"></a></div>
            <div class="top-bar__right">
                <button class="top-bar-btn" id="theme-switcher" title="Cambiar tema"><i class="fa-solid fa-moon"></i></button>
                <button class="top-bar-btn" id="logout-btn-header" title="Cerrar Sesión"><i class="fa-solid fa-right-from-bracket"></i></button>
                <a href="#" id="user-avatar-header" title="Mi Perfil"><img src="${avatarUrl}" alt="Avatar"></a>
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
};

ProfileApp.init();