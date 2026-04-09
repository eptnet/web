export const CommunityManager = {
    supabase: null,
    usersCache: [],

    async init(supabaseClient, userProfile) {
        this.supabase = supabaseClient;
        if (userProfile && userProfile.is_admin === true) {
            this.showAdminMenu();
            if (!this.listenersAttached) {
                this.initListeners();
                this.listenersAttached = true;
            }
        }
    },

    showAdminMenu() {
        const adminBtn = document.querySelector('.nav-link.admin-only');
        if (adminBtn) adminBtn.style.display = 'flex';
    },

    initListeners() {
        document.addEventListener('input', (e) => {
            if (e.target.id === 'admin-user-search') this.filterUsers(e.target.value);
            if (e.target.id === 'edit-avatar-url') {
                const img = document.getElementById('preview-avatar');
                if(img) img.src = e.target.value || 'https://i.ibb.co/61fJv24/default-avatar.png';
            }
        });

        document.addEventListener('click', (e) => {
            const submitBtn = e.target.closest('button[form="admin-user-form"]');
            if (submitBtn) {
                e.preventDefault();
                this.saveUserProfile();
            }
        });
    },

    async loadUsers() {
        const tableBody = document.getElementById('admin-users-list');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem;">Cargando base de datos... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .order('display_name', { ascending: true });

            if (error) throw error;

            this.usersCache = data;
            this.renderTable(data);

        } catch (err) {
            console.error(err);
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Error: ${err.message}</td></tr>`;
        }
    },

    renderTable(users) {
        const tableBody = document.getElementById('admin-users-list');
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1rem;">No hay usuarios.</td></tr>';
            return;
        }

        users.forEach(user => {
            const avatar = user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--color-border)';
            
            const externalLink = user.username 
                ? `<a href="/bio.html?u=${user.username}" target="_blank" title="Ver Perfil Público" style="margin-left:8px; color:var(--color-accent); font-size:1.1rem; text-decoration:none;">
                     <i class="fa-solid fa-arrow-up-right-from-square"></i>
                   </a>`
                : '<span style="color:var(--color-text-secondary); margin-left:8px; cursor:not-allowed; opacity: 0.5;"><i class="fa-solid fa-ban"></i></span>';

            row.innerHTML = `
                <td style="padding:1rem;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid var(--color-border);">
                        <div>
                            <div style="font-weight:600; color:var(--color-text-primary);">${user.display_name || 'Sin nombre'}</div>
                            <div style="font-size:0.8rem; opacity:0.6;">${user.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td style="padding:1rem; font-size:0.9rem;">${user.role || 'researcher'}</td>
                <td style="padding:1rem;">
                    ${user.username 
                        ? `<span class="tag-link" style="background:var(--color-background); border:1px solid var(--color-border); color:var(--color-text-primary); padding:4px 8px; border-radius:6px; font-size:0.85rem; font-weight:600;">@${user.username}</span>` 
                        : '<span style="color:var(--color-text-secondary); font-size:0.85rem; font-style:italic;">Sin URL</span>'}
                </td>
                <td style="padding:1rem; text-align:right;">
                    <button class="btn-edit-user" type="button" style="padding:8px 12px; cursor:pointer; background:var(--color-surface); border:1px solid var(--color-border); color:var(--color-text-primary); border-radius:6px; transition:all 0.2s;">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                    ${externalLink}
                </td>
            `;

            const editBtn = row.querySelector('.btn-edit-user');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    this.openEditModal(user);
                });
            }

            tableBody.appendChild(row);
        });
    },

    filterUsers(term) {
        const lowerTerm = term.toLowerCase();
        const filtered = this.usersCache.filter(u => 
            (u.display_name && u.display_name.toLowerCase().includes(lowerTerm)) ||
            (u.email && u.email.toLowerCase().includes(lowerTerm)) ||
            (u.username && u.username.toLowerCase().includes(lowerTerm))
        );
        this.renderTable(filtered);
    },

    openEditModal(user) {
        const modal = document.getElementById('admin-edit-modal');
        if(!modal) return;

        const safeSet = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.value = val || ''; 
        };

        safeSet('edit-user-id', user.id);
        safeSet('edit-display-name', user.display_name);
        safeSet('edit-username', user.username);
        safeSet('edit-bio-short', user.bio_short);
        safeSet('edit-orcid', user.orcid);
        safeSet('edit-avatar-url', user.avatar_url);
        
        const imgPreview = document.getElementById('preview-avatar');
        if(imgPreview) imgPreview.src = user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';

        safeSet('edit-website', user.website_url);
        safeSet('edit-substack', user.substack_url);
        safeSet('edit-linkedin', user.linkedin_url);
        safeSet('edit-x', user.x_url);
        safeSet('edit-bluesky', user.bsky_url);
        safeSet('edit-instagram', user.instagram_url);
        safeSet('edit-facebook', user.facebook_url);
        safeSet('edit-youtube', user.youtube_url);
        safeSet('edit-tiktok', user.tiktok_url);

        modal.style.display = 'flex';
    },

    async saveUserProfile() {
        const userIdField = document.getElementById('edit-user-id');
        if (!userIdField) return; 
        const userId = userIdField.value;

        const submitBtn = document.querySelector('button[form="admin-user-form"]');
        const originalText = submitBtn ? submitBtn.textContent : 'Guardar';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Guardando...";
        }

        try {
            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const updates = {
                display_name: getVal('edit-display-name'),
                username: getVal('edit-username').toLowerCase().replace(/\s+/g, ''),
                bio_short: getVal('edit-bio-short'),
                orcid: getVal('edit-orcid'),
                avatar_url: getVal('edit-avatar-url'),
                website_url: getVal('edit-website'),
                substack_url: getVal('edit-substack'),
                linkedin_url: getVal('edit-linkedin'),
                x_url: getVal('edit-x'),
                bsky_url: getVal('edit-bluesky'),
                instagram_url: getVal('edit-instagram'),
                facebook_url: getVal('edit-facebook'),
                youtube_url: getVal('edit-youtube'),
                tiktok_url: getVal('edit-tiktok'),
                updated_at: new Date()
            };

            const { error } = await this.supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            if (window.UI) window.UI.showAlert("✅ Perfil actualizado exitosamente.");
            else alert("✅ Perfil actualizado exitosamente.");
            
            document.getElementById('admin-edit-modal').style.display = 'none';
            this.loadUsers(); 

        } catch (err) {
            console.error("Error al guardar:", err);
            alert("❌ Error: " + err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }
};