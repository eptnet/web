// =================================================================
// ARCHIVO NUEVO: /js/evento.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let countdownInterval;

    document.querySelector('#program-modal .close-button').addEventListener('click', closeProgramModal);
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('program-modal')) {
            closeProgramModal();
        }
    });

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');
        if (!slug) { document.body.innerHTML = '<h1>Error: Evento no encontrado.</h1>'; return; }

        const { data: event, error } = await supabase
            .from('events')
            .select('*, registration_url')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !event) { 
            console.error('Error fetching event:', error);
            document.body.innerHTML = '<h1>Error: Evento no encontrado o no es público.</h1>'; 
            return; 
        }

        let projectDoi = null;
        if (event.project_id) {
            const { data: project } = await supabase
                .from('projects')
                .select('doi')
                .eq('id', event.project_id)
                .single();
            if (project) {
                projectDoi = project.doi;
            }
        }

        const { data: editions } = await supabase.from('event_editions').select('*').eq('event_id', event.id);
        const { data: sessions } = await supabase.from('sessions').select('*').eq('project_title', event.projects.title);

        const currentEdition = editions.sort((a,b) => new Date(b.start_date) - new Date(a.start_date))[0];

        if (!currentEdition) {
            // Manejar el caso de que no haya ediciones
            renderCover(event, null);
            renderMainContent(event.main_content);
            return;
        }

        renderCover(event, currentEdition);
        renderMainContent(event.main_content);
        renderSpeakers(currentEdition.speakers);
        renderProgram(currentEdition.program, currentEdition.speakers);
        renderLiveRoomSessions(sessions);
        setupScrollAnimations();
        setupEventListeners();
        setupStickyNav();
    }

    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.scroll-animate').forEach(el => {
            observer.observe(el);
        });
    }

    function setupStickyNav() {
        const nav = document.querySelector('.event-nav');
        if (!nav) return;

        const navLinkList = document.getElementById('nav-link-list');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');

        mobileMenuBtn.addEventListener('click', () => {
            navLinkList.classList.toggle('is-open');
        });

        // ... (el resto de la lógica de smooth scroll y observer no cambia) ...
    }

    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            // Lógica para abrir el modal del ponente
            const speakerCard = e.target.closest('.speaker-card');
            if (speakerCard) {
                const speakerData = JSON.parse(speakerCard.dataset.speakerJson.replace(/&apos;/g, "'"));
                openSpeakerModal(speakerData);
            }

            // Lógica para cerrar el modal del ponente
            const closeBtn = e.target.closest('.modal-close-btn');
            const modalOverlay = e.target.closest('.modal-overlay');
            if (closeBtn || (modalOverlay && !e.target.closest('.modal-content'))) {
                closeSpeakerModal();
            }
        });
    }

    function renderCover(event, edition, projectDoi) {
        document.title = event.title;
        document.getElementById('nav-event-title').textContent = event.title;
        document.getElementById('event-title-cover').textContent = event.title;
        
        const coverSection = document.getElementById('cover-section');
        if (event.cover_url) {
            coverSection.style.backgroundImage = `url(${event.cover_url})`;
        }

        const regBtn = document.getElementById('main-registration-btn');
        if (event.registration_url) {
            regBtn.href = event.registration_url;
            regBtn.style.display = 'inline-block';
        } else {
            regBtn.style.display = 'none';
        }

        if (projectDoi) {
            document.getElementById('event-project-doi').textContent = `DOI: ${projectDoi}`;
        }

        if (edition?.start_date) {
            setupCountdown(edition.start_date);
        } else {
            document.getElementById('countdown-timer').style.display = 'none';
        }

        // --- LÓGICA AÑADIDA PARA RELLENAR META TAGS ---
        const content = event.main_content || {};
        const pageUrl = `${window.location.origin}${window.location.pathname}?slug=${event.slug}`;
        const description = content.about?.replace(/<[^>]*>?/gm, '').substring(0, 150) || event.title;

        document.getElementById('og-title').setAttribute('content', event.title);
        document.getElementById('og-description').setAttribute('content', description);
        // Usa la imagen SEO si existe; si no, la de portada; si no, una por defecto.
        document.getElementById('og-image').setAttribute('content', content.seo?.imageUrl || event.cover_url || 'https://i.ibb.co/hFRyKrxY/logo-epist-v3-1x1-c.png');
        document.getElementById('og-url').setAttribute('content', pageUrl);
    }

    function renderMainContent(content = {}) {
        const aboutContainer = document.getElementById('about-section');
        if (content.about) {
            aboutContainer.innerHTML = `<h2>Sobre el Evento</h2>${content.about}`;
        }
        const callForPapersContainer = document.getElementById('call-for-papers-section');
        if (content.callForPapers) {
            callForPapersContainer.innerHTML = `<h2>Call for Papers</h2>${content.callForPapers}`;
        }
    }

    function renderLiveRoomSessions(sessions = []) {
        const container = document.createElement('section');
        container.id = 'liveroom-sessions-section';
        container.className = 'event-section scroll-animate';
        
        if (!sessions || sessions.length === 0) {
            return; // No hacemos nada si no hay sesiones
        }

        let htmlContent = `
            <h2>Otras Sesiones (LiveRoom)</h2>
            <div class="card-grid">${sessions.map(session => `
                <a href="/live.html?sesion=${session.id}" target="_blank" rel="noopener noreferrer" class="card session-card">
                    <img src="${session.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Miniatura" class="session-card-image">
                    <div class="session-card-content">
                        <h3>${session.session_title}</h3>
                        <p>🗓️ ${new Date(session.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                    </div>
                </a>
            `).join('')}</div>
        `;
        
        container.innerHTML = htmlContent;
        // La insertamos después de la sección 'Call for Papers'
        document.getElementById('call-for-papers-section').after(container);
    }

    function renderSpeakers(speakers = []) {
        const container = document.getElementById('speakers-section');
        if (!speakers || speakers.length === 0) { container.style.display = 'none'; return; }

        container.innerHTML = `<h2>Ponentes</h2><div class="speakers-grid">${speakers.map(s => {
            // Guardamos todos los datos del ponente en una cadena JSON para el data-attribute
            const speakerData = JSON.stringify(s).replace(/'/g, "&apos;");

            return `
            <button class="speaker-card" data-speaker-json='${speakerData}'>
                <img src="${s.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${s.name}">
                <div>
                    <h3>${s.name}</h3>
                    <p>${s.bio || ''}</p>
                </div>
            </button>
            `}).join('')}</div>`;
    }

    function openSpeakerModal(speakerData) {
        const modalOverlay = document.getElementById('speaker-modal-overlay');
        const modalContent = document.getElementById('modal-speaker-content');
        
        const socials = [
            { url: speakerData.social1, icon: 'fas fa-globe' },
            { url: speakerData.social2, icon: 'fab fa-linkedin' },
            { url: speakerData.social3, icon: 'fab fa-twitter' }
        ].filter(social => social.url);

        modalContent.innerHTML = `
            <div class="profile-header">
                <img src="${speakerData.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar" class="profile-avatar">
                <div>
                    <h2 class="profile-name">${speakerData.name}</h2>
                    <p>${speakerData.email || ''}</p>
                </div>
            </div>
            <p class="profile-bio">${speakerData.bio || 'Biografía no disponible.'}</p>
            ${socials.length > 0 ? `<ul class="profile-socials">${socials.map(s => `<li><a href="${s.url}" target="_blank"><i class="${s.icon}"></i></a></li>`).join('')}</ul>` : ''}
        `;

        modalOverlay.classList.add('is-visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSpeakerModal() {
        const modalOverlay = document.getElementById('speaker-modal-overlay');
        modalOverlay.classList.remove('is-visible');
        document.body.style.overflow = '';
    }

    function renderProgram(programData = [], speakers = []) {
        const programSection = document.getElementById('program-section');
        if (!programData || programData.length === 0) { programSection.style.display = 'none'; return; }
        
        const days = programData.reduce((acc, item) => {
            const date = item.date || 'Sin Fecha';
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
        }, {});

        const sortedDates = Object.keys(days).sort((a,b) => new Date(a) - new Date(b));

        const tabsContainer = document.getElementById('program-day-tabs');
        const contentContainer = document.getElementById('program-content');
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = ''; // Limpiamos el contenido

        sortedDates.forEach((date, index) => {
            const formattedDate = new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const dayOfWeek = new Date(date).toLocaleDateString('es-ES', { weekday: 'short' });
            
            const tabButton = document.createElement('button');
            tabButton.className = `program-day-tab ${index === 0 ? 'active' : ''}`;
            tabButton.dataset.day = date;
            tabButton.innerHTML = `<span>${dayOfWeek}</span><strong>${formattedDate}</strong>`;
            tabsContainer.appendChild(tabButton);

            const dayContent = document.createElement('div');
            dayContent.className = `program-day-content ${index === 0 ? 'active' : ''}`;
            dayContent.id = `content-${date}`;
            
            let dayHtml = `<div class="program-timeline">`;
            days[date].forEach(item => {
                const speaker = speakers.find(s => s.name === item.speaker_name);
                const speakerAvatar = speaker?.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';
                const speakerName = speaker?.name || 'Ponente por confirmar';
                const itemData = JSON.stringify({ ...item, speaker_details: speaker });
                const calendarLink = createGoogleCalendarLink(item);

                dayHtml += `
                <div class="program-item-card" data-program-item='${itemData.replace(/'/g, "&apos;")}'>
                    <div class="item-time">${item.startTime}</div>
                    <div class="item-details">
                        <img src="${speakerAvatar}" alt="${speakerName}" class="item-speaker-avatar">
                        <div class="item-info">
                            <h4>${item.title}</h4>
                            <span>Por: ${speakerName}</span>
                        </div>
                        ${calendarLink ? `<a href="${calendarLink}" target="_blank" class="add-to-calendar-btn" title="Añadir a Google Calendar"><i class="fa-solid fa-calendar-plus"></i></a>` : ''}
                    </div>
                </div>
                `;
            });
            dayHtml += `</div>`;
            dayContent.innerHTML = dayHtml;
            contentContainer.appendChild(dayContent);
        });

        tabsContainer.querySelectorAll('.program-day-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                tabsContainer.querySelectorAll('.program-day-tab').forEach(t => t.classList.remove('active'));
                contentContainer.querySelectorAll('.program-day-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`content-${tab.dataset.day}`).classList.add('active');
            });
        });

        contentContainer.querySelectorAll('.program-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemData = JSON.parse(card.dataset.programItem.replace(/&apos;/g, "'"));
                openProgramModal(itemData);
            });
        });
    }

    function openProgramModal(itemData) {
        const modal = document.getElementById('program-modal');
        const modalTitle = document.getElementById('modal-item-title');

        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Buscamos y eliminamos cualquier botón de calendario que exista de una apertura anterior.
        const oldCalendarBtn = modal.querySelector('.add-to-calendar-btn');
        if (oldCalendarBtn) {
            oldCalendarBtn.remove();
        }
        // --- FIN DE LA CORRECCIÓN ---

        document.getElementById('modal-item-cover').src = itemData.itemCoverUrl || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png';
        modalTitle.textContent = itemData.title;
        document.getElementById('modal-item-time').textContent = `${itemData.date} | ${itemData.startTime} - ${itemData.endTime}`;

        const speakerDetails = itemData.speaker_details;
        const speakerContainer = document.getElementById('modal-item-speaker');
        if (speakerDetails && speakerDetails.name) {
            document.getElementById('modal-speaker-avatar').src = speakerDetails.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('modal-speaker-name').textContent = speakerDetails.name;
            document.getElementById('modal-speaker-bio').textContent = speakerDetails.bio;
            speakerContainer.style.display = 'flex';
        } else {
            speakerContainer.style.display = 'none';
        }

        const linkButton = document.getElementById('modal-item-link');
        if (itemData.linkUrl) {
            linkButton.href = itemData.linkUrl;
            linkButton.textContent = itemData.linkText || 'Más Información';
            linkButton.style.display = 'inline-block';
        } else {
            linkButton.style.display = 'none';
        }
        
        // --- LÓGICA AÑADIDA PARA EL BOTÓN DE CALENDARIO EN EL MODAL ---
        const calendarLink = createGoogleCalendarLink(itemData);
        if (calendarLink) {
            const calendarButtonHtml = `
                <a href="${calendarLink}" target="_blank" class="add-to-calendar-btn" title="Añadir a Google Calendar">
                    <i class="fa-solid fa-calendar-plus"></i>
                </a>
            `;
            // Lo añadimos al lado del título
            modalTitle.insertAdjacentHTML('afterend', calendarButtonHtml);
        }


        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function createGoogleCalendarLink(item) {
        if (!item.date || !item.startTime || !item.endTime) {
            return null;
        }
        const formatDate = (date, time) => {
            // Formato YYYYMMDDTHHMMSSZ
            return new Date(`${date}T${time}`).toISOString().replace(/-|:|\.\d+/g, '');
        };

        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(item.title);
        const description = encodeURIComponent(item.description || '');
        const startTime = formatDate(item.date, item.startTime);
        const endTime = formatDate(item.date, item.endTime);
        
        return `${baseUrl}&text=${title}&dates=${startTime}/${endTime}&details=${description}`;
    }

    function closeProgramModal() {
        const modal = document.getElementById('program-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // --- LÓGICA AÑADIDA ---
        // Esperamos a que la animación de salida termine (300ms) antes de borrar el contenido.
        // Esto evita que el contenido desaparezca bruscamente.
        setTimeout(() => {
            document.getElementById('modal-item-cover').src = '';
            document.getElementById('modal-item-title').textContent = '';
            document.getElementById('modal-item-time').textContent = '';
            document.getElementById('modal-item-description').textContent = '';
            document.getElementById('modal-speaker-name').textContent = '';
            document.getElementById('modal-speaker-bio').textContent = '';
        }, 300);
    }

    function setupCountdown(targetDate) {
        clearInterval(countdownInterval);
        const countDownDate = new Date(targetDate).getTime();
        const timerEl = document.getElementById('countdown-timer');

        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = countDownDate - now;

            if (distance < 0) {
                clearInterval(countdownInterval);
                timerEl.innerHTML = "<h4>¡El evento ha comenzado!</h4>";
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            timerEl.innerHTML = `
                <div class="countdown-item"><span>${days}</span><div>Días</div></div>
                <div class="countdown-item"><span>${hours}</span><div>Horas</div></div>
                <div class="countdown-item"><span>${minutes}</span><div>Minutos</div></div>
                <div class="countdown-item"><span>${seconds}</span><div>Segundos</div></div>
            `;
        }, 1000);
    }

    init();
});