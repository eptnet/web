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

    // --- NUEVO: CONFIGURACIÓN DINÁMICA DE INTERFAZ Y RECOMPENSAS ---
    async setupUserUI() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) return;

        // 1. Pedimos el perfil para ver los XP y las credenciales
        const [profileRes, bskyRes] = await Promise.all([
            this.supabase.from('profiles').select('xp_total').eq('id', session.user.id).single(),
            this.supabase.from('bsky_credentials').select('handle').eq('user_id', session.user.id).maybeSingle()
        ]);

        let currentXP = profileRes.data?.xp_total || 0;
        const handle = bskyRes.data?.handle;

        // 2. LÓGICA DE RECOMPENSAS (Gamificación del Onboarding)
        if (!handle && currentXP < 30) {
            await this.awardXP(session.user.id, 30);
            currentXP = 30;
            this.shootConfetti(1); 
        } else if (handle && currentXP < 100) {
            await this.awardXP(session.user.id, 100);
            currentXP = 100;
            this.shootConfetti(2); 
        }

        // 3. VARIABLE PREPARADA: Aquí sumaremos los XP de los cursos en los que se inscriba.
        // Por ahora es 0, pero el motor ya está preparado para calcularlo.
        let pendingXP = 0; 

        // 4. Dibujamos la interfaz con los datos actualizados
        this.updateMissionUI(handle, currentXP, pendingXP);
    },

    // --- HELPER: RANGOS SIMPLES ---
    getSimpleRank(xp) {
        if (xp < 30) return 'Recluta';
        if (xp < 100) return 'Aprendiz';
        if (xp < 300) return 'Explorador';
        if (xp < 600) return 'Académico';
        return 'Investigador';
    },

    // Función que cambia el HTML basándose en el contrato: XP Actual vs XP Pendientes
    updateMissionUI(handle, currentXP, pendingXP = 0) {
        const missionBtn = document.querySelector('.visitor-profile-card .btn-action');
        const statusText = document.querySelector('.visitor-profile-card p');
        const missionsList = document.querySelector('.missions-box ul');
        
        // NUEVO: Seleccionamos el div del texto rojo de recompensa que está debajo del <ul>
        const rewardText = document.querySelector('.missions-box div');
        
        const rankTitle = this.getSimpleRank(currentXP);
        
        const xpBar = document.getElementById('visitor-xp');
        const levelTag = document.querySelector('.level-tag');
        const xpTextContainer = document.querySelector('.visitor-profile-card .xp-container').previousElementSibling;

        // --- LA MAGIA DE LA BARRA DE CARGA ---
        let targetXP = currentXP < 100 ? 100 : (currentXP + pendingXP);
        let fillPercentage = (currentXP / targetXP) * 100;

        if(xpBar) {
            xpBar.style.width = `${fillPercentage}%`;
            
            // Si el usuario no debe nada (pendingXP = 0) y ya pasó el onboarding, la barra brilla
            if (currentXP >= 100 && pendingXP === 0) {
                xpBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)'; 
                xpBar.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.6)';
            } else {
                // Si tiene cursos pendientes (o está en nivel 0), la barra vuelve a rojo mostrando el hueco
                xpBar.style.background = 'linear-gradient(90deg, #b72a1e, #ff3e3e)'; 
                xpBar.style.boxShadow = '0 0 10px var(--color-edu-accent)';
            }
        }

        if(levelTag) levelTag.innerText = rankTitle.toUpperCase();

        if(xpTextContainer) {
            xpTextContainer.innerHTML = `
                <span>XP COMPLETADOS</span>
                <span style="color: var(--color-edu-accent); font-weight: 900;">${currentXP} / ${targetXP} XP</span>
            `;
        }

        document.querySelector('.visitor-profile-card h3').innerText = `Rango: ${rankTitle}`;

        // --- TEXTOS Y ADVERTENCIAS ---
        if (handle) {
            // ESTADO: USUARIO CON BLUESKY (Mínimo 100 XP)
            if(statusText) statusText.innerHTML = `<span style="color:#0085ff; font-weight:bold;">@${handle}</span> verificado`;
            
            // Ocultamos el texto estático de "Recompensa +100 XP" porque ya la ganó
            if(rewardText) rewardText.style.display = 'none';
            
            if(missionBtn) {
                missionBtn.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Explorar Cursos';
                missionBtn.onclick = () => document.getElementById('courses-grid').scrollIntoView({behavior: 'smooth'});
                missionBtn.classList.remove('trigger-login-modal');
            }
            
            if(missionsList) {
                if (pendingXP > 1000) {
                    missionsList.innerHTML = `<li style="color: #ef4444;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Sobrecarga Académica:</strong> Tienes más de 1000 XP en cursos pendientes. Concéntrate en terminar uno a la vez.</li>`;
                } else if (pendingXP > 0) {
                    missionsList.innerHTML = `<li style="color: #f59e0b;"><strong><i class="fa-solid fa-person-running"></i> Entrenando:</strong> Tienes ${pendingXP} XP en progreso. ¡Ve al Aula para completarlos!</li>`;
                } else {
                    missionsList.innerHTML = `
                        <li style="color: #10b981;"><strong>✓ Identidad Descentralizada Activa</strong></li>
                        <li style="margin-top: 8px;"><strong>Siguiente Reto:</strong> Inscríbete a un curso para desafiarte y crear un nuevo objetivo en tu barra de XP.</li>
                    `;
                }
            }
        } else {
            // ESTADO: USUARIO DE SUPABASE (30 XP - Le falta Bluesky)
            if(statusText) statusText.innerHTML = `Identidad no vinculada`;
            
            // Aseguramos que se vea el texto de recompensa si aún no ha completado la misión
            if(rewardText) rewardText.style.display = 'block';

            if(missionBtn) {
                missionBtn.innerHTML = '<i class="fa-brands fa-bluesky"></i> Vincular Bluesky';
                missionBtn.onclick = () => this.openBlueskyModal();
                missionBtn.classList.remove('trigger-login-modal');
            }
            if(missionsList) {
                missionsList.innerHTML = `
                    <li style="color: #10b981;"><strong>✓ Registro Completado (+30 XP)</strong></li>
                    <li style="margin-top: 8px;"><strong>Misión 2:</strong> Conecta tu cuenta Bluesky para habilitar la interacción social (+70 XP).</li>
                `;
            }
        }
    },

    // --- FUNCIONES AUXILIARES DE GAMIFICACIÓN ---
    async awardXP(userId, newTotalXP) {
        const { error } = await this.supabase
            .from('profiles')
            .update({ xp_total: newTotalXP })
            .eq('id', userId);
        
        if (error) console.error("Error al guardar los XP en la base de datos:", error);
    },

    shootConfetti(intensityLevel = 1) {
        if (typeof confetti === 'undefined') return;

        const duration = intensityLevel === 1 ? 1500 : 3500;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: intensityLevel === 1 ? 3 : 6,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#b72a1e', '#ff3e3e', '#ffffff', '#0085ff']
            });
            confetti({
                particleCount: intensityLevel === 1 ? 3 : 6,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#b72a1e', '#ff3e3e', '#ffffff', '#0085ff']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    },

    // --- MOTOR RPG: CALCULADOR DE NIVELES ---
    getLevelData(xp) {
        // Define los umbrales de experiencia para cada nivel
        const levels = [
            { threshold: 0, title: 'Recluta' },             // Nivel 0
            { threshold: 30, title: 'Aprendiz' },           // Nivel 1 (Registro)
            { threshold: 100, title: 'Explorador' },        // Nivel 2 (Bluesky)
            { threshold: 300, title: 'Académico' },         // Nivel 3 (Tras completar ~1 curso)
            { threshold: 600, title: 'Investigador' },      // Nivel 4 
            { threshold: 1200, title: 'Erudito' },          // Nivel 5
            { threshold: 2500, title: 'Leyenda EPT' }       // Nivel 6 (Máximo actual)
        ];

        let currentLevel = 0;
        for (let i = 0; i < levels.length; i++) {
            if (xp >= levels[i].threshold) currentLevel = i;
        }

        const isMaxLevel = currentLevel === levels.length - 1;
        const nextLevelXP = isMaxLevel ? xp : levels[currentLevel + 1].threshold;
        const previousLevelXP = levels[currentLevel].threshold;
        
        let progress = 100;
        if (!isMaxLevel) {
            // Calcula el porcentaje EXACTO de la barra para el nivel actual
            progress = ((xp - previousLevelXP) / (nextLevelXP - previousLevelXP)) * 100;
        }

        return {
            levelNum: currentLevel,
            title: levels[currentLevel].title,
            currentXP: xp,
            nextXP: nextLevelXP,
            progressPercent: progress,
            isMaxLevel: isMaxLevel
        };
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
            
            // LA CLAVE: Forzamos la URL exacta para que coincida con el JSON sin query strings.
            const exactRedirectUri = window.location.origin + window.location.pathname;

            try {
                // Aquí llamamos a la Edge Function que nos arrojaba el 400
                const { data, error } = await this.supabase.functions.invoke('bsky-oauth-init', {
                    body: { redirect_uri: exactRedirectUri }
                });

                if (error) throw error;
                
                // ¡El salto a la autenticación de Bluesky!
                if (data?.auth_url) {
                    window.location.href = data.auth_url;
                } else {
                    throw new Error("La Edge Function no devolvió una URL.");
                }

            } catch (err) {
                console.error("Error iniciando OAuth en Campus:", err);
                alert("No se pudo conectar con Bluesky en este momento. Revisa la consola.");
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

    // --- EL GUARDIÁN DE ENTRADA E INSCRIPCIÓN SILENCIOSA ---
    async attemptEntry(slug) {
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (session) {
            // 1. VERIFICACIÓN ESTRICTA DE BLUESKY ANTES DE ENTRAR
            const { data: bsky } = await this.supabase
                .from('bsky_credentials')
                .select('handle')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (!bsky) {
                alert("Debes vincular tu cuenta de Bluesky (Misión 2) antes de entrar a un curso.");
                document.getElementById('course-preview-modal').innerHTML = '';
                this.openBlueskyModal();
                return;
            }

            // 2. Efecto visual inmersivo
            const btn = document.querySelector('#course-preview-modal .btn-action');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando tu expediente...';
            }

            // 3. Buscar el ID del curso
            const course = this.loadedCourses.find(c => c.slug === slug);
            
            if (course) {
                // 4. Inscribir silenciosamente
                const { error } = await this.supabase
                    .from('nooc_enrollments')
                    .insert([{ user_id: session.user.id, course_id: course.id }]);
                
                if (error && error.code !== '23505') console.warn("Aviso de inscripción:", error.message);
            }

            // 5. Salto al aula
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