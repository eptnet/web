// Contenido para js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const loadComponent = (componentPath, placeholderId) => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            fetch(componentPath)
                .then(response => {
                    if (!response.ok) throw new Error(`Componente no encontrado: ${componentPath}`);
                    return response.text();
                })
                .then(html => {
                    // Reemplazamos el placeholder por el contenido del header
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    placeholder.replaceWith(...tempDiv.childNodes);

                    // --- LA MAGIA ESTÁ AQUÍ ---
                    // Enviamos una señal para avisar a los otros scripts que el header ya está en la página.
                    console.log("Header cargado y renderizado. Enviando señal 'headerLoaded'.");
                    document.dispatchEvent(new CustomEvent('headerLoaded'));
                })
                .catch(error => console.error(`Error cargando el componente:`, error));
        }
    };

    // Determinamos la ruta correcta al _header.html dependiendo de en qué página estamos
    const isDashboard = window.location.pathname.includes('/inv/');
    const headerPath = isDashboard ? '../_header.html' : '_header.html';
    
    loadComponent(headerPath, 'header-placeholder');
});