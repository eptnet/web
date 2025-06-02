document.addEventListener('DOMContentLoaded', function() {
    console.log("SCRIPT: DOMContentLoaded se disparó. El script general está funcionando."); // MENSAJE 1

    // --- LÓGICA DEL TEMA (CLARO/OSCURO) ---
    // ... (tu código del tema aquí, no lo modifiques) ...
    // Ejemplo:
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        console.log("SCRIPT: Configurando lógica del tema."); // MENSAJE 2
        // ... el resto de tu lógica del tema ...
        themeToggle.addEventListener('click', () => {
            // ...
        });
    }


    // --- LÓGICA DEL MODAL DE CANALES EN VIVO ---
    // ... (tu código del modal aquí, no lo modifiques) ...
    // Ejemplo:
    const liveButtonDesktop = document.querySelector('.sidebar-right');
    if (liveButtonDesktop) { // O cualquier elemento principal de tu lógica de modal
        console.log("SCRIPT: Configurando lógica del modal."); // MENSAJE 3
        // ... el resto de tu lógica del modal ...
    }


    // --- LÓGICA DEL FEED DE SUBSTACK (CON MENSAJES DE PRUEBA) ---
    console.log("SCRIPT: Iniciando lógica del feed de Substack."); // MENSAJE 4
    const feedContainer = document.getElementById('substack-feed-grid');
    console.log("SCRIPT: feedContainer encontrado:", feedContainer); // MENSAJE 5 (Si dice null, aquí está el problema)

    if (feedContainer) {
        console.log("SCRIPT: feedContainer EXISTE. Preparando para fetch."); // MENSAJE 6
        const substackFeedUrl = 'https://eptnews.substack.com/feed';
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(substackFeedUrl)}`;
        const fallbackImage = 'https://i.imgur.com/VdefT0s.png';

        const truncateText = (html, maxLength) => {
            // ... (tu función truncateText no necesita cambios) ...
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            let text = tempDiv.textContent || tempDiv.innerText || "";
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        console.log("SCRIPT: Intentando hacer fetch a:", apiUrl); // MENSAJE 7
        fetch(apiUrl)
            .then(response => {
                console.log("SCRIPT: Fetch - Respuesta recibida del API."); // MENSAJE 8
                if (!response.ok) {
                    console.error("SCRIPT: Fetch - Error en la respuesta del API:", response.status);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("SCRIPT: Fetch - Datos JSON procesados:", data); // MENSAJE 9
                feedContainer.innerHTML = ''; 

                if (data.items && data.items.length > 0) {
                    console.log("SCRIPT: Fetch - Encontrados " + data.items.length + " items. Procesando..."); // MENSAJE 10
                    // ... (el resto de tu data.items.forEach, no necesita cambios) ...
                    data.items.forEach(item => {
                        const card = document.createElement('a');
                        card.href = item.link;
                        card.target = '_blank';
                        card.rel = 'noopener noreferrer';
                        card.classList.add('feed-card');

                        let imageUrl = fallbackImage;
                        if (item.thumbnail && item.thumbnail.length > 0) {
                            imageUrl = item.thumbnail;
                        } 
                        else if (item.enclosure && item.enclosure.link && item.enclosure.link.length > 0) {
                            imageUrl = item.enclosure.link;
                        }
                        imageUrl = imageUrl.replace(/^http:\/\//i, 'https://');
                        
                        const image = document.createElement('img');
                        image.src = imageUrl;
                        image.classList.add('card-image');
                        image.onerror = () => { image.src = fallbackImage; };

                        const content = document.createElement('div');
                        content.classList.add('card-content');

                        const title = document.createElement('h3');
                        title.textContent = item.title;

                        const description = document.createElement('p');
                        description.textContent = truncateText(item.description, 100);

                        content.appendChild(title);
                        content.appendChild(description);
                        card.appendChild(image);
                        card.appendChild(content);

                        feedContainer.appendChild(card);
                    });
                } else {
                    console.warn("SCRIPT: Fetch - No se encontraron items en los datos o data.items está vacío."); // MENSAJE 11
                    feedContainer.innerHTML = '<p>No se pudieron cargar las publicaciones (sin items).</p>';
                }
            })
            .catch(error => {
                console.error('SCRIPT: Fetch - ERROR CATASTRÓFICO:', error); // MENSAJE 12
                feedContainer.innerHTML = '<p>Hubo un problema crítico al cargar las publicaciones.</p>';
            });
    } else {
        console.error("SCRIPT: ERROR CRÍTICO - feedContainer NO encontrado. El feed no se cargará."); // MENSAJE 13
    }
});