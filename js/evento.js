// =================================================================
// ARCHIVO FINAL, COMPLETO Y CORREGIDO: /js/evento.js
// Con corrección de zona horaria y lógica de renderizado estable.
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let countdownInterval;

    // --- FUNCIÓN CORREGIDA PARA MANEJAR FECHAS Y ZONAS HORARIAS ---
    const toLocalDate = (dateString) => {
        if (!dateString) return null;
        // La fecha se crea en UTC para evitar que el navegador aplique su zona horaria local
        // y la desplace un día hacia atrás.
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    };

    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');
        if (!slug) { document.body.innerHTML = '<h1>Error: Evento no encontrado.</h1>'; return; }

        const { data: event, error } = await supabase.from('events').select('*').eq('slug', slug).eq('is_public', true).single();
        if (error || !event) { console.error('Error fetching event:', error); document.body.innerHTML = '<h1>Error: Evento no encontrado o no es público.</h1>'; return; }

        let projectDoi = null;
        if (event.project_id) {
            const { data: project } = await supabase.from('projects').select('doi').eq('id', event.project_id).single();
            if (project) projectDoi = project.doi;
        }

        const { data: editions } = await supabase.from('event_editions').select('*').eq('event_id', event.id);
        const currentEdition = editions?.sort((a, b) => {
            const dateA = toLocalDate(a.start_date);
            const dateB = toLocalDate(b.start_date);
            return dateB - dateA;
        })[0];

        let liveRoomSessions = [];
        if (currentEdition && currentEdition.selected_sessions?.length > 0) {
            const { data: selectedSessionsData } = await supabase.from('sessions').select('*').in('id', currentEdition.selected_sessions);
            liveRoomSessions = selectedSessionsData || [];
        }
        
        renderCover(event, currentEdition, projectDoi);
        renderMainContent(event.main_content);
        renderSpeakers(currentEdition?.speakers);
        renderProgram(currentEdition?.program, currentEdition?.speakers, toLocalDate);
        renderLiveRoomSessions(liveRoomSessions);
        
        setupScrollAnimations();
        setupEventListeners();
        setupStickyNav();
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
    }

    function renderMainContent(content = {}) {
        const aboutContainer = document.getElementById('about-section');
        if (content.about) { aboutContainer.innerHTML = `<h2>Sobre el Evento</h2>${content.about}`; }
        const callForPapersContainer = document.getElementById('call-for-papers-section');
        if (content.callForPapers) { callForPapersContainer.innerHTML = `<h2>Call for Papers</h2>${content.callForPapers}`; }
    }

    function renderSpeakers(speakers = []) {
        const container = document.getElementById('speakers-section');
        if (!speakers || speakers.length === 0) { container.style.display = 'none'; return; }
        container.innerHTML = `<h2>Ponentes</h2><div class="speakers-grid">${speakers.map(s => {
            const speakerData = JSON.stringify(s).replace(/'/g, "&apos;");
            return `<button class="speaker-card" data-speaker-json='${speakerData}'><img src="${s.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${s.name}"><h3>${s.name}</h3></button>`
        }).join('')}</div>`;
    }

    function renderProgram(programData = [], speakers = [], dateParser) {
        const programSection = document.getElementById('program-section');
        if (!programData || programData.length === 0) {
            programSection.style.display = 'none';
            return;
        }

        const days = programData.reduce((acc, item) => {
            const date = item.date || 'Sin Fecha';
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
        }, {});
        
        const sortedDates = Object.keys(days).sort((a, b) => new Date(a) - new Date(b));
        const tabsContainer = document.getElementById('program-day-tabs');
        const contentContainer = document.getElementById('program-content');
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = '';

        sortedDates.forEach((date, index) => {
            const isActive = index === 0;
            const dateObj = dateParser(date);
            const formattedDate = dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' });
            const dayOfWeek = dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');

            const tabButton = document.createElement('button');
            tabButton.className = `program-day-tab ${isActive ? 'active' : ''}`;
            tabButton.dataset.day = date;
            tabButton.innerHTML = `<span>${dayOfWeek}</span><strong>${formattedDate}</strong>`;
            tabsContainer.appendChild(tabButton);

            const dayContent = document.createElement('div');
            dayContent.className = `program-day-content ${isActive ? 'active' : ''}`;
            dayContent.id = `content-${date}`;
            
            const dayItemsHtml = days[date]
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map(item => {
                    const speaker = speakers.find(s => s.name === item.speaker_name);
                    const avatarUrl = speaker ? speaker.avatarUrl : null;
                    const itemDataString = JSON.stringify({ ...item, speaker_details: speaker }).replace(/'/g, "&apos;");

                    // --- CAMBIO PRINCIPAL: Se genera un extracto de la descripción ---
                    const descriptionSnippet = item.description 
                        ? (item.description.substring(0, 120) + (item.description.length > 120 ? '…' : '')) 
                        : '';

                    return `
                        <div class="program-item-card" data-program-item='${itemDataString}'>
                            <div class="item-time">${item.startTime || ''}</div>
                            <div class="item-marker">
                                ${avatarUrl 
                                    ? `<img src="${avatarUrl}" alt="${item.speaker_name}" class="item-speaker-avatar">` 
                                    : '<div class="item-dot"></div>'
                                }
                            </div>
                            <div class="item-details">
                                <h4 class="item-title">${item.title}</h4>
                                <p class="item-description-snippet">${descriptionSnippet}</p>
                            </div>
                        </div>`;
                }).join('');
            
            dayContent.innerHTML = `<div class="program-timeline">${dayItemsHtml}</div>`;
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
        // --- CAMBIO PRINCIPAL: Se elimina el viejo botón y se prepara el nuevo contenedor ---
        document.getElementById('modal-calendar-container').innerHTML = ''; // Limpiar contenedor
        
        document.getElementById('modal-item-cover').src = itemData.itemCoverUrl || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png';
        document.getElementById('modal-item-title').textContent = itemData.title;
        
        const localDate = toLocalDate(itemData.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('modal-item-time').textContent = `${localDate} | ${itemData.startTime} - ${itemData.endTime}`;
        document.getElementById('modal-item-description').innerHTML = itemData.description || '';
        
        const speakerDetails = itemData.speaker_details;
        const speakerContainer = document.getElementById('modal-item-speaker');
        if (speakerDetails && speakerDetails.name) {
            speakerContainer.style.display = 'flex';
            document.getElementById('modal-speaker-avatar').src = speakerDetails.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('modal-speaker-name').textContent = speakerDetails.name;
            document.getElementById('modal-speaker-bio').textContent = speakerDetails.bio;
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

        // --- CAMBIO PRINCIPAL: Se crea el nuevo botón "Agendar" y se inserta en su contenedor ---
        const calendarLink = createGoogleCalendarLink(itemData);
        if (calendarLink) {
            const calendarButton = `<a href="${calendarLink}" target="_blank" rel="noopener noreferrer" class="btn-calendar">Agendar</a>`;
            document.getElementById('modal-calendar-container').innerHTML = calendarButton;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeProgramModal() {
        const modal = document.getElementById('program-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => {
            document.getElementById('modal-item-cover').src = '';
            document.getElementById('modal-item-title').textContent = '';
            document.getElementById('modal-item-time').textContent = '';
            document.getElementById('modal-item-description').textContent = '';
            document.getElementById('modal-speaker-name').textContent = '';
            document.getElementById('modal-speaker-bio').textContent = '';
        }, 300);
    }

    function renderLiveRoomSessions(sessions = []) {
        const anchorElement = document.getElementById('call-for-papers-section');
        let section = document.getElementById('liveroom-sessions-section');
        if (!sessions || sessions.length === 0) { if (section) section.remove(); return; }
        if (!section) {
            section = document.createElement('section');
            section.id = 'liveroom-sessions-section';
            section.className = 'event-section scroll-animate';
            if(anchorElement) anchorElement.after(section);
        }
        section.innerHTML = `<h2>Sesiones (LiveRoom)</h2><div class="card-grid">${sessions.map(s => `<a href="/live.html?sesion=${s.id}" target="_blank" rel="noopener noreferrer" class="card session-card">
            <img src="${s.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Miniatura" class="session-card-image">
            <div class="session-card-content"><h3>${s.session_title}</h3><p>🗓️ ${new Date(s.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p></div>
        </a>`).join('')}</div>`;
    }

    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            const speakerCard = e.target.closest('.speaker-card');
            if (speakerCard) { const speakerData = JSON.parse(speakerCard.dataset.speakerJson.replace(/&apos;/g, "'")); openSpeakerModal(speakerData); }
            const closeBtn = e.target.closest('.modal-close-btn');
            const modalOverlay = e.target.closest('.modal-overlay');
            if (closeBtn || (modalOverlay && !e.target.closest('.modal-content'))) { closeSpeakerModal(); }
            const programModal = document.getElementById('program-modal');
            const programCloseBtn = programModal.querySelector('.close-button');
            if (e.target === programModal || e.target === programCloseBtn) { closeProgramModal(); }
        });
    }

    function createGoogleCalendarLink(item) {
        if (!item.date || !item.startTime || !item.endTime) return null;
        // Asumimos que las horas están en la zona horaria local del evento.
        // Para crear un enlace universal, lo mejor es tratarlo como UTC y que Google Calendar haga el ajuste.
        const formatDateForGoogle = (date, time) => {
            return new Date(`${date}T${time}:00`).toISOString().replace(/[-:.]/g, '').slice(0, -4) + 'Z';
        }
        const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
        const title = encodeURIComponent(item.title);
        const description = encodeURIComponent(item.description || '');
        const startTime = formatDateForGoogle(item.date, item.startTime);
        const endTime = formatDateForGoogle(item.date, item.endTime);
        return `${baseUrl}&text=${title}&dates=${startTime}/${endTime}&details=${description}`;
    }

    function setupCountdown(targetDate) {
        clearInterval(countdownInterval);
        // Creamos la fecha del evento como si fuera la hora local, no UTC, para el countdown.
        const countDownDate = new Date(`${targetDate}T00:00:00`).getTime();
        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;
        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = countDownDate - now;
            if (distance < 0) { clearInterval(countdownInterval); timerEl.innerHTML = "<h4>¡El evento ha comenzado!</h4>"; return; }
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            timerEl.innerHTML = `<div class="countdown-item"><span>${days}</span><div>Días</div></div><div class="countdown-item"><span>${hours}</span><div>Horas</div></div><div class="countdown-item"><span>${minutes}</span><div>Minutos</div></div><div class="countdown-item"><span>${seconds}</span><div>Segundos</div></div>`;
        }, 1000);
    }

    function setupStickyNav() {
        const nav = document.querySelector('.event-nav');
        if (!nav) return;
        const navLinkList = document.getElementById('nav-link-list');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                navLinkList.classList.toggle('is-open');
            });
        }
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
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
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

    init();
});