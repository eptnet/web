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
        this.supabase = window.supabaseClient || window.supabase.createClient(
            'https://seyknzlheaxmwztkfxmk.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E'
        );

        await this.handleUserSession();
        
        // Revisamos si venimos de alguna validación
        this.checkForOrcidCode();
        this.checkForBlueskyCallback(); 
        
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
        // --- this.checkOnboarding(userProfile); ---
        this.checkSupportBanner();
        this.renderGamification(userProfile);
        this.loadManagementData(this.user.id);
        
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

            if (tabId === 'tab-invitados') {
                this.renderInvitationsList();
            } else if (tabId === 'tab-identidad') { // Si se hace clic en ID Académico
                this.loadAndRenderWorks(); // Cargamos y dibujamos los trabajos
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

            const themeSwitcherDesktop = document.getElementById('theme-switcher-desktop');
            themeSwitcherDesktop?.addEventListener('click', () => this.toggleTheme());

            // También preparamos el del menú móvil para consistencia
            const themeSwitcherMobile = document.getElementById('theme-switcher-mobile');
            themeSwitcherMobile?.addEventListener('click', () => this.toggleTheme());
        });

        // Listeners para los formularios
        document.getElementById('profile-form')?.addEventListener('submit', (e) => this.handleSave(e, 'profile'));
        document.getElementById('platforms-form')?.addEventListener('submit', (e) => this.handleSave(e, 'platforms'));
        document.getElementById('avatar-update-form')?.addEventListener('submit', (e) => this.handleUpdateAvatar(e));
        document.getElementById('zenodo-form')?.addEventListener('submit', (e) => this.handleZenodoSubmit(e));
        document.getElementById('invite-form')?.addEventListener('submit', (e) => this.handleInviteSubmit(e));

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

            // Buscamos las credenciales para este perfil específico
            const { data: bskyCreds, error: bskyError } = await this.supabase
                .from('bsky_credentials')
                .select('handle, did')
                .eq('user_id', profile.id)
                .maybeSingle();

            this.bskyCreds = bskyCreds;

            // Verificación binaria: Si hay handle y DID, el investigador está verificado
            const hasBsky = !!(this.bskyCreds && this.bskyCreds.did);

            this.checkOnboarding(profile, this.bskyCreds);

            const isMyOwnProfile = (profile.id === this.user.id);
            const isEditable = isMyOwnProfile;
            document.body.classList.toggle('public-view', !isEditable);

            // Poblar tarjeta lateral (sidebar)
            document.getElementById('profile-card-avatar').src = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('profile-card-bio').textContent = profile.bio || '';

            // --- LÓGICA DE GAMIFICACIÓN E INSIGNIAS ---
            const hasOrcid = profile.orcid && profile.orcid !== '0000';

            // 1. Encendemos las insignias correspondientes
            const badgeCitizen = document.getElementById('badge-citizen');
            const badgeSocial = document.getElementById('badge-social');
            const badgeAcademic = document.getElementById('badge-academic');

            if (badgeCitizen) badgeCitizen.classList.add('active-citizen'); // Siempre activo si está registrado
            
            if (hasBsky && badgeSocial) {
                badgeSocial.classList.add('active-social');
            } else if (badgeSocial) {
                badgeSocial.classList.remove('active-social');
            }

            if (hasOrcid && badgeAcademic) {
                badgeAcademic.classList.add('active-academic');
            } else if (badgeAcademic) {
                badgeAcademic.classList.remove('active-academic');
            }

            // 2. El Check de Creador PRO (Solo si tiene ORCID + Bluesky)
            const isProCreator = hasOrcid && hasBsky;
            const nameEl = document.getElementById('profile-card-name');
            if (nameEl) {
                const safeName = profile.display_name || 'Sin nombre';
                // Usamos innerHTML para poder inyectar el icono si es PRO
                nameEl.innerHTML = `${safeName} ${isProCreator ? '<i class="fa-solid fa-circle-check verified-check" title="Divulgador Verificado"></i>' : ''}`;
            }
            // --- FIN DE LÓGICA DE GAMIFICACIÓN ---
            
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
                document.getElementById('zenodo-authors').value = profile.display_name || '';
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

        // --- INICIO: LÓGICA DEL LINKTREE PÚBLICO ---
        if (isEditable) {
            const publicLinkText = document.getElementById('my-public-link-text');
            const btnCopy = document.getElementById('btn-copy-link');
            const btnVisit = document.getElementById('btn-visit-link');

            if (publicLinkText && btnCopy && btnVisit) {
                // 1. Construir la URL
                // Si no tiene username, usamos el ID como fallback temporal, pero idealmente debe tener username
                const username = profile.username || `?id=${profile.id}`; 
                const fullUrl = `https://epistecnologia.com/@${profile.username || 'usuario'}`; // Ajusta el dominio si estás en local
                const displayUrl = `epistecnologia.com/@${profile.username || 'usuario'}`;

                // 2. Pintar en el HTML
                publicLinkText.textContent = displayUrl;
                btnVisit.href = fullUrl;

                // 3. Lógica del Botón Copiar
                // Clonamos el botón para eliminar listeners anteriores si se vuelve a renderizar
                const newBtnCopy = btnCopy.cloneNode(true);
                btnCopy.parentNode.replaceChild(newBtnCopy, btnCopy);

                newBtnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(fullUrl).then(() => {
                        // Feedback Visual
                        const originalHTML = newBtnCopy.innerHTML;
                        newBtnCopy.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
                        newBtnCopy.classList.add('btn-success'); // Opcional: añade clase verde si tienes
                        
                        setTimeout(() => {
                            newBtnCopy.innerHTML = originalHTML;
                            newBtnCopy.classList.remove('btn-success');
                        }, 2000);
                    }).catch(err => {
                        console.error('Error al copiar:', err);
                        alert('No se pudo copiar el enlace.');
                    });
                });
            }
        }
        // --- FIN LÓGICA LINKTREE ---
            
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

    async handleInviteSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const emailInput = document.getElementById('invitee-email');
        const inviteeEmail = emailInput.value.trim();
        const saveButton = form.querySelector('button[type="submit"]');

        if (!inviteeEmail) {
            alert("Por favor, introduce un correo electrónico.");
            return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

        try {
            // En el próximo paso crearemos esta Edge Function
            const { data, error } = await this.supabase.functions.invoke('send-invitation', {
                body: { email: inviteeEmail },
            });

            if (error) throw error;

            alert(data.message);
            emailInput.value = ''; // Limpiamos el campo
            this.renderInvitationsList(); // Refrescamos la lista de invitaciones

        } catch (error) {
            alert(`Error al enviar la invitación: ${error.message}`);
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Invitación';
        }
    },

    async renderInvitationsList() {
        const container = document.getElementById('invitations-list');
        if (!container) return;

        container.dataset.loaded = 'true'; // Marcamos que ya intentamos cargar
        container.innerHTML = '<p class="loading-message">Cargando tus invitaciones...</p>';

        try {
            const { data: invitations, error } = await this.supabase
                .from('invitations')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;

            if (invitations.length === 0) {
                container.innerHTML = '<p class="form-hint">Aún no has enviado ninguna invitación.</p>';
                return;
            }

            container.innerHTML = invitations.map(inv => `
                <div class="invitation-item status-${inv.status}">
                    <span class="invitee-email">${inv.invitee_email}</span>
                    <span class="invitation-status">${inv.status}</span>
                </div>
            `).join('');

        } catch (error) {
            container.innerHTML = '<p class="form-hint" style="color: var(--color-accent);">No se pudieron cargar las invitaciones.</p>';
        }
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

        // --- INICIO: NUEVO BOTÓN DESTACADO AL CAMPUS ---
        if (isMyOwnProfile) {
            buttonsHTML += `
                <a href="/edu/" class="profile-card-nav__link" style="background: rgba(183, 42, 30, 0.1); border-color: var(--color-accent); color: var(--color-accent);">
                    <i class="fa-solid fa-graduation-cap"></i> Ir al Campus (Cursos)
                </a>
            `;
        }
        // --- FIN ---

        // --- Botones de Navegación (como antes) ---
        if (profile.orcid) {
            buttonsHTML += `<a href="/inv/directorio.html" class="profile-card-nav__link"><i class="fa-solid fa-users"></i> Directorio</a>`;
        }
        if (isMyOwnProfile) {
            buttonsHTML += `<a href="/comunidad.html" class="profile-card-nav__link"><i class="fa-solid fa-comments"></i> Ir a la Comunidad</a>`;
        }
        buttonsHTML += `<a href="/inv/dashboard.html" class="profile-card-nav__link"><i class="fa-solid fa-arrow-right"></i> Ir al Dashboard</a>`;

        // --- INICIO: NUEVO BOTÓN DE APOYO A LA PLATAFORMA ---
        buttonsHTML += `
            <a href="https://www.paypal.com/ncp/payment/AVNL8CGY5A2FL" target="_blank" rel="noopener noreferrer" class="profile-card-nav__link support-btn">
                <i class="fa-solid fa-heart"></i> Apoyar la Plataforma
            </a>
        `;
        // --- FIN ---
        
        // --- LÓGICA DE CONEXIÓN A BLUESKY AÑADIDA AQUÍ ---
        if (isMyOwnProfile) {

            // Comprobamos si el usuario ya conectó su cuenta (usando la variable this.bskyCreds que ya cargamos)
            if (this.bskyCreds) {
                // Si está conectado, mostramos un estado de conexión y el botón de desconectar
                buttonsHTML += `
                    <div class="status-badge connected" style="text-align: left; padding: 0.5rem 0;">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>Conectado como: <strong>${this.bskyCreds.handle}</strong></span>
                    </div>
                    <button id="bsky-disconnect-btn" class="btn btn-secondary">Desconectar Cuenta</button>
                `;
            } else {
                // Si no está conectado, mostramos el botón de conectar
                buttonsHTML += `
                    <button id="connect-community-btn-modal" class="btn btn-primary">
                        <i class="fa-solid fa-link"></i> Conectar Cuenta (Bluesky)
                    </button>
                `;
            }
        }

        sidebarButtonsContainer.innerHTML = buttonsHTML;
    },

    renderCommunityActionPanel(credentials) {
        const container = document.getElementById('community-action-panel');
        if (!container) return;

        // Ahora este panel solo muestra un mensaje de ayuda.
        container.innerHTML = `
            <p class="form-hint">
                La interacción con el feed de la comunidad (dar "Me Gusta", comentar, etc.) 
                requiere una cuenta de Bluesky conectada.
            </p>
            <p class="form-hint" style="margin-top: 1rem;">
                Puedes conectar o desconectar tu cuenta desde la tarjeta de tu perfil.
            </p>
        `;
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
        const state = urlParams.get('state'); // Bluesky usa 'state', ORCID no.

        // SOLO se ejecuta si hay 'code' pero NO hay 'state' (Es decir, es de ORCID)
        if (code && !state) {
            window.history.replaceState({}, document.title, window.location.pathname);
            alert("Verificando código de ORCID...");
            try {
                const { data, error } = await this.supabase.functions.invoke('verificar-orcid-code', {
                    body: { authorization_code: code, redirect_uri: window.location.origin + window.location.pathname },
                });
                if (error) throw error;

                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({ 
                        orcid: `https://orcid.org/${data.orcid}`,
                        role: 'researcher'
                    })
                    .eq('id', this.user.id);

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
            const { data: existingProjects, error: existingError } = await this.supabase
                .from('projects')
                .select('doi, created_via_platform')
                .eq('user_id', this.user.id);
            if (existingError) throw existingError;

            const platformCreatedMap = new Map();
            existingProjects
                .filter(p => p.created_via_platform)
                .forEach(p => platformCreatedMap.set(p.doi, true));
                
            const { data: profile } = await this.supabase.from('profiles').select('orcid').eq('id', this.user.id).single();
            if (!profile?.orcid) throw new Error("No hay un ORCID iD conectado.");
            
            const orcidId = profile.orcid.replace('https://orcid.org/', '');
            const { data, error: functionError } = await this.supabase.functions.invoke('get-orcid-works', { body: { orcid_id: orcidId } });
            if (functionError) throw functionError;

            if (data.works && data.works.length > 0) {
                const projectsToSave = data.works.map(work => {
                    const isPlatformCreated = platformCreatedMap.has(work.doi);
                    return {
                        user_id: this.user.id,
                        doi: work.doi,
                        title: work.title,
                        authors: work.authors || [],
                        publication_year: work.year || null,
                        description: work.description || null,
                        created_via_platform: isPlatformCreated
                    };
                });

                // --- CAMBIO CLAVE: Añadimos .select() para obtener los datos frescos ---
                const { data: updatedProjects, error: saveError } = await this.supabase
                    .from('projects')
                    .upsert(projectsToSave, { onConflict: 'doi, user_id' })
                    .select(); // Le pedimos a Supabase que nos devuelva los datos actualizados

                if (saveError) throw saveError;
                
                // --- LÓGICA MEJORADA: Actualizamos la UI sin recargar la página ---
                alert(`Sincronización completada. Se encontraron y guardaron ${data.works?.length || 0} publicaciones.`);
                this.userWorks = null; // Forzamos a que se recarguen los datos en la siguiente llamada
                await this.loadAndRenderWorks(); // Volvemos a cargar y dibujar la lista

            } else {
                alert(`Sincronización completada. No se encontraron nuevas publicaciones en ORCID.`);
            }

        } catch (error) {
            alert("Error al sincronizar las publicaciones: " + error.message);
        } finally {
            syncButton.innerHTML = '<i class="fa-solid fa-sync"></i> Sincronizar desde ORCID';
            syncButton.disabled = false;
        }
    },

    async loadAndRenderWorks() {
        // Verificamos si ya hemos cargado los datos para no volver a pedirlos
        if (this.userWorks) {
            this.renderWorks(this.userWorks);
            return;
        }

        try {
            const { data: projects, error } = await this.supabase
                .from('projects')
                .select('*')
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            
            this.userWorks = projects || []; // Guardamos los proyectos en memoria
            this.renderWorks(this.userWorks);
        } catch (error) {
            console.error("Error al cargar los proyectos del usuario:", error);
            document.getElementById('projects-list').innerHTML = '<p class="form-hint" style="color: var(--color-accent);">No se pudieron cargar los proyectos.</p>';
        }
    },

    renderWorks(works) {
        const orcidListContainer = document.getElementById('projects-list');
        const eptDoiListContainer = document.getElementById('ept-doi-list');
        
        if (!orcidListContainer || !eptDoiListContainer) {
            console.warn("No se encontraron los contenedores para la lista de proyectos.");
            return;
        }

        const orcidProjects = works.filter(work => !work.created_via_platform);
        const eptProjects = works.filter(work => work.created_via_platform);

        orcidListContainer.innerHTML = orcidProjects.length > 0
            ? orcidProjects.map(work => `
                <div class="publication-item">
                    <p>${work.title}</p>
                    <span>DOI: ${work.doi}</span>
                </div>
            `).join('')
            : '<p class="form-hint">No tienes publicaciones sincronizadas desde ORCID.</p>';
            
        eptDoiListContainer.innerHTML = eptProjects.length > 0
            ? eptProjects.map(work => `
                <div class="publication-item">
                    <p>${work.title}</p>
                    <span>DOI: ${work.doi}</span>
                </div>
            `).join('')
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
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const messageEl = document.getElementById('zenodo-message');

        messageEl.textContent = 'Iniciando proceso...';
        messageEl.style.color = 'var(--color-secondary)';
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        try {
            const file = document.getElementById('zenodo-file').files[0];
            if (!file) throw new Error("Por favor, selecciona un archivo para publicar.");

            // --- INICIO DE LA NUEVA VALIDACIÓN DE TAMAÑO ---
            const fileSizeLimit = 50 * 1024 * 1024; // 50 MB en bytes
            if (file.size > fileSizeLimit) {
                throw new Error(`El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). El límite es 50 MB.`);
            }
            // --- FIN DE LA NUEVA VALIDACIÓN DE TAMAÑO ---

            // --- PASO 1: Subir el archivo a Supabase Storage ---
            messageEl.textContent = 'Paso 1/3: Subiendo archivo al almacenamiento seguro...';
            const fileExt = file.name.split('.').pop();
            const filePath = `${this.user.id}/${Date.now()}.${fileExt}`; // Creamos una ruta única

            const { error: uploadError } = await this.supabase.storage
                .from('zenodo-uploads') // Usamos un bucket dedicado
                .upload(filePath, file);

            if (uploadError) throw new Error(`Error al subir el archivo: ${uploadError.message}`);

            // --- PASO 2: Recolectar todos los metadatos del formulario ---
            messageEl.textContent = 'Paso 2/3: Recopilando metadatos...';
            const metadata = {
                title: document.getElementById('zenodo-title').value,
                authors: document.getElementById('zenodo-authors').value.split('\n').map(name => name.trim()).filter(Boolean),
                affiliations: document.getElementById('zenodo-affiliations').value,
                description: document.getElementById('zenodo-description').value,
                keywords: document.getElementById('zenodo-keywords').value.split(',').map(kw => kw.trim()).filter(Boolean),
                relatedLink: document.getElementById('zenodo-related-link').value,
                license: document.getElementById('zenodo-license').value
            };

            // --- PASO 3: Invocar la Función Edge con la información ---
            messageEl.textContent = 'Paso 3/3: Publicando en Zenodo y obteniendo DOI...';
            const { data, error: functionError } = await this.supabase.functions.invoke('create-zenodo-doi', {
                body: { filePath, metadata },
            });

            if (functionError) throw functionError;
            
            messageEl.textContent = `¡Éxito! Tu publicación tiene el DOI: ${data.doi}`;
            messageEl.style.color = '#28a745';
            form.reset(); // Limpiamos el formulario

        } catch (error) {
            messageEl.textContent = `Error: ${error.message}`;
            messageEl.style.color = 'var(--color-accent)';
            console.error("Error en el envío a Zenodo:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Publicar y Obtener DOI';
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
        if (!confirm("¿Estás seguro de que quieres desconectar tu cuenta de Bluesky? Perderás los 70 XP de verificación.")) return;
        
        // 1. Eliminamos credenciales
        const { error } = await this.supabase.from('bsky_credentials').delete().eq('user_id', this.user.id);
        
        if (!error) { 
            // 2. PENALIDAD: Le restamos los 70 XP al perfil
            const { data: profile } = await this.supabase.from('profiles').select('xp_total').eq('id', this.user.id).single();
            let newXp = (profile?.xp_total || 0) - 70;
            if (newXp < 30) newXp = 30; // Nunca lo bajamos de 30 (Misión 1 de registro)
            
            await this.supabase.from('profiles').update({ xp_total: newXp }).eq('id', this.user.id);
            
            alert("Cuenta de Bluesky desconectada. Se han restado 70 XP por seguridad."); 
            location.reload(); 
        } else {
            alert("Error al desconectar la cuenta."); 
        }
    },

    async checkForBlueskyCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
            window.history.replaceState({}, document.title, window.location.pathname);
            if (window.showToast) window.showToast("⏳ Finalizando conexión con Bluesky...");

            try {
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-callback', {
                    body: { code: code, state: state, redirect_uri: window.location.origin + window.location.pathname }
                });
                if (error) throw error;

                // 3. RECOMPENSA: Sumamos exactamente 70 XP al conectar
                const { data: profile } = await this.supabase.from('profiles').select('xp_total').eq('id', this.user.id).single();
                const newXp = (profile?.xp_total || 0) + 70;
                await this.supabase.from('profiles').update({ xp_total: newXp }).eq('id', this.user.id);

                alert(`✅ ¡Cuenta conectada! Has recuperado +70 XP. Bienvenido, @${data.handle}`);
                location.reload(); 

            } catch (error) {
                console.error("Error en el callback de Bluesky:", error);
                alert("❌ Hubo un problema al guardar tu cuenta de Bluesky. Intenta de nuevo.");
            }
        }
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
        
        // --- CAMBIO AQUÍ: Escuchamos el botón de OAuth en lugar del formulario viejo ---
        const oauthBtn = modalContainer.querySelector('#bsky-oauth-start-btn');
        if (oauthBtn) {
            oauthBtn.addEventListener('click', () => this.handleBlueskyOAuthStart());
        }
    },

    closeCommunityModal() {
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) return;
        
        const modal = modalContainer.querySelector('.modal-overlay');
        if (modal) {
            // 1. Removemos la clase que lo hace visible (esto detona la transición CSS)
            modal.classList.remove('is-visible');
            
            // 2. Esperamos los 300ms exactos que dura la transición en profile.css antes de vaciar el DOM
            setTimeout(() => {
                modalContainer.innerHTML = '';
            }, 300);
        }
    },

    async handleBlueskyOAuthStart() {
        const oauthBtn = document.getElementById('bsky-oauth-start-btn');
        if (oauthBtn) {
            oauthBtn.disabled = true;
            oauthBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        }

        try {
            // Llamamos a la Edge Function que genera la URL de autorización
            // Le enviamos la URL actual como "redirect_uri" para que sepa a dónde volver
            const redirectUri = window.location.origin + window.location.pathname;
            
            const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', {
                body: { redirect_uri: redirectUri }
            });

            if (error) throw error;

            // ¡Salto al hiperespacio! Redirigimos al usuario a la página de Bluesky
            if (data?.auth_url) {
                window.location.href = data.auth_url;
            } else {
                throw new Error("No se recibió la URL de autorización.");
            }

        } catch (error) {
            console.error("Error al iniciar OAuth con Bluesky:", error);
            alert("❌ No pudimos conectar con Bluesky en este momento. Inténtalo de nuevo más tarde.");
            if (oauthBtn) {
                oauthBtn.disabled = false;
                oauthBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Autorizar con Bluesky';
            }
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
        
        // Buscamos ambos iconos, el de escritorio y el de móvil
        const desktopIcon = document.querySelector('#theme-switcher-desktop i');
        const mobileIcon = document.querySelector('#theme-switcher-mobile i');
        const iconClass = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";

        if(desktopIcon) desktopIcon.className = iconClass;
        if(mobileIcon) mobileIcon.className = iconClass;
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

    // --- LÓGICA DE ONBOARDING ---
    checkOnboarding(profile, bskyCreds) {
        // 1. Verificamos qué tiene conectado
        const hasOrcid = profile.orcid && profile.orcid !== '0000';
        const hasBsky = !!bskyCreds;

        // 2. Si ya conectó CUALQUIERA de las dos cosas, ya completó el onboarding. ¡Abortamos!
        if (hasOrcid || hasBsky) return;

        // 3. Si no tiene nada, vemos si ya le dimos "Lo haré más tarde" en esta sesión
        const alreadyShown = sessionStorage.getItem('onboarding_shown');

        if (!alreadyShown) {
            setTimeout(() => {
                document.getElementById('onboarding-overlay').classList.add('is-visible');
            }, 1000);
        }
    },

    handleRoleSelection(role) {
        // Guardamos que ya interactuó y cerramos el onboarding
        sessionStorage.setItem('onboarding_shown', 'true');
        document.getElementById('onboarding-overlay').classList.remove('is-visible');

        // Seleccionamos el botón de la pestaña de perfil para hacer el cambio
        const tabPerfilBtn = document.querySelector(`[data-tab='tab-perfil']`);
        if (tabPerfilBtn) tabPerfilBtn.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (role === 'author') {
            if (window.showToast) window.showToast("🚀 ¡Excelente! Iniciando validación ORCID...");
            
            // Esperamos medio segundo a que cambie la pestaña y hacemos scroll al botón ORCID
            setTimeout(() => {
                const orcidBtn = document.getElementById('connect-orcid-btn');
                if (orcidBtn) {
                    orcidBtn.scrollIntoView({behavior: 'smooth', block: 'center'});
                    // Efecto visual: Resaltamos el botón unos segundos
                    orcidBtn.style.transition = "all 0.3s ease";
                    orcidBtn.style.boxShadow = "0 0 0 5px var(--color-accent-light)";
                    orcidBtn.style.transform = "scale(1.05)";
                    setTimeout(() => {
                        orcidBtn.style.boxShadow = "none";
                        orcidBtn.style.transform = "scale(1)";
                    }, 2000);
                }
            }, 500);

        } else {
            if (window.showToast) window.showToast("📖 ¡Bienvenido! Conectemos tu cuenta de Bluesky.");
            
            // Esperamos a que cambie la pestaña y abrimos el modal de Bluesky directo
            setTimeout(() => {
                this.openCommunityModal();
            }, 500);
        }
    },

    // --- DENTRO DE ProfileApp ---
        checkSupportBanner() {
            if (!localStorage.getItem('support_banner_dismissed')) {
                document.getElementById('support-banner').style.display = 'block';
            }
        },

        async renderGamification(profile) {
            // ... (lógica anterior de insignias Citizen, Social, Academic) ...

            // 3. Insignia FUNDADOR (Ejemplo: registrado antes de Mayo 2024)
            const registrationDate = new Date(profile.created_at);
            const founderLimit = new Date('2026-12-31');
            if (registrationDate < founderLimit) {
                document.getElementById('badge-founder')?.classList.add('active-founder');
            }

            // 4. Insignia DIVULGADOR (+5 Proyectos/Eventos)
            const { count } = await this.supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id);
            
            if (count >= 5) {
                document.getElementById('badge-divulgador')?.classList.add('active-divulgador');
            }

            // 5. Insignia MIEMBRO (Si tiene plan activo en tu tabla de suscripciones)
            if (profile.membership_tier && profile.membership_tier !== 'free') {
                document.getElementById('badge-member')?.classList.add('active-member');
            }
        },

        async loadManagementData(userId) {
            try {
                const { data: projects } = await this.supabase.from('projects')
                    .select('id, title, doi, microsite_is_public, created_at')
                    .eq('user_id', userId).order('created_at', { ascending: false });
                
                const { data: events } = await this.supabase.from('sessions')
                    .select('id, session_title, scheduled_at, status, peak_viewers, live_viewers')
                    .eq('user_id', userId).order('scheduled_at', { ascending: false });

                // Cálculos
                let totalViews = 0;
                let totalLive = 0;
                if (events) {
                    events.forEach(e => {
                        totalViews += (e.peak_viewers || 0);
                        totalLive += (e.live_viewers || 0);
                    });
                }

                document.getElementById('stat-total-projects').textContent = projects ? projects.length : 0;
                document.getElementById('stat-total-events').textContent = events ? events.length : 0;
                document.getElementById('stat-total-views').textContent = totalViews;
                document.getElementById('stat-total-live').textContent = totalLive;

                // Lista Proyectos
                const projList = document.getElementById('manage-projects-list');
                if (projects && projects.length > 0) {
                    projList.innerHTML = projects.map(p => {
                        const badge = (p.doi || p.microsite_is_public) ? '<span class="badge-status badge-published">Publicado</span>' : '<span class="badge-status badge-draft">Borrador</span>';
                        const date = new Date(p.created_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                        return `
                        <li class="manage-item" id="manage-proj-${p.id}">
                            <div class="manage-item-info">
                                <p class="manage-item-title" title="${p.title || 'Proyecto sin título'}">${p.title || 'Proyecto sin título'}</p>
                                <p class="manage-item-meta">${badge} <span>${date}</span></p>
                            </div>
                            <button class="btn-delete" onclick="deleteManagementItem('projects', '${p.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </li>`;
                    }).join('');
                } else { projList.innerHTML = '<li style="text-align: center; color: #888; padding: 20px;">Sin proyectos.</li>'; }

                // Lista Eventos (Con Estadísticas)
                const eventList = document.getElementById('manage-events-list');
                if (events && events.length > 0) {
                    eventList.innerHTML = events.map(e => {
                        const isPast = e.status === 'ARCHIVADO' || new Date(e.scheduled_at) < new Date();
                        const badge = isPast ? '<span class="badge-status badge-draft">Pasado</span>' : '<span class="badge-status badge-published">Próximo</span>';
                        const date = new Date(e.scheduled_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                        
                        const statsHtml = `<span class="event-stats-badge" title="Vistas / Pico en Vivo"><i class="fa-solid fa-eye"></i> ${e.peak_viewers || 0} &nbsp;<i class="fa-solid fa-users-viewfinder"></i> ${e.live_viewers || 0}</span>`;

                        return `
                        <li class="manage-item" id="manage-event-${e.id}">
                            <div class="manage-item-info">
                                <p class="manage-item-title" title="${e.session_title}">${e.session_title}</p>
                                <p class="manage-item-meta">${badge} <span>${date}</span> ${statsHtml}</p>
                            </div>
                            <button class="btn-delete" onclick="deleteManagementItem('sessions', '${e.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </li>`;
                    }).join('');
                } else { eventList.innerHTML = '<li style="text-align: center; color: #888; padding: 20px;">Sin eventos.</li>'; }
            } catch (error) { console.error("Error:", error); }
        },
};

// --- LÓGICA DE BANNER ---
window.dismissBanner = () => {
    document.getElementById('support-banner').style.display = 'none';
    localStorage.setItem('support_banner_dismissed', 'true');
};

// Inicializar SOLAMENTE cuando main.js haya preparado Supabase
document.addEventListener('mainReady', () => {
    ProfileApp.init();
    // Exponemos la app globalmente para los botones onclick del HTML
    window.ProfileApp = ProfileApp; 
});

// =================================================================
// FUNCIONES GLOBALES (Para que los onclick del HTML las encuentren)
// =================================================================

// 1. Cerrar el modal de Onboarding ("Lo haré más tarde")
window.closeOnboarding = () => {
    sessionStorage.setItem('onboarding_shown', 'true');
    document.getElementById('onboarding-overlay').classList.remove('is-visible');
};

// 2. Seleccionar Rol en el Onboarding
window.selectOnboardingRole = (role) => {
    if (window.ProfileApp) {
        window.ProfileApp.handleRoleSelection(role);
    }
};

// 3. Navegar a una pestaña desde el Banner u otros links externos
window.navigateToTabExternal = (tabId) => {
    const tabButton = document.querySelector(`[data-tab='${tabId}']`);
    if (tabButton) {
        tabButton.click(); // Simulamos un clic en el botón real de la pestaña
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Subimos la pantalla
    }
};

// 4. Copiar datos de las tarjetas de apoyo (Yape / BCP)
window.copySupportData = (elementId, btn) => {
    const textToCopy = document.getElementById(elementId).innerText;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        // Guardamos el icono original
        const originalHtml = btn.innerHTML;
        // Ponemos el check verde de éxito
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
        
        // Volvemos a la normalidad después de 2 segundos
        setTimeout(() => { 
            btn.innerHTML = originalHtml; 
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar: ', err);
        alert("No se pudo copiar el texto. Intenta seleccionarlo manualmente.");
    });
};

// 5. Eliminar elemento desde el Centro de Mando
window.deleteManagementItem = async (table, id) => {
    if(!confirm("⚠️ ¿Estás seguro de que deseas eliminar este elemento? Esta acción es permanente y no se puede deshacer.")) return;
    
    try {
        // Pedimos a Supabase que borre el registro
        const { error } = await window.ProfileApp.supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        
        // Efecto visual: Desaparece suavemente
        const elementId = table === 'projects' ? `manage-proj-${id}` : `manage-event-${id}`;
        const row = document.getElementById(elementId);
        row.style.opacity = '0';
        setTimeout(() => row.style.display = 'none', 300);
        
        // Restar 1 al contador grande
        const statId = table === 'projects' ? 'stat-total-projects' : 'stat-total-events';
        const statEl = document.getElementById(statId);
        statEl.textContent = Math.max(0, parseInt(statEl.textContent) - 1);
        
        showToast("Elemento eliminado correctamente");
    } catch (err) {
        console.error("Error al eliminar:", err);
        alert("Hubo un error. Asegúrate de tener permisos para borrar este elemento.");
    }
};

// --- FUNCIONES PARA MEMBRESÍA Y PAGO ---

window.openPaymentModal = (tier, price) => {
    document.getElementById('modal-tier-name').textContent = tier;
    document.getElementById('modal-tier-price').textContent = price;
    document.getElementById('payment-modal-overlay').classList.add('is-visible');
};

window.closePaymentModal = () => {
    document.getElementById('payment-modal-overlay').classList.remove('is-visible');
    // Cerramos cualquier detalle abierto
    document.querySelectorAll('.pm-detail').forEach(d => d.style.display = 'none');
};

window.togglePaymentDetail = (id) => {
    const detail = document.getElementById(id);
    const isVisible = detail.style.display === 'block';
    // Cerramos todos primero
    document.querySelectorAll('.pm-detail').forEach(d => d.style.display = 'none');
    // Abrimos el seleccionado si no estaba visible
    if (!isVisible) detail.style.display = 'block';
};