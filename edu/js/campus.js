const EptCampus = {
    supabase: null,
    loadedCourses: [],

    init() {
        document.addEventListener('mainReady', async () => {
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

            // 1. Primero atrapamos cualquier retorno de Bluesky antes de dibujar
            await this.checkForBlueskyCallback();

            // 2. Luego renderizamos los cursos
            await this.renderCourses();

            // 3. Verificamos la sesión para la tarjeta de misiones
            await this.setupUserUI();
        });

        setTimeout(() => {
            if (!this.supabase) document.dispatchEvent(new Event('mainReady'));
        }, 1500);
    },

    // --- NUEVO: CONFIGURACIÓN DINÁMICA DE INTERFAZ ---
    async setupUserUI() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) return;

        // Leemos solo el handle, el Edge Function ya se encargó del JSON
        const { data: bsky, error: dbError } = await this.supabase
            .from('bsky_credentials')
            .select('handle')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (dbError) console.error("Error buscando credenciales:", dbError);

        this.updateMissionUI(bsky?.handle);
    },

    // Función que cambia el HTML sin necesidad de recargar la página
    updateMissionUI(handle) {
        const missionBtn = document.querySelector('.visitor-profile-card .btn-action');
        const statusText = document.querySelector('.visitor-profile-card p');
        const missionsList = document.querySelector('.missions-box ul');

        if (handle) {
            // ESTADO: USUARIO CON BLUESKY (MISIONES COMPLETADAS)
            if(statusText) statusText.innerHTML = `<span style="color:#0085ff; font-weight:bold;">@${handle}</span> verificado`;
            if(missionBtn) {
                missionBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Ir a mi Perfil';
                missionBtn.onclick = () => window.location.href = '/inv/profile.html';
                missionBtn.classList.remove('trigger-login-modal');
            }
            if(missionsList) {
                missionsList.innerHTML = `
                    <li><strong>Misión 1:</strong> ✅ ¡Registrado!</li>
                    <li><strong>Misión 2:</strong> ✅ ¡Identidad Vinculada!</li>
                `;
            }
        } else {
            // ESTADO: USUARIO DE SUPABASE (LE FALTA BLUESKY)
            if(missionBtn) {
                missionBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Vincular Bluesky';
                missionBtn.onclick = () => this.openBlueskyModal();
                missionBtn.classList.remove('trigger-login-modal');
            }
            if(missionsList) {
                missionsList.innerHTML = `
                    <li><strong>Misión 1:</strong> ✅ ¡Logrado!</li>
                    <li><strong>Misión 2:</strong> Conecta tu cuenta Bluesky.</li>
                `;
            }
        }
    },

    // --- CAPTURADOR OAUTH SIN RECARGAS ---
    async checkForBlueskyCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
            // Borra los tokens de la URL limpiamente sin recargar
            window.history.replaceState({}, document.title, window.location.pathname);
            
            if (window.showToast) window.showToast("⏳ Sincronizando identidad académica...");

            try {
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-callback', {
                    body: { 
                        code, 
                        state, 
                        redirect_uri: window.location.origin + window.location.pathname 
                    }
                });

                if (error) throw error;
                if (window.showToast) window.showToast(`✅ ¡Identidad vinculada, @${data.handle}!`);
                
                // MAGIA: Actualizamos el botón de la misión instantáneamente sin refrescar
                this.updateMissionUI(data.handle);
                
            } catch (err) {
                console.error("Error al procesar el Callback:", err);
                alert("Hubo un error al validar tu cuenta con Bluesky.");
            }
        }
    },

    openBlueskyModal() {
        const template = document.getElementById('bsky-connect-template');
        let modalContainer = document.getElementById('ept-global-modal');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'ept-global-modal';
            document.body.appendChild(modalContainer);
        }

        modalContainer.innerHTML = `
            <div class="modal-overlay is-visible" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);">
                <div class="modal-content bento-card" style="position:relative; width:90%; max-width:400px; text-align:center;">
                    <button onclick="document.getElementById('ept-global-modal').innerHTML=''" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                    <div id="bsky-injection-zone"></div>
                </div>
            </div>
        `;

        document.getElementById('bsky-injection-zone').appendChild(template.content.cloneNode(true));

        document.getElementById('bsky-oauth-start-btn').onclick = async (e) => {
            e.target.disabled = true;
            e.target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redirigiendo...';
            
            const exactRedirectUri = window.location.origin + window.location.pathname;

            try {
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', {
                    body: { redirect_uri: exactRedirectUri }
                });

                if (error) throw error;
                if (data?.auth_url) window.location.href = data.auth_url;

            } catch (err) {
                console.error("Error Edge Function:", err);
                alert("No se pudo iniciar la conexión segura con Bluesky.");
                e.target.disabled = false;
                e.target.innerHTML = '<i class="fa-brands fa-bluesky"></i> Autorizar con Bluesky';
            }
        };
    },

    async renderCourses() {
        const container = document.getElementById('dynamic-courses-container');
        try {
            const { data: courses, error } = await this.supabase
                .from('nooc_courses')
                .select('*')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!courses || courses.length === 0) return;

            this.loadedCourses = courses; 

            container.innerHTML = courses.map(course => `
                <div class="edu-card nooc-thumb-card nooc-item" onclick="EptCampus.openCourseModal('${course.slug}')" style="cursor:pointer;">
                    <img src="${course.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" class="nooc-image" alt="${course.title}">
                    <div class="nooc-content">
                        <span style="font-size: 0.75rem; font-weight: 900; color: var(--color-edu-accent); text-transform: uppercase;">Módulo EPT</span>
                        <h4 class="nooc-title" style="margin: 8px 0 10px 0; font-size: 1.3rem;">${course.title}</h4>
                        <p class="nooc-desc" style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 20px; line-height: 1.4;">
                            Explora este nano-curso, supera los módulos y certifica tu conocimiento.
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.9rem; font-weight: bold; color: #f59e0b;"><i class="fa-solid fa-star"></i> Gamificado</span>
                            <button class="btn-action" style="width: auto; margin: 0; padding: 8px 15px; font-size: 0.8rem;">Ver Detalles</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error("Error crítico:", err);
        }
    },

    openCourseModal(slug) {
        const course = this.loadedCourses.find(c => c.slug === slug);
        if (!course) return;

        let modalContainer = document.getElementById('course-preview-modal');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'course-preview-modal';
            document.body.appendChild(modalContainer);
        }

        modalContainer.innerHTML = `
            <div class="modal-overlay is-visible" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(10px);">
                <div class="modal-content edu-card" style="position:relative; width:90%; max-width:550px; padding:0; overflow:hidden;">
                    <button onclick="document.getElementById('course-preview-modal').innerHTML=''" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.5); border:none; width:35px; height:35px; border-radius:50%; color:white; font-size:1.2rem; cursor:pointer; z-index:10;">&times;</button>
                    
                    <img src="${course.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" style="width:100%; height:200px; object-fit:cover;">
                    
                    <div style="padding: 30px;">
                        <span class="xp-badge" style="background:rgba(255,62,62,0.1); color:var(--color-edu-accent); padding:5px 15px; font-size:0.7rem; border:1px solid rgba(255,62,62,0.3);">+ XP Disponible</span>
                        <h2 style="font-size: 2rem; margin: 15px 0 10px 0;">${course.title}</h2>
                        <p style="opacity: 0.8; line-height: 1.5; margin-bottom: 25px;">
                            Únete a este NOOC interactivo. Completa las lecciones, participa en el debate descentralizado y obtén tu certificación verificada en la red EPT.
                        </p>
                        
                        <button onclick="EptCampus.attemptEntry('${course.slug}')" class="btn-action" style="width: 100%; padding: 15px; font-size: 1rem;">
                            <i class="fa-solid fa-door-open"></i> Inscribirse / Entrar al Aula
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async attemptEntry(slug) {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            window.location.href = `/edu/nooc.html?c=${slug}`;
        } else {
            document.getElementById('course-preview-modal').innerHTML = '';
            const loginBtn = document.querySelector('.trigger-login-modal');
            if (loginBtn) {
                sessionStorage.setItem('redirect_after_login', `/edu/nooc.html?c=${slug}`);
                loginBtn.click();
            } else {
                alert("Debes iniciar sesión para entrar al aula.");
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => EptCampus.init());