const DirectoryApp = {
    supabase: null,
    allProfiles: [],
    currentRoleFilter: "",

    init() {
        // Usamos EXCLUSIVAMENTE el cliente global creado en main.js 
        // Esto elimina por completo el warning de "Multiple GoTrueClient instances"
        if (window.supabaseClient) {
            this.supabase = window.supabaseClient;
        } else {
            console.error("No se encontró el cliente de Supabase de main.js");
            return;
        }

        this.grid = document.getElementById('directory-grid');
        this.searchInput = document.getElementById('search-input');
        this.rolePills = document.querySelectorAll('.category-pill');

        this.addEventListeners();
        
        // Esperamos a que main.js confirme que todo está listo (opcional pero seguro)
        this.loadProfiles();
    },

    addEventListeners() {
        // Búsqueda por texto
        this.searchInput.addEventListener('input', () => this.filterProfiles());

        // Filtros por Píldoras (Pills)
        this.rolePills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                this.rolePills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                this.currentRoleFilter = e.target.getAttribute('data-role');
                this.filterProfiles();
            });
        });
    },

    async loadProfiles() {
        try {
            this.grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--color-accent);"></i><p>Cargando red de investigadores...</p></div>';

            // CORRECCIÓN MAGISTRAL: Consultamos SOLO las columnas que existen en tu tabla
            const { data, error } = await this.supabase
                .from('profiles')
                .select('id, display_name, username, avatar_url, bio_short, role')
                .order('created_at', { ascending: false }); // Los más recientes primero

            if (error) throw error;
            this.allProfiles = data || [];
            this.renderProfiles(this.allProfiles);
        } catch (error) {
            console.error("Error cargando perfiles:", error);
            this.grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--color-accent);">Error al cargar el directorio. Por favor, recarga la página.</p>';
        }
    },

    filterProfiles() {
        const searchTerm = this.searchInput.value.toLowerCase();

        const filtered = this.allProfiles.filter(profile => {
            // Busca coincidencias en el display_name o en el username
            const matchText = (profile.display_name?.toLowerCase() || '').includes(searchTerm) || 
                              (profile.username?.toLowerCase() || '').includes(searchTerm);
            
            // Filtro por roles usando los botones (Pills)
            let matchRole = true;
            if (this.currentRoleFilter !== "") {
                // Ajuste: si el filtro es "Investigador", buscamos el valor por defecto 'researcher' de tu tabla
                let dbRoleTarget = this.currentRoleFilter;
                if (this.currentRoleFilter === "Investigador") dbRoleTarget = 'researcher';
                
                // Si el usuario tiene un rol asignado, lo comparamos
                matchRole = profile.role && profile.role.toLowerCase() === dbRoleTarget.toLowerCase();
            }

            return matchText && matchRole;
        });

        this.renderProfiles(filtered);
    },

    renderProfiles(profiles) {
        if (profiles.length === 0) {
            this.grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 50px; color: var(--color-text-secondary);"><i class="fa-solid fa-users-slash fa-2x" style="margin-bottom:15px;"></i><p>No se encontraron investigadores con esos criterios.</p></div>';
            return;
        }

        this.grid.innerHTML = profiles.map(profile => {
            // Manejo de datos nulos para evitar que se rompa la vista
            const avatar = profile.avatar_url || 'https://i.ibb.co/wzn25c8/default-avatar.png';
            const nombre = profile.display_name || profile.username || 'Investigador Anónimo';
            
            // Traducción visual del rol de base de datos a español
            let rolVisual = "Miembro";
            if (profile.role === 'researcher') rolVisual = "Investigador";
            else if (profile.role) rolVisual = profile.role.charAt(0).toUpperCase() + profile.role.slice(1); // Capitaliza la primera letra
            
            const bioCorta = profile.bio_short ? `"${profile.bio_short}"` : '';

            return `
                <div class="researcher-card">
                    <div class="card-avatar-wrapper">
                        <img src="${avatar}" alt="${nombre}" class="card-avatar">
                        <div class="verified-badge" title="Cuenta Registrada"><i class="fa-solid fa-check"></i></div>
                    </div>
                    <h3>${nombre}</h3>
                    <p class="researcher-institution" style="color: var(--color-secondary); font-size: 0.8rem; font-weight: normal; margin-bottom: 10px; font-style: italic;">
                        ${bioCorta}
                    </p>
                    
                    <div class="researcher-badges">
                        <span class="r-badge"><i class="fa-solid fa-user-tag"></i> ${rolVisual}</span>
                    </div>
                    
                    <a href="/bio.html?u=${profile.username}" class="btn-view-profile">Ver Perfil</a>
                </div>
            `;
        }).join('');
    }
};

// Inicializamos cuando el DOM cargue
document.addEventListener('DOMContentLoaded', () => { 
    // Pequeño timeout para asegurar que main.js ya creó window.supabaseClient
    setTimeout(() => {
        DirectoryApp.init(); 
    }, 100);
});