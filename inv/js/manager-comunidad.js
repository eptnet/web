export const CommunityManager = {
    supabase: null,
    usersCache: [],
    container: null, // Guardaremos referencia al contenedor principal

    async init(supabaseClient, userProfile) {
        this.supabase = supabaseClient;
        
        // Buscamos el contenedor principal donde se pinta el contenido
        // Intentamos los selectores más comunes en dashboards
        this.container = document.querySelector('main') || document.querySelector('.dashboard-content') || document.getElementById('main-content');

        // 1. Verificación de Seguridad
        if (userProfile && userProfile.is_admin === true) {
            this.showAdminMenu();
            this.initListeners();
        }
    },

    showAdminMenu() {
        const adminBtn = document.querySelector('.nav-link.admin-only');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
        }
    },

    initListeners() {
        const btn = document.querySelector('.nav-link[data-section="community-section"]');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.activateSection();
            });
        }

        // Delegación de eventos para el buscador (porque el input se crea dinámicamente)
        document.addEventListener('input', (e) => {
            if (e.target.id === 'admin-user-search') {
                this.filterUsers(e.target.value);
            }
        });

        // Delegación para el formulario del modal
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'admin-user-form') {
                e.preventDefault();
                this.saveUserProfile();
            }
        });
    },

    // --- NUEVA FUNCIÓN: ENCARGADA DE PINTAR LA PANTALLA ---
    activateSection() {
        if (!this.container) {
            console.error("No se encontró el contenedor principal del dashboard.");
            return;
        }

        // 1. Actualizar menú lateral (Visual)
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-section="community-section"]')?.classList.add('active');

        // 2. Limpiar pantalla actual
        this.container.innerHTML = '';

        // 3. Clonar y pintar el Template
        const template = document.getElementById('template-community-section');
        if (template) {
            const clone = template.content.cloneNode(true);
            this.container.appendChild(clone);
            
            // 4. Una vez pintado el HTML, cargamos los datos
            this.loadUsers();
        } else {
            this.container.innerHTML = '<p style="padding:2rem; color:red;">Error: No se encontró el template-community-section en el HTML.</p>';
        }
    },

    async loadUsers() {
        const tableBody = document.getElementById('admin-users-list');
        if (!tableBody) return; // Si no existe la tabla, salimos

        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;">Cargando comunidad... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

        try {
            // Traemos perfiles ordenados
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .order('display_name', { ascending: true });

            if (error) throw error;

            this.usersCache = data;
            this.renderTable(data);

        } catch (err) {
            console.error("Error:", err);
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: ${err.message}</td></tr>`;
        }
    },

    renderTable(users) {
        const tableBody = document.getElementById('admin-users-list');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';

        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1rem;">No hay usuarios registrados.</td></tr>';
            return;
        }

        users.forEach(user => {
            // Indicador visual de si tiene username
            const hasUsername = user.username ? '<span style="color:green">● Listo</span>' : '<span style="color:orange">○ Pendiente</span>';
            const avatar = user.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';

            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--color-border)';
            row.innerHTML = `
                <td style="padding:1rem;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${avatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight:600; color:var(--color-text-primary);">${user.display_name || 'Sin nombre'}</div>
                            <div style="font-size:0.8rem; opacity:0.7;">${user.email || '...'}</div>
                        </div>
                    </div>
                </td>
                <td style="padding:1rem; font-size:0.9rem;">${user.role || 'researcher'}</td>
                <td style="padding:1rem; font-family:monospace; color:var(--color-accent);">${user.username ? '@'+user.username : '-'}</td>
                <td style="padding:1rem; font-size:0.85rem;">${hasUsername}</td>
                <td style="padding:1rem; text-align:right;">
                    <button class="btn-edit-user" title="Editar Perfil" style="padding:6px 10px; cursor:pointer; background:white; border:1px solid var(--color-border); border-radius:4px; margin-right:5px;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    ${user.username ? `<a href="/bio.html?u=${user.username}" target="_blank" title="Ver Linktree" style="color:var(--color-text-primary);"><i class="fa-solid fa-external-link-alt"></i></a>` : ''}
                </td>
            `;

            // Click en editar
            row.querySelector('.btn-edit-user').addEventListener('click', () => {
                this.openEditModal(user);
            });

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

        // Llenar formulario
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('edit-display-name').value = user.display_name || '';
        document.getElementById('edit-username').value = user.username || '';
        document.getElementById('edit-bio-short').value = user.bio_short || '';
        document.getElementById('edit-x-url').value = user.x_url || '';
        document.getElementById('edit-linkedin-url').value = user.linkedin_url || '';

        modal.style.display = 'flex';
    },

    async saveUserProfile() {
        const userId = document.getElementById('edit-user-id').value;
        const submitBtn = document.querySelector('#admin-user-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";

        // Normalizamos el username (minúsculas y sin espacios)
        let rawUsername = document.getElementById('edit-username').value.trim().toLowerCase();
        rawUsername = rawUsername.replace(/\s+/g, '');

        const updates = {
            display_name: document.getElementById('edit-display-name').value,
            username: rawUsername,
            bio_short: document.getElementById('edit-bio-short').value,
            x_url: document.getElementById('edit-x-url').value,
            linkedin_url: document.getElementById('edit-linkedin-url').value,
            updated_at: new Date()
        };

        try {
            const { error } = await this.supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;

            alert("Perfil actualizado correctamente");
            document.getElementById('admin-edit-modal').style.display = 'none';
            
            // Actualizamos la caché local y la tabla sin recargar
            this.loadUsers();

        } catch (err) {
            console.error("Error al actualizar:", err);
            alert("Error: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};