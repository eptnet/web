export const CommunityManager = {
    supabase: null,
    usersCache: [],
    container: null,

    async init(supabaseClient, userProfile) {
        this.supabase = supabaseClient;
        this.container = document.querySelector('main') || document.querySelector('.dashboard-content') || document.getElementById('main-content');

        if (userProfile && userProfile.is_admin === true) {
            this.showAdminMenu();
            this.initListeners();
        }
    },

    showAdminMenu() {
        const adminBtn = document.querySelector('.nav-link.admin-only');
        if (adminBtn) adminBtn.style.display = 'flex';
    },

    initListeners() {
        const btn = document.querySelector('.nav-link[data-section="community-section"]');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.activateSection();
            });
        }

        document.addEventListener('input', (e) => {
            if (e.target.id === 'admin-user-search') this.filterUsers(e.target.value);
            // Vista previa de avatar en tiempo real
            if (e.target.id === 'edit-avatar-url') {
                const img = document.getElementById('preview-avatar');
                if(img) img.src = e.target.value || 'https://i.ibb.co/61fJv24/default-avatar.png';
            }
        });

        document.addEventListener('submit', (e) => {
            if (e.target.id === 'admin-user-form') {
                e.preventDefault();
                this.saveUserProfile();
            }
        });
    },

    activateSection() {
        if (!this.container) return;

        // Visual menu active
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-section="community-section"]')?.classList.add('active');

        // Render template
        this.container.innerHTML = '';
        const template = document.getElementById('template-community-section');
        if (template) {
            this.container.appendChild(template.content.cloneNode(true));
            this.loadUsers();
        }
    },

    async loadUsers() {
        const tableBody = document.getElementById('admin-users-list');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem;">Cargando base de datos... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                // CAMBIO: Ordenamos por nombre en lugar de fecha de creación (que no existe)
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
            row.innerHTML = `
                <td style="padding:1rem;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #eee;">
                        <div>
                            <div style="font-weight:600; color:var(--color-text-primary);">${user.display_name || 'Sin nombre'}</div>
                            <div style="font-size:0.8rem; opacity:0.6;">${user.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td style="padding:1rem; font-size:0.9rem;">${user.role || 'researcher'}</td>
                <td style="padding:1rem;">
                    ${user.username 
                        ? `<a href="/bio.html?u=${user.username}" target="_blank" class="tag-link">@${user.username}</a>` 
                        : '<span style="color:orange; font-size:0.8rem;">Sin URL</span>'}
                </td>
                <td style="padding:1rem; text-align:right;">
                    <button class="btn-edit-user" style="padding:8px 12px; cursor:pointer; background:var(--color-surface); border:1px solid var(--color-border); border-radius:6px; transition:all 0.2s;">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>
                </td>
            `;

            row.querySelector('.btn-edit-user').addEventListener('click', () => this.openEditModal(user));
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

        // IDs
        document.getElementById('edit-user-id').value = user.id;
        
        // Perfil Básico
        document.getElementById('edit-display-name').value = user.display_name || '';
        document.getElementById('edit-username').value = user.username || '';
        document.getElementById('edit-bio-short').value = user.bio_short || '';
        document.getElementById('edit-orcid').value = user.orcid || ''; // ORCID Manual
        
        // Avatar
        const avatarUrl = user.avatar_url || '';
        document.getElementById('edit-avatar-url').value = avatarUrl;
        document.getElementById('preview-avatar').src = avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';

        // Redes Sociales (Mapeo completo)
        document.getElementById('edit-website').value = user.website_url || '';
        document.getElementById('edit-substack').value = user.substack_url || '';
        document.getElementById('edit-linkedin').value = user.linkedin_url || '';
        document.getElementById('edit-x').value = user.x_url || '';
        document.getElementById('edit-bluesky').value = user.bsky_url || '';
        document.getElementById('edit-instagram').value = user.instagram_url || '';
        document.getElementById('edit-facebook').value = user.facebook_url || '';
        document.getElementById('edit-youtube').value = user.youtube_url || '';
        document.getElementById('edit-tiktok').value = user.tiktok_url || '';

        modal.style.display = 'flex';
    },

    async saveUserProfile() {
        const userId = document.getElementById('edit-user-id').value;
        const submitBtn = document.querySelector('#admin-user-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        try {
            // Construimos el objeto de actualización con TODOS los campos
            const updates = {
                display_name: document.getElementById('edit-display-name').value,
                username: document.getElementById('edit-username').value.trim().toLowerCase().replace(/\s+/g, ''),
                bio_short: document.getElementById('edit-bio-short').value,
                orcid: document.getElementById('edit-orcid').value.trim(), // Aquí guardamos el ORCID manual
                avatar_url: document.getElementById('edit-avatar-url').value.trim(),
                
                // Redes
                website_url: document.getElementById('edit-website').value.trim(),
                substack_url: document.getElementById('edit-substack').value.trim(),
                linkedin_url: document.getElementById('edit-linkedin').value.trim(),
                x_url: document.getElementById('edit-x').value.trim(),
                bsky_url: document.getElementById('edit-bluesky').value.trim(),
                instagram_url: document.getElementById('edit-instagram').value.trim(),
                facebook_url: document.getElementById('edit-facebook').value.trim(),
                youtube_url: document.getElementById('edit-youtube').value.trim(),
                tiktok_url: document.getElementById('edit-tiktok').value.trim(),
                
                updated_at: new Date()
            };

            const { error } = await this.supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            alert("✅ Perfil actualizado exitosamente.");
            document.getElementById('admin-edit-modal').style.display = 'none';
            this.loadUsers(); // Recargar tabla

        } catch (err) {
            console.error("Error al guardar:", err);
            alert("❌ Error: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};