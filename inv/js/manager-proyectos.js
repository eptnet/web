import { Studio } from './manager-estudio.js';

export const Projects = {
    init() {
        this.loadProjects();
        this.addEventListeners();
    },

    loadProjects() {
        const container = document.getElementById('projects-list-container');
        if (!container) return;
        const projects = window.App.userProfile?.projects || [];
        if (projects.length > 0) {
            let optionsHTML = projects.map(p => `<option value="${p.title}">${p.title}</option>`).join('');
            container.innerHTML = `<select id="project-selector-dropdown" class="project-dropdown"><option value="">Selecciona un proyecto...</option>${optionsHTML}</select>`;
            document.querySelectorAll('.creation-card').forEach(card => card.classList.add('disabled'));
        } else {
            container.innerHTML = '<p>No tienes proyectos. <a href="/inv/profile.html">Añade uno en tu perfil</a>.</p>';
        }
    },

    addEventListeners() {
        const projectSelector = document.getElementById('project-selector-dropdown');
        if (projectSelector) {
            projectSelector.addEventListener('change', (e) => {
                const isProjectSelected = e.target.value !== '';
                document.querySelectorAll('.creation-card').forEach(card => card.classList.toggle('disabled', !isProjectSelected));
            });
        }
        
        document.querySelectorAll('.creation-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('disabled')) {
                    alert('Por favor, selecciona un proyecto primero.');
                    return;
                }
                const action = card.dataset.studioAction;
                const videoActions = ['live', 'podcast', 'presentation', 'interview'];
                if (videoActions.includes(action)) {
                    Studio.openModal(action);
                } else {
                    alert('¡Las funciones de IA estarán disponibles próximamente!');
                }
            });
        });
    }
};