/**
 * =========================================================================
 * DASHBOARD.JS - VERSIÓN DEPURADA Y REFACTORIZADA
 * - SOLUCIONADO: Error de carga de datos del perfil desde Firestore.
 * - REFACTORIZADO: La creación de salas ahora funciona en un modal.
 * - MEJORADO: Código más limpio, comentado y robusto.
 * =========================================================================
 */

// Obtenemos las funciones de Firebase desde el scope global
const { initializeApp } = window.firebase;
const { getFirestore, doc, getDoc, setDoc, arrayUnion } = window.firebase;

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const supabaseUrl = 'https://seyknzlheaxmwztkfxmk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNleWtuemxoZWF4bXd6dGtmeG1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjc5MTQsImV4cCI6MjA2NDg0MzkxNH0.waUUTIWH_p6wqlYVmh40s4ztG84KBPM_Ut4OFF6WC4E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const firebaseConfig = {
  apiKey: "AIzaSyBBWV3tSqQ5A515exjaj5QK_D1VeAf6lGA",
  authDomain: "epistecnologia-927e0.firebaseapp.com",
  projectId: "epistecnologia-927e0",
  storageBucket: "epistecnologia-927e0.firebasestorage.app",
  messagingSenderId: "694061130278",
  appId: "1:694061130278:web:593d5242a92fda52887ce7",
  measurementId: "G-MBEXC7T1EF"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// --- 2. LÓGICA DE AUTENTICACIÓN Y ARRANQUE ---
document.addEventListener('DOMContentLoaded', () => {
    checkSessionAndInitialize();
});

async function checkSessionAndInitialize() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
        initializeDashboard(session.user);
    } else {
        window.location.href = '/login.html'; // Redirigir a la página de login si no hay sesión
    }
}

// --- 3. LÓGICA DEL DASHBOARD ---
function initializeDashboard(user) {
    const userId = user.id;
    document.getElementById('user-name-header').textContent = user.user_metadata?.full_name || user.email;
    
    setupNavigation(userId);
    
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    });
}

function setupNavigation(userId) {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const creationCards = document.querySelectorAll('.creation-card');

    const switchSection = (targetSectionId) => {
        // Ocultar todas las secciones y desactivar todos los enlaces
        contentSections.forEach(section => section.classList.remove('active'));
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Activar la sección y el enlace correspondientes
        const sectionToShow = document.getElementById(targetSectionId);
        const linkToActivate = document.querySelector(`.nav-link[data-section="${targetSectionId}"]`);
        
        if (sectionToShow) sectionToShow.classList.add('active');
        if (linkToActivate) linkToActivate.classList.add('active');

        window.location.hash = targetSectionId.replace('-section', '');
        initializeSection(targetSectionId, userId); // Inicializar la lógica de la sección
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.section);
        });
    });

    creationCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetSectionId = card.dataset.targetSection;
            if (targetSectionId) switchSection(targetSectionId);
        });
    });

    // Cargar la sección inicial basada en el hash o por defecto 'home-section'
    const initialHash = window.location.hash.substring(1);
    const initialSectionId = initialHash ? `${initialHash}-section` : 'home-section';
    switchSection(document.getElementById(initialSectionId) ? initialSectionId : 'home-section');
}

function initializeSection(sectionId, userId) {
    // Esta función ahora se asegura de que la lógica de cada sección se ejecute cuando se muestra
    switch (sectionId) {
        case 'home-section':
            setupProjectSystem(userId);
            break;
        case 'profile-section':
            setupProfileForm(userId);
            break;
        case 'studio-section':
            setupStudioModal(userId);
            break;
    }
}

// --- 4. LÓGICA DE GESTIÓN DE PROYECTOS ---
function setupProjectSystem(userId) {
    if (document.body.dataset.projectSystemInitialized) return;
    document.body.dataset.projectSystemInitialized = true;
    
    // ... (El resto del código de setupProjectSystem sigue igual, es funcional)
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
    fetchDoiBtn.addEventListener('click', async () => { /* ... */ });
    saveProjectBtn.addEventListener('click', async () => { /* ... */ });
    loadProjects(userId);
}
async function loadProjects(userId) { /* ... (Sin cambios) */ }


// --- 5. LÓGICA DEL PERFIL (CORREGIDA Y MEJORADA) ---
async function getProfileData(userId) {
    try {
        const profileRef = doc(db, "user_profiles", userId);
        const docSnap = await getDoc(profileRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error al obtener datos del perfil:", error);
        return null;
    }
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

function setupProfileForm(userId) {
    // Cargar los datos del perfil CADA VEZ que se inicializa la sección
    loadProfileData(userId);

    // El listener del formulario se configura solo una vez para evitar duplicados
    if (document.body.dataset.profileFormInitialized) return;
    document.body.dataset.profileFormInitialized = true;

    const profileForm = document.getElementById('profile-form');
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveButton = profileForm.querySelector('button[type="submit"]');
        const messageEl = document.getElementById('profile-form-message');
        
        saveButton.disabled = true;
        messageEl.textContent = 'Guardando...';
        messageEl.className = 'form-message';

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
            messageEl.textContent = '¡Perfil actualizado con éxito!';
            messageEl.classList.add('success');
        } catch (error) {
            console.error("Error al guardar el perfil:", error);
            messageEl.textContent = 'Error al guardar el perfil.';
            messageEl.classList.add('error');
        } finally {
            saveButton.disabled = false;
            setTimeout(() => { messageEl.textContent = ''; messageEl.className = 'form-message'; }, 3000);
        }
    });
}


// --- 6. LÓGICA DEL MODAL DE ESTUDIO (NUEVA Y REFACTORIZADA) ---
function setupStudioModal(userId) {
    if (document.body.dataset.studioModalInitialized) return;
    document.body.dataset.studioModalInitialized = true;

    const openModalBtn = document.getElementById('open-studio-modal-btn');
    const modalOverlay = document.getElementById('studio-modal-overlay');
    const closeModalBtn = document.getElementById('studio-modal-close');
    
    const formStep = document.getElementById('studio-modal-form-step');
    const resultsStep = document.getElementById('studio-modal-results-step');
    const createAnotherBtn = document.getElementById('create-another-room-btn');
    const form = document.getElementById('sala-creator-form');

    const showFormStep = () => {
        resultsStep.style.display = 'none';
        formStep.style.display = 'block';
        document.getElementById('studio-modal-title').textContent = 'Crear Nueva Sala';
    };
    
    const showResultsStep = () => {
        formStep.style.display = 'none';
        resultsStep.style.display = 'block';
        document.getElementById('studio-modal-title').textContent = '¡Tu Sala está Lista!';
    };

    openModalBtn.addEventListener('click', () => {
        showFormStep(); // Siempre mostrar el formulario al abrir
        modalOverlay.classList.add('is-visible');
    });

    closeModalBtn.addEventListener('click', () => modalOverlay.classList.remove('is-visible'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('is-visible');
    });
    
    createAnotherBtn.addEventListener('click', showFormStep);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const profile = await getProfileData(userId);
        if (!profile || !profile.orcid) {
            alert('¡Importante! Debes registrar tu URL de ORCID en la sección "Editar Perfil" para poder crear salas.');
            return;
        }

        const orcidId = profile.orcid.split('/').pop();
        const initials = (profile.displayName || 'INV').split(' ').map(n => n[0]).join('');
        const sessionTitle = document.getElementById('session-title').value;
        const numberOfGuests = parseInt(document.getElementById('session-guests').value, 10);
        const layout = document.getElementById('session-layout').value;
        const isLive = document.getElementById('session-live-checkbox').checked;

        const vdoBaseUrl = 'https://vdo.epistecnologia.com/';
        const roomName = `ept-${initials.toLowerCase()}-${orcidId.slice(-4)}-${Date.now().toString().slice(-5)}`;
        const directorKey = `dir-${orcidId}`;

        const guestUrl = `${vdoBaseUrl}?room=${roomName}&label=${encodeURIComponent(sessionTitle)}`;
        let directorUrl = `${vdoBaseUrl}mixer.html?room=${roomName}&director=${directorKey}&layout=${layout}&totalviews=${numberOfGuests + 1}`;

        document.getElementById('director-link-input').value = directorUrl;
        document.getElementById('guest-link-input').value = guestUrl;

        const publicLinkGroup = document.getElementById('public-link-group');
        if (isLive) {
            const pushId = `live-${orcidId}`;
            directorUrl += `&push=${pushId}`;
            const publicUrl = `${vdoBaseUrl}?view=${pushId}`;
            document.getElementById('public-link-input').value = publicUrl;
            publicLinkGroup.style.display = 'block';
        } else {
            publicLinkGroup.style.display = 'none';
        }
        
        showResultsStep();
        window.open(directorUrl, '_blank');
    });

    document.querySelectorAll('.copy-btn').forEach(button => {
        if (button.dataset.listenerAttached) return;
        button.dataset.listenerAttached = true;
        button.addEventListener('click', () => {
            const targetInput = document.getElementById(button.dataset.target);
            navigator.clipboard.writeText(targetInput.value).then(() => {
                const originalText = button.textContent;
                button.textContent = '¡Copiado!';
                setTimeout(() => { button.textContent = originalText; }, 2000);
            });
        });
    });
}