// =================================================================
// ARCHIVO ESTRICTO: /inv/js/manager-proyectos.js 
// - Fuerza la selección manual (no recuerda caché anterior)
// - Incluye buscador de proyectos en tiempo real
// - Altura de tarjetas uniforme
// =================================================================

export const Projects = {
    listenersAttached: false,
    projectList: [],

    async init() {
        // Obligamos al usuario a seleccionar el proyecto desde cero cada vez que entra
        sessionStorage.removeItem('activeProject');
        
        await this.fetchProjects();
        
        if (!this.listenersAttached) {
            this.addEventListeners();
            this.listenersAttached = true;
        }
    },

    async fetchProjects() {
        const container = document.getElementById('projects-list-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center; padding:2rem; color: var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando tus proyectos...</div>';

        try {
            const { data, error } = await window.App.supabase
                .from('projects')
                .select('*')
                .eq('user_id', window.App.userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.projectList = data || [];
            this.renderProjects(this.projectList); // Pasamos la lista completa inicial
            
        } catch (err) {
            console.error("Error al cargar proyectos:", err);
            container.innerHTML = '<p style="color: var(--color-danger); text-align:center;">Hubo un error al cargar tus proyectos.</p>';
        }
    },

    renderProjects(projectsToRender) {
        const container = document.getElementById('projects-list-container');
        if (!container) return;

        if (this.projectList.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem; background: var(--color-surface); border: 2px dashed var(--color-border); border-radius: 16px;">
                    <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--color-text-secondary); margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--color-text-primary); font-size: 1.2rem;">Aún no tienes proyectos de investigación</h4>
                    <p style="color: var(--color-text-secondary); font-size: 0.95rem; margin-bottom: 1.5rem; max-width: 400px; margin-inline: auto;">Para comenzar a crear artículos, eventos o transmisiones, necesitas dar de alta tu primer proyecto (DOI).</p>
                    <a href="/inv/profile.html" class="btn-primary" style="text-decoration: none;"><i class="fa-solid fa-plus"></i> Registrar Proyecto</a>
                </div>
            `;
            return;
        }

        // 1. Inyectamos la barra de búsqueda siempre (solo la dibujamos si no existe ya)
        let searchBarHTML = '';
        if (!document.getElementById('project-search-input')) {
            searchBarHTML = `
                <div class="project-search-bar">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="project-search-input" placeholder="Buscar proyecto por título o DOI...">
                </div>
            `;
        }

        // 2. Si la búsqueda no arroja resultados
        if (projectsToRender.length === 0) {
            const gridHTML = `<div id="project-grid-wrapper"><p style="color: var(--color-text-secondary); padding: 1rem;">No se encontraron proyectos con ese término.</p></div>`;
            
            // Si la barra ya existe, solo actualizamos la grilla
            if (document.getElementById('project-search-input')) {
                const oldGrid = document.getElementById('project-grid-wrapper');
                if(oldGrid) oldGrid.outerHTML = gridHTML;
            } else {
                container.innerHTML = searchBarHTML + gridHTML;
            }
            return;
        }

        // 3. Dibujamos los proyectos filtrados
        let projectsHTML = projectsToRender.map((p) => {
            // Usamos el ID real del proyecto para asegurarnos de que el índice no se rompa al filtrar
            const safeId = p.id;
            return `
            <label class="project-card" for="project-${safeId}">
                <input type="radio" name="project-selector" id="project-${safeId}" value="${safeId}">
                <div class="project-card-content">
                    <div class="project-icon-wrapper"><i class="fa-solid fa-folder-open"></i></div>
                    <div class="project-info">
                        <h5 title="${p.title || 'Proyecto sin título'}">${p.title || 'Proyecto sin título'}</h5>
                        <span style="display:block; margin-top: 8px;"><i class="fa-solid fa-fingerprint"></i> DOI: ${p.doi || 'En trámite'}</span>
                    </div>
                    <div class="check-indicator"><i class="fa-solid fa-circle-check"></i></div>
                </div>
            </label>
        `}).join('');

        const gridHTML = `<div class="project-grid" id="project-grid-wrapper">${projectsHTML}</div>`;

        // Si la barra ya existe en el DOM, solo sobreescribimos la grilla para que el input no pierda el foco
        if (document.getElementById('project-search-input')) {
            const oldGrid = document.getElementById('project-grid-wrapper');
            if(oldGrid) oldGrid.outerHTML = gridHTML;
        } else {
            container.innerHTML = searchBarHTML + gridHTML;
            
            // Asignamos el evento de búsqueda INMEDIATAMENTE después de crear el input
            document.getElementById('project-search-input').addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.projectList.filter(p => 
                    (p.title && p.title.toLowerCase().includes(term)) || 
                    (p.doi && p.doi.toLowerCase().includes(term))
                );
                
                // Limpiamos la selección actual al filtrar para obligar a seleccionar uno de los nuevos
                sessionStorage.removeItem('activeProject');
                document.querySelectorAll('.creation-card').forEach(card => card.classList.add('disabled'));
                
                this.renderProjects(filtered);
            });
        }
    },

    addEventListeners() {
        const homeSection = document.getElementById('home-section');
        if (!homeSection) return;

        homeSection.addEventListener('click', (e) => {
            // 1. Clic en la tarjeta de un proyecto
            const projectCard = e.target.closest('.project-card');
            if (projectCard) {
                const radioInput = projectCard.querySelector('input[type="radio"]');
                if (radioInput && !radioInput.checked) {
                    radioInput.checked = true;
                    radioInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return; 
            }

            // 2. Clic en las herramientas del "Paso 2"
            const creationCard = e.target.closest('.creation-card');
            if (creationCard) {
                const action = creationCard.dataset.studioAction;

                if (action === 'view-live') {
                    const studioLink = document.querySelector('.nav-link[data-section="studio-section"]');
                    if (studioLink) studioLink.click();
                    return;
                }

                if (creationCard.classList.contains('disabled')) {
                    if (window.UI) {
                        window.UI.showAlert("⚠️ Por favor, busca y selecciona tu proyecto en el Paso 1 para continuar.");
                    } else {
                        alert("⚠️ Por favor, busca y selecciona tu proyecto en el Paso 1 para continuar.");
                    }
                    return;
                }

                let activeProject = null;
                try {
                    activeProject = JSON.parse(sessionStorage.getItem('activeProject'));
                } catch(err) {
                    console.error("Error leyendo caché:", err);
                }

                if (!activeProject || !activeProject.id) {
                    alert("Error: Proyecto no válido. Por favor vuelve a seleccionarlo.");
                    return;
                }

                if (action === 'create-live') {
                    window.location.href = '/inv/configurar-sesion.html';
                } else if (['text', 'social', 'script', 'image'].includes(action)) {
                    window.location.href = `/inv/editor.html?projectId=${activeProject.id}&agent=${action}`;
                } else if (action === 'microsite') {
                    window.location.href = '/inv/microsite-editor.html';
                }
            }
        });

        // 3. Detecta cuando el usuario ELIGE un proyecto válido
        homeSection.addEventListener('change', (e) => {
            if (e.target.name === 'project-selector') {
                const selectedId = e.target.value; // Ahora el valor es el ID real (UUID)
                const selectedProject = this.projectList.find(p => p.id === selectedId);
                
                if (selectedProject) {
                    // Lo guardamos en memoria
                    sessionStorage.setItem('activeProject', JSON.stringify(selectedProject));
                    
                    // Remarcamos la tarjeta elegida
                    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('selected'));
                    e.target.closest('.project-card').classList.add('selected');
                    
                    // ¡Desbloqueamos las herramientas!
                    document.querySelectorAll('.creation-card').forEach(card => card.classList.remove('disabled'));
                    
                    // Feedback visual (opcional)
                    if (window.UI && window.showToast) {
                        window.showToast(`✅ Proyecto cargado: ${selectedProject.title.substring(0, 30)}...`);
                    }
                }
            }
        });
    }
};