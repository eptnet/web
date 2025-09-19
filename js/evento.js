// =================================================================
// ARCHIVO NUEVO: /js/evento.js
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let countdownInterval;

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

        renderCover(event, currentEdition);
        renderMainContent(event.main_content);
        renderSpeakers(currentEdition.speakers);
        renderProgram(currentEdition.program);
    }

    function renderCover(event, edition) {
        document.title = event.title;
        document.getElementById('nav-event-title').textContent = event.title;
        document.getElementById('event-title-cover').textContent = event.title;
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

    function renderProgram(programData = []) {
        const container = document.getElementById('program-section');
        if (!programData || programData.length === 0) { container.style.display = 'none'; return; }
        
        // Agrupamos por día
        const days = programData.reduce((acc, item) => {
            const date = item.date || 'Sin Fecha';
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
        }, {});

        let html = `<h2>Programa</h2>`;
        for (const date in days) {
            const formattedDate = new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            html += `<h3 class="program-day-title">${formattedDate}</h3>`;
            html += `<div class="program-timeline">${days[date].map(item => `
                <div class="program-item">
                    <div class="program-item-time">${item.startTime} - ${item.endTime}</div>
                    <div class="program-item-details">
                        <div class="program-item-header">
                            <h4>${item.title}</h4>
                        </div>
                        <p>${item.description}</p>
                        ${item.linkUrl ? `<a href="${item.linkUrl}" target="_blank" class="program-item-btn">${item.linkText || 'Más Info'}</a>` : ''}
                    </div>
                </div>
            `).join('')}</div>`;
        }
        container.innerHTML = html;
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