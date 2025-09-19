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
            .select('*, projects(doi)')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !event) { document.body.innerHTML = '<h1>Error: Evento no encontrado o no es público.</h1>'; return; }

        const { data: editions } = await supabase.from('event_editions').select('*').eq('event_id', event.id);
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

    function renderCover(event, edition) {
        document.title = event.title;
        document.getElementById('nav-event-title').textContent = event.title;
        document.getElementById('event-title-cover').textContent = event.title;

        const coverSection = document.getElementById('cover-section');
        if (event.cover_url) {
            coverSection.style.backgroundImage = `url(${event.cover_url})`;
        }

        if(event.projects?.doi) document.getElementById('event-project-doi').textContent = `DOI: ${event.projects.doi}`;
        
        if (edition?.start_date) {
            setupCountdown(edition.start_date);
        } else {
            document.getElementById('countdown-timer').style.display = 'none';
        }
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

    function renderSpeakers(speakers = []) {
        const container = document.getElementById('speakers-section');
        if (!speakers || speakers.length === 0) { container.style.display = 'none'; return; }
        container.innerHTML = `<h2>Ponentes</h2><div class="speakers-grid">${speakers.map(s => `
            <div class="speaker-card">
                <img src="${s.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${s.name}">
                <h3>${s.name}</h3>
                <p>${s.bio || ''}</p>
                <div class="socials">
                    ${s.social1 ? `<a href="${s.social1}" target="_blank"><i class="fas fa-globe"></i></a>` : ''}
                    ${s.social2 ? `<a href="${s.social2}" target="_blank"><i class="fab fa-linkedin"></i></a>` : ''}
                    ${s.social3 ? `<a href="${s.social3}" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                </div>
            </div>`).join('')}</div>`;
    }

    function renderProgram(programData = [], speakers = []) {
        const programSection = document.getElementById('program-section');
        if (!programData || programData.length === 0) {
            programSection.style.display = 'none';
            return;
        }
        
        // Agrupamos por día
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
        contentContainer.innerHTML = '';

        sortedDates.forEach((date, index) => {
            const formattedDate = new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const dayOfWeek = new Date(date).toLocaleDateString('es-ES', { weekday: 'short' });
            
            // Crear pestaña
            const tabButton = document.createElement('button');
            tabButton.classList.add('program-day-tab');
            if (index === 0) tabButton.classList.add('active'); // Solo añadimos 'active' al primero
            tabButton.dataset.day = date;
            tabButton.innerHTML = `<span>${dayOfWeek}</span><strong>${formattedDate}</strong>`;
            tabsContainer.appendChild(tabButton);

            // Crear contenido del día
            const dayContent = document.createElement('div');
            dayContent.classList.add('program-day-content');
            if (index === 0) dayContent.classList.add('active'); // Solo añadimos 'active' al primero
            dayContent.id = `content-${date}`;
            
            dayContent.innerHTML = `<div class="program-timeline">${days[date].map(item => {
                const speaker = speakers.find(s => s.name === item.speaker_name);
                const speakerAvatar = speaker?.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';
                const speakerName = speaker?.name || 'Ponente por confirmar';

                // Guardamos los datos completos en el dataset para el modal
                const itemData = JSON.stringify({ ...item, speaker_details: speaker });

                return `
                <div class="program-item-card" data-program-item='${itemData.replace(/'/g, "&apos;")}'>
                    <div class="item-time">${item.startTime}</div>
                    <div class="item-details">
                        <img src="${speakerAvatar}" alt="${speakerName}" class="item-speaker-avatar">
                        <div class="item-info">
                            <h4>${item.title}</h4>
                            <span>${speakerName}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}</div>`;
            contentContainer.appendChild(dayContent);
        });

        // Añadir event listeners para las pestañas
        tabsContainer.querySelectorAll('.program-day-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                tabsContainer.querySelectorAll('.program-day-tab').forEach(t => t.classList.remove('active'));
                contentContainer.querySelectorAll('.program-day-content').forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`content-${tab.dataset.day}`).classList.add('active');
            });
        });

        // Añadir event listeners para abrir el modal al hacer clic en un item del programa
        contentContainer.querySelectorAll('.program-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemData = JSON.parse(card.dataset.programItem.replace(/&apos;/g, "'"));
                openProgramModal(itemData);
            });
        });
    }

    function openProgramModal(itemData) {
        const modal = document.getElementById('program-modal');

        // --- CORRECCIÓN: PASO 1 - Poner toda la información nueva MIENTRAS el modal está oculto ---
        document.getElementById('modal-item-cover').src = itemData.itemCoverUrl || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png';
        document.getElementById('modal-item-title').textContent = itemData.title;
        document.getElementById('modal-item-time').textContent = `${itemData.date} | ${itemData.startTime} - ${itemData.endTime}`;
        document.getElementById('modal-item-description').innerHTML = itemData.description;

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

        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Evitar scroll en el body
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