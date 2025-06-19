// Contenido para js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    // Ya no necesitamos inicializar Supabase aquí, usamos la instancia global
    const userEmailElement = document.getElementById('user-email');

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/'; // Redirige si no hay sesión
    } else {
        userEmailElement.textContent = session.user.email;
    }
});