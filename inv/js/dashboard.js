/**
 * =========================================================================
 * DASHBOARD.JS - VERSIÓN CON BÚSQUEDA DE DOI CORREGIDA
 * - Utiliza la API de DataCite para una búsqueda de DOIs más robusta.
 * - Mantiene toda la lógica de Firestore y la interfaz de usuario.
 * =========================================================================
 */
import { getFirestore, doc, getDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const supabaseUrl = 'https://seyknzlheaxmwztkfxmk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBWV3tSqQ5A515exjaj5QK_D1VeAf6lGA",
  authDomain: "epistecnologia-927e0.firebaseapp.com",
  projectId: "epistecnologia-927e0",
  storageBucket: "epistecnologia-927e0.firebasestorage.app",
  messagingSenderId: "694061130278",
  appId: "1:694061130278:web:593d5242a92fda52887ce7",
  measurementId: "G-MBEXC7T1EF"
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
    if (userNameHeader) userNameHeader.textContent = user.user_metadata?.full_name || user.email;
    
    setupNavigation();
    setupProfileForm(user.id);
    setupProjectSystem(user.id);
    
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => await supabase.auth.signOut());
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const creationCards = document.querySelectorAll('.creation-card');

    const switchSection = (targetSectionId) => {
        navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === targetSectionId));
        contentSections.forEach(section => section.classList.toggle('active', section.id === targetSectionId));
        window.location.hash = targetSectionId.replace('-section', '');
    };

    navLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchSection(link.dataset.section); }));
    creationCards.forEach(card => card.addEventListener('click', () => switchSection(card.dataset.targetSection)));
}

// --- 4. LÓGICA DE GESTIÓN DE PROYECTOS ---

function setupProjectSystem(userId) {
    const addProjectBtn = document.getElementById('add-project-btn');
    const modalOverlay = document.getElementById('project-modal-overlay');
    const modalCloseBtn = document.getElementById('project-modal-close');
    const fetchDoiBtn = document.getElementById('fetch-doi-btn');
    const saveProjectBtn = document.getElementById('save-project-btn');
    const doiInput = document.getElementById('doi-input');
    
    let fetchedProjectData = null;

    addProjectBtn.addEventListener('click', () => modalOverlay.classList.add('is-visible'));
    modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('is-visible'));
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('is-visible'); });

    // *** INICIO DE LA CORRECCIÓN ***
    fetchDoiBtn.addEventListener('click', async () => {
        const doi = doiInput.value.trim();
        if (!doi) { alert('Por favor, introduce un DOI.'); return; }
        
        const statusDiv = document.getElementById('doi-fetch-status');
        statusDiv.textContent = 'Buscando metadatos...';
        statusDiv.style.color = 'inherit';
        
        try {
            // Usamos la API de DataCite, que es más robusta para repositorios como Zenodo.
            const response = await fetch(`https://api.datacite.org/dois/${doi}`);
            if (!response.ok) throw new Error('DOI no encontrado o inválido.');
            
            const data = await response.json();
            const metadata = data.data.attributes;
            
            // Extraemos los datos del nuevo formato de respuesta.
            const title = metadata.titles[0]?.title || 'Título no encontrado';
            const authors = metadata.creators.map(c => c.name).join(', ');
            
            document.getElementById('project-title').value = title;
            document.getElementById('project-authors').value = authors;
            
            fetchedProjectData = {
                doi: doi,
                title: title,
                authors: authors,
                registeredAt: new Date().toISOString()
            };
            
            saveProjectBtn.disabled = false;
            statusDiv.textContent = '¡Metadatos encontrados!';
            statusDiv.style.color = 'green';

        } catch (error) {
            console.error("Error fetching DOI:", error);
            statusDiv.textContent = 'Error: No se pudo encontrar el DOI. Verifica que sea correcto.';
            statusDiv.style.color = 'red';
            saveProjectBtn.disabled = true;
        }
    });
    // *** FIN DE LA CORRECCIÓN ***

    saveProjectBtn.addEventListener('click', async () => {
        if (!fetchedProjectData) return;
        
        saveProjectBtn.textContent = 'Guardando...';
        saveProjectBtn.disabled = true;

        try {
            const profileRef = doc(db, "user_profiles", userId);
            await setDoc(profileRef, {
                projects: arrayUnion(fetchedProjectData)
            }, { merge: true });

            console.log('Project saved!');
            modalOverlay.classList.remove('is-visible');
            await loadProjects(userId);

        } catch (error) {
            console.error("Error saving project:", error);
            alert("Hubo un error al guardar el proyecto.");
        } finally {
            saveProjectBtn.textContent = 'Guardar Proyecto';
        }
    });

    loadProjects(userId);
}

async function loadProjects(userId) {
    const projectDropdown = document.getElementById('project-dropdown');
    projectDropdown.innerHTML = '<option value="">Cargando proyectos...</option>';
    
    const userProfile = await getProfileData(userId);
    
    projectDropdown.innerHTML = '';
    
    if (userProfile && userProfile.projects && userProfile.projects.length > 0) {
        userProfile.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.doi;
            option.textContent = `[${project.doi}] ${project.title}`;
            projectDropdown.appendChild(option);
        });
    } else {
         const option = document.createElement('option');
         option.disabled = true;
         option.textContent = 'Aún no tienes proyectos registrados';
         projectDropdown.appendChild(option);
    }
}


// --- 5. LÓGICA DEL PERFIL (FIRESTORE) ---

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
            const profileRef = doc(db, "user_profiles", userId);
            await setDoc(profileRef, profileData, { merge: true });
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
    
    loadProfileData(userId);
}

async function getProfileData(userId) {
    const profileRef = doc(db, "user_profiles", userId);
    const docSnap = await getDoc(profileRef);
    return docSnap.exists() ? docSnap.data() : null;
}

async function loadProfileData(userId) {
    const data = await getProfileData(userId);
    if (data) {
        document.getElementById('display-name').value = data.displayName || '';
        document.getElementById('bio').value = data.bio || '';
        document.getElementById('website-url').value = data.website || '';
        document.getElementById('twitter-url').value = data.twitter || '';
        document.getElementById('linkedin-url').value = data.linkedin || '';
        document.getElementById('orcid-url').value = data.orcid || '';
    }
}
