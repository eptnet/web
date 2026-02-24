// =================================================================
// ARCHIVO ACTUALIZADO: /inv/js/manager-proyectos.js 
// BUG SOLUCIONADO: Lectura segura de datos en JSON
// =================================================================
import { Studio } from './manager-estudio.js';

export const Projects = {
    init() {
        this.renderProjects();
        this.addEventListeners();
    },

    renderProjects() {
        const container = document.getElementById('projects-list-container');
        if (!container) return;
        
        const projects = window.App.userProfile?.projects || [];
        
        // SOLUCIÓN: Solo guardamos el 'index' en el value, es 100% a prueba de fallos
        let projectsHTML = projects.map((p, index) => `
            <label class="project-card" for="project-${index}">
                <input type="radio" name="project-selector" id="project-${index}" value="${index}">
                <div class="project-card-content">
                    <div class="project-icon-wrapper"><i class="fa-solid fa-folder-open"></i></div>
                    <div class="project-info">
                        <h5>${p.title}</h5>
                        <span><i class="fa-solid fa-fingerprint"></i> DOI: ${p.doi || 'No asignado'}</span>
                    </div>
                    <div class="check-indicator"><i class="fa-solid fa-circle-check"></i></div>
                </div>
            </label>
        `).join('');

        container.innerHTML = `<div class="project-grid">${projectsHTML}</div>`;
    },

    addEventListeners() {
        const homeSection = document.getElementById('home-section');
        if (!homeSection) return;

        homeSection.addEventListener('click', (e) => {
            // 1. Clic para seleccionar proyecto
            const projectCard = e.target.closest('.project-card');
            if (projectCard) {
                const radioInput = projectCard.querySelector('input[type="radio"]');
                if (radioInput && !radioInput.checked) {
                    radioInput.checked = true;
                    radioInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return; 
            }

            // 2. Clic para usar una herramienta
            const creationCard = e.target.closest('.creation-card');
            if (creationCard) {
                const action = creationCard.dataset.studioAction;

                // ACCIÓN QUE NO REQUIERE PROYECTO (Ver la lista de sesiones)
                if (action === 'view-live') {
                    const studioLink = document.querySelector('.nav-link[data-section="studio-section"]');
                    if (studioLink) studioLink.click();
                    return;
                }

                // ACCIONES QUE SÍ REQUIEREN PROYECTO (Crear, Redactar, Microsite)
                if (creationCard.classList.contains('disabled')) {
                    alert("⚠️ Por favor, selecciona un proyecto del Paso 1 para desbloquear esta herramienta.");
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

                // REDIRECCIONES SEGURAS
                if (action === 'create-live') {
                    window.location.href = '/inv/configurar-sesion.html';
                } else if (action === 'text' || action === 'social' || action === 'script') {
                    window.location.href = `/inv/editor.html?projectId=${activeProject.id}&agent=${action}`;
                } else if (action === 'microsite') {
                    window.location.href = '/inv/microsite-editor.html';
                }
            }
        });

        homeSection.addEventListener('change', (e) => {
            if (e.target.name === 'project-selector') {
                // SOLUCIÓN: Buscamos el proyecto real desde el array usando el índice
                const selectedIndex = parseInt(e.target.value, 10);
                const projects = window.App.userProfile?.projects || [];
                const selectedProject = projects[selectedIndex];
                
                if (selectedProject) {
                    // Ahora guardamos el objeto perfecto y limpio
                    sessionStorage.setItem('activeProject', JSON.stringify(selectedProject));
                    
                    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('selected'));
                    e.target.closest('.project-card').classList.add('selected');
                    
                    // Desbloqueamos las herramientas
                    document.querySelectorAll('.creation-card').forEach(card => card.classList.remove('disabled'));
                }
            }
        });
    }
};