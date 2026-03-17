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
        // Heredamos la conexión global creada por main.js
        this.supabase = window.supabaseClient;

        await this.handleUserSession();
        this.addEventListeners();
    },

    // --- GESTIÓN DE LA SESIÓN DEL USUARIO ---
    async handleUserSession() {
        const { data: { session } } = await this.supabase.auth.getSession();

        // MODO INVITADO: Si no hay sesión, dejamos pasar pero sin perfil
        if (!session) { 
            this.user = null; this.userProfile = null; this.bskyCreds = null;
            this.renderUserPanel(); 
            this.toggleCreatePostBox(); 
            this.renderFeed(); 
            this.renderFeaturedMembers(); 
            this.renderLatestPublications(); 
            this.renderSidebarEvents(); 
            this.fetchLatestPodcast();
            return; 
        }

        this.user = session.user;
        const [profileResponse, credsResponse] = await Promise.all([
            this.supabase.from('profiles').select('*').eq('id', this.user.id).single(),
            this.supabase.from('bsky_credentials').select('*').eq('user_id', this.user.id).single()
        ]);

        this.userProfile = profileResponse.data;
        this.bskyCreds = credsResponse.data;

        this.renderUserPanel();
        this.renderBskyStatus();
        this.toggleCreatePostBox();
        this.renderFeed();
        this.renderFeaturedMembers();
        this.renderLatestPublications();
        this.renderSidebarEvents();
        this.fetchLatestPodcast();
    },

    // --- RENDERIZADO DE COMPONENTES DE LA UI ---

    /**
     * Muestra la información del usuario en el panel izquierdo.
     */
    renderUserPanel() {
        const loadingPanel = document.getElementById('user-panel-loading');
        const contentPanel = document.getElementById('user-panel-content');
        
        if (this.userProfile) {
            const userName = this.userProfile.display_name || 'Sin nombre';
            // Magia DiceBear: Si no tiene foto, crea una usando su nombre
            const fallbackAvatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(userName)}`;
            
            document.getElementById('user-panel-avatar').src = this.userProfile.avatar_url || fallbackAvatar;
            document.getElementById('user-panel-name').textContent = userName;
        } else {
            // Magia DiceBear para Invitado: Genera uno aleatorio
            const randomSeed = Math.floor(Math.random() * 10000);
            document.getElementById('user-panel-avatar').src = `https://api.dicebear.com/9.x/shapes/svg?seed=invitado_${randomSeed}`;
            document.getElementById('user-panel-name').textContent = 'Invitado Explorador';
            
            const actionArea = document.getElementById('user-panel-bsky-status');
            if (actionArea) {
                actionArea.innerHTML = `
                    <p style="font-size: 0.85rem; color: var(--color-secondary-text);">Inicia sesión para poder publicar e interactuar.</p>
                    <button class="btn-primary" style="width: 100%; margin-top: 10px;" onclick="window.location.href='/?auth=open';">Iniciar Sesión</button>
                `;
            }
            const profileBtn = contentPanel.querySelector('.btn-secondary');
            if(profileBtn) profileBtn.style.display = 'none';
        }

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

    // --- MANEJADORES DE EVENTOS (Versión Unificada Definitiva) ---
    addEventListeners() {
        // 1. Listener para FORMULARIOS (Submits)
        document.body.addEventListener('submit', (e) => {
            if (e.target.id === 'create-post-form' || e.target.id === 'create-post-form-modal') {
                e.preventDefault();
                this.handleCreatePost(e.target);
            }
            if (e.target.id === 'bsky-connect-form') {
                e.preventDefault();
                this.handleBlueskyConnect(e);
            }
        });

        // 2. Listener para CLICS (Navegación, Modales, Zapping)
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            const button = target.closest('button');

            // --- ABRIR MODAL DE INVESTIGADOR (Stories o Listas) ---
            const investigatorItem = target.closest('.featured-investigator-item, .story-item');
            if (investigatorItem) {
                e.preventDefault();
                e.stopPropagation();
                const username = investigatorItem.dataset.username;
                if (username) this.openProfileModal(username);
            }

            // --- TABS MÓVILES (NAVEGACIÓN APP) ---
            const tabBtn = target.closest('.community-tab-btn');
            if (tabBtn) {
                // Quitar 'active' de todos los botones
                document.querySelectorAll('.community-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active'); // Activar el presionado
                
                // Ocultar todas las columnas
                document.getElementById('feed-tab').classList.remove('is-active-tab');
                document.getElementById('profile-tab').classList.remove('is-active-tab');
                document.getElementById('explore-tab').classList.remove('is-active-tab');
                
                // Mostrar solo la columna seleccionada
                const targetId = tabBtn.getAttribute('data-target');
                const activeColumn = document.getElementById(targetId);
                if (activeColumn) activeColumn.classList.add('is-active-tab');
                
                // Subir suavemente al inicio de la pestaña
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            // --- ABRIR IMAGEN EN PANTALLA COMPLETA (Solución definitiva) ---
            const embedImg = target.closest('.post-embed-image img');
            if (embedImg) {
                e.preventDefault();
                this.openImageLightbox(embedImg.src);
                return;
            }

            // --- MENÚ LATERAL (Reglas, Notificaciones, etc.) ---
            const navLink = target.closest('.community-nav-link');
            if (navLink) {
                if(navLink.getAttribute('href') === '#') e.preventDefault();

                if (navLink.innerHTML.includes('Reglas')) {
                    const rulesModal = document.getElementById('rules-modal-overlay');
                    if (rulesModal) {
                        rulesModal.style.display = 'flex';
                        setTimeout(() => rulesModal.classList.add('is-visible'), 10);
                    }
                }
                else if (navLink.id === 'notifications-bell-icon') {
                    if (this.bskyCreds) window.open('https://bsky.app/notifications', '_blank');
                    else alert("Únete a Epistecnología para recibir notificaciones.");
                }
                else if (navLink.innerHTML.includes('Guardados')) {
                    alert("🚀 Próximamente: Podrás guardar tus artículos y debates favoritos.");
                }
            }

            // --- CERRAR MODAL DE REGLAS ---
            if (target.id === 'rules-close-btn' || target.id === 'rules-accept-btn' || target.id === 'rules-modal-overlay') {
                const rulesModal = document.getElementById('rules-modal-overlay');
                if (rulesModal) {
                    rulesModal.classList.remove('is-visible');
                    setTimeout(() => rulesModal.style.display = 'none', 300);
                }
            }

            // --- MODALES BSKY Y PUBLICAR ---
            if (button && (button.id === 'connect-bsky-btn' || button.id === 'connect-bsky-in-creator-btn')) {
                this.openBskyConnectModal();
            }
            if (button && button.id === 'fab-create-post') {
                this.openPostModal();
            }

            // --- ZAPPING (REPRODUCTOR 24/7 MULTICANAL) ---
            const channelBtn = target.closest('.channel-btn');
            if (channelBtn) {
                document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
                channelBtn.classList.add('active');
                
                const type = channelBtn.dataset.type;
                const iframeContainer = document.getElementById('ept-tv-iframe');
                const podcastContainer = document.getElementById('native-podcast-player');

                if (type === 'video') {
                    podcastContainer.style.display = 'none';
                    iframeContainer.style.display = 'block';
                    iframeContainer.src = channelBtn.dataset.src;
                } else if (type === 'podcast') {
                    iframeContainer.style.display = 'none';
                    iframeContainer.src = ''; 
                    podcastContainer.style.display = 'flex'; 
                }
            }
        });

        // 3. Listener para el FEED (Likes, Reply, Share)
        document.getElementById('feed-container')?.addEventListener('click', (e) => {
            const likeButton = e.target.closest('.like-btn');
            const replyButton = e.target.closest('.reply-btn');
            const shareButton = e.target.closest('.share-btn');

            if (likeButton) this.handleLike(likeButton);
            if (replyButton) this.handleReply(replyButton);
            if (shareButton) this.handleShare(shareButton);
        });
    },

    addFormEventListeners(container) {
        // Enlaza el texto para los links y contadores
        container.querySelector('textarea')?.addEventListener('input', (e) => {
            this.updateCharCounter(e);
            this.detectLinkInText(e.target.value); 
        });

        // Enlaza la subida de imágenes usando CLASES relativas al contenedor actual
        const imageUploadBtn = container.querySelector('.image-upload-btn') || container.querySelector('#image-upload-btn');
        const imageUploadInput = container.querySelector('.image-upload-input') || container.querySelector('#image-upload-input');
        const removeImageBtn = container.querySelector('.remove-image-btn');

        if (imageUploadBtn && imageUploadInput) {
            imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
            imageUploadInput.addEventListener('change', (e) => this.handleImageSelection(e, container));
        }
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => this.removeSelectedImage(container));
        }
    },

    toggleCreatePostBox() {
        const container = document.querySelector('.create-post-box');
        if (!container) return;

        if (this.bskyCreds && (this.userProfile.role === 'researcher' || this.userProfile.role === 'admin')) if (this.bskyCreds && (this.userProfile.role === 'researcher' || this.userProfile.role === 'admin')) {
            // Generamos la URL del avatar correctamente
            const avatarUrl = this.userProfile.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${this.userProfile.username || 'user'}`;

            // Inyectamos la estructura limpia estilo Bluesky
            container.innerHTML = `
                <form id="create-post-form" class="clean-post-form">
                    <div class="textarea-container">
                        <img id="inline-user-avatar" src="${avatarUrl}" class="post-avatar">
                        <div class="post-input-wrapper">
                            <textarea id="post-text" name="post-text" placeholder="¿Qué hay de nuevo, investigador?" maxlength="300" required></textarea>
                            
                            <div id="link-preview-loader" style="display:none; font-size: 0.8rem; margin: 10px 0; color: var(--color-accent);">
                                <i class="fa-solid fa-spinner fa-spin"></i> Generando vista previa...
                            </div>
                            <div id="link-preview-editor" class="link-preview-card" style="display:none; margin-bottom: 15px; position: relative;"></div>
                            
                            <div id="image-preview-container" class="image-preview-container" style="display: none;">
                                <button type="button" class="remove-image-btn">&times;</button>
                                <img id="image-preview" src="#" alt="Vista previa de la imagen">
                            </div>
                        </div>
                    </div>

                    <div class="create-post-actions">
                        <div class="action-icons">
                            <input type="file" id="image-upload-input" accept="image/jpeg, image/png" style="display: none;">
                            <button type="button" id="image-upload-btn" class="post-action-icon" title="Añadir imagen">
                                <i class="fa-regular fa-image"></i>
                            </button>
                            <button type="button" class="post-action-icon disabled-icon" title="GIF (Próximamente)"><i class="fa-solid fa-square-poll-vertical"></i></button>
                            <button type="button" class="post-action-icon disabled-icon" title="Emojis (Próximamente)"><i class="fa-regular fa-face-smile"></i></button>
                        </div>
                        <div class="form-submit-area">
                            <span class="char-counter">300</span>
                            <button type="submit" id="submit-post-btn" class="btn btn-primary btn-pill">Publicar</button>
                        </div>
                    </div>
                </form>
            `;
            this.addFormEventListeners(container);
            
        } else if (this.bskyCreds) {
            // Usuario normal conectado
            container.innerHTML = `<h4>¡Ya eres parte de la conversación!</h4><p class="form-hint">Tu cuenta está conectada. Ahora puedes interactuar. La creación de posts está reservada para investigadores.</p>`;
        } else {
            // Usuario no conectado a Bsky
            container.innerHTML = `<h4>Participa en la Conversación</h4><p class="form-hint">Para interactuar, necesitas conectar tu cuenta de Bluesky ¡es gratis y fácil de crear!</p><button id="connect-bsky-in-creator-btn" class="btn btn-primary" style="width:100%;"><i class="fa-solid fa-link"></i> Conectar Cuenta de Bluesky</button>`;
        }
    },

    handleImageSelection(event, container) {
        const file = event.target.files[0];
        const previewContainer = container.querySelector('.image-preview-container') || document.getElementById('image-preview-container');
        const previewImage = container.querySelector('.image-preview') || document.getElementById('image-preview');

        if (!file) {
            this.removeSelectedImage(container);
            return;
        }
        if (file.size > 1000000) { 
            alert("La imagen es demasiado pesada para Bluesky (máximo 1MB).");
            event.target.value = ''; 
            return;
        }

        this.selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            if(previewImage) previewImage.src = e.target.result;
            if(previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    removeSelectedImage(container) {
        this.selectedImageFile = null;
        const input = container ? container.querySelector('input[type="file"]') : document.getElementById('image-upload-input');
        const previewContainer = container ? container.querySelector('.image-preview-container') : document.getElementById('image-preview-container');
        
        if (input) input.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
    },

    // --- LÓGICA DE INTERACCIÓN (Versión Actualizada) ---

    /**
     * Maneja la creación de un nuevo post, extrayendo URLs y validando límites de Bluesky.
     */
    async handleCreatePost(form) {
        const submitButton = form.querySelector('button[type="submit"]');
        const textArea = form.querySelector('textarea[name="post-text"]');
        const postText = textArea.value.trim();

        // 1. DETECCIÓN AUTOMÁTICA DE URL (Regex)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = postText.match(urlRegex);
        const postLink = match ? match[0] : null;

        if (!postText && !this.selectedImageFile) {
            alert("El post debe contener texto o una imagen.");
            return;
        }

        // 2. VALIDACIÓN DE LÍMITE DE 1MB
        if (this.selectedImageFile && this.selectedImageFile.size > 1048576) {
            alert("La imagen es demasiado pesada para Bluesky (máximo 1MB).");
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...';

        // Capturamos los datos de la vista previa generada por Microlink si existen
        const previewImg = document.querySelector('#link-preview-editor img');
        const previewTitle = document.querySelector('#link-preview-editor strong');
        const previewDesc = document.querySelector('#link-preview-editor p');

        let body = { 
            postText: postText,
            postLink: postLink,
            linkTitle: previewTitle ? previewTitle.textContent : null,
            linkDescription: previewDesc ? previewDesc.textContent : null,
            linkThumb: previewImg ? previewImg.src : null
        };

        if (this.selectedImageFile) {
            try {
                const base64Image = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(this.selectedImageFile);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
                body.base64Image = base64Image;
                body.imageMimeType = this.selectedImageFile.type;
            } catch (error) {
                console.error("Error al leer la imagen:", error);
                alert("No se pudo procesar la imagen.");
                submitButton.disabled = false;
                submitButton.textContent = 'Publicar';
                return;
            }
        }

        try {
            const { error } = await this.supabase.functions.invoke('bsky-create-post', {
                body: body,
            });
            if (error) throw error;

            this.prependNewPost(postText, this.selectedImageFile);
            textArea.value = '';
            this.removeSelectedImage();
            this.updateCharCounter({ target: textArea });
            this.closePostModal();

        } catch (error) {
            console.error("Error al publicar:", error);
            const errMsg = error.message || "";
            if (errMsg.includes('non-2xx') || errMsg.includes('revoked') || errMsg.includes('Expired')) {
                alert("Tu clave de Bluesky ha caducado. Por favor, reconecta tu cuenta.");
                this.closePostModal();
                this.openBskyConnectModal();
            } else {
                alert(`No se pudo publicar. Revisa tu conexión.`);
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Publicar';
            }
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
        modalNode.querySelector('#reply-user-avatar').src = this.userProfile.avatar_url || 'https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(userName)}';
        
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

        // --- PROCESAMIENTO NATIVO DE MULTIMEDIA (AT PROTOCOL) ---
        let embedHtml = '';
        const embed = post.embed;
        
        if (embed) {
            // Extracción segura soportando posts citados y anidamientos
            const imagesData = embed.images || (embed.media && embed.media.images);
            const externalData = embed.external || (embed.media && embed.media.external);
            
            // 1. DIBUJA VIDEOS DE BLUESKY
            if (embed.$type === 'app.bsky.embed.video' || (embed.media && embed.media.$type === 'app.bsky.embed.video')) {
                const videoData = embed.video || (embed.media && embed.media.video) || embed;
                const rkey = post.uri.split('/').pop();
                embedHtml = `
                    <div class="post-embed-video" style="position: relative; margin-top: 12px; cursor: pointer; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-border);" onclick="window.open('https://bsky.app/profile/${author.handle}/post/${rkey}', '_blank')">
                        <img src="${videoData.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" style="width: 100%; display: block; filter: brightness(0.85);">
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3); backdrop-filter: blur(4px); transition: transform 0.2s;">
                            <i class="fa-solid fa-play" style="color: white; font-size: 1.5rem; margin-left: 5px;"></i>
                        </div>
                    </div>`;
            }
            // 2. DIBUJA IMÁGENES
            else if (imagesData && imagesData.length > 0) {
                embedHtml = `
                    <div class="post-embed-image" style="margin-top: 12px;">
                        <img src="${imagesData[0].thumb}" alt="${imagesData[0].alt || 'Imagen adjunta'}" loading="lazy" onclick="ComunidadApp.openImageLightbox(this.src)" style="width: 100%; border-radius: 12px; border: 1px solid var(--color-border); cursor: zoom-in;">
                    </div>`;
            } 
            // 3. DIBUJA TARJETAS DE ENLACES (LINK PREVIEWS)
            else if (externalData) {
                let hostname = 'Enlace externo';
                try { hostname = new URL(externalData.uri).hostname; } catch(e) {}
                embedHtml = `
                    <a href="${externalData.uri}" target="_blank" rel="noopener noreferrer" class="link-preview-card" style="display: block; text-decoration: none; color: inherit; border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; margin-top: 12px; background: var(--color-surface); transition: transform 0.2s;">
                        ${externalData.thumb ? `<img src="${externalData.thumb}" alt="Vista previa" class="link-preview-image" style="width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid var(--color-border);">` : ''}
                        <div class="link-preview-info" style="padding: 15px;">
                            <p class="link-preview-title" style="margin: 0 0 5px 0; font-weight: 700; font-size: 0.95rem; line-height: 1.3; color: var(--color-primary-text);">${externalData.title || hostname}</p>
                            <p class="link-preview-description" style="margin: 0 0 10px 0; font-size: 0.85rem; color: var(--color-secondary-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${externalData.description || ''}</p>
                            <p class="link-preview-uri" style="margin: 0; font-size: 0.75rem; color: var(--color-accent); font-weight: 600;"><i class="fa-solid fa-link"></i> ${hostname}</p>
                        </div>
                    </a>`;
            }
        }
        // --- FIN DE LA MODIFICACIÓN ---

        return `
            <div class="bento-box feed-post" data-uri="${post.uri}" data-cid="${post.cid}">
                <div class="post-header">
                    <img src="${author.avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${author.handle}`}" alt="Avatar" class="post-avatar">
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
                            <i class="fa-solid fa-share-nodes"></i>
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
        const modalContainer = document.getElementById('modal-container');
        // CORRECCIÓN: Comprobamos si el contenedor específico de modales dinámicos ya tiene algo adentro
        if (modalContainer && modalContainer.innerHTML.trim() !== '') return; 

        const template = document.getElementById('post-form-template');
        if (!template) {
            console.error("La plantilla #post-form-template no existe en el HTML.");
            return;
        }
        
        const modalNode = template.content.cloneNode(true);
        const modalOverlay = modalNode.querySelector('.modal-overlay');
        
        modalNode.querySelector('#modal-user-avatar').src = this.userProfile?.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=invitado`;
        modalNode.querySelector('.modal-close-btn').addEventListener('click', () => this.closePostModal());
        
        const textArea = modalNode.querySelector('textarea');
        textArea.addEventListener('input', (e) => {
            this.updateCharCounter(e);
            this.detectLinkInText(e.target.value);
        });

        modalContainer.appendChild(modalNode);
        this.addFormEventListeners(modalContainer);

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

    // ==========================================
    // MÓDULOS DE LA COMUNIDAD (Historias, Eventos, Investigadores)
    // ==========================================

    // Variable temporal para guardar los datos de las historias en pantalla
    currentStoriesData: [],

    async renderLatestPublications() {
        const list = document.getElementById('feed-publications-stories');
        if (!list) return;
        try {
            // Traemos TODOS los datos de la base de conocimiento para armar el resumen
            const { data, error } = await this.supabase
                .from('knowledge_base')
                .select('title, url, image_url, description, author_name, published_at')
                .order('published_at', { ascending: false })
                .limit(8);

            if (error) throw error;

            if (data && data.length > 0) {
                // Guardamos los datos en la app para que el modal los pueda leer después
                this.currentStoriesData = data;

                list.style.display = 'flex';
                list.style.gap = '12px';
                list.style.overflowX = 'auto';
                list.style.paddingBottom = '10px';
                list.style.scrollbarWidth = 'none';

                list.innerHTML = data.map((pub, index) => {
                    const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
                    return `
                        <li onclick="ComunidadApp.openPublicationModal(${index})" style="min-width: 120px; width: 120px; height: 170px; border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; flex-shrink: 0; border: 1px solid var(--color-border); box-shadow: var(--shadow-soft); transition: transform 0.2s;">
                            <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1;">
                            <div style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 30px 10px 10px 10px; background: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.4), transparent); z-index: 2;">
                                <span style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: white; font-size: 0.75rem; font-weight: 700; line-height: 1.3; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${pub.title}</span>
                            </div>
                        </li>
                    `;
                }).join('');
                
                list.querySelectorAll('li').forEach(item => {
                    item.addEventListener('mouseenter', () => item.style.transform = 'scale(1.03)');
                    item.addEventListener('mouseleave', () => item.style.transform = 'scale(1)');
                });

            } else {
                list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">No hay artículos recientes.</p>';
            }
        } catch (e) { 
            console.error("Error cargando revista:", e); 
            list.innerHTML = '<p class="trend-topic" style="padding-left:10px;">Error al cargar.</p>';
        }
    },

    // 2. Cargar Agenda y Eventos (Desde sessions)
    async renderSidebarEvents() {
        const list = document.getElementById('sidebar-event-list');
        if (!list) return;
        try {
            const { data, error } = await this.supabase.from('sessions')
                .select('id, session_title, scheduled_at, status')
                .eq('is_archived', false)
                .order('scheduled_at', { ascending: false })
                .limit(10); 
                
            if (error) throw error;

            if (data && data.length > 0) {
                const now = new Date();
                
                // MAGIA: Filtramos estrictamente por FECHA. 
                // Si la fecha es mayor a AHORA, es Próximamente. Si ya pasó, es Grabación.
                const upcoming = data.filter(s => new Date(s.scheduled_at) > now).reverse().slice(0, 2);
                const past = data.filter(s => new Date(s.scheduled_at) <= now).slice(0, 2);
                
                let html = '';
                
                upcoming.forEach(s => {
                    const dateObj = new Date(s.scheduled_at);
                    const dateStr = dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                    html += `
                        <li class="upcoming-event" style="margin-bottom: 0.8rem; border-left: 3px solid var(--color-accent); padding-left: 10px;">
                            <a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);">
                                <strong style="color: var(--color-accent); font-size: 0.75rem; display: block; text-transform: uppercase;">Próximamente (${dateStr})</strong>
                                <span style="font-size: 0.85rem; font-weight: 600; line-height: 1.3; display: block; margin-top: 3px;">${s.session_title}</span>
                            </a>
                        </li>`;
                });
                
                past.forEach(s => {
                    html += `
                        <li class="past-event" style="opacity: 0.7; margin-bottom: 0.8rem; padding-left: 10px;">
                            <a href="/live.html?sesion=${s.id}" style="text-decoration: none; color: var(--color-primary-text);">
                                <strong style="color: var(--color-secondary-text); font-size: 0.75rem; display: block; text-transform: uppercase;">Grabación</strong>
                                <span style="font-size: 0.85rem; line-height: 1.3; display: block; margin-top: 3px;">${s.session_title}</span>
                            </a>
                        </li>`;
                });

                list.innerHTML = html || '<li><span class="trend-topic">No hay eventos por mostrar.</span></li>';
            } else {
                list.innerHTML = '<li><span class="trend-topic">No hay eventos registrados.</span></li>';
            }
        } catch (error) {
            console.error("Error al cargar eventos:", error);
            list.innerHTML = '<li><span class="trend-topic">Error al cargar la agenda.</span></li>';
        }
    },

    async renderFeaturedMembers() {
        const container = document.getElementById('featured-members-list');
        if (!container) return;
        try {
            const { data: projects, error: projErr } = await this.supabase.from('projects').select('user_id').order('created_at', { ascending: false }).limit(40);
            if (projErr) throw projErr;

            // Traemos hasta 8 investigadores para que se active el scroll horizontal
            const uniqueUserIds = [...new Set(projects.map(p => p.user_id))].slice(0, 8);

            if (uniqueUserIds.length === 0) {
                container.innerHTML = '<p class="trend-topic" style="padding-left:10px;">Aún no hay investigadores destacados.</p>';
                return;
            }

            const { data: profiles, error: profErr } = await this.supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', uniqueUserIds);
            if (profErr) throw profErr;

            // Renderizamos en formato "Story"
            container.innerHTML = profiles.map(p => `
                <div class="story-item" data-username="${p.username}">
                    <div class="story-avatar-container">
                        <img src="${p.avatar_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${p.username}`}" class="story-avatar">
                    </div>
                    <span class="story-username">${p.display_name.split(' ')[0]}</span>
                </div>
            `).join('');

        } catch (error) {
            console.error("Error Featured:", error);
            container.innerHTML = '<p class="trend-topic" style="padding-left:10px;">Error al cargar.</p>';
        }
    },

    // 3. Obtener el Podcast vía RSS (Al estilo app.js)
    async fetchLatestPodcast() {
        try {
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua';            const response = await fetch(rssUrl);
            const data = await response.json();
            
            if (data.status === 'ok' && data.items.length > 0) {
                const latestEpisode = data.items[0];
                
                // Extraemos el mp3, el título y la portada
                const audioUrl = latestEpisode.enclosure.link;
                const title = latestEpisode.title;
                const imgUrl = latestEpisode.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
                
                // Inyectamos todo en la caja oculta
                document.getElementById('podcast-title').textContent = title;
                document.getElementById('podcast-audio').src = audioUrl;
                document.getElementById('podcast-cover').src = imgUrl;
            } else {
                document.getElementById('podcast-title').textContent = "No hay episodios disponibles.";
            }
        } catch (error) {
            console.error("Error al cargar el podcast:", error);
            document.getElementById('podcast-title').textContent = "Error de conexión con el Podcast.";
        }
    },

    // ==========================================
    // LÓGICA DEL REPRODUCTOR DE PODCAST (LISTA DE REPRODUCCIÓN)
    // ==========================================
    podcastEpisodes: [],
    currentEpisodeIndex: 0,

    setupAudioPlayer() {
        const audioEl = document.getElementById('hidden-audio-source');
        const playBtn = document.getElementById('player-play-btn');
        const closeBtn = document.getElementById('player-close-btn');
        const timeline = document.getElementById('player-timeline-slider');
        const currentTimeEl = document.getElementById('player-current-time');
        const durationEl = document.getElementById('player-duration');
        const volumeSlider = document.getElementById('player-volume-slider');
        const playerContainer = document.getElementById('persistent-audio-player');
        const playlistPanel = document.getElementById('podcast-playlist-panel');
        
        // 1. Play / Pause
        playBtn.addEventListener('click', () => {
            if (audioEl.paused) { audioEl.play(); playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; } 
            else { audioEl.pause(); playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; }
        });

        // 2. AVANZAR Y RETROCEDER ENTRE EPISODIOS
        document.getElementById('player-rewind-btn').addEventListener('click', () => {
            if (this.currentEpisodeIndex > 0) this.loadEpisodeIntoPlayer(this.currentEpisodeIndex - 1);
        });
        document.getElementById('player-forward-btn').addEventListener('click', () => {
            if (this.currentEpisodeIndex < this.podcastEpisodes.length - 1) this.loadEpisodeIntoPlayer(this.currentEpisodeIndex + 1);
        });

        // 3. Menú Flotante de la Lista de Reproducción
        document.getElementById('player-playlist-btn').addEventListener('click', () => {
            playlistPanel.style.display = playlistPanel.style.display === 'none' ? 'flex' : 'none';
        });
        document.getElementById('close-playlist-btn').addEventListener('click', () => {
            playlistPanel.style.display = 'none';
        });

        // Delegación de clics en la lista para reproducir uno específico
        document.getElementById('podcast-playlist-list').addEventListener('click', (e) => {
            const item = e.target.closest('.playlist-item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.loadEpisodeIntoPlayer(index);
                // Si la lista molesta al usuario tras elegir, la podemos ocultar:
                // playlistPanel.style.display = 'none'; 
            }
        });

        // 4. Controles de tiempo y cierre...
        closeBtn.addEventListener('click', () => {
            audioEl.pause(); playlistPanel.style.display = 'none';
            playerContainer.classList.remove('is-visible');
            setTimeout(() => { playerContainer.style.display = 'none'; }, 400); 
        });

        audioEl.addEventListener('timeupdate', () => {
            const currentM = Math.floor(audioEl.currentTime / 60);
            const currentS = Math.floor(audioEl.currentTime - currentM * 60);
            currentTimeEl.textContent = `${currentM}:${currentS.toString().padStart(2, '0')}`;
            
            if (audioEl.duration) {
                const durationM = Math.floor(audioEl.duration / 60);
                const durationS = Math.floor(audioEl.duration - durationM * 60);
                durationEl.textContent = `${durationM}:${durationS.toString().padStart(2, '0')}`;
                timeline.value = (audioEl.currentTime / audioEl.duration) * 100;
            }
        });

        timeline.addEventListener('input', () => { if(audioEl.duration) audioEl.currentTime = (timeline.value / 100) * audioEl.duration; });
        volumeSlider.addEventListener('input', () => { audioEl.volume = volumeSlider.value / 100; });

        // Auto-reproducir siguiente episodio al terminar (CON BUCLE)
        audioEl.addEventListener('ended', () => {
            if (this.currentEpisodeIndex < this.podcastEpisodes.length - 1) {
                this.loadEpisodeIntoPlayer(this.currentEpisodeIndex + 1);
            } else {
                // Si llegó al final, vuelve a reproducir el episodio 0
                this.loadEpisodeIntoPlayer(0);
            }
        });

        // Lanzar desde Bento Box
        document.getElementById('btn-launch-podcast').addEventListener('click', () => {
            const iframe = document.getElementById('ept-tv-iframe');
            if(iframe) iframe.src = ''; 
            audioEl.play(); playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            playerContainer.style.display = 'block';
            setTimeout(() => playerContainer.classList.add('is-visible'), 10);
        });
    },

    async fetchLatestPodcast() {
        try {
            const rssUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fapi.substack.com%2Ffeed%2Fpodcast%2F2867518%2Fs%2F186951.rss&api_key=rmd6o3ot92w3dujs1zgxaj8b0dfbg6tqizykdrua';
            const response = await fetch(rssUrl);
            
            if (!response.ok) throw new Error("Servidor RSS caído"); // Capturamos el error 500
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.items.length > 0) {
                this.podcastEpisodes = data.items; 
                // ... (código de renderizado de la lista queda igual)
                const listContainer = document.getElementById('podcast-playlist-list');
                listContainer.innerHTML = this.podcastEpisodes.map((ep, idx) => {
                    const img = ep.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
                    const date = new Date(ep.pubDate).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
                    return `<li class="playlist-item" data-index="${idx}">
                                <img src="${img}" class="playlist-item-img">
                                <div class="playlist-item-info">
                                    <p class="playlist-item-title">${ep.title}</p>
                                    <p class="playlist-item-date">${date}</p>
                                </div>
                            </li>`;
                }).join('');

                this.loadEpisodeIntoPlayer(0);
                this.setupAudioPlayer();
            } else {
                throw new Error("No hay items");
            }
        } catch (error) { 
            console.warn("Aviso controlado - Podcast:", error.message); 
            document.getElementById('podcast-title').textContent = "Podcast temporalmente no disponible";
        }
    },

    loadEpisodeIntoPlayer(index) {
        if (index < 0 || index >= this.podcastEpisodes.length) return;
        this.currentEpisodeIndex = index;
        
        const episode = this.podcastEpisodes[index];
        const audioUrl = episode.enclosure.link;
        const imgUrl = episode.thumbnail || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png';
        const title = episode.title;

        // Actualiza el Bento Box lateral
        document.getElementById('podcast-title').textContent = title;
        document.getElementById('podcast-cover').src = imgUrl;

        // Actualiza el reproductor persistente
        const audioEl = document.getElementById('hidden-audio-source');
        const isPlaying = !audioEl.paused;
        
        audioEl.src = audioUrl;
        document.getElementById('player-track-title').textContent = title;
        document.getElementById('player-track-image').src = imgUrl;

        // Marcar visualmente el episodio activo en la lista
        document.querySelectorAll('.playlist-item').forEach((item, i) => {
            if (i === index) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Si ya estaba sonando otro, que este arranque automáticamente
        if (isPlaying || document.getElementById('persistent-audio-player').classList.contains('is-visible')) {
            audioEl.play().catch(e => console.log("Autoplay bloquedo", e));
            document.getElementById('player-play-btn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        }
    },

    openProfileModal(username) {
        console.log("Abriendo perfil de:", username);
        let modalContainer = document.getElementById('modal-container');
        
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        // Eliminamos la "opacidad" manual para no pelear con tu archivo style.css
        modalContainer.innerHTML = `
            <div class="modal-overlay" id="profile-iframe-overlay" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);">
                <div class="modal" style="width: 95%; max-width: 1000px; height: 90vh; padding: 0; position: relative; overflow: hidden; background: var(--color-background); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.3s ease;">
                    <button class="modal-close-btn" style="position: absolute; top: 15px; right: 25px; z-index: 10; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.5rem; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s;">&times;</button>
                    <iframe src="/@${username}" style="width: 100%; height: 100%; border: none; background: var(--color-background);"></iframe>
                </div>
            </div>
        `;
        
        const overlay = document.getElementById('profile-iframe-overlay');
        const modalBox = overlay.querySelector('.modal');
        document.body.style.overflow = 'hidden'; 
        
        // ¡LA SOLUCIÓN! Añadimos la clase oficial is-visible para que el CSS lo revele suavemente
        setTimeout(() => {
            overlay.classList.add('is-visible');
            modalBox.style.transform = 'scale(1)';
        }, 10);
        
        // Función de cierre que remueve la visibilidad
        const closeFn = () => {
            overlay.classList.remove('is-visible');
            modalBox.style.transform = 'scale(0.95)';
            document.body.style.overflow = '';
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        };
        
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeFn(); });
    },

    // Detecta si hay un link mientras el usuario escribe
    detectLinkInText(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const match = text.match(urlRegex);
        const currentUrl = match ? match[0] : null;

        // Si hay una URL y es distinta a la última procesada
        if (currentUrl && currentUrl !== this.lastProcessedUrl) {
            this.lastProcessedUrl = currentUrl;
            this.fetchLinkPreview(currentUrl);
        } else if (!currentUrl) {
            this.lastProcessedUrl = null;
            document.getElementById('link-preview-editor').style.display = 'none';
        }
    },

    // Obtiene los datos del link y los muestra en el editor
    async fetchLinkPreview(url) {
        const loader = document.getElementById('link-preview-loader');
        const container = document.getElementById('link-preview-editor');
        
        loader.style.display = 'block';
        
        try {
            // Usamos una API gratuita de ayuda para obtener metadatos rápidamente en el cliente
            const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
            const json = await res.json();
            const meta = json.data;

            if (meta) {
                container.innerHTML = `
                    <button type="button" class="remove-image-btn" onclick="document.getElementById('link-preview-editor').style.display='none'" style="top: 5px; right: 5px;">&times;</button>
                    ${meta.image ? `<img src="${meta.image.url}" style="width:100%; height:150px; object-fit:cover; border-bottom:1px solid var(--color-border);">` : ''}
                    <div style="padding:12px;">
                        <strong style="display:block; font-size:0.9rem; color:var(--color-primary-text); margin-bottom:4px;">${meta.title || 'Enlace'}</strong>
                        <p style="font-size:0.8rem; color:var(--color-secondary-text); margin:0; line-height:1.2;">${meta.description || ''}</p>
                        <span style="font-size:0.75rem; color:var(--color-accent); margin-top:8px; display:block;"><i class="fa-solid fa-link"></i> ${new URL(url).hostname}</span>
                    </div>
                `;
                container.style.display = 'block';
            }
        } catch (e) {
            console.error("Error preview:", e);
        } finally {
            loader.style.display = 'none';
        }
    },

    // ==========================================
    // MODAL DE LECTURA (RESUMEN NATIVO BASE DE DATOS)
    // ==========================================
    openPublicationModal(index) {
        // Recuperamos los datos del artículo seleccionado
        const pub = this.currentStoriesData[index];
        if (!pub) return;

        console.log("Abriendo resumen nativo:", pub.title);
        
        let modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        const img = pub.image_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg';
        const dateStr = new Date(pub.published_at).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
        const author = pub.author_name || 'Redacción EPT';
        
        // Cortamos la descripción a 250 caracteres para un resumen perfecto y añadimos "..."
        let desc = pub.description || 'Lee el artículo completo en nuestra revista oficial.';
        if (desc.length > 250) desc = desc.substring(0, 250) + '...';

        modalContainer.innerHTML = `
            <div class="modal-overlay" id="pub-iframe-overlay" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);">
                
                <div class="modal" style="width: 95%; max-width: 550px; height: auto; max-height: 90vh; padding: 0; position: relative; overflow-y: auto; background: var(--color-surface); border-radius: 16px; box-shadow: 0 15px 50px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    
                    <div style="width: 100%; height: 220px; position: relative;">
                        <button class="modal-close-btn" style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.5); border: none; font-size: 1.5rem; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; backdrop-filter: blur(4px);">&times;</button>
                        <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 50%; background: linear-gradient(to top, var(--color-surface), transparent);"></div>
                    </div>

                    <div style="padding: 0 2rem 2rem 2rem; position: relative; z-index: 2; margin-top: -20px;">
                        <span style="background: var(--color-accent); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Revista</span>
                        
                        <h2 style="margin: 15px 0 10px 0; font-size: 1.4rem; color: var(--color-primary-text); line-height: 1.3;">${pub.title}</h2>
                        
                        <div style="display: flex; gap: 15px; color: var(--color-secondary-text); font-size: 0.85rem; margin-bottom: 20px; font-weight: 500;">
                            <span><i class="fa-solid fa-pen-nib"></i> ${author}</span>
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                        
                        <p style="color: var(--color-primary-text); font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px; opacity: 0.9;">
                            ${desc}
                        </p>
                        
                        <a href="${pub.url}" target="_blank" class="btn-primary" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 24px; font-size: 1rem; width: 100%; box-shadow: 0 4px 15px rgba(183, 42, 30, 0.4);">
                            Leer artículo completo <i class="fa-solid fa-arrow-right"></i>
                        </a>
                    </div>

                </div>
            </div>
        `;
        
        const overlay = document.getElementById('pub-iframe-overlay');
        const modalBox = overlay.querySelector('.modal');
        document.body.style.overflow = 'hidden'; 
        
        setTimeout(() => {
            overlay.classList.add('is-visible');
            modalBox.style.transform = 'scale(1)';
        }, 10);
        
        const closeFn = () => {
            overlay.classList.remove('is-visible');
            modalBox.style.transform = 'scale(0.95)';
            document.body.style.overflow = '';
            setTimeout(() => { modalContainer.innerHTML = ''; }, 300);
        };
        
        overlay.querySelector('.modal-close-btn').addEventListener('click', closeFn);
        overlay.addEventListener('click', (e) => { if(e.target === overlay) closeFn(); });
    },

    // ==========================================
    // VISOR DE IMÁGENES (LIGHTBOX)
    // ==========================================
    openImageLightbox(src) {
        const overlay = document.getElementById('image-lightbox-overlay');
        const img = document.getElementById('lightbox-full-image');
        if (overlay && img) {
            img.src = src;
            overlay.style.display = 'flex';
            
            // Forzamos un micro-retraso para que la animación CSS se dispare correctamente
            setTimeout(() => overlay.classList.add('is-visible'), 10);
            
            // Cierra al hacer clic en el fondo oscuro o en la X
            overlay.onclick = (e) => { 
                if (e.target === overlay || e.target.id === 'lightbox-close-btn') {
                    overlay.classList.remove('is-visible'); // Iniciamos la desaparición suave
                    
                    // Esperamos a que termine la animación (300ms) para ocultarlo del todo
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        img.src = '';
                    }, 300);
                }
            };
        }
    },

};

// Inicializar la aplicación SOLAMENTE cuando main.js haya preparado Supabase
document.addEventListener('mainReady', () => {
    ComunidadApp.init();
    // Exponemos la app al navegador para que funcionen los OnClick del HTML
window.ComunidadApp = ComunidadApp;
});
