// inv/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('user-email');

    // Función para verificar la sesión y proteger la página
    const checkSession = async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = '/'; // Si no hay sesión, fuera.
        } else {
            userEmailElement.textContent = session.user.email;
        }
    };
    checkSession();
});