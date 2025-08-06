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
        
        // Creamos tarjetas seleccionables en lugar de un dropdown
        let projectsHTML = projects.map((p, index) => `
            <label class="project-card" for="project-${index}">
                <input type="radio" name="project-selector" id="project-${index}" value='${JSON.stringify(p)}'>
                <div class="project-card-content">
                    <h5>${p.title}</h5>
                    <span>DOI: ${p.doi}</span>
                </div>
            </label>
        `).join('');

        container.innerHTML = `<div class="project-grid">${projectsHTML}</div>`;
    },

    addEventListeners() {
        const container = document.getElementById('projects-list-container');
        if (container) {
            container.addEventListener('change', (e) => {
                if (e.target.name === 'project-selector') {
                    sessionStorage.setItem('activeProject', e.target.value);
                    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('selected'));
                    e.target.parentElement.classList.add('selected');
                    document.querySelectorAll('.creation-card').forEach(card => card.classList.remove('disabled'));
                }
            });
        }
        
        const creationGrid = document.querySelector('.creation-grid');
        if (creationGrid) {
            creationGrid.addEventListener('click', (e) => {
                const creationCard = e.target.closest('.creation-card');

                if (!creationCard || creationCard.classList.contains('disabled')) {
                    return;
                }

                const action = creationCard.dataset.studioAction;
                const activeProject = JSON.parse(sessionStorage.getItem('activeProject'));

                if (!activeProject) {
                    alert("Por favor, selecciona un proyecto primero.");
                    return;
                }

                // --- LÓGICA CORREGIDA Y FINAL ---
                if (action === 'text' || action === 'social' || action === 'script') {
                    // Ahora redirigimos pasando el projectId Y el agente seleccionado
                    window.location.href = `/inv/editor.html?projectId=${activeProject.id}&agent=${action}`;
                
                } else if (action === 'image') {
                    alert("La generación de imágenes con IA se implementará próximamente.");
                
                } else if (action === 'live' || action === 'podcast' || action === 'presentation' || action === 'interview') {
                    Studio.openModal();
                }
            });
        }
    }
};