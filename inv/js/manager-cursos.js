// =================================================================
// ARCHIVO NUEVO: /inv/js/manager-cursos.js
// Gestiona el listado, creación y acceso a estadísticas de NOOCs
// =================================================================

export const CoursesManager = {
    courses: [],
    
    init() {
        this.fetchCourses();
        this.addEventListeners();
    },

    async fetchCourses() {
        const container = document.getElementById('courses-list-container');
        container.innerHTML = `<p style="color: var(--color-text-secondary);"><i class="fa-solid fa-spinner fa-spin"></i> Cargando tus cursos...</p>`;

        // Buscamos los cursos creados por el usuario actual
        const { data: courses, error } = await window.App.supabase
            .from('nooc_courses')
            .select('*')
            .eq('created_by', window.App.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching courses:", error);
            container.innerHTML = `<p style="color: var(--color-accent);">Error al cargar los cursos.</p>`;
        } else {
            this.courses = courses;
            this.renderCourses(courses);
        }
    },

    renderCourses(courses) {
        const container = document.getElementById('courses-list-container');
        if (!courses || courses.length === 0) {
            container.innerHTML = `<p class="form-hint">Aún no has creado ningún nano-curso. ¡Anímate a compartir tu conocimiento!</p>`;
            return;
        }

        // Reutilizamos la estructura de 'event-card' que ya tienes en dashboard.css
        container.innerHTML = courses.map(course => `
            <div class="event-card" style="display: flex; flex-direction: column;">
                <div class="event-card__header" style="align-items: flex-start; margin-bottom: 10px;">
                    <img src="${course.thumbnail_url || 'https://i.ibb.co/BV0dKC2h/Portada-EPT-WEB.jpg'}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin-right: 12px; flex-shrink: 0;">
                    <div style="flex-grow: 1; min-width: 0;">
                        <h4 style="margin: 0 0 5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${course.title}</h4>
                        <span class="status-badge ${course.is_published ? 'published' : ''}">${course.is_published ? 'Publicado' : 'Borrador'}</span>
                    </div>
                </div>
                
                <div class="event-card__meta" style="margin-bottom: 15px;">
                    <p style="margin: 0; font-size: 0.85rem;"><i class="fa-solid fa-link"></i> /edu/nooc.html?c=${course.slug || '...'}</p>
                </div>
                
                <div class="event-card__actions" style="margin-top: auto; flex-wrap: wrap; gap: 8px;">
                    <!-- Botón de Estadísticas (Abre el futuro Dashboard del Curso) -->
                    <button class="btn-primary stats-course-btn" data-course-id="${course.id}" style="flex-grow: 1; padding: 8px; font-size: 0.85rem; display: flex; justify-content: center; gap: 5px;">
                        <i class="fa-solid fa-chart-pie"></i> Alumnos
                    </button>
                    
                    <!-- Botón de Edición -->
                    <button class="btn-secondary edit-course-btn" data-course-id="${course.id}" style="flex-grow: 1; padding: 8px; font-size: 0.85rem; display: flex; justify-content: center; gap: 5px;">
                        <i class="fa-solid fa-pen-to-square"></i> Editar
                    </button>

                    <!-- Botón de Borrar (Icono pequeño) -->
                    <button class="btn-danger delete-course-btn" data-course-id="${course.id}" title="Borrar Curso" style="padding: 8px; width: 35px; flex-shrink: 0;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    addEventListeners() {
        const section = document.getElementById('courses-section');
        if (!section) return;

        section.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            // 1. Crear nuevo curso
            if (button.id === 'create-course-btn') {
                sessionStorage.removeItem('activeCourse'); // Limpiamos caché
                window.location.href = '/edu/nooc-editor.html'; // Te lleva al editor de la clase anterior
            }

            // 2. Editar curso existente
            if (button.classList.contains('edit-course-btn')) {
                const courseId = button.dataset.courseId;
                const courseData = this.courses.find(c => c.id === courseId);
                if (courseData) {
                    sessionStorage.setItem('activeCourse', JSON.stringify(courseData));
                    window.location.href = '/edu/nooc-editor.html';
                }
            }

            // 3. Ver Estadísticas / Alumnos (El paso futuro que mencionaste)
            if (button.classList.contains('stats-course-btn')) {
                const courseId = button.dataset.courseId;
                // Por ahora lanzamos un alert o redirigimos a una futura página nooc-dashboard.html
                alert("🚀 Próximamente: Aquí verás la lista de alumnos matriculados, su % de progreso y podrás enviarles DM por Bluesky.");
                // window.location.href = `/edu/nooc-dashboard.html?id=${courseId}`;
            }

            // 4. Borrar curso
            if (button.classList.contains('delete-course-btn')) {
                const courseId = button.dataset.courseId;
                this.deleteCourse(courseId);
            }
        });
    },

    async deleteCourse(courseId) {
        if (!confirm("⚠️ ¿Estás completamente seguro de borrar este curso? Se perderán las lecciones y el progreso de los alumnos matriculados.")) {
            return;
        }

        // Gracias al "ON DELETE CASCADE" en la BD, borrar el curso borrará los módulos y lecciones
        const { error } = await window.App.supabase
            .from('nooc_courses')
            .delete()
            .eq('id', courseId);

        if (error) {
            alert("Hubo un error al borrar el curso.");
            console.error("Error deleting course:", error);
        } else {
            if (window.showToast) window.showToast("Curso borrado con éxito.");
            else alert("Curso borrado con éxito.");
            
            this.fetchCourses(); // Refrescamos UI
        }
    }
};