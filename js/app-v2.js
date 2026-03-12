// =========================================================================
// Script de la Página de Inicio V2 (app-v2.js) - BENTO DINÁMICO LIGERO
// =========================================================================

document.addEventListener('mainReady', () => {
    console.log("app-v2.js: Landing Page inmersiva cargada.");

    document.getElementById('current-year').textContent = new Date().getFullYear();

    // 1. Cargar el próximo evento en vivo (Ágora)
    loadNextAgoraEvent();

    // 2. Cargar los últimos artículos en la tarjeta de Revista
    loadLatestArticles();

    // 3. Activar el Buscador
    setupSearchEngine();
});

// --- CARGAR EVENTOS DEL ÁGORA ---
async function loadNextAgoraEvent() {
    const container = document.getElementById('next-event-data');
    if (!container || !window.supabaseClient) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('sessions')
            .select('id, session_title, scheduled_at')
            .eq('status', 'PROGRAMADO')
            .order('scheduled_at', { ascending: true })
            .limit(1)
            .single();

        if (error || !data) throw new Error("No events");

        const dateObj = new Date(data.scheduled_at);
        const formattedDate = dateObj.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        container.innerHTML = `
            <div class="ev-title">${data.session_title}</div>
            <div class="ev-date"><i class="fa-regular fa-calendar"></i> ${formattedDate}</div>
        `;
    } catch (e) {
        container.innerHTML = `
            <div class="ev-title" style="color: rgba(255,255,255,0.7); font-weight: normal;">No hay sesiones programadas.</div>
            <div class="ev-date" style="color: rgba(255,255,255,0.5);">Revisa nuestro archivo histórico en la Comunidad.</div>
        `;
    }
}

// --- CARGAR ARTÍCULOS DE LA BASE DE CONOCIMIENTO ---
async function loadLatestArticles() {
    const feed = document.getElementById('landing-articles-feed');
    if (!feed || !window.supabaseClient) return;

    try {
        // Obtenemos los 4 últimos artículos de la knowledge_base
        const { data, error } = await window.supabaseClient
            .from('knowledge_base')
            .select('title, description, url, image_url, published_at, author_name')
            .eq('source_type', 'article')
            .order('published_at', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (data && data.length > 0) {
            feed.innerHTML = data.map(article => {
                const date = new Date(article.published_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
                const img = article.image_url || 'https://placehold.co/100x100/f0f2f5/65676b?text=EPT';
                
                return `
                    <a href="${article.url}" target="_blank" class="article-mini-card">
                        <img src="${img}" alt="Miniatura" class="article-img">
                        <div class="article-info">
                            <h4>${article.title}</h4>
                            <div class="article-meta">
                                <span><i class="fa-solid fa-pen-nib"></i> ${article.author_name}</span>
                                <span><i class="fa-regular fa-calendar"></i> ${date}</span>
                            </div>
                        </div>
                    </a>
                `;
            }).join('');
        } else {
            feed.innerHTML = '<p style="color: var(--color-text-secondary); padding: 1rem;">No hay artículos indexados recientemente.</p>';
        }

    } catch (e) {
        console.error("Error cargando artículos:", e);
        feed.innerHTML = '<p style="color: red; padding: 1rem;">Error conectando con la base de conocimiento.</p>';
    }
}

// --- BUSCADOR PRINCIPAL ---
function setupSearchEngine() {
    const searchInput = document.getElementById('landing-search-input');
    const searchBtn = document.getElementById('landing-search-btn');

    const executeSearch = () => {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            // Como la visión futura es que la comunidad sea el centro, 
            // redirigimos la búsqueda a la sección de explorar/comunidad
            alert(`Próximamente: Resultados para "${query}". Esto se conectará con el motor de búsqueda interno.`);
            // Implementación real futura:
            // window.location.href = `/explorar.html?q=${encodeURIComponent(query)}`;
        }
    };

    searchBtn?.addEventListener('click', executeSearch);
    searchInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });
}