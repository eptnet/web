// =================================================================
// ARCHIVO INICIAL: /inv/js/comunidad.js
// PROPÓSITO: Gestionar la nueva página de la comunidad interactiva.
// =================================================================

const ComunidadApp = {
    supabase: null,
    user: null,
    userProfile: null,
    bskyCreds: null,
    selectedImageFile: null,

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
            // Si no hay sesión, en lugar de redirigir, abrimos el modal de login.
            // Asumimos que el modal de login de tu main.js/live.js está disponible en el HTML.
            const loginModal = document.getElementById('login-modal-overlay');
            if (loginModal) {
                loginModal.classList.add('is-visible');
            }
            // Detenemos la carga del resto del contenido.
            document.getElementById('feed-container').innerHTML = ''; 
            return; 
        }
        this.user = session.user;

        // Cargar perfil y credenciales en paralelo
        const [profileResponse, credsResponse] = await Promise.all([
            this.supabase.from('profiles').select('*').eq('id', this.user.id).single(),
            this.supabase.from('bsky_credentials').select('*').eq('user_id', this.user.id).single()
        ]);

        if (profileResponse.error) {
            console.error("Error crítico al cargar el perfil.", profileResponse.error);
            return;
        }

        this.userProfile = profileResponse.data;
        this.bskyCreds = credsResponse.data; // Será null si no hay credenciales

        // Renderizamos la UI con la información actualizada
        this.renderUserPanel();
        this.renderBskyStatus();
        this.toggleCreatePostBox(); // <-- [NUEVA LLAMADA] Esto activará la nueva lógica
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
        // --- INICIO: LÓGICA DE EVENTOS CENTRALIZADA Y CORREGIDA ---

        // Listener único para todos los formularios de la página
        document.body.addEventListener('submit', (e) => {
            // Si el formulario es el de crear post (ya sea el principal o el del modal)
            if (e.target.id === 'create-post-form' || e.target.id === 'create-post-form-modal') {
                e.preventDefault();
                this.handleCreatePost(e.target);
            }
            // Si el formulario es el de conectar bsky
            if (e.target.id === 'bsky-connect-form') {
                e.preventDefault();
                this.handleBlueskyConnect(e);
            }
        });

        // Listener único para todos los CLICS de la página
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button');

            // Botón para conectar Bsky (en panel izquierdo o en cuadro de crear post)
            if (button && (button.id === 'connect-bsky-btn' || button.id === 'connect-bsky-in-creator-btn')) {
                this.openBskyConnectModal();
            }
            
            // Botón flotante para abrir el modal de post
            if (button && button.id === 'fab-create-post') {
                this.openPostModal();
            }
        });

        // Listener para el contenedor del feed (Likes, Comentarios, etc.)
        document.getElementById('feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const replyButton = e.target.closest('.reply-btn');
            const shareButton = e.target.closest('.share-btn');

            if (likeButton) this.handleLike(likeButton);
            if (replyButton) this.handleReply(replyButton);
            if (shareButton) this.handleShare(shareButton);
        });

        // Listener para el contador de caracteres (se adjunta dinámicamente)
        // Ya no es necesario ponerlo aquí, porque `toggleCreatePostBox` y `openPostModal`
        // lo asignan cuando crean el textarea.

        // --- FIN: LÓGICA DE EVENTOS CENTRALIZADA Y CORREGIDA ---
    },

    addFormEventListeners(container) {
        // El listener para 'submit' ha sido ELIMINADO de aquí para evitar duplicados.
        // La gestión del 'submit' ahora se hace de forma centralizada y única en `addEventListeners`.

        // Mantenemos los listeners para los elementos internos del formulario que no son 'submit'.
        container.querySelector('#post-text')?.addEventListener('input', (e) => this.updateCharCounter(e));

        const imageUploadBtn = container.querySelector('#image-upload-btn');
        const imageUploadInput = container.querySelector('#image-upload-input');
        const removeImageBtn = container.querySelector('.remove-image-btn');

        imageUploadBtn?.addEventListener('click', () => imageUploadInput.click());
        imageUploadInput?.addEventListener('change', (e) => this.handleImageSelection(e));
        removeImageBtn?.addEventListener('click', () => this.removeSelectedImage());
    },

    toggleCreatePostBox() {
        const container = document.querySelector('.create-post-box');
        if (!container) return;

        if (this.bskyCreds && (this.userProfile.role === 'researcher' || this.userProfile.role === 'admin')) {
            // Si es investigador y está conectado, mostramos el formulario completo.
            container.innerHTML = `
                <h4>Comparte tu conocimiento</h4>
                <form id="create-post-form">
                    <div class="textarea-container">
                        <textarea id="post-text" name="post-text" placeholder="¿Qué estás investigando hoy?" maxlength="300" required></textarea>
                    </div>

                    <div id="image-preview-container" class="image-preview-container" style="display: none;">
                        <button type="button" class="remove-image-btn">&times;</button>
                        <img id="image-preview" src="#" alt="Vista previa de la imagen">
                    </div>

                    <div class="create-post-actions">
                        <div class="action-icons">
                            <input type="file" id="image-upload-input" accept="image/jpeg, image/png" style="display: none;">
                            <button type="button" id="image-upload-btn" class="post-action-icon" title="Añadir imagen">
                                <i class="fa-solid fa-image"></i>
                            </button>
                        </div>
                        <div class="form-submit-area">
                            <span class="char-counter">300</span>
                            <button type="submit" id="submit-post-btn" class="btn btn-primary">Publicar</button>
                        </div>
                    </div>
                </form>
            `;
            // Re-adjuntamos listeners para el nuevo contenido
            this.addFormEventListeners(container);

        } else if (this.bskyCreds) {
            // Usuario normal conectado
            container.innerHTML = `<h4>¡Ya eres parte de la conversación!</h4><p class="form-hint">Tu cuenta está conectada. Ahora puedes interactuar. La creación de posts está reservada para investigadores.</p>`;
        } else {
            // Usuario no conectado a Bsky
            container.innerHTML = `<h4>Participa en la Conversación</h4><p class="form-hint">Para interactuar, necesitas conectar tu cuenta de Bluesky ¡es gratis y fácil de crear!</p><button id="connect-bsky-in-creator-btn" class="btn btn-primary" style="width:100%;"><i class="fa-solid fa-link"></i> Conectar Cuenta de Bluesky</button>`;
        }
    },

    handleImageSelection(event) {
        const file = event.target.files[0];
        const previewContainer = document.getElementById('image-preview-container');
        const previewImage = document.getElementById('image-preview');

        if (!file) {
            this.selectedImageFile = null;
            previewContainer.style.display = 'none';
            return;
        }

        // Validación básica de la imagen
        if (file.size > 1000000) { // Límite de 1MB (límite de Bluesky para blobs)
            alert("La imagen es demasiado grande. El máximo es 1MB.");
            event.target.value = ''; // Limpiamos el selector de archivos
            return;
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            alert("Formato de imagen no válido. Solo se permiten JPG y PNG.");
            event.target.value = '';
            return;
        }

        this.selectedImageFile = file;

        // Usamos FileReader para mostrar la vista previa
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    removeSelectedImage() {
        this.selectedImageFile = null;
        document.getElementById('image-upload-input').value = '';
        document.getElementById('image-preview-container').style.display = 'none';
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

        if (!postText && !this.selectedImageFile) {
            alert("El post debe contener texto o una imagen.");
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        let body = { postText };

        // Si hay una imagen seleccionada, la convertimos a Base64 y la añadimos al body
        if (this.selectedImageFile) {
            try {
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(this.selectedImageFile);
                    reader.onload = () => resolve(reader.result.split(',')[1]); // Quitamos el prefijo "data:image/jpeg;base64,"
                    reader.onerror = error => reject(error);
                });
                
                body.base64Image = base64Image;
                body.imageMimeType = this.selectedImageFile.type;
                
            } catch (error) {
                console.error("Error al leer la imagen:", error);
                alert("No se pudo procesar la imagen seleccionada.");
                submitButton.disabled = false;
                submitButton.textContent = 'Publicar';
                return;
            }
        }

        // Llamamos a la Edge Function con el texto y opcionalmente la imagen
        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-post', {
                body: body,
            });
            if (error) throw error;

            this.prependNewPost(postText, this.selectedImageFile);
            textArea.value = '';
            this.removeSelectedImage(); // Limpiamos la imagen seleccionada
            this.updateCharCounter({ target: textArea });
            this.closePostModal();

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
    prependNewPost(postText, imageFile = null) {
        const container = document.getElementById('feed-container');
        if (!container) return;

        const author = {
            avatar: this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png',
            displayName: this.userProfile.display_name,
            handle: this.bskyCreds.handle
        };

        let embed = undefined;
        if (imageFile) {
            // Creamos una URL local para la vista previa optimista
            const localImageUrl = URL.createObjectURL(imageFile);
            embed = {
                $type: 'app.bsky.embed.images',
                images: [{ thumb: localImageUrl, alt: 'Imagen recién publicada' }]
            };
        }
        
        const fakePost = {
            author: author,
            record: { text: postText },
            embed: embed,
            indexedAt: new Date().toISOString(),
            replyCount: 0, repostCount: 0, likeCount: 0,
            viewer: {}
        };
        
        const postHtml = this.createPostHtml(fakePost);
        container.insertAdjacentHTML('afterbegin', postHtml);
    },

    /**
     * Maneja el evento de "Me Gusta" (funcionalidad futura).
     */
    async handleLike(button) {
        // Si el usuario no está conectado a Bluesky, no hacemos nada.
        if (!this.bskyCreds) {
            alert("Necesitas conectar tu cuenta de Bluesky para poder interactuar.");
            return;
        }
        if (button.disabled) return;

        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri;
        const postCid = postElement.dataset.cid;
        let likeUri = button.dataset.likeUri;

        const isLiked = button.classList.contains('is-liked');
        const countSpan = button.querySelector('span');
        const icon = button.querySelector('i');
        const originalCount = parseInt(countSpan.textContent);

        // 1. Actualización Optimista: Cambiamos la UI al instante.
        button.disabled = true;
        button.classList.toggle('is-liked');
        if (!isLiked) { // Si NO tenía like... ahora lo tiene
            icon.className = 'fa-solid fa-heart';
            countSpan.textContent = originalCount + 1;
        } else { // Si SÍ tenía like... ahora se lo quitamos
            icon.className = 'fa-regular fa-heart';
            countSpan.textContent = originalCount - 1;
        }

        // 2. Llamada a la Edge Function
        try {
            const { data, error } = await this.supabase.functions.invoke('bsky-like-post', {
                body: { 
                    postUri: postUri, 
                    postCid: postCid,
                    likeUri: isLiked ? likeUri : undefined // Si ya tenía like, enviamos su URI para borrarlo
                },
            });

            if (error) throw error;

            // Si la acción fue un 'like' exitoso, guardamos el nuevo likeUri que nos devuelve la función.
            if (!isLiked && data.uri) {
                button.dataset.likeUri = data.uri;
            } else if (isLiked) {
                button.dataset.likeUri = ''; // Limpiamos el likeUri si lo quitamos
            }

        } catch (error) {
            console.error("Error al procesar el Like:", error);
            // 3. Reversión: Si algo falla, devolvemos la UI a su estado original.
            button.classList.toggle('is-liked');
            icon.className = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
            countSpan.textContent = originalCount;
            alert("No se pudo procesar la acción. Inténtalo de nuevo.");
        } finally {
            button.disabled = false;
        }
    },
    
    /**
     * Maneja el evento de "Comentar".
     */
    async handleReply(button) {
        const postElement = button.closest('.feed-post');
        const handle = postElement.querySelector('.post-handle').textContent.substring(1);
        const postUri = postElement.dataset.uri;
        const rkey = postUri.split('/').pop();
        
        const webUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
        
        // Abre el post en una nueva pestaña para que la conversación continúe en Bluesky
        window.open(webUrl, '_blank');
    },

    openReplyModal(postData) {
        const template = document.getElementById('reply-modal-template');
        if (!template) return console.error("La plantilla de respuesta no existe.");

        const modalContainer = document.getElementById('modal-container');
        const modalNode = template.content.cloneNode(true);

        // Rellenamos el modal con la información del post padre
        modalNode.querySelector('#parent-post-avatar').src = postData.author.avatar;
        modalNode.querySelector('#parent-post-author').textContent = postData.author.displayName;
        modalNode.querySelector('#parent-post-text').innerHTML = postData.text;
        modalNode.querySelector('#reply-user-avatar').src = this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        
        // Añadimos los listeners
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        const form = modalNode.querySelector('#reply-form');
        const textArea = form.querySelector('textarea');
        const charCounter = form.querySelector('.char-counter');

        textArea.addEventListener('input', () => {
            const remaining = 300 - textArea.value.length;
            charCounter.textContent = remaining;
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReply(textArea.value, postData, form);
        });
        
        modalContainer.innerHTML = ''; // Limpiamos por si había otro modal
        modalContainer.appendChild(modalNode);
    },

    async submitReply(replyText, parentPostData, form) {
        const submitButton = form.querySelector('button[type="submit"]');
        if (!replyText.trim()) return;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-reply', {
                body: {
                    replyText: replyText,
                    // El objeto que espera nuestra Edge Function
                    parentPost: {
                        uri: parentPostData.uri,
                        cid: parentPostData.cid
                    }
                },
            });

            if (error) throw error;
            
            // Actualización Optimista: incrementamos el contador de comentarios
            const originalPostElement = document.querySelector(`.feed-post[data-uri="${parentPostData.uri}"]`);
            if (originalPostElement) {
                const countSpan = originalPostElement.querySelector('.reply-btn span');
                countSpan.textContent = parseInt(countSpan.textContent) + 1;
            }

            this.closePostModal();
            
        } catch (error) {
            alert(`Error al publicar el comentario: ${error.message}`);
            submitButton.disabled = false;
            submitButton.innerHTML = 'Responder';
        }
    },

    // No olvides que esta función ya la tienes, solo asegúrate de que esté
    closePostModal() {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
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

        // --- INICIO DE LA MODIFICACIÓN ---
        let embedHtml = '';
            const embed = post.embed;
            if (embed) {
            if (embed.$type === 'app.bsky.embed.images' && embed.images) {
                embedHtml = `<div class="post-embed-image"><img src="${embed.images[0].thumb}" alt="${embed.images[0].alt || 'Imagen adjunta'}" loading="lazy"></div>`;
            } else if (embed.$type === 'app.bsky.embed.external' && embed.external) {
                const external = embed.external;
                embedHtml = `
                    <a href="${external.uri}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
                    ${external.thumb ? `<img src="${external.thumb}" alt="Vista previa del enlace" class="link-preview-image">` : ''}
                    <div class="link-preview-info">
                        <p class="link-preview-title">${external.title}</p>
                        <p class="link-preview-description">${external.description}</p>
                        <p class="link-preview-uri">${new URL(external.uri).hostname}</p>
                    </div>
                    </a>
                `;
            }
        }
        // --- FIN DE LA MODIFICACIÓN ---

        // El cambio clave está en el botón de la mitad, ahora es un 'fa-share-nodes'
        return `
            <div class="bento-box feed-post" data-uri="${post.uri}" data-cid="${post.cid}">
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
                        <button class="post-action-btn share-btn" title="Copiar y compartir enlace">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                        <button class="post-action-btn reply-btn" title="Comentar">
                            <i class="fa-regular fa-comment"></i>
                            <span>${post.replyCount || 0}</span>
                        </button>
                        <button class="post-action-btn like-btn ${isLiked ? 'is-liked' : ''}" 
                                title="Me Gusta" 
                                data-like-uri="${post.viewer?.like || ''}">
                            <i class="fa-${isLiked ? 'solid' : 'regular'} fa-heart"></i>
                            <span>${post.likeCount || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    handleShare(button) {
        const postElement = button.closest('.feed-post');
        const postUri = postElement.dataset.uri; // at://did:plc:user/app.bsky.feed.post/rkey

        // Extraemos el handle y el rkey del URI para construir una URL web
        const parts = postUri.split('/');
        const handle = postElement.querySelector('.post-handle').textContent.substring(1); // quitamos el @
        const rkey = parts[parts.length - 1];
        
        const webUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

        navigator.clipboard.writeText(webUrl).then(() => {
            alert('¡Enlace al post copiado al portapapeles!');
        }).catch(err => {
            console.error('Error al copiar el enlace:', err);
            alert('No se pudo copiar el enlace.');
        });
    },

    // --- FUNCIONES DEL MODAL (Nuevas) ---

    // REEMPLAZA ESTAS DOS FUNCIONES en comunidad.js

    openPostModal() {
        if (document.querySelector('.modal-overlay')) return; // Evita abrir múltiples modales

        const template = document.getElementById('post-form-template');
        if (!template) {
            console.error("La plantilla #post-form-template no existe en el HTML.");
            return;
        }
        
        const modalContainer = document.getElementById('modal-container');
        const modalNode = template.content.cloneNode(true);
        
        // Obtenemos una referencia al overlay que acabamos de clonar
        const modalOverlay = modalNode.querySelector('.modal-overlay');
        
        // Personalizar y añadir listeners al clon del modal
        modalNode.querySelector('#modal-user-avatar').src = this.userProfile.avatar_url || 'https://i.ibb.co/61fJv24/default-avatar.png';
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        const form = modalNode.querySelector('form');
        // form.addEventListener('submit', (e) => {
        //    e.preventDefault();
       //     this.handleCreatePost(e.target);
        // });

        const textArea = modalNode.querySelector('textarea');
        textArea.addEventListener('input', (e) => this.updateCharCounter(e));

        // Añadimos el modal (aún invisible) al DOM
        modalContainer.appendChild(modalNode);

        // --- LA SOLUCIÓN MÁGICA ---
        // Forzamos un pequeño reflow del navegador y luego añadimos la clase
        // '.is-visible' para que la transición de CSS se active correctamente.
        requestAnimationFrame(() => {
            modalOverlay.classList.add('is-visible');
        });
    },

    closePostModal() {
        const modalOverlay = document.querySelector('.modal-overlay.is-visible');
        if (modalOverlay) {
            // Quitamos la clase para iniciar la transición de salida
            modalOverlay.classList.remove('is-visible');
            
            // Esperamos a que la transición CSS termine antes de borrar el HTML del DOM
            modalOverlay.addEventListener('transitionend', () => {
                const modalContainer = document.getElementById('modal-container');
                if (modalContainer) modalContainer.innerHTML = '';
            }, { once: true }); // 'once: true' se asegura de que el listener se auto-elimine
        }
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
            // Si las credenciales existen, las mostramos <p style="font-size: 0.75rem; word-break: break-all; color: var(--color-secondary-text); margin-top: 0.5rem;">DID: ${this.bskyCreds.did}</p>
            container.innerHTML = `
                <div class="status-badge connected">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Conectado como <strong>@${this.bskyCreds.handle}</strong></span>
                </div>
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