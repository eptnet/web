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

    // REEMPLAZA ESTA FUNCIÓN COMPLETA EN manager-proyectos.js

addEventListeners() {
    // Ponemos un ÚNICO listener en la sección principal que siempre está visible.
    const homeSection = document.getElementById('home-section');
    if (!homeSection) return;

    homeSection.addEventListener('click', (e) => {
        // Buscamos si el clic fue en una tarjeta de proyecto
        const projectCard = e.target.closest('.project-card');
        if (projectCard) {
            // Esta lógica es para SELECCIONAR un proyecto
            const radioInput = projectCard.querySelector('input[type="radio"]');
            if (radioInput && !radioInput.checked) {
                radioInput.checked = true;
                // Disparamos un evento 'change' manualmente para que se guarde en sessionStorage
                radioInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return; // Terminamos aquí si fue un clic para seleccionar proyecto
        }

        // Buscamos si el clic fue en una tarjeta de acción (divulgar, microsite, etc.)
        const creationCard = e.target.closest('.creation-card');
        if (creationCard) {
            // Esta lógica es para EJECUTAR una acción
            if (creationCard.classList.contains('disabled')) {
                alert("Por favor, selecciona un proyecto del Paso 1 para activar esta opción.");
                return;
            }

            const action = creationCard.dataset.studioAction;
            const activeProject = JSON.parse(sessionStorage.getItem('activeProject'));

            // Doble verificación de que un proyecto está activo
            if (!activeProject) {
                alert("Error: No hay un proyecto activo. Por favor, selecciona uno.");
                return;
            }

            // Aquí va toda la lógica de redirección
            if (action === 'text' || action === 'social' || action === 'script') {
                window.location.href = `/inv/editor.html?projectId=${activeProject.id}&agent=${action}`;
            } else if (action === 'image') {
                alert("La generación de imágenes con IA se implementará próximamente.");
            } else if (action === 'live' || action === 'podcast' || action === 'presentation' || action === 'interview') {
                Studio.openModal();
            } else if (action === 'microsite') {
                window.location.href = '/inv/microsite-editor.html';
            }
        }
    });

    // Mantenemos este listener aparte, ya que se asocia con el input de radio directamente
    homeSection.addEventListener('change', (e) => {
        if (e.target.name === 'project-selector') {
            sessionStorage.setItem('activeProject', e.target.value);
            document.querySelectorAll('.project-card').forEach(card => card.classList.remove('selected'));
            e.target.closest('.project-card').classList.add('selected');
            document.querySelectorAll('.creation-card').forEach(card => card.classList.remove('disabled'));
        }
    });
}
};