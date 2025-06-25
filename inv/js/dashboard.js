/**
 * =========================================================================
 * DASHBOARD.JS - VERSIÓN CON FLUJO DE TRABAJO GUIADO
 * - Implementa la nueva sección "Inicio" como vista principal.
 * - Prepara la estructura para la futura gestión de proyectos.
 * - Centraliza la navegación y la lógica de la UI.
 * =========================================================================
 */
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const supabaseUrl = 'https://seyknzlheaxmwztkfxmk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_AUTH_DOMAIN",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_STORAGE_BUCKET",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

const firebaseApp = window.firebase.initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

console.log('Dashboard script loaded. Supabase and Firebase are ready.');

// --- 2. LÓGICA DE AUTENTICACIÓN ---
let currentUserId = null;

async function handleUserSession(session) {
    if (session && session.user) {
        currentUserId = session.user.id;
        initializeDashboard(session.user);
    } else {
        window.location.href = '/';
    }
}

(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await handleUserSession(session);
    supabase.auth.onAuthStateChange((_event, session) => {
        handleUserSession(session);
    });
})();

// --- 3. LÓGICA DEL DASHBOARD ---

function initializeDashboard(user) {
    const userNameHeader = document.getElementById('user-name-header');
    if (userNameHeader) {
        userNameHeader.textContent = user.user_metadata?.full_name || user.email;
    }
    
    setupNavigation();
    setupProfileForm(user.id);
    setupHomeSection(user.id);
    
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    const switchSection = (targetSectionId) => {
        navLinks.forEach(l => {
            l.classList.toggle('active', l.dataset.section === targetSectionId);
        });
        contentSections.forEach(section => {
            section.classList.toggle('active', section.id === targetSectionId);
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = link.dataset.section;
            switchSection(targetSectionId);
            window.location.hash = targetSectionId.replace('-section', '');
        });
    });

    // Manejar la navegación desde la sección de inicio
    const creationCards = document.querySelectorAll('.creation-card');
    creationCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetSectionId = card.dataset.targetSection;
            switchSection(targetSectionId);
        });
    });
}

// --- 4. LÓGICA DEL PERFIL Y PROYECTOS (FIRESTORE) ---

function setupProfileForm(userId) {
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveButton = profileForm.querySelector('.btn-primary');
        const btnText = saveButton.querySelector('.btn-text');
        const btnLoader = saveButton.querySelector('.btn-loader');
        const formMessage = document.getElementById('form-message');

        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        saveButton.disabled = true;
        formMessage.textContent = '';
        
        const profileData = {
            displayName: document.getElementById('display-name').value,
            bio: document.getElementById('bio').value,
            website: document.getElementById('website-url').value,
            twitter: document.getElementById('twitter-url').value,
            linkedin: document.getElementById('linkedin-url').value,
            orcid: document.getElementById('orcid-url').value,
            updatedAt: new Date().toISOString()
        };

        try {
            await saveProfileData(userId, profileData);
            formMessage.textContent = '¡Perfil actualizado con éxito!';
            formMessage.className = 'form-message success';
        } catch (error) {
            formMessage.textContent = 'Error al guardar el perfil.';
            formMessage.className = 'form-message error';
        } finally {
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            saveButton.disabled = false;
        }
    });
    
    // Cargar datos del perfil al inicializar
    loadProfileData(userId);
}

function setupHomeSection(userId) {
    const projectDropdown = document.getElementById('project-dropdown');
    
    // Lógica para cargar proyectos del usuario
    const loadProjects = async () => {
        const userProfile = await loadProfileData(userId);
        projectDropdown.innerHTML = ''; // Limpiar opciones
        
        if (userProfile && userProfile.projects && userProfile.projects.length > 0) {
            userProfile.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.doi;
                option.textContent = project.title;
                projectDropdown.appendChild(option);
            });
        } else {
             const option = document.createElement('option');
             option.textContent = 'Aún no tienes proyectos registrados';
             projectDropdown.appendChild(option);
        }
    };
    
    loadProjects();

    // Placeholder para el botón de añadir proyecto
    const addProjectBtn = document.getElementById('add-project-btn');
    addProjectBtn.addEventListener('click', () => {
        alert('Funcionalidad para registrar proyectos con DOI/Zenodo próximamente.');
    });
}


async function saveProfileData(userId, data) {
    const profileRef = doc(db, "user_profiles", userId);
    await setDoc(profileRef, data, { merge: true });
    console.log('Profile data saved to Firestore for user:', userId);
}

async function loadProfileData(userId) {
    const profileRef = doc(db, "user_profiles", userId);
    const docSnap = await getDoc(profileRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('display-name').value = data.displayName || '';
        document.getElementById('bio').value = data.bio || '';
        document.getElementById('website-url').value = data.website || '';
        document.getElementById('twitter-url').value = data.twitter || '';
        document.getElementById('linkedin-url').value = data.linkedin || '';
        document.getElementById('orcid-url').value = data.orcid || '';
        return data; // Devolvemos los datos para usarlos en otras funciones
    } else {
        console.log("No profile document yet for this user.");
        return null;
    }
}