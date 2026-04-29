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

    // --- FUNCIONES DE FILTRO Y SOCIALES ---
    filterCourses(type, activeBtn) {
        // Restablecemos el estilo de todos los botones de filtro a "inactivo"
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.style.background = 'rgba(255,255,255,0.05)';
            btn.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        
        // Encendemos el botón activo
        activeBtn.style.background = 'var(--color-edu-accent)';
        activeBtn.style.borderColor = 'var(--color-edu-accent)';

        // Filtramos las tarjetas (El CSS 'display: flex' o 'display: none' se encarga de reacomodarlas)
        const items = document.querySelectorAll('.nooc-item');
        items.forEach(item => {
            if (type === 'all') {
                item.style.display = 'flex';
            } else if (type === 'enrolled') {
                item.style.display = item.dataset.enrolled === 'true' ? 'flex' : 'none';
            } else if (type === 'wishlist') {
                item.style.display = item.dataset.wishlist === 'true' ? 'flex' : 'none';
            }
        });
    },

    toggleWishlist(courseId, btn) {
        const card = btn.closest('.nooc-item');
        const icon = btn.querySelector('i');
        const isWishlist = card.dataset.wishlist === 'true';
        
        // Recuperamos la lista guardada en el navegador
        let savedWishlist = JSON.parse(localStorage.getItem('ept_wishlist') || '[]');

        if (isWishlist) {
            // Quitar de deseos
            card.dataset.wishlist = 'false';
            icon.className = 'fa-regular fa-heart';
            icon.style.color = 'white';
            savedWishlist = savedWishlist.filter(id => id !== courseId);
        } else {
            // Añadir a deseos
            card.dataset.wishlist = 'true';
            icon.className = 'fa-solid fa-heart';
            icon.style.color = 'var(--color-edu-accent)';
            if (!savedWishlist.includes(courseId)) savedWishlist.push(courseId);
            if (window.showToast) window.showToast("Añadido a tus deseos");
        }

        // Guardamos los cambios
        localStorage.setItem('ept_wishlist', JSON.stringify(savedWishlist));
    },

    shareCourse(slug) {
        const longUrl = window.location.origin + `/edu/nooc.html?c=${slug}`;
        const shareTitle = `Reto en Epistecnología`;
        const shareText = `¡Te reto a superar este nano-curso conmigo y ganar 300 XP en EPT Edu!`;

        // Llamamos a tu Función de Modal Universal (Adaptada de comunidad.js)
        this.showCustomShareModal(longUrl, shareTitle, shareText);
    },

    // --- EL MODAL UNIVERSAL CON ACORTADOR (Is.gd) ---
    showCustomShareModal(longUrl, title, text) {
        const existingModal = document.getElementById('custom-share-modal');
        if (existingModal) existingModal.remove();

        const encodedText = encodeURIComponent(text);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const nativeShareBtnHtml = (isMobile && navigator.share) ? `
            <button id="btn-native-share" style="width: 100%; padding: 12px; margin-bottom: 15px; background: white; color: black; border: none; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform 0.2s;">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Más opciones (Nativo)
            </button>
        ` : '';

        const modalHtml = `
            <div id="custom-share-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); opacity: 0; transition: opacity 0.3s ease;">
                <div style="background: var(--color-edu-surface); padding: 25px; border-radius: 20px; width: 90%; max-width: 380px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); transform: translateY(20px); transition: transform 0.3s ease;">
                    <h3 style="margin-top: 0; margin-bottom: 20px; color: white; font-size: 1.2rem; text-align: center;">Retar a un amigo</h3>
                    
                    ${nativeShareBtnHtml}
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <a id="share-wa" href="https://api.whatsapp.com/send?text=${encodedText}%0A${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: white; padding: 15px; border-radius: 15px; background: rgba(37, 211, 102, 0.2); border: 1px solid rgba(37, 211, 102, 0.5);">
                            <i class="fa-brands fa-whatsapp" style="font-size: 2rem; color: #25D366;"></i>
                            <span style="font-size: 0.85rem; font-weight: 600;">WhatsApp</span>
                        </a>
                        <a id="share-tw" href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: white; padding: 15px; border-radius: 15px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);">
                            <i class="fa-brands fa-x-twitter" style="font-size: 2rem;"></i>
                            <span style="font-size: 0.85rem; font-weight: 600;">X (Twitter)</span>
                        </a>
                        <a id="share-fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: white; padding: 15px; border-radius: 15px; background: rgba(24, 119, 242, 0.2); border: 1px solid rgba(24, 119, 242, 0.5);">
                            <i class="fa-brands fa-facebook" style="font-size: 2rem; color: #1877F2;"></i>
                            <span style="font-size: 0.85rem; font-weight: 600;">Facebook</span>
                        </a>
                        <a id="share-in" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(longUrl)}" target="_blank" style="display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; color: white; padding: 15px; border-radius: 15px; background: rgba(10, 102, 194, 0.2); border: 1px solid rgba(10, 102, 194, 0.5);">
                            <i class="fa-brands fa-linkedin" style="font-size: 2rem; color: #0a66c2;"></i>
                            <span style="font-size: 0.85rem; font-weight: 600;">LinkedIn</span>
                        </a>
                    </div>

                    <button id="btn-copy-share" style="width: 100%; padding: 12px; background: var(--color-edu-accent); color: white; border: none; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fa-solid fa-spinner fa-spin"></i> Acortando enlace...
                    </button>
                    
                    <button id="btn-close-share" style="width: 100%; padding: 10px; margin-top: 10px; background: transparent; color: rgba(255,255,255,0.6); border: none; border-radius: 12px; font-weight: 600; cursor: pointer;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('custom-share-modal');
        let finalUrl = longUrl; 

        // Animación de entrada
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.children[0].style.transform = 'translateY(0)';
        }, 10);

        // --- ACORTADOR EN SEGUNDO PLANO ---
        const callbackName = 'isgd_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            if (data.shorturl) {
                finalUrl = data.shorturl;
                document.getElementById('share-wa').href = `https://api.whatsapp.com/send?text=${encodedText}%0A${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-tw').href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(finalUrl)}`;
                document.getElementById('share-in').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(finalUrl)}`;
            }
            const copyBtn = document.getElementById('btn-copy-share');
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Enlace Corto';
        };

        const script = document.createElement('script');
        script.src = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}&callback=${callbackName}`;
        script.onerror = function() {
            delete window[callbackName];
            document.getElementById('btn-copy-share').innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Enlace';
        };
        document.body.appendChild(script);

        // --- EVENTOS DEL MODAL ---
        document.getElementById('btn-copy-share').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(finalUrl);
                const copyBtn = document.getElementById('btn-copy-share');
                copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
                copyBtn.style.background = '#10b981';
                setTimeout(() => closeModal(), 1500);
            } catch (e) { console.error(e); }
        });

        const nativeBtn = document.getElementById('btn-native-share');
        if (nativeBtn) {
            nativeBtn.addEventListener('click', async () => {
                try {
                    await navigator.share({ title: title, text: text, url: finalUrl });
                    closeModal();
                } catch (err) { console.error(err); }
            });
        }

        const closeModal = () => {
            modal.style.opacity = '0';
            modal.children[0].style.transform = 'translateY(20px)';
            setTimeout(() => modal.remove(), 300);
        };
        
        document.getElementById('btn-close-share').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    },

    // --- CONFIGURACIÓN DINÁMICA DE INTERFAZ Y RECOMPENSAS ---
    async setupUserUI() {
        const { data: { session } } = await this.supabase.auth.getSession();
        if (!session) return;

        // Pedimos perfil, credenciales E inscripciones
        const [profileRes, bskyRes, enrollsRes] = await Promise.all([
            this.supabase.from('profiles').select('xp_total').eq('id', session.user.id).single(),
            this.supabase.from('bsky_credentials').select('handle').eq('user_id', session.user.id).maybeSingle(),
            this.supabase.from('nooc_enrollments').select('course_id').eq('user_id', session.user.id)
        ]);

        let currentXP = profileRes.data?.xp_total || 0;
        const handle = bskyRes.data?.handle;
        const enrolledCount = enrollsRes.data ? enrollsRes.data.length : 0;

        // Gamificación del Onboarding
        if (!handle && currentXP < 30) {
            await this.awardXP(session.user.id, 30);
            currentXP = 30;
            this.shootConfetti(1); 
        } else if (handle && currentXP < 100) {
            await this.awardXP(session.user.id, 100);
            currentXP = 100;
            this.shootConfetti(2); 
        }

        // Pasamos cuántos cursos tiene para calcular el tamaño de la barra
        this.updateMissionUI(handle, currentXP, enrolledCount);
    },

    // --- HELPER: RANGOS SIMPLES ---
    getSimpleRank(xp) {
        if (xp < 30) return 'Recluta';
        if (xp < 100) return 'Aprendiz';
        if (xp < 300) return 'Explorador';
        if (xp < 600) return 'Académico';
        return 'Investigador';
    },

    // --- INTERFAZ: LA BARRA DE CAPACIDAD ---
    updateMissionUI(handle, currentXP, enrolledCount = 0) {
        const missionBtn = document.querySelector('.visitor-profile-card .btn-action');
        const statusText = document.querySelector('.visitor-profile-card p');
        const missionsList = document.querySelector('.missions-box ul');
        
        const rankTitle = this.getSimpleRank(currentXP);
        
        const xpBar = document.getElementById('visitor-xp');
        const levelTag = document.querySelector('.level-tag');
        const xpTextContainer = document.querySelector('.visitor-profile-card .xp-container').previousElementSibling;

        // LA MAGIA: Cada curso inscrito aumenta la capacidad total de la barra en 300 XP
        let targetXP = 100 + (enrolledCount * 300); 
        
        // Protección por si gana XP extra de otras formas
        if (currentXP > targetXP) targetXP = currentXP; 

        // Calculamos cuánto rellenar
        let fillPercentage = (currentXP / targetXP) * 100;

        if(xpBar) {
            xpBar.style.width = `${fillPercentage}%`;
            
            // Si la barra está al 100% (No debe nada), brilla. Si debe XP, se pone roja mostrando el reto.
            if (currentXP >= targetXP) {
                xpBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)'; 
                xpBar.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.6)';
            } else {
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

        let pendingXP = targetXP - currentXP;

        // TEXTOS Y ADVERTENCIAS
        if (handle) {
            if(statusText) statusText.innerHTML = `<span style="color:#0085ff; font-weight:bold;">@${handle}</span> verificado`;
            if(missionBtn) {
                missionBtn.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> Explorar Cursos';
                missionBtn.onclick = () => document.getElementById('courses-grid').scrollIntoView({behavior: 'smooth'});
                missionBtn.classList.remove('trigger-login-modal');
            }
            if(missionsList) {
                if (pendingXP > 1000) {
                    missionsList.innerHTML = `<li style="color: #ef4444;"><strong><i class="fa-solid fa-triangle-exclamation"></i> Sobrecarga:</strong> Tienes más de 1000 XP pendientes. Concéntrate en terminar un curso a la vez.</li>`;
                } else if (pendingXP > 0) {
                    missionsList.innerHTML = `<li style="color: #f59e0b;"><strong><i class="fa-solid fa-person-running"></i> Entrenando:</strong> Tienes ${pendingXP} XP en progreso. ¡Ve al Aula para completarlos!</li>`;
                } else {
                    missionsList.innerHTML = `
                        <li style="color: #10b981;"><strong>✓ Sin tareas pendientes</strong></li>
                        <li style="margin-top: 8px;"><strong>Siguiente Reto:</strong> Inscríbete a un curso para crear un nuevo objetivo en tu barra de XP.</li>
                    `;
                }
            }
        }
        // ... (Si no tiene handle, se queda el código que ya tienes de invitar a vincular Bsky)
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
            const { data: { session } } = await this.supabase.auth.getSession();
            let enrolledIds = [];
            
            if (session) {
                const { data: enrolls } = await this.supabase.from('nooc_enrollments').select('course_id').eq('user_id', session.user.id);
                if (enrolls) enrolledIds = enrolls.map(e => e.course_id);
            }

            const { data: courses, error } = await this.supabase
                .from('nooc_courses')
                .select('*')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!courses || courses.length === 0) return;

            this.loadedCourses = courses; 

            // 1. INYECTAMOS LA BARRA DE FILTROS DENTRO DE LA TARJETA DEL USUARIO
            const userCard = document.querySelector('.visitor-profile-card');
            if (userCard) {
                // Verificamos que no se hayan inyectado ya para no duplicarlos
                if (!document.getElementById('campus-filters')) {
                    const filterHtml = `
                        <div id="campus-filters" style="width: 100%; display: flex; flex-direction: column; gap: 8px; margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 15px;">
                            <button class="btn-filter" style="background: var(--color-edu-accent); border: 1px solid var(--color-edu-accent); color: white; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: bold; width: 100%; transition: 0.2s;" onclick="EptCampus.filterCourses('all', this)">Explorar Todos</button>
                            <div style="display: flex; gap: 8px; width: 100%;">
                                <button class="btn-filter" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: 0.2s;" onclick="EptCampus.filterCourses('enrolled', this)"><i class="fa-solid fa-graduation-cap"></i> Mis Cursos</button>
                                <button class="btn-filter" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 15px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: 0.2s;" onclick="EptCampus.filterCourses('wishlist', this)"><i class="fa-solid fa-heart"></i> Deseados</button>
                            </div>
                        </div>
                    `;
                    userCard.insertAdjacentHTML('beforeend', filterHtml);
                }
            }

            // 2. RECUPERAMOS LOS DESEOS GUARDADOS EN EL NAVEGADOR
            const savedWishlist = JSON.parse(localStorage.getItem('ept_wishlist') || '[]');

            // 3. INYECTAMOS LAS TARJETAS DE CURSOS
            container.innerHTML = courses.map(course => {
                const isEnrolled = enrolledIds.includes(course.id);
                const isWishlisted = savedWishlist.includes(course.id);
                
                const btnText = isEnrolled ? '<i class="fa-solid fa-play"></i> Continuar' : 'Ver Detalles';
                const btnColor = isEnrolled ? 'background: #10b981; border-color: #10b981;' : ''; 
                
                const wishIcon = isWishlisted ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
                const wishColor = isWishlisted ? 'var(--color-edu-accent)' : 'white';
                
                return `
                <div class="edu-card nooc-thumb-card nooc-item" data-enrolled="${isEnrolled}" data-wishlist="${isWishlisted}" onclick="EptCampus.openCourseModal('${course.slug}')" style="cursor:pointer; position: relative;">
                    
                    <div style="position: absolute; top: 15px; left: 15px; background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.2); color: #fbbf24; font-weight: 900; font-size: 0.8rem; padding: 5px 12px; border-radius: 20px; z-index: 10; backdrop-filter: blur(5px); box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                        <i class="fa-solid fa-bolt"></i> 300 XP
                    </div>
                    
                    <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 10;">
                        <button onclick="event.stopPropagation(); EptCampus.toggleWishlist('${course.id}', this)" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); cursor: pointer; transition: 0.2s;" title="Añadir a deseos">
                            <i class="${wishIcon}" style="color: ${wishColor}"></i>
                        </button>
                        <button onclick="event.stopPropagation(); EptCampus.shareCourse('${course.slug}')" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); cursor: pointer; transition: 0.2s;" title="Retar a un amigo">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>

                    <img src="${course.thumbnail_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png'}" class="nooc-image" alt="${course.title}">
                    
                    <div class="nooc-content">
                        <span style="font-size: 0.75rem; font-weight: 900; color: var(--color-edu-accent); text-transform: uppercase;">Módulo EPT</span>
                        <h4 class="nooc-title" style="margin: 8px 0 10px 0; font-size: 1.3rem;">${course.title}</h4>
                        <p class="nooc-desc" style="font-size: 0.95rem; opacity: 0.8; margin-bottom: 20px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            Explora este nano-curso, supera los módulos y certifica tu conocimiento.
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.9rem; font-weight: bold; color: #f59e0b;"><i class="fa-solid fa-star"></i> Gamificado</span>
                            <button class="btn-action" style="width: auto; margin: 0; padding: 8px 15px; font-size: 0.8rem; ${btnColor}">${btnText}</button>
                        </div>
                    </div>
                </div>
            `}).join('');

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
                            <i class="fa-solid fa-door-open"></i> Entrar al Aula
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