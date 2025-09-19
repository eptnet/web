// =================================================================
// ARCHIVO NUEVO: /inv/js/manager-eventos.js
// =================================================================

export const EventsManager = {
    events: [],
    
    init() {
        this.fetchEvents();
        this.addEventListeners();
    },

    async fetchEvents() {
        const container = document.getElementById('events-list-container');
        container.innerHTML = `<p>Cargando tus eventos...</p>`;

        const { data: events, error } = await window.App.supabase
            .from('events')
            .select('*')
            .eq('user_id', window.App.userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching events:", error);
            container.innerHTML = `<p>Error al cargar los eventos.</p>`;
        } else {
            this.events = events;
            this.renderEvents(events);
        }
    },

    renderEvents(events) {
        const container = document.getElementById('events-list-container');
        if (!events || events.length === 0) {
            container.innerHTML = `<p class="form-hint">Aún no has creado ningún evento.</p>`;
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="event-card">
                <div class="event-card__header">
                    <h4>${event.title}</h4>
                    <span class="status-badge ${event.is_public ? 'published' : ''}">${event.is_public ? 'Público' : 'Borrador'}</span>
                </div>
                <div class="event-card__meta">
                    <p>URL: /evento.html?slug=${event.slug || '...'}</p>
                </div>
                <div class="event-card__actions">
                    <button class="btn-secondary edit-event-btn" data-event-id="${event.id}">
                        <i class="fa-solid fa-edit"></i> Editar
                    </button>
                    <a href="/evento.html?slug=${event.slug}" target="_blank" class="btn-secondary">
                        <i class="fa-solid fa-eye"></i> Ver Página
                    </a>
                    <button class="btn-danger delete-event-btn" data-event-id="${event.id}" style="margin-left: auto;">
                        <i class="fa-solid fa-trash"></i> Borrar
                    </button>
                </div>
            </div>
        `).join('');
    },

    addEventListeners() {
        const section = document.getElementById('events-section');
        if (!section) return;

        section.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.id === 'create-event-btn') {
                sessionStorage.removeItem('activeEvent');
                window.location.href = '/inv/event-editor.html';
            }

            if (button.classList.contains('edit-event-btn')) {
                const eventId = button.dataset.eventId;
                // Buscamos el evento completo en la lista que ya tenemos en memoria
                const eventData = EventsManager.events.find(event => event.id === eventId);
                if (eventData) {
                    sessionStorage.setItem('activeEvent', JSON.stringify(eventData));
                    window.location.href = '/inv/event-editor.html';
                }
            }

            if (button.classList.contains('delete-event-btn')) {
                const eventId = button.dataset.eventId;
                this.deleteEvent(eventId);
            }
        });
    },

    async deleteEvent(eventId) {
        if (!confirm("¿Estás seguro de que quieres borrar este evento? Esta acción es irreversible y eliminará también todas sus ediciones.")) {
            return;
        }

        const { error } = await window.App.supabase
            .from('events')
            .delete()
            .eq('id', eventId);

        if (error) {
            alert("Hubo un error al borrar el evento.");
            console.error("Error deleting event:", error);
        } else {
            alert("Evento borrado con éxito.");
            // Refrescamos la lista para que el evento borrado desaparezca
            this.fetchEvents();
        }
    },

};