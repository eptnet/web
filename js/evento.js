// =================================================================
// ARCHIVO: /js/evento.js (Versión Bento Inmersiva)
// Lógica de carga, cuenta regresiva y modales interactivos.
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let countdownInterval;

    const toLocalDate = (dateString) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    };

    async function init() {
        const pathParts = window.location.pathname.split('/');
        const pathSlug = pathParts.includes('e') ? pathParts[pathParts.indexOf('e') + 1] : null;
        const urlParams = new URLSearchParams(window.location.search);
        const slug = pathSlug || urlParams.get('slug');

        if (!slug) { document.body.innerHTML = '<h1 style="text-align:center; margin-top:20vh;">Error: Evento no encontrado.</h1>'; return; }

        const { data: event, error } = await supabase.from('events').select('*').eq('slug', slug).eq('is_public', true).single();
        
        if (error) { 
            if (error.code === 'PGRST116') {
                document.body.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; color: white; background: var(--background-color);">
                        <i class="fa-solid fa-lock" style="font-size: 4rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h1 style="margin: 0; font-size: 2rem;">Evento en Borrador o Privado</h1>
                        <p style="color: var(--text-muted); max-width: 400px; margin-top: 1rem;">Este evento no se encuentra disponible públicamente en este momento.</p>
                    </div>`;
            } else {
                document.body.innerHTML = '<h1 style="text-align:center; margin-top:20vh; color:white;">Error de conexión con la base de datos.</h1>'; 
            }
            return; 
        }

        if (urlParams.has('gracias')) {
            if (event.registration_thank_you_message) showThankYouModal(event.registration_thank_you_message);
            history.replaceState(null, '', window.location.pathname + `?slug=${slug}`);
        }

        let projectDoi = null;
        if (event.project_id) {
            const { data: project } = await supabase.from('projects').select('doi').eq('id', event.project_id).single();
            if (project) projectDoi = project.doi;
        }

        const { data: editions } = await supabase.from('event_editions').select('*').eq('event_id', event.id);
        
        // 1. Ordenar de más reciente a más antigua
        const sortedEditions = (editions || []).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
        
        // 2. Determinar la edición activa (Por URL o la más reciente por defecto)
        const urlEditionId = urlParams.get('edition');
        let currentEdition = sortedEditions[0]; 
        
        if (urlEditionId) {
            const found = sortedEditions.find(e => e.id === urlEditionId);
            if (found) currentEdition = found;
        }

        // 3. Renderizar el selector si hay más de 1 edición
        if (sortedEditions.length > 1) {
            const selectorContainer = document.getElementById('edition-selector-container');
            const selector = document.getElementById('edition-selector');
            if (selectorContainer && selector) {
                selectorContainer.style.display = 'inline-block';
                selector.innerHTML = sortedEditions.map(ed => 
                    `<option value="${ed.id}" ${ed.id === currentEdition.id ? 'selected' : ''}>📍 ${ed.edition_name}</option>`
                ).join('');
                
                // Al cambiar de edición, recargamos la página con la nueva URL
                selector.addEventListener('change', (e) => {
                    const url = new URL(window.location);
                    url.searchParams.set('edition', e.target.value);
                    window.location.href = url.toString();
                });
            }
        }

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
        document.getElementById('og-title').setAttribute('content', event.title);
        document.getElementById('og-description').setAttribute('content', event.main_content?.about?.replace(/<[^>]*>?/gm, '').substring(0, 160) || `Evento oficial`);
        document.getElementById('og-image').setAttribute('content', event.main_content?.seo?.imageUrl || event.cover_url || 'https://i.ibb.co/ZRmgqZ6h/eptlive-rrss.jpg');
        document.getElementById('og-url').setAttribute('content', window.location.href);

        document.getElementById('nav-event-title').textContent = event.title;
        document.getElementById('event-title-cover').textContent = event.title;
        
        if (event.cover_url) document.getElementById('cover-section').style.backgroundImage = `url(${event.cover_url})`;
        
        const regBtn = document.getElementById('main-registration-btn');
        if (event.registration_url) {
            regBtn.href = event.registration_url;
            regBtn.style.display = 'inline-flex';
        }
        
        if (projectDoi) document.getElementById('event-project-doi').innerHTML = `<i class="fa-solid fa-fingerprint"></i> DOI: ${projectDoi}`;

        if (edition && edition.countdown_enabled && edition.start_date) {
            setupCountdown(edition.start_date, edition.countdown_time);
        }
    }

    function renderMainContent(content = {}) {
        const aboutContainer = document.getElementById('about-section');
        const cfpContainer = document.getElementById('call-for-papers-section');

        if (content.about) {
            aboutContainer.style.display = 'flex';
            aboutContainer.innerHTML = `<div class="bento-header"><i class="fa-solid fa-circle-info text-accent"></i><h2>Sobre el Evento</h2></div><div class="prose">${content.about}</div>`;
        }
        
        if (content.callForPapers) {
            cfpContainer.style.display = 'flex';
            cfpContainer.innerHTML = `<div class="bento-header"><i class="fa-solid fa-bullhorn text-accent"></i><h2>Call for Papers</h2></div><div class="prose">${content.callForPapers}</div>`;
        } else {
            aboutContainer.classList.remove('span-8');
            aboutContainer.classList.add('span-12'); // Si no hay call for papers, el about ocupa todo
        }
    }

    function renderSpeakers(speakers = []) {
        const container = document.getElementById('speakers-section');
        if (!speakers || speakers.length === 0) return;
        
        container.style.display = 'flex';
        container.innerHTML = `
            <div class="bento-header"><i class="fa-solid fa-users text-accent"></i><h2>Ponentes e Invitados</h2></div>
            <div class="speakers-grid">
                ${speakers.map(s => {
                    const speakerData = JSON.stringify(s).replace(/'/g, "&apos;");
                    return `<button class="speaker-card" data-speaker-json='${speakerData}'><img src="${s.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="${s.name}"><h3>${s.name}</h3></button>`
                }).join('')}
            </div>
        `;
    }

    function renderProgram(programData = [], speakers = [], dateParser) {
        const programSection = document.getElementById('program-section');
        if (!programData || programData.length === 0) return;
        programSection.style.display = 'flex';

        const days = programData.reduce((acc, item) => {
            const date = item.date || 'Sin Fecha';
            if (!acc[date]) acc[date] = [];
            acc[date].push(item);
            return acc;
        }, {});
        
        const sortedDates = Object.keys(days).sort((a, b) => new Date(a) - new Date(b));
        const tabsContainer = document.getElementById('program-day-tabs');
        const contentContainer = document.getElementById('program-content');
        
        tabsContainer.innerHTML = ''; contentContainer.innerHTML = '';

        sortedDates.forEach((date, index) => {
            const isActive = index === 0;
            const dateObj = dateParser(date);
            const formattedDate = dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'short' });
            const dayOfWeek = dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');

            tabsContainer.innerHTML += `<button class="program-day-tab ${isActive ? 'active' : ''}" data-day="${date}"><span>${dayOfWeek}</span><strong>${formattedDate}</strong></button>`;

            const dayContentHtml = days[date]
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map(item => {
                    const speaker = speakers.find(s => s.name === item.speaker_name);
                    const avatarUrl = speaker ? speaker.avatarUrl : null;
                    const itemDataString = JSON.stringify({ ...item, speaker_details: speaker }).replace(/'/g, "&apos;");
                    const descSnippet = item.description ? (item.description.substring(0, 100) + '…') : '';

                    return `
                        <div class="program-item-card" data-program-item='${itemDataString}'>
                            <div class="item-time">${item.startTime || ''}</div>
                            <div class="item-marker">
                                ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" class="item-speaker-avatar">` : '<div class="item-dot"></div>'}
                            </div>
                            <div class="item-details">
                                <h4 class="item-title">${item.title}</h4>
                                <p class="item-description-snippet">${descSnippet}</p>
                            </div>
                        </div>`;
                }).join('');
            
            contentContainer.innerHTML += `<div class="program-day-content ${isActive ? 'active' : ''}" id="content-${date}">${dayContentHtml}</div>`;
        });

        // Eventos para Pestañas y Modales
        tabsContainer.addEventListener('click', e => {
            const tab = e.target.closest('.program-day-tab');
            if(!tab) return;
            tabsContainer.querySelectorAll('.program-day-tab').forEach(t => t.classList.remove('active'));
            contentContainer.querySelectorAll('.program-day-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`content-${tab.dataset.day}`).classList.add('active');
        });

        contentContainer.addEventListener('click', e => {
            const card = e.target.closest('.program-item-card');
            if (card) openProgramModal(JSON.parse(card.dataset.programItem.replace(/&apos;/g, "'")));
        });
    }

    function renderLiveRoomSessions(sessions = []) {
        const section = document.getElementById('liveroom-sessions-section');
        if (!sessions || sessions.length === 0) return;
        
        section.style.display = 'flex';
        section.innerHTML = `
            <div class="bento-header"><i class="fa-solid fa-tower-broadcast text-accent"></i><h2>Salas EPT Live</h2></div>
            <div class="card-grid">
                ${sessions.map(s => `
                    <a href="/l/${s.id}" target="_blank" class="session-card">
                        <img src="${s.thumbnail_url || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png'}" alt="Miniatura" class="session-card-image">
                        <div class="session-card-content">
                            <h3>${s.session_title}</h3>
                            <p><i class="fa-regular fa-clock"></i> ${new Date(s.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    // --- LÓGICA DE MODALES Y EVENTOS (Optimizada) ---
    function setupEventListeners() {
        document.body.addEventListener('click', e => {
            const speakerCard = e.target.closest('.speaker-card');
            if (speakerCard) openSpeakerModal(JSON.parse(speakerCard.dataset.speakerJson.replace(/&apos;/g, "'")));
            
            if (e.target.closest('.modal-close-btn') || e.target.classList.contains('modal-overlay')) {
                document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('is-visible'));
                document.body.style.overflow = '';
            }
        });
    }

    function openProgramModal(itemData) {
        const modal = document.getElementById('program-modal');
        document.getElementById('modal-item-cover').src = itemData.itemCoverUrl || 'https://i.ibb.co/Vt9tv2D/default-placeholder.png';
        document.getElementById('modal-item-title').textContent = itemData.title;
        
        const localDate = toLocalDate(itemData.date).toLocaleDateString('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('modal-item-time').innerHTML = `<i class="fa-regular fa-calendar"></i> ${localDate} &nbsp;|&nbsp; <i class="fa-regular fa-clock"></i> ${itemData.startTime} - ${itemData.endTime}`;
        document.getElementById('modal-item-description').innerHTML = itemData.description || '';
        
        const speakerContainer = document.getElementById('modal-item-speaker');
        if (itemData.speaker_details && itemData.speaker_details.name) {
            speakerContainer.classList.remove('hidden');
            document.getElementById('modal-speaker-avatar').src = itemData.speaker_details.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png';
            document.getElementById('modal-speaker-name').textContent = itemData.speaker_details.name;
            document.getElementById('modal-speaker-bio').textContent = itemData.speaker_details.bio;
        } else { speakerContainer.classList.add('hidden'); }
        
        const linkBtn = document.getElementById('modal-item-link');
        if (itemData.linkUrl) { linkBtn.href = itemData.linkUrl; linkBtn.textContent = itemData.linkText || 'Más Información'; linkBtn.style.display = 'inline-block'; } 
        else { linkBtn.style.display = 'none'; }

        const calendarLink = createGoogleCalendarLink(itemData);
        document.getElementById('modal-calendar-container').innerHTML = calendarLink ? `<a href="${calendarLink}" target="_blank" class="btn-calendar"><i class="fa-regular fa-calendar-plus"></i> Agendar en Google</a>` : '';

        modal.classList.add('is-visible'); document.body.style.overflow = 'hidden';
    }

    function openSpeakerModal(speakerData) {
        const modal = document.getElementById('speaker-modal-overlay');
        const socials = [{ url: speakerData.social1, icon: 'fa-globe' }, { url: speakerData.social2, icon: 'fa-linkedin' }, { url: speakerData.social3, icon: 'fa-twitter' }].filter(s => s.url);
        
        document.getElementById('modal-speaker-content').innerHTML = `
            <div class="profile-header">
                <img src="${speakerData.avatarUrl || 'https://i.ibb.co/61fJv24/default-avatar.png'}" alt="Avatar">
                <h2>${speakerData.name}</h2>
                ${speakerData.email ? `<p><i class="fa-solid fa-envelope"></i> ${speakerData.email}</p>` : ''}
            </div>
            <div class="prose" style="text-align: left;">${speakerData.bio || 'Biografía no disponible.'}</div>
            ${socials.length > 0 ? `<ul class="profile-socials">${socials.map(s => `<li><a href="${s.url}" target="_blank"><i class="fa-brands ${s.icon}"></i></a></li>`).join('')}</ul>` : ''}
        `;
        modal.classList.add('is-visible'); document.body.style.overflow = 'hidden';
    }

    function showThankYouModal(message) {
        const modal = document.getElementById('thank-you-modal');
        document.getElementById('thank-you-modal-content').innerHTML = message;
        modal.classList.add('is-visible'); document.body.style.overflow = 'hidden';
    }

    function createGoogleCalendarLink(item) {
        if (!item.date || !item.startTime || !item.endTime) return null;
        const formatDateForGoogle = (date, time) => new Date(`${date}T${time}:00`).toISOString().replace(/[-:.]/g, '').slice(0, -4) + 'Z';
        const title = encodeURIComponent(item.title);
        const desc = encodeURIComponent(item.description || '');
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDateForGoogle(item.date, item.startTime)}/${formatDateForGoogle(item.date, item.endTime)}&details=${desc}`;
    }

    function setupCountdown(targetDate, targetTime) {
        const timeString = targetTime || '00:00:00';
        const countDownDate = new Date(`${targetDate}T${timeString}`).getTime();
        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl) return;

        countdownInterval = setInterval(() => {
            const distance = countDownDate - new Date().getTime();
            if (distance < 0) { 
                clearInterval(countdownInterval); 
                timerEl.innerHTML = "<div style='background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 15px 30px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2); font-weight: 600;'>Edición en curso o finalizada.</div>"; 
                return; 
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            
            timerEl.innerHTML = `
                <div class="countdown-item"><span>${days}</span><div>Días</div></div>
                <div class="countdown-item"><span>${hours}</span><div>Horas</div></div>
                <div class="countdown-item"><span>${mins}</span><div>Min</div></div>
            `;
        }, 1000);
    }

    function setupStickyNav() {
        const nav = document.getElementById('site-nav');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) nav.classList.add('scrolled');
            else nav.classList.remove('scrolled');
        });
        const mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => document.getElementById('nav-link-list').classList.toggle('is-open'));
        }
    }

    function setupScrollAnimations() {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } });
        }, { threshold: 0.1 });
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
    }

    init();
});