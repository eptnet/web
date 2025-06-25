/**
 * =========================================================================
 * DASHBOARD.JS - VERSIÓN CONECTADA A BASE DE DATOS
 * - Se conecta a Firestore para persistir los datos del perfil.
 * - Utiliza el SDK de Firebase para interactuar con la base de datos.
 * =========================================================================
 */
// Importamos los módulos necesarios de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// --- 1. INICIALIZACIÓN Y CONFIGURACIÓN ---
const supabaseUrl = 'https://seyknzlheaxmwztkfxmk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// *** IMPORTANTE ***
// Pega aquí el objeto de configuración de tu proyecto de Firebase.
// Lo encuentras en la Consola de Firebase > Configuración del proyecto > General.
const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// Inicializamos Firebase y obtenemos acceso a los servicios
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // Podríamos usar Firebase Auth directamente en el futuro

console.log('Dashboard script loaded and Firebase initialized.');

// --- 2. GESTIÓN DE AUTENTICACIÓN ---
let currentUserId = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User signed in:', user);
        currentUserId = user.uid;
        initializeDashboard(user);
    } else {
        console.log('User is signed out or not authenticated.');
        // Para mayor seguridad, redirigimos si el estado de auth cambia a "no logueado"
        window.location.href = '/'; 
    }
});

// Verificación inicial de sesión al cargar la página (como fallback)
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.log('No active Supabase session, redirecting.');
        window.location.href = '/';
    }
})();


// --- 3. LÓGICA DEL DASHBOARD ---

function initializeDashboard(user) {
    const userNameHeader = document.getElementById('user-name-header');
    if (userNameHeader) {
        // Usamos el nombre de Firebase Auth o el email como fallback
        userNameHeader.textContent = user.displayName || user.email;
    }
    
    setupNavigation();
    setupProfileForm();
    loadProfileData(user.uid);

    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth); // Usamos el signOut de Firebase
        await supabase.auth.signOut(); // También cerramos la sesión de Supabase por si acaso
    });
}

function setupNavigation() { /* Sin cambios */
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const targetSectionId = link.dataset.section;
            contentSections.forEach(section => {
                section.classList.toggle('active', section.id === targetSectionId);
            });
        });
    });
}

function setupProfileForm() {
    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUserId) {
            alert('Error: No se ha podido identificar al usuario.');
            return;
        }
        
        const saveButton = profileForm.querySelector('.btn-primary');
        const btnText = saveButton.querySelector('.btn-text');
        const btnLoader = saveButton.querySelector('.btn-loader');
        const formMessage = document.getElementById('form-message');

        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
        saveButton.disabled = true;
        formMessage.textContent = '';
        formMessage.className = 'form-message';
        
        const profileData = {
            displayName: document.getElementById('display-name').value,
            bio: document.getElementById('bio').value,
            website: document.getElementById('website-url').value,
            twitter: document.getElementById('twitter-url').value,
            linkedin: document.getElementById('linkedin-url').value,
            orcid: document.getElementById('orcid-url').value,
            updatedAt: new Date().toISOString()
        };

        // Guardamos los datos en Firestore
        await saveProfileData(currentUserId, profileData);

        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        saveButton.disabled = false;
        formMessage.textContent = '¡Perfil actualizado con éxito!';
        formMessage.classList.add('success');
    });
}


// --- 4. INTERACCIÓN CON FIRESTORE ---

async function saveProfileData(userId, data) {
    try {
        const profileRef = doc(db, "user_profiles", userId);
        // Usamos setDoc con merge:true para crear el documento si no existe, o actualizarlo si ya existe.
        await setDoc(profileRef, data, { merge: true });
        console.log('Profile data saved to Firestore for user:', userId);
    } catch (error) {
        console.error("Error saving profile data to Firestore:", error);
        const formMessage = document.getElementById('form-message');
        formMessage.textContent = 'Error al guardar el perfil.';
        formMessage.classList.add('error');
    }
}

async function loadProfileData(userId) {
    try {
        const profileRef = doc(db, "user_profiles", userId);
        const docSnap = await getDoc(profileRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Profile data loaded from Firestore:", data);
            // Rellenar el formulario con los datos cargados
            document.getElementById('display-name').value = data.displayName || '';
            document.getElementById('bio').value = data.bio || '';
            document.getElementById('website-url').value = data.website || '';
            document.getElementById('twitter-url').value = data.twitter || '';
            document.getElementById('linkedin-url').value = data.linkedin || '';
            document.getElementById('orcid-url').value = data.orcid || '';
        } else {
            console.log("No profile document exists in Firestore for this user. A new one will be created on save.");
        }
    } catch (error) {
        console.error("Error loading profile data from Firestore:", error);
    }
}
