// Contenido para el nuevo archivo: js/dashboard.js

// 1. Configuración de Supabase (igual que en app.js)
const SUPABASE_URL = 'https://seyknzlheaxmwztkfxmk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Elementos del DOM de esta página
const userEmailElement = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-btn');

/**
 * Función principal que se ejecuta al cargar la página del dashboard
 */
async function setupDashboard() {
    // 3. Verificamos si hay una sesión activa
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Si NO hay sesión, redirigimos al usuario a la página de inicio
        alert("Necesitas iniciar sesión para acceder a esta página.");
        window.location.href = '/'; // Redirige a index.html
    } else {
        // Si SÍ hay sesión, mostramos la información del usuario
        userEmailElement.textContent = session.user.email;
    }
}

/**
 * Función para cerrar la sesión del usuario
 */
async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error("Error al cerrar sesión:", error);
    } else {
        // Si el cierre de sesión es exitoso, redirigimos a la página de inicio
        window.location.href = '/';
    }
}

// 4. Asignamos los eventos
logoutButton?.addEventListener('click', handleLogout);

// 5. Ejecutamos la función principal
setupDashboard();