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
                    // Guardamos el proyecto seleccionado en la sesión del navegador
                    sessionStorage.setItem('activeProject', e.target.value);
                    
                    // Resaltamos la tarjeta seleccionada
                    document.querySelectorAll('.project-card').forEach(card => card.classList.remove('selected'));
                    e.target.parentElement.classList.add('selected');

                    // Activamos las herramientas de creación
                    document.querySelectorAll('.creation-card').forEach(card => card.classList.remove('disabled'));
                }
            });
        }
        
        document.querySelectorAll('.creation-card').forEach(card => {
            card.addEventListener('click', () => {
                const activeProject = sessionStorage.getItem('activeProject');
                if (!activeProject) {
                    alert('Por favor, selecciona un proyecto primero.');
                    return;
                }
                Studio.openModal();
            });
        });
    }
};