// =================================================================
// ARCHIVO INICIAL: /inv/js/comunidad.js
// PROPÓSITO: Gestionar la nueva página de la comunidad interactiva.
// =================================================================

const ComunidadApp = {
    supabase: null,
    user: null,
    userProfile: null,
    bskyCreds: null,

    // --- INICIALIZACIÓN DE LA APLICACIÓN ---
    async init() {
        const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        await this.handleUserSession();
        this.addEventListeners();
    },

    // --- GESTIÓN DE LA SESIÓN DEL USUARIO ---
    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) {
            window.location.href = '/'; // Redirigir si no hay sesión
            return;
        }
        this.user = session.user;

        // Cargar perfil y credenciales de Bluesky en paralelo para más eficiencia
        const [profileResponse, credsResponse] = await Promise.all([
            this.supabase.from('profiles').select('*').eq('id', this.user.id).single(),
            this.supabase.from('bsky_credentials').select('*').eq('user_id', this.user.id).single()
        ]);

        if (profileResponse.error) {
            console.error("Error crítico al cargar el perfil.", profileResponse.error);
            return;
        }

        this.userProfile = profileResponse.data;
        this.bskyCreds = credsResponse.data;

        // Una vez que tenemos los datos, actualizamos la interfaz
        this.renderUserPanel();
        this.renderBskyStatus();
        this.renderFeed();
        this.renderFeaturedMembers();
    },

    // --- RENDERIZADO DE COMPONENTES DE LA UI ---

    /**
     * Muestra la información del usuario en el panel izquierdo.
     */
    renderUserPanel() {
        const loadingPanel = document.getElementById('user-panel-loading');
        const contentPanel = document.getElementById('user-panel-content');
        
        document.getElementById('user-panel-avatar').src = this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        document.getElementById('user-panel-name').textContent = this.userProfile.display_name || 'Sin nombre';

        loadingPanel.style.display = 'none';
        contentPanel.style.display = 'block';
    },

    /**
     * Carga y muestra el feed principal de la comunidad.
     * Por ahora, usa la misma función de solo lectura que el perfil.
     */
    async renderFeed() {
        const container = document.getElementById('feed-container');
        if (!container) return;

        try {
            const { data: feed, error } = await this.supabase.functions.invoke('bsky-get-community-feed');
            if (error) throw error;
            if (!feed || feed.length === 0) {
                container.innerHTML = '<p class="bento-box">No hay publicaciones recientes.</p>';
                return;
            }

            // Mapeamos los posts a HTML (estructura similar a profile.js pero preparada para más interacción)
            container.innerHTML = feed.map(item => this.createPostHtml(item.post)).join('');

        } catch (error) {
            container.innerHTML = '<p class="bento-box" style="color: var(--color-accent);">Error al cargar el feed.</p>';
            console.error("Error en renderFeed:", error);
        }
    },
    
    /**
     * Lógica para mostrar miembros destacados (funcionalidad futura).
     */
    renderFeaturedMembers() {
        const list = document.getElementById('featured-members-list');
        // TODO: Implementar la lógica para obtener y mostrar miembros.
        list.innerHTML = `<li>Próximamente...</li>`;
    },


    // --- MANEJADORES DE EVENTOS (Versión Actualizada) ---
    addEventListeners() {
        // Formulario en la página
        document.getElementById('create-post-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreatePost(e.target);
        });
        
        // Contador de caracteres
        document.getElementById('post-text')?.addEventListener('input', this.updateCharCounter);

        // Botón Flotante (FAB)
        document.getElementById('fab-create-post')?.addEventListener('click', () => this.openPostModal());

        // Delegación de eventos para el feed
        document.getElementById('feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const replyButton = e.target.closest('.reply-btn');
            if (likeButton) this.handleLike(likeButton);
            if (replyButton) this.handleReply(replyButton);
        });

        // Listener para el nuevo botón de conectar en el panel de usuario
        document.body.addEventListener('click', (e) => {
            if (e.target.id === 'connect-bsky-btn') {
                this.openBskyConnectModal();
            }
        });

        // Delegación de eventos para el modal (se añade al abrirse)
    },

    // --- LÓGICA DE INTERACCIÓN (Versión Actualizada) ---

    /**
     * Maneja la creación de un nuevo post, ya sea desde el form en página o el modal.
     * @param {HTMLFormElement} form - El formulario que inició el evento.
     */
    async handleCreatePost(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const textArea = form.querySelector('textarea[name="post-text"]');
        const postText = textArea.value.trim();

        if (!postText) {
            alert("El post no puede estar vacío.");
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-post', {
                body: { postText: postText },
            });

            if (error) throw error;

            // --- INICIO DE LA ACTUALIZACIÓN OPTIMISTA ---
            // En lugar de recargar toda la página, creamos y añadimos el post a la vista.
            this.prependNewPost(postText);
            textArea.value = ''; // Limpiar textarea
            this.updateCharCounter({ target: textArea }); // Actualizar contador
            this.closePostModal(); // Cierra el modal si estaba abierto
            // --- FIN DE LA ACTUALIZACIÓN OPTIMISTA ---

        } catch (error) {
            console.error("Error al publicar:", error);
            alert(`No se pudo publicar el post: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Publicar'; 
        }
    },

    /**
     * Crea el HTML para un nuevo post y lo añade al principio del feed.
     * @param {string} postText - El contenido del post.
     */
    prependNewPost(postText) {
        const container = document.getElementById('feed-container');
        if (!container) return;

        // Usamos los datos del usuario que ya tenemos cargados
        const author = {
            avatar: this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            displayName: this.userProfile.display_name,
            handle: this.bskyCreds.handle
        };

        const postDate = new Date().toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

        // Creamos un objeto 'post' falso para pasarlo a nuestra función createPostHtml
        const fakePost = {
            author: author,
            record: { text: postText },
            indexedAt: new Date().toISOString(),
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
            viewer: {}
        };
        
        const postHtml = this.createPostHtml(fakePost);
        container.insertAdjacentHTML('afterbegin', postHtml);
    },

    /**
     * Maneja el evento de "Me Gusta" (funcionalidad futura).
     */
    async handleLike(button) {
        alert("Funcionalidad de 'Me Gusta' en desarrollo.");
        // TODO: Implementar la lógica de 'Me Gusta', similar a profile.js pero aquí podrá deshacer el like.
    },
    
    /**
     * Maneja el evento de "Comentar" (funcionalidad futura).
     */
    async handleReply(button) {
        alert("Funcionalidad de 'Comentar' en desarrollo.");
        // TODO: Implementar la lógica para mostrar un cuadro de respuesta y publicar el comentario.
    },

    // --- HELPERS ---
    
    /**
     * Crea el HTML para un único post. Reutilizable y fácil de mantener.
     * @param {object} post - El objeto del post de Bluesky.
     * @returns {string} - La cadena de HTML para el post.
     */
    createPostHtml(post) {
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
            <div class="bento-box feed-post" data-uri="${post.uri}">
                <div class="post-header">
                    <img src="${author.avatar || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="post-avatar">
                    <div class="post-author-info">
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
                    <div class="post-actions">
                        <button class="post-action-btn reply-btn" title="Comentar">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.replyCount || 0}</span>
                        </button>
                        <button class="post-action-btn" title="Repostear">
                             <i class="fa-solid fa-retweet"></i>
                            <span>${post.repostCount || 0}</span>
                        </button>
                        <button class="post-action-btn like-btn ${isLiked ? 'is-liked' : ''}" title="Me Gusta">
                            <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                            <span>${post.likeCount || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // --- FUNCIONES DEL MODAL (Nuevas) ---

    openPostModal() {
        if (document.querySelector('.modal-overlay')) return; // Ya está abierto

        const template = document.getElementById('post-form-template');
        const modalContainer = document.getElementById('modal-container');
        const modalNode = template.content.cloneNode(true);
        
        // Personalizar y añadir listeners al clon del modal
        modalNode.querySelector('#modal-user-avatar').src = this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        const form = modalNode.querySelector('form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreatePost(e.target);
        });

        const textArea = modalNode.querySelector('textarea');
        textArea.addEventListener('input', this.updateCharCounter);

        modalContainer.appendChild(modalNode);
    },

    closePostModal() {
        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = ''; // La forma más simple de cerrar y limpiar
    },

    updateCharCounter(e) {
        const maxLength = 300;
        const currentLength = e.target.value.length;
        const remaining = maxLength - currentLength;
        // Buscamos el contador relativo al formulario actual
        const form = e.target.closest('form');
        if(form) {
            form.querySelector('.char-counter').textContent = remaining;
        }
    },

    // Añade esta función a ComunidadApp en comunidad.js
    renderBskyStatus() {
        const container = document.getElementById('user-panel-bsky-status');
        if (!container) return;

        if (this.bskyCreds) {
            // Si las credenciales existen, las mostramos
            container.innerHTML = `
                <div class="status-badge connected">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Conectado como <strong>@${this.bskyCreds.handle}</strong></span>
                </div>
                <p style="font-size: 0.75rem; word-break: break-all; color: var(--color-secondary-text); margin-top: 0.5rem;">
                    DID: ${this.bskyCreds.did}
                </p>
            `;
        } else {
            // Si no, mostramos un botón para conectar
            container.innerHTML = `
                <p class="form-hint">Conecta tu cuenta para poder publicar.</p>
                <button id="connect-bsky-btn" class="btn btn-primary" style="width:100%; margin-top:0.5rem;">
                    <i class="fa-solid fa-link"></i> Conectar Cuenta
                </button>
            `;
        }
    },

    // Añade estas funciones a ComunidadApp en comunidad.js
    openBskyConnectModal() {
        const template = document.getElementById('bsky-connect-template');
        if (!template) { console.error("La plantilla del modal no existe."); return; }

        const modalContainer = document.getElementById('modal-container') || document.createElement('div');
        if (!document.getElementById('modal-container')) {
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }

        modalContainer.innerHTML = `<div class="modal-overlay is-visible"><div class="modal-content"><button class="modal-close-btn">&times;</button></div></div>`;
        const modalContent = modalContainer.querySelector('.modal-content');
        modalContent.appendChild(template.content.cloneNode(true));

        modalContainer.querySelector('.modal-close-btn').addEventListener('click', () => this.closeBskyConnectModal());
        modalContainer.querySelector('#bsky-connect-form').addEventListener('submit', (e) => this.handleBlueskyConnect(e));
    },

    closeBskyConnectModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    },

    async handleBlueskyConnect(e) {
        e.preventDefault();
        const form = e.target;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

        const handle = form.querySelector('#bsky-handle').value;
        const appPassword = form.querySelector('#bsky-app-password').value;

        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-auth', { body: { handle, appPassword } });
            if (error) throw error;
            alert(data.message);
            location.reload(); // Recargamos para que todo se actualice
        } catch (error) {
            alert(`Error al conectar: ${error.message}`);
            button.disabled = false;
            button.innerHTML = 'Conectar Cuenta';
        }
    },

};

// Inicializar la aplicación cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', () => {
    ComunidadApp.init();
});