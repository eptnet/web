// inv/js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('user-email');

    const checkSession = async () => {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = '/';
        } else if (userEmailElement) {
            userEmailElement.textContent = session.user.email;
        }
    };
    
    checkSession();
});