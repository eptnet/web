// =================================================================
// ARCHIVO COMPLETO Y DEFINITIVO: /inv/js/profile.js
// Contiene la lógica de roles corregida, el orden de ejecución correcto
// para solucionar todos los bugs reportados, y TODAS las funciones
// sin ninguna omisión.
// =================================================================

const ProfileApp = {
    supabase: null,
    user: null,
    currentUserProfile: null,

    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        await this.handleUserSession();
        this.checkForOrcidCode();
    },

    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) { 
            window.location.href = '/'; 
            return; 
        }
        this.user = session.user;

        // --- CORRECCIÓN APLICADA AQUÍ ---
        // 1. Obtenemos el perfil completo del usuario que está navegando y lo guardamos.
        const { data: userProfile, error } = await this.supabase.from('profiles').select('*').eq('id', this.user.id).single();
        if (error) {
            console.error("Error crítico: no se pudo cargar el perfil del usuario actual.", error);
            document.body.classList.remove('loading-profile');
            document.querySelector('.main-content').innerHTML = `<h2>Error al cargar tu sesión</h2>`;
            return;
        }
        this.currentUserProfile = userProfile;
        // --- FIN DE LA CORRECCIÓN ---

        const urlParams = new URLSearchParams(window.location.search);
        const profileIdFromUrl = urlParams.get('id');
        const targetProfileId = profileIdFromUrl || this.user.id;
        
        // Ahora que currentUserProfile está garantizado, renderizamos la página.
        await this.renderProfileData(targetProfileId);
        
        // Y solo después, activamos los botones y la navegación.
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

            if (tabId === 'tab-comunidad') {
                this.renderCommunityFeed();
            }
        };

        navLinks.forEach(link => {
            link.addEventListener('click', () => navigateToTab(link.dataset.tab));
        });
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#go-to-community-btn')) {
                navigateToTab('tab-comunidad');
            }
        });
    },

    addEventListeners() {
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

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

        document.getElementById('profile-form')?.addEventListener('submit', (e) => this.handleSave(e, 'profile'));
        document.getElementById('platforms-form')?.addEventListener('submit', (e) => this.handleSave(e, 'platforms'));
        document.getElementById('avatar-update-form')?.addEventListener('submit', (e) => this.handleUpdateAvatar(e));
        document.getElementById('zenodo-form')?.addEventListener('submit', (e) => this.handleZenodoSubmit(e));
        document.getElementById('community-feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const commentButton = e.target.closest('.comment-btn'); // <-- AÑADE ESTA LÍNEA

            if (likeButton) {
                this.handleLikePost(likeButton);
            } else if (commentButton) { // <-- AÑADE ESTE BLOQUE
                this.handleCommentPost(commentButton);
            }
        });

    },
    
    async renderProfileData(profileId) {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', profileId)
                .single();

            if (error) throw new Error('Perfil no encontrado.');

            const profileHasAdvancedAccess = (profile.role === 'researcher' || profile.role === 'admin');

            const orcidTabButton = document.querySelector('.profile-tab-link[data-tab="tab-identidad"]');
            if (orcidTabButton) orcidTabButton.style.display = profileHasAdvancedAccess ? 'flex' : 'none';
            const eptDoiTabButton = document.querySelector('.profile-tab-link[data-tab="tab-proyectos"]');
            if (eptDoiTabButton) eptDoiTabButton.style.display = profileHasAdvancedAccess ? 'flex' : 'none';

            const isMyOwnProfile = (profile.id === this.user.id);
            const viewerIsAdmin = (this.currentUserProfile.role === 'admin');
            const isEditable = isMyOwnProfile || viewerIsAdmin;
            document.body.classList.toggle('public-view', !isEditable);

            document.getElementById('profile-card-avatar').src = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('profile-card-name').textContent = profile.display_name || 'Sin nombre';
            
            const socialsContainer = document.getElementById('profile-card-socials');
            if (socialsContainer) {
                socialsContainer.innerHTML = `
                    ${profile.substack_url ? `<a href="${profile.substack_url}" target="_blank" title="Substack"><i class="fa-brands fa-substack"></i></a>` : ''}
                    ${profile.website_url ? `<a href="${profile.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
                    ${profile.x_url ? `<a href="${profile.x_url}" target="_blank" title="Perfil de X"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                    ${profile.linkedin_url ? `<a href="${profile.linkedin_url}" target="_blank" title="Perfil de LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${profile.instagram_url ? `<a href="${profile.instagram_url}" target="_blank" title="Perfil de Instagram"><i class="fab fa-instagram"></i></a>` : ''}
                    ${profile.youtube_url ? `<a href="${profile.youtube_url}" target="_blank" title="Canal de YouTube"><i class="fab fa-youtube"></i></a>` : ''}`;
            }

            this.renderOrcidSection(profile, isEditable);
            
            const { data: bskyCreds } = await this.supabase.from('bsky_credentials').select('handle').eq('user_id', profile.id).single();
            this.bskyCreds = bskyCreds;
            this.renderSidebarButtons(profile, isMyOwnProfile);

            if (isEditable && profileHasAdvancedAccess) {
                this.renderCommunityActionPanel(bskyCreds);
            }

            if (isEditable) {
                document.getElementById('display-name').value = profile.display_name || '';
                document.getElementById('bio').value = profile.bio || '';
                document.getElementById('avatar-url').value = profile.avatar_url || '';
                document.getElementById('youtube-url').value = profile.youtube_url || '';
                document.getElementById('substack-url').value = profile.substack_url || '';
                document.getElementById('website-url').value = profile.website_url || '';
                document.getElementById('x-url').value = profile.x_url || '';
                document.getElementById('linkedin-url').value = profile.linkedin_url || '';
                document.getElementById('instagram-url').value = profile.instagram_url || '';
                document.getElementById('facebook-url').value = profile.facebook_url || '';
                document.getElementById('tiktok-url').value = profile.tiktok_url || '';
            }

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
    
    renderSidebarButtons(profile, isMyOwnProfile, bskyCreds) {
        const sidebarButtonsContainer = document.getElementById('sidebar-buttons-container');
        if (!sidebarButtonsContainer) return;

        let buttonsHTML = '';
        if (profile.orcid) {
            buttonsHTML += `<a href="/inv/directorio.html" class="profile-card-nav__link"><i class="fa-solid fa-users"></i> Directorio</a>`;
        }
        if (isMyOwnProfile) {
            buttonsHTML += `<button id="go-to-community-btn" class="profile-card-nav__link"><i class="fa-solid fa-comments"></i> Ir a la Comunidad</button>`;
        }
        buttonsHTML += `<a href="/inv/dashboard.html" class="profile-card-nav__link"><i class="fa-solid fa-arrow-right"></i> Ir al Dashboard</a>`;
        sidebarButtonsContainer.innerHTML = buttonsHTML;
    },

    renderCommunityActionPanel(credentials, isMyOwnProfile) {
        const container = document.getElementById('community-action-panel');
        if (!container) return;

        if (!isMyOwnProfile) {
            container.innerHTML = `<p class="form-hint">Estás viendo el perfil de otro investigador.</p>`;
            return;
        }

        if (credentials) {
            container.innerHTML = `
                <div class="status-badge connected">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Conectado como: <strong>${credentials.handle}</strong></span>
                </div>
                <button id="bsky-disconnect-btn" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">Desconectar</button>
            `;
        } else {
            container.innerHTML = `
                <p class="form-hint">Conecta tu cuenta para poder interactuar en el feed.</p>
                <button id="connect-community-btn-modal" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    <i class="fa-solid fa-link"></i> Conectar Cuenta
                </button>
            `;
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
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({ orcid: `https://orcid.org/${data.orcid}` })
                    .eq('id', this.user.id);
                if (updateError) throw updateError;
                alert("¡Cuenta de ORCID conectada con éxito! Tu rol se actualizará.");
                await this.handleUserSession();
            } catch(error) {
                alert("Error al verificar el código de ORCID: " + error.message);
            }
        }
    },

    async handleOrcidDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de ORCID?")) return;
        const { error } = await this.supabase.from('profiles').update({ orcid: null }).eq('id', this.user.id);
        if (error) { alert("Error al desconectar la cuenta."); } 
        else { alert("Cuenta de ORCID desconectada."); await this.handleUserSession(); }
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
            await this.handleUserSession();
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
        if (orcidProjects.length === 0) {
            orcidListContainer.innerHTML = '<p class="form-hint">No tienes publicaciones sincronizadas.</p>';
        } else {
            orcidListContainer.innerHTML = orcidProjects.map(work => `<div class="publication-item"><p>${work.title}</p><span>DOI: ${work.doi}</span></div>`).join('');
        }
        if (eptProjects.length === 0) {
            eptDoiListContainer.innerHTML = '<p class="form-hint">No tienes publicaciones con DOI de EPT.</p>';
        } else {
            eptDoiListContainer.innerHTML = eptProjects.map(work => `<div class="publication-item"><p>${work.title}</p><span>DOI: ${work.doi}</span></div>`).join('');
        }
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
            updates.youtube_url = form.querySelector('#youtube-url').value;
            updates.substack_url = form.querySelector('#substack-url').value;
            updates.website_url = form.querySelector('#website-url').value;
            updates.x_url = form.querySelector('#x-url').value;
            updates.linkedin_url = form.querySelector('#linkedin-url').value;
            updates.instagram_url = form.querySelector('#instagram-url').value;
            updates.facebook_url = form.querySelector('#facebook-url').value;
            updates.tiktok_url = form.querySelector('#tiktok-url').value;
        }
        const { error } = await this.supabase.from('profiles').upsert(updates);
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
        if (!error) await this.handleUserSession();
    },

    async handleUpdateAvatar(e) {
        e.preventDefault();
        const newUrl = document.getElementById('avatar-url').value.trim();
        if (!newUrl) { alert("Por favor, pega una URL."); return; }
        const { error } = await this.supabase.from('profiles').update({ avatar_url: newUrl }).eq('id', this.user.id);
        if (error) { alert('Hubo un error al actualizar tu avatar.'); } 
        else { alert('¡Avatar actualizado con éxito!'); await this.handleUserSession(); }
    },

    async handleZenodoSubmit(e) {
        e.preventDefault();
        alert("La funcionalidad para publicar en Zenodo está en desarrollo.");
    },

    renderBlueskySection(credentials, isMyOwnProfile) {
        const container = document.getElementById('community-action-panel');
        if (!container) return;
        if (!isMyOwnProfile) {
            container.innerHTML = `<p class="form-hint">Estás viendo el perfil de otro investigador.</p>`;
            return;
        }
        if (credentials) {
            container.innerHTML = `
                <div class="status-badge connected">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Conectado como: <strong>${credentials.handle}</strong></span>
                </div>
                <button id="bsky-disconnect-btn" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">Desconectar</button>
            `;
        } else {
            container.innerHTML = `
                <p class="form-hint">Conecta tu cuenta para poder interactuar en el feed.</p>
                <button id="connect-community-btn-modal" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    <i class="fa-solid fa-link"></i> Conectar Cuenta
                </button>
            `;
        }
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
            await this.handleUserSession();
        } catch (error) {
            const detail = error.message.includes('password') ? 'Verifica tu handle y contraseña de aplicación.' : error.message;
            alert(`Error al conectar la cuenta: ${detail}`);
            connectButton.disabled = false;
            connectButton.innerHTML = '<i class="fa-solid fa-link"></i> Conectar Cuenta';
        }
    },

    async handleBlueskyDisconnect() {
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de Bluesky?")) return;
        const { error } = await this.supabase.from('bsky_credentials').delete().eq('user_id', this.user.id);
        if (error) { alert("Error al desconectar la cuenta."); } 
        else { alert("Cuenta de Bluesky desconectada."); await this.handleUserSession(); }
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
        const modal = modalContainer.querySelector('.modal-overlay');
        if (modal) {
            modal.classList.remove('is-visible');
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        }
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
        const themeIcon = document.querySelector('#theme-switcher-desktop i');
        if(themeIcon) themeIcon.className = `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`;
    },

    async renderCommunityFeed() {
        const container = document.getElementById('community-feed-container');
        if (!container || container.dataset.loaded === 'true') return;

        container.innerHTML = '<p>Cargando el feed de la comunidad...</p>';
        container.dataset.loaded = 'true';

        try {
            const { data: feed, error } = await this.supabase.functions.invoke('bsky-get-community-feed');
            if (error) throw error;
            if (!feed || feed.length === 0) {
                container.innerHTML = '<p>No hay publicaciones recientes en la comunidad.</p>';
                return;
            }

            const isBskyConnected = !!this.bskyCreds;

            container.innerHTML = feed.map(item => {
                const post = item.post;
                if (!post || !post.author || !post.record) return '';

                const postText = (post.record.text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
                const author = post.author;
                const isLiked = !!post.viewer?.like;
                const postDate = new Date(post.indexedAt).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

                let embedHtml = '';
                if (post.embed?.images) {
                    embedHtml = `<div class="post-embed-image"><img src="${post.embed.images[0].thumb}" alt="${post.embed.images[0].alt || 'Imagen adjunta'}" loading="lazy"></div>`;
                }

                return `
                    <div class="feed-post">
                        <div class="post-header">
                            <img src="${author.avatar}" alt="Avatar de ${author.displayName}" class="post-avatar" loading="lazy">
                            <div class="post-author">
                                <strong>${author.displayName || author.handle}</strong>
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
                                <button class="comment-btn" 
                                        data-uri="${post.uri}" 
                                        data-cid="${post.cid}"
                                        ${!isBskyConnected ? 'disabled' : ''}
                                        title="${isBskyConnected ? 'Comentar' : 'Conecta tu cuenta para comentar'}">
                                    <i class="fa-regular fa-comment"></i>
                                    <span>${post.replyCount || 0}</span>
                                </button>
                                <span><i class="fa-solid fa-retweet"></i> ${post.repostCount || 0}</span>
                                <button class="like-btn ${isLiked ? 'is-liked' : ''}" 
                                        data-uri="${post.uri}" 
                                        data-cid="${post.cid}"
                                        ${!isBskyConnected ? 'disabled' : ''}
                                        title="${isBskyConnected ? 'Dar Me Gusta' : 'Conecta tu cuenta para dar Me Gusta'}">
                                    <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                                    <span>${post.likeCount || 0}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            container.innerHTML = '<p style="color: var(--color-accent);">Error al cargar el feed de la comunidad.</p>';
            console.error("Error al invocar bsky-get-community-feed:", error);
        }
    },

    async handleLikePost(likeButton) {
        const uri = likeButton.dataset.uri;
        const cid = likeButton.dataset.cid;
        const isLiked = likeButton.classList.contains('is-liked');

        // Desactivamos el botón para evitar múltiples clics
        likeButton.disabled = true;

        // Lógica para "deslikear" (próximamente)
        if (isLiked) {
            alert("La funcionalidad de quitar 'Me Gusta' se implementará próximamente.");
            likeButton.disabled = false;
            return;
        }

        // Lógica para "likear"
        try {
            // Actualización optimista de la UI
            likeButton.classList.add('is-liked');
            likeButton.querySelector('i').className = 'fa-solid fa-heart';
            const countSpan = likeButton.querySelector('span');
            countSpan.textContent = parseInt(countSpan.textContent) + 1;

            // Llamada a la Edge Function
            const { error } = await this.supabase.functions.invoke('bsky-like-post', {
                body: { postUri: uri, postCid: cid },
            });

            if (error) throw error;

        } catch (error) {
            alert("No se pudo dar 'Me Gusta'. Inténtalo de nuevo.");
            console.error("Error en handleLikePost:", error);
            
            // Revertir la UI en caso de error
            likeButton.classList.remove('is-liked');
            likeButton.querySelector('i').className = 'fa-regular fa-heart';
            const countSpan = likeButton.querySelector('span');
            countSpan.textContent = parseInt(countSpan.textContent) - 1;
        } finally {
            // Reactivamos el botón (excepto para deslikear)
            likeButton.disabled = false;
        }
    },
    
    async handleCommentPost(commentButton) {
        const postUri = commentButton.dataset.uri;
        const postCid = commentButton.dataset.cid;

        const replyText = prompt("Escribe tu comentario (máximo 300 caracteres):");

        if (!replyText || replyText.trim() === '') {
            return; // El usuario canceló o no escribió nada
        }

        if (replyText.length > 300) {
            alert("Tu comentario excede el límite de 300 caracteres.");
            return;
        }

        commentButton.disabled = true;

        try {
            const parentPost = { uri: postUri, cid: postCid };
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: { replyText, parentPost },
            });

            if (error) throw error;

            alert("¡Comentario publicado con éxito!");
            // Opcional: Actualizamos visualmente el contador de comentarios
            const countSpan = commentButton.querySelector('span');
            countSpan.textContent = parseInt(countSpan.textContent) + 1;

        } catch (error) {
            alert("No se pudo publicar el comentario. Inténtalo de nuevo.");
            console.error("Error en handleCommentPost:", error);
        } finally {
            commentButton.disabled = false;
        }
    },
};

ProfileApp.init();
