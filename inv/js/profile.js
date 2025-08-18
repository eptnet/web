// =================================================================
// ARCHIVO DEFINITIVO Y UNIFICADO: /inv/js/profile.js
// VERSIÓN: 3.0 (Estable con todas las mejoras)
// =================================================================

const ProfileApp = {
    supabase: null,
    user: null,
    currentUserProfile: null,
    bskyCreds: null,

    async init() {
        // --- CORRECCIÓN: Unifica el cliente de Supabase ---
        this.supabase = window.supabaseClient || window.supabase.createClient(
            'https://seyknzlheaxmwztkfxmk.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E'
        );

        await this.handleUserSession();
        // --- FUNCIÓN RESTAURADA ---
        this.checkForOrcidCode();
        this.applyTheme();
    },

    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            window.location.href = '/';
            return;
        }
        this.user = session.user;

        const { data: userProfile, error } = await this.supabase.from('profiles').select('*').eq('id', this.user.id).single();
        if (error) {
            console.error("Error crítico: no se pudo cargar el perfil del usuario actual.", error);
            document.body.classList.remove('loading-profile');
            document.querySelector('.main-content').innerHTML = `<h2>Error al cargar tu sesión</h2>`;
            return;
        }
        this.currentUserProfile = userProfile;
        
        const urlParams = new URLSearchParams(window.location.search);
        const profileIdFromUrl = urlParams.get('id');
        const targetProfileId = profileIdFromUrl || this.user.id;
        
        await this.renderProfileData(targetProfileId);
        
        this.addEventListeners();
        this.setupTabNavigation();
    },

    setupTabNavigation() {
        const navLinks = document.querySelectorAll('.profile-tab-link'); 
        const tabContents = document.querySelectorAll('.profile-tab-content');

        const navigateToTab = (tabId) => {
            navLinks.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            const activeLink = document.querySelector(`.profile-tab-link[data-tab="${tabId}"]`);
            const activeContent = document.getElementById(tabId);
            if (activeLink) activeLink.classList.add('active');
            if (activeContent) activeContent.classList.add('active');
            if (tabId === 'tab-comunidad' && document.getElementById('community-feed-container').dataset.loaded !== 'true') {
                this.renderCommunityFeed();
            }
        };

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToTab(link.dataset.tab);
            });
        });
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#go-to-community-btn')) {
                navigateToTab('tab-comunidad');
            }
        });
    },
    
    // --- FUNCIÓN FUSIONADA Y CORREGIDA ---
    addEventListeners() {
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            // Lógica para el modo Ver/Editar
            if (button.classList.contains('edit-btn')) {
                const bentoBox = button.closest('.bento-box');
                this.toggleEditMode(bentoBox, true);
                return;
            }

            // Lógica para el resto de los botones
            const action = button.id;
            if (action === 'connect-orcid-btn') this.handleOrcidConnect();
            else if (action === 'disconnect-orcid-btn') this.handleOrcidDisconnect();
            else if (action === 'logout-btn-header') {
                await this.supabase.auth.signOut();
                window.location.href = '/';
            }
            else if (action === 'theme-switcher-desktop') this.toggleTheme();
            else if (action === 'sync-orcid-works-btn') this.handleSyncWorks();
            else if (action === 'bsky-disconnect-btn') this.handleBlueskyDisconnect();
            else if (action === 'connect-community-btn-modal') this.openCommunityModal();
        });

        // Listeners para los formularios
        document.getElementById('profile-form')?.addEventListener('submit', (e) => this.handleSave(e, 'profile'));
        document.getElementById('platforms-form')?.addEventListener('submit', (e) => this.handleSave(e, 'platforms'));
        document.getElementById('avatar-update-form')?.addEventListener('submit', (e) => this.handleUpdateAvatar(e));
        document.getElementById('zenodo-form')?.addEventListener('submit', (e) => this.handleZenodoSubmit(e));

        // Listener para los "Me Gusta"
        document.getElementById('community-feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            if (likeButton) this.handleLikePost(likeButton);
        });
    },

    // --- NUEVA FUNCIÓN ---
    toggleEditMode(bentoBox, isEditing) {
        const viewMode = bentoBox.querySelector('.view-mode');
        const editMode = bentoBox.querySelector('.edit-mode');

        if (viewMode && editMode) {
            viewMode.style.display = isEditing ? 'none' : 'block';
            editMode.style.display = isEditing ? 'block' : 'none';
        }
    },
    
    // --- FUNCIÓN FUSIONADA Y CORREGIDA ---
    async renderProfileData(profileId, preloadedProfile = null) {
        document.body.classList.add('loading-profile');
        try {
            const profile = preloadedProfile || (await this.supabase.from('profiles').select('*').eq('id', profileId).single()).data;
            if (!profile) throw new Error('Perfil no encontrado.');

            const { data: bskyCreds } = await this.supabase.from('bsky_credentials').select('handle').eq('user_id', profile.id).single();
            this.bskyCreds = bskyCreds;

            const isMyOwnProfile = (profile.id === this.user.id);
            const isEditable = isMyOwnProfile;
            document.body.classList.toggle('public-view', !isEditable);

            // Poblar tarjeta lateral (sidebar)
            document.getElementById('profile-card-avatar').src = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('profile-card-name').textContent = profile.display_name || 'Sin nombre';
            document.getElementById('profile-card-bio').textContent = profile.bio || '';
            
            const socialsContainer = document.getElementById('profile-card-socials');
            const substackIconSVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 3.604H1V5.495H15V3.604ZM1 7.208V16L8 12.074L15 16V7.208H1ZM15 0H1V1.89H15V0Z" fill="currentColor"/></svg>`;
            socialsContainer.innerHTML = `
                <div>
                    ${profile.substack_url ? `<a href="${profile.substack_url}" target="_blank" title="Substack">${substackIconSVG}</a>` : ''}
                    ${profile.bsky_url ? `<a href="${profile.bsky_url}" target="_blank" title="Bluesky"><i class="fa-brands fa-bluesky"></i></a>` : ''}
                    ${profile.linkedin_url ? `<a href="${profile.linkedin_url}" target="_blank" title="Perfil de LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}               
                </div>
                
                <div>
                    ${profile.website_url ? `<a href="${profile.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
                    ${profile.youtube_url ? `<a href="${profile.youtube_url}" target="_blank" title="Canal de YouTube"><i class="fab fa-youtube"></i></a>` : ''}
                    ${profile.x_url ? `<a href="${profile.x_url}" target="_blank" title="X"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                    ${profile.instagram_url ? `<a href="${profile.instagram_url}" target="_blank" title="Perfil de Instagram"><i class="fab fa-instagram"></i></a>` : ''}
                </div>
            `;

            // --- FUNCIONES RESTAURADAS ---
            this.renderOrcidSection(profile, isEditable);
            this.renderSidebarButtons(profile, isMyOwnProfile);

            // Lógica para habilitar/deshabilitar el botón de sincronización
            const syncButton = document.getElementById('sync-orcid-works-btn');
            const syncHint = document.getElementById('sync-hint');

            if (syncButton && syncHint) {
                if (profile.orcid) {
                    // Si el perfil SÍ tiene ORCID, el botón está habilitado y el mensaje oculto.
                    syncButton.disabled = false;
                    syncHint.style.display = 'none';
                } else {
                    // Si el perfil NO tiene ORCID, el botón está deshabilitado y se muestra el mensaje.
                    syncButton.disabled = true;
                    syncHint.style.display = 'block';
                }
            }

            if (isMyOwnProfile) {
                this.renderCommunityActionPanel(this.bskyCreds);
            }

            if (isEditable) {
                // Poblar MODO EDICIÓN (formularios)
                document.getElementById('display-name').value = profile.display_name || '';
                document.getElementById('bio').value = profile.bio || '';
                document.getElementById('substack-author-name').value = profile.substack_author_name || '';
                document.getElementById('avatar-url').value = profile.avatar_url || '';
                document.getElementById('youtube-url').value = profile.youtube_url || '';
                document.getElementById('substack-url').value = profile.substack_url || '';
                document.getElementById('bsky-url').value = profile.bsky_url || '';
                document.getElementById('website-url').value = profile.website_url || '';
                document.getElementById('x-url').value = profile.x_url || '';
                document.getElementById('linkedin-url').value = profile.linkedin_url || '';
                document.getElementById('instagram-url').value = profile.instagram_url || '';
                document.getElementById('facebook-url').value = profile.facebook_url || '';
                document.getElementById('tiktok-url').value = profile.tiktok_url || '';

                // Poblar MODO VISTA
                document.getElementById('view-display-name').textContent = profile.display_name || 'No establecido';
                document.getElementById('view-bio').textContent = profile.bio || 'No establecido';
                document.getElementById('view-substack-author-name').textContent = profile.substack_author_name || 'No establecido';
                
                const platformsView = document.getElementById('view-platforms-list');
                const platforms = [
                    { url: profile.youtube_url, icon: 'fa-youtube', color: '#FF0000', name: 'YouTube' },
                    { url: profile.substack_url, icon: 'fa-substack', color: '#FF6521', name: 'Substack', isSvg: true },
                    { url: profile.bsky_url, icon: 'fa-bluesky', color: '#007dff', name: 'Bluesky' },
                    { url: profile.website_url, icon: 'fa-globe', color: '#333333', name: 'Sitio Web' },
                    { url: profile.x_url, icon: 'fa-x-twitter', color: '#000000', name: 'X' },
                    { url: profile.linkedin_url, icon: 'fa-linkedin', color: '#0A66C2', name: 'LinkedIn' },
                    { url: profile.instagram_url, icon: 'fa-instagram', color: '#E4405F', name: 'Instagram' },
                    { url: profile.facebook_url, icon: 'fa-facebook', color: '#1877F2', name: 'Facebook' },
                    { url: profile.tiktok_url, icon: 'fa-tiktok', color: '#000000', name: 'TikTok' }
                ];

                const activePlatformsHTML = platforms.filter(p => p.url).map(p => {
                    const iconHTML = p.isSvg ? substackIconSVG : `<i class="${p.icon === 'fa-globe' ? 'fas' : 'fa-brands'} ${p.icon}" style="color: ${p.color};"></i>`;
                    return `<a href="${p.url}" target="_blank" class="platform-link" title="${p.name}">${iconHTML}<span>${p.url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '')}</span></a>`;
                }).join('');
                platformsView.innerHTML = activePlatformsHTML || '<p class="form-hint">No hay plataformas configuradas.</p>';
                
                this.toggleEditMode(document.getElementById('profile-form').closest('.bento-box'), false);
                this.toggleEditMode(document.getElementById('platforms-form').closest('.bento-box'), false);
            }

            const profileHasAdvancedAccess = (profile.role === 'researcher' || profile.role === 'admin');
            document.querySelector('.profile-tab-link[data-tab="tab-identidad"]').style.display = profileHasAdvancedAccess ? 'flex' : 'none';
            document.querySelector('.profile-tab-link[data-tab="tab-proyectos"]').style.display = profileHasAdvancedAccess ? 'flex' : 'none';

            if (profileHasAdvancedAccess) {
                const { data: projects } = await this.supabase.from('projects').select('*').eq('user_id', profile.id);
                if (projects) this.renderWorks(projects);
            }
        } catch (error) {
            console.error('Error en renderProfileData:', error);
        } finally {
            document.body.classList.remove('loading-profile');
        }
    },
    
    // --- FUNCIÓN MEJORADA ---
    async handleSave(e, formType) {
        e.preventDefault();
        const form = e.target;
        const saveButton = form.querySelector('button[type="submit"]');
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        saveButton.disabled = true;

        const updates = {};
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.name) {
                updates[input.name] = input.value || null;
            }
        });

        console.log('Enviando para actualizar:', updates);

        const { data: updatedProfile, error } = await this.supabase
            .from('profiles')
            .update(updates)
            .eq('id', this.user.id)
            .select()
            .single();

        if (error) {
            alert(`Error: ${error.message}`);
            console.error("Error al guardar:", error);
        } else {
            alert(`¡Datos guardados con éxito!`);
            this.currentUserProfile = updatedProfile;
            this.renderProfileData(null, updatedProfile);
            this.toggleEditMode(form.closest('.bento-box'), false);
        }

        saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
        saveButton.disabled = false;
    },

    // --- A PARTIR DE AQUÍ, SON LAS FUNCIONES DE TU ARCHIVO ESTABLE ---
    // (Asegúrate de que estas funciones estén presentes en tu archivo)
    
    renderOrcidSection(profile, isEditable) {
        const orcidSection = document.getElementById('orcid-section');
        const orcidCardText = document.getElementById('profile-card-orcid');
        if (orcidCardText) orcidCardText.textContent = profile.orcid ? profile.orcid.replace('https://orcid.org/', '') : 'ORCID no conectado';

        if (!orcidSection) return;
        if (isEditable) {
            if (profile.orcid) {
                orcidSection.innerHTML = `<div class="status-badge connected"><i class="fa-solid fa-circle-check"></i><span>Conectado: ${profile.orcid.replace('https://orcid.org/', '')}</span></div> <button id="disconnect-orcid-btn" class="btn btn-secondary" style="width: auto; margin-top: 1rem;">Desconectar</button>`;
            } else {
                orcidSection.innerHTML = `<button id="connect-orcid-btn" class="btn btn-orcid"><i class="fa-brands fa-orcid"></i> Conectar con ORCID</button>`;
            }
        } else {
            orcidSection.innerHTML = profile.orcid ? `<div class="status-badge connected"><i class="fa-solid fa-circle-check"></i> Investigador Verificado</div>` : `<div class="status-badge">Investigador no verificado</div>`;
        }
    },
    
    renderSidebarButtons(profile, isMyOwnProfile) {
        const sidebarButtonsContainer = document.getElementById('sidebar-buttons-container');
        if (!sidebarButtonsContainer) return;

        let buttonsHTML = '';
        if (profile.orcid) {
            buttonsHTML += `<a href="/inv/directorio.html" class="profile-card-nav__link"><i class="fa-solid fa-users"></i> Directorio</a>`;
        }
        if (isMyOwnProfile) {
            buttonsHTML += `<a href="/inv/comunidad.html" class="profile-card-nav__link"><i class="fa-solid fa-comments"></i> Ir a la Comunidad</a>`;
        }
        buttonsHTML += `<a href="/inv/dashboard.html" class="profile-card-nav__link"><i class="fa-solid fa-arrow-right"></i> Ir al Dashboard</a>`;
        sidebarButtonsContainer.innerHTML = buttonsHTML;
    },

    renderCommunityActionPanel(credentials) {
        const container = document.getElementById('community-action-panel');
        if (!container) return;
        if (credentials) {
            container.innerHTML = `<div class="status-badge connected"><i class="fa-solid fa-circle-check"></i><span>Conectado como: <strong>${credentials.handle}</strong></span></div><button id="bsky-disconnect-btn" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">Desconectar</button>`;
        } else {
            container.innerHTML = `<p class="form-hint">Conecta tu cuenta para poder interactuar en el feed.</p><button id="connect-community-btn-modal" class="btn btn-primary" style="width: 100%; margin-top: 1rem;"><i class="fa-solid fa-link"></i> Conectar Cuenta</button>`;
        }
    },

    handleOrcidConnect() {
        const ORCID_CLIENT_ID = 'APP-U2XLNHUBU73BN0VY';
        const redirectUri = window.location.href.split('?')[0];
        const authUrl = `https://orcid.org/oauth/authorize?client_id=${ORCID_CLIENT_ID}&response_type=code&scope=/authenticate&redirect_uri=${encodeURIComponent(redirectUri)}`;
        window.location.href = authUrl;
    },

    async checkForOrcidCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            window.history.replaceState({}, document.title, window.location.pathname);
            alert("Verificando código de ORCID...");
            try {
                const { data, error } = await this.supabase.functions.invoke('verificar-orcid-code', {
                    body: { authorization_code: code, redirect_uri: window.location.origin + window.location.pathname },
                });
                if (error) throw error;

                // --- AQUÍ ESTÁ LA CORRECCIÓN ---
                // Añadimos 'role: 'researcher'' al objeto que se actualiza en la base de datos.
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({ 
                        orcid: `https://orcid.org/${data.orcid}`,
                        role: 'researcher' // <-- LÍNEA AÑADIDA
                    })
                    .eq('id', this.user.id);
                // --- FIN DE LA CORRECCIÓN ---

                if (updateError) throw updateError;
                
                alert("¡Cuenta de ORCID conectada con éxito! Tu rol ha sido actualizado a Investigador.");
                location.reload();
                
            } catch(error) {
                alert("Error al verificar el código de ORCID: " + error.message);
            }
        }
    },

    async handleOrcidDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de ORCID?")) return;
        const { error } = await this.supabase.from('profiles').update({ orcid: null }).eq('id', this.user.id);
        if (error) { alert("Error al desconectar la cuenta."); } 
        else { alert("Cuenta de ORCID desconectada."); location.reload(); }
    },

    async handleSyncWorks() {
        const syncButton = document.getElementById('sync-orcid-works-btn');
        if (!syncButton) return;
        syncButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
        syncButton.disabled = true;
        try {
            const { data: profile } = await this.supabase.from('profiles').select('orcid').eq('id', this.user.id).single();
            if (!profile?.orcid) throw new Error("No hay un ORCID iD conectado.");
            const orcidId = profile.orcid.replace('https://orcid.org/', '');
            const { data, error: functionError } = await this.supabase.functions.invoke('get-orcid-works', { body: { orcid_id: orcidId } });
            if (functionError) throw functionError;
            if (data.works && data.works.length > 0) {
                const projectsToSave = data.works.map(work => ({ user_id: this.user.id, doi: work.doi, title: work.title, authors: work.authors || [], publication_year: work.year || null, description: work.description || null }));
                const { error: saveError } = await this.supabase.from('projects').upsert(projectsToSave, { onConflict: 'doi, user_id' });
                if (saveError) throw saveError;
            }
            alert(`Sincronización completada. Se encontraron y guardaron ${data.works.length} publicaciones.`);
            location.reload();
        } catch (error) {
            alert("Error al sincronizar las publicaciones: " + error.message);
        } finally {
            syncButton.innerHTML = '<i class="fa-solid fa-sync"></i> Sincronizar desde ORCID';
            syncButton.disabled = false;
        }
    },

    renderWorks(works) {
        const orcidListContainer = document.getElementById('projects-list');
        const eptDoiListContainer = document.getElementById('ept-doi-list');
        if (!orcidListContainer || !eptDoiListContainer) return;
        const orcidProjects = works.filter(work => !work.created_via_platform);
        const eptProjects = works.filter(work => work.created_via_platform);
        orcidListContainer.innerHTML = orcidProjects.length > 0
            ? orcidProjects.map(work => `<div class="publication-item"><p>${work.title}</p><span>DOI: ${work.doi}</span></div>`).join('')
            : '<p class="form-hint">No tienes publicaciones sincronizadas.</p>';
        eptDoiListContainer.innerHTML = eptProjects.length > 0
            ? eptProjects.map(work => `<div class="publication-item"><p>${work.title}</p><span>DOI: ${work.doi}</span></div>`).join('')
            : '<p class="form-hint">No tienes publicaciones con DOI de EPT.</p>';
    },
    
    async handleUpdateAvatar(e) {
        e.preventDefault();
        const newUrl = document.getElementById('avatar-url').value.trim();
        if (!newUrl) { alert("Por favor, pega una URL."); return; }
        const { error } = await this.supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', this.user.id);
        if (error) { alert('Hubo un error al actualizar tu avatar.'); } 
        else { alert('¡Avatar actualizado con éxito!'); location.reload(); }
    },

    async handleZenodoSubmit(e) {
        e.preventDefault();
        alert("La funcionalidad para publicar en Zenodo está en desarrollo.");
    },

    async handleBlueskyConnect(e) {
        e.preventDefault();
        const form = e.target;
        const connectButton = form.querySelector('button[type="submit"]');
        const handle = form.querySelector('#bsky-handle').value;
        const appPassword = form.querySelector('#bsky-app-password').value;
        connectButton.disabled = true;
        connectButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-auth', { body: { handle, appPassword } });
            if (error) throw new Error(error.message || 'Error desconocido.');
            alert(data.message);
            this.closeCommunityModal();
            location.reload();
        } catch (error) {
            const detail = error.message.includes('password') ? 'Verifica tu handle y contraseña de aplicación.' : error.message;
            alert(`Error al conectar la cuenta: ${detail}`);
        } finally {
            connectButton.disabled = false;
            connectButton.innerHTML = '<i class="fa-solid fa-link"></i> Conectar Cuenta';
        }
    },

    async handleBlueskyDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de Bluesky?")) return;
        const { error } = await this.supabase.from('bsky_credentials').delete().eq('user_id', this.user.id);
        if (error) { alert("Error al desconectar la cuenta."); } 
        else { alert("Cuenta de Bluesky desconectada."); location.reload(); }
    },

    openCommunityModal() {
        const template = document.getElementById('bsky-connect-template');
        if (!template) return;
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        
        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));
        
        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeCommunityModal());
        modalContainer.querySelector('#bsky-connect-form').addEventListener('submit', (e) => this.handleBlueskyConnect(e));
    },

    closeCommunityModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        const modal = modalContainer.querySelector('.modal-overlay');
        if (modal) {
            modal.classList.add('fade-out');
            modal.addEventListener('animationend', () => {
                modalContainer.innerHTML = '';
            }, { once: true });
        }
    },
    
    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        this.applyTheme();
    },

    applyTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle("dark-theme", theme === "dark");
        document.querySelectorAll('.theme-switcher i, #theme-switcher-mobile i').forEach(icon => {
            icon.className = `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`;
        });
    },

    async renderCommunityFeed() {
        const container = document.getElementById('community-feed-container');
        if (!container || container.dataset.loaded === 'true') return;

        container.innerHTML = '<p>Cargando el feed de la comunidad...</p>';
        
        try {
            const { data: feed, error } = await this.supabase.functions.invoke('bsky-get-community-feed');
            if (error) throw error;
            if (!feed || feed.length === 0) {
                container.innerHTML = '<p>No hay publicaciones recientes en la comunidad.</p>';
                return;
            }
            container.dataset.loaded = 'true'; // Marcar como cargado solo si hay éxito
            
            const isBskyConnected = !!this.bskyCreds;

            container.innerHTML = feed.map(item => {
                const post = item.post;
                if (!post || !post.author || !post.record) return '';

                const postText = (post.record.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
                const author = post.author;
                const isLiked = !!post.viewer?.like;
                const postDate = new Date(post.indexedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

                let embedHtml = '';
                if (post.embed?.images) {
                    embedHtml = `<div class="post-embed-image"><img src="${post.embed.images[0].thumb}" alt="${post.embed.images[0].alt || 'Imagen adjunta'}" loading="lazy"></div>`;
                }

                return `
                    <article class="feed-post" aria-labelledby="post-author-${post.cid}">
                        <div class="post-header">
                            <img src="${author.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar de ${author.displayName}" class="post-avatar" loading="lazy">
                            <div class="post-author">
                                <strong id="post-author-${post.cid}">${author.displayName || author.handle}</strong>
                                <span class="post-handle">@${author.handle}</span>
                            </div>
                        </div>
                        <div class="post-body">
                            <p>${postText}</p>
                            ${embedHtml}
                        </div>
                        <div class="post-footer">
                            <span class="post-date">${postDate}</span>
                            <div class="post-stats">
                                <span class="comment-stat" title="Para comentar, visita la página de la Comunidad">
                                    <i class="fa-regular fa-comment"></i>
                                    <span>${post.replyCount || 0}</span>
                                </span>
                                <span><i class="fa-solid fa-retweet"></i> ${post.repostCount || 0}</span>
                                <button class="like-btn ${isLiked ? 'is-liked' : ''}" 
                                        data-uri="${post.uri}" 
                                        data-cid="${post.cid}"
                                        ${!isBskyConnected ? 'disabled' : ''}
                                        title="${isBskyConnected ? 'Dar Me Gusta' : 'Conecta tu cuenta para dar Me Gusta'}"
                                        aria-pressed="${isLiked}">
                                    <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                                    <span>${post.likeCount || 0}</span>
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');

        } catch (error) {
            container.innerHTML = '<p style="color: var(--color-accent);">Error al cargar el feed de la comunidad.</p>';
            console.error("Error al invocar bsky-get-community-feed:", error);
        }
    },

    async handleLikePost(likeButton) {
        if (likeButton.disabled) return;
        const uri = likeButton.dataset.uri;
        const cid = likeButton.dataset.cid;
        const isLiked = likeButton.classList.contains('is-liked');

        likeButton.disabled = true;

        if (isLiked) {
            // La funcionalidad de "deslikear" no está implementada aún.
            // Para mantener la estabilidad, simplemente informamos y reactivamos el botón.
            alert("La funcionalidad de quitar 'Me Gusta' aún no está disponible aquí.");
            likeButton.disabled = false;
            return;
        }

        // --- Lógica para "likear" ---
        const countSpan = likeButton.querySelector('span');
        const originalCount = parseInt(countSpan.textContent);
        
        // Actualización optimista de la UI
        likeButton.classList.add('is-liked');
        likeButton.querySelector('i').className = 'fa-solid fa-heart';
        likeButton.setAttribute('aria-pressed', 'true');
        countSpan.textContent = originalCount + 1;

        try {
            const { error } = await this.supabase.functions.invoke('bsky-like-post', {
                body: { postUri: uri, postCid: cid },
            });

            if (error) throw error;
            // Si la llamada es exitosa, la UI ya está actualizada. No hacemos nada.

        } catch (error) {
            alert("No se pudo dar 'Me Gusta'. Por favor, inténtalo de nuevo.");
            console.error("Error en handleLikePost:", error);
            
            // Revertir la UI en caso de error
            likeButton.classList.remove('is-liked');
            likeButton.querySelector('i').className = 'fa-regular fa-heart';
            likeButton.setAttribute('aria-pressed', 'false');
            countSpan.textContent = originalCount;
        } finally {
            likeButton.disabled = false;
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    ProfileApp.init();
});