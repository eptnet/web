const DirectoryApp = {
    supabase: null,
    allProfiles: [], // Almacenaremos todos los perfiles aquí para no volver a pedirlos
    elements: {},

    init() {
        // 1. Inicializamos Supabase (igual que en tus otros archivos)
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // 2. Guardamos las referencias a los elementos del DOM
        this.elements.grid = document.getElementById('directory-grid');
        this.elements.searchInput = document.getElementById('search-input');

        // 3. Añadimos el listener para la barra de búsqueda
        this.elements.searchInput.addEventListener('input', (e) => {
            this.filterProfiles(e.target.value);
        });

        // 4. Buscamos y mostramos todos los perfiles
        this.fetchAndRenderProfiles();
    },

    async fetchAndRenderProfiles() {
        if (!this.elements.grid) return;

        try {
            // Buscamos en la tabla 'profiles' todos los perfiles
            const { data, error } = await this.supabase
                .from('profiles')
                .select('id, display_name, avatar_url, bio')
                .order('display_name', { ascending: true });

            if (error) throw error;

            this.allProfiles = data; // Guardamos los datos en nuestra variable local
            this.renderGrid(this.allProfiles); // Mostramos los resultados
        } catch (error) {
            console.error("Error al cargar los perfiles:", error);
            this.elements.grid.innerHTML = '<p class="loading-message">No se pudieron cargar los investigadores.</p>';
        }
    },

    renderGrid(profiles) {
        if (!this.elements.grid) return;

        if (profiles.length === 0) {
            this.elements.grid.innerHTML = '<p class="loading-message">No se encontraron investigadores.</p>';
            return;
        }

        // Creamos el HTML para cada tarjeta de investigador
        this.elements.grid.innerHTML = profiles.map(profile => {
            const avatarUrl = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            const bio = profile.bio || 'Investigador/a en Epistecnología.';
            
            // Cada tarjeta es un enlace a la página de perfil de ese usuario
            // Nota: Esto requerirá una página de perfil pública en el futuro.
            return `
                <a href="/inv/profile.html?id=${profile.id}" class="researcher-card">
                    <img src="${avatarUrl}" alt="Avatar de ${profile.display_name}" class="card-avatar">
                    <h4 class="card-name">${profile.display_name}</h4>
                    <p class="card-bio">${bio}</p>
                </a>
            `;
        }).join('');
    },

    filterProfiles(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

        if (!lowerCaseSearchTerm) {
            this.renderGrid(this.allProfiles); // Si la búsqueda está vacía, muestra todos
            return;
        }

        // Filtramos el array local sin necesidad de volver a la base de datos
        const filteredProfiles = this.allProfiles.filter(profile => {
            const nameMatch = profile.display_name.toLowerCase().includes(lowerCaseSearchTerm);
            const bioMatch = profile.bio ? profile.bio.toLowerCase().includes(lowerCaseSearchTerm) : false;
            return nameMatch || bioMatch;
        });

        this.renderGrid(filteredProfiles);
    }
};

// Inicializamos la aplicación del directorio
document.addEventListener('DOMContentLoaded', () => {
    // Reutilizamos el cliente de Supabase de main.js si ya existe
    if (window.supabaseClient) {
        DirectoryApp.supabase = window.supabaseClient;
        DirectoryApp.init();
    } else {
        // Si no, lo inicializamos (esto es un fallback)
        DirectoryApp.init();
    }
});