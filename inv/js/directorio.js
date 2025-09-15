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
        // --- LÍNEA CLAVE AÑADIDA ---
        this.elements.modalOverlay = document.getElementById('researcher-modal-overlay');

        // --- CÓDIGO DUPLICADO ELIMINADO ---
        // El listener de la búsqueda ya se añade en addEventListeners(),
        // así que lo quitamos de aquí para no tenerlo dos veces.

        // 3. Añadimos los listeners y cargamos los datos
        this.addEventListeners();
        this.fetchAndRenderProfiles();
    },

    addEventListeners() {
        // Listener para la barra de búsqueda (sin cambios)
        this.elements.searchInput?.addEventListener('input', (e) => {
            this.filterProfiles(e.target.value);
        });

        // --- NUEVO LISTENER PARA LAS TARJETAS ---
        // Escuchamos los clics en toda la rejilla
        this.elements.grid?.addEventListener('click', (e) => {
            // Buscamos si el clic fue en una tarjeta de investigador
            const card = e.target.closest('.researcher-card');
            if (card && card.dataset.profileId) {
                this.openProfileModal(card.dataset.profileId);
            }
        });
        
        // --- NUEVO LISTENER PARA CERRAR EL MODAL ---
        // Si se hace clic en el fondo oscuro, se cierra
        this.elements.modalOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.closeProfileModal();
            }
        });
    },

    async fetchAndRenderProfiles() {
        if (!this.elements.grid) return;

        try {
            // --- CAMBIO CLAVE: Llamamos a nuestra nueva función RPC ---
            // .rpc() ejecuta la función que creamos en la base de datos.
            const { data, error } = await this.supabase
                .rpc('get_all_public_profiles');

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

        // --- CAMBIO CLAVE: Ya no usamos una etiqueta <a> ---
        // Ahora usamos un <button> para que sea semánticamente correcto (una acción, no un enlace)
        // y le añadimos un data-attribute para guardar el ID del perfil.
        this.elements.grid.innerHTML = profiles.map(profile => {
            const avatarUrl = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            const bio = profile.bio || 'Investigador/a en Epistecnología.';
            
            return `
                <button class="researcher-card" data-profile-id="${profile.id}">
                    <img src="${avatarUrl}" alt="Avatar de ${profile.display_name}" class="card-avatar">
                    <h4 class="card-name">${profile.display_name}</h4>
                    <p class="card-bio">${bio}</p>
                </button>
            `;
        }).join('');
    },

    filterProfiles(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

        if (!lowerCaseSearchTerm) {
            this.renderGrid(this.allProfiles); // Si la búsqueda está vacía, muestra todos
            return;
        }

        const filteredProfiles = this.allProfiles.filter(profile => {
            // --- INICIO DE LA CORRECCIÓN ---
            // Nos aseguramos de que los campos existan antes de buscar en ellos
            const name = profile.display_name || '';
            const bio = profile.bio || '';

            // Comprobamos si el término de búsqueda está en el nombre O en la biografía
            return name.toLowerCase().includes(lowerCaseSearchTerm) ||
                bio.toLowerCase().includes(lowerCaseSearchTerm);
            // --- FIN DE LA CORRECCIÓN ---
        });

        this.renderGrid(filteredProfiles);
    },

    // --- NUEVA FUNCIÓN PARA ABRIR Y CONSTRUIR EL MODAL ---
    async openProfileModal(profileId) {
        if (!this.elements.modalOverlay) return;

        this.elements.modalOverlay.classList.add('is-visible');
        this.elements.modalOverlay.innerHTML = `<div class="profile-modal-content"><p class="loading-message">Cargando perfil...</p></div>`;

        try {
            // Buscamos TODOS los datos de este perfil específico
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*') // El asterisco trae todas las columnas
                .eq('id', profileId)
                .single();

            if (error) throw error;

            // Construimos el HTML del contenido del modal <a href="/inv/profile.html?id=${profile.id}" class="btn btn-secondary">Ver Perfil Completo</a>

            const avatarUrl = profile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
            const orcidId = profile.orcid ? profile.orcid.replace('https://orcid.org/', '') : null;
            
            const modalHTML = `
                <div class="profile-modal-content">
                    <button class="modal-close-btn" aria-label="Cerrar">&times;</button>
                    <div class="modal-header">
                        <img src="${avatarUrl}" alt="Avatar de ${profile.display_name}" class="modal-avatar">
                        <div class="modal-header-info">
                            <h2>${profile.display_name}</h2>
                            ${orcidId ? `<a href="${profile.orcid}" target="_blank" class="modal-orcid"><i class="fa-brands fa-orcid"></i> ${orcidId}</a>` : ''}
                        </div>
                    </div>
                    <div class="modal-body">
                        <p>${profile.bio || 'Sin biografía disponible.'}</p>
                        <div class="modal-socials">
                            ${profile.substack_url ? `<a href="${profile.substack_url}" target="_blank" title="Substack"><i class="fa-brands fa-substack"></i><svg xmlns="http://www.w3.org/2000/svg" fill="#000000" class="bi bi-substack" viewBox="0 0 16 16" id="Substack--Streamline-Bootstrap" height="16" width="16">
                                <desc>
                                    Substack Streamline Icon: https://streamlinehq.com
                                </desc>
                                <path d="M15 3.604H1v1.891h14v-1.89ZM1 7.208V16l7 -3.926L15 16V7.208zM15 0H1v1.89h14z" stroke-width="1"></path>
                                </svg></a>` : ''}
                            ${profile.website_url ? `<a href="${profile.website_url}" target="_blank" title="Sitio Web"><i class="fas fa-globe"></i></a>` : ''}
                            ${profile.x_url ? `<a href="${profile.x_url}" target="_blank" title="X"><i class="fa-brands fa-x-twitter"></i></a>` : ''}
                            ${profile.linkedin_url ? `<a href="${profile.linkedin_url}" target="_blank" title="LinkedIn"><i class="fab fa-linkedin"></i></a>` : ''}
                            ${profile.youtube_url ? `<a href="${profile.youtube_url}" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <a href="#" class="btn btn-secondary is-disabled" title="Próximamente">Ver Publicaciones del Autor</a>
                    </div>
                </div>
            `;

            this.elements.modalOverlay.innerHTML = modalHTML;
            
            // Añadimos el listener al nuevo botón de cerrar
            this.elements.modalOverlay.querySelector('.modal-close-btn').addEventListener('click', () => this.closeProfileModal());

        } catch (error) {
            console.error("Error al cargar el perfil detallado:", error);
            this.elements.modalOverlay.innerHTML = `<div class="profile-modal-content"><p>No se pudo cargar el perfil.</p><button class="modal-close-btn">&times;</button></div>`;
            this.elements.modalOverlay.querySelector('.modal-close-btn').addEventListener('click', () => this.closeProfileModal());
        }
    },

    // --- NUEVA FUNCIÓN PARA CERRAR EL MODAL ---
    closeProfileModal() {
        if (!this.elements.modalOverlay) return;
        this.elements.modalOverlay.classList.remove('is-visible');
        // Limpiamos el contenido después de un momento para que la animación de salida funcione
        setTimeout(() => {
            this.elements.modalOverlay.innerHTML = '';
        }, 300);
    }
};

// Inicializamos la aplicación del directorio
document.addEventListener('DOMContentLoaded', () => {
    DirectoryApp.init();
});
