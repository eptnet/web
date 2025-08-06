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

    // REEMPLAZA ESTA FUNCIÓN COMPLETA en manager-proyectos.js
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
    
    // --- INICIO DE LA CORRECCIÓN Y LÓGICA UNIFICADA ---
    const creationGrid = document.querySelector('.creation-grid');
    if (creationGrid) {
        creationGrid.addEventListener('click', (e) => {
            const creationCard = e.target.closest('.creation-card');

            // Si no se hizo clic en una tarjeta o está deshabilitada, no hacemos nada
            if (!creationCard || creationCard.classList.contains('disabled')) {
                return;
            }

            const action = creationCard.dataset.studioAction;
            const activeProject = JSON.parse(sessionStorage.getItem('activeProject'));

            if (!activeProject) {
                alert("Por favor, selecciona un proyecto primero.");
                return;
            }

            // Lógica para redirigir según la tarjeta
            if (action === 'text' || action === 'social' || action === 'script' || action === 'image') {
                // Para todas las nuevas tarjetas de IA, vamos al editor
                window.location.href = `/inv/editor.html?projectId=${activeProject.id}`;
            } else if (action === 'live' || action === 'podcast' || action === 'presentation' || action === 'interview') {
                // Para las tarjetas de grabación/streaming, abrimos el modal del estudio
                Studio.openModal();
            }
        });
    }
    // --- FIN DE LA CORRECCIÓN ---
}
};