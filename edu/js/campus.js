const EptCampus = {
    supabase: null,
    loadedCourses: [], // Guardamos los cursos en memoria para el modal

    init() {
        document.addEventListener('mainReady', async () => {
            const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
            this.supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            await this.renderCourses();

            // Dentro de NoocRoom.init o EptCampus.init después de obtener la sesión:
            const { data: { session } } = await this.supabase.auth.getSession();
            const missionBtn = document.querySelector('.visitor-profile-card .btn-action');

            if (session) {
                // Verificamos si ya tiene credenciales de Bluesky
                const { data: creds } = await this.supabase.from('bsky_credentials').select('id').eq('user_id', session.user.id).maybeSingle();
                
                if (!creds) {
                    // CAMBIO DE BOTÓN: El usuario ya está logueado pero falta Bluesky
                    if (missionBtn) {
                        missionBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Vincular Bluesky';
                        missionBtn.classList.remove('trigger-login-modal'); // Ya no abre el login
                        missionBtn.onclick = () => this.openBlueskyModal(); // Abre el modal de Bsky
                    }
                    // Actualizamos visualmente la lista de misiones
                    const missionsList = document.querySelector('.missions-box ul');
                    if (missionsList) {
                        missionsList.innerHTML = `
                            <li><strong>Misión 1:</strong> ✅ ¡Logrado!</li>
                            <li><strong>Misión 2:</strong> Conecta tu cuenta Bluesky.</li>
                        `;
                    }
                } else {
                    // USUARIO COMPLETO: Ocultamos el botón o lo mandamos al perfil
                    if (missionBtn) {
                        missionBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Ir a mi Perfil';
                        missionBtn.onclick = () => window.location.href = '/inv/profile.html';
                    }
                }
            }
        });

        setTimeout(() => {
            if (!this.supabase) document.dispatchEvent(new Event('mainReady'));
        }, 1500);
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
            if (!courses || courses.length === 0) return; // (Mantenemos tu diseño vacío original)

            this.loadedCourses = courses; // Guardamos en memoria

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

    // --- NUEVO: MODAL DE INFORMACIÓN DEL CURSO ---
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

    // --- NUEVO: EL GUARDIÁN DE ENTRADA ---
    async attemptEntry(slug) {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            // Tiene sesión -> Pasa directo al aula
            window.location.href = `/edu/nooc.html?c=${slug}`;
        } else {
            // No tiene sesión -> Cerramos el modal de info y abrimos el de login
            document.getElementById('course-preview-modal').innerHTML = '';
            const loginBtn = document.querySelector('.trigger-login-modal');
            if (loginBtn) {
                // Guardamos el destino para redirigir después del login (A implementar en main.js luego si deseas)
                sessionStorage.setItem('redirect_after_login', `/edu/nooc.html?c=${slug}`);
                loginBtn.click();
            } else {
                alert("Debes iniciar sesión para entrar al aula.");
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
                <div class="modal-content bento-card" style="position:relative; width:90%; max-width:400px;">
                    <button onclick="document.getElementById('ept-global-modal').innerHTML=''" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">&times;</button>
                    <div id="bsky-injection-zone"></div>
                </div>
            </div>
        `;

        document.getElementById('bsky-injection-zone').appendChild(template.content.cloneNode(true));

        document.getElementById('bsky-oauth-start-btn').onclick = async (e) => {
            e.target.disabled = true;
            e.target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redirigiendo...';
            
            // Iniciamos el OAuth
            const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', {
                body: { redirect_uri: window.location.href }
            });
            if (data?.auth_url) window.location.href = data.auth_url;
        };
    }
};

document.addEventListener('DOMContentLoaded', () => EptCampus.init());